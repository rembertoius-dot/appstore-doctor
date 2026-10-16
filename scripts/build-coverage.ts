// Generates docs/coverage.md from the guidelines index, keeping bins already set by hand.
// Usage: tsx scripts/build-coverage.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { allClauses } from '../src/guidelines/lookup.js';

const target = new URL('../docs/coverage.md', import.meta.url);
const existing = new Map<string, { bin: string; rule: string; note: string }>();
if (existsSync(target)) {
  for (const l of readFileSync(target, 'utf8').split('\n')) {
    if (!/^\| \d/.test(l) && !/^\| Before/.test(l) && !/^\| App Clips/.test(l)) continue;
    const [clause, , bin, rule, note] = l.slice(1, -1).split('|').map((c) => c.trim());
    existing.set(clause, { bin, rule, note });
  }
}

const header = `# Coverage map

Every clause of the App Store Review Guidelines (index reviewed ${allClauses()[0]?.reviewedOn}) and what AppStore Doctor does with it.

- **machine**: decided from collected facts; scores. At least one rule is implemented.
- **potential**: evidence shown with named exceptions; never scores.
- **planned**: a rule is promised (named with \`(planned)\`) but not implemented yet; nothing is checked.
- **agent**: needs judgment; listed under "Needs a reviewer" and in the agent prompt.
- **n/a**: category-specific, needs a running device, or not observable from a project. Reason in Note.

Regenerate the skeleton with \`npm run coverage-map\`; it keeps bins set by hand.

| Clause | Title | Bin | Rule | Note |
| --- | --- | --- | --- | --- |
`;
const rows = allClauses().map((c) => {
  const e = existing.get(c.id) ?? { bin: 'agent', rule: '', note: '' };
  return `| ${c.id} | ${c.title.replace(/\|/g, '/')} | ${e.bin} | ${e.rule} | ${e.note} |`;
});
writeFileSync(target, header + rows.join('\n') + '\n');
console.log(`wrote ${rows.length} rows`);
