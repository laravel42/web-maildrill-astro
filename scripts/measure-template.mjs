// Report the widths of the outer tables in the source vs rendered HTML so
// canvas-width drift (which silently changes every line break) is measurable.
//
//   node scripts/measure-template.mjs 16-textures

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] ?? '16-textures';

const targets = {
  source: `file://${ROOT}/packages/email-builder-standalone/src/App/ComponentsLibrary/templates/html/${slug}.html`,
  rendered: `file://${ROOT}/tmp/compare/${slug}.rendered.html`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 800 } });

for (const [label, url] of Object.entries(targets)) {
  await page.goto(url, { waitUntil: 'load' });
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll('table')].slice(0, 5).map((t) => {
      const r = t.getBoundingClientRect();
      return `${Math.round(r.width)}@${Math.round(r.left)}`;
    }),
  );
  console.log(label.padEnd(9), widths.join('  '));
}

await browser.close();
