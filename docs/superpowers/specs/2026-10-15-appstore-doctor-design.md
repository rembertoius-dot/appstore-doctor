# AppStore Doctor: design (v2)

Date: 2026-10-15 (v2, after owner review). Status: revised, pending owner approval.
Positioning: **AppStore Doctor — ship your AI-built iOS app with confidence.**

## 0. What changed from v1 and why

The v1 draft optimised for breadth (about forty rules). The owner's review set a different bar: never tell a developer their app will be rejected unless the evidence supports it, and make the number mean something. Checking v1's assumptions against sources changed several things:

| v1 assumed | Checked | Consequence |
|---|---|---|
| The privacy label can be read through the App Store Connect API | The public API (spec 4.5.1) has no data-usage endpoint; `AppDataUsage` is an empty schema and no path serves it | Privacy-label checks are dropped. The label is a human item in the handoff. |
| `expo-dev-client` in dependencies is a P1 finding | Expo's documentation does not say the client is excluded from release builds, nor that it must be removed | Not a violation by itself. The confirmed evidence is narrower: a developer-tool usage string in the resolved plist (the Expo Dev Launcher local-network text). That is what the rule reports. |
| Sign in with Apple is required whenever a third-party login SDK is present | 4.8 lists exceptions (own account system used exclusively, education and enterprise, government ID, a client for one specific service) | Potential finding with the exceptions listed, not confirmed. |
| Review details are safe to put in a report | `appStoreReviewDetails` returns `demoAccountPassword` in clear | Redaction is a core module, tested, applied before any reporter sees a fact. |
| "No deletion action found" can score | Absence of a recognisable function name proves nothing | Potential finding only. |
| Payments SDK present means IAP applies | 3.1.3(e) requires non-IAP for physical goods and services; (d) person-to-person | Potential finding that names the exceptions. |
| Hidden routes, placeholder text, "beta" wording are machine rules | All three are high-false-positive heuristics | Moved to the agent checklist, or to Potential with a low confidence tag, never scored. |
| Vendor the full guideline text in the npm package | The text is Apple's; the owner's skill vendors it on GitHub with a NOTICE, which is a narrower distribution than npm | Ship a clause index (number, title, anchor URL, review date) with excerpts of at most 25 words. Full text comes from a local copy the user points at, if they have one. |

The architecture (detect → collect facts → rules → findings → score → reporters) stands. What changed is the classification of findings, the scope, the score, the handoff, and the privacy module.

## 1. Purpose

A command run in an iOS app's folder that answers "what will App Review trip over?" the way React Doctor answers "is this React code healthy?": a readiness score, a short list of confirmed and potential issues pointing at files and lines, and a prompt for the developer's coding agent.

Who it is for: developers who built an iOS app with an AI coding agent (Claude Code, Cursor, Codex, others) and may not know Xcode, entitlements, privacy manifests or App Store Connect. Expo and React Native first; bare Xcode projects covered for everything readable from the plist, entitlements and project file.

Free, MIT, no account, no telemetry, no model call, no cloud. Published as `appstore-doctor` on npm when the owner says "publish", not before.

The loop it serves:

1. Build the app with an agent.
2. `npx appstore-doctor`.
3. Read the confirmed issues and the potential risks.
4. Hand the report to the agent.
5. The agent verifies each item, fixes what is real, and re-runs the doctor.
6. Repeat until the report is clean, then submit.

Success for v1: on the reference app (a manual pre-submission audit of the author's app) it reproduces every finding from that audit that is classified "deterministic" in `docs/acceptance.md`, reports no false positive on that project, finishes in under thirty seconds without a store key and under a minute with one.

## 2. Principles

1. **No false alarms.** A finding reduces the score only when evidence establishes it. Everything else is labelled as what it is: potential, or for a human or agent to verify.
2. **Deterministic.** No model in the scoring path. Same tree and same store record, same number.
3. **Built from the guidelines outward.** A clause-by-clause coverage map decides what is machine-checkable. A clause is claimed only when the tool can meaningfully evaluate it.
4. **Honest about coverage.** The report always says how many applicable checks ran, how many were skipped and why, and what remains for a person. A low-coverage scan is never called "Ready".
5. **Read only and local.** GET only against Apple. Nothing else leaves the machine. No files written to the project unless asked. Secrets never appear in output.
6. **Agent-first output.** Every finding carries the clause, the evidence, an explanation, a suggested fix and how to verify it. The prompt tells the agent to verify before changing anything.
7. **Plain.** Terminal text, one accent, no decoration.

## 3. Finding classification

Every rule result is one of:

| Kind | Meaning | Scores? | Shown |
|---|---|---|---|
| **Confirmed** | A requirement is missing or violated and the facts establish it. Example: the resolved plist has no `NSCameraUsageDescription` and the resolved binary links a camera module. | Yes | First, by severity |
| **Potential** | Evidence suggests a problem but a legitimate exception or a detection gap exists. Example: Google Sign-In SDK present, no Sign in with Apple entitlement; 4.8 exceptions may apply. Carries a confidence (`high`, `medium`, `low`) and the severity it would have if confirmed. | No | Second, prominently, with the exceptions named |
| **Verify** | Static analysis cannot decide. Example: 1.2 filtering method, 2.3.1 metadata accuracy, 4.2 minimum functionality. Sized by facts (no UGC facts, no 1.2 items). | No | "Needs a reviewer" list; in the handoff with clause text |
| **Pass** | Evaluated, no issue | Counts toward coverage | `--verbose` |
| **Skipped** | A needed fact was unavailable (no key, Expo CLI failed, no `ios/` folder) | Counts against coverage | Grouped with reasons |
| **Not applicable** | The clause does not apply to this app (no IAP, no UGC, not kids) | Excluded from coverage | `--verbose` |

Each rule declares, in its file and in the coverage map, three things in plain words: **what evidence confirms a failure**, **what evidence confirms a pass**, **what remains to verify**. A rule that cannot state the first precisely is not a confirmed-capable rule; it emits Potential or Verify only.

### 3.1 Severity (confirmed findings only)

| Severity | Meaning | Weight |
|---|---|---|
| P0 | App Review cannot complete, or Apple rejects this every time it is seen | 25 |
| P1 | Rejected or returned with a question most of the time | 10 |
| P2 | Delays review or draws a question; fix before submitting | 4 |
| P3 | Housekeeping Apple tolerates but a careful submitter fixes | 1 |

Potential findings carry a *would-be* severity for ordering and for the agent's prioritisation; it is displayed as `P1?`.

## 4. Score and coverage

- **Score** `= max(0, 100 − Σ weights of confirmed findings)`. Any confirmed P0 caps it at 59.
- **Coverage** `= evaluated ÷ applicable`, where evaluated = confirmed + pass, applicable = evaluated + skipped. Not-applicable rules are outside both. Displayed next to the score as `31 of 38 applicable checks ran`.
- **Label**, from score and coverage together:

| Condition | Label |
|---|---|
| Coverage < 80 % | **Partial scan** (score shown, never "Ready") |
| Any confirmed P0, or score < 75 | **Not ready** |
| 75–89 | **Needs work** |
| ≥ 90 and coverage ≥ 80 %, potential P0/P1 present | **Ready, verify N potential issues** |
| ≥ 90 and coverage ≥ 80 %, none | **Ready** |

- Store checks count as applicable whenever the project looks like it is headed for the App Store (always, in v1). Without a key they are skipped, coverage drops, and the scan is usually **Partial**. `--no-store` removes them from the denominator and the label gains the suffix `(code only)`. This is the behaviour the owner asked for: a 15-check scan must not look readier than a 40-check scan.
- A score of 100 means: every applicable machine check that could run passed. The report prints that sentence under the bar. It never says or implies approval.

## 5. Architecture

```
cli → detect → collectors → facts → redact → rules → results → score/coverage → reporters
                                                                 ↘ terminal · json · prompt
```

### 5.1 Detection

- **Expo**: `app.json` / `app.config.*` with an `expo` key and `expo` in dependencies. Resolve the final iOS config by running the project's own CLI: `npx expo config --json --type introspect`. Requires `node_modules` to be installed (reported clearly if not). This evaluates the project's config plugins, which is the project's own code; the README says so.
- **Native / bare**: `*.xcodeproj` at the root or under `ios/`. Read the target's `Info.plist`, `*.entitlements`, `PrivacyInfo.xcprivacy`, and the project file for `PRODUCT_BUNDLE_IDENTIFIER`, `TARGETED_DEVICE_FAMILY`, and build-setting variables used by the plist. `Podfile.lock` when present is the ground truth for linked native SDKs.
- Both present: Expo's resolved config is primary; a disagreement with `ios/` is a Potential finding ("prebuild may be out of date"), medium confidence.
- Neither: exit 2 with what was looked for.

### 5.2 Facts and provenance

Collectors produce one `Facts` object; they never judge. Each fact carries where it came from (`file:line`, API path) and each fact group carries an availability: `ok`, or `unavailable(reason)`.

**Bundle** (resolved plist, entitlements, project): identifiers, versions, deployment target, device families, every `NS*UsageDescription`, ATS, background modes, URL types, queried schemes, entitlements, privacy manifest contents, App Clip target.

**Linked SDKs** (strongest source first): `Podfile.lock` pods → Expo autolinking result (`npx expo-modules-autolinking resolve -p ios --json` when available) → `package.json` dependencies with the lockfile. Each SDK fact records which source established it, so rules can demand "linked" (pods or autolinking) rather than "declared" (package.json) before confirming anything.

**Source** (bounded by `.gitignore`, skipping `node_modules`, `ios/Pods`, build output, binaries): presence-level signals only, each with the matching file and line: camera, location, microphone, contacts, photo library, Bluetooth, health, tracking APIs; sign-in providers; account creation; deletion indicators; purchase calls and product ids; external payment links; UGC indicators (upload, post, comment, chat); report, flag, block indicators; web view as main surface. Source facts drive *applicability* and *Potential* findings. They never confirm a violation on their own, except where paired with a bundle fact (camera API in source and no camera string in the resolved plist).

**Store** (only with a key; GET only): the app by bundle id; the latest editable or in-review version; version localizations; app info localizations (name, subtitle, privacy policy URL); age rating declaration; screenshot sets and each screenshot's width and height (never bytes); preview sets; review detail (contact, demo account *flags*, notes) with the password discarded at the client boundary; review attachments; IAP v2 list with state and review screenshot presence; App Clip default experience and header image; encryption declaration state; build processing state. Reachability of support, marketing and privacy URLs: one GET each, status only, skippable with `--offline`.

**Not collectable, stated as such**: the privacy label; anything about runtime behaviour; screenshot content; the reviewer's experience.

### 5.3 Redaction (before any rule or reporter)

A single module every reporter and the prompt builder must pass through, with tests:

- Store: `demoAccountPassword` never stored, logged or emitted; `demoAccountName` emitted as present/absent only. Review notes are summarised as length and presence of the words "demo", "account", "password", never quoted.
- Source evidence excerpts: at most one line, trimmed to 160 characters, and dropped entirely if the line matches a secret pattern (`-----BEGIN`, `sk_live`, `sk_test`, `AKIA`, JWT shape, `token=`, `secret`, `password`, hex or base64 runs over 32 characters). Files named `.env*`, `*.p8`, `*.pem`, `*.keystore`, `*credentials*` are never excerpted or named beyond their basename.
- Keys: the ASC private key is read, used to sign one JWT, and dropped. Its path appears in output only as "configured".
- JSON and prompt output inherit the same redactions; there is no raw mode.

### 5.4 Rules

A rule is a pure function `(facts) → Result` and a declaration:

```
id            permissions.usage-string-present
clauses       ['5.1.1(ii)', '2.1']
kind          confirmed-capable | potential-only | verify-only
severity      P0 (for confirmed) / would-be severity (for potential)
appliesWhen   predicate on facts
needs         fact groups; any `unavailable` → Skipped(reason)
confirmsFail  one sentence
confirmsPass  one sentence
verify        one sentence (what a person or agent still checks)
fix           suggested change, written for an agent
check         how to verify the fix (a command, a file to open, a screen to reach)
```

Rules are small files grouped by area, registered in one index, and cross-checked against `docs/coverage.md` by a test.

### 5.5 Reporters

**Terminal** (default). Confirmed first, then potential, then the verify list, then coverage, then the handoff. Example at section 8.

**JSON** (`--json`): `{ tool: {version, guidelinesReviewed}, app, project, score, coverage: {evaluated, applicable, skipped: [{rule, reason}]}, label, confirmed: [], potential: [], verify: [], notApplicable: [] }`. Each finding: `{ rule, clauses, severity, confidence?, title, explanation, evidence: [{file, line, excerpt?} | {api, value?}], fix, check, guideline: {title, url, excerpt} }`. Stable and documented.

**Prompt** (`--prompt`, and the interactive menu): see section 7.

No file is written to the project by a scan. `--out <path>` writes the JSON or the prompt where asked.

**CLI**: `appstore-doctor [path] [--json] [--prompt] [--out file] [--ci [min]] [--verbose] [--no-store] [--offline] [--locale xx-XX] [--guidelines <dir>]`. `--ci` exits 1 below the threshold (default 90) or on Partial scan.

### 5.6 Errors

No project → exit 2 with the search list. Expo CLI failing → fall back to `app.json` fields, mark bundle facts partial, say so. 401/403 from Apple → one line naming key, issuer or role, store rules skipped. Rate limit or 5xx → two retries with backoff, then skip. A throwing rule → Skipped("rule error"), never a crash; `--verbose` shows the stack.

## 6. v1 scope: the checks

Fewer, precise, each with its evidence contract. Confirmed-capable rules are the ones that move the score.

### 6.1 Confirmed-capable (score)

| # | Rule | Clause | Sev | Confirms fail | Confirms pass | Still verify |
|---|---|---|---|---|---|---|
| 1 | Usage string missing for a linked capability | 5.1.1(ii), 2.1 | P0 | A capability is *linked* (pod, autolinking module, or an iOS API symbol in native source) and the resolved plist lacks its `NS*UsageDescription` | String present and non-empty | That the string explains the purpose in a sentence (agent) |
| 2 | Usage string is a template or names a developer tool | 5.1.1(ii), 2.1 | P3 | Value matches known template text (`$(PRODUCT_NAME) needs…` unresolved, "Allow $(PRODUCT_NAME) to access…" with placeholders, "Expo Dev Launcher", "Debug", "Flipper") | None match | Wording quality (agent) |
| 3 | Empty usage string | 5.1.1(ii), 2.1 | P1 | Key present, value empty or whitespace | Non-empty | — |
| 4 | ATS allows arbitrary loads | 2.1 | P2 | `NSAllowsArbitraryLoads: true` in the resolved plist (exception domains do not narrow it; the reference app's real plist has both) | The key is absent or false | Whether a justification exists for the reviewer (agent) |
| 5 | Associated domains entitlement with an unreachable AASA | 2.1 | P1 | Entitlement lists `applinks:`/`appclips:` domains and `https://<domain>/.well-known/apple-app-site-association` does not return 200 JSON within 5 s (skipped with `--offline`) | 200 with JSON naming the app's identifier | Content of the AASA matches the paths used |
| 6 | App Clip target present but no App Clip experience in App Store Connect | 2.1, App Clip guidance | P1 | Bundle has a Clip target and the store has no default experience for the version | Experience exists with a header image | Clip behaviour on device |
| 7 | Privacy manifest missing while a listed SDK is linked | 5.1.1, privacy manifest requirement | P1 | A pod or module from Apple's published SDK list is linked and no `PrivacyInfo.xcprivacy` exists for the app target | Manifest present | Required-reason API declarations are complete (agent, since reason codes need intent) |
| 8 | Encryption declaration missing | Before You Submit | P2 | Store build has no `usesNonExemptEncryption` value and no `ITSAppUsesNonExemptEncryption` in the plist | Either present | Correctness of the answer (human) |
| 9 | Required screenshot set missing | 2.3.3, screenshot specs | P0 | Store version has no screenshots for the iPhone set Apple requires; iPad set missing while `TARGETED_DEVICE_FAMILY`/`supportsTablet` includes iPad | Sets present with 1–10 images at accepted sizes | Content (not login, splash or title art) (agent/human) |
| 10 | Screenshot at an unaccepted size | screenshot specs | P1 | An image's width×height is not in the accepted list for its display type | All accepted | — |
| 11 | Listing field missing or over its limit | 2.3.7, 2.3.8 | P1 | Name > 30, subtitle > 30, keywords > 100, description empty, support URL missing, privacy policy URL missing | Within limits | Accuracy (agent) |
| 12 | Privacy policy / support URL unreachable | 5.1.1(i), 1.5 | P1 | GET returns a non-2xx/3xx or times out (skip with `--offline`) | 2xx/3xx | Content of the policy (human) |
| 13 | Sign-in exists but no demo account in review details | 2.1, Before You Submit | P0 | Source or SDK facts show sign-in and `demoAccountRequired` is false or name/password flags are absent | `demoAccountRequired` true with both fields present, or a notes sentence containing "demo"/"account" and "password" (presence only) | That the credentials work (human) |
| 14 | Review contact incomplete | Before You Submit | P1 | Any of first name, last name, phone, email empty | All present | — |
| 15 | IAP products not in a submittable state while purchase SDK is linked | 3.1.1, 2.1(b) | P0 | Purchase SDK linked, store IAP list empty, or every product in `MISSING_METADATA`/`DEVELOPER_ACTION_NEEDED`, or a product on the version lacks a review screenshot | At least one product `READY_TO_SUBMIT`/`WAITING_FOR_REVIEW`/`APPROVED` with a screenshot | Pricing and that the purchase works (human) |
| 16 | Age rating not completed, or UGC answered "no" while UGC facts are strong | Before You Submit, 1.2 | P1 | Declaration incomplete; or `userGeneratedContent: false` with linked upload + post indicators (high confidence only) | Declaration complete and consistent | — |
| 17 | Content rights and other required declarations unset | Before You Submit | P2 | Store reports the declaration missing | Set | — |
| 18 | Expo prebuild drift | 2.1 | P2 | `ios/` plist disagrees with resolved config on bundle id, usage strings or entitlements | Agree, or no `ios/` | Which one ships (agent) |

### 6.2 Potential-only (shown, not scored)

| # | Rule | Clause | Would-be | Evidence shown | Exceptions and gaps named |
|---|---|---|---|---|---|
| 19 | Third-party login without Sign in with Apple | 4.8 | P0? | Login SDK linked, no `com.apple.developer.applesignin` entitlement | Own-account-only, education/enterprise, government ID, single-service client |
| 20 | Accounts without a visible deletion path | 5.1.1(v) | P0? | Account creation indicators, no deletion indicator in source | Deletion may live under another name or on the web (Apple still requires in-app initiation); confidence medium |
| 21 | Tracking SDK linked, no `NSUserTrackingUsageDescription` | 5.1.2, ATT | P1? | SDK from the vendored list is linked and the key is absent | SDK may be configured not to track; confidence medium |
| 22 | External payment without IAP | 3.1.1, 3.1.3 | P0? | Payment SDK or checkout link present, no IAP SDK | Physical goods and services (e), person-to-person (d), reader (a), enterprise (c), US storefront rules |
| 23 | UGC without report or block indicators | 1.2 | P1? | Upload/post indicators, neither "report" nor "block"/"hide user" indicators | Indicators are name-based; confidence depends on count |
| 24 | Web view as the main surface | 4.2 | P1? | A single web view route loads a remote URL and little else exists | Many legitimate hybrids; confidence low |
| 25 | Declared-but-not-linked SDK | — | info | In `package.json` only, not in pods/autolinking | Shown so the agent knows what the binary actually contains |

### 6.3 Verify list (sized by facts, never scored)

1.2 filtering method and response commitment (when UGC); 2.1 the reviewer can reach every feature with what the notes give; 2.3.1 metadata accuracy and no hidden features; 2.3.3 screenshots show the app in use; 4.0 and 4.2 design and minimum functionality; 5.1.1(ii) permission purpose strings are truthful; 5.1.1(v) login not required where not needed; 5.1.2 data use matches the privacy label (the label itself is not readable by the tool); 5.2 rights to all content; privacy manifest reason codes; App Clip experience on device; demo credentials actually work; iPad compatibility mode pass when iPhone-only.

### 6.4 Out of v1

Everything in section 9 of v1 plus: placeholder text and "beta" wording detection, hidden route detection, hard-coded price detection, platform-name detection in copy. All of these move to the verify list as prompts for the agent.

## 7. Vendor-neutral agent workflow

- `appstore-doctor --prompt` prints a Markdown document to stdout. `--out report.md` writes it. The interactive menu offers: **Copy prompt**, **Print prompt**, and one entry per agent CLI found on `PATH` (`claude`, `codex`, `cursor`, `gemini`, `aider`), each of which runs that CLI with the prompt as its initial message. No agent is required; none is privileged.
- The prompt structure:
  1. One paragraph: what AppStore Doctor is, the score and coverage, the date of the guidelines index.
  2. **Rules of engagement** for the agent: verify every item in the code before changing anything; a potential finding is a question, not a fact; prefer the smallest change; never add a permission string for a capability the app does not use; do not touch App Store Connect; when done, run `npx appstore-doctor --json` again and compare.
  3. Confirmed findings, each with clause, title, evidence, explanation, fix, check.
  4. Potential findings, each with the exceptions to consider and how to decide.
  5. Verify items with the clause excerpt and a link to the clause.
  6. If the `app-store-guidelines` or `apple-appstore-reviewer` skills (or equivalent files) are present in the project or user skills folder, use them for exact text; otherwise read the linked clause.
- A short `AGENTS.md` snippet is offered in the README for projects that want the doctor to be part of their agent's definition of done.

## 8. Report example

```
AppStore Doctor 0.1.0   Example App · com.example.app · Expo SDK 57 · guidelines reviewed 2026-10-15

Confirmed
P3  5.1.1(ii) Usage string names a developer tool
    Info.plist (resolved)  NSLocalNetworkUsageDescription: "Expo Dev Launcher uses the local network…"
    fix: set expo-dev-client's plist override or remove the key for release; check: npx expo config --type introspect

Potential
P0? 4.8       Third-party login without Sign in with Apple  (confidence: high)
    package.json:38 @react-native-google-signin/google-signin · entitlements: no applesignin
    exceptions: own account system only · education/enterprise · government ID · single-service client

Needs a reviewer (6)   1.2 filtering · 2.3.1 accuracy · 4.2 functionality · 5.2 rights · demo account works · iPad mode

99/100  Ready, verify 1 potential issue   ███████████████░
31 of 38 applicable checks ran · 7 skipped: no App Store Connect key (ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH)
A score of 100 means every applicable check that could run passed. It is not an approval.

Hand this to your coding agent?
❯ Copy prompt
  Print prompt
  Claude Code
  Codex
```

(With no key the label above would read **Partial scan** because coverage falls under 80 %; the example assumes `--no-store`.)

## 9. Guidelines as a maintained rule system

- `src/guidelines/index.json`: every clause number, title, anchor URL on Apple's page, and an excerpt of at most 25 words, with `reviewedOn` (date the index was checked against the live page). Produced by a script from a local full copy; the full copy is not shipped.
- `--guidelines <dir>` points at a local full copy (for example the owner's `app-store-guidelines` skill) to quote full clause text in the prompt. The README explains the licence reason.
- Each rule records the clause numbers and the `reviewedOn` date it was last validated against. A `scripts/check-guidelines.ts` diff tool compares the index with a fresh capture and lists clauses whose text changed, so rules can be re-validated. Rules are independent files and can be updated without a core release.
- Not every clause becomes a rule. The coverage map's `n/a` and `verify` bins exist so the tool never claims what it cannot evaluate.

## 10. Privacy and security

- Read only: the HTTP client used by the store collector exposes GET only; a test enforces it.
- Network calls, all documented in the README: `api.appstoreconnect.apple.com` (only with a key), the AASA URL for each associated domain, the support, marketing and privacy URLs (status only). `--offline` removes all of them. No update checks, no telemetry, no crash reporting.
- Keys: environment variables or `.appstoreconnect.json` with `keyId`, `issuerId`, `keyPath`. A tracked key file in the repo is itself a P1 finding. Keys are read, used once, dropped.
- Redaction module (section 5.3) covers JSON, terminal and prompt.
- Scans do not write to the project. `--out` writes only where told.
- Source stays local. The only way code leaves the machine is the user pasting the prompt into their agent, and the prompt contains excerpts, not files.

## 11. Acceptance: the reference app

The reference app is the author's production Expo app (SDK 57, private). Its manual pre-submission audit had 24 findings, sorted into four bins. The per-finding mapping is kept privately, outside this repository.

| Bin | Findings |
|---|---|
| Deterministic (checked from the project) | 1 |
| Agent (judgment, listed under "Needs a reviewer") | 9 |
| Planned store rule | 7 |
| Out of scope (runtime, server or build behaviour) | 7 |

Plus items the audit found elsewhere that are deterministic: review detail completeness (rule 14), IAP states and screenshots (rule 15), age rating UGC flag (rule 16), App Clip experience and header (rule 6), AASA reachability (rule 5).

Tracked per run in `docs/acceptance.md`: false positives (must be 0 on the reference app), false negatives against the deterministic rows, wall time, coverage. Feedback from other developers is opt-in and manual (an issue template asking whether a finding matched a real App Review outcome). No telemetry.

## 12. Implementation sequence

| Phase | Deliverable | Rough size |
|---|---|---|
| 0 | Repo scaffold (TypeScript, ESM, Node ≥ 20, vitest, CI), `docs/coverage.md` for sections 1–5 and Before You Submit, `src/guidelines/index.json` generated from the owner's local copy with `reviewedOn` | 1 day |
| 1 | Detection; Expo and native collectors with recorded fixtures; `Facts`; redaction module; rules 1–4 and 18; score and coverage; terminal and JSON reporters | 2–3 days |
| 2 | SDK linking collector (pods, autolinking, lockfile) and the vendored SDK lists (Apple's privacy-manifest SDK list, tracking SDKs) with dates; rules 7 and 19–25; the verify list sized by facts | 2 days |
| 3 | Store collector (GET-only client, JWT, pagination, retries) with recorded sanitised fixtures; rules 5, 6, 8–17; `--offline`, `--no-store`, `--locale` | 2–3 days |
| 4 | Prompt builder and vendor-neutral handoff menu; `--prompt`, `--out`, `--ci` | 1 day |
| 5 | Acceptance run on the reference app, `docs/acceptance.md`, README with a real run, `AGENTS.md` snippet | 1 day |
| 6 | Dry run `npm pack`, review contents for anything sensitive, then publish **only on the owner's word** | — |

Each phase ends with `npm test` green and a short note in `docs/HANDOFF.md`.

## 13. Biggest remaining risks and open questions

1. **Expo introspection across SDK versions.** `expo config --type introspect` behaviour and output shape differ between SDK 49 and 54. Mitigation: fixtures per SDK major, fall back to `app.json` with a Partial scan. Question: minimum supported SDK (proposal: 50).
2. **Screenshot display types versus Apple's current required sizes.** The API's `APP_IPHONE_61`/`APP_IPHONE_67` naming predates the "medium/large display" language in Apple's current specs. The mapping needs confirming against a live record (the reference app uses `APP_IPHONE_61` at 1206×2622, which Apple accepted). Keep the mapping in a dated table.
3. **Which store version to inspect.** Apps with several versions (one live, one editable, one in review). Proposal: the editable one if any, else the one in review, with `--version` to override.
4. **Privacy-manifest SDK list and required-reason APIs.** Apple's list changes; shipping it means dating it and re-checking. Rule 7 confirms only "manifest absent while a listed SDK is linked"; reason-code completeness stays with the agent.
5. **Linked versus declared SDKs in managed Expo projects without `ios/`.** Autolinking resolution is the best proxy; if the autolinking CLI is absent, SDK-based rules degrade to Potential. This is the single biggest source of would-be false positives and the design accepts weaker claims rather than wrong ones.
6. **Guideline text licensing.** The index with short excerpts is the conservative choice; a final call on whether even excerpts need a NOTICE is the owner's. The owner's skill's NOTICE wording is reused.
7. **False-positive measurement beyond one project.** The reference app gives zero-false-positive proof on one app. Before 1.0 the tool should run on at least five public Expo apps and the results recorded in `docs/acceptance.md`.
8. **Deletion and UGC heuristics.** Name-based detection will miss and mis-hit. They stay Potential with a confidence tag until there is evidence they are reliable, and the confidence formula (how many independent indicators) is written down in the rule file.
9. **Agent CLIs' command lines.** `claude`, `codex`, `cursor` accept an initial prompt differently and change over time. Copy and print are the stable paths; CLI launches are best-effort and documented as such.
10. **Store checks for apps not yet created in App Store Connect.** The bundle id resolves to no app: store rules skip with "no app record yet" and the report says what to create. Not an error.

## 14. Decisions recorded

- Free, MIT, no account, no telemetry, no model in the scoring path, no cloud (owner, 2026-10-15).
- Three result classes: Confirmed scores; Potential and Verify never do.
- Coverage shown with the score; under 80 % the scan is Partial and never Ready.
- v1 ships 18 confirmed-capable rules and 7 potential-only rules, each with an evidence contract, before any expansion.
- Guideline text: index with short excerpts and dates in the package; full text only from a local copy the user points at.
- Redaction is a core module; the review password never leaves the HTTP client.
- Vendor-neutral handoff; Claude Code is one menu entry among others.
- Privacy label is out: not readable through the public API.
- Not published until the owner says "publish".
