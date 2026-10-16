# Handoff

## 2026-10-15 Plan 1 complete
- Implemented: detection, Expo and native collectors, capabilities (pods + symbols), redaction, rules 1–4 and 18, score/coverage/labels, terminal + JSON, CLI, coverage map, acceptance on the reference app.
- Known limits: managed Expo projects without ios/ or native source get rule 1 skipped (Plan 2 adds autolinking); labels always carry "(code only)" until store rules exist (Plan 3); no agent prompt yet (Plan 4); the guidelines diff script `scripts/check-guidelines.ts` is deferred to Plan 4.
- Next: Plan 2 (SDK linking, potential rules 19–25, verify list sized by SDK facts).

## Rulings in force
- Rule 1 returns potential (not confirmed) when the only evidence is a symbol in a Clip, extension or widget path such as `targets/`.
- Rule 3 returns potential when no linked capability needs the empty key.
- ATS arbitrary loads fires whether or not exception domains exist.
- Prebuild drift is potential (P2, medium confidence) when `ios/` is gitignored, because EAS regenerates it; it is confirmed only when `ios/` is tracked.
- The permission rules cite 5.1.1(ii) (purpose strings) and 2.1; ATS cites 2.1 only. 5.1.1(i) is the privacy policy and is planned.
- The Expo CLI is invoked through `node` from the project's own `node_modules/expo/bin/cli`, never through `npx`, so a scan cannot install anything from the registry.
- Terminal separators are two spaces, never "·".
- Exit 2 = did not scan; exit 1 = below the `--ci` threshold or partial scan.
- The label always carries "(code only)" until store rules exist.

## Implemented rule ids
- `permissions.usage-string-present`
- `permissions.usage-string-empty`
- `permissions.usage-string-template`
- `network.ats-arbitrary-loads`
- `expo.prebuild-drift`

## `(planned)` ids the coverage map promises
`store.aasa-reachable`, `store.app-clip-experience`, `store.demo-account`, `store.screenshots-required`, `store.listing-limits`, `store.iap-submittable`, `store.urls-reachable`, `accounts.sign-in-with-apple`, `accounts.deletion-path`, `privacy.tracking-string`, `purchases.external-payment`, `ugc.report-and-block`, `design.web-view-only`.

## Re-running the acceptance scan
    npm run build && cd <path to the reference app> && node <repo>/dist/cli.js --no-store --verbose
Compare with `docs/acceptance.md` (score 95, `Ready (code only)`, 2 confirmed, 4 of 4). The scan must not write into the project.
