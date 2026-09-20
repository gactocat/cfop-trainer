# Release preparation

## Implemented

- Email/password sign-in, password recovery and native email-link handling.
- Permanent in-app account deletion, protected by a verified session and password.
- Public privacy policy: https://cfop-trainer-ten.vercel.app/privacy
- Public support page: https://cfop-trainer-ten.vercel.app/support
- Support contact: gactocat@gmail.com
- Guest offline storage and signed-in server storage.
- Light/dark switch in the gear menu. With no selection, it follows the device.
  Explicit choices are stored in the existing practice-settings document,
  preserving compatibility with existing account document keys. Older app
  versions may drop the appearance choice when saving practice settings.

## Email delivery: external setup required

General-user registration is not ready until custom SMTP is configured. The
Supabase built-in sender accepts only organization member recipients. Email
confirmation must stay enabled.

Suggested setup, checked September 20, 2026:

- Register `cfop-trainer.com` through the existing Vercel team. The registrar
  reports availability and USD 11.25 for one year, with USD 11.25 renewal.
  Availability and prices may change. No domain has been purchased.
- Use Resend's Free plan for initial transactional email delivery. Its current
  allowance is 3,000 emails per month, limited to 100 emails per day.
- Verify `auth.cfop-trainer.com` in Resend by adding its exact DKIM/SPF DNS
  records in Vercel. Keep any existing DNS records. Do not enable click/open
  tracking for authentication emails.
- Set the sender to `CFOP Trainer <noreply@auth.cfop-trainer.com>`.
- Connect Resend to Supabase through its integration or enter `smtp.resend.com`,
  port 465, user `resend`, and a sending API key in Supabase's SMTP settings.
  Never add these credentials to the repository or a `NEXT_PUBLIC_` variable.
- Keep the app at its existing Vercel URL; buying a sender domain does not
  require changing the website URL or auth redirects.
- Test signup/confirmation and password reset with a non-team recipient on
  web and a physical iPhone. Native links must return to the originating app
  installation. Also test expired links and cold launches.

The domain registration, Resend account connection and delivery verification
remain outstanding. A Gmail support address alone does not configure SMTP.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Resend setup](https://resend.com/docs/send-with-supabase-smtp),
[Resend pricing](https://resend.com/pricing).

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

No Apple enrollment, app registration, TestFlight distribution or App Store
submission has been performed by this implementation.
