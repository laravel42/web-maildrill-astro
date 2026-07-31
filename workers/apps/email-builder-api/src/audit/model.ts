/**
 * A dependency-free view of an EmailBuilder document, plus the single
 * resolution pass every rule reads from.
 *
 * This file deliberately does not import `@eb/document-core`. The audit
 * engine has to stay portable — the same code should be able to run in this
 * Fastify app, in a CI check, and eventually inside the editor for a live
 * quality panel — so it re-declares the structural shape it needs and
 * tolerates anything it does not recognise.
 *
 * The interesting work is `resolveDocument`: a single walk from the root that
 * computes, for every block, the things rules keep asking for and which are
 * expensive or error-prone to recompute — the width its content actually gets,
 * the background it will really be painted on, and the typography it inherits.
 * Rules then stay one-liners over facts instead of each re-implementing the
 * cascade.
 */

/** Desktop canvas width; `MAX_WIDTH_DESKTOP` in `@eb/email-builder`. */
export const CANVAS_WIDTH = 600;
/** Width the canvas collapses to under the `max-width: 640px` media query. */
export const MOBILE_WIDTH = 370;
/** `EmailLayoutReader` hard-codes this on the wrapper; it affects text metrics. */
export const LAYOUT_LINE_HEIGHT = 1.5;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_CANVAS_COLOR = '#FFFFFF';
export const DEFAULT_BACKDROP_COLOR = '#F5F5F5';
export const DEFAULT_TEXT_COLOR = '#262626';

export type Padding = { top: number; bottom: number; left: number; right: number };

export type BlockType =
  | 'EmailLayout'
  | 'Container'
  | 'ColumnsContainer'
  | 'Button'
  | 'Image'
  | 'NotionText'
  | 'Divider'
  | 'Spacer'
  | 'SocialMedia';

export const BLOCK_TYPES: readonly BlockType[] = [
  'EmailLayout',
  'Container',
  'ColumnsContainer',
  'Button',
  'Image',
  'NotionText',
  'Divider',
  'Spacer',
  'SocialMedia',
];

/** Blocks carry free-form `style`/`props` bags; rules read them defensively. */
export type AnyRecord = Record<string, unknown>;

export type EditorBlock = {
  type: string;
  data: AnyRecord;
};

export type EditorDocument = Record<string, EditorBlock>;

export type ResolvedBlock = {
  id: string;
  type: string;
  data: AnyRecord;
  style: AnyRecord;
  props: AnyRecord;
  parentId: string | null;
  depth: number;
  /** Readable trail for report rows, e.g. `root › Container › Button`. */
  path: string;
  /** Horizontal space this block's *content* occupies, after all padding. */
  contentWidth: number;
  /** Same, once the mobile media query has collapsed the canvas. */
  mobileContentWidth: number;
  /** Nearest opaque ancestor background — what text is actually read against. */
  background: string;
  /** Inherited unless overridden. */
  textColor: string;
  fontSize: number;
  fontFamily: string | null;
  padding: Padding;
  /** Index within the owning `ColumnsContainer`, when inside one. */
  columnIndex: number | null;
  /** Estimated rendered height in px at desktop width. */
  estimatedHeight: number;
};

export type ResolvedDocument = {
  raw: EditorDocument;
  rootId: string;
  root: EditorBlock | null;
  /** Reachable blocks, in document (render) order. */
  blocks: ResolvedBlock[];
  byId: Map<string, ResolvedBlock>;
  /** Keys present in the document but unreachable from the root. */
  orphanIds: string[];
  /** `childrenIds` entries pointing at keys that do not exist. */
  danglingRefs: { parentId: string; missingId: string }[];
  /** Blocks reached more than once — a cycle or a shared child. */
  duplicateRefs: string[];
  canvasColor: string;
  backdropColor: string;
  layoutTextColor: string;
  layoutFontFamily: string | null;
  estimatedHeight: number;
};

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

export const ZERO_PADDING: Padding = { top: 0, bottom: 0, left: 0, right: 0 };

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function bag(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

export function readPadding(style: AnyRecord, fallback: Padding = ZERO_PADDING): Padding {
  const p = style.padding;
  if (!p || typeof p !== 'object') return fallback;
  const rec = p as AnyRecord;
  return {
    top: num(rec.top, fallback.top),
    bottom: num(rec.bottom, fallback.bottom),
    left: num(rec.left, fallback.left),
    right: num(rec.right, fallback.right),
  };
}

/**
 * Per-block padding defaults, mirroring the `.default(...)` on each schema.
 * A block that omits `padding` still renders with these, so the audit has to
 * assume them too or every width and spacing measurement drifts.
 */
const PADDING_DEFAULTS: Record<string, Padding> = {
  Container: { top: 16, bottom: 16, left: 24, right: 24 },
  ColumnsContainer: ZERO_PADDING,
  Button: { top: 12, bottom: 12, left: 24, right: 24 },
  Image: ZERO_PADDING,
  NotionText: { top: 16, bottom: 16, left: 24, right: 24 },
  Divider: { top: 16, bottom: 16, left: 0, right: 0 },
  SocialMedia: { top: 16, bottom: 16, left: 24, right: 24 },
};

/** Hex only — matches `COLOR_SCHEMA`. Gradients in `background` are ignored. */
export function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Strips tags and decodes the entities the editor actually emits. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** `<a href>` targets inside a rich-text block. */
export function extractLinks(html: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ href: m[1], text: htmlToText(m[2]) });
  }
  return out;
}

/** Semantic heading levels present in a rich-text block. */
export function extractHeadingLevels(html: string): number[] {
  const out: number[] = [];
  const re = /<h([1-6])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(Number(m[1]));
  return out;
}

/** Inline `font-size:Npx` overrides, which beat the block's `style.fontSize`. */
export function extractInlineFontSizes(html: string): number[] {
  const out: number[] = [];
  const re = /font-size:\s*([\d.]+)px/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(Number(m[1]));
  return out;
}

/** Inline `color:#rrggbb` overrides. */
export function extractInlineColors(html: string): string[] {
  const out: string[] = [];
  const re = /(?:^|[^-\w])color:\s*(#[0-9a-fA-F]{6})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1].toUpperCase());
  return out;
}

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

/**
 * Column widths in px for a `ColumnsContainer`.
 *
 * `fixedWidths` holds **percentages**, not pixels — the reader emits
 * `width: ${fixedWidths[i]}%` on each cell and falls back to an even
 * `100 / columnsCount` split for any slot that is null. Reading them as
 * pixels makes a `[7, 54, 39]` row look like a 7px column, which is how this
 * was originally found.
 */
export function columnWidths(props: AnyRecord, available: number): number[] {
  const count = props.columnsCount === 3 ? 3 : 2;
  const fixed = Array.isArray(props.fixedWidths) ? (props.fixedWidths as unknown[]) : [];
  const evenPct = 100 / count;
  const widths: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const v = fixed[i];
    const pct = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : evenPct;
    widths.push((available * pct) / 100);
  }
  return widths;
}

/**
 * Rough rendered height of a text block.
 *
 * Character-width heuristic: at a given font size an average glyph in the
 * catalog's stacks runs about 0.5em, so `width / (size * 0.5)` characters fit
 * per line. This only needs to be good enough to rank blocks and compute an
 * image-to-text ratio, and it is documented as an estimate everywhere it
 * surfaces.
 */
function estimateTextHeight(text: string, width: number, fontSize: number, lineHeight: number): number {
  if (!text) return 0;
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.5)));
  const lines = text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.round(lines * fontSize * lineHeight);
}

function parseLineHeight(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'normal') return 1.2;
    const px = /^([\d.]+)px$/.exec(trimmed);
    if (px) return Number(px[1]) / DEFAULT_FONT_SIZE;
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

const SOCIAL_ICON_PX: Record<string, number> = { small: 24, medium: 32, large: 40 };

/* ------------------------------------------------------------------ */
/* resolution                                                          */
/* ------------------------------------------------------------------ */

type WalkContext = {
  parentId: string | null;
  depth: number;
  path: string;
  width: number;
  mobileWidth: number;
  background: string;
  textColor: string;
  fontSize: number;
  fontFamily: string | null;
  columnIndex: number | null;
};

/**
 * Walk the document once from `rootId`, resolving inherited context and
 * geometry for every reachable block.
 *
 * Unreachable keys, dangling `childrenIds`, and blocks reached twice are all
 * recorded rather than thrown on — a document that fails structurally is
 * exactly the document an audit most needs to describe.
 */
export function resolveDocument(document: EditorDocument, rootId = 'root'): ResolvedDocument {
  const root = document[rootId] ?? null;
  const rootData = bag(root?.data);

  const canvasColor = isHex(rootData.canvasColor) ? rootData.canvasColor : DEFAULT_CANVAS_COLOR;
  const backdropColor = isHex(rootData.backdropColor) ? rootData.backdropColor : DEFAULT_BACKDROP_COLOR;
  const layoutTextColor = isHex(rootData.textColor) ? rootData.textColor : DEFAULT_TEXT_COLOR;
  const layoutFontFamily = str(rootData.fontFamily);

  const blocks: ResolvedBlock[] = [];
  const byId = new Map<string, ResolvedBlock>();
  const danglingRefs: { parentId: string; missingId: string }[] = [];
  const duplicateRefs: string[] = [];
  const seen = new Set<string>([rootId]);

  const visit = (id: string, ctx: WalkContext): number => {
    const block = document[id];
    if (!block) {
      danglingRefs.push({ parentId: ctx.parentId ?? rootId, missingId: id });
      return 0;
    }
    if (seen.has(id)) {
      duplicateRefs.push(id);
      return 0;
    }
    seen.add(id);

    const data = bag(block.data);
    const style = bag(data.style);
    const props = bag(data.props);
    const type = block.type;

    const padding = readPadding(style, PADDING_DEFAULTS[type] ?? ZERO_PADDING);
    const innerWidth = Math.max(0, ctx.width - padding.left - padding.right);
    const innerMobileWidth = Math.max(0, ctx.mobileWidth - padding.left - padding.right);

    const background = isHex(style.backgroundColor) ? (style.backgroundColor as string) : ctx.background;
    const textColor = isHex(style.color) ? (style.color as string) : ctx.textColor;
    const fontSize = num(style.fontSize, ctx.fontSize);
    const fontFamily = str(style.fontFamily) ?? ctx.fontFamily;

    const resolved: ResolvedBlock = {
      id,
      type,
      data,
      style,
      props,
      parentId: ctx.parentId,
      depth: ctx.depth,
      path: `${ctx.path} › ${type}`,
      contentWidth: innerWidth,
      mobileContentWidth: innerMobileWidth,
      background,
      textColor,
      fontSize,
      fontFamily,
      padding,
      columnIndex: ctx.columnIndex,
      estimatedHeight: 0,
    };
    blocks.push(resolved);
    byId.set(id, resolved);

    const childCtx: WalkContext = {
      parentId: id,
      depth: ctx.depth + 1,
      path: resolved.path,
      width: innerWidth,
      mobileWidth: innerMobileWidth,
      background,
      textColor,
      fontSize,
      fontFamily,
      columnIndex: ctx.columnIndex,
    };

    let contentHeight = 0;

    switch (type) {
      case 'Container': {
        const childrenIds = Array.isArray(props.childrenIds) ? (props.childrenIds as string[]) : [];
        for (const childId of childrenIds) contentHeight += visit(childId, childCtx);
        break;
      }
      case 'ColumnsContainer': {
        const widths = columnWidths(props, innerWidth);
        const gap = num(props.columnsGap, 0);
        const columns = Array.isArray(props.columns) ? (props.columns as AnyRecord[]) : [];
        const heights: number[] = [];
        widths.forEach((colWidth, index) => {
          const column = bag(columns[index]);
          const childrenIds = Array.isArray(column.childrenIds) ? (column.childrenIds as string[]) : [];
          let columnHeight = 0;
          for (const childId of childrenIds) {
            columnHeight += visit(childId, {
              ...childCtx,
              width: Math.max(0, colWidth - gap),
              // Columns stack on mobile, so each child gets the full width.
              mobileWidth: innerMobileWidth,
              columnIndex: index,
            });
          }
          heights.push(columnHeight);
        });
        contentHeight = heights.length > 0 ? Math.max(...heights) : 0;
        break;
      }
      case 'NotionText': {
        const html = typeof props.html === 'string' ? props.html : '';
        const text = htmlToText(html);
        const lineHeight = parseLineHeight(style.lineHeight, LAYOUT_LINE_HEIGHT);
        const inlineSizes = extractInlineFontSizes(html);
        const effectiveSize = inlineSizes.length > 0 ? Math.max(fontSize, ...inlineSizes) : fontSize;
        contentHeight = estimateTextHeight(text, innerWidth, effectiveSize, lineHeight);
        break;
      }
      case 'Button': {
        const lineHeight = parseLineHeight(style.lineHeight, LAYOUT_LINE_HEIGHT);
        contentHeight = Math.round(num(style.fontSize, DEFAULT_FONT_SIZE) * lineHeight);
        break;
      }
      case 'Image': {
        const explicitHeight = num(style.height, 0);
        if (explicitHeight > 0) {
          contentHeight = explicitHeight;
        } else {
          const width = num(props.width, 0) || innerWidth;
          // No intrinsic dimensions in the document; assume a 3:2 landscape,
          // the dominant aspect in the preset corpus.
          contentHeight = Math.round(width * 0.667);
        }
        break;
      }
      case 'Divider': {
        contentHeight = num(style.height, 1);
        break;
      }
      case 'Spacer': {
        contentHeight = num(style.height, 16);
        break;
      }
      case 'SocialMedia': {
        const size = typeof style.optionSize === 'string' ? style.optionSize : 'medium';
        contentHeight = SOCIAL_ICON_PX[size] ?? 32;
        break;
      }
      default:
        contentHeight = 0;
    }

    resolved.estimatedHeight = contentHeight + padding.top + padding.bottom;
    return resolved.estimatedHeight;
  };

  const rootChildren = Array.isArray(rootData.childrenIds) ? (rootData.childrenIds as string[]) : [];
  let total = 0;
  for (const childId of rootChildren) {
    total += visit(childId, {
      parentId: rootId,
      depth: 1,
      path: 'root',
      width: CANVAS_WIDTH,
      mobileWidth: MOBILE_WIDTH,
      background: canvasColor,
      textColor: layoutTextColor,
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: layoutFontFamily,
      columnIndex: null,
    });
  }

  const orphanIds = Object.keys(document).filter((id) => id !== rootId && !seen.has(id));

  return {
    raw: document,
    rootId,
    root,
    blocks,
    byId,
    orphanIds,
    danglingRefs,
    duplicateRefs,
    canvasColor,
    backdropColor,
    layoutTextColor,
    layoutFontFamily,
    estimatedHeight: total,
  };
}

/** Convenience filter used by nearly every rule. */
export function blocksOfType(doc: ResolvedDocument, type: BlockType): ResolvedBlock[] {
  return doc.blocks.filter((b) => b.type === type);
}

/** The visible label on a button, trimmed. */
export function buttonText(block: ResolvedBlock): string {
  return typeof block.props.text === 'string' ? block.props.text.trim() : '';
}

/** Button colours can live on `props` or `style`; `props` wins in the reader. */
export function buttonColors(block: ResolvedBlock): { background: string | null; text: string | null } {
  const background =
    (isHex(block.props.buttonBackgroundColor) && (block.props.buttonBackgroundColor as string)) ||
    (isHex(block.style.buttonBackgroundColor) && (block.style.buttonBackgroundColor as string)) ||
    (isHex(block.style.backgroundColor) && (block.style.backgroundColor as string)) ||
    null;
  const text =
    (isHex(block.props.buttonTextColor) && (block.props.buttonTextColor as string)) ||
    (isHex(block.style.buttonTextColor) && (block.style.buttonTextColor as string)) ||
    null;
  return { background, text };
}
