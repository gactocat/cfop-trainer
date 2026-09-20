# Release preparation

## Implemented

- Email/password sign-in, password recovery and native email-link handling.
- Permanent in-app account deletion, protected by a verified session and password.
- Public privacy policy: https://cfop.app/privacy
- Public support page: https://cfop.app/support
- Support contact: gactocat@gmail.com
- Guest offline storage and signed-in server storage.
- Light/dark switch in the gear menu. With no selection, it follows the device.
  Explicit choices are stored in the existing practice-settings document,
  preserving compatibility with existing account document keys. Older app
  versions may drop the appearance choice when saving practice settings.

## Email delivery: configured and verified

Production configuration verified on September 20, 2026:

- `cfop.app` is registered through the Vercel team `gactocats-projects` and
  expires September 20, 2027. The current renewal price is USD 15 per year.
- Resend verified `auth.cfop.app` in the Tokyo region (`ap-northeast-1`).
  Its DKIM, SPF, return-path MX and CNAME records are configured in Vercel.
  `_dmarc.auth.cfop.app` has an initial `v=DMARC1; p=none;` policy.
- Open and click tracking are disabled for authentication emails.
- Supabase uses `smtp.resend.com`, port 465, user `resend`, and sender
  `CFOP Trainer <noreply@auth.cfop.app>`.
- The SMTP API key has sending-only permission scoped to `auth.cfop.app`.
  It is stored in Supabase, never in the repository or a `NEXT_PUBLIC_` variable.
- Email confirmation remains enabled. Supabase allows 30 authentication
  emails per hour; Resend's Free plan also limits delivery to 100 per day and
  3,000 per month.
- The primary web URL is now `https://cfop.app`. Authentication accepts its
  exact `/account` redirect and retains the old Vercel, localhost and iOS URLs.

Domain verification, SMTP authentication over TLS, and Supabase configuration
readback passed. The owner confirmed delivery and the web password-reset screen.
A separate Gmail alias received a native signup email through Resend. Native
links must return to the originating app installation. Physical-device email
link verification remains a release follow-up; simulator results are recorded
in [App Store release](app-store/README.md).

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Resend setup](https://resend.com/docs/send-with-supabase-smtp),
[Resend pricing](https://resend.com/pricing).

## Web domain

`https://cfop.app` is connected to the Vercel `cfop-trainer` production project.
Vercel verified the domain and HTTPS configuration. The existing mail records
under `auth.cfop.app` remain intact; no registrar transfer or extra service is
required. Supabase's Site URL is `https://cfop.app` and its redirect allow-list
includes `https://cfop.app/account`. The deployed deletion function explicitly
allows the new origin, alongside the old web and native origins.

The previous URL, `https://cfop-trainer-ten.vercel.app`, remains available without
an automatic redirect. Browser guest data and sessions are origin-specific:
users can sign in on the old URL and import device data, then sign in on the new
URL to access the same server records. Guest data is not automatically moved
between browser origins. An installed web app can be re-added from the new URL.

The new home, account, privacy and support routes are reachable over HTTPS.
Signup and recovery verification links return to the new `/account` URL; a
temporary fixture verified this without sending email and was deleted afterward.
Deletion preflights accept the new, old and native origins and reject lookalikes.

The iOS version already waiting for review keeps its existing support/privacy
URLs. Those pages continue to work. Update the store metadata URLs in the next
editable version rather than withdrawing the current review for this change.

## App Store Connect preparation

Use the public URLs above for Privacy Policy URL and Support URL. These pages
are linked from the app and remain accessible if authentication fails.

Review App Privacy declarations against the final production configuration:

| Data | Purpose | Linked to account | Tracking |
| ---- | ------- | ----------------- | -------- |
| Email address | App functionality and support | Yes | No |
| User ID | App functionality | Yes | No |
| User content: algorithms, settings and solve records | App functionality | Yes | No |
| Support content and provider diagnostic/security logs | Support and security | Depends on submitted content and provider logs | No |

Do not select "Data Not Collected": signed-in users send content to Supabase.
The native privacy manifest describes required-reason APIs, not all App Privacy
answers. Confirm the final categories and provider practices before submission.

Prepare an app description, screenshots from supported physical/simulated
screen sizes, age rating, and review notes. Explain guest mode, account deletion
under Gear > Account, and provide a dedicated review account if requested.
Never commit that account's password. Register the app under the intended Apple
Developer team, increment the build number, Archive, and distribute through
TestFlight before submitting to the App Store.

The paid Apple team is configured. Version 1.0 (build 4) was submitted on
September 20, 2026 and is waiting for App Review. Release is automatic after
approval. See [App Store release](app-store/README.md)
for registration, metadata, screenshots, validation and submission status.
