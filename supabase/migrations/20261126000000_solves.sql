-- Timed solves from a scramble, one row per solve, outside account_data:
-- older app versions never read or write them (their allow-list rejects
-- unknown document keys), and a long history does not grow the document.
-- As with account_data, users read their own rows and write only through the
-- functions below, which take the owner from the verified JWT.
create table public.solves (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  event text not null check (event ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  recorded_at timestamptz not null,
  -- The app's record as it keeps it (time, scramble, penalty, cube turns).
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint solves_record_object check (jsonb_typeof(record) = 'object'),
  constraint solves_record_size check (octet_length(record::text) <= 65536)
);
create index solves_by_event on public.solves (user_id, event, recorded_at desc);
alter table public.solves enable row level security;
revoke all on public.solves from anon, authenticated;
grant select on public.solves to authenticated;
create policy "Read own solves" on public.solves
  for select to authenticated using ((select auth.uid()) = user_id);

-- Save solves (new or changed, e.g. a penalty), up to 500 per call. A record
-- replaces the one with its id. The expected id guards against an account
-- switch while an older request waits, as in save_account_data.
create function public.save_solves(p_solves jsonb, p_expected_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  saved integer;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_user_id is distinct from account_id then
    raise exception 'Account session changed' using errcode = '28000';
  end if;
  if p_solves is null or jsonb_typeof(p_solves) <> 'array' or jsonb_array_length(p_solves) > 500 then
    raise exception 'Invalid solves' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_solves) as solve(value)
    where jsonb_typeof(solve.value) <> 'object'
      or jsonb_typeof(solve.value->'id') <> 'string'
      or (solve.value->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(solve.value->'event') <> 'string'
      or (solve.value->>'event') !~ '^[a-z0-9][a-z0-9-]{0,31}$'
      or jsonb_typeof(solve.value->'recordedAt') <> 'string'
      or octet_length(solve.value::text) > 65536
  ) then raise exception 'Invalid solve' using errcode = '22023'; end if;
  if (select count(distinct solve.value->>'id') from jsonb_array_elements(p_solves) as solve(value))
    <> jsonb_array_length(p_solves) then
    raise exception 'Repeated solve' using errcode = '22023';
  end if;

  insert into public.solves (user_id, id, event, recorded_at, record)
  select account_id, (solve.value->>'id')::uuid, solve.value->>'event', (solve.value->>'recordedAt')::timestamptz, solve.value
  from jsonb_array_elements(p_solves) as solve(value)
  on conflict (user_id, id) do update
    set event = excluded.event, recorded_at = excluded.recorded_at, record = excluded.record, updated_at = now();
  get diagnostics saved = row_count;

  if (select count(*) from public.solves where user_id = account_id) > 20000 then
    raise exception 'Too many solves' using errcode = '54000';
  end if;
  return saved;
end;
$$;
revoke all on function public.save_solves(jsonb, uuid) from public, anon;
grant execute on function public.save_solves(jsonb, uuid) to authenticated;

-- Delete solves by id, up to 500 per call; ids that are already gone are fine.
create function public.delete_solves(p_ids uuid[], p_expected_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  deleted integer;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_user_id is distinct from account_id then
    raise exception 'Account session changed' using errcode = '28000';
  end if;
  if p_ids is null or cardinality(p_ids) > 500 then
    raise exception 'Invalid solve ids' using errcode = '22023';
  end if;
  delete from public.solves where user_id = account_id and id = any(p_ids);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
revoke all on function public.delete_solves(uuid[], uuid) from public, anon;
grant execute on function public.delete_solves(uuid[], uuid) to authenticated;
