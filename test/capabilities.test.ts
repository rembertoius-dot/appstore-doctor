import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { collectCapabilities } from '../src/collect/capabilities.js';
import { REQUIRED_KEYS } from '../src/rules/capabilities.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('collectCapabilities', () => {
  it('finds a pod and a native symbol with provenance', () => {
    const r = collectCapabilities(fixture('bare-xcode'));
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value).toContainEqual({ capability: 'camera', via: 'pod', name: 'VisionCamera', provenance: { file: 'ios/Podfile.lock', line: 3 } });
    expect(r.value).toContainEqual({ capability: 'location', via: 'symbol', name: 'CLLocationManager', provenance: { file: 'ios/App/Location.swift', line: 3 } });
  });
  it('ignores nested pod dependencies and non-native files', () => {
    const r = collectCapabilities(fixture('bare-xcode'));
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.value.filter((c) => c.name === 'React-Core')).toHaveLength(0);
  });
  it('is unavailable for a managed Expo project with no native code', () => {
    const r = collectCapabilities(fixture('expo-minimal'));
    expect(r).toEqual({ status: 'unavailable', reason: 'no Podfile.lock and no Swift or Objective-C sources found; linked SDK resolution for managed Expo projects arrives in a later release' });
  });
  it('maps every capability to at least one usage key', () => {
    for (const keys of Object.values(REQUIRED_KEYS)) expect(keys.length).toBeGreaterThan(0);
  });
  it('accepts both photo library keys', () => {
    expect(REQUIRED_KEYS.photos).toContain('NSPhotoLibraryUsageDescription');
    expect(REQUIRED_KEYS.photos).toContain('NSPhotoLibraryAddUsageDescription');
  });

  describe('conservative detectors', () => {
    const dirs: string[] = [];
    afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
    const project = (files: Record<string, string>) => {
      const d = mkdtempSync(join(tmpdir(), 'asd-cap-'));
      dirs.push(d);
      for (const [f, c] of Object.entries(files)) {
        mkdirSync(dirname(join(d, f)), { recursive: true });
        writeFileSync(join(d, f), c);
      }
      return d;
    };
    const facts = (root: string) => {
      const r = collectCapabilities(root);
      if (r.status !== 'ok') throw new Error(r.reason);
      return r.value;
    };

    it('ignores symbols in comments', () => {
      expect(facts(project({ 'A.swift': '// CLLocationManager()\n/* CLLocationManager */\n * CLLocationManager\n' }))).toEqual([]);
      const f = facts(project({ 'A.swift': 'let m = CLLocationManager()\n' }));
      expect(f.filter((c) => c.capability === 'location')).toHaveLength(1);
    });
    it('detects the microphone only through AVAudioRecorder', () => {
      expect(facts(project({ 'A.swift': 'analytics.record()\nlet p = AVAudioPlayer()\n' }))).toEqual([]);
      const f = facts(project({ 'A.swift': 'let r = AVAudioRecorder(url: u, settings: s)\n' }));
      expect(f.map((c) => c.capability)).toEqual(['microphone']);
    });
    it('has no detector for LAContext', () => {
      expect(facts(project({ 'A.swift': 'let ctx = LAContext()\n' }))).toEqual([]);
    });
    it('detects the camera only through video capture symbols', () => {
      expect(facts(project({ 'A.swift': 'let s = AVCaptureSession()\n' }))).toEqual([]);
      const f = facts(project({ 'A.swift': 'let d = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)\n' }));
      expect(f.map((c) => c.capability)).toEqual(['camera']);
    });
    it('does not detect the camera from playback code', () => {
      expect(facts(project({ 'A.swift': 'let t = asset.tracks(withMediaType: AVMediaType.video)\n' }))).toEqual([]);
      expect(facts(project({ 'A.swift': 'let t = try await asset.loadTracks(withMediaType: .video)\n' }))).toEqual([]);
    });
    it('detects the camera from an access request', () => {
      const f = facts(project({ 'A.swift': 'AVCaptureDevice.requestAccess(for: .video) { _ in }\n' }));
      expect(f.map((c) => c.capability)).toEqual(['camera']);
    });
    it('survives a symlink loop', () => {
      const root = project({ 'A.swift': 'let x = 1\n' });
      symlinkSync(root, join(root, 'loop'));
      expect(() => collectCapabilities(root)).not.toThrow();
    });
    it('reads a Podfile.lock at the project root', () => {
      const root = project({ 'Podfile.lock': 'PODS:\n  - VisionCamera (4.5.0)\n' });
      expect(facts(root)).toContainEqual({ capability: 'camera', via: 'pod', name: 'VisionCamera', provenance: { file: 'Podfile.lock', line: 2 } });
    });
    it('ignores a pod that appears only as a nested dependency', () => {
      const root = project({ 'ios/Podfile.lock': 'PODS:\n  - Other (1.0)\n    - VisionCamera (4.5.0)\n' });
      expect(facts(root).filter((c) => c.capability === 'camera')).toHaveLength(0);
    });
  });
});
