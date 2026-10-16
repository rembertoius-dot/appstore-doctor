# AppStore Doctor

Ship your AI-built iOS app with confidence. Run one command in your project before you submit to App Review:

    npx appstore-doctor

That works once the package is published. Until then, build from a clone (`npm install && npm run build`) and run `node dist/cli.js` from your project folder, or `node dist/cli.js <path>`.

It checks what can be established from the project itself and tells you three things apart: **confirmed** issues (they lower the score), **potential** issues (evidence with the exceptions named; never scored), and what **needs a reviewer** (judgment calls for you or your coding agent).

Real run on the bundled synthetic fixture (`node dist/cli.js fixtures/bare-xcode --no-store`; the fixture is made up and is not a real app):

```
AppStore Doctor 0.1.0   Bare Fixture  com.example.barefixture  Xcode project  guidelines reviewed 2026-10-15

Confirmed
P0  5.1.1(ii) Location is used but no location usage description is set
    ios/App/Location.swift:3  CLLocationManager
    fix: Add NSLocationWhenInUseUsageDescription to the Info.plist (in Expo: ios.infoPlist in app.json, or the module's config plugin option) with one sentence that says what the app does with it. Only add it if the app really uses location; otherwise remove the dependency.
    check: Re-run appstore-doctor; then on a device, trigger the permission prompt and confirm the sentence appears.
P2  2.1       App Transport Security allows arbitrary loads
    ios/App/Info.plist  NSAppTransportSecurity.NSAllowsArbitraryLoads: true
    fix: Remove NSAllowsArbitraryLoads (or set it to false) and, if a specific insecure host is needed, add only that host under NSExceptionDomains. In Expo, set ios.infoPlist.NSAppTransportSecurity in app.json. If only local networking or web content needs the exemption, use NSAllowsLocalNetworking or NSAllowsArbitraryLoadsInWebContent instead.
    check: Re-run appstore-doctor; confirm the app still loads its content over HTTPS.
P3  5.1.1(ii) Usage string names a developer tool
    ios/App/Info.plist  NSLocalNetworkUsageDescription: "Expo Dev Launcher uses the local network to find your dev server."
    fix: Replace the value of NSLocalNetworkUsageDescription with one sentence about what the app does for the user. If only a development package needs the key, set that package's plist option to a real sentence or exclude it from release builds.
    check: Re-run appstore-doctor; for Expo, npx expo config --type introspect shows the resolved value.

Potential
P1? 5.1.1(ii) NSMicrophoneUsageDescription is empty  (confidence: medium)
    ios/App/Info.plist  NSMicrophoneUsageDescription: ""
    exceptions: No linked capability needs this key; iOS only shows the purpose string if this access is requested
    fix: Set NSMicrophoneUsageDescription to one sentence that says what the app does with this access.
    check: Re-run appstore-doctor.

Needs a reviewer (7)
  2.1 A reviewer can reach every feature with what the review notes give
  2.3.1 Metadata describes the app accurately and nothing is hidden or dormant
  2.3.3 Screenshots show the app in use, not a login, splash or title screen
  4.2 The app offers more than a repackaged website or a thin wrapper
  5.1.1(ii) Each permission string tells the truth about what the data is used for
  5.2 The app has the rights to every photo, video, font and sound it ships
  Before You Submit The demo account in the review notes signs in and reaches every paid feature

59/100  Not ready (code only)   █████████░░░░░░░
4 of 4 applicable checks ran
A score of 100 means every applicable check that could run passed. It is not an approval.
```

The tool was also validated against a real production Expo app (SDK 57, private) with zero false positives.

## What the number means
Only confirmed issues reduce the score (P0 25, P1 10, P2 4, P3 1; a P0 caps it at 59). Coverage is shown next to it. Under 80 % coverage the scan is **Partial** and is never called Ready. A 100 means every applicable check that could run passed. It is not an approval.

## What it checks today
See [docs/coverage.md](docs/coverage.md) for every guideline clause and what the tool does with it. Rows marked `planned` in that map are not checked yet. Version 0.1 implements the permission-string, ATS and Expo-drift checks. App Store Connect checks (listing, screenshots, review details, in-app purchases) and SDK-based checks are next.

A managed Expo app with no Swift or Objective-C in the tree gets the usage-string check skipped in this version, so its scan is reported as Partial and `--ci` exits 1. That is by design: the tool does not guess from package.json. The next release resolves linked native modules.

## Privacy
Read only. This version makes no network calls of its own; resolving an Expo project runs your own `app.config.*` and config plugins through the Expo CLI already installed in your project, the same way `expo prebuild` does. Nothing is written to your project, and nothing else executes. Evidence excerpts are redacted for secrets and never taken from env or key files. No telemetry, ever.

## For coding agents
`npx appstore-doctor --json` gives a stable document with clause, evidence, fix and check per finding. A ready-made agent prompt is planned.

## Licence
MIT. Guideline titles and short excerpts are Apple's, quoted for reference, with the date they were reviewed.
