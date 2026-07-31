// Print the box metrics of one text run and its ancestors in both the source
// template and the JSON-rendered output, so a single element's spacing can be
// compared directly.
//
//   node scripts/probe-element.mjs 12-nature "Read the full report"

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_DIR = path.join(ROOT, 'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/html');
const OUT_DIR = path.join(ROOT, 'tmp/compare');

const [slug, label] = process.argv.slice(2);

const probe = (text) => {
  const leaf = [...document.querySelectorAll('*')].find((e) => !e.querySelector('*') && e.textContent.trim() === text);
  if (!leaf) return null;
  const chain = [];
  for (let n = leaf, i = 0; n && i < 6; n = n.parentElement, i++) {
    const r = n.getBoundingClientRect();
    const c = getComputedStyle(n);
    chain.push({
      tag: n.tagName,
      top: Math.round(r.top),
      h: Math.round(r.height),
      w: Math.round(r.width),
      pad: c.padding,
      lh: c.lineHeight,
      fs: c.fontSize,
    });
  }
  return chain;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 4000 } });

for (const [name, file] of [
  ['SRC', path.join(HTML_DIR, `${slug}.html`)],
  ['OUT', path.join(OUT_DIR, `${slug}.rendered.html`)],
]) {
  await page.goto(`file://${file}`, { waitUntil: 'networkidle' });
  console.log(name, JSON.stringify(await page.evaluate(probe, label), null, 1));
}

await browser.close();
