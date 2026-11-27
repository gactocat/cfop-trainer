# Account setup

CFOP Trainer uses Supabase Auth (email and password) and PostgreSQL. No Google
Cloud app registration or custom password database is needed. Without the two
public environment variables below, guest mode remains available and sign-in is
shown as unavailable.

## Current provisioning status

As of September 20, 2026:

- Created the `cfop-trainer` Supabase resource on the Free plan in Tokyo (`hnd1`).
- Connected it to the `cfop-trainer` Vercel project's Production environment.
- Supabase project reference: `lwlsbgcksljmonggtiex`.
- Applied `20260919000000_account_data.sql`, including the `PT409` conflict code.
  Do not run the initial migration again on this project.
- Verified live email/password authentication, database saves, and account isolation.
- Email sign-up and email confirmation are enabled, with an 8-character minimum
  password. The Site URL and redirect allowlist match the production/local URLs
  documented below.
- Custom SMTP is enabled: Supabase sends authentication emails through Resend
  from `CFOP Trainer <noreply@auth.cfop.app>`. See
  [Email delivery](#email-delivery).
- On November 26, 2026 the project was paused for inactivity and resumed by
  hand. Since then Vercel Cron keeps it active; see
  [Keep the Free project from pausing](#keep-the-free-project-from-pausing).

Open the project in the
[Supabase dashboard](https://supabase.com/dashboard/project/lwlsbgcksljmonggtiex)
(Supabase Studio). From Vercel, the same project is reached through the
`cfop-trainer` resource under the team's **Storage** (Vercel's old direct link
to the resource no longer opens). Authentication configuration is documented below.

## Create Supabase through Vercel

Use the Vercel Marketplace integration for this app. It creates the Supabase
organization/project, handles billing through Vercel, and synchronizes connection
variables. A separate, directly billed Supabase project is not required.
See the [integration guide](https://supabase.com/docs/guides/integrations/vercel-marketplace).

1. Open the Vercel team that owns the app and select its **Storage** area, or open
   [Supabase in the Marketplace](https://vercel.com/marketplace/supabase).
2. Add the Supabase integration. For initial use, select the **Free** plan and
   the Tokyo region (`hnd1`). Review the plan shown before confirming creation.
3. Name the resource `cfop-trainer` and connect it to the Vercel project
   `gactocats-projects/cfop-trainer`, whose public domain is
   `https://cfop-trainer-ten.vercel.app`.
4. Select **Production** for the public app. Only include Development or Preview
   when those environments should share its database. A separate database is
   preferable for development data.
5. From the resource's integration page, open **Supabase Studio**. Use this
   dashboard for the SQL and Authentication steps below. Creating the resource
   does not create the app's tables or configure authentication redirect URLs.

The same resource can also be created with the Vercel CLI. The commands below
are an alternative to the dashboard steps; do not run them after creating a
resource there. The confirmed target is `gactocats-projects/cfop-trainer`:

```sh
npx vercel@latest link --yes --scope gactocats-projects --project cfop-trainer
npx vercel@latest integration add supabase --name cfop-trainer --plan free --metadata region=hnd1 --environment production --no-env-pull
```

For a new installation, Vercel may require the team's
[marketplace terms](https://vercel.com/gactocats-projects/~/integrations/accept-terms/supabase?source=cli)
to be accepted in the browser before provisioning can finish. This step is
already complete for `gactocats-projects`. An
`integration_terms_acceptance_required` response means no database was created;
complete the browser step and then retry the installation.

Keep the Data API enabled; this app uses it to access
`public.account_data` and `public.save_account_data`.

## Create the database table

Open **SQL Editor**, create a new query, paste the complete contents of
[the migration](../supabase/migrations/20260919000000_account_data.sql), and run
it once on the new project. This creates the table, access policy, and save
function together. Check that `public.account_data` appears in **Table Editor**.
An empty table is expected until an account completes its first-login choice.

If you later use the Supabase CLI, track this migration as already applied
before running `supabase db push` against the same project. Do not rerun it or
remove the existing table to resolve an “already exists” message.

## Configure email authentication

In **Authentication**, enable the Email provider and allow new user sign-ups.
Keep email confirmation enabled and set the minimum password length to at least
8 characters. Other sign-in providers are not required.

In **Authentication → URL Configuration**, enter the confirmed production
domain for `cfop-trainer`:

| Setting | Value |
| ------- | ----- |
| Site URL | `https://cfop.app` |
| Redirect URL | `https://cfop.app/account` |
| Legacy web redirect | `https://cfop-trainer-ten.vercel.app/account` |
| Redirect URL for local testing | `http://localhost:3000/account` |
| Redirect URL for iOS | `cfoptrainer://auth/callback` |

Add each redirect URL as a separate entry. If you use a different local port or
preview deployment, add its exact `/account` URL too. Keep the default
confirmation/reset email links using `{{ .ConfirmationURL }}`. The app passes
`/account` as the destination and opens the same account modal over the top
page for confirmation and password recovery. Normal sign-in opens from Account
in the settings on the top page (the header's back button leads there).

See [password authentication](https://supabase.com/docs/guides/auth/passwords)
and [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Email delivery

Confirmation and password-reset emails go out through the custom SMTP set in
Supabase Authentication's email settings, sent by Resend:

| Setting | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (TLS) |
| Sender email | `noreply@auth.cfop.app` |
| Sender name | `CFOP Trainer` |

The SMTP credentials (a Resend API key that can only send from
`auth.cfop.app`) are kept in Supabase only, never in the repository, the
browser or Vercel's public variables.

`cfop.app` uses Vercel DNS (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), where
Resend's records for the sending domain `auth.cfop.app` are set:

| Name | Records |
| --- | --- |
| `resend._domainkey.auth.cfop.app` | TXT: Resend's DKIM key |
| `send.auth.cfop.app` | TXT: SPF `v=spf1 include:amazonses.com ~all`; MX: `feedback-smtp.ap-northeast-1.amazonses.com` (Amazon SES, Tokyo), the return path |
| `_dmarc.auth.cfop.app` | TXT: DMARC `v=DMARC1; p=none;` |

Supabase allows 30 authentication emails per hour, and Resend's Free plan 100
a day. Keep email confirmation enabled. Without custom SMTP (a new project,
for example), Supabase's built-in sender only reaches the project's team
members at a very low rate. See
[Supabase's SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) and
[Resend's Supabase setup](https://resend.com/docs/send-with-supabase-smtp);
[release preparation](release.md#email-delivery-configured-and-verified)
records how delivery was verified.

## Connect the local app

Open the project's **Connect** panel and copy its **Project URL** and
**Publishable key**. The key is also available under the project's API Keys
settings. Use the publishable key, not the secret/service-role key or database
password. See [API key types](https://supabase.com/docs/guides/getting-started/api-keys).

Create `.env.local` in the repository root using `.env.example` as a template.
If `.env.local` already exists, add these entries without replacing its other
values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Then start or restart the dev server:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/account`, create an account using your test email,
and open the confirmation link. Choose whether to import device data. Change a
setting and reload; confirm the setting is restored and no storage error appears.

## Verify Vercel connection and deploy

1. Open the connected Vercel project and its **Settings → Environment Variables**.
2. Confirm the integration created `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for **Production**. If an integration
   prefix changed their names, map the correct values to the exact names above.
   Keep other integration-generated credentials private; the app only needs
   these two public values. Do not overwrite unrelated variables.
3. Deploy the code containing the account feature. If it is already deployed,
   create a new deployment using **Redeploy**. Saving environment variables alone
   does not update an existing deployment.
4. Open the chosen project's production `/account` page and repeat the sign-up,
   confirmation, save/reload and password-reset checks. The Site URL and redirect
   allowlist in Supabase must match this project's actual public domain.

Both variables are compiled into the client bundle, so changes require a new
build. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Troubleshooting setup

| Symptom | Check |
| ------- | ----- |
| Sign-in is unavailable | Both variables are set for the deployment's environment and it was rebuilt afterward. |
| Confirmation/reset email does not arrive | SMTP configuration, spam folder, recipient restrictions and sending limits. |
| Email link opens the wrong address | Site URL and the exact `/account` redirect URL match the app being tested. |
| Account data will not load or save | The migration ran successfully, the Data API is enabled, and the URL/key belong to the same project. |
| SQL says an object already exists | Check whether the migration was already applied; do not delete existing data. |

## Storage behavior

- Web guests use the existing versioned `localStorage` keys and can work offline.
  iOS guests use a native Preferences document with the same record formats.
  Browser guest data and iOS guest data are separate; sign in to share data.
- Signed-in accounts use a database document containing the same serialized
  formats. Settings (including language), algorithms, times, selected cases,
  and saved selections are included. Account data is kept in memory only on
  the client; the auth SDK persists session credentials to maintain sign-in.
  iOS stores session credentials and PKCE verifiers in the device Keychain.
- The first login offers import of all supported device data or a fresh start.
  Import is a single atomic write; it never deletes the guest data. Later
  logins load the server document and never automatically re-import guest data.
- Signing out clears account memory and restores guest data. Account changes
  never get copied into guest storage. Auth transitions remount practice
  screens to discard timers, form drafts and previous-account component state.
- Offline accounts can view loaded data, but cannot edit or record times.
  Reloading offline cannot restore private account data from disk.
- Writes are serialized and use a revision check to prevent overwriting changes
  from another tab/device. A conflict requires explicitly reloading the server
  copy. Saving shows nothing on screen. A failed save is retried by itself
  with the same write id (after 2 s, then longer, up to once a minute, and at
  once when back online or after the next change), so a lost response never
  commits twice. Data stays editable meanwhile. After three failed saves in a
  row the page says the account is not saved yet, until a save succeeds.
  Unsaved edits stay in memory and trigger a browser leave-page warning.
- Use **Reload server data** in the Account modal to pick up another device's
  changes. This version does not stream live updates between devices.
- Each document is limited to 8 MiB. A size-limit failure keeps failing, so it
  shows as not saved yet. Large histories may eventually need normalized,
  paginated tables.
- The service worker caches the public app shell and assets only; auth/account
  routes and API requests are excluded. Supabase requests bypass it entirely.

## Verification

Run the persistence regression script with Node 24:

```sh
node --import ./scripts/register-src-alias.mjs scripts/verify-account-storage.mts
node --import ./scripts/register-src-alias.mjs scripts/verify-practice-settings.mts
```

Before enabling production sign-in, verify with a configured test project:

- Create and confirm an email account, sign in, and reset its password.
- Import guest data, edit settings and record times; reload and use a second
  device to verify persistence. Confirm the guest keys remain unchanged.
- With two accounts, check that each can only read its own row and cannot write
  directly to the table. Passing another expected user id to the save function
  must be rejected, including during an account switch.
- Edit from two tabs to verify the revision conflict, and interrupt a save to
  verify it is retried by itself and the leave-page warning. Sign out and
  confirm guest data returns.
- Test guest offline writes and account offline read-only behavior, including
  the full-screen trainer. Confirm private data never appears in Cache Storage.

References: [password authentication](https://supabase.com/docs/guides/auth/passwords),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Solves table (not applied yet)

Timed solves from a scramble (`/solve/cfop`) are kept per row in
`public.solves`, outside `account_data`, so older app versions are not
affected. Until this migration runs, signed-in users keep their solves on the
device, as before (the app treats a missing table as "not ready").

To apply it, open **SQL Editor** in Supabase Studio for `cfop-trainer`, paste
the whole of
[the migration](../supabase/migrations/20261126000000_solves.sql) and run it
once. It only adds the table, its read policy, an index and the functions
`save_solves` and `delete_solves`; it does not touch `account_data` or
`save_account_data`. Check that `public.solves` appears in **Table Editor**.
PostgREST normally picks up the new table at once; if the app still keeps
solves on the device after a reload, run `notify pgrst, 'reload schema';`.

After it runs, signed-in users see their account's solves, are offered to add
the device's solves once, and every change is saved to the account. Older app
versions behave as before.

To undo it (this deletes the solves kept in accounts; devices keep their own):

```sql
drop function public.delete_solves(uuid[], uuid);
drop function public.save_solves(jsonb, uuid);
drop table public.solves;
```

The app then goes back to keeping signed-in users' solves on the device.
Changes waiting in a device's outbox stay there until the table exists again.

## Keep the Free project from pausing

Supabase pauses a Free plan project that shows low database activity over
7 days; a few requests to the database each day are enough to keep it
running ([free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
Supabase emails a warning about a week before pausing and again once paused.
While paused, sign-in and account saves fail; guest mode keeps working.

To keep it active without real users, Vercel Cron calls
`/api/supabase-keepalive` on the production deployment three times a day, at
00:00, 08:00 and 16:00 UTC (09:00, 17:00 and 01:00 in Japan). On the Hobby
plan each run may start anywhere within that hour. The jobs are in
[`vercel.json`](../vercel.json) and the route is
[`src/app/api/supabase-keepalive/route.web.ts`](../src/app/api/supabase-keepalive/route.web.ts).

Each call sends one read with the public key,
`GET /rest/v1/account_data?select=user_id&limit=1`. The anonymous role may not
read that table, so Postgres answers "permission denied" (`42501`). That answer
comes from the database itself, so every call is a request the database
handles; the route treats it, or a `200`, as success. The
route changes nothing, returns no data and needs no secret: it is the request
any visitor's browser can already send. It is a web-only route, left out of the
iOS static export.

To check by hand, open <https://cfop.app/api/supabase-keepalive>:

| Response | Meaning |
| -------- | ------- |
| `200 {"ok":true}` | The database answered. |
| `503 {"ok":false,"status":<HTTP status>,"reason":...}` | Supabase answered, but not from the database; the project may be paused or restoring. |
| `503 {"ok":false,"status":null,"reason":"TimeoutError"}` | No answer within 15 seconds. |
| `503 {"ok":false,"status":null,"reason":"not configured"}` | The deployment has no Supabase variables. |

The jobs and their logs are in the Vercel project: open **Schedules** in the
sidebar, then the **Cron Jobs** tab; each job has **View Logs**. Vercel does not
retry a failed run; the next one comes about 8 hours later. Removing the
`crons` entries from `vercel.json` and deploying stops the runs.

If the project is paused anyway (for example, the runs failed for a week):

1. Open the [Supabase dashboard for `cfop-trainer`](https://supabase.com/dashboard/project/lwlsbgcksljmonggtiex).
2. Select **Resume project** and confirm. Restoring takes a few minutes; data
   and settings come back as they were. A paused project can be restored for up
   to a year.
3. Open <https://cfop.app/api/supabase-keepalive> and wait for `{"ok":true}`,
   then sign in at <https://cfop.app/account> to confirm.

Paid Supabase plans are not paused for inactivity.

## Account deletion

`delete-account` runs as a Supabase Edge Function so both static iOS builds and
the website can use it. Deploy with the authenticated Supabase CLI:

```sh
npx supabase@latest functions deploy delete-account --project-ref lwlsbgcksljmonggtiex --use-api
```

`supabase/config.toml` configures only this function; do not push it as a full
remote Auth configuration. Gateway JWT verification is disabled because the
handler validates the bearer token using Auth's user endpoint, supporting
asymmetric keys and rejecting deleted users. It rechecks the current password,
never accepts a target user ID, and hard-deletes the authenticated user through
the server-only admin API. The database foreign key cascades account_data.
The service-role key is supplied by the Edge Function environment, never clients.
CORS allows the production web origin, local port 3000 and the native iOS origin.
Add explicit origins if the production domain changes.

Run `node scripts/verify-account-deletion.mts` for local authentication, isolation,
CORS and failure-path checks. Live verification uses disposable confirmed test
accounts without sending email; never run deletion checks against real users.

See [release preparation](release.md) for the remaining distribution steps.
