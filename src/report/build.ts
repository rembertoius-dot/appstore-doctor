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
  const value = e.value === undefined ? undefined : redactExcerpt(e.value);
  return value === null || value === undefined ? { api: e.api } : { api: e.api, value };
}

/** Keeps the full text unless it looks like a secret; then the whole field is withheld. */
function screen(text: string): string {
  return redactExcerpt(text) === null ? 'withheld: looked like a secret' : text;
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
    const g = clause(rr.rule.clauses[0] ?? '');
    return {
      rule: rr.rule.id,
      clauses: rr.rule.clauses,
      severity: r.severity,
      ...(r.kind === 'potential' ? { confidence: r.confidence, exceptions: r.exceptions } : {}),
      title: r.title,
      explanation: screen(r.explanation),
      evidence: r.evidence.map(redactEvidence),
      fix: screen(r.fix),
      check: screen(r.check),
      ...(g ? { guideline: { id: g.id, title: g.title, url: g.url, excerpt: g.excerpt } } : {}),
    };
  };
  const bySeverity = (a: ReportFinding, b: ReportFinding) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (a.clauses[0] ?? '').localeCompare(b.clauses[0] ?? '', undefined, { numeric: true });

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
