import type { BundleFacts, DeviceFamily, Provenance, UsageString } from '../facts.js';

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

export function bundleFromPlist(
  plist: Dict,
  entitlements: Dict,
  opts: { origin: 'expo' | 'native'; provenance: Provenance; bundleId?: string; deviceFamilies?: DeviceFamily[]; hasAppClip?: boolean },
): BundleFacts {
  const usageStrings: UsageString[] = Object.keys(plist)
    .filter((k) => /^NS.*UsageDescription$/.test(k))
    .sort()
    .map((key) => {
      const v = plist[key];
      return { key, value: typeof v === 'string' ? v : null, provenance: opts.provenance };
    });

  const atsRaw = plist.NSAppTransportSecurity;
  const ats = isDict(atsRaw)
    ? {
        allowsArbitraryLoads: atsRaw.NSAllowsArbitraryLoads === true,
        exceptionDomains: isDict(atsRaw.NSExceptionDomains) ? Object.keys(atsRaw.NSExceptionDomains) : [],
        provenance: opts.provenance,
      }
    : null;

  const rawId = typeof plist.CFBundleIdentifier === 'string' ? plist.CFBundleIdentifier : undefined;
  const bundleId = opts.bundleId ?? (rawId && !rawId.startsWith('$(') ? rawId : undefined);

  const families: DeviceFamily[] =
    opts.deviceFamilies ??
    (Array.isArray(plist.UIDeviceFamily)
      ? (plist.UIDeviceFamily as unknown[]).flatMap((n) => (n === 1 ? ['iphone'] : n === 2 ? ['ipad'] : []))
      : ['iphone']);

  const str = (k: string) => (typeof plist[k] === 'string' ? (plist[k] as string) : undefined);

  return {
    origin: opts.origin,
    bundleId,
    displayName: str('CFBundleDisplayName') ?? str('CFBundleName'),
    version: str('CFBundleShortVersionString'),
    build: str('CFBundleVersion'),
    deviceFamilies: families.length ? families : ['iphone'],
    usageStrings,
    ats,
    entitlements,
    hasAppClip: opts.hasAppClip ?? 'com.apple.developer.associated-appclip-app-identifiers' in entitlements,
    provenance: opts.provenance,
  };
}
