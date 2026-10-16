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
