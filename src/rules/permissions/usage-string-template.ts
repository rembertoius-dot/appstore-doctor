import { evidenceAt, type Rule } from '../types.js';

const DEV_TOOL = /\b(Expo Dev Launcher|Expo Go|Dev Launcher|Dev Menu|Flipper|Reactotron)\b/;
const PLACEHOLDER_WORD = /\b(TODO|FIXME|XXX)\b/;
const PLACEHOLDER_PHRASE = /lorem ipsum|description here/i;
const isPlaceholder = (v: string): boolean => PLACEHOLDER_WORD.test(v) || PLACEHOLDER_PHRASE.test(v);
const clip = (v: string): string => (v.length > 120 ? `${v.slice(0, 120)}…` : v);

export const usageStringTemplate: Rule = {
  id: 'permissions.usage-string-template',
  clauses: ['5.1.1(ii)', '2.1'],
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
    const bad = strings.find((u) => DEV_TOOL.test(u.value!) || isPlaceholder(u.value!));
    if (!bad) return { kind: 'pass' };
    const why = DEV_TOOL.test(bad.value!) ? 'names a developer tool' : 'contains placeholder text';
    return {
      kind: 'confirmed',
      severity: 'P3',
      title: `Usage string ${why}`,
      explanation: `${bad.key} ships to users and ${why}. Reviewers read these strings; one that talks about a dev tool looks like a build that was not prepared for release.`,
      evidence: [evidenceAt(bad.provenance, `${bad.key}: "${clip(bad.value!)}"`)],
      fix: `Replace the value of ${bad.key} with one sentence about what the app does for the user. If only a development package needs the key, set that package's plist option to a real sentence or exclude it from release builds.`,
      check: 'Re-run appstore-doctor; for Expo, npx expo config --type introspect shows the resolved value.',
    };
  },
};
