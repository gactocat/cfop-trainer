# App Store release

## Registration

- Store name: CFOP Trainer: Cube Practice
- Apple app ID: `6814041928`
- Bundle ID: `com.gactocat.cfoptrainer`
- SKU: `cfop-trainer-ios`
- Primary language: English (US); additional localization: Japanese
- Version: 1.0 (build 4), iOS 18+, iPhone and iPad
- Categories: Education, Utilities
- Price: free; all 175 available territories selected, including future territories
- Calculated age rating: 4+; not enrolled in the Kids category
- Release option: automatically after approval
- Owner reports completing the EU declaration as a non-trader

[App Store Connect](https://appstoreconnect.apple.com/apps/6814041928/distribution)

## Uploaded material

Version 1.0 (build 4) was uploaded on September 20, 2026 and processed as VALID.
It replaces build 3 on the initial App Store version. English and Japanese
names, subtitles, descriptions, keywords, promotional text, privacy and support
URLs are registered from `metadata/`. The review contact and dedicated confirmed
review account are registered with Apple; passwords must never be committed.

Each locale has five iPhone screenshots (1320 x 2868) and five iPad screenshots
(2064 x 2752): PLL, OLL, F2L, a timed practice result, and dark appearance.
All 20 screenshots passed Apple's asset processing and were visually checked.

Local generated artifacts, excluded from Git:

- `ios/App/output/1.0-2/CFOPTrainer.xcarchive`
- `ios/App/output/1.0-2/export/App.ipa`
- `ios/App/output/1.0-2/screenshots/{en-US,ja}/{iphone,ipad}/`
- `ios/App/output/1.0-2/private/review-account.json` (owner-readable credentials)

The signing team and English/Japanese bundle localizations are checked in.
Use the App Store Connect API key from a secure local location; never copy it
into the project, an environment variable exposed to the app, or Git.

## Validation

- `npm run check`: lint, TypeScript and production web build passed.
- `npm run ios:sync`: static export and native asset synchronization passed.
- Signed generic-device Release archive and App Store export passed.
- Release simulator build passed.
- Native UI screenshot tests passed on iPhone 17 Pro Max and iPad Pro 13-inch.
- Native signup sent a confirmation email through production Resend SMTP;
  the verification endpoint accepted it. A delayed callback expired while the
  iOS open-app prompt was unattended and correctly displayed an error.
- A new password-reset email cold-launched the originating app, completed PKCE
  recovery, changed the password, and deleted the temporary account in the UI.
  The backend confirmed deletion; the owner's account was unaffected.
- The dedicated review account successfully authenticated against production.
- The owner previously confirmed basic operation on their selected iOS device
  and successful delivery/opening of a web password-reset email.

The automated email-link tests used a simulator, not a physical iPhone.
Physical-device testing of email links, import/export, rotation, background
transitions and offline operation is still useful before wider distribution.

## Submission status

Version 1.0 (build 4) was submitted on September 20, 2026 at 12:11 JST
(03:11 UTC). Apple returned and readback confirmed `WAITING_FOR_REVIEW` for both
the submission and app version. The selected build is
`cb8156a1-3052-4b04-b154-25f624d14075`.

The published App Privacy answers passed submission validation. The review
submission is `0aadab72-7578-4303-9132-aa5a31f940eb`. Release remains
`AFTER_APPROVAL`, with free pricing and all 175 available territories selected.
The app is awaiting Apple's review; it is not approved or publicly released yet.

Build 3 replaces the small, unevenly spaced icon with a larger regular grid.
The 21 tiles retain their original colors and arrangement. At 1024px, each tile
is 160px square with 24px gaps and 64px outer margins. Native icons use the full
artwork; the separate Android maskable asset retains its circular safe zone.
Web icons, favicon and launch artwork use the same geometry. The service worker
cache version is incremented so existing web installations receive new assets.

Build 4 changes only the perimeter colors: top blue, right orange, bottom green,
left red, with the central nine tiles yellow. Geometry is unchanged. All web and
native icon variants are regenerated; the service worker cache is version 4.
Build 4 passed web checks, signed archive/export and Apple processing, and is
selected for the initial release.

Build 4 archive and exported IPA are under `ios/App/output/1.0-4/`.
The icon was visually checked on the iPhone simulator Home Screen. The web
checks, native Release build, signed archive, export and Apple processing passed.
The production web icon matches the updated asset.
Build 2 screenshots and the dedicated review account remain unchanged.
Monitor the existing submission for review results. Do not create duplicate
submissions or alter the dedicated review account while review is pending.

## App Privacy answers

Choose that data is collected. Guest practice records stay on-device, but
optional account use sends data to Supabase and service providers retain logs.

| Data type | Information | Purpose | Linked to identity | Tracking |
| --- | --- | --- | --- | --- |
| Email Address | Authentication and account emails | App Functionality | Yes | No |
| User ID | Supabase account identifier | App Functionality | Yes | No |
| Other User Content | Algorithms, settings, selected cases, solve records | App Functionality | Yes | No |
| Customer Support | Support correspondence | App Functionality | Yes | No |
| Other Diagnostic Data | Provider request/error logs | App Functionality | Yes | No |
| Other Data Types | Security data, including retained IP addresses | App Functionality | Yes | No |

These declarations include provider processing; no advertising or analytics SDK
is embedded. Account-linked authentication logs are not represented as anonymous.
Update the answers if provider settings or application data practices change.
Save each data type, then publish the complete privacy answers in App Store Connect.

References: [App Privacy](https://developer.apple.com/app-store/app-privacy-details/),
[Privacy editing](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy),
[Age ratings](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/).
