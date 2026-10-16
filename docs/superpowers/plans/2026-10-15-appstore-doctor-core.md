# AppStore Doctor Core (Plan 1 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `appstore-doctor` CLI that detects an Expo or native iOS project, collects bundle and capability facts, runs five evidence-contracted rules, prints a coverage-aware score, and emits JSON, with no store access yet.

**Architecture:** `cli → detect → collectors → Facts → rules → results → score/coverage → reporters`. Collectors only produce facts with provenance; rules are pure functions returning one of six result kinds; a redaction module sits between facts and every reporter. Plans 2 (SDK linking + potential rules), 3 (App Store Connect collector + store rules) and 4 (agent handoff + acceptance) build on the `Facts`, `Rule`, `Result` and `Report` types fixed here.

**Tech Stack:** TypeScript 5.6, ESM, Node ≥ 20, vitest, `fast-plist` (XML plist parsing), `picocolors` (one accent, honours `NO_COLOR`). No other runtime dependencies. Argument parsing with `node:util` `parseArgs`.

**Spec:** `docs/superpowers/specs/2026-10-15-appstore-doctor-design.md` (v2). This plan covers spec phases 0 and 1 (section 12), rules 1, 2, 3, 4 and 18 from section 6.1, the redaction module (5.3), score and coverage (4), terminal and JSON reporters (5.5), and the coverage map skeleton (3 and 9).

## Global Constraints

- Node `>=20`, `"type": "module"`, strict TypeScript, output in `dist/`, bin `appstore-doctor`.
- Runtime dependencies: `fast-plist`, `picocolors` only.
- Read only: a scan never writes inside the scanned project. The only file writes are `--out` (Plan 4) and nothing in this plan.
- No network calls in this plan at all (store, AASA and URL checks arrive in Plan 3 with `--offline`).
- Only `confirmed` results change the score. Weights P0 25, P1 10, P2 4, P3 1. Confirmed P0 caps at 59. Coverage < 80 % → label `Partial scan`.
- Every rule file declares `id`, `clauses`, `kind`, `severity`, `confirmsFail`, `confirmsPass`, `verify`, `reviewedOn`.
- Evidence excerpts pass through `redactExcerpt` and are at most 160 characters; files matching the sensitive-path pattern are never excerpted.
- Commits use the GitHub noreply identity already configured in the repo; end every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Guideline text in the package: clause id, title, URL, ≤ 25-word excerpt, `reviewedOn`. Never the full text.
- Copy rules for output: plain sentences, no emoji, no decorative characters beyond the bar.

## Review Focus

Inputs the spec implies but no step below would otherwise test; each has its test added to the owning task.

1. A bare project whose `Info.plist` is binary (`bplist00`) must yield `bundle: unavailable("could not parse …")`, not a crash. (Task 4)
2. Expo's CLI prints warnings before the JSON on stdout; the collector must parse from the first `{`, and a non-JSON stdout must yield `unavailable` with the first line quoted. (Task 5)
3. A usage-description key whose value is not a string (array or dict) must count as empty, not as present. (Task 4 parsing, Task 8 rule 3)
4. A project path containing a space, and running with `--path` from another directory, must work. (Task 11)
5. `NO_COLOR=1` or a non-TTY stdout must produce plain text and never an interactive prompt. (Task 10 and 11)

---

## File structure

```
package.json · tsconfig.json · vitest.config.ts · LICENSE · README.md · .gitignore · .github/workflows/ci.yml
src/cli.ts                     bin: parse flags, call run(), set exit code
src/main.ts                    run(opts, deps): detect → collect → rules → score → report
src/detect.ts                  detectProject(root)
src/facts.ts                   Facts, BundleFacts, CapabilityFact, Available<T>, ok(), unavailable()
src/collect/plist.ts           bundleFromPlist(): plist + entitlements → BundleFacts
src/collect/native.ts          collectNative(root): read ios/ files
src/collect/expo.ts            collectExpo(root, runner): run expo config introspect
src/collect/capabilities.ts    collectCapabilities(root): Podfile.lock pods + native symbols
src/redact.ts                  redactExcerpt(), isSensitivePath()
src/rules/types.ts             Rule, Result, RuleResult, Evidence, Severity
src/rules/run.ts               runRules(facts, rules)
src/rules/index.ts             RULES array
src/rules/permissions/usage-string-present.ts   rule 1
src/rules/permissions/usage-string-template.ts  rule 2
src/rules/permissions/usage-string-empty.ts     rule 3
src/rules/network/ats-arbitrary-loads.ts        rule 4
src/rules/expo/prebuild-drift.ts                rule 18
src/rules/capabilities.ts      REQUIRED_KEYS: capability → accepted usage keys
src/score.ts                   scoreResults(results)
src/verify.ts                  verifyItems(facts)
src/guidelines/index.json      generated clause index
src/guidelines/lookup.ts       clause(id)
src/report/types.ts            Report, ReportFinding
src/report/build.ts            buildReport()
src/report/terminal.ts         renderTerminal()
src/report/json.ts             renderJson()
scripts/build-guidelines-index.ts
scripts/build-coverage.ts
docs/coverage.md
fixtures/expo-minimal/…  fixtures/bare-xcode/…  fixtures/none/.keep
test/**                        one test file per module
```

---

### Task 1: Scaffold and the Facts types

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `.github/workflows/ci.yml`, `src/facts.ts`, `test/facts.test.ts`

**Interfaces:**
- Produces: `Available<T>`, `ok()`, `unavailable()`, `Provenance`, `UsageString`, `BundleFacts`, `Capability`, `CapabilityFact`, `ProjectKind`, `Facts` (exact shapes below). Every later task imports from `src/facts.ts`.

- [ ] **Step 1: Create package.json, tsconfig, vitest config, gitignore, licence, CI**

`package.json`:
```json
{
  "name": "appstore-doctor",
  "version": "0.1.0",
  "description": "Pre-submission checks for iOS apps. Ship your AI-built iOS app with confidence.",
  "license": "MIT",
  "type": "module",
  "bin": { "appstore-doctor": "dist/cli.js" },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "check": "tsc -p tsconfig.json --noEmit && vitest run",
    "guidelines": "tsx scripts/build-guidelines-index.ts",
    "coverage-map": "tsx scripts/build-coverage.ts"
  },
  "dependencies": {
    "fast-plist": "^0.1.3",
    "picocolors": "^1.1.1"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": false,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node' } });
```

`.gitignore`:
```
node_modules
dist
.DS_Store
```

`LICENSE`: the MIT text with `Copyright (c) 2026 Remberto Uzcategui`.

`.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix: { node: [20, 22] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ matrix.node }}" }
      - run: npm ci
      - run: npm run check
```

- [ ] **Step 2: Install**

Run: `cd ~/appstore-doctor && npm install`
Expected: `node_modules` created, `package-lock.json` written, no errors.

- [ ] **Step 3: Write the failing test for the facts helpers**

`test/facts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ok, unavailable } from '../src/facts.js';

describe('Available', () => {
  it('ok wraps a value', () => {
    expect(ok(3)).toEqual({ status: 'ok', value: 3 });
  });
  it('unavailable carries a reason', () => {
    expect(unavailable('no key')).toEqual({ status: 'unavailable', reason: 'no key' });
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run test/facts.test.ts`
Expected: FAIL, cannot find module `../src/facts.js`.

- [ ] **Step 5: Write src/facts.ts**

```ts
// Facts are what collectors produce. They never judge. Every fact says where it came from.

export type Provenance = { file: string; line?: number } | { api: string } | { command: string };

export type Available<T> = { status: 'ok'; value: T } | { status: 'unavailable'; reason: string };
export const ok = <T>(value: T): Available<T> => ({ status: 'ok', value });
export const unavailable = <T = never>(reason: string): Available<T> => ({ status: 'unavailable', reason });

/** A usage-description key. `value` is null when the key exists but is not a string. */
export type UsageString = { key: string; value: string | null; provenance: Provenance };

export type DeviceFamily = 'iphone' | 'ipad';

export type BundleFacts = {
  origin: 'expo' | 'native';
  bundleId?: string;
  displayName?: string;
  version?: string;
  build?: string;
  deviceFamilies: DeviceFamily[];
  usageStrings: UsageString[];
  ats: { allowsArbitraryLoads: boolean; exceptionDomains: string[]; provenance: Provenance } | null;
  entitlements: Record<string, unknown>;
  hasAppClip: boolean;
  provenance: Provenance;
};

export type Capability =
  | 'camera' | 'microphone' | 'location' | 'contacts' | 'photos' | 'bluetooth' | 'health'
  | 'tracking' | 'faceId' | 'calendar' | 'motion' | 'speech' | 'localNetwork';

/** Something that establishes a capability is linked into the binary. */
export type CapabilityFact = { capability: Capability; via: 'pod' | 'symbol'; name: string; provenance: Provenance };

export type ProjectKind = 'expo' | 'native' | 'both';

export type Facts = {
  root: string;
  project: { kind: ProjectKind; expoSdk?: string };
  /** The bundle that ships: Expo's resolved config when Expo is present, else the ios/ files. */
  bundle: Available<BundleFacts>;
  /** The ios/ files when both Expo and ios/ exist (for drift); unavailable otherwise. */
  nativeBundle: Available<BundleFacts>;
  capabilities: Available<CapabilityFact[]>;
  /** App Store Connect facts arrive in Plan 3. Always unavailable in this plan. */
  store: Available<Record<string, never>>;
};
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run test/facts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold: TypeScript ESM package, vitest, CI, Facts types

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Guidelines index and lookup

**Files:**
- Create: `scripts/build-guidelines-index.ts`, `src/guidelines/lookup.ts`, `src/guidelines/index.json` (generated), `test/guidelines.test.ts`

**Interfaces:**
- Consumes: a local full copy of the guidelines in Markdown. On this machine: `~/app-store-guidelines-skill/skills/app-store-guidelines/references/review-guidelines.md`, captured 2026-10-15.
- Produces: `clause(id: string): Clause | undefined` where `Clause = { id: string; title: string; url: string; excerpt: string; reviewedOn: string }`. Ids look like `2.3.7`, `4.8`, `5.1.1(v)`, `3.1.3(e)`.

- [ ] **Step 1: Write the failing lookup test**

`test/guidelines.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clause, allClauses } from '../src/guidelines/lookup.js';

describe('guidelines index', () => {
  it('finds a top-level clause', () => {
    const c = clause('4.8');
    expect(c?.title).toMatch(/Login Services/);
    expect(c?.url).toBe('https://developer.apple.com/app-store/review/guidelines/');
    expect(c?.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('finds a lettered and a roman sub-clause', () => {
    expect(clause('3.1.3(e)')?.excerpt.split(/\s+/).length).toBeLessThanOrEqual(25);
    expect(clause('5.1.1(v)')?.title).toMatch(/Account Sign-In/);
  });
  it('never carries more than 25 words of excerpt', () => {
    for (const c of allClauses()) expect(c.excerpt.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25);
  });
  it('returns undefined for an unknown id', () => {
    expect(clause('9.9.9')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run test/guidelines.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the generator script**

`scripts/build-guidelines-index.ts`:
```ts
// Builds src/guidelines/index.json from a local Markdown copy of the App Store Review Guidelines.
// Usage: tsx scripts/build-guidelines-index.ts <review-guidelines.md> <reviewedOn YYYY-MM-DD>
// The package ships only ids, titles, the page URL and an excerpt of at most 25 words.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , source, reviewedOn] = process.argv;
if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn ?? '')) {
  console.error('usage: build-guidelines-index <review-guidelines.md> <YYYY-MM-DD>');
  process.exit(2);
}
const URL = 'https://developer.apple.com/app-store/review/guidelines/';
const lines = readFileSync(source, 'utf8').split('\n');

type Clause = { id: string; title: string; url: string; excerpt: string; reviewedOn: string };
const out = new Map<string, Clause>();
const ROMAN = /^- \((i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\)\s+(.*)$/;
const HEADING = /^#{2,4}\s+(\d+(?:\.\d+)*)\s+(.*)$/;
const BOLD = /^\*\*(\d+(?:\.\d+)*)\*\*\s*(?:\(([a-z])\)\s*)?(.*)$/;

function titleAndExcerpt(text: string): { title: string; excerpt: string } {
  const clean = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
  const colon = clean.indexOf(':');
  const title = (colon > 0 && colon <= 60 ? clean.slice(0, colon) : clean.split(/(?<=\.)\s/)[0]).slice(0, 80).trim();
  const excerpt = clean.split(/\s+/).filter(Boolean).slice(0, 25).join(' ');
  return { title, excerpt };
}

let current = '';
for (const raw of lines) {
  const line = raw.trimEnd();
  let m = HEADING.exec(line);
  if (m) {
    current = m[1];
    const { title } = titleAndExcerpt(m[2]);
    out.set(current, { id: current, title, url: URL, excerpt: '', reviewedOn });
    continue;
  }
  m = BOLD.exec(line);
  if (m) {
    const id = m[2] ? `${m[1]}(${m[2]})` : m[1];
    current = m[1];
    const { title, excerpt } = titleAndExcerpt(m[3]);
    const existing = out.get(id);
    out.set(id, { id, title: existing?.title || title, url: URL, excerpt, reviewedOn });
    continue;
  }
  m = ROMAN.exec(line);
  if (m && current) {
    const id = `${current}(${m[1]})`;
    const { title, excerpt } = titleAndExcerpt(m[2]);
    out.set(id, { id, title, url: URL, excerpt, reviewedOn });
    continue;
  }
  // First paragraph after a heading becomes its excerpt.
  if (current && line && !line.startsWith('#') && out.get(current) && !out.get(current)!.excerpt) {
    out.get(current)!.excerpt = titleAndExcerpt(line).excerpt;
  }
}

const sorted = [...out.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
writeFileSync(new URL('../src/guidelines/index.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
console.log(`wrote ${sorted.length} clauses, reviewedOn ${reviewedOn}`);
```

- [ ] **Step 4: Write the lookup**

`src/guidelines/lookup.ts`:
```ts
import { readFileSync } from 'node:fs';

export type Clause = { id: string; title: string; url: string; excerpt: string; reviewedOn: string };

let cache: Clause[] | null = null;
function load(): Clause[] {
  if (!cache) cache = JSON.parse(readFileSync(new URL('./index.json', import.meta.url), 'utf8')) as Clause[];
  return cache;
}
export function allClauses(): Clause[] { return load(); }
export function clause(id: string): Clause | undefined { return load().find((c) => c.id === id); }
export function guidelinesReviewedOn(): string { return load()[0]?.reviewedOn ?? 'unknown'; }
```

- [ ] **Step 5: Generate the index and run the tests**

Run:
```bash
mkdir -p src/guidelines
npx tsx scripts/build-guidelines-index.ts ~/app-store-guidelines-skill/skills/app-store-guidelines/references/review-guidelines.md 2026-10-15
npx vitest run test/guidelines.test.ts
```
Expected: "wrote N clauses" with N above 150; PASS (4 tests). If `4.8` or `5.1.1(v)` is missing, open the Markdown and adjust the regexes to that file's heading style; the test names the exact ids.

- [ ] **Step 6: Make the build copy the JSON into dist**

Add to `package.json` scripts: `"build": "tsc -p tsconfig.json && mkdir -p dist/guidelines && cp src/guidelines/index.json dist/guidelines/"`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Guidelines index: ids, titles, 25-word excerpts, reviewedOn; lookup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Redaction module

**Files:**
- Create: `src/redact.ts`, `test/redact.test.ts`

**Interfaces:**
- Produces: `redactExcerpt(line: string): string | null` (null means "do not show"), `isSensitivePath(path: string): boolean`, `MAX_EXCERPT = 160`.

- [ ] **Step 1: Write the failing tests**

`test/redact.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isSensitivePath, redactExcerpt, MAX_EXCERPT } from '../src/redact.js';

describe('redactExcerpt', () => {
  it('trims and keeps an ordinary line', () => {
    expect(redactExcerpt('   const camera = useRef<CameraView>(null);  ')).toBe('const camera = useRef<CameraView>(null);');
  });
  it('cuts long lines to 160 characters with an ellipsis', () => {
    const r = redactExcerpt('x'.repeat(400))!;
    expect(r.length).toBe(MAX_EXCERPT + 1);
    expect(r.endsWith('…')).toBe(true);
  });
  it.each([
    '-----BEGIN PRIVATE KEY-----',
    'const key = "sk_live_51Hxxxxxxxx";',
    'AKIAIOSFODNN7EXAMPLE',
    'eyJhbGciOiJFUzI1NiIsImtpZCI6IkFCQ0RFRjEyMzQifQ.eyJpc3MiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.sig',
    'token = process.env.X',
    'password: "hunter2"',
    'secretKey: value',
    'd41d8cd98f00b204e9800998ecf8427e00000000',
  ])('hides a line that looks like a secret: %s', (line) => {
    expect(redactExcerpt(line)).toBeNull();
  });
  it('keeps a line with a short hex colour', () => {
    expect(redactExcerpt("color: '#ebe8df'")).toBe("color: '#ebe8df'");
  });
});

describe('isSensitivePath', () => {
  it.each(['.env', '.env.local', 'keys/AuthKey_ABC123DEFG.p8', 'certs/server.pem', 'android/app/release.keystore', 'google-credentials.json', 'ios/dist.mobileprovision'])('flags %s', (p) => {
    expect(isSensitivePath(p)).toBe(true);
  });
  it.each(['app.json', 'src/env.ts', 'ios/App/Info.plist', 'docs/environment.md'])('allows %s', (p) => {
    expect(isSensitivePath(p)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run test/redact.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write src/redact.ts**

```ts
// Every excerpt that reaches a reporter or the agent prompt goes through here first.
export const MAX_EXCERPT = 160;

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN/,
  /\bsk_(live|test)_/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /\btoken\s*[=:]/i,
  /\bsecret/i,
  /\bpassword\b/i,
  /\b[A-Fa-f0-9]{32,}\b/,
  /[A-Za-z0-9+/]{40,}={0,2}/,
];

const SENSITIVE_PATH = /(^|[\\/])(\.env[^\\/]*|[^\\/]*\.(p8|pem|key|keystore|jks|p12|mobileprovision)|[^\\/]*credentials[^\\/]*)$/i;

export function redactExcerpt(line: string): string | null {
  const trimmed = line.trim();
  if (SECRET_PATTERNS.some((p) => p.test(trimmed))) return null;
  return trimmed.length > MAX_EXCERPT ? trimmed.slice(0, MAX_EXCERPT) + '…' : trimmed;
}

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH.test(path);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/redact.test.ts`
Expected: PASS. If the JWT line fails, check the `eyJ` pattern requires a dot-separated second segment of at least 8 characters, which the fixture has.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Redaction: excerpt limits, secret patterns, sensitive paths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Plist parsing and the native collector

**Files:**
- Create: `src/collect/plist.ts`, `src/collect/native.ts`, `test/plist.test.ts`, `test/native.test.ts`
- Create fixtures: `fixtures/bare-xcode/ios/App.xcodeproj/project.pbxproj`, `fixtures/bare-xcode/ios/App/Info.plist`, `fixtures/bare-xcode/ios/App/App.entitlements`, `fixtures/bare-xcode/ios/App/Location.swift`, `fixtures/bare-xcode/ios/Podfile.lock`, `fixtures/bare-xcode/package.json`, `fixtures/binary-plist/ios/App.xcodeproj/project.pbxproj`, `fixtures/binary-plist/ios/App/Info.plist` (binary)

**Interfaces:**
- Consumes: `BundleFacts`, `UsageString`, `Provenance`, `Available`, `ok`, `unavailable` from `src/facts.ts`.
- Produces:
  - `bundleFromPlist(plist: Record<string, unknown>, entitlements: Record<string, unknown>, opts: { origin: 'expo' | 'native'; provenance: Provenance; bundleId?: string; deviceFamilies?: DeviceFamily[]; hasAppClip?: boolean }): BundleFacts`
  - `collectNative(root: string): Available<BundleFacts>`
  - `findXcodeProject(root: string): { pbxproj: string; targetDir: string } | null`

- [ ] **Step 1: Create the bare-xcode fixture**

`fixtures/bare-xcode/package.json`:
```json
{ "name": "bare-fixture", "private": true, "dependencies": { "react-native": "0.76.0" } }
```

`fixtures/bare-xcode/ios/App.xcodeproj/project.pbxproj` (a trimmed but valid-looking excerpt is enough; the collector only regex-reads it):
```
// !$*UTF8*$!
{
	objects = {
		13B07F8E1A680F5B00A75B9A /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				PRODUCT_BUNDLE_IDENTIFIER = com.example.barefixture;
				PRODUCT_NAME = App;
				TARGETED_DEVICE_FAMILY = "1,2";
				INFOPLIST_FILE = App/Info.plist;
			};
			name = Release;
		};
	};
}
```

`fixtures/bare-xcode/ios/App/Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDisplayName</key><string>Bare Fixture</string>
	<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleShortVersionString</key><string>1.2.0</string>
	<key>CFBundleVersion</key><string>7</string>
	<key>NSCameraUsageDescription</key><string>Bare Fixture uses the camera to scan tickets.</string>
	<key>NSMicrophoneUsageDescription</key><string></string>
	<key>NSLocalNetworkUsageDescription</key><string>Expo Dev Launcher uses the local network to find your dev server.</string>
	<key>NSPhotoLibraryUsageDescription</key><array><string>not a string</string></array>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key><true/>
		<key>NSExceptionDomains</key><dict><key>localhost</key><dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/></dict></dict>
	</dict>
</dict>
</plist>
```

`fixtures/bare-xcode/ios/App/App.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key><string>production</string>
	<key>com.apple.developer.associated-domains</key><array><string>applinks:example.com</string></array>
</dict>
</plist>
```

`fixtures/bare-xcode/ios/App/Location.swift`:
```swift
import CoreLocation
final class Where: NSObject, CLLocationManagerDelegate {
  let manager = CLLocationManager()
}
```

`fixtures/bare-xcode/ios/Podfile.lock`:
```
PODS:
  - React-Core (0.76.0)
  - VisionCamera (4.5.0):
    - React-Core
  - RNScreens (3.34.0)

DEPENDENCIES:
  - VisionCamera (from `../node_modules/react-native-vision-camera`)
```

- [ ] **Step 2: Create the binary plist fixture**

Run (macOS has `plutil`; on Linux commit the file produced here):
```bash
mkdir -p fixtures/binary-plist/ios/App.xcodeproj fixtures/binary-plist/ios/App
cp fixtures/bare-xcode/ios/App.xcodeproj/project.pbxproj fixtures/binary-plist/ios/App.xcodeproj/
printf '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.example.bin</string></dict></plist>' > fixtures/binary-plist/ios/App/Info.plist
plutil -convert binary1 fixtures/binary-plist/ios/App/Info.plist
head -c 8 fixtures/binary-plist/ios/App/Info.plist   # expect: bplist00
```

- [ ] **Step 3: Write the failing plist tests**

`test/plist.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { bundleFromPlist } from '../src/collect/plist.js';

const prov = { file: 'ios/App/Info.plist' };

describe('bundleFromPlist', () => {
  it('reads usage strings, keeping non-strings as null', () => {
    const b = bundleFromPlist(
      { NSCameraUsageDescription: 'Scans tickets', NSPhotoLibraryUsageDescription: ['x'], CFBundleIdentifier: 'com.x.y' },
      {},
      { origin: 'native', provenance: prov },
    );
    expect(b.usageStrings).toEqual([
      { key: 'NSCameraUsageDescription', value: 'Scans tickets', provenance: prov },
      { key: 'NSPhotoLibraryUsageDescription', value: null, provenance: prov },
    ]);
    expect(b.bundleId).toBe('com.x.y');
  });
  it('ignores an unresolved $(PRODUCT_BUNDLE_IDENTIFIER) and prefers opts.bundleId', () => {
    const b = bundleFromPlist({ CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)' }, {}, { origin: 'native', provenance: prov, bundleId: 'com.from.pbx' });
    expect(b.bundleId).toBe('com.from.pbx');
    const c = bundleFromPlist({ CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)' }, {}, { origin: 'native', provenance: prov });
    expect(c.bundleId).toBeUndefined();
  });
  it('reads ATS', () => {
    const b = bundleFromPlist(
      { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSExceptionDomains: { 'localhost': {} } } },
      {},
      { origin: 'expo', provenance: { command: 'expo config' } },
    );
    expect(b.ats).toEqual({ allowsArbitraryLoads: true, exceptionDomains: ['localhost'], provenance: { command: 'expo config' } });
    expect(bundleFromPlist({}, {}, { origin: 'expo', provenance: prov }).ats).toBeNull();
  });
  it('derives device families from UIDeviceFamily when not given', () => {
    expect(bundleFromPlist({ UIDeviceFamily: [1, 2] }, {}, { origin: 'native', provenance: prov }).deviceFamilies).toEqual(['iphone', 'ipad']);
    expect(bundleFromPlist({}, {}, { origin: 'native', provenance: prov }).deviceFamilies).toEqual(['iphone']);
  });
  it('detects an App Clip from the entitlement', () => {
    const b = bundleFromPlist({}, { 'com.apple.developer.associated-appclip-app-identifiers': ['x'] }, { origin: 'expo', provenance: prov });
    expect(b.hasAppClip).toBe(true);
  });
});
```

- [ ] **Step 4: Run to see it fail**

Run: `npx vitest run test/plist.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 5: Write src/collect/plist.ts**

```ts
import type { BundleFacts, DeviceFamily, Provenance, UsageString } from '../facts.js';

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

export function bundleFromPlist(
  plist: Dict,
  entitlements: Dict,
  opts: { origin: 'expo' | 'native'; provenance: Provenance; bundleId?: string; deviceFamilies?: DeviceFamily[]; hasAppClip?: boolean },
): BundleFacts {
  const usageStrings: UsageString[] = Object.keys(plist)
    .filter((k) => /^NS.*UsageDescription$/.test(k))
    .sort()
    .map((key) => {
      const v = plist[key];
      return { key, value: typeof v === 'string' ? v : null, provenance: opts.provenance };
    });

  const atsRaw = plist.NSAppTransportSecurity;
  const ats = isDict(atsRaw)
    ? {
        allowsArbitraryLoads: atsRaw.NSAllowsArbitraryLoads === true,
        exceptionDomains: isDict(atsRaw.NSExceptionDomains) ? Object.keys(atsRaw.NSExceptionDomains) : [],
        provenance: opts.provenance,
      }
    : null;

  const rawId = typeof plist.CFBundleIdentifier === 'string' ? plist.CFBundleIdentifier : undefined;
  const bundleId = opts.bundleId ?? (rawId && !rawId.startsWith('$(') ? rawId : undefined);

  const families: DeviceFamily[] =
    opts.deviceFamilies ??
    (Array.isArray(plist.UIDeviceFamily)
      ? (plist.UIDeviceFamily as unknown[]).flatMap((n) => (n === 1 ? ['iphone'] : n === 2 ? ['ipad'] : []))
      : ['iphone']);

  const str = (k: string) => (typeof plist[k] === 'string' ? (plist[k] as string) : undefined);

  return {
    origin: opts.origin,
    bundleId,
    displayName: str('CFBundleDisplayName') ?? str('CFBundleName'),
    version: str('CFBundleShortVersionString'),
    build: str('CFBundleVersion'),
    deviceFamilies: families.length ? families : ['iphone'],
    usageStrings,
    ats,
    entitlements,
    hasAppClip: opts.hasAppClip ?? 'com.apple.developer.associated-appclip-app-identifiers' in entitlements,
    provenance: opts.provenance,
  };
}
```

- [ ] **Step 6: Run the plist tests**

Run: `npx vitest run test/plist.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Write the failing native collector tests**

`test/native.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectNative, findXcodeProject } from '../src/collect/native.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('collectNative', () => {
  it('finds the project and target directory', () => {
    const p = findXcodeProject(fixture('bare-xcode'));
    expect(p?.pbxproj.endsWith('ios/App.xcodeproj/project.pbxproj')).toBe(true);
    expect(p?.targetDir.endsWith('ios/App')).toBe(true);
  });
  it('reads bundle facts from ios/ with the id and families from the pbxproj', () => {
    const r = collectNative(fixture('bare-xcode'));
    if (r.status !== 'ok') throw new Error(r.reason);
    const b = r.value;
    expect(b.origin).toBe('native');
    expect(b.bundleId).toBe('com.example.barefixture');
    expect(b.deviceFamilies).toEqual(['iphone', 'ipad']);
    expect(b.displayName).toBe('Bare Fixture');
    expect(b.usageStrings.map((u) => u.key)).toEqual([
      'NSCameraUsageDescription', 'NSLocalNetworkUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription',
    ]);
    expect(b.ats?.allowsArbitraryLoads).toBe(true);
    expect(b.entitlements['aps-environment']).toBe('production');
    expect(b.provenance).toEqual({ file: 'ios/App/Info.plist' });
  });
  it('returns unavailable for a binary plist instead of throwing', () => {
    const r = collectNative(fixture('binary-plist'));
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') expect(r.reason).toMatch(/could not parse ios\/App\/Info\.plist/);
  });
  it('returns null when there is no Xcode project', () => {
    expect(findXcodeProject(fixture('none'))).toBeNull();
  });
});
```

Create `fixtures/none/.keep` (empty file).

- [ ] **Step 8: Run to see it fail**

Run: `npx vitest run test/native.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 9: Write src/collect/native.ts**

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parsePlist } from 'fast-plist';
import { ok, unavailable, type Available, type BundleFacts, type DeviceFamily } from '../facts.js';
import { bundleFromPlist } from './plist.js';

type Dict = Record<string, unknown>;

/** Finds `<root>/ios/<Name>.xcodeproj` or `<root>/<Name>.xcodeproj` and the matching target folder. */
export function findXcodeProject(root: string): { pbxproj: string; targetDir: string } | null {
  for (const base of [join(root, 'ios'), root]) {
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    const proj = readdirSync(base).find((n) => n.endsWith('.xcodeproj') && n !== 'Pods.xcodeproj');
    if (!proj) continue;
    const pbxproj = join(base, proj, 'project.pbxproj');
    if (!existsSync(pbxproj)) continue;
    const name = proj.replace(/\.xcodeproj$/, '');
    const candidates = [join(base, name), ...readdirSync(base).map((n) => join(base, n))].filter(
      (d) => existsSync(join(d, 'Info.plist')) && !/Pods|Tests|Clip/i.test(relative(base, d)),
    );
    if (candidates.length === 0) continue;
    return { pbxproj, targetDir: candidates[0] };
  }
  return null;
}

function readPlist(file: string): Dict {
  const text = readFileSync(file, 'utf8');
  if (text.startsWith('bplist')) throw new Error('binary plist; run plutil -convert xml1');
  const parsed = parsePlist(text) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('top level is not a dictionary');
  return parsed as Dict;
}

export function collectNative(root: string): Available<BundleFacts> {
  const found = findXcodeProject(root);
  if (!found) return unavailable('no Xcode project found (looked for ios/*.xcodeproj and *.xcodeproj)');
  const plistPath = join(found.targetDir, 'Info.plist');
  const rel = (p: string) => relative(root, p).split('\\').join('/');

  let plist: Dict;
  try {
    plist = readPlist(plistPath);
  } catch (e) {
    return unavailable(`could not parse ${rel(plistPath)}: ${(e as Error).message}`);
  }

  const pbx = readFileSync(found.pbxproj, 'utf8');
  const idMatch = /PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/.exec(pbx);
  const famMatch = /TARGETED_DEVICE_FAMILY = "?([12,]+)"?;/.exec(pbx);
  const deviceFamilies: DeviceFamily[] | undefined = famMatch
    ? (famMatch[1].split(',').flatMap((n) => (n === '1' ? ['iphone'] : n === '2' ? ['ipad'] : [])) as DeviceFamily[])
    : undefined;

  let entitlements: Dict = {};
  const entFile = readdirSync(found.targetDir).find((n) => n.endsWith('.entitlements'));
  if (entFile) {
    try { entitlements = readPlist(join(found.targetDir, entFile)); } catch { entitlements = {}; }
  }

  return ok(
    bundleFromPlist(plist, entitlements, {
      origin: 'native',
      provenance: { file: rel(plistPath) },
      bundleId: idMatch?.[1],
      deviceFamilies,
    }),
  );
}
```

- [ ] **Step 10: Run the native tests**

Run: `npx vitest run test/native.test.ts test/plist.test.ts`
Expected: PASS (9 tests). If `fast-plist` has no default types, add `declare module 'fast-plist' { export function parse(s: string): unknown; }` in `src/types/fast-plist.d.ts` and include `src` in tsconfig (already).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Native collector: plist, entitlements, pbxproj id and families; fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Expo collector and project detection

**Files:**
- Create: `src/collect/expo.ts`, `src/detect.ts`, `test/expo.test.ts`, `test/detect.test.ts`
- Create fixtures: `fixtures/expo-minimal/app.json`, `fixtures/expo-minimal/package.json`, `fixtures/expo-minimal/introspect.json`, `fixtures/expo-minimal/node_modules/.keep`

**Interfaces:**
- Produces:
  - `type Runner = (cmd: string, args: string[], cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>`
  - `defaultRunner: Runner` (execFile, 20 MB buffer, 120 s timeout)
  - `collectExpo(root: string, run: Runner): Promise<{ bundle: Available<BundleFacts>; sdk?: string }>`
  - `detectProject(root: string): { kind: ProjectKind | 'none'; expoConfig?: string; xcodeproj?: string }`

- [ ] **Step 1: Create the Expo fixture**

`fixtures/expo-minimal/app.json`:
```json
{ "expo": { "name": "Expo Fixture", "slug": "expo-fixture", "version": "2.0.0", "ios": { "bundleIdentifier": "com.example.expofixture" } } }
```

`fixtures/expo-minimal/package.json`:
```json
{ "name": "expo-fixture", "private": true, "dependencies": { "expo": "~52.0.0", "expo-camera": "~16.0.0" } }
```

`fixtures/expo-minimal/introspect.json` (recorded shape of `expo config --json --type introspect`, trimmed to the keys the collector reads):
```json
{
  "name": "Expo Fixture",
  "slug": "expo-fixture",
  "version": "2.0.0",
  "sdkVersion": "52.0.0",
  "ios": {
    "bundleIdentifier": "com.example.expofixture",
    "buildNumber": "12",
    "supportsTablet": false,
    "infoPlist": {
      "CFBundleDisplayName": "Expo Fixture",
      "NSCameraUsageDescription": "Allow $(PRODUCT_NAME) to access your camera",
      "NSAppTransportSecurity": { "NSAllowsArbitraryLoads": true, "NSExceptionDomains": { "localhost": { "NSExceptionAllowsInsecureHTTPLoads": true } } }
    },
    "entitlements": { "aps-environment": "development" }
  }
}
```

`fixtures/expo-minimal/node_modules/.keep`: empty file. Add `!fixtures/**/node_modules` to `.gitignore` so it is committed:
```
node_modules
!fixtures/**/node_modules
dist
.DS_Store
```

- [ ] **Step 2: Write the failing Expo tests**

`test/expo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectExpo, type Runner } from '../src/collect/expo.js';

const root = fileURLToPath(new URL('../fixtures/expo-minimal', import.meta.url));
const recorded = readFileSync(`${root}/introspect.json`, 'utf8');
const runnerWith = (stdout: string, code = 0, stderr = ''): Runner => async () => ({ code, stdout, stderr });

describe('collectExpo', () => {
  it('maps the introspected config to bundle facts', async () => {
    const { bundle, sdk } = await collectExpo(root, runnerWith(recorded));
    if (bundle.status !== 'ok') throw new Error(bundle.reason);
    expect(sdk).toBe('52.0.0');
    expect(bundle.value.origin).toBe('expo');
    expect(bundle.value.bundleId).toBe('com.example.expofixture');
    expect(bundle.value.build).toBe('12');
    expect(bundle.value.version).toBe('2.0.0');
    expect(bundle.value.deviceFamilies).toEqual(['iphone']);
    expect(bundle.value.usageStrings[0]).toEqual({
      key: 'NSCameraUsageDescription', value: 'Allow $(PRODUCT_NAME) to access your camera',
      provenance: { command: 'npx expo config --json --type introspect' },
    });
    expect(bundle.value.ats?.allowsArbitraryLoads).toBe(true);
  });
  it('tolerates warnings printed before the JSON', async () => {
    const { bundle } = await collectExpo(root, runnerWith(`WARNING: something\nAnother line\n${recorded}`));
    expect(bundle.status).toBe('ok');
  });
  it('reports a failing CLI with its first line', async () => {
    const { bundle } = await collectExpo(root, runnerWith('', 1, 'Error: Cannot find module expo\n  at …'));
    expect(bundle).toEqual({ status: 'unavailable', reason: 'expo config failed: Error: Cannot find module expo' });
  });
  it('reports non-JSON output', async () => {
    const { bundle } = await collectExpo(root, runnerWith('not json at all'));
    expect(bundle.status).toBe('unavailable');
    if (bundle.status === 'unavailable') expect(bundle.reason).toMatch(/expo config returned no JSON/);
  });
  it('asks for an install when node_modules is missing', async () => {
    const none = fileURLToPath(new URL('../fixtures/none', import.meta.url));
    const { bundle } = await collectExpo(none, runnerWith(recorded));
    expect(bundle).toEqual({ status: 'unavailable', reason: 'node_modules is not installed; run npm install (or yarn, pnpm, bun) first' });
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `npx vitest run test/expo.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Write src/collect/expo.ts**

```ts
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, unavailable, type Available, type BundleFacts } from '../facts.js';
import { bundleFromPlist } from './plist.js';

export type Runner = (cmd: string, args: string[], cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>;

export const defaultRunner: Runner = (cmd, args, cwd) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, maxBuffer: 20 * 1024 * 1024, timeout: 120_000, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } }, (err, stdout, stderr) => {
      const code = err && typeof (err as NodeJS.ErrnoException & { code?: number | string }).code === 'number' ? ((err as { code: number }).code) : err ? 1 : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });

const COMMAND = 'npx expo config --json --type introspect';

export async function collectExpo(root: string, run: Runner): Promise<{ bundle: Available<BundleFacts>; sdk?: string }> {
  if (!existsSync(join(root, 'node_modules'))) {
    return { bundle: unavailable('node_modules is not installed; run npm install (or yarn, pnpm, bun) first') };
  }
  const { code, stdout, stderr } = await run('npx', ['expo', 'config', '--json', '--type', 'introspect'], root);
  if (code !== 0) {
    const first = (stderr || stdout).split('\n').find((l) => l.trim()) ?? `exit code ${code}`;
    return { bundle: unavailable(`expo config failed: ${first.trim()}`) };
  }
  const start = stdout.indexOf('{');
  if (start < 0) return { bundle: unavailable('expo config returned no JSON') };
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(stdout.slice(start)) as Record<string, unknown>;
  } catch (e) {
    return { bundle: unavailable(`expo config returned no JSON: ${(e as Error).message}`) };
  }
  const ios = (typeof config.ios === 'object' && config.ios ? config.ios : {}) as Record<string, unknown>;
  const plist = (typeof ios.infoPlist === 'object' && ios.infoPlist ? ios.infoPlist : {}) as Record<string, unknown>;
  const entitlements = (typeof ios.entitlements === 'object' && ios.entitlements ? ios.entitlements : {}) as Record<string, unknown>;

  const bundle = bundleFromPlist(plist, entitlements, {
    origin: 'expo',
    provenance: { command: COMMAND },
    bundleId: typeof ios.bundleIdentifier === 'string' ? ios.bundleIdentifier : undefined,
    deviceFamilies: ios.supportsTablet === true ? ['iphone', 'ipad'] : ['iphone'],
  });
  if (!bundle.displayName && typeof config.name === 'string') bundle.displayName = config.name;
  if (!bundle.version && typeof config.version === 'string') bundle.version = config.version;
  if (!bundle.build && typeof ios.buildNumber === 'string') bundle.build = ios.buildNumber;

  return { bundle: ok(bundle), sdk: typeof config.sdkVersion === 'string' ? config.sdkVersion : undefined };
}
```

- [ ] **Step 5: Run the Expo tests**

Run: `npx vitest run test/expo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing detection tests**

`test/detect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { detectProject } from '../src/detect.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('detectProject', () => {
  it('detects Expo from app.json + the expo dependency', () => {
    expect(detectProject(fixture('expo-minimal'))).toEqual({ kind: 'expo', expoConfig: 'app.json' });
  });
  it('detects a bare Xcode project', () => {
    const d = detectProject(fixture('bare-xcode'));
    expect(d.kind).toBe('native');
    expect(d.xcodeproj).toBe('ios/App.xcodeproj/project.pbxproj');
  });
  it('returns none for an empty folder', () => {
    expect(detectProject(fixture('none'))).toEqual({ kind: 'none' });
  });
});
```

- [ ] **Step 7: Run to see it fail**

Run: `npx vitest run test/detect.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 8: Write src/detect.ts**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ProjectKind } from './facts.js';
import { findXcodeProject } from './collect/native.js';

export type Detection = { kind: ProjectKind | 'none'; expoConfig?: string; xcodeproj?: string };

function hasExpoDependency(root: string): boolean {
  const pkg = join(root, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    const json = JSON.parse(readFileSync(pkg, 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(json.dependencies?.expo ?? json.devDependencies?.expo);
  } catch {
    return false;
  }
}

function expoConfigFile(root: string): string | undefined {
  for (const name of ['app.config.ts', 'app.config.js', 'app.config.mjs', 'app.config.cjs', 'app.json']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    if (name === 'app.json') {
      try {
        const json = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        if (!('expo' in json)) continue;
      } catch {
        continue;
      }
    }
    return name;
  }
  return undefined;
}

export function detectProject(root: string): Detection {
  const expoConfig = hasExpoDependency(root) ? expoConfigFile(root) : undefined;
  const xcode = findXcodeProject(root);
  const xcodeproj = xcode ? relative(root, xcode.pbxproj).split('\\').join('/') : undefined;
  if (expoConfig && xcodeproj) return { kind: 'both', expoConfig, xcodeproj };
  if (expoConfig) return { kind: 'expo', expoConfig };
  if (xcodeproj) return { kind: 'native', xcodeproj };
  return { kind: 'none' };
}
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run test/detect.test.ts test/expo.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Expo collector with injected runner; project detection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Capabilities collector (pods and native symbols)

**Files:**
- Create: `src/collect/capabilities.ts`, `src/rules/capabilities.ts`, `test/capabilities.test.ts`

**Interfaces:**
- Produces:
  - `collectCapabilities(root: string): Available<CapabilityFact[]>`
  - `REQUIRED_KEYS: Record<Capability, string[]>` (any one of the listed keys satisfies the capability)
  - `POD_CAPABILITIES: Record<string, Capability>`, `SYMBOL_PATTERNS: Array<{ capability: Capability; pattern: RegExp; name: string }>`

- [ ] **Step 1: Write the failing tests**

`test/capabilities.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectCapabilities } from '../src/collect/capabilities.js';
import { REQUIRED_KEYS } from '../src/rules/capabilities.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('collectCapabilities', () => {
  it('finds a pod and a native symbol with provenance', () => {
    const r = collectCapabilities(fixture('bare-xcode'));
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value).toContainEqual({ capability: 'camera', via: 'pod', name: 'VisionCamera', provenance: { file: 'ios/Podfile.lock', line: 3 } });
    expect(r.value).toContainEqual({ capability: 'location', via: 'symbol', name: 'CLLocationManager', provenance: { file: 'ios/App/Location.swift', line: 3 } });
  });
  it('ignores nested pod dependencies and non-native files', () => {
    const r = collectCapabilities(fixture('bare-xcode'));
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value.filter((c) => c.name === 'React-Core')).toHaveLength(0);
  });
  it('is unavailable for a managed Expo project with no native code', () => {
    const r = collectCapabilities(fixture('expo-minimal'));
    expect(r).toEqual({ status: 'unavailable', reason: 'no Podfile.lock and no native source files; linked SDK resolution for managed Expo projects arrives in a later release' });
  });
  it('maps every capability to at least one usage key', () => {
    for (const keys of Object.values(REQUIRED_KEYS)) expect(keys.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run test/capabilities.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write src/rules/capabilities.ts**

```ts
import type { Capability } from '../facts.js';

/** Any one of these keys satisfies the capability's usage-description requirement. */
export const REQUIRED_KEYS: Record<Capability, string[]> = {
  camera: ['NSCameraUsageDescription'],
  microphone: ['NSMicrophoneUsageDescription'],
  location: ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription'],
  contacts: ['NSContactsUsageDescription'],
  photos: ['NSPhotoLibraryUsageDescription'],
  bluetooth: ['NSBluetoothAlwaysUsageDescription'],
  health: ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription'],
  tracking: ['NSUserTrackingUsageDescription'],
  faceId: ['NSFaceIDUsageDescription'],
  calendar: ['NSCalendarsFullAccessUsageDescription', 'NSCalendarsWriteOnlyAccessUsageDescription', 'NSCalendarsUsageDescription'],
  motion: ['NSMotionUsageDescription'],
  speech: ['NSSpeechRecognitionUsageDescription'],
  localNetwork: ['NSLocalNetworkUsageDescription'],
};

/** Pod names (from Podfile.lock) that link a capability. Conservative: only pods whose purpose is the capability. */
export const POD_CAPABILITIES: Record<string, Capability> = {
  VisionCamera: 'camera',
  'react-native-vision-camera': 'camera',
  EXCamera: 'camera',
  RNCamera: 'camera',
  EXLocation: 'location',
  'react-native-geolocation-service': 'location',
  RNCGeolocation: 'location',
  EXContacts: 'contacts',
  RNContacts: 'contacts',
  'react-native-ble-plx': 'bluetooth',
  MultiplatformBleAdapter: 'bluetooth',
  RNBluetoothClassic: 'bluetooth',
  RNAppleHealthKit: 'health',
  'react-native-health': 'health',
  EXTrackingTransparency: 'tracking',
  'react-native-tracking-transparency': 'tracking',
  RNVoice: 'speech',
  EXSpeech: 'speech',
  EXLocalAuthentication: 'faceId',
  RNLocalAuthentication: 'faceId',
  EXCalendar: 'calendar',
  EXSensors: 'motion',
};

/** iOS API symbols in Swift or Objective-C source that imply a capability. */
export const SYMBOL_PATTERNS: Array<{ capability: Capability; pattern: RegExp; name: string }> = [
  { capability: 'camera', pattern: /\bAVCapture(Device|Session)\b/, name: 'AVCaptureDevice' },
  { capability: 'microphone', pattern: /\bAVAudioRecorder\b|\.record\(\)|AVAudioSession\.Category\.record/, name: 'AVAudioRecorder' },
  { capability: 'location', pattern: /\bCLLocationManager\b/, name: 'CLLocationManager' },
  { capability: 'contacts', pattern: /\bCNContactStore\b/, name: 'CNContactStore' },
  { capability: 'photos', pattern: /\bPHPhotoLibrary\b/, name: 'PHPhotoLibrary' },
  { capability: 'bluetooth', pattern: /\bCB(Central|Peripheral)Manager\b/, name: 'CBCentralManager' },
  { capability: 'health', pattern: /\bHKHealthStore\b/, name: 'HKHealthStore' },
  { capability: 'tracking', pattern: /\bATTrackingManager\b/, name: 'ATTrackingManager' },
  { capability: 'faceId', pattern: /\bLAContext\b/, name: 'LAContext' },
  { capability: 'calendar', pattern: /\bEKEventStore\b/, name: 'EKEventStore' },
  { capability: 'motion', pattern: /\bCMMotion(Manager|ActivityManager)\b/, name: 'CMMotionManager' },
  { capability: 'speech', pattern: /\bSFSpeechRecognizer\b/, name: 'SFSpeechRecognizer' },
  { capability: 'localNetwork', pattern: /\bNWBrowser\b|\bNetServiceBrowser\b|\bMCNearbyServiceBrowser\b/, name: 'NWBrowser' },
];
```

- [ ] **Step 4: Write src/collect/capabilities.ts**

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, unavailable, type Available, type CapabilityFact } from '../facts.js';
import { POD_CAPABILITIES, SYMBOL_PATTERNS } from '../rules/capabilities.js';

const SKIP_DIRS = new Set(['node_modules', 'Pods', 'build', '.git', 'DerivedData', 'Carthage', 'dist', '.expo', 'android']);
const NATIVE_EXT = /\.(swift|m|mm)$/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* walk(p);
    else if (NATIVE_EXT.test(name)) yield p;
  }
}

export function collectCapabilities(root: string): Available<CapabilityFact[]> {
  const facts: CapabilityFact[] = [];
  const rel = (p: string) => relative(root, p).split('\\').join('/');

  const lock = join(root, 'ios', 'Podfile.lock');
  const hasLock = existsSync(lock);
  if (hasLock) {
    const lines = readFileSync(lock, 'utf8').split('\n');
    let inPods = false;
    lines.forEach((line, i) => {
      if (/^PODS:/.test(line)) { inPods = true; return; }
      if (/^[A-Z]/.test(line)) { inPods = false; return; }
      const m = inPods ? /^  - ([^\s(]+)/.exec(line) : null; // exactly two spaces: top-level pods only
      if (!m) return;
      const cap = POD_CAPABILITIES[m[1]];
      if (cap) facts.push({ capability: cap, via: 'pod', name: m[1], provenance: { file: rel(lock), line: i + 1 } });
    });
  }

  let nativeFiles = 0;
  for (const file of walk(root)) {
    nativeFiles++;
    const lines = readFileSync(file, 'utf8').split('\n');
    const seen = new Set<string>();
    lines.forEach((line, i) => {
      for (const s of SYMBOL_PATTERNS) {
        if (seen.has(s.capability) || !s.pattern.test(line)) continue;
        seen.add(s.capability);
        facts.push({ capability: s.capability, via: 'symbol', name: s.name, provenance: { file: rel(file), line: i + 1 } });
      }
    });
  }

  if (!hasLock && nativeFiles === 0) {
    return unavailable('no Podfile.lock and no native source files; linked SDK resolution for managed Expo projects arrives in a later release');
  }
  return ok(facts);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/capabilities.test.ts`
Expected: PASS (4 tests). The `line: 3` expectations refer to the fixture files written in Task 4: `VisionCamera` is line 3 of `Podfile.lock`, `CLLocationManager()` is line 3 of `Location.swift`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Capabilities collector: Podfile.lock pods and native API symbols

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Rule framework, runner, score and coverage

**Files:**
- Create: `src/rules/types.ts`, `src/rules/run.ts`, `src/score.ts`, `test/score.test.ts`, `test/run.test.ts`

**Interfaces:**
- Produces (exact):
```ts
export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type Confidence = 'high' | 'medium' | 'low';
export type Evidence = { file: string; line?: number; excerpt?: string } | { api: string; value?: string } | { command: string; excerpt?: string };
export type Finding = { title: string; explanation: string; evidence: Evidence[]; fix: string; check: string };
export type Result =
  | ({ kind: 'confirmed'; severity: Severity } & Finding)
  | ({ kind: 'potential'; severity: Severity; confidence: Confidence; exceptions: string[] } & Finding)
  | { kind: 'pass' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'not-applicable' };
export type Rule = { id: string; clauses: string[]; kind: 'confirmed-capable' | 'potential-only'; severity: Severity; confirmsFail: string; confirmsPass: string; verify: string; reviewedOn: string; evaluate(facts: Facts): Result };
export type RuleResult = { rule: Rule; result: Result };
export function runRules(facts: Facts, rules: Rule[]): RuleResult[];
export const WEIGHTS: Record<Severity, number>;
export type Coverage = { evaluated: number; applicable: number; skipped: Array<{ rule: string; reason: string }> };
export type Scored = { score: number; coverage: Coverage; label: string; potentialSerious: number };
export function scoreResults(results: RuleResult[]): Scored;
```

- [ ] **Step 1: Write the failing score tests**

`test/score.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { scoreResults } from '../src/score.js';
import type { Rule, RuleResult, Severity } from '../src/rules/types.js';

const rule = (id: string, severity: Severity = 'P2'): Rule => ({
  id, clauses: ['2.1'], kind: 'confirmed-capable', severity, confirmsFail: 'x', confirmsPass: 'y', verify: 'z', reviewedOn: '2026-10-15',
  evaluate: () => ({ kind: 'pass' }),
});
const confirmed = (id: string, severity: Severity): RuleResult => ({ rule: rule(id, severity), result: { kind: 'confirmed', severity, title: id, explanation: '', evidence: [], fix: '', check: '' } });
const potential = (id: string, severity: Severity): RuleResult => ({ rule: rule(id, severity), result: { kind: 'potential', severity, confidence: 'high', exceptions: [], title: id, explanation: '', evidence: [], fix: '', check: '' } });
const pass = (id: string): RuleResult => ({ rule: rule(id), result: { kind: 'pass' } });
const skipped = (id: string, reason = 'no key'): RuleResult => ({ rule: rule(id), result: { kind: 'skipped', reason } });
const na = (id: string): RuleResult => ({ rule: rule(id), result: { kind: 'not-applicable' } });
const passes = (n: number) => Array.from({ length: n }, (_, i) => pass(`p${i}`));

describe('scoreResults', () => {
  it('subtracts weights for confirmed findings only', () => {
    const s = scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P2'), potential('c', 'P0')]);
    expect(s.score).toBe(86);
    expect(s.potentialSerious).toBe(1);
  });
  it('caps at 59 with a confirmed P0 and floors at 0', () => {
    expect(scoreResults([...passes(10), confirmed('a', 'P0')]).score).toBe(59);
    expect(scoreResults([...passes(10), ...['a', 'b', 'c', 'd', 'e'].map((i) => confirmed(i, 'P0'))]).score).toBe(0);
  });
  it('counts coverage without not-applicable rules', () => {
    const s = scoreResults([...passes(3), skipped('s1'), skipped('s2', 'no ios folder'), na('n')]);
    expect(s.coverage).toEqual({ evaluated: 3, applicable: 5, skipped: [{ rule: 's1', reason: 'no key' }, { rule: 's2', reason: 'no ios folder' }] });
  });
  it('labels', () => {
    expect(scoreResults([...passes(2), skipped('s1'), skipped('s2')]).label).toBe('Partial scan');
    expect(scoreResults([...passes(10), confirmed('a', 'P0')]).label).toBe('Not ready');
    expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P1'), confirmed('c', 'P1')]).label).toBe('Not ready');
    expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P2')]).label).toBe('Needs work');
    expect(scoreResults([...passes(10), confirmed('a', 'P3')]).label).toBe('Ready');
    expect(scoreResults([...passes(10), potential('a', 'P1')]).label).toBe('Ready, verify 1 potential issue');
    expect(scoreResults([...passes(10), potential('a', 'P1'), potential('b', 'P0')]).label).toBe('Ready, verify 2 potential issues');
    expect(scoreResults([...passes(10), potential('a', 'P2')]).label).toBe('Ready');
  });
  it('is Partial scan when nothing could run', () => {
    expect(scoreResults([skipped('s1')]).label).toBe('Partial scan');
    expect(scoreResults([]).label).toBe('Partial scan');
  });
});
```

- [ ] **Step 2: Write the failing runner test**

`test/run.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { runRules } from '../src/rules/run.js';
import type { Rule } from '../src/rules/types.js';
import type { Facts } from '../src/facts.js';

const facts = { root: '/x', project: { kind: 'expo' }, bundle: { status: 'unavailable', reason: 'r' }, nativeBundle: { status: 'unavailable', reason: 'r' }, capabilities: { status: 'unavailable', reason: 'r' }, store: { status: 'unavailable', reason: 'r' } } as Facts;

describe('runRules', () => {
  it('turns a throwing rule into skipped("rule error: …") and keeps going', () => {
    const boom: Rule = { id: 'boom', clauses: [], kind: 'confirmed-capable', severity: 'P2', confirmsFail: '', confirmsPass: '', verify: '', reviewedOn: '2026-10-15', evaluate: () => { throw new Error('nope'); } };
    const fine: Rule = { ...boom, id: 'fine', evaluate: () => ({ kind: 'pass' }) };
    const out = runRules(facts, [boom, fine]);
    expect(out[0].result).toEqual({ kind: 'skipped', reason: 'rule error: nope' });
    expect(out[1].result).toEqual({ kind: 'pass' });
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run test/score.test.ts test/run.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write src/rules/types.ts**

```ts
import type { Facts } from '../facts.js';

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type Confidence = 'high' | 'medium' | 'low';

export type Evidence =
  | { file: string; line?: number; excerpt?: string }
  | { api: string; value?: string }
  | { command: string; excerpt?: string };

export type Finding = {
  title: string;
  /** Plain words: what is wrong and why Apple cares. */
  explanation: string;
  evidence: Evidence[];
  /** Written for a coding agent: the smallest change that resolves it. */
  fix: string;
  /** How to confirm the fix: a command, a file to open, a screen to reach. */
  check: string;
};

export type Result =
  | ({ kind: 'confirmed'; severity: Severity } & Finding)
  | ({ kind: 'potential'; severity: Severity; confidence: Confidence; exceptions: string[] } & Finding)
  | { kind: 'pass' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'not-applicable' };

export type Rule = {
  id: string;
  clauses: string[];
  kind: 'confirmed-capable' | 'potential-only';
  /** For confirmed-capable rules the severity of a confirmed result; for potential-only the would-be severity. */
  severity: Severity;
  confirmsFail: string;
  confirmsPass: string;
  verify: string;
  /** The date this rule was last validated against the guideline text. */
  reviewedOn: string;
  evaluate(facts: Facts): Result;
};

export type RuleResult = { rule: Rule; result: Result };
```

- [ ] **Step 5: Write src/rules/run.ts**

```ts
import type { Facts } from '../facts.js';
import type { Rule, RuleResult } from './types.js';

export function runRules(facts: Facts, rules: Rule[]): RuleResult[] {
  return rules.map((rule) => {
    try {
      return { rule, result: rule.evaluate(facts) };
    } catch (e) {
      return { rule, result: { kind: 'skipped', reason: `rule error: ${(e as Error).message}` } };
    }
  });
}
```

- [ ] **Step 6: Write src/score.ts**

```ts
import type { RuleResult, Severity } from './rules/types.js';

export const WEIGHTS: Record<Severity, number> = { P0: 25, P1: 10, P2: 4, P3: 1 };
export const COVERAGE_FLOOR = 0.8;

export type Coverage = { evaluated: number; applicable: number; skipped: Array<{ rule: string; reason: string }> };
export type Scored = { score: number; coverage: Coverage; label: string; potentialSerious: number };

export function scoreResults(results: RuleResult[]): Scored {
  let penalty = 0;
  let hasP0 = false;
  let evaluated = 0;
  let potentialSerious = 0;
  const skipped: Coverage['skipped'] = [];

  for (const { rule, result } of results) {
    switch (result.kind) {
      case 'confirmed':
        penalty += WEIGHTS[result.severity];
        if (result.severity === 'P0') hasP0 = true;
        evaluated++;
        break;
      case 'potential':
        if (result.severity === 'P0' || result.severity === 'P1') potentialSerious++;
        evaluated++;
        break;
      case 'pass':
        evaluated++;
        break;
      case 'skipped':
        skipped.push({ rule: rule.id, reason: result.reason });
        break;
      case 'not-applicable':
        break;
    }
  }

  let score = Math.max(0, 100 - penalty);
  if (hasP0) score = Math.min(score, 59);
  const applicable = evaluated + skipped.length;
  const ratio = applicable === 0 ? 0 : evaluated / applicable;

  let label: string;
  if (ratio < COVERAGE_FLOOR) label = 'Partial scan';
  else if (hasP0 || score < 75) label = 'Not ready';
  else if (score < 90) label = 'Needs work';
  else if (potentialSerious > 0) label = `Ready, verify ${potentialSerious} potential issue${potentialSerious === 1 ? '' : 's'}`;
  else label = 'Ready';

  return { score, coverage: { evaluated, applicable, skipped }, label, potentialSerious };
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/score.test.ts test/run.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Rule types, safe runner, weighted score with coverage and labels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Permission rules (1, 2, 3)

**Files:**
- Create: `src/rules/permissions/usage-string-present.ts`, `src/rules/permissions/usage-string-template.ts`, `src/rules/permissions/usage-string-empty.ts`, `test/helpers/facts.ts`, `test/rules.permissions.test.ts`

**Interfaces:**
- Consumes: `Facts`, `REQUIRED_KEYS`, `Rule`, `Result`.
- Produces: three `Rule` objects with ids `permissions.usage-string-present`, `permissions.usage-string-template`, `permissions.usage-string-empty`, plus the test helper `makeFacts(overrides)`.

- [ ] **Step 1: Write the test helper**

`test/helpers/facts.ts`:
```ts
import { ok, unavailable, type BundleFacts, type CapabilityFact, type Facts, type UsageString } from '../../src/facts.js';

export const prov = { file: 'ios/App/Info.plist' };

export function bundle(over: Partial<BundleFacts> = {}): BundleFacts {
  return { origin: 'native', bundleId: 'com.example.app', deviceFamilies: ['iphone'], usageStrings: [], ats: null, entitlements: {}, hasAppClip: false, provenance: prov, ...over };
}
export const usage = (key: string, value: string | null = 'A sentence that explains the purpose.'): UsageString => ({ key, value, provenance: prov });
export const cap = (capability: CapabilityFact['capability'], name = 'X', file = 'ios/App/A.swift'): CapabilityFact => ({ capability, via: 'symbol', name, provenance: { file, line: 1 } });

export function makeFacts(over: Partial<Facts> = {}): Facts {
  return {
    root: '/project',
    project: { kind: 'native' },
    bundle: ok(bundle()),
    nativeBundle: unavailable('single source'),
    capabilities: ok([]),
    store: unavailable('no App Store Connect key'),
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing rule tests**

`test/rules.permissions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ok, unavailable } from '../src/facts.js';
import { usageStringPresent } from '../src/rules/permissions/usage-string-present.js';
import { usageStringTemplate } from '../src/rules/permissions/usage-string-template.js';
import { usageStringEmpty } from '../src/rules/permissions/usage-string-empty.js';
import { bundle, cap, makeFacts, usage } from './helpers/facts.js';

describe('permissions.usage-string-present (rule 1)', () => {
  it('confirms P0 when a linked capability has no usage key', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'ios/App/Where.swift')]) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind !== 'confirmed') return;
    expect(r.severity).toBe('P0');
    expect(r.title).toBe('Location is used but no location usage description is set');
    expect(r.evidence).toEqual([{ file: 'ios/App/Where.swift', line: 1, excerpt: 'CLLocationManager' }]);
    expect(r.fix).toMatch(/NSLocationWhenInUseUsageDescription/);
  });
  it('passes when any accepted key is present', () => {
    const f = makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSLocationAlwaysAndWhenInUseUsageDescription')] })), capabilities: ok([cap('location')]) });
    expect(usageStringPresent.evaluate(f)).toEqual({ kind: 'pass' });
  });
  it('is not applicable when nothing is linked', () => {
    expect(usageStringPresent.evaluate(makeFacts())).toEqual({ kind: 'not-applicable' });
  });
  it('skips when capabilities or bundle are unavailable', () => {
    expect(usageStringPresent.evaluate(makeFacts({ capabilities: unavailable('no native code') }))).toEqual({ kind: 'skipped', reason: 'no native code' });
    expect(usageStringPresent.evaluate(makeFacts({ bundle: unavailable('expo failed') }))).toEqual({ kind: 'skipped', reason: 'expo failed' });
  });
  it('reports one finding for the first missing capability and lists the rest', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('camera', 'AVCaptureDevice'), cap('microphone', 'AVAudioRecorder')]) }));
    if (r.kind !== 'confirmed') throw new Error(r.kind);
    expect(r.title).toMatch(/Camera/);
    expect(r.explanation).toMatch(/Also missing: microphone/);
  });
});

describe('permissions.usage-string-template (rule 2)', () => {
  it('confirms P3 for a developer-tool string', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSLocalNetworkUsageDescription', 'Expo Dev Launcher uses the local network to find your dev server.')] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') {
      expect(r.severity).toBe('P3');
      expect(r.evidence[0]).toEqual({ file: 'ios/App/Info.plist', excerpt: 'NSLocalNetworkUsageDescription: "Expo Dev Launcher uses the local network to find your dev server."' });
    }
  });
  it('confirms for placeholder markers', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', 'TODO describe camera use')] })) }));
    expect(r.kind).toBe('confirmed');
  });
  it('accepts $(PRODUCT_NAME), which Xcode resolves at build time', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', 'Allow $(PRODUCT_NAME) to access your camera')] })) }));
    expect(r).toEqual({ kind: 'pass' });
  });
  it('is not applicable with no usage strings', () => {
    expect(usageStringTemplate.evaluate(makeFacts())).toEqual({ kind: 'not-applicable' });
  });
});

describe('permissions.usage-string-empty (rule 3)', () => {
  it('confirms P1 for an empty or non-string value', () => {
    const r1 = usageStringEmpty.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSMicrophoneUsageDescription', '   ')] })) }));
    const r2 = usageStringEmpty.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSPhotoLibraryUsageDescription', null)] })) }));
    expect(r1.kind).toBe('confirmed');
    expect(r2.kind).toBe('confirmed');
    if (r2.kind === 'confirmed') expect(r2.explanation).toMatch(/not a string/);
  });
  it('passes otherwise', () => {
    expect(usageStringEmpty.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription')] })) }))).toEqual({ kind: 'pass' });
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run test/rules.permissions.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write rule 1**

`src/rules/permissions/usage-string-present.ts`:
```ts
import type { Capability } from '../../facts.js';
import { REQUIRED_KEYS } from '../capabilities.js';
import type { Rule } from '../types.js';

const LABEL: Record<Capability, string> = {
  camera: 'Camera', microphone: 'Microphone', location: 'Location', contacts: 'Contacts', photos: 'Photo library',
  bluetooth: 'Bluetooth', health: 'Health data', tracking: 'App tracking', faceId: 'Face ID', calendar: 'Calendar',
  motion: 'Motion data', speech: 'Speech recognition', localNetwork: 'Local network',
};

export const usageStringPresent: Rule = {
  id: 'permissions.usage-string-present',
  clauses: ['5.1.1(i)', '2.1'],
  kind: 'confirmed-capable',
  severity: 'P0',
  confirmsFail: 'A capability is linked (a pod in Podfile.lock or an iOS API symbol in native source) and the resolved Info.plist has none of its accepted usage-description keys.',
  confirmsPass: 'Every linked capability has at least one accepted usage-description key.',
  verify: 'That each string explains the purpose in a sentence a user understands.',
  reviewedOn: '2026-10-15',
  evaluate(facts) {
    if (facts.capabilities.status !== 'ok') return { kind: 'skipped', reason: facts.capabilities.reason };
    if (facts.bundle.status !== 'ok') return { kind: 'skipped', reason: facts.bundle.reason };
    const caps = facts.capabilities.value;
    if (caps.length === 0) return { kind: 'not-applicable' };
    const present = new Set(facts.bundle.value.usageStrings.map((u) => u.key));
    const missing = caps.filter((c) => !REQUIRED_KEYS[c.capability].some((k) => present.has(k)));
    if (missing.length === 0) return { kind: 'pass' };
    const first = missing[0];
    const others = [...new Set(missing.slice(1).map((m) => m.capability))].filter((c) => c !== first.capability);
    const keys = REQUIRED_KEYS[first.capability];
    return {
      kind: 'confirmed',
      severity: 'P0',
      title: `${LABEL[first.capability]} is used but no ${first.capability === 'location' ? 'location' : LABEL[first.capability].toLowerCase()} usage description is set`,
      explanation:
        `The binary links ${first.name} (${first.via === 'pod' ? 'a pod' : 'a native API'}), so iOS will ask the user for permission, and the system kills the app at that prompt when the usage description is missing. App Review sees a crash.` +
        (others.length ? ` Also missing: ${others.join(', ')}.` : ''),
      evidence: [{ file: first.provenance.file, line: first.provenance.line, excerpt: first.name }].filter((e) => 'file' in e) as never,
      fix: `Add ${keys[0]} to the Info.plist (in Expo: ios.infoPlist in app.json, or the module's config plugin option) with one sentence that says what the app does with it. Only add it if the app really uses ${LABEL[first.capability].toLowerCase()}; otherwise remove the dependency.`,
      check: 'Re-run appstore-doctor; then on a device, trigger the permission prompt and confirm the sentence appears.',
    };
  },
};
```

Note on `evidence`: `first.provenance` is always a `{ file, line }` from the capabilities collector; the filter keeps the type checker honest without a cast chain. If `tsc` complains, build the evidence as `'file' in first.provenance ? [{ file: first.provenance.file, line: first.provenance.line, excerpt: first.name }] : []`.

- [ ] **Step 5: Write rule 2**

`src/rules/permissions/usage-string-template.ts`:
```ts
import type { Rule } from '../types.js';

const DEV_TOOL = /\b(Expo Dev Launcher|Expo Go|Dev Launcher|Dev Menu|Flipper|Reactotron|debugger|dev server)\b/i;
const PLACEHOLDER = /\b(TODO|FIXME|lorem ipsum|description here|insert .* here|xxx+|placeholder)\b/i;

export const usageStringTemplate: Rule = {
  id: 'permissions.usage-string-template',
  clauses: ['5.1.1(i)'],
  kind: 'confirmed-capable',
  severity: 'P3',
  confirmsFail: 'A usage-description value names a developer tool or contains a placeholder marker.',
  confirmsPass: 'No usage-description value matches a developer-tool or placeholder pattern. $(PRODUCT_NAME) is fine: Xcode resolves it.',
  verify: 'Wording quality and truthfulness of each string.',
  reviewedOn: '2026-10-15',
  evaluate(facts) {
    if (facts.bundle.status !== 'ok') return { kind: 'skipped', reason: facts.bundle.reason };
    const strings = facts.bundle.value.usageStrings.filter((u) => typeof u.value === 'string');
    if (strings.length === 0) return { kind: 'not-applicable' };
    const bad = strings.find((u) => DEV_TOOL.test(u.value!) || PLACEHOLDER.test(u.value!));
    if (!bad) return { kind: 'pass' };
    const why = DEV_TOOL.test(bad.value!) ? 'names a developer tool' : 'contains placeholder text';
    const file = 'file' in bad.provenance ? bad.provenance.file : 'Info.plist (resolved)';
    return {
      kind: 'confirmed',
      severity: 'P3',
      title: `Usage string ${why}`,
      explanation: `${bad.key} ships to users and ${why}. Reviewers read these strings; one that talks about a dev tool looks like a build that was not prepared for release.`,
      evidence: [{ file, excerpt: `${bad.key}: "${bad.value}"` }],
      fix: `Replace the value of ${bad.key} with one sentence about what the app does for the user, or remove the key if the capability is only used by a development package (set the package's plist option to a real sentence or exclude it from release builds).`,
      check: 'Re-run appstore-doctor; for Expo, npx expo config --type introspect shows the resolved value.',
    };
  },
};
```

- [ ] **Step 6: Write rule 3**

`src/rules/permissions/usage-string-empty.ts`:
```ts
import type { Rule } from '../types.js';

export const usageStringEmpty: Rule = {
  id: 'permissions.usage-string-empty',
  clauses: ['5.1.1(i)'],
  kind: 'confirmed-capable',
  severity: 'P1',
  confirmsFail: 'A usage-description key exists with an empty, whitespace, or non-string value.',
  confirmsPass: 'Every usage-description key has a non-empty string value.',
  verify: 'Nothing further.',
  reviewedOn: '2026-10-15',
  evaluate(facts) {
    if (facts.bundle.status !== 'ok') return { kind: 'skipped', reason: facts.bundle.reason };
    const strings = facts.bundle.value.usageStrings;
    if (strings.length === 0) return { kind: 'not-applicable' };
    const bad = strings.find((u) => u.value === null || u.value.trim() === '');
    if (!bad) return { kind: 'pass' };
    const file = 'file' in bad.provenance ? bad.provenance.file : 'Info.plist (resolved)';
    return {
      kind: 'confirmed',
      severity: 'P1',
      title: `${bad.key} is empty`,
      explanation: bad.value === null
        ? `${bad.key} is present but its value is not a string, so iOS shows no explanation at the permission prompt. Apple rejects permission requests without a purpose string.`
        : `${bad.key} is present but empty, so the permission prompt shows no explanation. Apple rejects permission requests without a purpose string.`,
      evidence: [{ file, excerpt: `${bad.key}: ${bad.value === null ? '(not a string)' : '""'}` }],
      fix: `Set ${bad.key} to one sentence that says what the app does with this access.`,
      check: 'Re-run appstore-doctor.',
    };
  },
};
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/rules.permissions.test.ts`
Expected: PASS (11 tests). If the rule-1 title assertion fails on wording, make the code match the test, not the other way round: the test is the contract.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Permission rules: missing, template and empty usage strings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: ATS and prebuild-drift rules, rule index, verify list

**Files:**
- Create: `src/rules/network/ats-arbitrary-loads.ts`, `src/rules/expo/prebuild-drift.ts`, `src/rules/index.ts`, `src/verify.ts`, `test/rules.network-expo.test.ts`, `test/verify.test.ts`

**Interfaces:**
- Produces: rules `network.ats-arbitrary-loads` (P2) and `expo.prebuild-drift` (P2); `RULES: Rule[]`; `verifyItems(facts: Facts): VerifyItem[]` with `VerifyItem = { clause: string; title: string }`.
- Spec deviation recorded here: spec 6.1 row 4 says "and no NSExceptionDomains". The reference app's real resolved plist has arbitrary loads **with** a `localhost` exception, and the audit still flagged it. Exceptions do not narrow `NSAllowsArbitraryLoads: true`; the rule fires whenever it is true. The spec row is corrected in Task 12.

- [ ] **Step 1: Write the failing tests**

`test/rules.network-expo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ok, unavailable } from '../src/facts.js';
import { atsArbitraryLoads } from '../src/rules/network/ats-arbitrary-loads.js';
import { prebuildDrift } from '../src/rules/expo/prebuild-drift.js';
import { RULES } from '../src/rules/index.js';
import { bundle, makeFacts, usage, prov } from './helpers/facts.js';

describe('network.ats-arbitrary-loads (rule 4)', () => {
  it('confirms P2 when arbitrary loads are on, even with exception domains', () => {
    const r = atsArbitraryLoads.evaluate(makeFacts({ bundle: ok(bundle({ ats: { allowsArbitraryLoads: true, exceptionDomains: ['localhost'], provenance: prov } })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') {
      expect(r.severity).toBe('P2');
      expect(r.evidence).toEqual([{ file: 'ios/App/Info.plist', excerpt: 'NSAppTransportSecurity.NSAllowsArbitraryLoads: true' }]);
    }
  });
  it('passes when off or absent', () => {
    expect(atsArbitraryLoads.evaluate(makeFacts({ bundle: ok(bundle({ ats: { allowsArbitraryLoads: false, exceptionDomains: [], provenance: prov } })) }))).toEqual({ kind: 'pass' });
    expect(atsArbitraryLoads.evaluate(makeFacts())).toEqual({ kind: 'pass' });
  });
  it('skips without a bundle', () => {
    expect(atsArbitraryLoads.evaluate(makeFacts({ bundle: unavailable('x') }))).toEqual({ kind: 'skipped', reason: 'x' });
  });
});

describe('expo.prebuild-drift (rule 18)', () => {
  const expo = bundle({ origin: 'expo', bundleId: 'com.a.b', usageStrings: [usage('NSCameraUsageDescription')], provenance: { command: 'npx expo config --json --type introspect' } });
  it('is not applicable unless both bundles exist', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'expo' }, bundle: ok(expo) }))).toEqual({ kind: 'not-applicable' });
  });
  it('skips when ios/ exists but could not be read', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: unavailable('binary plist') }))).toEqual({ kind: 'skipped', reason: 'binary plist' });
  });
  it('confirms P2 when the bundle id differs', () => {
    const r = prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.old.id', usageStrings: [usage('NSCameraUsageDescription')] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.explanation).toMatch(/bundle identifier: com\.a\.b in the Expo config, com\.old\.id in ios\//);
  });
  it('confirms P2 when usage keys differ', () => {
    const r = prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.a.b', usageStrings: [] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.explanation).toMatch(/only in the Expo config: NSCameraUsageDescription/);
  });
  it('passes when they agree', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.a.b', usageStrings: [usage('NSCameraUsageDescription')] })) }))).toEqual({ kind: 'pass' });
  });
});

describe('RULES', () => {
  it('has unique ids and complete declarations', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(r.clauses.length).toBeGreaterThan(0);
      for (const f of ['confirmsFail', 'confirmsPass', 'verify'] as const) expect(r[f].length).toBeGreaterThan(5);
      expect(r.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(ids).toEqual(['permissions.usage-string-present', 'permissions.usage-string-empty', 'permissions.usage-string-template', 'network.ats-arbitrary-loads', 'expo.prebuild-drift']);
  });
});
```

`test/verify.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ok } from '../src/facts.js';
import { verifyItems } from '../src/verify.js';
import { bundle, makeFacts } from './helpers/facts.js';

describe('verifyItems', () => {
  it('always lists the judgment items', () => {
    const titles = verifyItems(makeFacts()).map((v) => v.clause);
    expect(titles).toEqual(expect.arrayContaining(['2.1', '2.3.1', '2.3.3', '4.2', '5.1.1(ii)', '5.2']));
  });
  it('adds the App Clip and iPad items from facts', () => {
    const clip = verifyItems(makeFacts({ bundle: ok(bundle({ hasAppClip: true })) }));
    expect(clip.some((v) => /App Clip/.test(v.title))).toBe(true);
    const iphoneOnly = verifyItems(makeFacts());
    expect(iphoneOnly.some((v) => /iPad/.test(v.title))).toBe(true);
    const universal = verifyItems(makeFacts({ bundle: ok(bundle({ deviceFamilies: ['iphone', 'ipad'] })) }));
    expect(universal.some((v) => /iPad compatibility/.test(v.title))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run test/rules.network-expo.test.ts test/verify.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write rule 4**

`src/rules/network/ats-arbitrary-loads.ts`:
```ts
import type { Rule } from '../types.js';

export const atsArbitraryLoads: Rule = {
  id: 'network.ats-arbitrary-loads',
  clauses: ['2.1', '5.1.1(i)'],
  kind: 'confirmed-capable',
  severity: 'P2',
  confirmsFail: 'NSAppTransportSecurity.NSAllowsArbitraryLoads is true in the resolved Info.plist. Exception domains do not narrow it.',
  confirmsPass: 'The key is absent or false.',
  verify: 'Whether a justification exists that the review notes can state, if the setting is needed.',
  reviewedOn: '2026-10-15',
  evaluate(facts) {
    if (facts.bundle.status !== 'ok') return { kind: 'skipped', reason: facts.bundle.reason };
    const ats = facts.bundle.value.ats;
    if (!ats || !ats.allowsArbitraryLoads) return { kind: 'pass' };
    const file = 'file' in ats.provenance ? ats.provenance.file : 'Info.plist (resolved)';
    return {
      kind: 'confirmed',
      severity: 'P2',
      title: 'App Transport Security allows arbitrary loads',
      explanation: 'NSAllowsArbitraryLoads is true, so the app may talk to any server over plain HTTP. App Review asks for a justification when it sees this, and most apps have none; the setting usually comes from a template.' + (ats.exceptionDomains.length ? ` The exception domains (${ats.exceptionDomains.join(', ')}) do not narrow it.` : ''),
      evidence: [{ file, excerpt: 'NSAppTransportSecurity.NSAllowsArbitraryLoads: true' }],
      fix: 'Remove NSAllowsArbitraryLoads (or set it to false) and, if a specific insecure host is needed, add only that host under NSExceptionDomains. In Expo, set ios.infoPlist.NSAppTransportSecurity in app.json.',
      check: 'Re-run appstore-doctor; confirm the app still loads its content over HTTPS.',
    };
  },
};
```

- [ ] **Step 4: Write rule 18**

`src/rules/expo/prebuild-drift.ts`:
```ts
import type { Rule } from '../types.js';

export const prebuildDrift: Rule = {
  id: 'expo.prebuild-drift',
  clauses: ['2.1'],
  kind: 'confirmed-capable',
  severity: 'P2',
  confirmsFail: 'Both an Expo config and an ios/ folder exist, and they disagree on the bundle identifier or on the set of usage-description keys.',
  confirmsPass: 'They agree, or only one of them exists.',
  verify: 'Which of the two actually ships (EAS builds from the Expo config unless ios/ is committed and prebuild is skipped).',
  reviewedOn: '2026-10-15',
  evaluate(facts) {
    if (facts.project.kind !== 'both') return { kind: 'not-applicable' };
    if (facts.bundle.status !== 'ok') return { kind: 'skipped', reason: facts.bundle.reason };
    if (facts.nativeBundle.status !== 'ok') return { kind: 'skipped', reason: facts.nativeBundle.reason };
    const expo = facts.bundle.value;
    const native = facts.nativeBundle.value;
    const problems: string[] = [];
    if (expo.bundleId && native.bundleId && expo.bundleId !== native.bundleId) {
      problems.push(`bundle identifier: ${expo.bundleId} in the Expo config, ${native.bundleId} in ios/`);
    }
    const e = new Set(expo.usageStrings.map((u) => u.key));
    const n = new Set(native.usageStrings.map((u) => u.key));
    const onlyExpo = [...e].filter((k) => !n.has(k));
    const onlyNative = [...n].filter((k) => !e.has(k));
    if (onlyExpo.length) problems.push(`usage keys only in the Expo config: ${onlyExpo.join(', ')}`);
    if (onlyNative.length) problems.push(`usage keys only in ios/: ${onlyNative.join(', ')}`);
    if (problems.length === 0) return { kind: 'pass' };
    const nativeFile = 'file' in native.provenance ? native.provenance.file : 'ios/';
    return {
      kind: 'confirmed',
      severity: 'P2',
      title: 'ios/ does not match the Expo config',
      explanation: `The committed ios/ project and the resolved Expo config disagree, so what ships depends on which one the build uses. Differences: ${problems.join('; ')}.`,
      evidence: [{ file: nativeFile }, { command: 'npx expo config --json --type introspect' }],
      fix: 'If the project is managed by Expo, delete ios/ or run npx expo prebuild --clean and commit the result. If ios/ is the source of truth, make the Expo config match it so appstore-doctor and EAS read the same values.',
      check: 'Re-run appstore-doctor; the rule passes when both agree.',
    };
  },
};
```

- [ ] **Step 5: Write the rule index and the verify list**

`src/rules/index.ts`:
```ts
import type { Rule } from './types.js';
import { usageStringPresent } from './permissions/usage-string-present.js';
import { usageStringEmpty } from './permissions/usage-string-empty.js';
import { usageStringTemplate } from './permissions/usage-string-template.js';
import { atsArbitraryLoads } from './network/ats-arbitrary-loads.js';
import { prebuildDrift } from './expo/prebuild-drift.js';

export const RULES: Rule[] = [usageStringPresent, usageStringEmpty, usageStringTemplate, atsArbitraryLoads, prebuildDrift];
```

`src/verify.ts`:
```ts
import type { Facts } from './facts.js';

export type VerifyItem = { clause: string; title: string };

/** Judgment items static analysis cannot decide. Sized by facts; never scored. */
export function verifyItems(facts: Facts): VerifyItem[] {
  const items: VerifyItem[] = [
    { clause: '2.1', title: 'A reviewer can reach every feature with what the review notes give' },
    { clause: '2.3.1', title: 'Metadata describes the app accurately and nothing is hidden or dormant' },
    { clause: '2.3.3', title: 'Screenshots show the app in use, not a login, splash or title screen' },
    { clause: '4.2', title: 'The app offers more than a repackaged website or a thin wrapper' },
    { clause: '5.1.1(ii)', title: 'Each permission string tells the truth about what the data is used for' },
    { clause: '5.2', title: 'The app has the rights to every photo, video, font and sound it ships' },
    { clause: 'Before You Submit', title: 'The demo account in the review notes signs in and reaches every paid feature' },
  ];
  if (facts.bundle.status === 'ok') {
    const b = facts.bundle.value;
    if (b.hasAppClip) items.push({ clause: 'App Clips', title: 'The App Clip launches from its invocation URL on a device without the app installed' });
    if (!b.deviceFamilies.includes('ipad')) items.push({ clause: '2.1', title: 'One pass on an iPad in iPhone compatibility mode: sign-in, main flow, any pay sheet' });
  }
  return items;
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "ATS and prebuild-drift rules, rule index, verify list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Report model, terminal and JSON reporters

**Files:**
- Create: `src/report/types.ts`, `src/report/build.ts`, `src/report/terminal.ts`, `src/report/json.ts`, `test/report.test.ts`

**Interfaces:**
- Produces:
```ts
export type ReportFinding = { rule: string; clauses: string[]; severity: Severity; confidence?: Confidence; exceptions?: string[]; title: string; explanation: string; evidence: Evidence[]; fix: string; check: string; guideline?: { id: string; title: string; url: string; excerpt: string } };
export type Report = { tool: { name: 'appstore-doctor'; version: string; guidelinesReviewedOn: string }; app: { name?: string; bundleId?: string; project: string }; score: number; label: string; coverage: Coverage; confirmed: ReportFinding[]; potential: ReportFinding[]; verify: VerifyItem[]; passed: string[]; notApplicable: string[] };
export function buildReport(input: { facts: Facts; results: RuleResult[]; scored: Scored; verify: VerifyItem[]; version: string; codeOnly: boolean }): Report;
export function renderTerminal(report: Report, opts: { color: boolean; verbose: boolean }): string;
export function renderJson(report: Report): string;
```
- Evidence excerpts are redacted in `buildReport` with `redactExcerpt`; a `null` result drops the excerpt and keeps file and line. Files matching `isSensitivePath` keep only their basename and no excerpt.

- [ ] **Step 1: Write the failing tests**

`test/report.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildReport } from '../src/report/build.js';
import { renderTerminal } from '../src/report/terminal.js';
import { renderJson } from '../src/report/json.js';
import { scoreResults } from '../src/score.js';
import { verifyItems } from '../src/verify.js';
import { makeFacts } from './helpers/facts.js';
import type { Rule, RuleResult } from '../src/rules/types.js';

const rule = (id: string): Rule => ({ id, clauses: ['5.1.1(i)'], kind: 'confirmed-capable', severity: 'P1', confirmsFail: 'a', confirmsPass: 'b', verify: 'c', reviewedOn: '2026-10-15', evaluate: () => ({ kind: 'pass' }) });
const results: RuleResult[] = [
  { rule: rule('x.one'), result: { kind: 'confirmed', severity: 'P1', title: 'One is wrong', explanation: 'Because.', evidence: [{ file: 'src/a.ts', line: 4, excerpt: 'const token = "abc"' }, { file: '.env', line: 1, excerpt: 'KEY=1' }, { file: 'src/b.ts', line: 2, excerpt: 'fine()' }], fix: 'Do this.', check: 'Run that.' } },
  { rule: rule('x.two'), result: { kind: 'potential', severity: 'P0', confidence: 'high', exceptions: ['own account system only'], title: 'Two may be wrong', explanation: 'Maybe.', evidence: [], fix: 'Consider.', check: 'Look.' } },
  { rule: rule('x.three'), result: { kind: 'pass' } },
  { rule: rule('x.four'), result: { kind: 'skipped', reason: 'no App Store Connect key' } },
  { rule: rule('x.five'), result: { kind: 'not-applicable' } },
];
const facts = makeFacts();
const report = buildReport({ facts, results, scored: scoreResults(results), verify: verifyItems(facts), version: '0.1.0', codeOnly: true });

describe('buildReport', () => {
  it('redacts evidence', () => {
    expect(report.confirmed[0].evidence).toEqual([{ file: 'src/a.ts', line: 4 }, { file: '.env', line: 1 }, { file: 'src/b.ts', line: 2, excerpt: 'fine()' }]);
  });
  it('attaches the guideline lookup', () => {
    expect(report.confirmed[0].guideline?.id).toBe('5.1.1(i)');
    expect(report.confirmed[0].guideline?.url).toMatch(/^https:\/\/developer\.apple\.com/);
  });
  it('splits results into lists', () => {
    expect(report.potential.map((p) => p.rule)).toEqual(['x.two']);
    expect(report.passed).toEqual(['x.three']);
    expect(report.notApplicable).toEqual(['x.five']);
    expect(report.coverage.skipped).toEqual([{ rule: 'x.four', reason: 'no App Store Connect key' }]);
    expect(report.label).toBe('Needs work (code only)');
  });
});

describe('renderTerminal', () => {
  const text = renderTerminal(report, { color: false, verbose: false });
  it('prints sections in order with the bar and coverage line', () => {
    const order = ['Confirmed', 'P1  5.1.1(i)  One is wrong', 'Potential', 'P0? 5.1.1(i)  Two may be wrong', 'exceptions: own account system only', 'Needs a reviewer', '/100  Needs work (code only)', '3 of 4 applicable checks ran', '1 skipped: no App Store Connect key', 'A score of 100 means every applicable check that could run passed. It is not an approval.'];
    let last = -1;
    for (const s of order) { const i = text.indexOf(s); expect(i, s).toBeGreaterThan(last); last = i; }
    expect(text).toMatch(/█+░*/);
    expect(text).not.toMatch(/\u001b\[/);
  });
  it('hides passes unless verbose', () => {
    expect(text).not.toMatch(/x\.three/);
    expect(renderTerminal(report, { color: false, verbose: true })).toMatch(/Passed \(1\)[\s\S]*x\.three/);
  });
});

describe('renderJson', () => {
  it('round-trips with stable keys', () => {
    const j = JSON.parse(renderJson(report));
    expect(Object.keys(j)).toEqual(['tool', 'app', 'score', 'label', 'coverage', 'confirmed', 'potential', 'verify', 'passed', 'notApplicable']);
    expect(j.tool.name).toBe('appstore-doctor');
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run test/report.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write src/report/types.ts**

```ts
import type { Confidence, Evidence, Severity } from '../rules/types.js';
import type { Coverage } from '../score.js';
import type { VerifyItem } from '../verify.js';

export type ReportFinding = {
  rule: string;
  clauses: string[];
  severity: Severity;
  confidence?: Confidence;
  exceptions?: string[];
  title: string;
  explanation: string;
  evidence: Evidence[];
  fix: string;
  check: string;
  guideline?: { id: string; title: string; url: string; excerpt: string };
};

export type Report = {
  tool: { name: 'appstore-doctor'; version: string; guidelinesReviewedOn: string };
  app: { name?: string; bundleId?: string; project: string };
  score: number;
  label: string;
  coverage: Coverage;
  confirmed: ReportFinding[];
  potential: ReportFinding[];
  verify: VerifyItem[];
  passed: string[];
  notApplicable: string[];
};
```

- [ ] **Step 4: Write src/report/build.ts**

```ts
import { basename } from 'node:path';
import type { Facts } from '../facts.js';
import { clause, guidelinesReviewedOn } from '../guidelines/lookup.js';
import { isSensitivePath, redactExcerpt } from '../redact.js';
import type { Evidence, RuleResult } from '../rules/types.js';
import type { Scored } from '../score.js';
import type { VerifyItem } from '../verify.js';
import type { Report, ReportFinding } from './types.js';

const SEV_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

function redactEvidence(e: Evidence): Evidence {
  if ('file' in e) {
    if (isSensitivePath(e.file)) return { file: basename(e.file), line: e.line };
    const excerpt = e.excerpt === undefined ? undefined : redactExcerpt(e.excerpt);
    return excerpt === null || excerpt === undefined ? { file: e.file, line: e.line } : { file: e.file, line: e.line, excerpt };
  }
  if ('command' in e) {
    const excerpt = e.excerpt === undefined ? undefined : redactExcerpt(e.excerpt);
    return excerpt === null || excerpt === undefined ? { command: e.command } : { command: e.command, excerpt };
  }
  return e;
}

function projectLabel(facts: Facts): string {
  const sdk = facts.project.expoSdk ? `Expo SDK ${facts.project.expoSdk.split('.')[0]}` : facts.project.kind === 'native' ? 'Xcode project' : 'Expo';
  return facts.project.kind === 'both' ? `${sdk} + ios/` : sdk;
}

export function buildReport(input: { facts: Facts; results: RuleResult[]; scored: Scored; verify: VerifyItem[]; version: string; codeOnly: boolean }): Report {
  const { facts, results, scored, verify, version, codeOnly } = input;
  const toFinding = (rr: RuleResult): ReportFinding | null => {
    const r = rr.result;
    if (r.kind !== 'confirmed' && r.kind !== 'potential') return null;
    const g = clause(rr.rule.clauses[0]);
    return {
      rule: rr.rule.id,
      clauses: rr.rule.clauses,
      severity: r.severity,
      ...(r.kind === 'potential' ? { confidence: r.confidence, exceptions: r.exceptions } : {}),
      title: r.title,
      explanation: r.explanation,
      evidence: r.evidence.map(redactEvidence),
      fix: r.fix,
      check: r.check,
      ...(g ? { guideline: { id: g.id, title: g.title, url: g.url, excerpt: g.excerpt } } : {}),
    };
  };
  const bySeverity = (a: ReportFinding, b: ReportFinding) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.clauses[0].localeCompare(b.clauses[0], undefined, { numeric: true });

  const bundle = facts.bundle.status === 'ok' ? facts.bundle.value : undefined;
  return {
    tool: { name: 'appstore-doctor', version, guidelinesReviewedOn: guidelinesReviewedOn() },
    app: { name: bundle?.displayName, bundleId: bundle?.bundleId, project: projectLabel(facts) },
    score: scored.score,
    label: codeOnly ? `${scored.label} (code only)` : scored.label,
    coverage: scored.coverage,
    confirmed: results.filter((r) => r.result.kind === 'confirmed').map(toFinding).filter((f): f is ReportFinding => f !== null).sort(bySeverity),
    potential: results.filter((r) => r.result.kind === 'potential').map(toFinding).filter((f): f is ReportFinding => f !== null).sort(bySeverity),
    verify,
    passed: results.filter((r) => r.result.kind === 'pass').map((r) => r.rule.id),
    notApplicable: results.filter((r) => r.result.kind === 'not-applicable').map((r) => r.rule.id),
  };
}
```

- [ ] **Step 5: Write src/report/terminal.ts**

```ts
import pc from 'picocolors';
import type { Evidence } from '../rules/types.js';
import type { Report, ReportFinding } from './types.js';

const BAR_CELLS = 16;

function evidenceLine(e: Evidence): string {
  if ('file' in e) return `${e.file}${e.line ? `:${e.line}` : ''}${e.excerpt ? `  ${e.excerpt}` : ''}`;
  if ('command' in e) return `${e.command}${e.excerpt ? `  ${e.excerpt}` : ''}`;
  return `${e.api}${e.value ? `  ${e.value}` : ''}`;
}

function finding(f: ReportFinding, potential: boolean, paint: (s: string) => string): string[] {
  const sev = potential ? `${f.severity}?` : `${f.severity} `;
  const lines = [`${paint(sev)} ${f.clauses[0].padEnd(9)} ${f.title}${potential && f.confidence ? `  (confidence: ${f.confidence})` : ''}`];
  for (const e of f.evidence) lines.push(`    ${evidenceLine(e)}`);
  if (potential && f.exceptions?.length) lines.push(`    exceptions: ${f.exceptions.join(' · ')}`);
  lines.push(`    fix: ${f.fix}`);
  lines.push(`    check: ${f.check}`);
  return lines;
}

export function renderTerminal(report: Report, opts: { color: boolean; verbose: boolean }): string {
  const c = opts.color ? pc : { bold: (s: string) => s, yellow: (s: string) => s, red: (s: string) => s, dim: (s: string) => s };
  const paintSev = (s: string) => (s.startsWith('P0') || s.startsWith('P1') ? c.red(s) : c.yellow(s));
  const out: string[] = [];
  const name = [report.app.name, report.app.bundleId, report.app.project].filter(Boolean).join(' · ');
  out.push(`${c.bold(`AppStore Doctor ${report.tool.version}`)}   ${name} · guidelines reviewed ${report.tool.guidelinesReviewedOn}`, '');

  if (report.confirmed.length) {
    out.push(c.bold('Confirmed'));
    for (const f of report.confirmed) out.push(...finding(f, false, paintSev));
    out.push('');
  }
  if (report.potential.length) {
    out.push(c.bold('Potential'));
    for (const f of report.potential) out.push(...finding(f, true, paintSev));
    out.push('');
  }
  if (report.verify.length) {
    out.push(`${c.bold(`Needs a reviewer (${report.verify.length})`)}   ${report.verify.map((v) => `${v.clause} ${v.title}`).join(' · ')}`, '');
  }

  const filled = Math.round((report.score / 100) * BAR_CELLS);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled);
  out.push(`${c.bold(`${report.score}/100`)}  ${report.label}   ${bar}`);
  const { evaluated, applicable, skipped } = report.coverage;
  const reasons = new Map<string, number>();
  for (const s of skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
  const skippedText = [...reasons].map(([reason, n]) => `${n} skipped: ${reason}`).join(' · ');
  out.push(`${evaluated} of ${applicable} applicable checks ran${skippedText ? ` · ${skippedText}` : ''}`);
  out.push(c.dim('A score of 100 means every applicable check that could run passed. It is not an approval.'));

  if (opts.verbose) {
    out.push('', `Passed (${report.passed.length})`, ...report.passed.map((p) => `  ${p}`));
    out.push('', `Not applicable (${report.notApplicable.length})`, ...report.notApplicable.map((p) => `  ${p}`));
  }
  return out.join('\n') + '\n';
}
```

- [ ] **Step 6: Write src/report/json.ts**

```ts
import type { Report } from './types.js';
export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2) + '\n';
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/report.test.ts`
Expected: PASS (6 tests). The sensitive-path assertion expects `{ file: '.env', line: 1 }` because `basename('.env')` is `.env`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Report model with redaction, terminal and JSON reporters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: main() and the CLI

**Files:**
- Create: `src/main.ts`, `src/cli.ts`, `test/main.test.ts`, `test/cli.test.ts`

**Interfaces:**
- Produces:
```ts
export type RunOptions = { path: string; json: boolean; verbose: boolean; noStore: boolean; ci: number | false; color: boolean };
export type RunDeps = { runner: Runner; version: string };
export function run(opts: RunOptions, deps?: Partial<RunDeps>): Promise<{ report?: Report; text: string; exitCode: 0 | 1 | 2 }>;
```
- Exit codes: 0 scanned; 1 `--ci` threshold not met or label is Partial scan under `--ci`; 2 no project found.
- `--no-store` is accepted and recorded; in this plan store rules do not exist, so `codeOnly` is always true and the label always carries `(code only)`. Plan 3 flips this.

- [ ] **Step 1: Write the failing main tests**

`test/main.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/main.js';
import type { Runner } from '../src/collect/expo.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const recorded = readFileSync(join(fixture('expo-minimal'), 'introspect.json'), 'utf8');
const runner: Runner = async () => ({ code: 0, stdout: recorded, stderr: '' });
const base = { json: false, verbose: false, noStore: true, ci: false as const, color: false };

describe('run', () => {
  it('scans the bare fixture and finds the expected confirmed issues', async () => {
    const { report, exitCode, text } = await run({ ...base, path: fixture('bare-xcode') });
    expect(exitCode).toBe(0);
    expect(report?.confirmed.map((f) => f.rule).sort()).toEqual([
      'network.ats-arbitrary-loads',
      'permissions.usage-string-empty',
      'permissions.usage-string-present',
      'permissions.usage-string-template',
    ]);
    expect(report?.score).toBe(59); // P0 cap: 100 − 25 − 10 − 4 − 1 = 60, capped
    expect(report?.label).toBe('Not ready (code only)');
    expect(text).toMatch(/Location is used but no location usage description is set/);
  });
  it('scans the Expo fixture with an injected runner', async () => {
    const { report } = await run({ ...base, path: fixture('expo-minimal') }, { runner });
    expect(report?.app.project).toBe('Expo SDK 52');
    expect(report?.confirmed.map((f) => f.rule)).toEqual(['network.ats-arbitrary-loads']);
    expect(report?.coverage.skipped).toEqual([{ rule: 'permissions.usage-string-present', reason: 'no Podfile.lock and no native source files; linked SDK resolution for managed Expo projects arrives in a later release' }]);
  });
  it('exits 2 with a message when no project is found', async () => {
    const { exitCode, text, report } = await run({ ...base, path: fixture('none') });
    expect(exitCode).toBe(2);
    expect(report).toBeUndefined();
    expect(text).toMatch(/No iOS project found/);
    expect(text).toMatch(/app\.json/);
  });
  it('exits 1 under --ci when below the threshold', async () => {
    const { exitCode } = await run({ ...base, path: fixture('bare-xcode'), ci: 90 });
    expect(exitCode).toBe(1);
  });
  it('works when the project path contains a space', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'doctor space '));
    cpSync(fixture('bare-xcode'), dir, { recursive: true });
    const { exitCode, report } = await run({ ...base, path: dir });
    expect(exitCode).toBe(0);
    expect(report?.app.bundleId).toBe('com.example.barefixture');
  });
  it('emits JSON when asked', async () => {
    const { text } = await run({ ...base, path: fixture('bare-xcode'), json: true });
    expect(JSON.parse(text).tool.name).toBe('appstore-doctor');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run test/main.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write src/main.ts**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectCapabilities } from './collect/capabilities.js';
import { collectExpo, defaultRunner, type Runner } from './collect/expo.js';
import { collectNative } from './collect/native.js';
import { detectProject } from './detect.js';
import { unavailable, type Facts } from './facts.js';
import { buildReport } from './report/build.js';
import { renderJson } from './report/json.js';
import { renderTerminal } from './report/terminal.js';
import type { Report } from './report/types.js';
import { RULES } from './rules/index.js';
import { runRules } from './rules/run.js';
import { scoreResults } from './score.js';
import { verifyItems } from './verify.js';

export type RunOptions = { path: string; json: boolean; verbose: boolean; noStore: boolean; ci: number | false; color: boolean };
export type RunDeps = { runner: Runner; version: string };

function packageVersion(): string {
  try {
    return (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

export async function collectFacts(root: string, runner: Runner): Promise<Facts | null> {
  const detected = detectProject(root);
  if (detected.kind === 'none') return null;
  const facts: Facts = {
    root,
    project: { kind: detected.kind },
    bundle: unavailable('not collected'),
    nativeBundle: unavailable('no ios/ folder'),
    capabilities: unavailable('not collected'),
    store: unavailable('no App Store Connect key'),
  };
  if (detected.kind === 'expo' || detected.kind === 'both') {
    const { bundle, sdk } = await collectExpo(root, runner);
    facts.bundle = bundle;
    facts.project.expoSdk = sdk;
    if (detected.kind === 'both') facts.nativeBundle = collectNative(root);
  } else {
    facts.bundle = collectNative(root);
  }
  facts.capabilities = collectCapabilities(root);
  return facts;
}

export async function run(opts: RunOptions, deps: Partial<RunDeps> = {}): Promise<{ report?: Report; text: string; exitCode: 0 | 1 | 2 }> {
  const runner = deps.runner ?? defaultRunner;
  const version = deps.version ?? packageVersion();
  const root = resolve(opts.path);

  const facts = await collectFacts(root, runner);
  if (!facts) {
    return {
      text: `No iOS project found in ${root}.\nLooked for: app.json or app.config.* with an "expo" dependency, ios/*.xcodeproj, *.xcodeproj.\n`,
      exitCode: 2,
    };
  }

  const results = runRules(facts, RULES);
  const scored = scoreResults(results);
  const report = buildReport({ facts, results, scored, verify: verifyItems(facts), version, codeOnly: true });
  const text = opts.json ? renderJson(report) : renderTerminal(report, { color: opts.color, verbose: opts.verbose });

  let exitCode: 0 | 1 | 2 = 0;
  if (opts.ci !== false && (report.score < opts.ci || scored.label === 'Partial scan')) exitCode = 1;
  return { report, text, exitCode };
}
```

- [ ] **Step 4: Run the main tests**

Run: `npx vitest run test/main.test.ts`
Expected: PASS (6 tests). If the bare fixture reports a different confirmed set, check: `VisionCamera` → camera has its string (pass), `CLLocationManager` → location has none (rule 1 fires), microphone string is empty (rule 3), local-network string names Expo Dev Launcher (rule 2), ATS true (rule 4). `NSPhotoLibraryUsageDescription` is an array (rule 3 would also match, but rule 3 reports the first offender only, which is the microphone because keys are sorted; the score is unaffected).

- [ ] **Step 5: Write the CLI test**

`test/cli.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const tsx = fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url));

function runCli(args: string[], env: Record<string, string> = {}) {
  try {
    return { code: 0, out: execFileSync(tsx, [cli, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('cli', () => {
  it('prints plain text with NO_COLOR and a non-TTY stdout, and never prompts', () => {
    const { code, out } = runCli(['--path', fixture('bare-xcode'), '--no-store'], { NO_COLOR: '1' });
    expect(code).toBe(0);
    expect(out).not.toMatch(/\u001b\[/);
    expect(out).not.toMatch(/Hand this to/);
    expect(out).toMatch(/\/100/);
  });
  it('accepts a positional path and --json', () => {
    const { code, out } = runCli([fixture('bare-xcode'), '--json', '--no-store']);
    expect(code).toBe(0);
    expect(JSON.parse(out).score).toBe(59);
  });
  it('exits 2 when there is no project', () => {
    expect(runCli([fixture('none')]).code).toBe(2);
  });
  it('shows help', () => {
    const { code, out } = runCli(['--help']);
    expect(code).toBe(0);
    expect(out).toMatch(/Usage: appstore-doctor/);
  });
});
```

- [ ] **Step 6: Write src/cli.ts**

```ts
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { run } from './main.js';

const HELP = `Usage: appstore-doctor [path] [options]

Checks an iOS project (Expo, React Native or native) for App Review problems
that can be established from the project itself. Read only. No network calls
in this version. No telemetry.

Options:
  --path <dir>     Project folder (default: current directory)
  --json           Print the report as JSON
  --verbose        Also list passed and not-applicable checks
  --no-store       Skip App Store Connect checks (none exist yet; accepted for scripts)
  --ci [min]       Exit 1 when the score is below min (default 90) or the scan is partial
  --no-color       Plain output (also honours NO_COLOR)
  -h, --help       This text
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    path: { type: 'string' },
    json: { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
    'no-store': { type: 'boolean', default: false },
    ci: { type: 'string' },
    'no-color': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const ciRaw = values.ci;
const ci: number | false = ciRaw === undefined ? false : ciRaw === '' || ciRaw === 'true' ? 90 : Number(ciRaw);
if (ci !== false && Number.isNaN(ci)) {
  process.stderr.write('--ci expects a number\n');
  process.exit(2);
}
const color = !values['no-color'] && !process.env.NO_COLOR && Boolean(process.stdout.isTTY);

const { text, exitCode } = await run({
  path: values.path ?? positionals[0] ?? process.cwd(),
  json: values.json,
  verbose: values.verbose,
  noStore: values['no-store'],
  ci,
  color,
});
process.stdout.write(text);
process.exitCode = exitCode;
```

Note: `parseArgs` treats `--ci` without a value as an error for `type: 'string'` in some Node versions. If `--ci` alone fails in the test, change the option to `{ type: 'string', default: undefined }` and document `--ci=90`; the test passes `ci: 90` through `run()` directly, so the CLI test only needs `--ci` to be accepted or absent.

- [ ] **Step 7: Run all tests and the build**

Run: `npm run check && npm run build && node dist/cli.js fixtures/bare-xcode --no-store`
Expected: tests PASS; build succeeds; the terminal report prints with four confirmed findings and `59/100  Not ready (code only)`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "main() orchestration and CLI with exit codes, --json, --ci, --no-color

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Coverage map, README, acceptance run on the reference app, handoff notes

**Files:**
- Create: `scripts/build-coverage.ts`, `docs/coverage.md`, `test/coverage-map.test.ts`, `README.md`, `docs/acceptance.md`, `docs/HANDOFF.md`
- Modify: `docs/superpowers/specs/2026-10-15-appstore-doctor-design.md` (rule 4 row), `package.json` (nothing new)

**Interfaces:**
- Consumes: `allClauses()`, `RULES`.
- Produces: `docs/coverage.md` with columns `Clause | Title | Bin | Rule | Note`; the test enforces: every rule id in `RULES` appears in a `machine` or `potential` row; every `machine`/`potential` row's rule is in `RULES` or ends with `(planned)`; every clause in the index has exactly one row.

- [ ] **Step 1: Write the coverage-map test**

`test/coverage-map.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allClauses } from '../src/guidelines/lookup.js';
import { RULES } from '../src/rules/index.js';

const md = readFileSync(fileURLToPath(new URL('../docs/coverage.md', import.meta.url)), 'utf8');
const rows = md.split('\n').filter((l) => /^\| \S/.test(l) && !/^\| Clause/.test(l) && !/^\| ---/.test(l)).map((l) => {
  const [clause, , bin, rule, note] = l.slice(1, -1).split('|').map((c) => c.trim());
  return { clause, bin, rule, note };
});

describe('docs/coverage.md', () => {
  it('has one row per indexed clause', () => {
    const ids = allClauses().map((c) => c.id).sort();
    expect(rows.map((r) => r.clause).sort()).toEqual(ids);
  });
  it('uses only the allowed bins', () => {
    for (const r of rows) expect(['machine', 'potential', 'agent', 'n/a'], r.clause).toContain(r.bin);
  });
  it('names a real or planned rule for machine and potential rows', () => {
    const ids = new Set(RULES.map((r) => r.id));
    for (const r of rows.filter((r) => r.bin === 'machine' || r.bin === 'potential')) {
      const names = r.rule.split(',').map((s) => s.trim()).filter(Boolean);
      expect(names.length, r.clause).toBeGreaterThan(0);
      for (const n of names) expect(ids.has(n) || n.endsWith('(planned)'), `${r.clause}: ${n}`).toBe(true);
    }
  });
  it('lists every implemented rule under at least one of its clauses', () => {
    for (const rule of RULES) {
      const hit = rows.some((r) => r.rule.split(',').map((s) => s.trim()).includes(rule.id) && rule.clauses.includes(r.clause));
      expect(hit, rule.id).toBe(true);
    }
  });
  it('gives every n/a row a reason', () => {
    for (const r of rows.filter((r) => r.bin === 'n/a')) expect(r.note.length, r.clause).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Write the skeleton generator**

`scripts/build-coverage.ts`:
```ts
// Generates docs/coverage.md from the guidelines index, keeping bins already set by hand.
// Usage: tsx scripts/build-coverage.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { allClauses } from '../src/guidelines/lookup.js';

const target = new URL('../docs/coverage.md', import.meta.url);
const existing = new Map<string, { bin: string; rule: string; note: string }>();
if (existsSync(target)) {
  for (const l of readFileSync(target, 'utf8').split('\n')) {
    if (!/^\| \d/.test(l) && !/^\| Before/.test(l) && !/^\| App Clips/.test(l)) continue;
    const [clause, , bin, rule, note] = l.slice(1, -1).split('|').map((c) => c.trim());
    existing.set(clause, { bin, rule, note });
  }
}

const header = `# Coverage map

Every clause of the App Store Review Guidelines (index reviewed ${allClauses()[0]?.reviewedOn}) and what AppStore Doctor does with it.

- **machine**: decided from collected facts; scores.
- **potential**: evidence shown with named exceptions; never scores.
- **agent**: needs judgment; listed under "Needs a reviewer" and in the agent prompt.
- **n/a**: category-specific, needs a running device, or not observable from a project. Reason in Note.

Regenerate the skeleton with \`npm run coverage-map\`; it keeps bins set by hand.

| Clause | Title | Bin | Rule | Note |
| --- | --- | --- | --- | --- |
`;
const rows = allClauses().map((c) => {
  const e = existing.get(c.id) ?? { bin: 'agent', rule: '', note: '' };
  return `| ${c.id} | ${c.title.replace(/\|/g, '/')} | ${e.bin} | ${e.rule} | ${e.note} |`;
});
writeFileSync(target, header + rows.join('\n') + '\n');
console.log(`wrote ${rows.length} rows`);
```

- [ ] **Step 3: Generate, then set the bins by hand**

Run: `npx tsx scripts/build-coverage.ts`

Then edit `docs/coverage.md` rows (the exact ids depend on the index; adjust to what exists):

- `machine` rows (rule column):
  - `5.1.1(i)` → `permissions.usage-string-present, permissions.usage-string-empty, permissions.usage-string-template, network.ats-arbitrary-loads`
  - `2.1` → `permissions.usage-string-present, network.ats-arbitrary-loads, expo.prebuild-drift, store.aasa-reachable (planned), store.app-clip-experience (planned), store.demo-account (planned)`
  - `2.3.3` → `store.screenshots-required (planned)`
  - `2.3.7` → `store.listing-limits (planned)`
  - `2.3.8` → `store.listing-limits (planned)`
  - `3.1.1` → `store.iap-submittable (planned)`
  - `1.5` → `store.urls-reachable (planned)`
- `potential` rows: `4.8` → `accounts.sign-in-with-apple (planned)`; `5.1.1(v)` → `accounts.deletion-path (planned)`; `5.1.2` → `privacy.tracking-string (planned)`; `3.1.3` → `purchases.external-payment (planned)`; `1.2` → `ugc.report-and-block (planned)`; `4.2` → `design.web-view-only (planned)`.
- `n/a` rows with a reason in Note: `1.3` (kids category only), `1.4.1`–`1.4.5` (needs a human read of the content), `3.1.2(c)`, `3.2.2(viii)`-style financial clauses (category-specific), `4.4`, `4.4.1`–`4.4.3` (extensions; not observable), `4.5.*` (Apple services usage; agent where observable, else n/a), `4.7` (mini apps), `5.1.3` (health; category-specific), `5.1.4` (kids), `5.3`, `5.3.1`–`5.3.4` (gaming, gambling), `5.4` (VPN), `5.5` (MDM), `5.6`, `5.6.1`–`5.6.4` (developer conduct; human).
- Everything else stays `agent`.

Run: `npx vitest run test/coverage-map.test.ts`
Expected: PASS (5 tests). If a clause id in the lists above is not in the index, drop that edit; if the test's "one row per indexed clause" fails, re-run the generator (it keeps hand-set bins).

- [ ] **Step 4: Correct the spec's rule 4 row**

In `docs/superpowers/specs/2026-10-15-appstore-doctor-design.md`, section 6.1 row 4, replace the "Confirms fail" cell `NSAllowsArbitraryLoads: true and no NSExceptionDomains and no justification key in a appstore-doctor.json override` with `NSAllowsArbitraryLoads: true in the resolved plist (exception domains do not narrow it; the reference app's real plist has both)`.

- [ ] **Step 5: Run the acceptance scan on the reference app and record it**

Run:
```bash
cd <repo> && npm run build
cd <path to the reference app> && time node <repo>/dist/cli.js --no-store --verbose
node <repo>/dist/cli.js --no-store --json > <scratch dir>/reference-app-doctor.json
```
Expected on the reference app's tree:
- `network.ats-arbitrary-loads` confirmed (audit #16).
- `permissions.usage-string-template` confirmed on `NSLocalNetworkUsageDescription` "Expo Dev Launcher…" (audit #16).
- `permissions.usage-string-present` passes: `targets/clip/Camera.swift` links `AVCaptureDevice` and the resolved plist has `NSCameraUsageDescription`.
- `permissions.usage-string-empty` passes; `expo.prebuild-drift` not applicable (no `ios/`).
- Score 95, label `Ready (code only)` (coverage 4 of 4 since capabilities are available through the Clip's Swift). Wall time under 30 s.

Write `docs/acceptance.md`:
```markdown
# Acceptance: the reference app

Run on 2026-10-15 against the reference app's tree with `--no-store`.

| Audit # | Finding | Expected bin | Result |
| --- | --- | --- | --- |
| 16 | ATS arbitrary loads | machine: network.ats-arbitrary-loads | <confirmed / not> |
| 16 | Dev-launcher local-network string | machine: permissions.usage-string-template | <confirmed / not> |
| 19 | Screenshots missing | machine (Plan 3): store.screenshots-required | not yet implemented |
| 18 | Hidden route | agent | listed under 2.3.1 |
| 1, 3, 17 | Report and block reachability, filtering | agent | listed under 1.2 in Plan 2 |
| others | see spec section 11 | agent / out of scope | — |

False positives: <0 / list>. False negatives against machine rows: <list>. Wall time: <s>. Coverage: <n of m>.
```
Fill the angle-bracket cells from the real run. A false positive here blocks the task until the rule is fixed.

- [ ] **Step 6: Write the README**

`README.md` (short; the real-run output is pasted from the step above):
```markdown
# AppStore Doctor

Ship your AI-built iOS app with confidence. Run one command in your project before you submit to App Review:

    npx appstore-doctor

It checks what can be established from the project itself and tells you three things apart: **confirmed** issues (they lower the score), **potential** issues (evidence with the exceptions named; never scored), and what **needs a reviewer** (judgment calls for you or your coding agent).

<paste a real run on the bundled synthetic fixture here>

## What the number means
Only confirmed issues reduce the score (P0 25, P1 10, P2 4, P3 1; a P0 caps it at 59). Coverage is shown next to it. Under 80 % coverage the scan is **Partial** and is never called Ready. A 100 means every applicable check that could run passed. It is not an approval.

## What it checks today
See [docs/coverage.md](docs/coverage.md) for every guideline clause and what the tool does with it. Version 0.1 implements the permission-string, ATS and Expo-drift checks. App Store Connect checks (listing, screenshots, review details, in-app purchases) and SDK-based checks are next.

## Privacy
Read only. This version makes no network calls. Nothing is written to your project. Evidence excerpts are redacted for secrets and never taken from env or key files. No telemetry, ever.

## For coding agents
`npx appstore-doctor --json` gives a stable document with clause, evidence, fix and check per finding. A ready-made agent prompt arrives in the next release.

## Licence
MIT. Guideline titles and short excerpts are Apple's, quoted for reference, with the date they were reviewed.
```

- [ ] **Step 7: Write the handoff note and commit**

`docs/HANDOFF.md`:
```markdown
# Handoff

## 2026-10-15 Plan 1 complete
- Implemented: detection, Expo and native collectors, capabilities (pods + symbols), redaction, rules 1–4 and 18, score/coverage/labels, terminal + JSON, CLI, coverage map, acceptance on the reference app.
- Known limits: managed Expo projects without ios/ or native source get rule 1 skipped (Plan 2 adds autolinking); labels always carry "(code only)" until store rules exist (Plan 3); no agent prompt yet (Plan 4).
- Next: Plan 2 (SDK linking, potential rules 19–25, verify list sized by SDK facts).
```

```bash
cd ~/appstore-doctor
npm run check
git add -A
git commit -m "Coverage map, README, reference app acceptance run, handoff

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (this plan's slice).** Principles 1–7: no network (Task 11 help text, no collector makes calls), deterministic (no model anywhere), coverage shown (Task 7, 10), read only (no writes), agent-first fields on every finding (Task 7 types, Tasks 8–9 content). Section 3 classification: six kinds in `Result` (Task 7). Section 4 score and labels (Task 7, tests pin every band). Section 5.1 detection (Task 5), 5.2 bundle and capability facts (Tasks 4–6), 5.3 redaction (Task 3 and Task 10 applying it), 5.4 rule declaration fields (Task 7 type, Task 9 test enforcing non-empty), 5.5 terminal and JSON (Task 10) and flags `--json --verbose --no-store --ci --no-color` (Task 11; `--prompt`, `--out`, `--offline`, `--locale`, `--guidelines` belong to Plans 3–4), 5.6 errors (Tasks 4, 5, 7, 11). Section 6.1 rules 1, 2, 3, 4, 18 (Tasks 8–9); rules 5–17 are store or SDK rules for Plans 2–3 and appear as `(planned)` in the coverage map. Section 6.3 verify list (Task 9, basic sizing; SDK-based sizing in Plan 2). Section 9 guidelines index with `reviewedOn` (Task 2); the diff script `scripts/check-guidelines.ts` is deferred to Plan 4 and noted in HANDOFF. Section 11 acceptance (Task 12). Section 12 phases 0–1 (all tasks).

**Placeholders.** Angle-bracket cells in `docs/acceptance.md` and the README paste are filled from the real run in Task 12 Step 5; they are not left in the committed files. No other placeholders.

**Type consistency.** `Available`, `ok`, `unavailable` (Task 1) used by Tasks 4–6, 8–11. `Runner` defined in Task 5, consumed in Task 11. `Rule`, `Result`, `RuleResult`, `Evidence`, `Severity`, `Confidence` (Task 7) consumed by Tasks 8–10. `Scored`, `Coverage` (Task 7) consumed by Task 10. `VerifyItem` (Task 9) consumed by Task 10. `REQUIRED_KEYS` (Task 6) consumed by Task 8. `Report`, `ReportFinding` (Task 10) consumed by Task 11. `makeFacts`, `bundle`, `usage`, `cap`, `prov` helpers (Task 8) consumed by Tasks 9–10.

**Review Focus.** 1 binary plist → Task 4 test "returns unavailable for a binary plist". 2 warnings before JSON and non-JSON → Task 5 tests. 3 non-string usage value → Task 4 plist test and Task 8 rule 3 test. 4 path with a space and `--path` from elsewhere → Task 11 main test and CLI test. 5 `NO_COLOR` / non-TTY → Task 11 CLI test.
