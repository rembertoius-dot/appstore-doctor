import { describe, expect, it } from 'vitest';
import { bundleFromPlist } from '../src/collect/plist.js';

const prov = { file: 'ios/App/Info.plist' };

describe('bundleFromPlist', () => {
  it('reads usage strings, keeping non-strings as null', () => {
    const b = bundleFromPlist(
      { NSCameraUsageDescription: 'Scans tickets', NSPhotoLibraryUsageDescription: ['x'], CFBundleIdentifier: 'com.x.y' },
      {},
      { origin: 'native', provenance: prov },
    );
    expect(b.usageStrings).toEqual([
      { key: 'NSCameraUsageDescription', value: 'Scans tickets', provenance: prov },
      { key: 'NSPhotoLibraryUsageDescription', value: null, provenance: prov },
    ]);
    expect(b.bundleId).toBe('com.x.y');
  });
  it('ignores an unresolved $(PRODUCT_BUNDLE_IDENTIFIER) and prefers opts.bundleId', () => {
    const b = bundleFromPlist({ CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)' }, {}, { origin: 'native', provenance: prov, bundleId: 'com.from.pbx' });
    expect(b.bundleId).toBe('com.from.pbx');
    const c = bundleFromPlist({ CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)' }, {}, { origin: 'native', provenance: prov });
    expect(c.bundleId).toBeUndefined();
  });
  it('reads ATS', () => {
    const b = bundleFromPlist(
      { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSExceptionDomains: { 'localhost': {} } } },
      {},
      { origin: 'expo', provenance: { command: 'expo config' } },
    );
    expect(b.ats).toEqual({ allowsArbitraryLoads: true, exceptionDomains: ['localhost'], provenance: { command: 'expo config' } });
    expect(bundleFromPlist({}, {}, { origin: 'expo', provenance: prov }).ats).toBeNull();
  });
  it('derives device families from UIDeviceFamily when not given', () => {
    expect(bundleFromPlist({ UIDeviceFamily: [1, 2] }, {}, { origin: 'native', provenance: prov }).deviceFamilies).toEqual(['iphone', 'ipad']);
    expect(bundleFromPlist({}, {}, { origin: 'native', provenance: prov }).deviceFamilies).toEqual(['iphone']);
  });
  it('detects an App Clip from the entitlement', () => {
    const b = bundleFromPlist({}, { 'com.apple.developer.associated-appclip-app-identifiers': ['x'] }, { origin: 'expo', provenance: prov });
    expect(b.hasAppClip).toBe(true);
  });
});
