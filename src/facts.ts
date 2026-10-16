// Facts are what collectors produce. They never judge. Every fact says where it came from.

export type Provenance = { file: string; line?: number } | { api: string } | { command: string };

export type Available<T> = { status: 'ok'; value: T } | { status: 'unavailable'; reason: string };
export const ok = <T>(value: T): Available<T> => ({ status: 'ok', value });
export const unavailable = <T = never>(reason: string): Available<T> => ({ status: 'unavailable', reason });

/** A usage-description key. `value` is null when the key exists but is not a string. */
export type UsageString = { key: string; value: string | null; provenance: Provenance };

export type DeviceFamily = 'iphone' | 'ipad';

export type BundleFacts = {
  origin: 'expo' | 'native';
  bundleId?: string;
  displayName?: string;
  version?: string;
  build?: string;
  deviceFamilies: DeviceFamily[];
  usageStrings: UsageString[];
  ats: { allowsArbitraryLoads: boolean; exceptionDomains: string[]; provenance: Provenance } | null;
  entitlements: Record<string, unknown>;
  hasAppClip: boolean;
  provenance: Provenance;
};

export type Capability =
  | 'camera' | 'microphone' | 'location' | 'contacts' | 'photos' | 'bluetooth' | 'health'
  | 'tracking' | 'faceId' | 'calendar' | 'motion' | 'speech' | 'localNetwork';

/** Something that establishes a capability is linked into the binary. */
export type CapabilityFact = { capability: Capability; via: 'pod' | 'symbol'; name: string; provenance: Provenance };

export type ProjectKind = 'expo' | 'native' | 'both';

export type Facts = {
  root: string;
  project: { kind: ProjectKind; expoSdk?: string };
  /** The bundle that ships: Expo's resolved config when Expo is present, else the ios/ files. */
  bundle: Available<BundleFacts>;
  /** The ios/ files when both Expo and ios/ exist (for drift); unavailable otherwise. */
  nativeBundle: Available<BundleFacts>;
  capabilities: Available<CapabilityFact[]>;
  /** App Store Connect facts arrive in Plan 3. Always unavailable in this plan. */
  store: Available<Record<string, never>>;
};
