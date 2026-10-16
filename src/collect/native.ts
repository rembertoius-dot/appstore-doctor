import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse as parsePlist } from 'fast-plist';
import { ok, unavailable, type Available, type BundleFacts, type DeviceFamily } from '../facts.js';
import { bundleFromPlist } from './plist.js';

type Dict = Record<string, unknown>;

interface Block {
  id?: string;
  families?: string;
  infoPlist?: string;
}

const NOT_APP = /(Tests|UITests|\.Clip)$/i;

function setting(block: string, key: string): string | undefined {
  return new RegExp(`\\b${key} = "?([^";\\n]+)"?;`).exec(block)?.[1];
}

function parseBlocks(pbx: string): Block[] {
  const blocks: Block[] = [];
  for (const m of pbx.matchAll(/buildSettings = \{([\s\S]*?)\n\s*\};/g)) {
    const infoPlist = setting(m[1], 'INFOPLIST_FILE')?.replace(/^\$\((SRCROOT|PROJECT_DIR)\)\//, '');
    blocks.push({ id: setting(m[1], 'PRODUCT_BUNDLE_IDENTIFIER'), families: setting(m[1], 'TARGETED_DEVICE_FAMILY'), infoPlist });
  }
  return blocks;
}

const isAppBlock = (b: Block) => b.id !== undefined && !NOT_APP.test(b.id);

interface Located {
  pbxproj: string;
  base: string;
  targetDir: string | null;
  blocks: Block[];
}

function locate(root: string): Located | null {
  try {
    for (const dir of [join(root, 'ios'), root]) {
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      const proj = readdirSync(dir).find((n) => n.endsWith('.xcodeproj') && n !== 'Pods.xcodeproj');
      if (!proj) continue;
      const pbxproj = join(dir, proj, 'project.pbxproj');
      if (!existsSync(pbxproj)) continue;
      const blocks = parseBlocks(readFileSync(pbxproj, 'utf8'));

      let targetDir: string | null = null;
      // The app's bundle id is the prefix of its extensions' ids, so the shortest id wins.
      const candidates = blocks
        .filter((b) => b.infoPlist && isAppBlock(b) && existsSync(join(dir, b.infoPlist)))
        .sort((a, b) => (a.id as string).length - (b.id as string).length);
      if (candidates[0]?.infoPlist) targetDir = dirname(join(dir, candidates[0].infoPlist));
      if (!targetDir) {
        const name = proj.replace(/\.xcodeproj$/, '');
        const candidates = [join(dir, name), ...readdirSync(dir).map((n) => join(dir, n))].filter(
          (d) => existsSync(join(d, 'Info.plist')) && !/^(Pods|.*Tests|.*Clip)$/i.test(relative(dir, d)),
        );
        targetDir = candidates[0] ?? null;
      }
      return { pbxproj, base: dir, targetDir, blocks };
    }
  } catch {
    return null;
  }
  return null;
}

/** Finds `<root>/ios/<Name>.xcodeproj` or `<root>/<Name>.xcodeproj` and the app target folder. */
export function findXcodeProject(root: string): { pbxproj: string; targetDir: string } | null {
  const l = locate(root);
  return l && l.targetDir ? { pbxproj: l.pbxproj, targetDir: l.targetDir } : null;
}

function readPlist(file: string): Dict {
  const text = readFileSync(file, 'utf8');
  if (text.startsWith('bplist')) throw new Error('binary plist; run plutil -convert xml1');
  const parsed = parsePlist(text) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('top level is not a dictionary');
  return parsed as Dict;
}

export function collectNative(root: string): Available<BundleFacts> {
  const rel = (p: string) => relative(root, p).split('\\').join('/');
  try {
    const found = locate(root);
    if (!found) return unavailable('no Xcode project found (looked for ios/*.xcodeproj and *.xcodeproj)');
    if (!found.targetDir) {
      return unavailable(
        `Xcode project found at ${rel(found.pbxproj)} but no Info.plist for the app target (GENERATE_INFOPLIST_FILE or a custom INFOPLIST_FILE path is not supported yet)`,
      );
    }
    const plistPath = join(found.targetDir, 'Info.plist');

    let plist: Dict;
    try {
      plist = readPlist(plistPath);
    } catch (e) {
      return unavailable(`could not parse ${rel(plistPath)}: ${(e as Error).message}`);
    }

    const relPlist = relative(found.base, plistPath).split('\\').join('/');
    const block =
      found.blocks.find((b) => isAppBlock(b) && b.infoPlist && (b.infoPlist === relPlist || b.infoPlist.endsWith(`/${relPlist}`))) ??
      found.blocks.find(isAppBlock);

    const literal = typeof plist.CFBundleIdentifier === 'string' && !plist.CFBundleIdentifier.startsWith('$(');
    const bundleId = literal ? undefined : block?.id;
    const deviceFamilies = block?.families
      ? (block.families.split(',').flatMap((n) => (n.trim() === '1' ? ['iphone'] : n.trim() === '2' ? ['ipad'] : [])) as DeviceFamily[])
      : undefined;

    let entitlements: Dict = {};
    const entFile = readdirSync(found.targetDir).find((n) => n.endsWith('.entitlements'));
    if (entFile) {
      const entPath = join(found.targetDir, entFile);
      try {
        entitlements = readPlist(entPath);
      } catch (e) {
        return unavailable(`could not parse ${rel(entPath)}: ${(e as Error).message}`);
      }
    }

    return ok(
      bundleFromPlist(plist, entitlements, {
        origin: 'native',
        provenance: { file: rel(plistPath) },
        bundleId,
        deviceFamilies: deviceFamilies && deviceFamilies.length ? deviceFamilies : undefined,
      }),
    );
  } catch (e) {
    return unavailable(`could not read the Xcode project: ${(e as Error).message}`);
  }
}
