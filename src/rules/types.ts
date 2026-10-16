import type { Facts, Provenance } from '../facts.js';

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

/** Evidence that points at where a fact came from: a file, an Expo command or an API. */
export function evidenceAt(p: Provenance, excerpt: string): Evidence {
  if ('file' in p) return { file: p.file, excerpt };
  if ('command' in p) return { command: p.command, excerpt };
  return { api: p.api, value: excerpt };
}
