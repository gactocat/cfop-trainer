-- One versioned document per account preserves the existing store migrations.
create table public.account_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  last_write_id uuid,
  updated_at timestamptz not null default now(),
  constraint account_data_object check (jsonb_typeof(data) = 'object'),
  constraint account_data_size check (octet_length(data::text) <= 8388608)
);
alter table public.account_data enable row level security;
revoke all on public.account_data from anon, authenticated;
grant select on public.account_data to authenticated;
create policy "Read own account data" on public.account_data
  for select to authenticated using ((select auth.uid()) = user_id);

-- Writes only go through this function so every writer uses compare-and-swap.
-- Ownership comes from the verified JWT. The expected id only guards against
-- an auth switch while an older request is waiting to be dispatched.
create function public.save_account_data(p_data jsonb, p_revision bigint, p_write_id uuid, p_expected_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  current_row public.account_data%rowtype;
  next_revision bigint;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_user_id is distinct from account_id then
    raise exception 'Account session changed' using errcode = '28000';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 8388608
    or p_write_id is null or p_revision is null or p_revision < 0 then
    raise exception 'Invalid account document' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_data) as entry
    where jsonb_typeof(entry.value) <> 'string' or entry.key <> all(array[
      'pll-app:algorithms:v1', 'pll-app:f2l-algorithms:v1', 'pll-app:oll-algorithms:v1',
      'pll-app:random-solves:v1', 'pll-app:f2l-random-solves:v1', 'pll-app:oll-random-solves:v1',
      'pll-app:pll-random-selection:v1', 'pll-app:f2l-random-selection:v1', 'pll-app:oll-random-selection:v1',
      'pll-app:pll-selection-presets:v1', 'pll-app:f2l-selection-presets:v1', 'pll-app:oll-selection-presets:v1',
      'pll-app:locale:v1', 'pll-app:practice-settings:v1',
      'pll-app:f2l-auf-display:v1', 'pll-app:f2l-trainer-mode:v1', 'pll-app:f2l-scramble-settings:v1',
      'pll-app:oll-trainer-settings:v1', 'pll-app:pll-trainer-settings:v1'
    ])
  ) then raise exception 'Unsupported account data' using errcode = '22023'; end if;

  insert into public.account_data (user_id) values (account_id) on conflict (user_id) do nothing;
  select * into current_row from public.account_data where user_id = account_id for update;
  -- Retrying a write after a lost response must not save it twice.
  if current_row.last_write_id = p_write_id then return current_row.revision; end if;
  if current_row.revision <> p_revision then
    raise exception 'Account was changed on another device' using errcode = 'PT409';
  end if;
  next_revision := current_row.revision + 1;
  update public.account_data set data = p_data, revision = next_revision,
    last_write_id = p_write_id, updated_at = now() where user_id = account_id;
  return next_revision;
end;
$$;
revoke all on function public.save_account_data(jsonb, bigint, uuid, uuid) from public, anon;
grant execute on function public.save_account_data(jsonb, bigint, uuid, uuid) to authenticated;
