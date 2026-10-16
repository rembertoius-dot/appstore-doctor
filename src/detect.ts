import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ProjectKind } from './facts.js';
import { findXcodeProject } from './collect/native.js';

export type Detection = { kind: ProjectKind | 'none'; expoConfig?: string; xcodeproj?: string };

function hasExpoDependency(root: string): boolean {
  const pkg = join(root, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    const json = JSON.parse(readFileSync(pkg, 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(json.dependencies?.expo ?? json.devDependencies?.expo);
  } catch {
    return false;
  }
}

function expoConfigFile(root: string): string | undefined {
  for (const name of ['app.config.ts', 'app.config.js', 'app.config.mjs', 'app.config.cjs', 'app.json']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    if (name === 'app.json') {
      try {
        const json = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
        if (!('expo' in json)) continue;
      } catch {
        continue;
      }
    }
    return name;
  }
  return undefined;
}

export function detectProject(root: string): Detection {
  const expoConfig = hasExpoDependency(root) ? expoConfigFile(root) : undefined;
  const xcode = findXcodeProject(root);
  const xcodeproj = xcode ? relative(root, xcode.pbxproj).split('\\').join('/') : undefined;
  if (expoConfig && xcodeproj) return { kind: 'both', expoConfig, xcodeproj };
  if (expoConfig) return { kind: 'expo', expoConfig };
  if (xcodeproj) return { kind: 'native', xcodeproj };
  return { kind: 'none' };
}
