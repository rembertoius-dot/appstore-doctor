import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allClauses } from '../src/guidelines/lookup.js';
import { RULES } from '../src/rules/index.js';

const md = readFileSync(fileURLToPath(new URL('../docs/coverage.md', import.meta.url)), 'utf8');
const rows = md.split('\n').filter((l) => /^\| \S/.test(l) && !/^\| Clause/.test(l) && !/^\| ---/.test(l)).map((l) => {
  const [clause, , bin, rule, note] = l.slice(1, -1).split('|').map((c) => c.trim());
  return { clause, bin, rule, note };
});

describe('docs/coverage.md', () => {
  it('has one row per indexed clause', () => {
    const ids = allClauses().map((c) => c.id).sort();
    expect(rows.map((r) => r.clause).sort()).toEqual(ids);
  });
  it('has rows for the clauses the index once dropped or misfiled', () => {
    const ids = rows.map((r) => r.clause);
    for (const id of ['2.3.1', '4.2.3', '5.1.1(ii)', '4.8']) expect(ids, id).toContain(id);
  });
  it('uses only the allowed bins', () => {
    for (const r of rows) expect(['machine', 'potential', 'planned', 'agent', 'n/a'], r.clause).toContain(r.bin);
  });
  it('names a real or planned rule for machine, potential and planned rows', () => {
    const ids = new Set(RULES.map((r) => r.id));
    for (const r of rows.filter((r) => ['machine', 'potential', 'planned'].includes(r.bin))) {
      const names = r.rule.split(',').map((s) => s.trim()).filter(Boolean);
      expect(names.length, r.clause).toBeGreaterThan(0);
      for (const n of names) expect(ids.has(n) || n.endsWith('(planned)'), `${r.clause}: ${n}`).toBe(true);
    }
  });
  it('requires an implemented rule on machine and potential rows, only planned ids on planned rows', () => {
    const ids = new Set(RULES.map((r) => r.id));
    for (const r of rows.filter((r) => r.bin === 'machine' || r.bin === 'potential')) {
      const names = r.rule.split(',').map((s) => s.trim());
      expect(names.some((n) => ids.has(n)), r.clause).toBe(true);
    }
    for (const r of rows.filter((r) => r.bin === 'planned')) {
      const names = r.rule.split(',').map((s) => s.trim());
      expect(names.every((n) => n.endsWith('(planned)')), r.clause).toBe(true);
    }
  });
  it('lists every implemented rule under at least one of its clauses', () => {
    for (const rule of RULES) {
      const hit = rows.some((r) => r.rule.split(',').map((s) => s.trim()).includes(rule.id) && rule.clauses.includes(r.clause));
      expect(hit, rule.id).toBe(true);
    }
  });
  it('gives every n/a row a reason', () => {
    for (const r of rows.filter((r) => r.bin === 'n/a')) expect(r.note.length, r.clause).toBeGreaterThan(3);
  });
});
