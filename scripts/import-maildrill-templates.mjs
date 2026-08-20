#!/usr/bin/env node
/**
 * Convert Maildrill send-ready HTML emails → email-builder documents.
 *
 * Writes HTML companions, localPresets templates[], and AI json/ndjson presets.
 * Usage: ./node_modules/.bin/tsx scripts/import-maildrill-templates.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const HTML_DIR = path.join(
  ROOT,
  'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/html',
);
const JSON_DIR = path.join(
  ROOT,
  'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/json',
);
const AI_JSON_DIR = path.join(
  ROOT,
  'workers/apps/email-builder-api/skills/email-builder/references/json',
);
const AI_PRESET_DIR = path.join(
  ROOT,
  'workers/apps/email-builder-api/skills/email-builder/references/presets',
);
const LOCAL_PRESETS = path.join(
  ROOT,
  'packages/email-builder-standalone/src/App/ComponentsLibrary/localPresets.data.json',
);

const META = [
  { nn: '01', slug: 'business', name: 'Business', description: 'Quarterly review letter' },
  { nn: '02', slug: 'technology', name: 'Technology', description: 'Product launch' },
  { nn: '03', slug: 'ai', name: 'AI', description: 'Capability announcement' },
  { nn: '04', slug: 'saas', name: 'SaaS', description: 'Welcome / onboarding' },
  { nn: '05', slug: 'marketing', name: 'Marketing', description: 'Campaign performance report' },
  { nn: '06', slug: 'social-media', name: 'Social Media', description: 'Community roundup' },
  { nn: '07', slug: 'finance', name: 'Finance', description: 'Statement' },
  { nn: '08', slug: 'healthcare', name: 'Healthcare', description: 'Appointment reminder' },
  { nn: '09', slug: 'education', name: 'Education', description: 'Term enrollment' },
  { nn: '10', slug: 'food', name: 'Food', description: 'Menu & recipe letter' },
  { nn: '11', slug: 'travel', name: 'Travel', description: 'Itinerary confirmation' },
  { nn: '12', slug: 'nature', name: 'Nature', description: 'Impact report' },
  { nn: '13', slug: 'architecture', name: 'Architecture', description: 'Project showcase' },
  { nn: '14', slug: 'backgrounds', name: 'Backgrounds', description: 'Asset pack release' },
  { nn: '15', slug: 'abstract', name: 'Abstract', description: 'Print drop' },
  { nn: '16', slug: 'textures', name: 'Textures', description: 'Material pack release' },
  { nn: '17', slug: 'people', name: 'People', description: 'Culture & hiring note' },
  { nn: '18', slug: 'lifestyle', name: 'Lifestyle', description: 'Editorial promotion' },
  { nn: '19', slug: 'sports', name: 'Sports', description: 'Match day' },
  { nn: '20', slug: 'holidays', name: 'Holidays', description: 'Seasonal promotion' },
];

const ZERO = { top: 0, bottom: 0, right: 0, left: 0 };
/** Matches MAX_WIDTH_DESKTOP in the builder and `width:600px` in the sources. */
const CANVAS_WIDTH = 600;

let seq = 0;
function nid(prefix = 'block') {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

function hex6(c) {
  if (!c) return null;
  let s = String(c).trim().toLowerCase();
  if (!s.startsWith('#')) return null;
  if (/^#[0-9a-f]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toUpperCase();
  }
  return null;
}

function parseStyle(styleAttr) {
  const out = {};
  if (!styleAttr) return out;
  for (const part of styleAttr.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

function px(v) {
  if (v == null) return null;
  const m = String(v).match(/(-?\d+(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1])) : null;
}

function pad4(style, fallback = ZERO) {
  let out = { ...fallback };
  const p = style.padding;
  if (p) {
    const parts = p
      .trim()
      .split(/\s+/)
      .map((x) => px(x) ?? 0);
    if (parts.length === 1)
      out = { top: parts[0], bottom: parts[0], right: parts[0], left: parts[0] };
    else if (parts.length === 2)
      out = { top: parts[0], bottom: parts[0], right: parts[1], left: parts[1] };
    else if (parts.length === 3)
      out = { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    else out = { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
  // Longhands win over the shorthand, mirroring CSS cascade order in these
  // templates (`padding:0 0 10px` alongside `padding-right:14px`).
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const v = px(style[`padding-${side}`]);
    if (v != null) out[side] = v;
  }
  return out;
}

/**
 * Vertical margins on a wrapper element. The builder has no margin, so they
 * are folded into the padding of the first / last block the element produced.
 */
function marginY(style) {
  let top = 0;
  let bottom = 0;
  if (style.margin) {
    const parts = style.margin
      .trim()
      .split(/\s+/)
      .map((x) => px(x) ?? 0);
    if (parts.length === 1) [top, bottom] = [parts[0], parts[0]];
    else if (parts.length >= 3) [top, bottom] = [parts[0], parts[2]];
    else [top, bottom] = [parts[0], parts[0]];
  }
  top = px(style['margin-top']) ?? top;
  bottom = px(style['margin-bottom']) ?? bottom;
  return { top: Math.max(0, top), bottom: Math.max(0, bottom) };
}

function applyMarginY(ids, style, doc) {
  const { top, bottom } = marginY(style);
  if (!top && !bottom) return ids;
  const edge = (id, side, amount) => {
    const s = doc[id]?.data?.style;
    if (!s) return;
    s.padding = addPad(s.padding, { [side]: amount });
  };
  if (top) edge(ids[0], 'top', top);
  if (bottom) edge(ids[ids.length - 1], 'bottom', bottom);
  return ids;
}

function isZeroPad(p) {
  return !p || (!p.top && !p.right && !p.bottom && !p.left);
}

function addPad(a, b) {
  return {
    top: (a?.top || 0) + (b?.top || 0),
    right: (a?.right || 0) + (b?.right || 0),
    bottom: (a?.bottom || 0) + (b?.bottom || 0),
    left: (a?.left || 0) + (b?.left || 0),
  };
}

/**
 * Map to the catalog's web-safe system stacks, not to lookalike Google
 * fonts — Lora/Open Sans have different metrics from Georgia/Verdana and
 * every line break in the template shifts.
 */
function mapFont(stack) {
  const s = (stack || '').toLowerCase();
  if (s.includes('georgia') || s.includes('times')) return 'CLASSIC_SERIF';
  // The first family in the stack is the one that resolves, and Tahoma is
  // measurably narrower than Verdana — collapsing both into one key rewraps
  // every line of the Tahoma-first templates.
  if (/^\s*tahoma\b/.test(s)) return 'COMPACT_SANS';
  if (s.includes('verdana') || s.includes('tahoma') || s.includes('geneva')) return 'WIDE_SANS';
  return 'MODERN_SANS';
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingClose(html, tag, from = 0) {
  const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
  const closeRe = new RegExp(`</${tag}>`, 'gi');
  openRe.lastIndex = from;
  const first = openRe.exec(html);
  if (!first) return -1;
  let depth = 1;
  let i = first.index + first[0].length;
  while (i < html.length && depth > 0) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (!c) return -1;
    if (o && o.index < c.index) {
      depth += 1;
      i = o.index + o[0].length;
    } else {
      depth -= 1;
      i = c.index + c[0].length;
      if (depth === 0) return c.index;
    }
  }
  return -1;
}

function extractElement(html, tag, from = 0) {
  const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'i');
  const slice = html.slice(from);
  const m = openRe.exec(slice);
  if (!m) return null;
  const abs = from + m.index;
  const openEnd = abs + m[0].length;
  if (/\/>$/.test(m[0]) || /^(img|br|hr|meta|input)$/i.test(tag)) {
    return { start: abs, end: openEnd, open: m[0], inner: '' };
  }
  const closeStart = findMatchingClose(html, tag, abs);
  if (closeStart < 0) return null;
  return {
    start: abs,
    end: closeStart + tag.length + 3,
    open: m[0],
    inner: html.slice(openEnd, closeStart),
  };
}

function extractTopLevelTrs(tableInner) {
  const trs = [];
  let i = 0;
  while (i < tableInner.length) {
    const el = extractElement(tableInner, 'tr', i);
    if (!el) break;
    trs.push(el);
    i = el.end;
  }
  return trs;
}

function extractWrapTable(html) {
  const m = /<table[^>]*class="wrap"[^>]*>/i.exec(html);
  if (!m) throw new Error('wrap table not found');
  const start = m.index;
  const closeStart = findMatchingClose(html, 'table', start);
  if (closeStart < 0) throw new Error('wrap table unclosed');
  const open = m[0];
  return {
    open,
    inner: html.slice(start + open.length, closeStart),
    style: parseStyle(attrs(open).style || ''),
  };
}

function borderFromStyle(style) {
  const out = { top: 0, bottom: 0, left: 0, right: 0, color: null };
  const apply = (side, raw) => {
    if (!raw || raw === '0' || raw === 'none') return;
    const w = px(raw);
    if (w != null) out[side] = Math.max(out[side], w);
    const c = raw.match(/#[0-9a-fA-F]{3,6}/);
    if (c) out.color = hex6(c[0]);
  };
  for (const side of ['top', 'bottom', 'left', 'right']) {
    apply(side, style[`border-${side}`] || style.border);
  }
  return out;
}

function radiusShape(r) {
  if (!r || r <= 0) return 'rectangle';
  if (r >= 999) return 'pill';
  return { topLeft: r, topRight: r, bottomLeft: r, bottomRight: r };
}

function isSpacerDiv(style, inner) {
  const h = px(style.height);
  return h != null && h > 0 && h <= 64 && !stripTags(inner);
}

function isDividerDiv(style, inner) {
  if (stripTags(inner)) return false;
  const bt = style['border-top'] || '';
  return bt.includes('solid') && (px(bt) || 0) >= 1;
}

function isButtonTable(tableInner) {
  if (!/<a\s/i.test(tableInner) || !/display\s*:\s*block/i.test(tableInner)) return false;
  return (
    /bgcolor=["']?#[0-9a-fA-F]{3,6}/i.test(tableInner) ||
    /border\s*:\s*1px\s+solid/i.test(tableInner) ||
    /border:\s*1px\s+solid/i.test(tableInner)
  );
}

function parseButton(tableEl, doc, outerPad, ctx) {
  const tableInner = tableEl.inner;
  const canvasColor = ctx.canvasColor;
  const a = /<a\s([^>]*)>([\s\S]*?)<\/a>/i.exec(tableInner);
  if (!a) return null;
  const aAttrs = attrs(`<a ${a[1]}>`);
  const aStyle = parseStyle(aAttrs.style || '');
  const tdMatch = /<td\b([^>]*)>/i.exec(tableInner);
  const tdAttrs = tdMatch ? attrs(`<td ${tdMatch[1]}>`) : {};
  const tdStyle = parseStyle(tdAttrs.style || '');
  const tdBg = hex6(tdAttrs.bgcolor) || hex6(tdStyle['background-color']);
  const border = borderFromStyle(tdStyle);
  const outline = !tdBg && border.color;
  const bg = tdBg || (outline ? canvasColor || '#FBFAF7' : '#4F46E5');
  const color = hex6(aStyle.color) || (outline ? border.color : '#FFFFFF');
  // The Button block renders its label verbatim — it has no text-transform —
  // so an uppercased design has to be baked into the text.
  const raw = stripTags(a[2]);
  const text = aStyle['text-transform'] === 'uppercase' ? raw.toUpperCase() : raw;
  const fontSize = px(aStyle['font-size']) || 16;
  const radius = px(aStyle['border-radius']) || px(tdStyle['border-radius']) || 8;
  const btnPad = pad4(aStyle, { top: 16, bottom: 16, right: 30, left: 30 });
  const tableAttrs = attrs(tableEl.open);
  const tableStyle = parseStyle(tableAttrs.style || '');
  // A pill is only centred when the source table says so; otherwise it sits
  // at the start of the cell.
  const align = (tableAttrs.align || '').toLowerCase();
  const fullWidth = [tableAttrs.width, tableStyle.width].some((w) => /^\s*100%\s*$/.test(w || ''));
  const font = aStyle['font-family'] ? mapFont(aStyle['font-family']) : null;
  const id = nid('btn');
  const style = {
    backgroundColor: null,
    fontSize,
    fontFamily: font && font !== ctx.rootFont ? font : null,
    fontWeight: 'bold',
    lineHeight: aStyle['line-height'] || 'normal',
    textAlign: ['center', 'right'].includes(align) ? align : 'left',
    padding: outerPad || { top: 8, bottom: 8, right: 0, left: 0 },
    shape: radiusShape(radius),
  };
  if (outline) {
    style.borderColor = border.color;
    style.borderTop = border.top || 1;
    style.borderBottom = border.bottom || 1;
    style.borderLeft = border.left || 1;
    style.borderRight = border.right || 1;
  }
  doc[id] = {
    type: 'Button',
    data: {
      style,
      props: {
        buttonBackgroundColor: bg,
        buttonTextColor: color,
        fullWidth: !!fullWidth,
        text,
        url: aAttrs.href || 'https://example.com',
        size: {
          top: btnPad.top,
          bottom: btnPad.bottom,
          left: btnPad.left,
          right: btnPad.right,
        },
      },
    },
  };
  return id;
}

/**
 * The reader resolves width as: `size === 'fill'` → 100%, `size === 'scale'`
 * → `scale%`, anything else → the literal `width` in px. Every image in these
 * templates is authored as `width:100%;max-width:Npx`, i.e. it fills whatever
 * cell it lands in — so `fill` is the faithful mapping. Emitting `scale`
 * (N/600) instead shrinks column images to a fraction of their column.
 */
function parseImage(openTag, outerPad = ZERO, align = 'center', avail = CANVAS_WIDTH) {
  const a = attrs(openTag);
  const style = parseStyle(a.style || '');
  if (!a.src) return null;
  const maxWidth = px(style['max-width']);
  const width = maxWidth || Number(a.width) || px(style.width) || 600;
  // `width:100%;max-width:Npx` only behaves like `fill` while the cell is
  // narrower than the cap; past that the source clamps to N px and the
  // builder (which has no max-width) has to be told the pixel value.
  const fluid = /^\s*100%\s*$/.test(style.width || '') && avail <= width + 2;
  const r = px(style['border-radius']) || 0;
  return {
    id: nid('img'),
    block: {
      type: 'Image',
      data: {
        style: {
          padding: { ...outerPad },
          // The source paints its placeholder tint on the <img> itself; on the
          // block it would bleed across the whole cell.
          backgroundColor: null,
          textAlign: align,
          shape: radiusShape(r),
        },
        props: {
          url: a.src,
          alt: a.alt || '',
          width,
          size: fluid ? 'fill' : 'pixel',
          scale: null,
          original_width: width,
        },
      },
    },
  };
}

function notionFromDiv(style, innerHtml, pad = ZERO, alignHint, rootFont) {
  const text = stripTags(innerHtml);
  if (!text) return null;
  let body = innerHtml
    .trim()
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '');
  // Preserve anchors; wrap in a styled span for letter-spacing / text-transform.
  // EmailLayout puts `letter-spacing:0.15008px` on the root, which every text
  // block inherits — so tracking has to be written out even when the source
  // says `normal`, otherwise copy runs wide and re-wraps.
  const extras = [`letter-spacing:${style['letter-spacing'] || 'normal'}`];
  if (style['text-transform'] && style['text-transform'] !== 'none') {
    extras.push(`text-transform:${style['text-transform']}`);
  }
  body = `<span style="${extras.join(';')}">${body}</span>`;
  const html = `<p>${body}</p>`;
  const fontSize = px(style['font-size']) || 15;
  const color = hex6(style.color) || '#1F1E1B';
  const weight =
    String(style['font-weight'] || '').includes('bold') || style['font-weight'] === '700'
      ? 'bold'
      : 'normal';
  const align = (alignHint || style['text-align'] || 'left').toLowerCase();
  const textAlign = ['left', 'center', 'right', 'justify'].includes(align) ? align : 'left';
  const font = style['font-family'] ? mapFont(style['font-family']) : null;
  const id = nid();
  return {
    id,
    block: {
      type: 'NotionText',
      data: {
        style: {
          color,
          backgroundColor: null,
          fontSize,
          fontFamily: font && font !== rootFont ? font : null,
          fontWeight: weight,
          textAlign,
          lineHeight: style['line-height'] ? String(style['line-height']) : null,
          padding: { ...pad },
        },
        props: { html },
      },
    },
  };
}

function collectTds(trInner) {
  const cells = [];
  let i = 0;
  while (i < trInner.length) {
    const td = extractElement(trInner, 'td', i);
    if (!td) break;
    cells.push(td);
    i = td.end;
  }
  return cells;
}

/** Wrap blocks in a Container carrying a table/cell's chrome (bg, border, radius). */
function wrapCard(childIds, chrome, doc) {
  if (!childIds.length) return childIds;
  const { bg, border, radius, padding } = chrome;
  const hasChrome = bg || border.color || radius;
  if (!hasChrome && isZeroPad(padding)) return childIds;
  // Keep the authored sides: a lone `border-bottom` separator must not become
  // a full box just because a colour is present.
  const sides = ['top', 'bottom', 'left', 'right'];
  const anySide = sides.some((s) => border[s] > 0);
  const width = (side) => (border.color ? (anySide ? border[side] || 0 : 1) : 0);
  const id = nid('card');
  doc[id] = {
    type: 'Container',
    data: {
      style: {
        backgroundColor: bg,
        borderColor: border.color,
        borderTop: width('top'),
        borderBottom: width('bottom'),
        borderLeft: width('left'),
        borderRight: width('right'),
        shape: radiusShape(radius),
        padding: { ...padding },
      },
      props: { childrenIds: childIds },
    },
  };
  return [id];
}

/** Cells of a table's first row — the shape that decides card vs column row. */
function firstRowCells(tableInner) {
  const tr = extractElement(tableInner, 'tr', 0);
  return tr ? collectTds(tr.inner) : [];
}

/**
 * Chrome (background, border, radius, inset) of a table that wraps content.
 * The cell inset only belongs to the card when the row has a single cell —
 * in a multi-column row that padding is the column gutter and is applied
 * per column instead, so taking it here would double it.
 */
function tableChrome(openTag, cells) {
  const tableStyle = parseStyle(attrs(openTag).style || '');
  const innerTd = cells?.length === 1 ? cells[0] : null;
  const tdStyle = innerTd ? parseStyle(attrs(innerTd.open).style || '') : {};
  const border = borderFromStyle(tableStyle);
  const tdBorder = borderFromStyle(tdStyle);
  if (!border.color && tdBorder.color) Object.assign(border, tdBorder);
  return {
    bg:
      hex6(attrs(openTag).bgcolor) ||
      hex6(tableStyle['background-color']) ||
      hex6(attrs(innerTd?.open || '').bgcolor) ||
      hex6(tdStyle['background-color']),
    border,
    radius: px(tableStyle['border-radius']) || px(tdStyle['border-radius']) || 0,
    padding: pad4(tdStyle, ZERO),
  };
}

/** True only when `inner` is exactly one table and nothing else. */
function soleTable(inner) {
  const trimmed = inner.trim();
  if (!trimmed.startsWith('<table')) return null;
  const el = extractElement(trimmed, 'table', 0);
  // Without the span check, a cell holding several sibling tables looks like
  // a single one and everything after the first table gets dropped.
  if (!el || el.start !== 0 || el.end < trimmed.length) return null;
  return el;
}

/**
 * A cell holding no text and no image is spacing or a rule (the `&nbsp;` in a
 * `border-top; font-size:0` cell flanking a centred label). Emitting a
 * NotionText for it would render the editor's "Double click to edit"
 * placeholder in the template, so the border becomes a Divider and a truly
 * blank cell becomes nothing.
 */
function emptyCellBlock(cell, doc) {
  if (/<img\b/i.test(cell.inner)) return undefined;
  if (
    stripTags(cell.inner)
      .replace(/\u00a0|&nbsp;/gi, '')
      .trim()
  )
    return undefined;
  const style = parseStyle(attrs(cell.open).style || '');
  const border = borderFromStyle(style);
  if (!border.color) return [];
  const id = nid('rule');
  doc[id] = {
    type: 'Divider',
    data: {
      style: {
        backgroundColor: null,
        color: border.color,
        height: Math.max(1, border.top || border.bottom || 1),
        width: 100,
        textAlign: 'left',
        padding: { ...ZERO },
      },
    },
  };
  return [id];
}

function cellContentIds(cell, doc, ctx) {
  const empty = emptyCellBlock(cell, doc);
  if (empty !== undefined) return empty;
  const only = soleTable(cell.inner);
  if (only) {
    const cells = firstRowCells(only.inner);
    const chrome = tableChrome(only.open, cells);
    const inner = cells.length === 1 ? cells[0].inner : only.inner;
    const width = ctx.width - chrome.padding.left - chrome.padding.right;
    const kids = parseFlow(inner, doc, { ...ctx, width });
    return wrapCard(kids, chrome, doc);
  }
  return parseFlow(cell.inner, doc, ctx);
}

/**
 * Column gutters live on the source `<td>` padding. The builder's
 * ColumnsContainer has no per-column padding, so it has to move onto the
 * cell's content — merged into a lone child, or a Container otherwise.
 */
function applyCellPadding(childIds, padding, doc) {
  if (!childIds.length || isZeroPad(padding)) return childIds;
  if (childIds.length === 1) {
    const b = doc[childIds[0]];
    const style = b?.data?.style;
    if (style && b.type !== 'ColumnsContainer') {
      style.padding = addPad(style.padding, padding);
      return childIds;
    }
  }
  return wrapCard(childIds, { bg: null, border: { color: null }, radius: 0, padding }, doc);
}

function cellPct(cell, rowWidth) {
  const cellStyle = parseStyle(attrs(cell.open).style || '');
  const w = attrs(cell.open).width || cellStyle.width || '';
  const m = /^(\d+(?:\.\d+)?)%$/.exec(String(w).trim());
  if (m) return Math.round(Number(m[1]));
  const pxWidth = px(w);
  if (!pxWidth || rowWidth <= 0) return null;
  // `width` on a `<td>` sizes its content box, but the gutter padding gets
  // folded into the column's content here — so the column has to be wide
  // enough for both, or a fixed-width image inside it shrinks by the gutter.
  const gutter = pad4(cellStyle, ZERO);
  return Math.max(5, Math.round(((pxWidth + gutter.left + gutter.right) / rowWidth) * 100));
}

/**
 * Rough max-content width of a cell, in px. Auto table layout hands unwidthed
 * cells space in proportion to this, so it is what an authored row without
 * widths actually renders as.
 */
function naturalWidth(cell) {
  let total = 0;
  const re = /<(div|span|p|h[1-6]|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(cell.inner))) {
    const size = px(parseStyle(attrs(`<x ${m[2]}>`).style || '')['font-size']) || 16;
    const text = stripTags(m[3]).replace(/\s+/g, ' ').trim();
    if (text) total = Math.max(total, text.length * size * 0.5);
  }
  if (!total) {
    const img = /<img\b[^>]*>/i.exec(cell.inner);
    if (img)
      total =
        px(parseStyle(attrs(img[0]).style || '')['max-width']) || Number(attrs(img[0]).width) || 0;
  }
  return total || 1;
}

/**
 * Percentages that respect authored widths and always total 100. The rescale
 * matters when a wide row is split into nested pairs: four `width="25%"`
 * cells become two groups whose members are 50% *of their group*.
 */
function columnPercents(cells, rowWidth) {
  const raw = cells.map((c) => cellPct(c, rowWidth));
  const knownSum = raw.reduce((a, v) => a + (v ?? 0), 0);
  const free = Math.max(0, 100 - knownSum);
  // Unwidthed cells share the leftover the way auto layout would — in
  // proportion to their max-content width, not evenly. An even split makes a
  // long title beside a short meta column wrap where the source does not.
  const natural = cells.map((c, i) => (raw[i] == null ? naturalWidth(c) : 0));
  const naturalSum = natural.reduce((a, b) => a + b, 0);
  const unknownCount = raw.filter((v) => v == null).length;
  const out = raw.map((v, i) => {
    if (v != null) return v;
    if (!naturalSum) return free / unknownCount;
    return Math.max(8, (natural[i] / naturalSum) * free);
  });
  const total = out.reduce((a, b) => a + b, 0) || 1;
  const scaled = out.map((v) => Math.round((v / total) * 100));
  scaled[scaled.length - 1] += 100 - scaled.reduce((a, b) => a + b, 0);
  return scaled;
}

function makeColumns(colChildArrays, doc, pad, percents, alignment) {
  const cols = [...colChildArrays];
  while (cols.length < 3) cols.push([]);
  const count = colChildArrays.length === 3 ? 3 : 2;
  const widths = [
    percents[0] ?? null,
    percents[1] ?? null,
    count === 3 ? (percents[2] ?? null) : null,
  ];
  const id = nid('cols');
  doc[id] = {
    type: 'ColumnsContainer',
    data: {
      style: { backgroundColor: null, padding: { ...pad } },
      props: {
        fixedWidths: widths,
        columnsCount: count,
        layout: count === 3 ? 'layout-33-33-33' : 'layout-50-50',
        contentAlignment: alignment,
        stackColumnsOnMobile: true,
        columns: [{ childrenIds: cols[0] }, { childrenIds: cols[1] }, { childrenIds: cols[2] }],
      },
    },
  };
  return id;
}

/**
 * A single-row table whose cells hold no text but carry an explicit `height`
 * is a rule or a progress bar. `Divider` renders exactly that shape: the outer
 * wrapper paints `backgroundColor` (the track) and the inner bar paints
 * `color` at `width`% and `height`px — so the whole widget is one block
 * instead of a `ColumnsContainer` of empty paragraphs sized by line-height.
 */
function parseBarRow(tableEl, doc) {
  if (countRows(tableEl.inner) !== 1) return null;
  const cells = firstRowCells(tableEl.inner);
  if (!cells.length) return null;

  const meta = cells.map((c) => {
    const a = attrs(c.open);
    const style = parseStyle(a.style || '');
    return {
      empty: !stripTags(c.inner)
        .replace(/\u00a0|&nbsp;/gi, '')
        .trim(),
      height: px(style.height),
      bg: hex6(a.bgcolor) || hex6(style['background-color']),
      pct: cellPct(c, 0),
    };
  });
  if (!meta.every((m) => m.empty)) return null;
  const height = meta.find((m) => m.height)?.height;
  if (!height) return null;

  const tableAttrs = attrs(tableEl.open);
  const tableStyle = parseStyle(tableAttrs.style || '');
  const track = hex6(tableAttrs.bgcolor) || hex6(tableStyle['background-color']);
  const fill = meta.find((m) => m.bg && m.bg !== track);
  const id = nid('bar');
  doc[id] = {
    type: 'Divider',
    data: {
      style: {
        backgroundColor: track,
        color: fill?.bg || track || '#333333',
        height,
        width: fill && cells.length > 1 ? (fill.pct ?? 100) : 100,
        textAlign: 'left',
        padding: { ...ZERO, ...marginY(tableStyle) },
      },
    },
  };
  return id;
}

function countRows(tableInner) {
  let n = 0;
  let i = 0;
  while (i < tableInner.length) {
    const tr = extractElement(tableInner, 'tr', i);
    if (!tr) break;
    n += 1;
    i = tr.end;
  }
  return n;
}

function rowAlignment(cells) {
  return cells.some((c) => /valign\s*=\s*["']?top/i.test(c.open)) ? 'top' : 'middle';
}

function buildCells(cells, doc, ctx, percents) {
  return cells.map((cell, i) => {
    const cellStyle = parseStyle(attrs(cell.open).style || '');
    const padding = pad4(cellStyle, ZERO);
    const inner = Math.max(
      40,
      Math.round((ctx.width * (percents[i] || 50)) / 100) - padding.left - padding.right,
    );
    const align = /align\s*=\s*["']?right/i.test(cell.open)
      ? 'right'
      : /align\s*=\s*["']?center/i.test(cell.open)
        ? 'center'
        : null;
    const kids = cellContentIds(cell, doc, { ...ctx, width: inner, alignHint: align });
    if (align) {
      for (const id of kids) {
        const b = doc[id];
        if (b?.type === 'NotionText' || b?.type === 'Image') b.data.style.textAlign = align;
      }
    }
    return applyCellPadding(kids, padding, doc);
  });
}

/** The builder caps out at 3 columns; 4 equal cells become a nested 2×2. */
function parseColumnRow(cells, doc, pad, ctx) {
  if (cells.length < 2) return null;
  // `pad` becomes the ColumnsContainer's own padding, but callers already
  // narrow `ctx.width` by it — subtracting again would shrink every column.
  const rowWidth = ctx.width;
  const alignment = rowAlignment(cells);

  if (cells.length === 4) {
    const pairs = [cells.slice(0, 2), cells.slice(2, 4)];
    const pairIds = pairs.map((pair) => {
      const pct = columnPercents(pair, rowWidth / 2);
      const kids = buildCells(pair, doc, { ...ctx, width: rowWidth / 2 }, pct);
      return makeColumns(kids, doc, ZERO, pct, alignment);
    });
    return makeColumns([[pairIds[0]], [pairIds[1]]], doc, pad, [50, 50], alignment);
  }

  if (cells.length > 3) {
    const ids = [];
    for (let i = 0; i < cells.length; i += 3) {
      const chunk = cells.slice(i, i + 3);
      if (chunk.length === 1) {
        ids.push(...cellContentIds(chunk[0], doc, ctx));
      } else {
        const pct = columnPercents(chunk, rowWidth);
        ids.push(
          makeColumns(
            buildCells(chunk, doc, { ...ctx, width: rowWidth }, pct),
            doc,
            i === 0 ? pad : { ...ZERO, top: 8 },
            pct,
            alignment,
          ),
        );
      }
    }
    return ids;
  }

  const percents = columnPercents(cells, rowWidth);
  return makeColumns(
    buildCells(cells, doc, { ...ctx, width: rowWidth }, percents),
    doc,
    pad,
    percents,
    alignment,
  );
}

function isColumnRow(cells) {
  if (cells.length < 2) return false;
  const stacked = cells.filter((c) => /class="stack"/i.test(c.open)).length;
  if (stacked >= 2) return true;
  // Header-style 2-col (logo | nav) without stack class
  if (cells.length === 2) {
    const w0 = attrs(cells[0].open).width;
    const w1 = attrs(cells[1].open).width;
    const alignRight = /align="right"/i.test(cells[1].open);
    if (alignRight || w0 || w1) return true;
    // two non-empty content cells side by side
    if (stripTags(cells[0].inner) && stripTags(cells[1].inner)) return true;
  }
  // Explicit equal % widths
  const widths = cells.map((c) => attrs(c.open).width || '');
  if (widths.every((w) => /^\d+%$/.test(w))) return true;
  return false;
}

function collapseSpacers(ids, doc) {
  const out = [];
  for (const id of ids) {
    const b = doc[id];
    if (!b) continue;
    if (b.type === 'Spacer') {
      const h = b.data?.style?.height || 0;
      if (out.length) {
        const prev = doc[out[out.length - 1]];
        if (prev?.type === 'NotionText' || prev?.type === 'Image' || prev?.type === 'Button') {
          const pad = prev.data.style.padding || { ...ZERO };
          pad.bottom = (pad.bottom || 0) + h;
          prev.data.style.padding = pad;
          delete doc[id];
          continue;
        }
      }
      // Defer: may collapse into the next block's top padding
      out.push(id);
      continue;
    }
    if (
      (b.type === 'NotionText' ||
        b.type === 'Image' ||
        b.type === 'Button' ||
        b.type === 'ColumnsContainer' ||
        b.type === 'Divider') &&
      out.length
    ) {
      const prevId = out[out.length - 1];
      const prev = doc[prevId];
      if (prev?.type === 'Spacer') {
        const h = prev.data.style.height || 0;
        if (b.type === 'ColumnsContainer' || b.type === 'Divider') {
          const pad = b.data.style.padding || { ...ZERO };
          pad.top = (pad.top || 0) + h;
          b.data.style.padding = pad;
        } else {
          const pad = b.data.style.padding || { ...ZERO };
          pad.top = (pad.top || 0) + h;
          b.data.style.padding = pad;
        }
        out.pop();
        delete doc[prevId];
      }
    }
    out.push(id);
  }
  // Drop trailing spacers
  while (out.length && doc[out[out.length - 1]]?.type === 'Spacer') {
    delete doc[out.pop()];
  }
  return out;
}

function parseFlow(html, doc, ctx) {
  const ids = [];
  let i = 0;
  const s = html;

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;

    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i);
      i = end < 0 ? s.length : end + 3;
      continue;
    }

    if (/^<img\b/i.test(s.slice(i))) {
      const m = /^<img\b[^>]*>/i.exec(s.slice(i));
      const parsed = parseImage(m[0], ZERO, ctx.alignHint || 'center', ctx.width);
      if (parsed) {
        doc[parsed.id] = parsed.block;
        ids.push(parsed.id);
      }
      i += m[0].length;
      continue;
    }

    if (/^<div\b/i.test(s.slice(i))) {
      const el = extractElement(s, 'div', i);
      if (!el) break;
      const style = parseStyle(attrs(el.open).style || '');
      if (isDividerDiv(style, el.inner)) {
        // Prefer Divider over Spacer when a hairline is present (spacer check
        // would otherwise match on height:Npx empty divs).
        const id = nid('div');
        const color =
          hex6((style['border-top'] || '').match(/#[0-9a-fA-F]{3,6}/)?.[0]) || '#E0DDD4';
        const gap = px(style.height) || 16;
        doc[id] = {
          type: 'Divider',
          data: {
            style: {
              backgroundColor: null,
              color,
              height: px(style['border-top']) || 1,
              width: 100,
              padding: {
                top: Math.max(4, Math.round(gap / 2)),
                bottom: Math.max(4, Math.round(gap / 2)),
                right: 0,
                left: 0,
              },
              textAlign: 'left',
            },
          },
        };
        ids.push(id);
      } else if (isSpacerDiv(style, el.inner)) {
        const id = nid('sp');
        doc[id] = {
          type: 'Spacer',
          data: { style: { height: px(style.height) || 12, backgroundColor: null } },
        };
        ids.push(id);
      } else {
        const n = notionFromDiv(style, el.inner, ZERO, ctx.alignHint, ctx.rootFont);
        if (n) {
          doc[n.id] = n.block;
          ids.push(...applyMarginY([n.id], style, doc));
        }
      }
      i = el.end;
      continue;
    }

    if (/^<table\b/i.test(s.slice(i))) {
      const el = extractElement(s, 'table', i);
      if (!el) break;

      if (isButtonTable(el.inner)) {
        const tableStyle = parseStyle(attrs(el.open).style || '');
        const id = parseButton(el, doc, { ...ZERO, ...marginY(tableStyle) }, ctx);
        if (id) ids.push(id);
        i = el.end;
        continue;
      }

      // A row of empty, explicitly-sized cells is a rule or a progress bar,
      // not a column layout — `Divider` carries both (track = background,
      // fill = colour + width).
      const bar = parseBarRow(el, doc);
      if (bar) {
        ids.push(bar);
        i = el.end;
        continue;
      }

      // A bordered/filled table around the rows is a card — capture its
      // chrome once, then emit the rows inside it.
      const chrome = tableChrome(el.open, firstRowCells(el.inner));
      const isCard = Boolean(chrome.bg || chrome.border.color || chrome.radius);
      const rowCtx = isCard
        ? { ...ctx, width: ctx.width - chrome.padding.left - chrome.padding.right }
        : ctx;
      const rowIds = [];

      let j = 0;
      let handled = false;
      while (j < el.inner.length) {
        const tr = extractElement(el.inner, 'tr', j);
        if (!tr) break;
        const cells = collectTds(tr.inner);
        if (isColumnRow(cells)) {
          const result = parseColumnRow(cells, doc, ZERO, rowCtx);
          if (Array.isArray(result)) rowIds.push(...result);
          else if (result) rowIds.push(result);
          handled = true;
        } else if (cells.length === 1) {
          const td = cells[0];
          const tdStyle = parseStyle(attrs(td.open).style || '');
          const bg = hex6(attrs(td.open).bgcolor) || hex6(tdStyle['background-color']);
          // Decorative progress-bar segments: no text, a few px tall.
          if ((px(tdStyle.height) || 0) <= 8 && !stripTags(td.inner)) {
            if (bg) {
              const id = nid('bar');
              doc[id] = {
                type: 'Divider',
                data: {
                  style: {
                    backgroundColor: null,
                    color: bg,
                    height: px(tdStyle.height) || 6,
                    width: 100,
                    padding: { top: 4, bottom: 12, right: 0, left: 0 },
                    textAlign: 'left',
                  },
                },
              };
              rowIds.push(id);
              handled = true;
            }
          } else {
            const tdPad = isCard ? ZERO : pad4(tdStyle, ZERO);
            const kids = parseFlow(td.inner, doc, {
              ...rowCtx,
              width: rowCtx.width - tdPad.left - tdPad.right,
            });
            rowIds.push(...applyCellPadding(kids, tdPad, doc));
            handled = true;
          }
        } else if (cells.length > 1) {
          const result = parseColumnRow(cells, doc, ZERO, rowCtx);
          if (Array.isArray(result)) rowIds.push(...result);
          else if (result) rowIds.push(result);
          handled = true;
        }
        j = tr.end;
      }
      if (!handled) {
        rowIds.push(...parseFlow(el.inner.replace(/<\/?t[rdh][^>]*>/gi, ' '), doc, rowCtx));
      }
      const tableIds = isCard ? wrapCard(collapseSpacers(rowIds, doc), chrome, doc) : rowIds;
      ids.push(...applyMarginY(tableIds, parseStyle(attrs(el.open).style || ''), doc));
      i = el.end;
      continue;
    }

    if (/^<a\b/i.test(s.slice(i))) {
      const el = extractElement(s, 'a', i);
      if (!el) break;
      const style = parseStyle(attrs(el.open).style || '');
      const href = attrs(el.open).href || '#';
      const n = notionFromDiv(
        style,
        `<a href="${href}">${el.inner}</a>`,
        ZERO,
        ctx.alignHint,
        ctx.rootFont,
      );
      if (n) {
        doc[n.id] = n.block;
        ids.push(n.id);
      }
      i = el.end;
      continue;
    }

    if (s[i] === '<') {
      const gt = s.indexOf('>', i);
      if (gt < 0) break;
      const tag = s.slice(i, gt + 1);
      const name = /^<\/?([a-zA-Z0-9]+)/.exec(tag)?.[1]?.toLowerCase();
      if (
        name &&
        !tag.startsWith('</') &&
        !/\/>$/.test(tag) &&
        !['img', 'br', 'hr'].includes(name)
      ) {
        const el = extractElement(s, name, i);
        if (el) {
          ids.push(...parseFlow(el.inner, doc, ctx));
          i = el.end;
          continue;
        }
      }
      i = gt + 1;
      continue;
    }

    const next = s.indexOf('<', i);
    const text = s.slice(i, next < 0 ? s.length : next).trim();
    if (text) {
      const id = nid();
      doc[id] = {
        type: 'NotionText',
        data: {
          style: {
            color: '#1F1E1B',
            fontSize: 15,
            fontWeight: 'normal',
            textAlign: 'left',
            padding: { ...ZERO },
          },
          props: { html: `<p>${text}</p>` },
        },
      };
      ids.push(id);
    }
    i = next < 0 ? s.length : next;
  }

  return collapseSpacers(ids, doc);
}

function convertHtml(html) {
  seq = 0;
  const bodyBg =
    hex6(/<body[^>]*background-color:([^;"'\s]+)/i.exec(html)?.[1]) ||
    hex6(/<body[^>]*bgcolor=["']?(#[0-9a-fA-F]+)/i.exec(html)?.[1]) ||
    '#F2F0EC';
  const linkColor = hex6(/a\s*\{\s*color:(#[0-9a-fA-F]+)/i.exec(html)?.[1]) || '#4F46E5';
  const wrap = extractWrapTable(html);
  const canvas =
    hex6(wrap.style['background-color']) || hex6(attrs(wrap.open).bgcolor) || '#FBFAF7';
  const fontFamily = mapFont(wrap.style['font-family']);
  const borderC = hex6(wrap.style.border?.match?.(/#[0-9a-fA-F]+/)?.[0]);
  const ctx = { canvasColor: canvas, width: CANVAS_WIDTH, rootFont: fontFamily };

  const doc = {};
  const rootChildren = [];

  for (const tr of extractTopLevelTrs(wrap.inner)) {
    const td = extractElement(tr.inner, 'td', 0);
    if (!td) continue;
    const tdAttrs = attrs(td.open);
    const tdStyle = parseStyle(tdAttrs.style || '');
    const padding = pad4(tdStyle, ZERO);
    const bg = hex6(tdAttrs.bgcolor) || hex6(tdStyle['background-color']);
    const border = borderFromStyle(tdStyle);
    const alignHint = (tdAttrs.align || tdStyle['text-align'] || '').toLowerCase() || undefined;

    const sectionCtx = { ...ctx, width: CANVAS_WIDTH - padding.left - padding.right };

    // Full-bleed image section — the section padding rides on the image so no
    // wrapping Container is needed.
    if (/^\s*<img\b[^>]*>\s*$/i.test(td.inner)) {
      const m = /<img\b[^>]*>/i.exec(td.inner);
      const parsed = parseImage(m[0], padding, alignHint || 'center', sectionCtx.width);
      if (parsed) {
        doc[parsed.id] = parsed.block;
        rootChildren.push(parsed.id);
      }
      continue;
    }

    // A section holding exactly one column table hoists straight to a
    // ColumnsContainer so the section padding lands on it instead of an
    // extra Container.
    const only = soleTable(td.inner);
    if (only) {
      const tr0 = extractElement(only.inner, 'tr', 0);
      const cells = tr0 ? collectTds(tr0.inner) : [];
      const singleRow = tr0 && !extractElement(only.inner, 'tr', tr0.end);
      const chrome = tableChrome(only.open, cells);
      const plain = !chrome.bg && !chrome.border.color && !chrome.radius;
      if (singleRow && plain && isColumnRow(cells)) {
        const result = parseColumnRow(cells, doc, padding, sectionCtx);
        if (Array.isArray(result)) rootChildren.push(...result);
        else if (result) rootChildren.push(result);
        continue;
      }
    }

    let childIds = parseFlow(td.inner, doc, sectionCtx);

    // Apply section align hint to text blocks that inherited left
    if (alignHint === 'center' || alignHint === 'right') {
      for (const id of childIds) {
        const b = doc[id];
        if (
          b?.type === 'NotionText' &&
          (!b.data.style.textAlign || b.data.style.textAlign === 'left')
        ) {
          // only override if HTML didn't set align
          if (!/text-align/i.test(b.data.props.html || '')) {
            b.data.style.textAlign = alignHint;
          }
        }
      }
    }

    childIds = collapseSpacers(childIds, doc);
    if (!childIds.length) continue;

    // Hoist a lone image, folding the section padding into it
    if (
      childIds.length === 1 &&
      doc[childIds[0]]?.type === 'Image' &&
      !bg &&
      !border.top &&
      !border.bottom
    ) {
      const img = doc[childIds[0]];
      img.data.style.padding = addPad(img.data.style.padding, padding);
      rootChildren.push(childIds[0]);
      continue;
    }

    // Hoist lone ColumnsContainer — merge section padding into it
    if (childIds.length === 1 && doc[childIds[0]]?.type === 'ColumnsContainer') {
      const col = doc[childIds[0]];
      col.data.style.padding = {
        top: (col.data.style.padding?.top || 0) + padding.top,
        bottom: (col.data.style.padding?.bottom || 0) + padding.bottom,
        right: padding.right || col.data.style.padding?.right || 0,
        left: padding.left || col.data.style.padding?.left || 0,
      };
      rootChildren.push(childIds[0]);
      continue;
    }

    const cId = nid('section');
    doc[cId] = {
      type: 'Container',
      data: {
        style: {
          backgroundColor: bg,
          borderColor: border.color,
          borderTop: border.top,
          borderBottom: border.bottom,
          borderLeft: border.left,
          borderRight: border.right,
          shape: 'rectangle',
          padding,
        },
        props: { childrenIds: childIds },
      },
    };
    rootChildren.push(cId);
  }

  doc.root = {
    type: 'EmailLayout',
    data: {
      backdropColor: bodyBg,
      canvasColor: canvas,
      textColor: '#1F1E1B',
      fontFamily,
      childrenIds: rootChildren,
      linkGlobal: { linkColor, underline: true },
      borderColor: borderC,
      borderRadius: px(wrap.style['border-radius']) || null,
    },
  };

  return pruneOrphans(doc);
}

function pruneOrphans(doc) {
  const keep = new Set();
  const walk = (id) => {
    if (!id || keep.has(id) || !doc[id]) return;
    keep.add(id);
    const b = doc[id];
    if (b.type === 'EmailLayout') {
      for (const c of b.data.childrenIds || []) walk(c);
    } else if (b.type === 'ColumnsContainer') {
      for (const col of b.data.props?.columns || []) {
        for (const c of col.childrenIds || []) walk(c);
      }
    } else if (b.type === 'Container') {
      for (const c of b.data.props?.childrenIds || []) walk(c);
    }
  };
  walk('root');
  const out = {};
  for (const id of keep) out[id] = doc[id];
  return out;
}

function toBlocksArray(doc) {
  const blocks = [{ id: 'root', block: doc.root }];
  for (const [id, block] of Object.entries(doc)) {
    if (id === 'root') continue;
    blocks.push({ id, block });
  }
  return blocks;
}

function normalizeColors(doc) {
  const walk = (v) => {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(v)) return hex6(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = walk(val);
      return o;
    }
    return v;
  };
  return walk(doc);
}

async function validateDoc(doc) {
  const { validateDocument } = await import(path.join(ROOT, 'packages/document-core/src/node.ts'));
  return validateDocument(doc);
}

async function main() {
  fs.mkdirSync(JSON_DIR, { recursive: true });
  fs.mkdirSync(AI_JSON_DIR, { recursive: true });
  fs.mkdirSync(AI_PRESET_DIR, { recursive: true });

  const now = new Date().toISOString();
  const galleryTemplates = [];
  const index = [];
  const errors = [];

  for (const f of fs.readdirSync(AI_PRESET_DIR)) {
    if (f.endsWith('.ndjson')) fs.unlinkSync(path.join(AI_PRESET_DIR, f));
  }
  for (const f of fs.readdirSync(AI_JSON_DIR)) {
    if (/^\d+\.json$/.test(f)) fs.unlinkSync(path.join(AI_JSON_DIR, f));
  }

  for (const meta of META) {
    const htmlPath = path.join(HTML_DIR, `${meta.nn}-${meta.slug}.html`);
    const html = fs.readFileSync(htmlPath, 'utf8');
    let doc;
    try {
      doc = normalizeColors(convertHtml(html));
    } catch (e) {
      errors.push(`${meta.slug}: convert failed: ${e.message}`);
      console.error(e);
      continue;
    }

    const result = await validateDoc(doc);
    if (!result.ok) {
      errors.push(
        `${meta.slug}: invalid — ${JSON.stringify(result.errors?.slice?.(0, 6) ?? result)}`,
      );
    }

    fs.writeFileSync(
      path.join(JSON_DIR, `${meta.nn}-${meta.slug}.json`),
      JSON.stringify(doc, null, 2) + '\n',
    );
    fs.writeFileSync(
      path.join(AI_JSON_DIR, `${meta.nn}.json`),
      JSON.stringify(doc, null, 2) + '\n',
    );

    const blocks = toBlocksArray(doc);
    fs.writeFileSync(
      path.join(AI_PRESET_DIR, `${meta.nn}-${meta.slug}.ndjson`),
      blocks.map((b) => JSON.stringify(b)).join('\n') + '\n',
    );

    galleryTemplates.push({
      id: `preset-${meta.slug}`,
      name: meta.name,
      description: `${meta.name} — ${meta.description}.`,
      tags: [meta.slug],
      createdAt: now,
      updatedAt: now,
      blocks,
    });

    index.push({
      slot: Number(meta.nn),
      slug: meta.slug,
      description: `${meta.name} — ${meta.description}.`,
      fontFamily: doc.root.data.fontFamily,
      sourceFile: `skills/email-builder/references/json/${meta.nn}.json`,
      blockCount: Object.keys(doc).length,
    });

    const types = {};
    for (const b of Object.values(doc)) types[b.type] = (types[b.type] || 0) + 1;
    console.log(
      `✓ ${meta.nn}-${meta.slug} (${Object.keys(doc).length} blocks; cols=${types.ColumnsContainer || 0} btn=${types.Button || 0} img=${types.Image || 0} sp=${types.Spacer || 0})`,
    );
  }

  fs.writeFileSync(path.join(AI_PRESET_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');

  const catalog = JSON.parse(fs.readFileSync(LOCAL_PRESETS, 'utf8'));
  catalog.templates = galleryTemplates;
  catalog.version = `maildrill-20-${Date.now().toString(36)}`;
  fs.writeFileSync(LOCAL_PRESETS, JSON.stringify(catalog, null, 2) + '\n');

  const rows = index
    .map(
      (e) =>
        `| ${e.slot} | ${e.slug} | \`skills/email-builder/references/json/${String(e.slot).padStart(2, '0')}.json\` | ${e.fontFamily} | ${e.blockCount} | ${e.description} |`,
    )
    .join('\n');
  fs.writeFileSync(
    path.join(AI_PRESET_DIR, 'README.md'),
    `# Presets

## Purpose

20 schema-valid Maildrill gallery templates injected into the AI system prompt.

## Slot Matrix

| Slot | Slug | Source File | fontFamily | Blocks | Description |
|------|------|-------------|------------|--------|-------------|
${rows}

\`\`\`bash
./node_modules/.bin/tsx scripts/import-maildrill-templates.mjs
\`\`\`
`,
  );

  console.log(`\nUpdated localPresets.data.json with ${galleryTemplates.length} templates`);
  if (errors.length) {
    console.error('\nErrors:');
    for (const e of errors) console.error(' -', e);
    process.exitCode = 1;
  } else {
    console.log('All 20 templates converted & validated.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
