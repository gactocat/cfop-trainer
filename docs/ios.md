# iOS app

CFOP Trainer uses Capacitor 8 to bundle the existing Next.js UI as a native app.
The app loads its HTML, JavaScript, fonts and cube assets from the installed
bundle, without contacting Vercel. Supabase remains the shared account backend.
The bundle identifier is `com.gactocat.cfoptrainer`; no App Store registration
or paid developer enrollment is performed by these build commands.

## Requirements

- macOS with Xcode 26 or later and an installed iOS simulator runtime.
- Node.js 24 and `npm ci`.
- iOS 18 or later. This app intentionally targets newer WebKit APIs than
  Capacitor's own minimum supported version.
- The two public Supabase variables from `.env.example` in `.env.local`, if
  account access is needed. Guest-only builds work without these variables.
  Never include a service-role key in a mobile build.

## Build and run

```sh
npm ci
npm run ios:build
npm run ios:open
```

In Xcode, choose the App scheme and an iPhone simulator, then Run. Alternatively:

```sh
npm run ios:run
```

`ios:sync` runs a dedicated Next.js static export and copies it to the native
project. Always run it after changing web code or environment variables.
`ios:build` additionally builds the simulator application. Xcode's simulator
ad-hoc signing must remain enabled because unsigned simulator apps cannot
access the Keychain correctly. It does not require paid developer enrollment.

The normal `npm run build` and Vercel deployment keep the existing web behavior.
Both build modes use `.next`; run them sequentially. Native assets in `out/` and
`ios/App/App/public/` are generated and ignored by Git. Commit native project,
plugin and asset changes, including Swift Package resolution files.

## Native behavior

- Guest data is loaded from Preferences before the practice UI becomes writable.
  Native writes are serialized full snapshots; write failures surface in the UI.
- Signed-in settings, algorithms and times remain in memory and Supabase only.
  Offline accounts remain read-only. Native auth tokens use Keychain storage.
- Web and app guest records are separate. Import guest data on first login to
  move it to an account; use the same account on the other device.
- Export opens the iOS share sheet, including Save to Files. Temporary exports
  are removed after the share sheet closes. Import uses the system file picker.
- While a timer runs, automatic screen locking is disabled. Backgrounding the
  app stops the timer and leaves the result for manual recording or discarding.
- Safe-area insets protect the header, full-screen trainer and dialogs.
- Native builds do not register a service worker. The custom native router
  serves each exported Next.js route, including direct detail-page loads.

## Email links

Add the exact `cfoptrainer://auth/callback` redirect to Supabase Authentication
URL Configuration. This is already configured on `lwlsbgcksljmonggtiex`.
Keep the existing web and localhost redirects and the normal ConfirmationURL
email template. Native signup and password reset use PKCE; open the email link
on the same device/app installation that initiated the request. The code
verifier stays in the Keychain. Unrelated links and token-fragment callbacks
are not accepted by the native handler.

Custom SMTP is still required before inviting general users. See
[account setup](accounts.md). App packaging does not remove Supabase's default
email recipient restrictions.

## Device and App Store release

For your own iPhone, select your Apple team in Xcode's Signing & Capabilities,
connect the device, enable Developer Mode when prompted, and Run. Review the
bundle identifier before registering it for distribution.

Before TestFlight or App Store submission:

- Enroll in the Apple Developer Program and register the app in App Store Connect.
- Configure general-user email delivery and test confirmation/recovery on a
  physical device, including cold launches and expired links.
- Verify in-app account deletion against the deployed Supabase Edge Function.
  The app requires the current password and deletes only the authenticated user.
- Review the published privacy-policy and support pages and complete App Privacy disclosures
  for email identifiers and account content. The included privacy manifest
  declares required-reason API use; it does not replace those disclosures.
- Prepare store screenshots, description, age rating and review access.
- Verify file import/export, 3D rendering, timer interruptions, rotations and
  offline behavior on supported physical devices. TestFlight/device distribution
  and App Store review have not been performed by the local build workflow.
- Increment the marketing version and build number, Archive for a generic
  iOS device, then validate and distribute through Xcode Organizer.

Native updates require rebuilding and distributing a new app version. Updating
Vercel alone does not update the installed app. Supabase schema changes should
remain compatible with previously released versions.

References: [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow),
[iOS setup](https://capacitorjs.com/docs/ios),
[account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

See [release preparation](release.md) for public URLs, SMTP setup and remaining
external account steps.
