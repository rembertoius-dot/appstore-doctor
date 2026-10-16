import { describe, expect, it } from 'vitest';
import { clause, allClauses } from '../src/guidelines/lookup.js';

describe('guidelines index', () => {
  it('finds a top-level clause', () => {
    const c = clause('4.8');
    expect(c?.title).toMatch(/Login Services/);
    expect(c?.url).toBe('https://developer.apple.com/app-store/review/guidelines/');
    expect(c?.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('finds a lettered and a roman sub-clause', () => {
    expect(clause('3.1.3(e)')?.excerpt.split(/\s+/).length).toBeLessThanOrEqual(25);
    expect(clause('5.1.1(v)')?.title).toMatch(/Account Sign-In/);
  });
  it('never carries more than 25 words of excerpt', () => {
    for (const c of allClauses()) expect(c.excerpt.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25);
  });
  it('has unique ids', () => {
    const ids = allClauses().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('never cuts a title mid-word', () => {
    for (const id of ['1.1.1', '2.3.7']) {
      const t = clause(id)?.title ?? '';
      expect(t.length).toBeLessThanOrEqual(80);
      expect(t).toMatch(/[A-Za-z.…]$/);
    }
  });
  it('keeps untitled headings and lettered items, filed under the right parent', () => {
    for (const id of ['2.3.1', '4.2.3', '4.2.3(i)', '5.1.1(ii)']) expect(clause(id), id).toBeDefined();
    expect(clause('4.2.2(i)')).toBeUndefined();
  });
  it('returns undefined for an unknown id', () => {
    expect(clause('9.9.9')).toBeUndefined();
  });
});
