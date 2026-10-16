import { describe, expect, it } from 'vitest';
import { ok, unavailable } from '../src/facts.js';

describe('Available', () => {
  it('ok wraps a value', () => {
    expect(ok(3)).toEqual({ status: 'ok', value: 3 });
  });
  it('unavailable carries a reason', () => {
    expect(unavailable('no key')).toEqual({ status: 'unavailable', reason: 'no key' });
  });
});
