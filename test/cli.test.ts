import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

function runCli(args: string[], env: Record<string, string> = {}) {
  try {
    return { code: 0, out: execFileSync(process.execPath, ['--import', 'tsx', cli, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('cli', () => {
  it('prints plain text with NO_COLOR and a non-TTY stdout, and never prompts', () => {
    const { code, out } = runCli(['--path', fixture('bare-xcode'), '--no-store'], { NO_COLOR: '1' });
    expect(code).toBe(0);
    expect(out).not.toMatch(/\u001b\[/);
    expect(out).not.toMatch(/Hand this to/);
    expect(out).toMatch(/\/100/);
  });
  it('accepts a positional path and --json', () => {
    const { code, out } = runCli([fixture('bare-xcode'), '--json', '--no-store']);
    expect(code).toBe(0);
    expect(JSON.parse(out).score).toBe(59);
  });
  it('exits 2 when there is no project', () => {
    expect(runCli([fixture('none')]).code).toBe(2);
  });
  const bare = fixture('bare-xcode');
  it('--ci before another flag means the default threshold and fails a low score', () => {
    const { code, out } = runCli([bare, '--no-store', '--ci', '--json']);
    expect(code).toBe(1);
    expect(JSON.parse(out).score).toBe(59);
  });
  it('--ci 50 passes', () => {
    expect(runCli([bare, '--no-store', '--ci', '50']).code).toBe(0);
  });
  it('--ci=70 fails', () => {
    expect(runCli([bare, '--no-store', '--ci=70']).code).toBe(1);
  });
  it('--ci as the last argument fails a low score', () => {
    expect(runCli([bare, '--no-store', '--ci']).code).toBe(1);
  });
  it('--ci -5 exits 2 with one line and no stack', () => {
    const { code, out } = runCli([bare, '--ci', '-5']);
    expect(code).toBe(2);
    expect(out).toMatch(/appstore-doctor:/);
    expect(out).not.toMatch(/\n\s+at /);
  });
  it('an unknown flag exits 2 without a stack', () => {
    const { code, out } = runCli(['--bogus']);
    expect(code).toBe(2);
    expect(out).toMatch(/appstore-doctor:/);
    expect(out).not.toMatch(/\n\s+at /);
  });
  it('shows help', () => {
    const { code, out } = runCli(['--help']);
    expect(code).toBe(0);
    expect(out).toMatch(/Usage: appstore-doctor/);
    expect(out).toMatch(/Exit codes: 0 scanned/);
  });
});
