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
    expect(report.label).toBe('Partial scan (code only)');
  });
});

describe('renderTerminal', () => {
  const text = renderTerminal(report, { color: false, verbose: false });
  it('prints sections in order with the bar and coverage line', () => {
    const order = ['Confirmed', 'P1  5.1.1(i)  One is wrong', 'Potential', 'P0? 5.1.1(i)  Two may be wrong', 'exceptions: own account system only', 'Needs a reviewer', '/100  Partial scan (code only)', '3 of 4 applicable checks ran', '1 skipped: no App Store Connect key', 'A score of 100 means every applicable check that could run passed. It is not an approval.'];
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

describe('hardening', () => {
  const mk = (id: string, r: RuleResult['result'], clauses = ['5.1.1(i)']): RuleResult => ({ rule: { ...rule(id), clauses }, result: r });
  const confirmed = (evidence: import('../src/rules/types.js').Evidence[], title = 'T'): RuleResult['result'] => ({ kind: 'confirmed', severity: 'P1', title, explanation: 'E', evidence, fix: 'F', check: 'C' });
  const build = (rs: RuleResult[]) => buildReport({ facts, results: rs, scored: scoreResults(rs), verify: [], version: '0.1.0', codeOnly: false });

  it('redacts api evidence values', () => {
    const r = build([mk('a', confirmed([{ api: 'x', value: 'password: hunter2' }, { api: 'y', value: 'READY_FOR_SALE' }]))]);
    expect(r.confirmed[0].evidence).toEqual([{ api: 'x' }, { api: 'y', value: 'READY_FOR_SALE' }]);
  });
  it('keeps only the basename of a sensitive path with a directory', () => {
    const r = build([mk('a', confirmed([{ file: 'config/.env', line: 3, excerpt: 'KEY=1' }]))]);
    expect(r.confirmed[0].evidence).toEqual([{ file: '.env', line: 3 }]);
  });
  it('strips control characters in the terminal', () => {
    const r = build([mk('a', confirmed([{ file: 'a.ts', line: 1, excerpt: 'ok\u001b[31m' }], '\u001b[31mred\u001b[0m'))]);
    const t = renderTerminal(r, { color: false, verbose: false });
    expect(t).not.toMatch(/\u001b/);
    expect(t).toContain('[31mred[0m');
  });
  it('survives a rule with no clauses and clamps the score', () => {
    const r = build([mk('a', confirmed([]), [])]);
    expect(r.confirmed[0].guideline).toBeUndefined();
    expect(() => renderTerminal({ ...r, score: 140 }, { color: false, verbose: false })).not.toThrow();
    expect(() => renderTerminal({ ...r, score: -5 }, { color: false, verbose: false })).not.toThrow();
  });
  it('withholds a secret in explanation, fix or check but keeps long safe text whole', () => {
    const long = 'Safe sentence. '.repeat(30).trim();
    const secret: RuleResult['result'] = { kind: 'confirmed', severity: 'P1', title: 'T', explanation: 'Leaked sk_live_abcdefghijklmnopqrstuv in config.', evidence: [], fix: long, check: 'C' };
    const r = build([mk('a', secret)]);
    expect(r.confirmed[0].explanation).toBe('withheld: looked like a secret');
    expect(r.confirmed[0].fix).toBe(long);
    expect(r.confirmed[0].fix.length).toBeGreaterThan(160);
  });
  it('prints the verify list one item per line and no bar when nothing ran', () => {
    const r = build([mk('a', { kind: 'skipped', reason: 'no key' })]);
    const t = renderTerminal({ ...r, verify: [{ clause: '4.8', title: 'Login Services' }, { clause: '2.1', title: 'App Completeness' }] }, { color: false, verbose: false });
    expect(t).toContain('Needs a reviewer (2)\n  4.8 Login Services\n  2.1 App Completeness\n');
    expect(t).toContain('–/100');
    expect(t).not.toMatch(/[█░]/);
  });
  it('pins per-finding key order', () => {
    const j = JSON.parse(renderJson(report));
    expect(Object.keys(j.confirmed[0])).toEqual(['rule', 'clauses', 'severity', 'title', 'explanation', 'evidence', 'fix', 'check', 'guideline']);
    expect(Object.keys(j.potential[0])).toEqual(['rule', 'clauses', 'severity', 'confidence', 'exceptions', 'title', 'explanation', 'evidence', 'fix', 'check', 'guideline']);
  });
});
