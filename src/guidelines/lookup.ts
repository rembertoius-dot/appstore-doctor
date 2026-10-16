import { readFileSync } from 'node:fs';

export type Clause = { id: string; title: string; url: string; excerpt: string; reviewedOn: string };

let cache: Clause[] | null = null;
function load(): Clause[] {
  if (!cache) cache = JSON.parse(readFileSync(new URL('./index.json', import.meta.url), 'utf8')) as Clause[];
  return cache;
}
export function allClauses(): Clause[] { return load(); }
export function clause(id: string): Clause | undefined { return load().find((c) => c.id === id); }
export function guidelinesReviewedOn(): string { return load()[0]?.reviewedOn ?? 'unknown'; }
