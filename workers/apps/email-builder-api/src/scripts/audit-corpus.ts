/**
 * Run the quality engine across the bundled reference templates.
 *
 * Not a test — a calibration harness. Rule thresholds are only defensible if
 * they produce sensible verdicts on templates we already consider good, so
 * this prints the score distribution and the most common findings to show
 * whether the engine is too lenient, too noisy, or about right.
 *
 *   pnpm --filter @maildrill/email-builder-api exec tsx src/scripts/audit-corpus.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeTemplate, isSendReady } from '../audit/index.js';
import type { EditorDocument } from '../audit/model.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const jsonDir = join(here, '..', '..', 'skills', 'email-builder', 'references', 'json');

// `tsx audit-corpus.ts 09.json` prints the full report for one template
// instead of the distribution, for checking whether a rule is really firing
// on something or just miscalibrated.
const only = process.argv[2];
if (only) {
  const document = JSON.parse(readFileSync(join(jsonDir, only), 'utf8')) as EditorDocument;
  const { report } = analyzeTemplate(document, { intent: 'template' });
  console.log(`\n${only} — overall ${report.overall}/100 (${report.overallBand})`);
  console.log(`Technical ${report.audit.total}/${report.audit.max} · Design signals ${report.critique.total}/${report.critique.max}\n`);
  for (const f of report.findings) {
    console.log(`[${f.severity}] ${f.ruleId} — ${f.title}`);
    console.log(`      ${f.detail}`);
    if (f.location.blockIds.length) console.log(`      blocks: ${f.location.blockIds.slice(0, 6).join(', ')}`);
  }
  console.log('\nStrengths:');
  for (const s of report.strengths) console.log(`  + ${s}`);
  process.exit(0);
}

const files = readdirSync(jsonDir).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error(`No reference templates in ${jsonDir}`);
  process.exit(1);
}

const ruleTally = new Map<string, number>();
const rows: { file: string; overall: number; audit: string; critique: string; p0: number; p1: number; ready: string }[] = [];

for (const file of files) {
  const document = JSON.parse(readFileSync(join(jsonDir, file), 'utf8')) as EditorDocument;
  // These are gallery templates, so unset hrefs and a platform-injected
  // unsubscribe are expected rather than defects.
  const { report } = analyzeTemplate(document, { intent: 'template' });

  for (const f of report.findings) {
    ruleTally.set(f.ruleId, (ruleTally.get(f.ruleId) ?? 0) + 1);
  }

  rows.push({
    file,
    overall: report.overall,
    audit: `${report.audit.total}/${report.audit.max}`,
    critique: `${report.critique.total}/${report.critique.max}`,
    p0: report.severityCounts.P0,
    p1: report.severityCounts.P1,
    ready: isSendReady(report) ? 'yes' : 'no',
  });
}

console.log('\nTemplate scores');
console.table(rows);

const overalls = rows.map((r) => r.overall).sort((a, b) => a - b);
const median = overalls[Math.floor(overalls.length / 2)];
console.log(
  `\nOverall: min ${overalls[0]}  median ${median}  max ${overalls[overalls.length - 1]}  ` +
    `send-ready ${rows.filter((r) => r.ready === 'yes').length}/${rows.length}`,
);

console.log('\nMost frequent findings');
console.table(
  [...ruleTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ruleId, count]) => ({ ruleId, templates: count, pct: `${Math.round((count / files.length) * 100)}%` })),
);
