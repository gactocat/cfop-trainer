-- Developer mode: notes the app's developers write on parts of a screen.
-- Only accounts listed in dev_users are developers. The list is kept in the
-- database, never in the app (the repository is public): rows are added in
-- the SQL Editor, and clients can neither read nor change it. Each developer
-- reads only their own notes and writes them only through the functions
-- below, which take the owner from the verified JWT, as for account_data.
create table public.dev_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.dev_users enable row level security;
revoke all on public.dev_users from anon, authenticated;

-- Whether the signed-in account is a developer; it says nothing about others.
create function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.dev_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_developer() from public, anon;
grant execute on function public.is_developer() to authenticated;

create table public.dev_notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- The page's path and query, e.g. /pll/random.
  page text not null check (char_length(page) between 1 and 2048),
  -- {"width", "height", "devicePixelRatio"} in CSS pixels.
  viewport jsonb not null check (jsonb_typeof(viewport) = 'object' and octet_length(viewport::text) <= 256),
  theme text not null check (theme in ('light', 'dark')),
  locale text not null check (locale ~ '^[a-z]{2}(-[A-Za-z0-9]{1,8})?$'),
  -- The commit the app was built from.
  app_version text not null check (char_length(app_version) between 1 and 64),
  platform text not null check (platform in ('web', 'ios')),
  -- What was chosen: a part of the screen or an area dragged, with its marks
  -- (data-ui), text, position and size.
  target jsonb not null check (jsonb_typeof(target) = 'object' and octet_length(target::text) <= 16384),
  comment text not null check (char_length(comment) between 1 and 4000),
  -- A small JPEG of the area as a data URL (up to 400,000 characters, about 290 KiB).
  screenshot text check (screenshot is null
    or (screenshot like 'data:image/jpeg;base64,%' and octet_length(screenshot) <= 400000)),
  -- So a list can leave the screenshots out and still know which notes have one.
  has_screenshot boolean generated always as (screenshot is not null) stored,
  status text not null default 'open' check (status in ('open', 'done')),
  resolved_at timestamptz,
  constraint dev_notes_resolved check ((status = 'done') = (resolved_at is not null))
);
create index dev_notes_by_user on public.dev_notes (user_id, status, created_at desc);
alter table public.dev_notes enable row level security;
revoke all on public.dev_notes from anon, authenticated;
grant select on public.dev_notes to authenticated;
create policy "Developers read own notes" on public.dev_notes
  for select to authenticated using ((select auth.uid()) = user_id and (select public.is_developer()));

-- Save a note. The app makes its id, so a save retried after a lost answer
-- is not saved twice. The expected id guards against an account switch while
-- an older request waits, as in save_account_data.
create function public.save_dev_note(p_note jsonb, p_expected_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  note_id uuid;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_user_id is distinct from account_id then
    raise exception 'Account session changed' using errcode = '28000';
  end if;
  if not exists (select 1 from public.dev_users where user_id = account_id) then
    raise exception 'Not a developer' using errcode = '42501';
  end if;
  if p_note is null or jsonb_typeof(p_note) <> 'object'
    or jsonb_typeof(p_note->'id') <> 'string'
    or (p_note->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_note->'page') <> 'string'
    or jsonb_typeof(p_note->'viewport') <> 'object'
    or jsonb_typeof(p_note->'theme') <> 'string'
    or jsonb_typeof(p_note->'locale') <> 'string'
    or jsonb_typeof(p_note->'appVersion') <> 'string'
    or jsonb_typeof(p_note->'platform') <> 'string'
    or jsonb_typeof(p_note->'target') <> 'object'
    or jsonb_typeof(p_note->'comment') <> 'string'
    or coalesce(jsonb_typeof(p_note->'screenshot'), 'null') not in ('string', 'null')
  then raise exception 'Invalid note' using errcode = '22023'; end if;
  note_id := (p_note->>'id')::uuid;

  -- The table's checks bound every field (sizes, the screenshot's kind).
  insert into public.dev_notes (id, user_id, page, viewport, theme, locale, app_version, platform, target, comment, screenshot)
  values (note_id, account_id, p_note->>'page', p_note->'viewport', p_note->>'theme', p_note->>'locale',
    p_note->>'appVersion', p_note->>'platform', p_note->'target', p_note->>'comment', p_note->>'screenshot')
  on conflict (id) do nothing;
  if not exists (select 1 from public.dev_notes where id = note_id and user_id = account_id) then
    raise exception 'Invalid note' using errcode = '22023';
  end if;
  return note_id;
end;
$$;
revoke all on function public.save_dev_note(jsonb, uuid) from public, anon;
grant execute on function public.save_dev_note(jsonb, uuid) to authenticated;

-- Mark a note done, or open again. False when the account has no such note.
create function public.set_dev_note_status(p_id uuid, p_status text, p_expected_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  changed integer;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_user_id is distinct from account_id then
    raise exception 'Account session changed' using errcode = '28000';
  end if;
  if not exists (select 1 from public.dev_users where user_id = account_id) then
    raise exception 'Not a developer' using errcode = '42501';
  end if;
  if p_id is null or p_status is null or p_status not in ('open', 'done') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  update public.dev_notes
    set status = p_status,
      resolved_at = case when p_status = 'done' then coalesce(resolved_at, now()) else null end
    where id = p_id and user_id = account_id;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.set_dev_note_status(uuid, text, uuid) from public, anon;
grant execute on function public.set_dev_note_status(uuid, text, uuid) to authenticated;
