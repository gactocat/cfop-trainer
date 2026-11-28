# Developer mode

Developer mode lets the app's developers point at a part of any screen and
write a note on it, for wording and layout fixes. Each note keeps where it was
written (page, window size, theme, language, app version, web or iOS), what it
points at and a small screenshot, and is passed on to a webhook as soon as it
is saved.

Only accounts listed in the database's `dev_users` table see it. The list
lives in the database only: the repository is public, so no email address or
user id of a developer is written in the code.

## Using it

1. Sign in with a developer account. **Settings** on the top page then shows
   a **Developer mode** switch (開発者モード) and **Developer notes**
   (開発者メモ). Other accounts and guests see neither.
2. Turn **Developer mode** on. It is kept on this device only.
3. Press the pen in the bottom right corner (**Write a note**, メモを書く). The
   pen is hidden while a timer is held or running.
4. Point at a part of the screen: it lights up with its name. On a phone,
   press it. Click or tap to pick it, or drag to pick an area. Dialogs work
   too (the pen moves into an open dialog).
5. Write the comment and press **Save** (or Cmd/Ctrl+Enter). Saving ends the
   choosing; the pen shows a check for a moment. **Cancel**, Esc and the pen
   again end it without saving.

While choosing, the page does not scroll and its own buttons, keys and
timers are held back. **Developer notes** (`/dev-notes`) lists the notes,
**Open** or **Done**, newest first (the latest 50), with **Mark done** and
**Reopen**. A screenshot opens at full size when tapped.

## What a note keeps

| Column | Content |
| --- | --- |
| `id` | Made by the app (a retried save is not saved twice). |
| `user_id`, `created_at` | The writer, from the verified JWT, and when. |
| `page` | Path and query, e.g. `/pll/random`. |
| `viewport` | `{"width", "height", "devicePixelRatio"}` in CSS pixels. |
| `theme`, `locale` | `light` / `dark`, `en` / `ja`. |
| `app_version` | The commit the app was built from (`VERCEL_GIT_COMMIT_SHA`, else `git rev-parse HEAD`; `-dev` under `next dev`). |
| `platform` | `web` or `ios`. |
| `target` | What was picked; see below. |
| `comment` | 1 to 4000 characters. |
| `screenshot` | A JPEG data URL, at most 400,000 characters (about 290 KiB); the app aims for 250,000. Null when it could not be drawn. |
| `has_screenshot` | Generated from `screenshot`, so lists can leave the image out. |
| `status`, `resolved_at` | `open` or `done`, and when it was marked done. |

`target`:

```json
{
  "kind": "element",
  "rect": { "x": 792, "y": 254, "width": 279, "height": 160 },
  "scroll": { "x": 0, "y": 0 },
  "part": {
    "ui": "LandingPage.entry", "tag": "a", "id": null, "role": null, "label": null,
    "text": "PLL", "className": "flex h-32 …",
    "selector": "[data-ui=\"LandingPage.entry\"]",
    "rect": { "x": 792, "y": 254, "width": 279, "height": 160 }
  },
  "path": ["HomeSection#algorithms", "LandingPage", "AppMain"],
  "shot": {
    "result": "ok", "holder": "LandingPage", "holderSize": [370, 1066],
    "drawn": { "x": 248, "y": 196, "width": 138, "height": 160 },
    "scale": 2, "attempts": 1, "svgChars": 1640394, "ms": 202
  }
}
```

`kind` is `element` (a part picked) or `area` (dragged). `rect` is in window
CSS pixels. `part` is the part picked, widened to the control or drawing it
belongs to (a button, a link, an SVG), or for an area the smallest element
holding all of it. `ui` is its `data-ui` mark, `text` the start of its text,
`selector` the way down from the nearest marked part. `path` lists the marks
around it, nearest first, with the element's id when it has one. An area also
has `inside`: the marked parts it overlaps (`{"ui", "text"}`).

`shot` says how the screenshot went (see below): `result` (`ok`, `blank`,
`failed` or `timeout`), the element copied (`holder`, `holderSize`), the part
of the window drawn (`drawn`), `scale`, `attempts`, the copy's size in
characters (`svgChars`), `ms` and any `error`.

The screenshot shows the part with a margin of 16 px and a blue outline, or
the area. It is drawn from the DOM, not from the screen, so nothing asks for
permission: modern-screenshot copies the smallest element holding it into an
SVG (`foreignObject`), and only that part of the SVG is drawn, at most
1200 px a side. The element copied is at most 1.5 windows tall and never above
a fixed or sticky one (the header, a dialog); the margin is cut where it ends.
Only standard CSS properties are copied: Tailwind's custom properties, which
every element inherits, more than doubled the copy. A draw that comes out one
colour is drawn again after a pause (Safari may draw such an SVG before laying
it out); if it stays one colour, or drawing fails or takes over 14 seconds, the
note is saved without a screenshot and `shot` says why. cubing.js players draw
inside closed shadow roots, so they are drawn separately and put in place: a
2D view from its SVG, a 3D one through the player's own screenshot.

The first version drew the whole element (on a phone usually the page's main
column, since the margin reaches the screen's edge) and then cut the area
from it. On iPhones every screenshot came out one colour: the copy was never
drawn and only the background filled the canvas. Headless WebKit, Chromium
and the iOS Simulator drew the same copies, so the cause could not be seen
locally; the size of what was drawn and Safari's late layout are the known
causes of this, and both are avoided now. If it happens again, `shot` shows
which step gave out.

## Marks

Parts carry `data-ui` with their component's name, so a mark can be searched
for in `src/`: the shared controls in `components/ui.tsx` (`Segmented`,
`Switch`, `SettingsGroup`, `SettingRow`), the app frame (`AppHeader`,
`AppMain`, `AppFooter`, `HeaderTitle`, `AppModal`, `TitleBar`) and each
screen's main blocks (`PllGrid`, `PllGrid.case`, `AlgorithmRow`,
`SolveFrame`, `ScrambleHead`, `StatusLine`, `SolveRecords`, `AccountPanel`,
...). A part of a component is `Component.part`. Add a mark to a new screen's
main blocks the same way.

## Webhook

After a save the app posts `{"id": "<note id>"}` with the account's access
token to `POST /api/dev-note` (`src/app/api/dev-note/route.web.ts`, handler in
`src/lib/dev-mode/dev-note-webhook.ts`). The iOS app calls
`https://cfop.app/api/dev-note`; the route answers CORS for
`capacitor://localhost`. The route is left out of the iOS static export.

The route:

1. does nothing and answers `200 {"ok":true,"sent":false}` when
   `DEV_NOTE_WEBHOOK_URL` is not set (the note is saved either way);
2. checks the token with Supabase Auth (`/auth/v1/user`), then that the
   account is a developer (`is_developer()`), then reads the note back as that
   account (row-level security returns only its own);
3. posts the note to `DEV_NOTE_WEBHOOK_URL`, with
   `Authorization: Bearer <DEV_NOTE_WEBHOOK_SECRET>` when that is set, and
   answers `200 {"ok":true,"sent":true}`, or `502` when the webhook fails.

Refusals: `400` (no note id), `401` (no or invalid token), `403` (not a
developer), `404` (no such note of this account), `413` (body over 1 KiB).
The app only logs a failure to the console; the note stays saved.

Vercel environment variables (Production), server-only, never `NEXT_PUBLIC_`:

| Name | Value |
| --- | --- |
| `DEV_NOTE_WEBHOOK_URL` | The webhook's URL. |
| `DEV_NOTE_WEBHOOK_SECRET` | Optional; sent as a bearer token. |

They take effect on the next deployment. The route also uses the two public
Supabase variables already set.

What the webhook receives (`Content-Type: application/json`):

```json
{
  "type": "dev_note",
  "note": {
    "id": "4c71a757-d3fa-48db-a916-01c6030071af",
    "user_id": "…",
    "created_at": "2026-11-28T03:34:46.125Z",
    "status": "open",
    "page": "/pll/random",
    "url": "https://cfop.app/pll/random",
    "viewport": { "width": 1280, "height": 800, "devicePixelRatio": 2 },
    "theme": "light",
    "locale": "ja",
    "app_version": "2927b94afad765b0941ed05d400fccc2020efe2c",
    "platform": "web",
    "target": { "kind": "element", "…": "as above" },
    "comment": "…",
    "screenshot": "data:image/jpeg;base64,…"
  }
}
```

`screenshot` is the stored JPEG data URL (or null), so the body stays under
about 420 KB.

## Database (not applied yet)

The migration is
[`20261128000000_dev_notes.sql`](../supabase/migrations/20261128000000_dev_notes.sql).
It adds `dev_users`, `dev_notes`, `is_developer()`, `save_dev_note()` and
`set_dev_note_status()`, and does not touch `account_data` or `solves`.
Until it runs, the app asks `is_developer()`, gets "not found" and shows no
developer mode; nothing else changes.

To apply it, open **SQL Editor** in Supabase Studio for `cfop-trainer`, paste
the whole file and run it once. Then register a developer (fill in the
account's email address):

```sql
insert into public.dev_users (user_id)
select id from auth.users where email = '';
```

Check with `select * from public.dev_users;`. Sign out and in again (or
reload) for the app to ask again. To take someone off, delete their row.

How it is guarded, as for `account_data` and `solves`:

- `dev_users`: row-level security on, no policies, no grants. Clients cannot
  read or change it; only the SQL Editor (or the service role) can.
- `is_developer()`: security definer, answers for the signed-in account only.
- `dev_notes`: clients may only select, and the policy returns a developer's
  own rows. Writes go through `save_dev_note()` and `set_dev_note_status()`
  (security definer), which take the owner from the JWT, refuse accounts not
  in `dev_users` (`42501`) and check every field; the table's checks bound
  each column, including the screenshot's size and kind.
- Deleting an account deletes its notes and its `dev_users` row.

To undo it (this deletes every note):

```sql
drop function public.set_dev_note_status(uuid, text, uuid);
drop function public.save_dev_note(jsonb, uuid);
drop table public.dev_notes;
drop function public.is_developer();
drop table public.dev_users;
```

## Checks

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-dev-notes.mts
```

It drives the webhook route with fixtures: the token, the developer check,
the note read back, the post and its secret, no webhook variable, refusals
before anything is asked, webhook failures and CORS for the iOS app.

The migration was checked in PGlite with stand-ins for Supabase's auth schema
and roles: developers save and read only their own notes, others cannot save
or read, a retried save is saved once, every field's bounds, done and reopen,
removal from `dev_users`, and the cascade on account deletion. The screens
were checked against a local stand-in for Auth and PostgREST running the same
migrations in PGlite, with a local webhook receiver.
