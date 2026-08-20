/**
 * APCA contrast audit over the design tokens (src/styles/tokens.css).
 *
 * Implements the APCA-W3 algorithm (SAPC-4g constants) and checks every
 * text-on-surface pairing the app actually renders, in both themes, against
 * the APCA usage ladder:
 *
 *   BODY   Lc 75+  running/body text and essential small text
 *   LABEL  Lc 60+  UI labels, kickers, table headers, links, badges
 *   SPOT   Lc 45+  glanceable secondary text (timestamps, metas)
 *   FAINT  Lc 30+  placeholders, disabled, decorative glyphs
 *
 * Run: node scripts/apca-audit.mjs   (exits 1 when any pair fails)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');

/* ------------------------- token parsing ------------------------- */
function parseBlock(selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = parseBlock(':root');
const dark = { ...light, ...parseBlock("[data-theme='dark']") };

/* ------------------------- color plumbing ------------------------ */
function parseColor(v, vars) {
  v = v.trim();
  const varm = v.match(/^var\(--([\w-]+)\)$/);
  if (varm) return parseColor(vars[varm[1]], vars);
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = v.match(/^rgba?\(([\d.\s,]+)\)$/);
  if (rgba) {
    const parts = rgba[1].split(',').map((x) => parseFloat(x));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  throw new Error(`unparsable color: ${v}`);
}

/** Alpha-composite fg over an opaque base. */
function flatten(color, base) {
  const [r, g, b, a] = color;
  if (a >= 1) return [r, g, b];
  return [0, 1, 2].map((i) => Math.round(color[i] * a + base[i] * (1 - a)));
}

/* ----------------------------- APCA ------------------------------ */
const sRGBtoY = ([r, g, b]) =>
  0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;

function apcaLc(fg, bg) {
  const blkThrs = 0.022;
  const blkClmp = 1.414;
  let Ytx = sRGBtoY(fg);
  let Ybg = sRGBtoY(bg);
  if (Ytx < blkThrs) Ytx += (blkThrs - Ytx) ** blkClmp;
  if (Ybg < blkThrs) Ybg += (blkThrs - Ybg) ** blkClmp;
  if (Math.abs(Ybg - Ytx) < 0.0005) return 0;
  let sapc;
  if (Ybg > Ytx) {
    sapc = (Ybg ** 0.56 - Ytx ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  sapc = (Ybg ** 0.65 - Ytx ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

/* --------------------------- rule table -------------------------- */
const LEVELS = { BODY: 75, LABEL: 60, SPOT: 45, FAINT: 30 };

/** [role, fg token/value, bg token/value, level] — audited in both themes. */
const PAIRS = [
  ['body text (text) on surface', 'text', 'surface', 'BODY'],
  ['body text (text2) on surface', 'text2', 'surface', 'BODY'],
  ['secondary (text3) on surface', 'text3', 'surface', 'BODY'],
  ['labels/kickers (text4) on surface', 'text4', 'surface', 'LABEL'],
  ['labels/kickers (text4) on bg', 'text4', 'bg', 'LABEL'],
  ['labels/kickers (text4) on surface2', 'text4', 'surface2', 'LABEL'],
  ['decorative (muted) on surface', 'muted', 'surface', 'FAINT'],
  ['placeholder-ish (muted2) on surface', 'muted2', 'surface', 'FAINT'],
  ['accent link text on surface', 'accent-text', 'surface', 'LABEL'],
  ['accent link text on accent-tint', 'accent-text', 'accent-tint', 'LABEL'],
  ['button text on accent (pbtn)', 'accent-contrast', 'accent', 'LABEL'],
  ['success text on surface', 'success-text', 'surface', 'LABEL'],
  ['success badge (sent)', 'success-strong', 'success-bg', 'LABEL'],
  ['warning badge (sending)', 'warning-strong', 'warning-bg', 'LABEL'],
  ['danger text on surface', 'danger-text', 'surface', 'LABEL'],
  ['danger badge (bounced)', 'danger-strong', 'danger-bg', 'LABEL'],
  ['info badge (scheduled)', 'info', 'info-bg', 'LABEL'],
  ['email channel on tint', 'ch-email', 'ch-email-tint', 'SPOT'],
  ['sms channel on tint', 'ch-sms', 'ch-sms-tint', 'SPOT'],
  ['whatsapp channel on tint', 'ch-whatsapp', 'ch-whatsapp-tint', 'SPOT'],
  ['voice channel on tint', 'ch-voice', 'ch-voice-tint', 'SPOT'],
];

/* ----------------------------- audit ----------------------------- */
let failures = 0;
for (const [themeName, vars] of [
  ['light', light],
  ['dark', dark],
]) {
  const base = flatten(parseColor(vars.surface, vars), [255, 255, 255]);
  console.log(`\n■ ${themeName}`);
  for (const [role, fgTok, bgTok, level] of PAIRS) {
    const need = LEVELS[level];
    let fgRaw = vars[fgTok] ?? fgTok;
    let bgRaw = vars[bgTok] ?? bgTok;
    let bg, fg;
    try {
      bg = flatten(parseColor(bgRaw, vars), base);
      fg = flatten(parseColor(fgRaw, vars), bg);
    } catch (e) {
      console.log(`  ?? ${role}: ${e.message}`);
      failures++;
      continue;
    }
    const lc = Math.abs(apcaLc(fg, bg));
    const ok = lc >= need;
    if (!ok) failures++;
    const mark = ok ? 'ok ' : 'FAIL';
    console.log(`  ${mark} Lc ${lc.toFixed(1).padStart(5)} (need ${need}) ${role} [${level}]`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} pairing(s) below APCA target`);
  process.exit(1);
}
console.log('\nAll pairings meet APCA targets');
