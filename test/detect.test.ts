import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { detectProject } from '../src/detect.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

describe('detectProject', () => {
  it('detects Expo from app.json + the expo dependency', () => {
    expect(detectProject(fixture('expo-minimal'))).toEqual({ kind: 'expo', expoConfig: 'app.json' });
  });
  it('detects a bare Xcode project', () => {
    const d = detectProject(fixture('bare-xcode'));
    expect(d.kind).toBe('native');
    expect(d.xcodeproj).toBe('ios/App.xcodeproj/project.pbxproj');
  });
  it('returns none for an empty folder', () => {
    expect(detectProject(fixture('none'))).toEqual({ kind: 'none' });
  });
});
