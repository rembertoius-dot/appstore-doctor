import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/main.js';
import type { Runner } from '../src/collect/expo.js';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const recorded = readFileSync(join(fixture('expo-minimal'), 'introspect.json'), 'utf8');
const runner: Runner = async () => ({ code: 0, stdout: recorded, stderr: '' });
const base = { json: false, verbose: false, noStore: true, ci: false as const, color: false };

describe('run', () => {
  it('scans the bare fixture and finds the expected confirmed issues', async () => {
    const { report, exitCode, text } = await run({ ...base, path: fixture('bare-xcode') });
    expect(exitCode).toBe(0);
    expect(report?.confirmed.map((f) => f.rule).sort()).toEqual([
      'network.ats-arbitrary-loads',
      'permissions.usage-string-present',
      'permissions.usage-string-template',
    ]);
    expect(report?.potential.map((f) => f.rule)).toEqual(['permissions.usage-string-empty']);
    expect(report?.score).toBe(59); // P0 cap: 100 − 25 − 4 − 1 = 70, capped at 59
    expect(report?.label).toBe('Not ready (code only)');
    expect(text).toMatch(/Location is used but no location usage description is set/);
  });
  it('scans the Expo fixture with an injected runner', async () => {
    const { report } = await run({ ...base, path: fixture('expo-minimal') }, { runner });
    expect(report?.app.project).toBe('Expo SDK 52');
    expect(report?.confirmed.map((f) => f.rule)).toEqual(['network.ats-arbitrary-loads']);
    expect(report?.coverage.skipped).toEqual([{ rule: 'permissions.usage-string-present', reason: 'no Podfile.lock and no Swift or Objective-C sources found; linked SDK resolution for managed Expo projects arrives in a later release' }]);
  });
  it('exits 2 with a message when no project is found', async () => {
    const { exitCode, text, report } = await run({ ...base, path: fixture('none') });
    expect(exitCode).toBe(2);
    expect(report).toBeUndefined();
    expect(text).toMatch(/No iOS project found/);
    expect(text).toMatch(/app\.json/);
  });
  it('exits 1 under --ci when below the threshold', async () => {
    const { exitCode } = await run({ ...base, path: fixture('bare-xcode'), ci: 90 });
    expect(exitCode).toBe(1);
  });
  it('works when the project path contains a space', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'doctor space '));
    try {
      cpSync(fixture('bare-xcode'), dir, { recursive: true });
      const { exitCode, report } = await run({ ...base, path: dir });
      expect(exitCode).toBe(0);
      expect(report?.app.bundleId).toBe('com.example.barefixture');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('emits JSON when asked', async () => {
    const { text } = await run({ ...base, path: fixture('bare-xcode'), json: true });
    expect(JSON.parse(text).tool.name).toBe('appstore-doctor');
  });
  it('exits 1 under --ci for a Partial scan even when the score clears the threshold', async () => {
    const { report, exitCode } = await run({ ...base, path: fixture('expo-minimal'), ci: 50 }, { runner });
    expect(report?.label).toBe('Partial scan (code only)');
    expect(report!.score).toBeGreaterThanOrEqual(50);
    expect(exitCode).toBe(1);
  });
  it('exits 0 under --ci 50 for the bare fixture', async () => {
    const { exitCode } = await run({ ...base, path: fixture('bare-xcode'), ci: 50 });
    expect(exitCode).toBe(0);
  });
  it('reports the package.json version', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    const { report } = await run({ ...base, path: fixture('bare-xcode') });
    expect(report?.tool.version).toBe(pkg.version);
    expect(pkg.version).not.toBe('0.0.0');
  });
});
