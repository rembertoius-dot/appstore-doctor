import { describe, expect, it } from 'vitest';
import { scoreResults } from '../src/score.js';
import type { Rule, RuleResult, Severity } from '../src/rules/types.js';

const rule = (id: string, severity: Severity = 'P2'): Rule => ({
  id, clauses: ['2.1'], kind: 'confirmed-capable', severity, confirmsFail: 'x', confirmsPass: 'y', verify: 'z', reviewedOn: '2026-10-15',
  evaluate: () => ({ kind: 'pass' }),
});
const confirmed = (id: string, severity: Severity): RuleResult => ({ rule: rule(id, severity), result: { kind: 'confirmed', severity, title: id, explanation: '', evidence: [], fix: '', check: '' } });
const potential = (id: string, severity: Severity): RuleResult => ({ rule: rule(id, severity), result: { kind: 'potential', severity, confidence: 'high', exceptions: [], title: id, explanation: '', evidence: [], fix: '', check: '' } });
const pass = (id: string): RuleResult => ({ rule: rule(id), result: { kind: 'pass' } });
const skipped = (id: string, reason = 'no key'): RuleResult => ({ rule: rule(id), result: { kind: 'skipped', reason } });
const na = (id: string): RuleResult => ({ rule: rule(id), result: { kind: 'not-applicable' } });
const passes = (n: number) => Array.from({ length: n }, (_, i) => pass(`p${i}`));

describe('scoreResults', () => {
  it('subtracts weights for confirmed findings only', () => {
    const s = scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P2'), potential('c', 'P0')]);
    expect(s.score).toBe(86);
    expect(s.potentialSerious).toBe(1);
  });
  it('caps at 59 with a confirmed P0 and floors at 0', () => {
    expect(scoreResults([...passes(10), confirmed('a', 'P0')]).score).toBe(59);
    expect(scoreResults([...passes(10), ...['a', 'b', 'c', 'd', 'e'].map((i) => confirmed(i, 'P0'))]).score).toBe(0);
  });
  it('counts coverage without not-applicable rules', () => {
    const s = scoreResults([...passes(3), skipped('s1'), skipped('s2', 'no ios folder'), na('n')]);
    expect(s.coverage).toEqual({ evaluated: 3, applicable: 5, skipped: [{ rule: 's1', reason: 'no key' }, { rule: 's2', reason: 'no ios folder' }] });
  });
  it('labels Partial scan when coverage is below the floor', () => {
    expect(scoreResults([...passes(2), skipped('s1'), skipped('s2')]).label).toBe('Partial scan');
  });
  it('labels Not ready for a confirmed P0', () => {
    expect(scoreResults([...passes(10), confirmed('a', 'P0')]).label).toBe('Not ready');
  });
  it('labels Not ready for three confirmed P1s', () => {
    expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P1'), confirmed('c', 'P1')]).label).toBe('Not ready');
  });
  it('labels Needs work for a P1 plus a P2', () => {
    expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P2')]).label).toBe('Needs work');
  });
  it('labels Ready for a confirmed P3 only', () => {
    expect(scoreResults([...passes(10), confirmed('a', 'P3')]).label).toBe('Ready');
  });
  it('labels Ready, verify 1 potential issue for one potential P1', () => {
    expect(scoreResults([...passes(10), potential('a', 'P1')]).label).toBe('Ready, verify 1 potential issue');
  });
  it('labels Ready, verify 2 potential issues for a potential P1 and P0', () => {
    expect(scoreResults([...passes(10), potential('a', 'P1'), potential('b', 'P0')]).label).toBe('Ready, verify 2 potential issues');
  });
  it('labels Ready for a potential P2 only', () => {
    expect(scoreResults([...passes(10), potential('a', 'P2')]).label).toBe('Ready');
  });
  it('is Partial scan when nothing could run', () => {
    expect(scoreResults([skipped('s1')]).label).toBe('Partial scan');
  });
  it('is Partial scan for an empty list', () => {
    expect(scoreResults([])).toEqual({ score: 100, coverage: { evaluated: 0, applicable: 0, skipped: [] }, label: 'Partial scan', potentialSerious: 0 });
  });

  describe('boundaries', () => {
    it('coverage of exactly 80 % is Ready, not Partial scan', () => {
      expect(scoreResults([...passes(4), skipped('s1')]).label).toBe('Ready');
    });
    it('coverage just under 80 % (75 %) is Partial scan', () => {
      expect(scoreResults([...passes(3), skipped('s1')]).label).toBe('Partial scan');
    });
    it('score of exactly 75 is Needs work', () => {
      expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P1'), confirmed('c', 'P2'), confirmed('d', 'P3')]).score).toBe(75);
      expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P1'), confirmed('c', 'P2'), confirmed('d', 'P3')]).label).toBe('Needs work');
    });
    it('score of 74 is Not ready', () => {
      expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P1'), confirmed('c', 'P2'), confirmed('d', 'P3'), confirmed('e', 'P3')]).label).toBe('Not ready');
    });
    it('score of exactly 90 is Ready', () => {
      expect(scoreResults([...passes(10), confirmed('a', 'P1')]).label).toBe('Ready');
    });
    it('score of 89 is Needs work', () => {
      expect(scoreResults([...passes(10), confirmed('a', 'P1'), confirmed('b', 'P3')]).label).toBe('Needs work');
    });
    it('a confirmed P0 under the coverage floor is Partial scan and still scores 59', () => {
      const s = scoreResults([...passes(2), confirmed('a', 'P0'), skipped('s1'), skipped('s2')]);
      expect(s.label).toBe('Partial scan');
      expect(s.score).toBe(59);
    });
  });
});
