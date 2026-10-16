// Builds src/guidelines/index.json from a local Markdown copy of the App Store Review Guidelines.
// Usage: tsx scripts/build-guidelines-index.ts <review-guidelines.md> <reviewedOn YYYY-MM-DD>
// The package ships only ids, titles, the page URL and an excerpt of at most 25 words.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , source, reviewedOn] = process.argv;
if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn ?? '')) {
  console.error('usage: build-guidelines-index <review-guidelines.md> <YYYY-MM-DD>');
  process.exit(2);
}
const PAGE_URL = 'https://developer.apple.com/app-store/review/guidelines/';
const lines = readFileSync(source, 'utf8').split('\n');

type Clause = { id: string; title: string; url: string; excerpt: string; reviewedOn: string };
const out = new Map<string, Clause>();
const ROMAN = /^- \((i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\)\s+(.*)$/;
const LETTER = /^- \(([a-z])\)\s+(.*)$/;
const HEADING = /^#{2,4}\s+(\d+(?:\.\d+)*)(?![.\d])\s*(.*)$/;
const BOLD = /^\*\*(\d+(?:\.\d+)*)\*\*\s*(?:\(([a-z])\)\s*)?(.*)$/;

function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return cut.slice(0, space > 0 ? space : cut.length).replace(/[\s,;:-]+$/, '') + '…';
}

function titleAndExcerpt(text: string): { title: string; excerpt: string } {
  const clean = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/^-\s+/, '')
    .trim();
  const colon = clean.indexOf(':');
  const labelled = colon > 0 && colon <= 60;
  const title = labelled ? clean.slice(0, colon).trim() : cutAtWord(clean.split(/(?<=\.)\s/)[0], 80);
  const after = labelled ? clean.slice(colon + 1).trim() : '';
  const body = after || clean;
  const excerpt = body.split(/\s+/).filter(Boolean).slice(0, 25).join(' ');
  return { title, excerpt };
}

function put(c: Clause): void {
  if (out.has(c.id)) console.error(`warning: duplicate id ${c.id}`);
  out.set(c.id, c);
}

let current = '';
let untitled = false; // the current heading had no title; the next non-empty line supplies one
for (const raw of lines) {
  const line = raw.trimEnd();
  let m = HEADING.exec(line);
  if (m) {
    current = m[1];
    const { title } = titleAndExcerpt(m[2]);
    untitled = title === '';
    put({ id: current, title, url: PAGE_URL, excerpt: '', reviewedOn });
    continue;
  }
  if (untitled && line) {
    const first = titleAndExcerpt(line.replace(/^- \([a-z]+\)\s+/, ''));
    out.get(current)!.title = first.title;
    untitled = false;
  }
  m = BOLD.exec(line);
  if (m) {
    const id = m[2] ? `${m[1]}(${m[2]})` : m[1];
    current = m[1];
    const { title, excerpt } = titleAndExcerpt(m[3]);
    const existing = out.get(id);
    put({ id, title: existing?.title || title, url: PAGE_URL, excerpt, reviewedOn });
    continue;
  }
  m = ROMAN.exec(line) ?? LETTER.exec(line);
  if (m && current) {
    const id = `${current}(${m[1]})`;
    const { title, excerpt } = titleAndExcerpt(m[2]);
    put({ id, title, url: PAGE_URL, excerpt, reviewedOn });
    continue;
  }
  // First paragraph after a heading becomes its excerpt.
  if (current && line && !line.startsWith('#') && out.get(current) && !out.get(current)!.excerpt) {
    out.get(current)!.excerpt = titleAndExcerpt(line).excerpt;
  }
}

const sorted = [...out.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
writeFileSync(new URL('../src/guidelines/index.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
console.log(`wrote ${sorted.length} clauses, reviewedOn ${reviewedOn}`);
