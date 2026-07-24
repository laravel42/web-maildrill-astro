import type { TEditorBlock, TEditorConfiguration } from '../../documents/editor/core';

const PADDING_SIDES = ['top', 'bottom', 'left', 'right'] as const;
const PADDING_FIELDS = ['padding', 'mobilePadding'] as const;

type PaddingObject = { top: number; bottom: number; left: number; right: number };

function parsePxToken(token: string): number | undefined {
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(px)?$/i);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Turn CSS padding shorthand (`"16px"`, `"8px 16px"`, …) or a bare number
 * into the `{ top, bottom, left, right }` object the editor schemas expect.
 */
export function parsePaddingShorthand(value: unknown): PaddingObject | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { top: value, bottom: value, left: value, right: value };
  }
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/\s+/).map(parsePxToken);
  if (parts.length === 0 || parts.some((p) => p === undefined)) return null;
  const [a, b, c, d] = parts as number[];
  if (parts.length === 1) return { top: a, bottom: a, left: a, right: a };
  if (parts.length === 2) return { top: a, bottom: a, left: b, right: b };
  if (parts.length === 3) return { top: a, bottom: c!, left: b, right: b };
  if (parts.length >= 4) return { top: a, bottom: c!, left: d!, right: b };
  return null;
}

function coercePaddingField(value: unknown): PaddingObject | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const next: Partial<PaddingObject> = {};
    let changed = false;
    for (const side of PADDING_SIDES) {
      if (!(side in obj)) continue;
      const raw = obj[side];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        next[side] = raw;
        continue;
      }
      const parsed = typeof raw === 'string' ? parsePxToken(raw) : undefined;
      if (parsed === undefined) continue;
      next[side] = parsed;
      changed = true;
    }
    if (Object.keys(next).length === 0) return null;
    if (!changed && PADDING_SIDES.every((s) => typeof obj[s] === 'number')) {
      return value as PaddingObject;
    }
    return {
      top: next.top ?? 0,
      bottom: next.bottom ?? 0,
      left: next.left ?? 0,
      right: next.right ?? 0,
    };
  }
  return parsePaddingShorthand(value);
}

function coerceStyleObject(style: Record<string, unknown>): Record<string, unknown> {
  let next: Record<string, unknown> | null = null;
  const ensure = () => {
    if (next === null) next = { ...style };
    return next;
  };

  for (const field of PADDING_FIELDS) {
    if (!(field in style)) continue;
    const coerced = coercePaddingField(style[field]);
    if (coerced === null) continue;
    if (typeof style[field] === 'object' && !Array.isArray(style[field]) && coerced === style[field]) continue;
    ensure()[field] = coerced;
  }

  return next ?? style;
}

/**
 * Coerce common LLM style mistakes before Zod validation — notably `padding`
 * emitted as a CSS string instead of `{ top, bottom, left, right }`.
 */
export function coerceGeneratedStyles(doc: TEditorConfiguration): TEditorConfiguration {
  let changed = false;
  const out: TEditorConfiguration = {};

  for (const [id, block] of Object.entries(doc)) {
    const data = block.data as { style?: Record<string, unknown> } | undefined;
    if (!data?.style || typeof data.style !== 'object' || Array.isArray(data.style)) {
      out[id] = block;
      continue;
    }
    const coercedStyle = coerceStyleObject(data.style);
    if (coercedStyle === data.style) {
      out[id] = block;
    } else {
      changed = true;
      out[id] = { ...block, data: { ...data, style: coercedStyle } } as TEditorBlock;
    }
  }

  return changed ? out : doc;
}

/** Minimal structural check — enough to offer Apply when strict Zod fails. */
export function isLikelyUsableDocument(doc: unknown): doc is TEditorConfiguration {
  if (!doc || typeof doc !== 'object') return false;
  const root = (doc as TEditorConfiguration).root;
  if (!root || typeof root !== 'object') return false;
  return (root as TEditorBlock).type === 'EmailLayout';
}
