# Acceptance: the reference app

Run on 2026-10-16 against the author's production Expo app (SDK 57, private) with `--no-store`. The manual pre-submission audit it is compared with is private, and the full per-finding mapping is kept outside this repository. The audit had 24 findings, sorted into bins as follows.

| Bin | Findings | Result |
| --- | --- | --- |
| Deterministic (checked from the project) | 1 | found, both parts confirmed |
| Agent (judgment, listed under "Needs a reviewer") | 9 | listed, not scored |
| Planned store rule (needs App Store Connect data or a rule not yet written) | 7 | not checked yet |
| Out of scope (runtime, server or build behaviour) | 7 | not checked |

Measured numbers:

| Measure | Value |
| --- | --- |
| Confirmed findings | 2, matching the manual audit |
| False positives | 0 |
| Coverage | 4 of 4 applicable checks |
| Wall time | about 1 s |
| Label | `Ready (code only)` |
| Score | 95 |

The two confirmed findings were ATS arbitrary loads (P2, 2.1) and a developer-tool usage string (P3, 5.1.1(ii)).

The other rules on this tree behaved as expected: `permissions.usage-string-present` passes, `permissions.usage-string-empty` passes, and `expo.prebuild-drift` is not applicable (no `ios/`). False negatives against the deterministic findings: none. The real run matched the expected result exactly.
