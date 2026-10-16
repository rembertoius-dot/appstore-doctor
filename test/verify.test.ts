import { describe, expect, it } from 'vitest';
import { ok } from '../src/facts.js';
import { verifyItems } from '../src/verify.js';
import { bundle, makeFacts } from './helpers/facts.js';

describe('verifyItems', () => {
  it('always lists the judgment items', () => {
    const titles = verifyItems(makeFacts()).map((v) => v.clause);
    expect(titles).toEqual(expect.arrayContaining(['2.1', '2.3.1', '2.3.3', '4.2', '5.1.1(ii)', '5.2']));
  });
  it('adds the App Clip and iPad items from facts', () => {
    const clip = verifyItems(makeFacts({ bundle: ok(bundle({ hasAppClip: true })) }));
    expect(clip.some((v) => /App Clip/.test(v.title))).toBe(true);
    const iphoneOnly = verifyItems(makeFacts());
    expect(iphoneOnly.some((v) => /iPad/.test(v.title))).toBe(true);
    const universal = verifyItems(makeFacts({ bundle: ok(bundle({ deviceFamilies: ['iphone', 'ipad'] })) }));
    expect(universal.some((v) => /iPad compatibility/.test(v.title))).toBe(false);
  });
});
