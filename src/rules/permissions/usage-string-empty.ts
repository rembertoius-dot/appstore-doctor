import { REQUIRED_KEYS } from '../capabilities.js';
import { evidenceAt, type Rule } from '../types.js';

export const usageStringEmpty: Rule = {
  id: 'permissions.usage-string-empty',
  clauses: ['5.1.1(ii)', '2.1'],
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
    const blank = (u: { value: string | null }): boolean => u.value === null || u.value.trim() === '';
    const bad = strings.find(blank);
    if (!bad) return { kind: 'pass' };
    const what = bad.value === null ? 'not a string' : 'empty';
    const caps = facts.capabilities.status === 'ok' ? facts.capabilities.value : [];
    const needed = caps.some((c) => {
      const keys = REQUIRED_KEYS[c.capability];
      if (!keys.includes(bad.key)) return false;
      return !keys.some((k) => k !== bad.key && strings.some((u) => u.key === k && !blank(u)));
    });
    const finding = {
      severity: 'P1' as const,
      title: bad.value === null ? `${bad.key} is not a string` : `${bad.key} is empty`,
      explanation: needed
        ? bad.value === null
          ? `${bad.key} is present but its value is not a string, so iOS shows no explanation at the permission prompt. Apple rejects permission requests without a purpose string.`
          : `${bad.key} is present but empty, so the permission prompt shows no explanation. Apple rejects permission requests without a purpose string.`
        : `${bad.key} is present but ${what}. If the app ever requests this access, the prompt shows no purpose and App Review rejects it.`,
      evidence: [evidenceAt(bad.provenance, `${bad.key}: ${bad.value === null ? '(not a string)' : '""'}`)],
      fix: `Set ${bad.key} to one sentence that says what the app does with this access.`,
      check: 'Re-run appstore-doctor.',
    };
    if (needed) return { kind: 'confirmed', ...finding };
    return { kind: 'potential', confidence: 'medium', exceptions: ['No linked capability needs this key; iOS only shows the purpose string if this access is requested'], ...finding };
  },
};
