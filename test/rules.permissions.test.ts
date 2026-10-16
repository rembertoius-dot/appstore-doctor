import { describe, expect, it } from 'vitest';
import { ok, unavailable } from '../src/facts.js';
import { usageStringPresent } from '../src/rules/permissions/usage-string-present.js';
import { usageStringTemplate } from '../src/rules/permissions/usage-string-template.js';
import { usageStringEmpty } from '../src/rules/permissions/usage-string-empty.js';
import { bundle, cap, expoProv, makeFacts, usage } from './helpers/facts.js';

describe('permissions.usage-string-present (rule 1)', () => {
  it('confirms P0 when a linked capability has no usage key', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'ios/App/Where.swift')]) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind !== 'confirmed') return;
    expect(r.severity).toBe('P0');
    expect(r.title).toBe('Location is used but no location usage description is set');
    expect(r.evidence).toEqual([{ file: 'ios/App/Where.swift', line: 1, excerpt: 'CLLocationManager' }]);
    expect(r.fix).toMatch(/NSLocationWhenInUseUsageDescription/);
  });
  it('passes when any accepted key is present', () => {
    const f = makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSLocationAlwaysAndWhenInUseUsageDescription')] })), capabilities: ok([cap('location')]) });
    expect(usageStringPresent.evaluate(f)).toEqual({ kind: 'pass' });
  });
  it('is not applicable when nothing is linked', () => {
    expect(usageStringPresent.evaluate(makeFacts())).toEqual({ kind: 'not-applicable' });
  });
  it('skips when capabilities or bundle are unavailable', () => {
    expect(usageStringPresent.evaluate(makeFacts({ capabilities: unavailable('no native code') }))).toEqual({ kind: 'skipped', reason: 'no native code' });
    expect(usageStringPresent.evaluate(makeFacts({ bundle: unavailable('expo failed') }))).toEqual({ kind: 'skipped', reason: 'expo failed' });
  });
  it('reports one finding for the first missing capability and lists the rest', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('camera', 'AVCaptureDevice'), cap('microphone', 'AVAudioRecorder')]) }));
    if (r.kind !== 'confirmed') throw new Error(r.kind);
    expect(r.title).toMatch(/Camera/);
    expect(r.explanation).toMatch(/Also missing: Microphone\./);
  });
});

describe('permissions.usage-string-present secondary targets', () => {
  const exc = ['The capability may belong to the App Clip or an extension, whose own Info.plist carries the string'];
  it('is potential when the only symbol is in an App Clip target', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'targets/clip/Where.swift')]) }));
    expect(r.kind).toBe('potential');
    if (r.kind === 'potential') { expect(r.exceptions).toEqual(exc); expect(r.confidence).toBe('high'); expect(r.severity).toBe('P0'); }
  });
  it('is potential when the only symbol is in a test target', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'ios/AppTests/LocationTests.swift')]) }));
    expect(r.kind).toBe('potential');
    const r2 = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'ios/AppUITests/LocationTests.swift')]) }));
    expect(r2.kind).toBe('potential');
  });
  it('is potential when the only symbol is in an extension', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'ios/ShareExtension/Where.swift')]) }));
    expect(r.kind).toBe('potential');
  });
  it('confirms the primary one first when a secondary is also missing', () => {
    const r = usageStringPresent.evaluate(makeFacts({ capabilities: ok([cap('location', 'CLLocationManager', 'targets/clip/Where.swift'), cap('camera', 'AVCaptureDevice')]) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') { expect(r.title).toMatch(/Camera/); expect(r.explanation).toMatch(/Also missing: Location\./); }
  });
});

describe('permissions.usage-string-template (rule 2)', () => {
  it('confirms P3 for a developer-tool string', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSLocalNetworkUsageDescription', 'Expo Dev Launcher uses the local network to find your dev server.')] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') {
      expect(r.severity).toBe('P3');
      expect(r.evidence[0]).toEqual({ file: 'ios/App/Info.plist', excerpt: 'NSLocalNetworkUsageDescription: "Expo Dev Launcher uses the local network to find your dev server."' });
    }
  });
  it('confirms for placeholder markers', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', 'TODO describe camera use')] })) }));
    expect(r.kind).toBe('confirmed');
  });
  it('accepts $(PRODUCT_NAME), which Xcode resolves at build time', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', 'Allow $(PRODUCT_NAME) to access your camera')] })) }));
    expect(r).toEqual({ kind: 'pass' });
  });
  it('does not flag ordinary words', () => {
    for (const v of ['Allow Todo to access your calendar', 'Choose a placeholder avatar', 'We insert the photo here', 'Uses the debugger of your dev server']) {
      expect(usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', v)] })) }))).toEqual({ kind: 'pass' });
    }
  });
  it('truncates long values in the evidence excerpt', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', `Flipper ${'a'.repeat(192)}`)] })) }));
    if (r.kind !== 'confirmed') throw new Error(r.kind);
    expect((r.evidence[0] as { excerpt: string }).excerpt).toMatch(/…"$/);
  });
  it('is not applicable with no usage strings', () => {
    expect(usageStringTemplate.evaluate(makeFacts())).toEqual({ kind: 'not-applicable' });
  });
});

describe('permissions.usage-string-empty (rule 3)', () => {
  const withB = (strings: ReturnType<typeof usage>[], capabilities = ok([] as ReturnType<typeof cap>[])) => makeFacts({ bundle: ok(bundle({ usageStrings: strings })), capabilities });
  it('confirms P1 for an empty or non-string value a linked capability needs', () => {
    const r1 = usageStringEmpty.evaluate(withB([usage('NSMicrophoneUsageDescription', '   ')], ok([cap('microphone', 'AVAudioRecorder')])));
    const r2 = usageStringEmpty.evaluate(withB([usage('NSPhotoLibraryUsageDescription', null)], ok([cap('photos', 'PHPhotoLibrary')])));
    expect(r1.kind).toBe('confirmed');
    expect(r2.kind).toBe('confirmed');
    if (r1.kind === 'confirmed') expect(r1.title).toBe('NSMicrophoneUsageDescription is empty');
    if (r2.kind === 'confirmed') { expect(r2.explanation).toMatch(/not a string/); expect(r2.title).toBe('NSPhotoLibraryUsageDescription is not a string'); }
  });
  it('is potential when no linked capability needs the key', () => {
    const r = usageStringEmpty.evaluate(withB([usage('NSCameraUsageDescription', '')]));
    expect(r.kind).toBe('potential');
    if (r.kind === 'potential') { expect(r.confidence).toBe('medium'); expect(r.severity).toBe('P1'); expect(r.exceptions).toEqual(['No linked capability needs this key; iOS only shows the purpose string if this access is requested']); }
  });
  it('is potential when capabilities are unavailable', () => {
    expect(usageStringEmpty.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription', '')] })), capabilities: unavailable('x') })).kind).toBe('potential');
  });
  it('is potential when another accepted key satisfies the capability', () => {
    const r = usageStringEmpty.evaluate(withB([usage('NSLocationWhenInUseUsageDescription', ''), usage('NSLocationAlwaysAndWhenInUseUsageDescription')], ok([cap('location')])));
    expect(r.kind).toBe('potential');
  });
  it('passes otherwise', () => {
    expect(usageStringEmpty.evaluate(makeFacts({ bundle: ok(bundle({ usageStrings: [usage('NSCameraUsageDescription')] })) }))).toEqual({ kind: 'pass' });
  });
});

describe('evidence for Expo-origin facts', () => {
  const ev = [{ command: 'expo config --json --type introspect', excerpt: expect.any(String) }];
  it('cites the command, not a made-up file, for a template string', () => {
    const r = usageStringTemplate.evaluate(makeFacts({ bundle: ok(bundle({ provenance: expoProv, usageStrings: [usage('NSCameraUsageDescription', 'TODO describe camera use', expoProv)] })) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.evidence).toEqual(ev);
  });
  it('cites the command for an empty string', () => {
    const r = usageStringEmpty.evaluate(makeFacts({ bundle: ok(bundle({ provenance: expoProv, usageStrings: [usage('NSMicrophoneUsageDescription', '  ', expoProv)] })), capabilities: ok([cap('microphone', 'AVAudioRecorder')]) }));
    expect(r.kind).toBe('confirmed');
    if (r.kind === 'confirmed') expect(r.evidence).toEqual(ev);
  });
});
