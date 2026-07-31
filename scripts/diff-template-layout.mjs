// Align the text runs of the source and rendered documents and report where
// their vertical positions start to drift, so spacing bugs can be traced to a
// specific block instead of eyeballed from a screenshot.
//
//   node scripts/diff-template-layout.mjs            # all templates, summary
//   node scripts/diff-template-layout.mjs 12-nature  # per-run detail

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_DIR = path.join(ROOT, 'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/html');
const OUT_DIR = path.join(ROOT, 'tmp/compare');

// Measure the text box, not the element box: a source button puts its padding
// on the same <a> that holds the label, while the reader puts the label in an
// inner <span>. Comparing element rects would read that as ~16px of drift.
const collectRuns = () =>
  [...document.querySelectorAll('*')]
    .filter((el) => !el.querySelector('*') && el.textContent.trim())
    .map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), top: Math.round(r.top) };
    })
    .filter((r) => r.text);

async function runs(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  return page.evaluate(collectRuns);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 4000 } });

const filter = process.argv.slice(2);
const slugs = fs
  .readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.rendered.html'))
  .map((f) => f.replace('.rendered.html', ''))
  .filter((s) => filter.length === 0 || filter.some((f) => s.startsWith(f)))
  .sort();

for (const slug of slugs) {
  const src = await runs(page, `file://${path.join(HTML_DIR, `${slug}.html`)}`);
  const out = await runs(page, `file://${path.join(OUT_DIR, `${slug}.rendered.html`)}`);

  // Queue per text so repeated strings ("Remote · EU", "○") pair up in document
  // order instead of every occurrence matching the first one.
  const queues = new Map();
  for (const r of out) {
    if (!queues.has(r.text)) queues.set(r.text, []);
    queues.get(r.text).push(r);
  }

  const entries = src.map((s) => {
    const o = queues.get(s.text)?.shift();
    return { text: s.text, delta: o ? o.top - s.top : null };
  });
  // The reader deliberately renders no page gutter around the canvas, while the
  // source pages wrap the card in one. That constant offset is harness chrome,
  // so drift is measured against the first matched run.
  const base = entries.find((e) => e.delta != null)?.delta ?? 0;
  let worst = { drift: 0, text: '' };
  let matched = 0;
  const rows = entries.map((e) => {
    if (e.delta == null) return `   MISSING  ${JSON.stringify(e.text)}`;
    matched += 1;
    const drift = e.delta - base;
    if (Math.abs(drift) > Math.abs(worst.drift)) worst = { drift, text: e.text };
    return `   ${String(drift).padStart(5)}  ${JSON.stringify(e.text)}`;
  });
  const missing = src.length - matched;
  console.log(
    `${slug.padEnd(16)} runs ${matched}/${src.length}` +
      `${missing ? ` (${missing} missing)` : ''}  max drift ${worst.drift}px @ ${JSON.stringify(worst.text)}`
  );
  if (filter.length) console.log(rows.join('\n'));
}

await browser.close();
