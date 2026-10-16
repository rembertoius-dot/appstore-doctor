import type { Facts } from '../facts.js';
import type { Rule, RuleResult } from './types.js';

export function runRules(facts: Facts, rules: Rule[]): RuleResult[] {
  return rules.map((rule) => {
    try {
      return { rule, result: rule.evaluate(facts) };
    } catch (e) {
      return { rule, result: { kind: 'skipped', reason: `rule error: ${e instanceof Error ? e.message : String(e)}` } };
    }
  });
}
