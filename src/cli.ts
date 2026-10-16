#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { run } from './main.js';

const HELP = `Usage: appstore-doctor [path] [options]

Checks an iOS project (Expo, React Native or native) for App Review problems
that can be established from the project itself. Read only. Makes no network
calls of its own; resolving an Expo project runs your own app.config.* and config
plugins through the Expo CLI already installed in your project, the same way
expo prebuild does. No telemetry.

Options:
  --path <dir>     Project folder (default: current directory)
  --json           Print the report as JSON
  --verbose        Also list passed and not-applicable checks
  --no-store       Skip App Store Connect checks (none exist yet; accepted for scripts)
  --ci [min]       Exit 1 when the score is below min (default 90) or the scan is partial
                   (--ci=N is the unambiguous form; a bare --ci before a path needs --ci=90)
  --no-color       Plain output (also honours NO_COLOR)
  -h, --help       This text

Exit codes: 0 scanned; 1 scanned but below --ci threshold or partial; 2 did not scan (no project, bad flag, or an internal error)
`;

// parseArgs rejects a string option without a value, so a bare --ci (no non-negative integer after it) becomes --ci=90.
function normalizeArgs(argv: string[]): string[] {
  return argv.map((a, i, all) => {
    if (a !== '--ci') return a;
    const next = all[i + 1];
    return next === undefined || !/^\d+$/.test(next) ? '--ci=90' : a;
  });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: normalizeArgs(process.argv.slice(2)),
    allowPositionals: true,
    options: {
      path: { type: 'string' },
      json: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      'no-store': { type: 'boolean', default: false },
      ci: { type: 'string' },
      'no-color': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    process.exitCode = 0;
    return;
  }

  const ci: number | false = values.ci === undefined ? false : Number(values.ci);
  if (ci !== false && Number.isNaN(ci)) {
    process.stderr.write('appstore-doctor: --ci expects a number\n');
    process.exitCode = 2;
    return;
  }
  const color = !values['no-color'] && !process.env.NO_COLOR && Boolean(process.stdout.isTTY);

  const { text, exitCode } = await run({
    path: values.path ?? positionals[0] ?? process.cwd(),
    json: values.json,
    verbose: values.verbose,
    noStore: values['no-store'],
    ci,
    color,
  });
  process.stdout.write(text);
  process.exitCode = exitCode;
}

try {
  await main();
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  const detail = process.env.APPSTORE_DOCTOR_DEBUG === '1' && err.stack ? err.stack : err.message.split('\n')[0];
  process.stderr.write(`appstore-doctor: ${detail}\n`);
  process.exitCode = 2;
}
