import type { Capability, CapabilityFact } from '../../facts.js';
import { REQUIRED_KEYS } from '../capabilities.js';
import type { Rule } from '../types.js';

const LABEL: Record<Capability, string> = {
  camera: 'Camera', microphone: 'Microphone', location: 'Location', contacts: 'Contacts', photos: 'Photo library',
  bluetooth: 'Bluetooth', health: 'Health data', tracking: 'App tracking', faceId: 'Face ID', calendar: 'Calendar',
  motion: 'Motion data', speech: 'Speech recognition', localNetwork: 'Local network',
};

const CRASHES = new Set<Capability>(['camera', 'microphone', 'location', 'contacts', 'photos', 'bluetooth', 'calendar', 'motion', 'speech']);

// A file name such as Clipboard.swift also matches the clip pattern. That errs toward
// potential on purpose: we never confirm a P0 from a path that might be a secondary target.
function isSecondary(c: CapabilityFact): boolean {
  if (c.via === 'pod' || !('file' in c.provenance)) return false;
  const f = c.provenance.file;
  return f.startsWith('targets/') || f.split('/').some((seg) => /clip|extension|widget|tests?$/i.test(seg));
}

export const usageStringPresent: Rule = {
  id: 'permissions.usage-string-present',
  clauses: ['5.1.1(ii)', '2.1'],
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
    const primary = missing.filter((m) => !isSecondary(m));
    const first = primary[0] ?? missing[0];
    const rest = missing.filter((m) => m !== first);
    const others = [...new Set(rest.map((m) => m.capability))].filter((c) => c !== first.capability).map((c) => LABEL[c]);
    const keys = REQUIRED_KEYS[first.capability];
    const p = first.provenance;
    const label = LABEL[first.capability];
    const finding = {
      severity: 'P0' as const,
      title: `${label} is used but no ${label.toLowerCase()} usage description is set`,
      explanation:
        `The binary links ${first.name} (${first.via === 'pod' ? 'a pod' : 'a native API'}), so iOS will ask for permission. Without a usage description iOS cannot show a purpose and App Review rejects the build.` +
        (CRASHES.has(first.capability) ? ' For this capability iOS also terminates the app at the prompt, which App Review sees as a crash.' : '') +
        (others.length ? ` Also missing: ${others.join(', ')}.` : ''),
      evidence: 'file' in p ? [{ file: p.file, line: p.line, excerpt: first.name }] : [],
      fix: `Add ${keys[0]} to the Info.plist (in Expo: ios.infoPlist in app.json, or the module's config plugin option) with one sentence that says what the app does with it. Only add it if the app really uses ${label.toLowerCase()}; otherwise remove the dependency.`,
      check: 'Re-run appstore-doctor; then on a device, trigger the permission prompt and confirm the sentence appears.',
    };
    if (primary.length === 0) {
      return { kind: 'potential', confidence: 'high', exceptions: ['The capability may belong to the App Clip or an extension, whose own Info.plist carries the string'], ...finding };
    }
    return { kind: 'confirmed', ...finding };
  },
};
