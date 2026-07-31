// Compare the computed typography of one snippet of copy in the source vs
// the rendered document — the fastest way to explain a line-break mismatch.
//
//   node scripts/measure-text.mjs 16-textures "Real material"

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] ?? '16-textures';
const needle = process.argv[3] ?? 'Real material';

const targets = {
  source: `file://${ROOT}/packages/email-builder-standalone/src/App/ComponentsLibrary/templates/html/${slug}.html`,
  rendered: `file://${ROOT}/tmp/compare/${slug}.rendered.html`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 800 } });

for (const [label, url] of Object.entries(targets)) {
  await page.goto(url, { waitUntil: 'load' });
  const info = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('*')]
      .filter((n) => n.textContent?.includes(text) && !n.querySelector('*'))
      .pop();
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      box: `${Math.round(r.width)}x${Math.round(r.height)}`,
      font: cs.fontSize,
      family: cs.fontFamily.slice(0, 30),
      weight: cs.fontWeight,
      spacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
    };
  }, needle);
  console.log(label.padEnd(9), JSON.stringify(info));
}

await browser.close();
