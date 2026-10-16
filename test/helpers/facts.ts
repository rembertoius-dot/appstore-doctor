import { ok, unavailable, type BundleFacts, type CapabilityFact, type Facts, type Provenance, type UsageString } from '../../src/facts.js';

export const prov = { file: 'ios/App/Info.plist' };

export function bundle(over: Partial<BundleFacts> = {}): BundleFacts {
  return { origin: 'native', bundleId: 'com.example.app', deviceFamilies: ['iphone'], usageStrings: [], ats: null, entitlements: {}, hasAppClip: false, provenance: prov, ...over };
}
export const usage = (key: string, value: string | null = 'A sentence that explains the purpose.', provenance: Provenance = prov): UsageString => ({ key, value, provenance });
export const expoProv: Provenance = { command: 'expo config --json --type introspect' };
export const cap = (capability: CapabilityFact['capability'], name = 'X', file = 'ios/App/A.swift'): CapabilityFact => ({ capability, via: 'symbol', name, provenance: { file, line: 1 } });

export function makeFacts(over: Partial<Facts> = {}): Facts {
  return {
    root: '/project',
    project: { kind: 'native' },
    bundle: ok(bundle()),
    nativeBundle: unavailable('single source'),
    capabilities: ok([]),
    store: unavailable('no App Store Connect key'),
    ...over,
  };
}
