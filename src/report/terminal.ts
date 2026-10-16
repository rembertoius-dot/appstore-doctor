import pc from 'picocolors';
import type { Evidence } from '../rules/types.js';
import type { Report, ReportFinding } from './types.js';

const BAR_CELLS = 16;

const clean = (s: string): string => s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');

function evidenceLine(e: Evidence): string {
  return clean(rawEvidenceLine(e));
}

function rawEvidenceLine(e: Evidence): string {
  if ('file' in e) return `${e.file}${e.line ? `:${e.line}` : ''}${e.excerpt ? `  ${e.excerpt}` : ''}`;
  if ('command' in e) return `${e.command}${e.excerpt ? `  ${e.excerpt}` : ''}`;
  return `${e.api}${e.value ? `  ${e.value}` : ''}`;
}

function finding(f: ReportFinding, potential: boolean, paint: (s: string) => string): string[] {
  const sev = potential ? `${f.severity}?` : `${f.severity} `;
  const lines = [`${paint(sev)} ${(f.clauses[0] ?? '').padEnd(9)} ${clean(f.title)}${potential && f.confidence ? `  (confidence: ${f.confidence})` : ''}`];
  for (const e of f.evidence) lines.push(`    ${evidenceLine(e)}`);
  if (potential && f.exceptions?.length) lines.push(`    exceptions: ${clean(f.exceptions.join('  '))}`);
  lines.push(`    fix: ${clean(f.fix)}`);
  lines.push(`    check: ${clean(f.check)}`);
  return lines;
}

export function renderTerminal(report: Report, opts: { color: boolean; verbose: boolean }): string {
  const c = opts.color ? pc : { bold: (s: string) => s, yellow: (s: string) => s, red: (s: string) => s, dim: (s: string) => s };
  const paintSev = (s: string) => (s.startsWith('P0') || s.startsWith('P1') ? c.red(s) : c.yellow(s));
  const out: string[] = [];
  const name = [report.app.name, report.app.bundleId, report.app.project].filter(Boolean).join('  ');
  out.push(`${c.bold(`AppStore Doctor ${report.tool.version}`)}   ${name}  guidelines reviewed ${report.tool.guidelinesReviewedOn}`, '');

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
    out.push(c.bold(`Needs a reviewer (${report.verify.length})`));
    for (const v of report.verify) out.push(`  ${clean(`${v.clause} ${v.title}`)}`);
    out.push('');
  }

  const score = Math.min(100, Math.max(0, report.score));
  const { evaluated, applicable, skipped } = report.coverage;
  if (evaluated === 0) {
    out.push(`${c.bold('–/100')}  ${report.label}`);
  } else {
    const filled = Math.round((score / 100) * BAR_CELLS);
    const bar = '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled);
    out.push(`${c.bold(`${report.score}/100`)}  ${report.label}   ${bar}`);
  }
  const reasons = new Map<string, number>();
  for (const s of skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
  const skippedText = [...reasons].map(([reason, n]) => `${n} skipped: ${reason}`).join('  ');
  out.push(`${evaluated} of ${applicable} applicable checks ran${skippedText ? `  ${skippedText}` : ''}`);
  out.push(c.dim('A score of 100 means every applicable check that could run passed. It is not an approval.'));

  if (opts.verbose) {
    out.push('', `Passed (${report.passed.length})`, ...report.passed.map((p) => `  ${p}`));
    out.push('', `Not applicable (${report.notApplicable.length})`, ...report.notApplicable.map((p) => `  ${p}`));
  }
  return out.join('\n') + '\n';
}
