// Visual diff harness for the Maildrill template import.
//
// Renders each converted email-builder document through the real Reader
// (`renderEmailHtml`) and screenshots it next to the source HTML so the
// conversion can be judged against the design instead of the schema.
//
//   ./node_modules/.bin/tsx scripts/compare-templates.mjs 01 02 04
//
// Output: tmp/compare/<slug>.png (source left, rendered right)

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

// The Reader barrel pulls in the editor NotionText, which imports CSS.
// Node can't parse that, so stub style imports before loading the tree.
const require = createRequire(import.meta.url);
for (const ext of ['.css', '.scss']) require.extensions[ext] = () => {};

// Some workspace packages are transpiled with the classic JSX runtime and
// rely on an ambient React binding.
globalThis.React = (await import('react')).default;

const { renderEmailHtml } = await import('../packages/email-builder/src/node.ts');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_DIR = path.join(ROOT, 'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/html');
const JSON_DIR = path.join(ROOT, 'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/json');
const OUT_DIR = path.join(ROOT, 'tmp/compare');

// Must stay above the 640px breakpoint `cleanDocument` emits, otherwise the
// builder side renders its mobile-stacked layout and the diff is meaningless.
const COL_WIDTH = 700;

function templates(filter) {
  return fs
    .readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((slug) => filter.length === 0 || filter.some((f) => slug.startsWith(f)))
    .sort();
}

async function pageHeight(page, url) {
  // scrollHeight is floored by the viewport, so shrink it before measuring or
  // each template inherits the previous (much taller) viewport.
  await page.setViewportSize({ width: COL_WIDTH, height: 200 });
  await page.goto(url, { waitUntil: 'networkidle' });
  return page.evaluate(() => document.documentElement.scrollHeight);
}

async function main() {
  const filter = process.argv.slice(2);
  const slugs = templates(filter);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: COL_WIDTH, height: 900 } });

  for (const slug of slugs) {
    const doc = JSON.parse(fs.readFileSync(path.join(JSON_DIR, `${slug}.json`), 'utf8'));
    const rendered = renderEmailHtml(doc, { rootBlockId: 'root' });
    const renderedPath = path.join(OUT_DIR, `${slug}.rendered.html`);
    fs.writeFileSync(renderedPath, rendered);

    const srcUrl = `file://${path.join(HTML_DIR, `${slug}.html`)}`;
    const outUrl = `file://${renderedPath}`;

    const h1 = await pageHeight(page, srcUrl);
    const h2 = await pageHeight(page, outUrl);
    const height = Math.max(h1, h2);

    const compare = `<!doctype html><html><body style="margin:0;background:#333;font:12px system-ui">
      <div style="display:flex;gap:8px">
        <div><div style="color:#fff;padding:4px">SOURCE</div>
          <iframe src="${srcUrl}" style="width:${COL_WIDTH}px;height:${height}px;border:0;background:#fff"></iframe></div>
        <div><div style="color:#fff;padding:4px">BUILDER JSON</div>
          <iframe src="${outUrl}" style="width:${COL_WIDTH}px;height:${height}px;border:0;background:#fff"></iframe></div>
      </div></body></html>`;
    const comparePath = path.join(OUT_DIR, `${slug}.compare.html`);
    fs.writeFileSync(comparePath, compare);

    await page.setViewportSize({ width: COL_WIDTH * 2 + 24, height: Math.min(height + 40, 30000) });
    await page.goto(`file://${comparePath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: true });
    console.log(`${slug}: source ${h1}px / rendered ${h2}px`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
