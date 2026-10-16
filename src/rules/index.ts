import type { Rule } from './types.js';
import { usageStringPresent } from './permissions/usage-string-present.js';
import { usageStringEmpty } from './permissions/usage-string-empty.js';
import { usageStringTemplate } from './permissions/usage-string-template.js';
import { atsArbitraryLoads } from './network/ats-arbitrary-loads.js';
import { prebuildDrift } from './expo/prebuild-drift.js';

export const RULES: Rule[] = [usageStringPresent, usageStringEmpty, usageStringTemplate, atsArbitraryLoads, prebuildDrift];
