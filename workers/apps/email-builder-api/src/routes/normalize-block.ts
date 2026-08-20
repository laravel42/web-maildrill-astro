/**
 * Per-line block normalizer for the `/generate` SSE stream.
 *
 * Some providers (notably MiniMax M2.x) occasionally return numeric style
 * fields as strings ("8", "8px") or as CSS shorthand ("1px solid #ccc"),
 * which fail the strict Zod schemas in the editor (`z.number()`). When that
 * happens, the frontend rejects the whole template with messages such as:
 *
 *   block-1.data.style.borderBottom: Expected number, received string
 *
 * Rather than relax the schema (which would also lose useful validation
 * server-side) we coerce the most common offending fields back to numbers
 * before the line leaves the backend. The normalizer is:
 *
 *   - **Pure**: never mutates its input. Returns the same reference when
 *     nothing changed.
 *   - **Conservative**: only known-numeric fields are touched; everything
 *     else passes through untouched.
 *   - **Defensive**: unparseable values become `undefined` (which Zod's
 *     `.optional()` accepts) instead of throwing.
 *
 * Each coercion is reported as a {@link NormalizationChange} so the route
 * can emit a single warning event with the full list — this keeps the SSE
 * frame log compact (one line per block, not one per field).
 */

/** Single field coercion record, surfaced to the client as a warning frame. */
export type NormalizationChange = {
  /** Dotted JSON-Pointer-ish path inside the block payload, e.g. `data.style.borderBottom`. */
  path: string;
  /** The original value the LLM emitted (string, object, etc.). */
  before: unknown;
  /** The coerced value. `undefined` means the field was dropped. */
  after: unknown;
};

export type NormalizationResult = {
  /**
   * The normalized payload. When `changes` is empty, this is the SAME
   * reference as the input — callers can compare by identity.
   */
  block: unknown;
  changes: NormalizationChange[];
};

/** Style fields that must be numbers per the editor schemas. */
const NUMERIC_STYLE_FIELDS = [
  'borderRadius',
  'fontSize',
  'fontSizeMobile',
  'height',
  'heightMobile',
  'width',
  // NOTE: `widthMobile` is intentionally omitted — Container schema declares
  // it as a string (percentage). Coercing it to a number would corrupt
  // legitimate values like "50%".
] as const;

/** Border-side fields that accept either a plain px number or a CSS shorthand. */
const BORDER_SIDE_FIELDS = [
  'borderTop',
  'borderBottom',
  'borderLeft',
  'borderRight',
  'borderTopMobile',
  'borderBottomMobile',
  'borderLeftMobile',
  'borderRightMobile',
] as const;

/** Padding sub-keys (also reused for `mobilePadding`). */
const PADDING_SIDES = ['top', 'bottom', 'left', 'right'] as const;
const PADDING_FIELDS = ['padding', 'mobilePadding'] as const;

/** Image / SocialMedia numeric props that the editor schema requires as numbers. */
const NUMERIC_PROP_FIELDS = [
  'width',
  // NOTE: `widthMobile` here also stays a string for Image — but the schema
  // declares it `z.number().optional().nullable()` (Image differs from
  // Container). Including it is therefore safe AND useful.
  'widthMobile',
  'scale',
  'scaleMobile',
  'original_width',
  'gap',
  'gapMobile',
] as const;

/**
 * Color fields that live on `data.props` (Button-specific).
 *
 * The editor schemas (e.g. `block-button/src/index.tsx`) declare these as
 * `^#[0-9a-fA-F]{6}$ | null | optional`. Any other value (`"transparent"`,
 * `"none"`, named colors, `"rgba(...)"`) hard-fails the Zod parse and rejects
 * the entire template downstream. The normalizer rewrites known invalid
 * values into either a valid 6-digit hex or `null` (the schema accepts both)
 * so a single mis-formatted color doesn't blow up an otherwise-valid stream.
 */
const COLOR_PROP_FIELDS = ['buttonBackgroundColor', 'buttonTextColor'] as const;

/**
 * Color fields that live on `data.style` for almost every block type.
 *
 * `borderColor` is also touched here: the border-side shorthand parser
 * (e.g. `"2px solid #FFF"`) already promotes a hex color into this slot,
 * so any pre-existing invalid value should still get coerced.
 */
const COLOR_STYLE_FIELDS = ['backgroundColor', 'color', 'borderColor'] as const;

/**
 * Color fields that live at the top level of `data` for `EmailLayout`
 * blocks (the document root). They follow the same hex-or-null schema.
 */
const COLOR_EMAIL_LAYOUT_FIELDS = [
  'backdropColor',
  'canvasColor',
  'textColor',
  'borderColor',
] as const;

/**
 * Strict regex matching the editor schemas (`COLOR_SCHEMA` in every block).
 * 6-digit hex ONLY — 3-digit (`#fff`), 4-digit (`#fff8`), or 8-digit
 * (`#FFFFFFAA`) hex are rejected by the editor even though they are valid
 * CSS, so the normalizer must expand / strip them.
 */
const STRICT_HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Pattern that matches all hex variants the LLM might emit (3, 4, 6, or 8
 * hex digits). Used by {@link coerceColor} to detect "almost-correct" hex
 * values worth normalizing instead of dropping.
 */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * CSS keywords that mean "no color" — coerced to `null` so the renderer
 * falls back to its default. `currentcolor` and `inherit` would be
 * context-dependent in real CSS, but here the editor has no inheritance
 * model, so dropping them is the safe choice.
 */
const TRANSPARENT_KEYWORDS = new Set([
  'transparent',
  'none',
  'inherit',
  'initial',
  'unset',
  'currentcolor',
]);

/**
 * Lookup of common CSS named colors → 6-digit hex. Kept intentionally small:
 * adding every CSS named color (147 of them) bloats the bundle and the LLM
 * almost never emits the exotic ones. Anything outside this list is dropped
 * to `null` so the renderer falls back to its default.
 */
const NAMED_COLOR_TO_HEX: Record<string, string> = {
  white: '#FFFFFF',
  black: '#000000',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  gray: '#808080',
  grey: '#808080',
  navy: '#000080',
  teal: '#008080',
  silver: '#C0C0C0',
  gold: '#FFD700',
  lime: '#00FF00',
  maroon: '#800000',
  olive: '#808000',
  aqua: '#00FFFF',
  fuchsia: '#FF00FF',
};

/**
 * Coerce an arbitrary color value into something the editor schema accepts:
 *
 *   - `string` → a valid 6-digit hex (`#RRGGBB`, uppercased).
 *   - `null`   → caller should set the field to `null` (schema accepts it).
 *   - `undefined` → caller should leave the field unchanged.
 *
 * Strategy:
 *   1. Already-valid 6-digit hex → returned unchanged (uppercased).
 *   2. 3-digit hex `#RGB` → expanded to `#RRGGBB`.
 *   3. 4-digit hex `#RGBA` → expanded to `#RRGGBB` (alpha dropped).
 *   4. 8-digit hex `#RRGGBBAA` → first 6 chars (alpha dropped).
 *   5. CSS keyword (`transparent`, `none`, `inherit`, `initial`, `unset`,
 *      `currentcolor`) → `null`.
 *   6. `rgb(r,g,b)` / `rgba(r,g,b,a)` with `a > 0` → converted to hex.
 *      `rgba(...,0)` is treated as transparent → `null`.
 *   7. Named CSS color (`white`, `black`, …) from {@link NAMED_COLOR_TO_HEX}
 *      → mapped hex.
 *   8. Empty string / whitespace → `null`.
 *   9. Anything else → `null` (renderer falls back to its default).
 *
 * The `null` everywhere fallback (instead of `undefined`) is intentional:
 * dropping the field would let the strict Zod schema accept the block, but
 * `null` is also accepted by every COLOR_SCHEMA, so emitting `null`
 * preserves the LLM's intent of "no color here" more faithfully.
 */
function coerceColor(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  // Already valid 6-digit hex — fast path. Normalize casing for stable
  // diffs but only emit a change when the string actually differs.
  if (STRICT_HEX_COLOR_RE.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    return upper === value ? value : upper;
  }
  // Other hex variants — expand / drop alpha into a 6-digit hex.
  if (HEX_COLOR_RE.test(trimmed)) {
    const body = trimmed.slice(1);
    let hex6: string;
    if (body.length === 3) {
      hex6 = `${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
    } else if (body.length === 4) {
      hex6 = `${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
    } else if (body.length === 8) {
      hex6 = body.slice(0, 6);
    } else {
      // Should not happen given the regex but defensive.
      return null;
    }
    return `#${hex6.toUpperCase()}`;
  }
  const lower = trimmed.toLowerCase();
  if (TRANSPARENT_KEYWORDS.has(lower)) return null;
  // rgb(...) / rgba(...) — manual parse to avoid pulling in a CSS color
  // library. `Number()` returns NaN for non-numeric components.
  const rgbMatch = lower.match(
    /^rgba?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?)\s*)?\)$/,
  );
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    const aRaw = rgbMatch[4];
    const a = aRaw === undefined ? 1 : Number(aRaw);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a)) {
      return null;
    }
    if (a <= 0) return null; // fully transparent → drop
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }
  const named = NAMED_COLOR_TO_HEX[lower];
  if (named) return named;
  return null;
}

/**
 * Valid `size` / `sizeMobile` enum values for Image blocks. Anything else
 * sent by the LLM falls into a runtime hole — the renderer ignores it and
 * the inspector's `useParentImageWidth` hook proceeds to overwrite
 * `props.width` with the parent container's measured width, blowing up
 * legitimately small images (avatars, logos in feature grids, etc.).
 */
const IMAGE_SIZE_VALUES = new Set(['original', 'fill', 'scale']);

/**
 * Known LLM mistakes that map cleanly to a real enum value:
 *
 * - `"cover"` is a UI label ("Cover" toggle in the inspector) the model
 *   has been mistakenly trained to emit as the data value. Internally the
 *   "Cover" toggle stores `"fill"` (full width). Many of the historical
 *   presets/recipes in `skills/email-builder/references/` carry this exact
 *   mistake; the normalizer rewrites it on the fly so newly-generated
 *   templates render correctly without having to touch the dataset.
 * - `"contain"` is the UI label for the `"original"` toggle. Same fix.
 *
 * Anything else (e.g. `"medium"` — a Button-size enum value bleeding into
 * Image — `"auto"`, `"cover-fill"`, …) is dropped and the field is omitted
 * so the inspector falls back to the default `"original"` mode and the
 * resize hook short-circuits cleanly.
 */
const IMAGE_SIZE_ALIASES: Record<string, string> = {
  cover: 'fill',
  contain: 'original',
};

/** Default scale percentage when the LLM emits `size:"scale"` without a value. */
const IMAGE_SCALE_DEFAULT = 50;

/**
 * Heuristic threshold: a `scale` strictly below this value, paired with a
 * declared `width` at or above {@link IMAGE_WIDTH_HERO_THRESHOLD}, almost
 * always indicates a hero / banner / wide content image the LLM mistakenly
 * classified as "small". Real avatars and logos have small `width`
 * (32–200px); anything 320+ is intended for the main content area.
 *
 * When the heuristic fires we upgrade `size` from `"scale"` to `"fill"` so
 * the renderer fills the parent container instead of shrinking the image
 * to a thumbnail floating in white space.
 */
const IMAGE_SCALE_UPGRADE_THRESHOLD = 30;
const IMAGE_WIDTH_HERO_THRESHOLD = 320;

/**
 * Parse a numeric-ish value into a `number`, `null`, or `undefined`.
 *
 *   - already-finite number → unchanged
 *   - `null` → `null` (schemas accept it)
 *   - `""` / `"   "` → `undefined` (dropped, equivalent to omitting the field)
 *   - `"8"`, `"8px"`, `"8.5"`, `"8 px"`, `"8em"`, `"50%"` → `8` (or `8.5`,
 *     etc.) — the unit is discarded; the schema is in pixels.
 *   - anything else → `undefined`
 */
function coerceNumber(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (trimmed === '') return undefined;
  const m = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(?:px|%|em|rem|pt)?$/i);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : undefined;
  }
  // Last-ditch: parseFloat handles cases like "8 things" by reading the
  // leading number, but we only accept it when the string actually starts
  // with a digit (or sign + digit). Otherwise we'd silently coerce
  // "thin" → NaN → undefined which is fine, and "1px solid #ccc" which is
  // handled separately by parseBorderShorthand below.
  if (/^-?\d/.test(trimmed)) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Parsed border-shorthand result. `width` is the px component. */
type BorderShorthand = { width: number; color?: string };

/**
 * Parse `"1px solid #ccc"` → `{ width: 1, color: "#ccc" }`. Falls back to
 * pure `coerceNumber` for plain values like `"1px"` or `"1"`. Returns
 * `null` when the value can't be interpreted as a width at all.
 */
function parseBorderShorthand(v: unknown): BorderShorthand | null {
  // Already a number — wrap it so the caller can treat all paths uniformly.
  if (typeof v === 'number' && Number.isFinite(v)) return { width: v };
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed === '') return null;

  // CSS shorthand FIRST — `<width> <style> <color>`. Must be tried before
  // `coerceNumber` because the latter accepts strings like "2px solid #ccc"
  // via its tolerant `parseFloat` fallback (which would return 2 and lose
  // the color).
  const shorthand = trimmed.match(
    /^(-?\d+(?:\.\d+)?)(?:px)?\s+(?:solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)\s+(.+)$/i,
  );
  if (shorthand) {
    const width = parseFloat(shorthand[1]);
    if (!Number.isFinite(width)) return null;
    const colorRaw = shorthand[2].trim();
    const hex = colorRaw.match(/^#[0-9a-fA-F]{3,8}$/) ? colorRaw : undefined;
    return { width, color: hex };
  }

  // Plain `<number>[unit]` (covers "1", "1px", "1.5px", ...).
  const plain = coerceNumber(trimmed);
  if (typeof plain === 'number') return { width: plain };

  return null;
}

/**
 * Apply the numeric-style and border coercions in-place on a shallow clone
 * of `style`. Records every change in `changes` keyed by the supplied
 * `pathPrefix` (e.g. `data.style`).
 *
 * Returns the (possibly new) style object. When nothing changed, the input
 * reference is returned so callers can identity-compare.
 */
function normalizeStyle(
  style: Record<string, unknown>,
  pathPrefix: string,
  changes: NormalizationChange[],
): Record<string, unknown> {
  let next: Record<string, unknown> | null = null;
  const ensureClone = () => {
    if (next === null) next = { ...style };
    return next;
  };

  // Plain numeric fields (borderRadius, fontSize, heights, widths, ...).
  for (const field of NUMERIC_STYLE_FIELDS) {
    if (!(field in style)) continue;
    const before = style[field];
    if (before === undefined) continue;
    if (typeof before === 'number' || before === null) continue;
    const after = coerceNumber(before);
    if (after === before) continue;
    const clone = ensureClone();
    if (after === undefined) {
      delete clone[field];
    } else {
      clone[field] = after;
    }
    changes.push({ path: `${pathPrefix}.${field}`, before, after });
  }

  // Border sides — also accept CSS shorthand. If shorthand carries a hex
  // color and `borderColor` is missing, promote it.
  let promotedBorderColor: string | undefined;
  for (const field of BORDER_SIDE_FIELDS) {
    if (!(field in style)) continue;
    const before = style[field];
    if (before === undefined) continue;
    if (typeof before === 'number' || before === null) continue;
    const parsed = parseBorderShorthand(before);
    const clone = ensureClone();
    if (parsed === null) {
      delete clone[field];
      changes.push({ path: `${pathPrefix}.${field}`, before, after: undefined });
      continue;
    }
    if (clone[field] !== parsed.width) {
      clone[field] = parsed.width;
      changes.push({ path: `${pathPrefix}.${field}`, before, after: parsed.width });
    }
    if (parsed.color && promotedBorderColor === undefined) {
      promotedBorderColor = parsed.color;
    }
  }
  if (promotedBorderColor !== undefined) {
    const existing = (next ?? style).borderColor;
    if (typeof existing !== 'string' || existing.trim() === '') {
      const clone = ensureClone();
      clone.borderColor = promotedBorderColor;
      changes.push({
        path: `${pathPrefix}.borderColor`,
        before: existing,
        after: promotedBorderColor,
      });
    }
  }

  // Padding objects — coerce each side individually.
  for (const field of PADDING_FIELDS) {
    const padding = style[field];
    if (
      padding === null ||
      padding === undefined ||
      typeof padding !== 'object' ||
      Array.isArray(padding)
    ) {
      continue;
    }
    const padObj = padding as Record<string, unknown>;
    let padNext: Record<string, unknown> | null = null;
    const ensurePadClone = () => {
      if (padNext === null) padNext = { ...padObj };
      return padNext;
    };
    for (const side of PADDING_SIDES) {
      if (!(side in padObj)) continue;
      const before = padObj[side];
      if (typeof before === 'number') continue;
      const after = coerceNumber(before);
      if (after === before) continue;
      const padClone = ensurePadClone();
      if (after === undefined) {
        // Padding sides are required when the object is present, so default
        // to 0 instead of dropping (matches the offline sanitizer's contract).
        padClone[side] = 0;
        changes.push({ path: `${pathPrefix}.${field}.${side}`, before, after: 0 });
      } else {
        padClone[side] = after;
        changes.push({ path: `${pathPrefix}.${field}.${side}`, before, after });
      }
    }
    if (padNext !== null) {
      const clone = ensureClone();
      clone[field] = padNext;
    }
  }

  // Color style fields — must be a valid 6-digit hex or null. The LLM
  // frequently emits `"transparent"`, `"#fff"` (3-digit hex), `"rgba(...)"`,
  // or named colors like `"white"`. The strict editor schema rejects all
  // of these, breaking the entire template. `coerceColor` rewrites them
  // into a valid value (expanding 3-digit hex, dropping alpha, mapping
  // common named colors) or `null` when no recovery is possible.
  for (const field of COLOR_STYLE_FIELDS) {
    if (!(field in style)) continue;
    const before = (next ?? style)[field];
    if (before === undefined) continue;
    const after = coerceColor(before);
    if (after === undefined) continue;
    if (after === before) continue;
    const clone = ensureClone();
    clone[field] = after;
    changes.push({ path: `${pathPrefix}.${field}`, before, after });
  }

  return next ?? style;
}

/**
 * Apply numeric coercion to common props (Image scale/width, SocialMedia
 * gap, etc.) plus color-prop normalization. Mirrors {@link normalizeStyle}
 * but for `data.props`.
 */
function normalizeProps(
  props: Record<string, unknown>,
  pathPrefix: string,
  changes: NormalizationChange[],
): Record<string, unknown> {
  let next: Record<string, unknown> | null = null;
  const ensureClone = () => {
    if (next === null) next = { ...props };
    return next;
  };

  for (const field of NUMERIC_PROP_FIELDS) {
    if (!(field in props)) continue;
    const before = props[field];
    if (before === undefined) continue;
    if (typeof before === 'number' || before === null) continue;
    const after = coerceNumber(before);
    if (after === before) continue;
    const clone = ensureClone();
    if (after === undefined) {
      delete clone[field];
    } else {
      clone[field] = after;
    }
    changes.push({ path: `${pathPrefix}.${field}`, before, after });
  }

  // Color prop fields — must be a valid 6-digit hex or null. Any other
  // value (3/4/8-digit hex, "transparent", "rgba(...)", named colors,
  // empty strings) is rewritten by `coerceColor` into one of those two so
  // the strict editor schema accepts the block.
  for (const field of COLOR_PROP_FIELDS) {
    if (!(field in props)) continue;
    const before = props[field];
    if (before === undefined) continue;
    const after = coerceColor(before);
    if (after === undefined) continue; // explicit no-op signal
    if (after === before) continue;
    const clone = ensureClone();
    clone[field] = after;
    changes.push({ path: `${pathPrefix}.${field}`, before, after });
  }

  // SocialMedia items[].fontSize — recurse through the array.
  if (Array.isArray(props.items)) {
    let itemsChanged = false;
    const nextItems = (props.items as unknown[]).map((item, idx) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
      const itemObj = item as Record<string, unknown>;
      if (!('fontSize' in itemObj)) return item;
      const before = itemObj.fontSize;
      if (before === undefined || typeof before === 'number' || before === null) return item;
      const after = coerceNumber(before);
      if (after === before) return item;
      itemsChanged = true;
      const clone = { ...itemObj };
      if (after === undefined) {
        delete clone.fontSize;
      } else {
        clone.fontSize = after;
      }
      changes.push({
        path: `${pathPrefix}.items[${idx}].fontSize`,
        before,
        after,
      });
      return clone;
    });
    if (itemsChanged) {
      const clone = ensureClone();
      clone.items = nextItems;
    }
  }

  return next ?? props;
}

/**
 * Image-specific size normalization. Only applies when `block.type ===
 * "Image"` because other blocks (Button, SocialMedia) reuse the `size`
 * field with a completely different enum (`"medium"`, `"large"`, `"36px"`).
 *
 * Rules applied to BOTH `size` and `sizeMobile`:
 *   1. Map known UI-label mistakes via {@link IMAGE_SIZE_ALIASES}
 *      (`"cover"` → `"fill"`, `"contain"` → `"original"`).
 *   2. Drop values that aren't in {@link IMAGE_SIZE_VALUES} after step 1
 *      so the inspector's resize hook short-circuits cleanly.
 *
 * Plus: when `size === "scale"` lands without a valid `scale` number,
 * provide a 50% fallback so the renderer doesn't emit `${undefined}%`.
 *
 * Returns the (possibly new) props object. When nothing changed, the input
 * reference is returned.
 */
function normalizeImageProps(
  props: Record<string, unknown>,
  pathPrefix: string,
  changes: NormalizationChange[],
): Record<string, unknown> {
  let next: Record<string, unknown> | null = null;
  const ensureClone = () => {
    if (next === null) next = { ...props };
    return next;
  };

  for (const field of ['size', 'sizeMobile'] as const) {
    if (!(field in props)) continue;
    const before = props[field];
    if (before === null || before === undefined) continue;
    if (typeof before !== 'string') {
      // Non-string `size` is unusable; drop it.
      const clone = ensureClone();
      delete clone[field];
      changes.push({ path: `${pathPrefix}.${field}`, before, after: undefined });
      continue;
    }
    const trimmed = before.trim().toLowerCase();
    // Already a valid enum value — fast path, no change.
    if (IMAGE_SIZE_VALUES.has(before)) continue;
    const aliased = IMAGE_SIZE_ALIASES[trimmed];
    if (aliased !== undefined && IMAGE_SIZE_VALUES.has(aliased)) {
      const clone = ensureClone();
      clone[field] = aliased;
      changes.push({ path: `${pathPrefix}.${field}`, before, after: aliased });
      continue;
    }
    // Unknown / unmappable value — drop the field so the inspector defaults
    // to "original" and the resize hook short-circuits.
    const clone = ensureClone();
    delete clone[field];
    changes.push({ path: `${pathPrefix}.${field}`, before, after: undefined });
  }

  // Pair `size: "scale"` with a numeric `scale` — fall back to 50% when
  // the model emitted scale-mode without a slider value (or with a string
  // like `"50%"` that already got dropped earlier).
  for (const [sizeField, scaleField] of [
    ['size', 'scale'],
    ['sizeMobile', 'scaleMobile'],
  ] as const) {
    const sizeValue = (next ?? props)[sizeField];
    if (sizeValue !== 'scale') continue;
    const scaleValue = (next ?? props)[scaleField];
    if (typeof scaleValue === 'number' && Number.isFinite(scaleValue) && scaleValue > 0) {
      continue;
    }
    const clone = ensureClone();
    clone[scaleField] = IMAGE_SCALE_DEFAULT;
    changes.push({
      path: `${pathPrefix}.${scaleField}`,
      before: scaleValue,
      after: IMAGE_SCALE_DEFAULT,
    });
  }

  // Upgrade misclassified hero / banner images. The LLM frequently emits
  // `size: "scale"` with a low `scale` (e.g. 15–25) AND a large declared
  // `width` (e.g. 600), which renders the image as a tiny thumbnail.
  // Real small images (avatars, logos) have small `width` (≤ 200), so a
  // `width >= 320` paired with a `scale < 30` is almost always a hero
  // that should fill its container. Falling back to `"fill"` makes the
  // renderer ignore `scale` and stretch the image to 100% of the parent.
  //
  // We process desktop and mobile pairs independently — a block can be
  // misclassified on one viewport without the other.
  for (const [sizeField, scaleField, widthField] of [
    ['size', 'scale', 'width'],
    ['sizeMobile', 'scaleMobile', 'widthMobile'],
  ] as const) {
    const sizeValue = (next ?? props)[sizeField];
    if (sizeValue !== 'scale') continue;
    const scaleValue = (next ?? props)[scaleField];
    if (
      typeof scaleValue !== 'number' ||
      !Number.isFinite(scaleValue) ||
      scaleValue >= IMAGE_SCALE_UPGRADE_THRESHOLD
    ) {
      continue;
    }
    // Mobile uses `widthMobile` first, with a fall-through to `width` so a
    // block that only declared the desktop width still benefits from the
    // upgrade signal. Desktop intentionally never reads `widthMobile`.
    const widthValue =
      (next ?? props)[widthField] ??
      (widthField === 'widthMobile' ? (next ?? props).width : undefined);
    if (typeof widthValue !== 'number' || !Number.isFinite(widthValue)) continue;
    if (widthValue < IMAGE_WIDTH_HERO_THRESHOLD) continue;

    const clone = ensureClone();
    clone[sizeField] = 'fill';
    changes.push({
      path: `${pathPrefix}.${sizeField}`,
      before: sizeValue,
      after: 'fill',
    });
    // `scale` is intentionally left as-is: the renderer ignores it when
    // `size === "fill"`, and keeping it makes the change reversible if a
    // user toggles back to scale-mode in the inspector.
  }

  return next ?? props;
}
/**
 * ColumnsContainer normalization. Clamps columnsCount to 2|3, truncates
 * fixedWidths to exactly 3 entries, and truncates columns to exactly 3
 * entries (merging overflow childrenIds into the last kept column).
 */
function normalizeColumnsContainer(
  props: Record<string, unknown>,
  pathPrefix: string,
  changes: NormalizationChange[],
): Record<string, unknown> {
  let next: Record<string, unknown> | null = null;
  const ensureClone = () => {
    if (next === null) next = { ...props };
    return next;
  };

  // Clamp columnsCount to 2 or 3
  if ('columnsCount' in props) {
    const before = props.columnsCount;
    if (typeof before === 'number' && (before < 2 || before > 3)) {
      const after = before > 3 ? 3 : 2;
      const clone = ensureClone();
      clone.columnsCount = after;
      changes.push({ path: `${pathPrefix}.columnsCount`, before, after });
    }
  }

  // Truncate fixedWidths to exactly 3 entries
  if (Array.isArray(props.fixedWidths) && props.fixedWidths.length !== 3) {
    const before = props.fixedWidths;
    const after = [before[0] ?? null, before[1] ?? null, before[2] ?? null];
    const clone = ensureClone();
    clone.fixedWidths = after;
    changes.push({ path: `${pathPrefix}.fixedWidths`, before, after });
  }

  // Truncate columns to exactly 3 entries, merging overflow into col 3
  if (Array.isArray(props.columns) && props.columns.length !== 3) {
    const before = props.columns as Array<{ childrenIds?: string[] }>;
    const col0 = before[0] ?? { childrenIds: [] };
    const col1 = before[1] ?? { childrenIds: [] };
    const col2 = before[2] ?? { childrenIds: [] };
    // Merge childrenIds from columns 3+ into column 2 (third column)
    const overflowIds = before
      .slice(3)
      .flatMap((c) => (c && Array.isArray(c.childrenIds) ? c.childrenIds : []));
    const mergedCol2 = {
      childrenIds: [...(Array.isArray(col2.childrenIds) ? col2.childrenIds : []), ...overflowIds],
    };
    const after = [col0, col1, mergedCol2];
    const clone = ensureClone();
    clone.columns = after;
    changes.push({ path: `${pathPrefix}.columns`, before, after });
  }

  // Fix layout string if it references 4+ columns
  if (typeof props.layout === 'string' && /25-25-25-25|layout-\d+-\d+-\d+-\d+/.test(props.layout)) {
    const clone = ensureClone();
    const count = (next ?? props).columnsCount;
    clone.layout = count === 3 ? 'layout-33-33-33' : 'layout-50-50';
    changes.push({ path: `${pathPrefix}.layout`, before: props.layout, after: clone.layout });
  }

  return next ?? props;
}

/**
 * Normalize a parsed `{id, block}` NDJSON payload. Returns the same input
 * reference (and an empty `changes` array) when nothing required coercion.
 *
 * The function tolerates inputs that don't match the expected shape — they
 * pass through untouched. Validation is the next layer's responsibility.
 */
export function normalizeBlockPayload(payload: unknown): NormalizationResult {
  const changes: NormalizationChange[] = [];

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { block: payload, changes };
  }

  const root = payload as Record<string, unknown>;
  const block = root.block;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    return { block: payload, changes };
  }

  const blockObj = block as Record<string, unknown>;
  const data = blockObj.data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { block: payload, changes };
  }

  const dataObj = data as Record<string, unknown>;

  // EmailLayout-level borderRadius lives directly on `data` (not inside
  // `data.style`). Treat it as a top-level numeric field.
  let nextData: Record<string, unknown> | null = null;
  const ensureDataClone = () => {
    if (nextData === null) nextData = { ...dataObj };
    return nextData;
  };

  if ('borderRadius' in dataObj) {
    const before = dataObj.borderRadius;
    if (before !== undefined && before !== null && typeof before !== 'number') {
      const after = coerceNumber(before);
      if (after !== before) {
        const clone = ensureDataClone();
        if (after === undefined) {
          delete clone.borderRadius;
        } else {
          clone.borderRadius = after;
        }
        changes.push({ path: 'data.borderRadius', before, after });
      }
    }
  }

  // EmailLayout-level color fields live directly on `data` (not inside
  // `data.style` or `data.props`). They follow the same hex-or-null
  // contract as every other COLOR_SCHEMA. We only touch them when the
  // block is actually an `EmailLayout` to avoid accidentally rewriting a
  // similarly-named field on a hypothetical custom block type.
  if (blockObj.type === 'EmailLayout') {
    for (const field of COLOR_EMAIL_LAYOUT_FIELDS) {
      if (!(field in dataObj)) continue;
      const before = dataObj[field];
      if (before === undefined) continue;
      const after = coerceColor(before);
      if (after === undefined) continue;
      if (after === before) continue;
      const clone = ensureDataClone();
      clone[field] = after;
      changes.push({ path: `data.${field}`, before, after });
    }
    // `data.linkGlobal.linkColor` — a nested optional sub-object.
    const linkGlobal = (nextData ?? dataObj).linkGlobal;
    if (
      linkGlobal !== null &&
      linkGlobal !== undefined &&
      typeof linkGlobal === 'object' &&
      !Array.isArray(linkGlobal) &&
      'linkColor' in (linkGlobal as Record<string, unknown>)
    ) {
      const lgObj = linkGlobal as Record<string, unknown>;
      const before = lgObj.linkColor;
      const after = coerceColor(before);
      if (after !== undefined && after !== before) {
        const clone = ensureDataClone();
        clone.linkGlobal = { ...lgObj, linkColor: after };
        changes.push({ path: 'data.linkGlobal.linkColor', before, after });
      }
    }
  }

  // data.style — most coercions land here.
  const style = dataObj.style;
  if (style !== null && typeof style === 'object' && !Array.isArray(style)) {
    const normalizedStyle = normalizeStyle(style as Record<string, unknown>, 'data.style', changes);
    if (normalizedStyle !== style) {
      const clone = ensureDataClone();
      clone.style = normalizedStyle;
    }
  }

  // data.props — Image / SocialMedia numeric props.
  const props = dataObj.props;
  if (props !== null && typeof props === 'object' && !Array.isArray(props)) {
    let normalizedProps = normalizeProps(props as Record<string, unknown>, 'data.props', changes);
    // Image-specific size enum coercion. Done after `normalizeProps` so the
    // numeric `scale` / `width` are already coerced to numbers when we
    // reason about the scale fallback.
    if (blockObj.type === 'Image') {
      normalizedProps = normalizeImageProps(normalizedProps, 'data.props', changes);
    }
    // ColumnsContainer — clamp to max 3 columns.
    if (blockObj.type === 'ColumnsContainer') {
      normalizedProps = normalizeColumnsContainer(normalizedProps, 'data.props', changes);
    }
    if (normalizedProps !== props) {
      const clone = ensureDataClone();
      clone.props = normalizedProps;
    }
  }

  if (nextData === null) {
    return { block: payload, changes };
  }

  const nextBlock: Record<string, unknown> = { ...blockObj, data: nextData };
  const nextPayload: Record<string, unknown> = { ...root, block: nextBlock };
  return { block: nextPayload, changes };
}
