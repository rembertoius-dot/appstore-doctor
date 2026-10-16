import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectCapabilities } from './collect/capabilities.js';
import { collectExpo, defaultRunner, type Runner } from './collect/expo.js';
import { collectNative } from './collect/native.js';
import { detectProject } from './detect.js';
import { unavailable, type Facts } from './facts.js';
import { buildReport } from './report/build.js';
import { renderJson } from './report/json.js';
import { renderTerminal } from './report/terminal.js';
import type { Report } from './report/types.js';
import { RULES } from './rules/index.js';
import { runRules } from './rules/run.js';
import { scoreResults } from './score.js';
import { verifyItems } from './verify.js';

export type RunOptions = { path: string; json: boolean; verbose: boolean; noStore: boolean; ci: number | false; color: boolean };
export type RunDeps = { runner: Runner; version: string };

function packageVersion(): string {
  try {
    return (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

export async function collectFacts(root: string, runner: Runner): Promise<Facts | null> {
  const detected = detectProject(root);
  if (detected.kind === 'none') return null;
  const facts: Facts = {
    root,
    project: { kind: detected.kind },
    bundle: unavailable('not collected'),
    nativeBundle: unavailable('no ios/ folder'),
    capabilities: unavailable('not collected'),
    store: unavailable('no App Store Connect key'),
  };
  if (detected.kind === 'expo' || detected.kind === 'both') {
    const { bundle, sdk } = await collectExpo(root, runner);
    facts.bundle = bundle;
    facts.project.expoSdk = sdk;
    if (detected.kind === 'both') facts.nativeBundle = collectNative(root);
  } else {
    facts.bundle = collectNative(root);
  }
  facts.capabilities = collectCapabilities(root);
  return facts;
}

export async function run(opts: RunOptions, deps: Partial<RunDeps> = {}): Promise<{ report?: Report; text: string; exitCode: 0 | 1 | 2 }> {
  const runner = deps.runner ?? defaultRunner;
  const version = deps.version ?? packageVersion();
  const root = resolve(opts.path);

  const facts = await collectFacts(root, runner);
  if (!facts) {
    return {
      text: `No iOS project found in ${root}.\nLooked for: app.json or app.config.* with an "expo" dependency, ios/*.xcodeproj, *.xcodeproj.\n`,
      exitCode: 2,
    };
  }

  const results = runRules(facts, RULES);
  const scored = scoreResults(results);
  const report = buildReport({ facts, results, scored, verify: verifyItems(facts), version, codeOnly: true });
  const text = opts.json ? renderJson(report) : renderTerminal(report, { color: opts.color, verbose: opts.verbose });

  let exitCode: 0 | 1 | 2 = 0;
  if (opts.ci !== false && (report.score < opts.ci || scored.label === 'Partial scan')) exitCode = 1;
  return { report, text, exitCode };
}
