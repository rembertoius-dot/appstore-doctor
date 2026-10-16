import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectNative, findXcodeProject } from '../src/collect/native.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('collectNative', () => {
  it('finds the project and target directory', () => {
    const p = findXcodeProject(fixture('bare-xcode'));
    expect(p?.pbxproj.endsWith('ios/App.xcodeproj/project.pbxproj')).toBe(true);
    expect(p?.targetDir.endsWith('ios/App')).toBe(true);
  });
  it('reads bundle facts from ios/ with the id and families from the pbxproj', () => {
    const r = collectNative(fixture('bare-xcode'));
    if (r.status !== 'ok') throw new Error(r.reason);
    const b = r.value;
    expect(b.origin).toBe('native');
    expect(b.bundleId).toBe('com.example.barefixture');
    expect(b.deviceFamilies).toEqual(['iphone', 'ipad']);
    expect(b.displayName).toBe('Bare Fixture');
    expect(b.usageStrings.map((u) => u.key)).toEqual([
      'NSCameraUsageDescription', 'NSLocalNetworkUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription',
    ]);
    expect(b.ats?.allowsArbitraryLoads).toBe(true);
    expect(b.entitlements['aps-environment']).toBe('production');
    expect(b.provenance).toEqual({ file: 'ios/App/Info.plist' });
  });
  it('returns unavailable for a binary plist instead of throwing', () => {
    const r = collectNative(fixture('binary-plist'));
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') expect(r.reason).toMatch(/could not parse ios\/App\/Info\.plist/);
  });
  it('returns null when there is no Xcode project', () => {
    expect(findXcodeProject(fixture('none'))).toBeNull();
  });
  it('picks the app target in a multi-target project', () => {
    const r = collectNative(fixture('multi-target'));
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value.bundleId).toBe('com.example.shop');
    expect(r.value.deviceFamilies).toEqual(['iphone', 'ipad']);
    expect(r.value.provenance).toEqual({ file: 'ios/ShopApp/Info.plist' });
  });
  it('prefers a literal CFBundleIdentifier over the pbxproj', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ad-'));
    cpSync(fixture('bare-xcode'), tmp, { recursive: true });
    writeFileSync(join(tmp, 'ios/App/Info.plist'), '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.literal.id</string></dict></plist>');
    const r = collectNative(tmp);
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value.bundleId).toBe('com.literal.id');
  });
  it('reads an unquoted TARGETED_DEVICE_FAMILY', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ad-'));
    cpSync(fixture('bare-xcode'), tmp, { recursive: true });
    writeFileSync(
      join(tmp, 'ios/App.xcodeproj/project.pbxproj'),
      'buildSettings = {\n\tPRODUCT_BUNDLE_IDENTIFIER = com.x.y;\n\tTARGETED_DEVICE_FAMILY = 1;\n\tINFOPLIST_FILE = App/Info.plist;\n};\n',
    );
    const r = collectNative(tmp);
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value.deviceFamilies).toEqual(['iphone']);
  });
  it('explains a project with no Info.plist for the app target', () => {
    const r = collectNative(fixture('no-plist'));
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') expect(r.reason).toMatch(/no Info\.plist for the app target/);
  });
  it('returns unavailable for a bad entitlements file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ad-'));
    cpSync(fixture('bare-xcode'), tmp, { recursive: true });
    writeFileSync(join(tmp, 'ios/App/App.entitlements'), 'not a plist');
    const r = collectNative(tmp);
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') expect(r.reason).toMatch(/could not parse/);
  });
  it('reports no project for collectNative on an empty folder', () => {
    const r = collectNative(fixture('none'));
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') expect(r.reason).toMatch(/no Xcode project found/);
  });
});
