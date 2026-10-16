// Known limitation: sources in App Clip and extension targets currently count toward the main app.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, unavailable, type Available, type CapabilityFact } from '../facts.js';
import { POD_CAPABILITIES, SYMBOL_PATTERNS } from '../rules/capabilities.js';

const SKIP_DIRS = new Set([
  'node_modules', 'Pods', 'build', '.git', 'DerivedData', 'Carthage', 'dist', '.expo', 'android',
  'vendor', '.build', '.swiftpm', 'SourcePackages', '.yarn',
]);
const NATIVE_EXT = /\.(swift|m|mm)$/;
const MAX_FILES_VISITED = 20_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function* walk(root: string): Generator<string> {
  let visited = 0;
  function* inner(dir: string): Generator<string> {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; } // unreadable directory: skip it
    for (const e of entries) {
      if (visited >= MAX_FILES_VISITED) return;
      if (e.isSymbolicLink() || SKIP_DIRS.has(e.name)) continue;
      visited++;
      const p = join(dir, e.name);
      if (e.isDirectory()) yield* inner(p);
      else if (e.isFile() && NATIVE_EXT.test(e.name)) {
        try { if (statSync(p).size > MAX_FILE_BYTES) continue; } catch { continue; }
        yield p;
      }
    }
  }
  yield* inner(root);
}

function readLines(file: string): string[] | undefined {
  try { return readFileSync(file, 'utf8').split('\n'); } catch { return undefined; }
}

export function collectCapabilities(root: string): Available<CapabilityFact[]> {
  const facts: CapabilityFact[] = [];
  const rel = (p: string) => relative(root, p).split('\\').join('/');

  let lock = '';
  let lockLines: string[] | undefined;
  for (const candidate of [join(root, 'ios', 'Podfile.lock'), join(root, 'Podfile.lock')]) {
    lockLines = readLines(candidate);
    if (lockLines) { lock = candidate; break; }
  }
  const hasLock = lockLines !== undefined;
  if (lockLines) {
    let inPods = false;
    lockLines.forEach((line, i) => {
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
    const lines = readLines(file);
    if (!lines) continue;
    nativeFiles++;
    const seen = new Set<string>();
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
      for (const s of SYMBOL_PATTERNS) {
        if (seen.has(s.capability) || !s.pattern.test(line)) continue;
        seen.add(s.capability);
        facts.push({ capability: s.capability, via: 'symbol', name: s.name, provenance: { file: rel(file), line: i + 1 } });
      }
    });
  }

  if (!hasLock && nativeFiles === 0) {
    return unavailable('no Podfile.lock and no Swift or Objective-C sources found; linked SDK resolution for managed Expo projects arrives in a later release');
  }
  return ok(facts);
}
