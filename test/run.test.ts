import { describe, expect, it } from 'vitest';
import { runRules } from '../src/rules/run.js';
import type { Rule } from '../src/rules/types.js';
import type { Facts } from '../src/facts.js';

const facts = { root: '/x', project: { kind: 'expo' }, bundle: { status: 'unavailable', reason: 'r' }, nativeBundle: { status: 'unavailable', reason: 'r' }, capabilities: { status: 'unavailable', reason: 'r' }, store: { status: 'unavailable', reason: 'r' } } as Facts;

describe('runRules', () => {
  it('turns a throwing rule into skipped("rule error: …") and keeps going', () => {
    const boom: Rule = { id: 'boom', clauses: [], kind: 'confirmed-capable', severity: 'P2', confirmsFail: '', confirmsPass: '', verify: '', reviewedOn: '2026-10-15', evaluate: () => { throw new Error('nope'); } };
    const fine: Rule = { ...boom, id: 'fine', evaluate: () => ({ kind: 'pass' }) };
    const out = runRules(facts, [boom, fine]);
    expect(out[0].result).toEqual({ kind: 'skipped', reason: 'rule error: nope' });
    expect(out[1].result).toEqual({ kind: 'pass' });
  });
  it('reports a string throw as its value and keeps going', () => {
    const base: Rule = { id: 'base', clauses: [], kind: 'confirmed-capable', severity: 'P2', confirmsFail: '', confirmsPass: '', verify: '', reviewedOn: '2026-10-15', evaluate: () => ({ kind: 'pass' }) };
    const str: Rule = { ...base, id: 'str', evaluate: () => { throw 'boom'; } };
    const out = runRules(facts, [str, base]);
    expect(out[0].result).toEqual({ kind: 'skipped', reason: 'rule error: boom' });
    expect(out[1].result).toEqual({ kind: 'pass' });
  });
  it('reports a null throw without crashing and keeps going', () => {
    const base: Rule = { id: 'base', clauses: [], kind: 'confirmed-capable', severity: 'P2', confirmsFail: '', confirmsPass: '', verify: '', reviewedOn: '2026-10-15', evaluate: () => ({ kind: 'pass' }) };
    const nul: Rule = { ...base, id: 'nul', evaluate: () => { throw null; } };
    const out = runRules(facts, [nul, base]);
    expect(out[0].result).toEqual({ kind: 'skipped', reason: 'rule error: null' });
    expect(out[1].result).toEqual({ kind: 'pass' });
  });
});
