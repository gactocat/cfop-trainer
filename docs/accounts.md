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
- Custom SMTP is not configured. The built-in sender only supports Supabase
  team member addresses; configure SMTP before inviting other users.

Open the [connected resource](https://vercel.com/d/dashboard/integrations/supabase/icfg_HJnISW7o0qy1QLElwyaR1BvA/resources/store_cg9bz95kXUJgmTiL)
to access Supabase Studio. Authentication configuration is documented below.

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
| Site URL | `https://cfop-trainer-ten.vercel.app` |
| Redirect URL | `https://cfop-trainer-ten.vercel.app/account` |
| Redirect URL for local testing | `http://localhost:3000/account` |

Add each redirect URL as a separate entry. If you use a different local port or
preview deployment, add its exact `/account` URL too. Keep the default
confirmation/reset email links using `{{ .ConfirmationURL }}`. The app passes
`/account` as the destination and handles confirmation and password recovery in
the browser.

See [password authentication](https://supabase.com/docs/guides/auth/passwords)
and [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Set up email delivery

For an initial test with your own Supabase organization member email address,
you can use the built-in sender. It is restricted to project team addresses and
has a very low sending limit, so repeated confirmation/reset tests may be
rate-limited. Do not disable email confirmation to work around this.

Before opening registration to other people, configure custom SMTP in Supabase
Authentication. Enter the provider's host, port, username, password, sender email
and sender name. SMTP credentials belong in Supabase, not in the browser or
Vercel's public variables. See [Supabase's SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

One supported option is Resend. Follow its
[Supabase SMTP setup](https://resend.com/docs/send-with-supabase-smtp): verify a
sending domain you own, create an API key, and copy its SMTP settings into
Supabase. The sending domain is separate from the app's `vercel.app` address;
you cannot verify Vercel's shared domain as your own. Other SMTP providers can
also be used.

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
setting and reload; the Account page should report that the data is saved.

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

- Guests use the existing versioned `localStorage` keys and can work offline.
- Signed-in accounts use a database document containing the same serialized
  formats. Settings (including language), algorithms, times, selected cases,
  and saved selections are included. Account data is kept in memory only on
  the client; the auth SDK persists session credentials to maintain sign-in.
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
  copy. A lost response can be retried with the same write id. Unsaved edits
  stay in memory, show a warning, and trigger a browser leave-page warning.
- Use **Reload server data** on the Account page to pick up another device's
  changes. This version does not stream live updates between devices.
- Each document is limited to 8 MiB. A size-limit failure is shown as a failed
  save. Large histories may eventually need normalized, paginated tables.
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
  verify the retry/unsaved warning. Sign out and confirm guest data returns.
- Test guest offline writes and account offline read-only behavior, including
  the full-screen trainer. Confirm private data never appears in Cache Storage.

References: [password authentication](https://supabase.com/docs/guides/auth/passwords),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
