import { describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectExpo, type Runner } from '../src/collect/expo.js';

const root = fileURLToPath(new URL('../fixtures/expo-minimal', import.meta.url));
const recorded = readFileSync(`${root}/introspect.json`, 'utf8');
const runnerWith = (stdout: string, code = 0, stderr = ''): Runner => async () => ({ code, stdout, stderr });

describe('collectExpo', () => {
  it('maps the introspected config to bundle facts', async () => {
    const calls: unknown[][] = [];
    const spy: Runner = async (...a) => { calls.push(a); return { code: 0, stdout: recorded, stderr: '' }; };
    const { bundle, sdk } = await collectExpo(root, spy);
    expect(calls).toHaveLength(1);
    const [cmd, args, cwd] = calls[0] as [string, string[], string];
    expect(cmd).toBe(process.execPath);
    expect(args[0]).toMatch(/node_modules[\\/]expo[\\/]bin[\\/]cli$/);
    expect(args.slice(1)).toEqual(['config', '--json', '--type', 'introspect']);
    expect(cwd).toBe(root);
    if (bundle.status !== 'ok') throw new Error(bundle.reason);
    expect(sdk).toBe('52.0.0');
    expect(bundle.value.origin).toBe('expo');
    expect(bundle.value.bundleId).toBe('com.example.expofixture');
    expect(bundle.value.build).toBe('12');
    expect(bundle.value.version).toBe('2.0.0');
    expect(bundle.value.deviceFamilies).toEqual(['iphone']);
    expect(bundle.value.usageStrings[0]).toEqual({
      key: 'NSCameraUsageDescription', value: 'Allow $(PRODUCT_NAME) to access your camera',
      provenance: { command: 'expo config --json --type introspect' },
    });
    expect(bundle.value.ats?.allowsArbitraryLoads).toBe(true);
  });
  it('tolerates warnings printed before the JSON', async () => {
    const { bundle } = await collectExpo(root, runnerWith(`WARNING: something\nAnother line\n${recorded}`));
    expect(bundle.status).toBe('ok');
  });
  it('reports a failing CLI with its first line', async () => {
    const { bundle } = await collectExpo(root, runnerWith('', 1, 'Error: Cannot find module expo\n  at …'));
    expect(bundle).toEqual({ status: 'unavailable', reason: 'expo config failed: Error: Cannot find module expo' });
  });
  it('reports non-JSON output', async () => {
    const { bundle } = await collectExpo(root, runnerWith('not json at all'));
    expect(bundle.status).toBe('unavailable');
    if (bundle.status === 'unavailable') expect(bundle.reason).toMatch(/expo config returned no JSON/);
  });
  it('asks for an install when node_modules is missing', async () => {
    const none = fileURLToPath(new URL('../fixtures/none', import.meta.url));
    const { bundle } = await collectExpo(none, runnerWith(recorded));
    expect(bundle).toEqual({ status: 'unavailable', reason: 'node_modules is not installed; run npm install (or yarn, pnpm, bun) first' });
  });
  it('finds a hoisted node_modules in a monorepo parent', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'expo-mono-'));
    mkdirSync(join(tmp, 'node_modules/expo'), { recursive: true });
    writeFileSync(join(tmp, 'node_modules/expo/package.json'), '{}');
    mkdirSync(join(tmp, 'node_modules/expo/bin'));
    writeFileSync(join(tmp, 'node_modules/expo/bin/cli'), '');
    const app = join(tmp, 'apps/mobile');
    mkdirSync(app, { recursive: true });
    for (const f of ['app.json', 'package.json']) cpSync(join(root, f), join(app, f));
    const { bundle } = await collectExpo(app, runnerWith(recorded));
    expect(bundle.status).toBe('ok');
  });
  it('skips a warning line containing a brace before the JSON', async () => {
    const { bundle } = await collectExpo(root, runnerWith(`Warning: bad {slug}\n${recorded}`));
    expect(bundle.status).toBe('ok');
  });
  it('turns a throwing runner into unavailable', async () => {
    const boom: Runner = async () => { throw new Error('spawn failed'); };
    const { bundle } = await collectExpo(root, boom);
    expect(bundle).toEqual({ status: 'unavailable', reason: 'expo config failed: spawn failed' });
  });
  it('surfaces the default runner message when node cannot start the CLI', async () => {
    const msg = "node could not start Expo's CLI (spawn ENOENT)";
    const { bundle } = await collectExpo(root, runnerWith('', 1, msg));
    expect(bundle).toEqual({ status: 'unavailable', reason: `expo config failed: ${msg}` });
  });
  it('withholds a first failing line that looks like a secret', async () => {
    const { bundle } = await collectExpo(root, runnerWith('', 1, 'Error: bad key sk_live_abcdefghijklmnopqrstuv\n'));
    expect(bundle).toEqual({ status: 'unavailable', reason: 'expo config failed; its first output line was withheld because it looked like a secret' });
  });
  it('reports a missing Expo CLI file', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'expo-nocli-'));
    mkdirSync(join(tmp, 'node_modules/expo'), { recursive: true });
    writeFileSync(join(tmp, 'node_modules/expo/package.json'), '{}');
    const { bundle } = await collectExpo(tmp, runnerWith(recorded));
    expect(bundle).toEqual({ status: 'unavailable', reason: 'expo is installed but node_modules/expo/bin/cli is missing; reinstall dependencies' });
  });
});
