import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ok, unavailable, type Available, type BundleFacts } from '../facts.js';
import { redactExcerpt } from '../redact.js';
import { bundleFromPlist } from './plist.js';

export type Runner = (cmd: string, args: string[], cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>;

export const defaultRunner: Runner = (cmd, args, cwd) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, maxBuffer: 20 * 1024 * 1024, timeout: 120_000, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } }, (err, stdout, stderr) => {
      const e = err as (Error & { code?: number | string; killed?: boolean; signal?: string | null }) | null;
      if (e && typeof e.code !== 'number') {
        const message =
          e.code === 'ENOENT' ? `node could not start Expo's CLI (${e.message})`
          : e.killed || e.signal ? 'expo config timed out after 120 s'
          : e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'expo config output exceeded 20 MB'
          : e.message;
        resolve({ code: 1, stdout: String(stdout), stderr: message });
        return;
      }
      resolve({ code: e ? (e.code as number) : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** The nearest ancestor (the project itself, or a monorepo parent) whose node_modules holds expo. */
function installedExpoDir(root: string): string | null {
  let dir = resolve(root);
  for (;;) {
    if (existsSync(join(dir, 'node_modules', 'expo', 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function parseJsonFromLines(stdout: string): { value?: Record<string, unknown>; error?: string } {
  let error: string | undefined;
  let offset = 0;
  for (const line of stdout.split('\n')) {
    if (line.trim().startsWith('{')) {
      try {
        return { value: JSON.parse(stdout.slice(offset + line.indexOf('{'))) as Record<string, unknown> };
      } catch (e) {
        error ??= (e as Error).message;
      }
    }
    offset += line.length + 1;
  }
  return { error };
}

const COMMAND = 'expo config --json --type introspect';

export async function collectExpo(root: string, run: Runner): Promise<{ bundle: Available<BundleFacts>; sdk?: string }> {
  const installed = installedExpoDir(root);
  if (!installed) {
    return { bundle: unavailable('node_modules is not installed; run npm install (or yarn, pnpm, bun) first') };
  }
  // Run the project's own Expo CLI through node: npx could fetch a package from the registry.
  const cli = join(installed, 'node_modules', 'expo', 'bin', 'cli');
  if (!existsSync(cli)) {
    return { bundle: unavailable('expo is installed but node_modules/expo/bin/cli is missing; reinstall dependencies') };
  }
  let result: Awaited<ReturnType<Runner>>;
  try {
    result = await run(process.execPath, [cli, 'config', '--json', '--type', 'introspect'], root);
  } catch (e) {
    return { bundle: unavailable(`expo config failed: ${(e as Error).message}`) };
  }
  const { code, stdout, stderr } = result;
  if (code !== 0) {
    const first = (stderr || stdout).split('\n').find((l) => l.trim()) ?? `exit code ${code}`;
    const safe = redactExcerpt(first);
    return { bundle: unavailable(safe === null ? 'expo config failed; its first output line was withheld because it looked like a secret' : `expo config failed: ${safe}`) };
  }
  const parsed = parseJsonFromLines(stdout);
  if (!parsed.value) {
    return { bundle: unavailable(parsed.error ? `expo config returned no JSON: ${parsed.error}` : 'expo config returned no JSON') };
  }
  const config = parsed.value;
  const ios = (typeof config.ios === 'object' && config.ios ? config.ios : {}) as Record<string, unknown>;
  const plist = (typeof ios.infoPlist === 'object' && ios.infoPlist ? ios.infoPlist : {}) as Record<string, unknown>;
  const entitlements = (typeof ios.entitlements === 'object' && ios.entitlements ? ios.entitlements : {}) as Record<string, unknown>;

  const bundle = bundleFromPlist(plist, entitlements, {
    origin: 'expo',
    provenance: { command: COMMAND },
    bundleId: typeof ios.bundleIdentifier === 'string' ? ios.bundleIdentifier : undefined,
    deviceFamilies: ios.supportsTablet === true ? ['iphone', 'ipad'] : ['iphone'],
  });
  if (!bundle.displayName && typeof config.name === 'string') bundle.displayName = config.name;
  if (!bundle.version && typeof config.version === 'string') bundle.version = config.version;
  if (!bundle.build && typeof ios.buildNumber === 'string') bundle.build = ios.buildNumber;

  return { bundle: ok(bundle), sdk: typeof config.sdkVersion === 'string' ? config.sdkVersion : undefined };
}
