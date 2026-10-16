import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ok, unavailable } from '../src/facts.js';
import { atsArbitraryLoads } from '../src/rules/network/ats-arbitrary-loads.js';
import { prebuildDrift } from '../src/rules/expo/prebuild-drift.js';
import { RULES } from '../src/rules/index.js';
import { bundle, expoProv, makeFacts, usage, prov } from './helpers/facts.js';

describe('network.ats-arbitrary-loads (rule 4)', () => {
  it('confirms P2 when arbitrary loads are on, even with exception domains', () => {
    const r = atsArbitraryLoads.evaluate(makeFacts({ bundle: ok(bundle({ ats: { allowsArbitraryLoads: true, exceptionDomains: ['localhost'], provenance: prov } })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') {
      expect(r.severity).toBe('P2');
      expect(r.evidence).toEqual([{ file: 'ios/App/Info.plist', excerpt: 'NSAppTransportSecurity.NSAllowsArbitraryLoads: true' }]);
    }
  });
  it('cites the command for an Expo-resolved plist', () => {
    const r = atsArbitraryLoads.evaluate(makeFacts({ bundle: ok(bundle({ provenance: expoProv, ats: { allowsArbitraryLoads: true, exceptionDomains: [], provenance: expoProv } })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.evidence).toEqual([{ command: 'expo config --json --type introspect', excerpt: 'NSAppTransportSecurity.NSAllowsArbitraryLoads: true' }]);
  });
  it('passes when off or absent', () => {
    expect(atsArbitraryLoads.evaluate(makeFacts({ bundle: ok(bundle({ ats: { allowsArbitraryLoads: false, exceptionDomains: [], provenance: prov } })) }))).toEqual({ kind: 'pass' });
    expect(atsArbitraryLoads.evaluate(makeFacts())).toEqual({ kind: 'pass' });
  });
  it('skips without a bundle', () => {
    expect(atsArbitraryLoads.evaluate(makeFacts({ bundle: unavailable('x') }))).toEqual({ kind: 'skipped', reason: 'x' });
  });
});

describe('expo.prebuild-drift (rule 18)', () => {
  const expo = bundle({ origin: 'expo', bundleId: 'com.a.b', usageStrings: [usage('NSCameraUsageDescription')], provenance: { command: 'npx expo config --json --type introspect' } });
  it('is not applicable unless both bundles exist', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'expo' }, bundle: ok(expo) }))).toEqual({ kind: 'not-applicable' });
  });
  it('skips when ios/ exists but could not be read', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: unavailable('binary plist') }))).toEqual({ kind: 'skipped', reason: 'binary plist' });
  });
  it('confirms P2 when the bundle id differs', () => {
    const r = prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.old.id', usageStrings: [usage('NSCameraUsageDescription')] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.explanation).toMatch(/bundle identifier: com\.a\.b in the Expo config, com\.old\.id in ios\//);
  });
  it('confirms P2 when usage keys differ', () => {
    const r = prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.a.b', usageStrings: [] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.explanation).toMatch(/only in the Expo config: NSCameraUsageDescription/);
  });
  it('is only potential when ios/ is gitignored', () => {
    const root = mkdtempSync(join(tmpdir(), 'drift-'));
    writeFileSync(join(root, '.gitignore'), '# build\nnode_modules\n/ios/\n');
    const r = prebuildDrift.evaluate(makeFacts({ root, project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.old.id' })) }));
    expect(r.kind).toBe('potential');
    if (r.kind === 'potential') {
      expect(r.severity).toBe('P2');
      expect(r.confidence).toBe('medium');
      expect(r.exceptions).toEqual(['ios/ is gitignored, so EAS regenerates it from the Expo config and the local copy may simply be stale']);
    }
  });
  it('still confirms when .gitignore does not list ios/', () => {
    const root = mkdtempSync(join(tmpdir(), 'drift-'));
    writeFileSync(join(root, '.gitignore'), 'node_modules\nios-old/\n');
    const r = prebuildDrift.evaluate(makeFacts({ root, project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.old.id' })) }));
    expect(r.kind).toBe('confirmed');
  });
  it('never confirms drift from an unknown native bundle id', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: undefined, usageStrings: [usage('NSCameraUsageDescription')] })) }))).toEqual({ kind: 'pass' });
  });
  it('passes when they agree', () => {
    expect(prebuildDrift.evaluate(makeFacts({ project: { kind: 'both' }, bundle: ok(expo), nativeBundle: ok(bundle({ bundleId: 'com.a.b', usageStrings: [usage('NSCameraUsageDescription')] })) }))).toEqual({ kind: 'pass' });
  });
});

describe('RULES', () => {
  it('has unique ids and complete declarations', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(r.clauses.length).toBeGreaterThan(0);
      for (const f of ['confirmsFail', 'confirmsPass', 'verify'] as const) expect(r[f].length).toBeGreaterThan(5);
      expect(r.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(ids).toEqual(['permissions.usage-string-present', 'permissions.usage-string-empty', 'permissions.usage-string-template', 'network.ats-arbitrary-loads', 'expo.prebuild-drift']);
  });
});
