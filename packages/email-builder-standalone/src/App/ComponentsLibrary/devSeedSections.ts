/**
 * Dev-only seeder for prebuilt Sections across every library role
 * (hero, features, social_proof, cta, header, footer, nav, logo, pricing,
 * comparison, testimonial, stats, steps, faq, team, gallery, banner).
 * Mirrors `devSeedTemplates`: runs in the browser and POSTs each section to
 * `/dev/save-section`. The backend renumbers ids and writes `{uuid}.ndjson`
 * under `references/sections/{role}/`.
 *
 * Trigger from the dev console after `pnpm dev` + `pnpm dev:backend`:
 *
 *   await window.__seedSections()                 // seed all 68
 *   await window.__seedSections({ role: 'pricing' })  // one role
 *
 * Visual richness comes from BLOCK-LEVEL styling (containers, buttons,
 * dividers, images). NotionText HTML is limited to what the bubble menu can
 * produce/re-edit: heading tags (<h1>/<h2>/<h3>), <strong>/<em>/<u>/<s>,
 * <ul>/<ol>, text-align, <span color>, <span background-color>, <a> links,
 * literal emoji and merge tags. The palette is intentionally NEUTRAL — the
 * brand arrives when the user applies a theme (apply-theme strips the
 * governed keys, so neutral seeds rebrand cleanly).
 *
 * Thumbnails are NOT captured here (no DOM render) — cards show a
 * placeholder until the section is opened in the editor and re-saved.
 * Idempotent by (role, name): existing sections with the same name are
 * skipped (or overwritten with `force`).
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import { DEFAULT_IMAGE_PLACEHOLDER } from '../../documents/editor/EditorContext';

type BlockEntry = { id: string; block: unknown };
type Pad = { top: number; right: number; bottom: number; left: number };

type Node =
  | { t: 'container'; style?: object; children: Node[] }
  | { t: 'cols'; style?: object; props: object; columns: Node[][] }
  | { t: 'text'; style?: object; html: string }
  | { t: 'button'; style?: object; props: object }
  | { t: 'image'; style?: object; props: object }
  | { t: 'divider'; style?: object }
  | { t: 'spacer'; style?: object };

const IMG = DEFAULT_IMAGE_PLACEHOLDER;

// Neutral palette (no brand/accent hue — emphasis via neutral contrast).
const WHITE = '#FFFFFF';
const LIGHT = '#F9FAFB'; // card surface
const SURFACE = '#F5F5F7'; // subtle grey chip/section
const BORDER = '#E5E7EB';
const DARK = '#111827'; // text + dark band + button bg + emphasis
const MUTED = '#6B7280'; // muted body text
const SOFT = '#D1D5DB'; // muted text on dark bands

const pad = (top: number, right: number, bottom: number, left: number): Pad => ({
  top,
  right,
  bottom,
  left,
});
const round = (r: number) => ({ topLeft: r, topRight: r, bottomLeft: r, bottomRight: r });

// --- Base node builders ----------------------------------------------------

const text = (html: string, style: object = {}): Node => ({ t: 'text', html, style });

const button = (
  label: string,
  opts: {
    bg?: string;
    color?: string;
    full?: boolean;
    size?: 'x-small' | 'small' | 'medium';
    pt?: number;
    pb?: number;
  } = {},
): Node => {
  const { bg = DARK, color = WHITE, full = false, size = 'medium', pt = 8, pb = 0 } = opts;
  return {
    t: 'button',
    style: {
      padding: pad(pt, 0, pb, 0),
      textAlign: 'center',
      buttonBackgroundColor: bg,
      buttonTextColor: color,
      shape: 'rectangle',
    },
    props: {
      text: label,
      url: '#',
      buttonBackgroundColor: bg,
      buttonTextColor: color,
      fullWidth: full,
      size,
    },
  };
};

const image = (alt: string, style: object = {}, props: object = {}): Node => ({
  t: 'image',
  style: { padding: pad(0, 0, 0, 0), textAlign: 'center', ...style },
  // `fill` = 100% column width (render uses '100%', stable on select).
  props: { url: IMG, alt, size: 'fill', ...props },
});

// Rounded avatar: `scale` mode keeps the rendered width a fixed percentage
// (<100%) so selecting the image never triggers the parent-width resize in
// `useParentImageWidth`. A square box (height + objectFit cover) + pill shape
// reads as a circle. `touched: true` also short-circuits the resize hook.
const avatar = (alt: string): Node =>
  image(
    alt,
    { shape: 'pill', height: 96, objectFit: 'cover' },
    { size: 'scale', scale: 45, width: 96, touched: true },
  );

// Constrained logo image (same scale recipe to avoid the select-resize bug).
const logo = (alt = 'Logo', align: 'left' | 'center' | 'right' = 'center'): Node =>
  image(
    alt,
    { textAlign: align, height: 40, objectFit: 'contain' },
    { size: 'scale', scale: 24, width: 140, touched: true },
  );

const divider = (style: object = {}): Node => ({
  t: 'divider',
  style: { color: BORDER, height: 1, width: 100, padding: pad(12, 0, 12, 0), ...style },
});
const spacer = (height = 16): Node => ({ t: 'spacer', style: { height } });
const container = (children: Node[], style: object = {}): Node => ({
  t: 'container',
  children,
  style,
});
const cols = (
  columnsCount: 2 | 3,
  fixedWidths: (number | null)[],
  columns: Node[][],
  style: object = {},
  props: object = {},
): Node => ({
  t: 'cols',
  style,
  props: { fixedWidths, columnsCount, layout: 'layout-custom', contentAlignment: 'top', ...props },
  columns,
});

/** Flatten a node tree into `{id, block}[]` with the root at index 0. */
function flatten(root: Node): BlockEntry[] {
  const entries: BlockEntry[] = [];
  let counter = 0;
  const walk = (node: Node): string => {
    const id = `seed-${++counter}`;
    const entry: BlockEntry = { id, block: null };
    entries.push(entry);
    switch (node.t) {
      case 'text':
        entry.block = {
          type: 'NotionText',
          data: { style: node.style ?? {}, props: { html: node.html } },
        };
        break;
      case 'button':
        entry.block = { type: 'Button', data: { style: node.style ?? {}, props: node.props } };
        break;
      case 'image':
        entry.block = { type: 'Image', data: { style: node.style ?? {}, props: node.props } };
        break;
      case 'divider':
        entry.block = { type: 'Divider', data: { style: node.style ?? {} } };
        break;
      case 'spacer':
        entry.block = { type: 'Spacer', data: { style: node.style ?? {} } };
        break;
      case 'container':
        entry.block = {
          type: 'Container',
          data: { style: node.style ?? {}, props: { childrenIds: node.children.map(walk) } },
        };
        break;
      case 'cols': {
        const colArrays = node.columns.map((col) => col.map(walk));
        while (colArrays.length < 3) colArrays.push([]);
        entry.block = {
          type: 'ColumnsContainer',
          data: {
            style: node.style ?? {},
            props: { ...node.props, columns: colArrays.map((ids) => ({ childrenIds: ids })) },
          },
        };
        break;
      }
    }
    return id;
  };
  walk(root);
  return entries;
}

// --- Text fragments (NotionText, bubble-menu-only HTML) --------------------

type Align = 'left' | 'center' | 'right';
const p = (s: string, align: Align = 'center'): string =>
  `<p style="text-align:${align};">${s}</p>`;
const hTag = (lvl: 1 | 2 | 3, s: string, align: Align = 'center'): string =>
  `<h${lvl} style="text-align:${align};">${s}</h${lvl}>`;
// Flat highlighted label (allowed). NOT a rounded pill: rounded pills need a
// full-width Container, which reads as a bar in email layout — a flat color
// span is the compliant, compact alternative per the plan's §2 note.
const badge = (s: string, bg = DARK, color = WHITE): string =>
  `<span style="background-color:${bg};"><span style="color:${color};">&nbsp;${s}&nbsp;</span></span>`;
const link = (s: string, color = DARK): string =>
  `<a href="#"><span style="color:${color};">${s}</span></a>`;
const stars = (n = 5): string => '⭐'.repeat(n);

// Heading block — size from the heading TAG (survives theme apply, which
// strips block-level fontSize). h1≈2em, h2≈1.5em, h3≈1.17em of the base size.
const head = (
  lvl: 1 | 2 | 3,
  s: string,
  opts: { color?: string; align?: Align; pt?: number; pb?: number } = {},
): Node => {
  const { color = DARK, align = 'center', pt = 0, pb = 8 } = opts;
  return text(hTag(lvl, s, align), { color, padding: pad(pt, 0, pb, 0) });
};
// Body / sub / label paragraph.
const para = (
  s: string,
  opts: { color?: string; align?: Align; pt?: number; pb?: number; px?: number; fz?: number } = {},
): Node => {
  const { color = MUTED, align = 'center', pt = 0, pb = 8, px = 8, fz } = opts;
  return text(p(s, align), {
    color,
    ...(fz ? { fontSize: fz } : {}),
    padding: pad(pt, px, pb, px),
  });
};
const eyebrow = (s: string, align: Align = 'center'): Node =>
  text(p(`<strong>${s}</strong>`, align), { color: MUTED, fontSize: 12, padding: pad(0, 0, 6, 0) });
// ✓ / ✕ checklist as plain paragraphs (avoids the double-bullet look of <ul>).
const checks = (
  items: string[],
  opts: { color?: string; align?: Align; mark?: string } = {},
): Node => {
  const { color = DARK, align = 'left', mark = '✓' } = opts;
  return text(items.map((i) => p(`${mark} ${i}`, align)).join(''), {
    color,
    padding: pad(8, 4, 8, 4),
  });
};

// --- Card / column fragments ----------------------------------------------

const SECTION_PAD = pad(40, 40, 40, 40);
const section = (children: Node[], style: object = {}): Node =>
  container(children, { padding: SECTION_PAD, ...style });
const col3 = (a: Node[], b: Node[], c: Node[], props: object = {}, style: object = {}): Node =>
  cols(3, [33, 34, 33], [a, b, c], style, props);
const col2 = (
  a: Node[],
  b: Node[],
  widths: (number | null)[] = [50, 50, null],
  props: object = {},
  style: object = {},
): Node => cols(2, widths, [a, b], style, props);

// Light bordered, rounded card.
const cardStyle = (highlight = false): object => ({
  backgroundColor: highlight ? LIGHT : WHITE,
  borderColor: highlight ? DARK : BORDER,
  borderTop: highlight ? 2 : 1,
  borderBottom: highlight ? 2 : 1,
  borderLeft: highlight ? 2 : 1,
  borderRight: highlight ? 2 : 1,
  shape: round(14),
  padding: pad(24, 20, 24, 20),
});

const planCard = (
  name: string,
  priceStr: string,
  period: string,
  feats: string[],
  cta: string,
  opts: { highlight?: boolean; badgeText?: string } = {},
): Node =>
  container(
    [
      ...(opts.badgeText ? [para(badge(opts.badgeText), { pb: 8 })] : []),
      head(3, name, { pb: 2 }),
      text(`${hTag(1, priceStr)}${p(`<strong>${period}</strong>`)}`, {
        color: DARK,
        padding: pad(4, 0, 8, 0),
      }),
      checks(feats),
      button(cta, { full: true }),
    ],
    cardStyle(opts.highlight),
  );

const feature = (emoji: string, title: string, desc: string): Node[] => [
  text(p(emoji), { fontSize: 30, padding: pad(0, 0, 8, 0) }),
  head(3, title, { pb: 4 }),
  para(desc),
];
const iconStat = (emoji: string, n: string, l: string): Node[] => [
  text(p(emoji), { fontSize: 28, padding: pad(0, 0, 6, 0) }),
  head(2, n, { pb: 2 }),
  para(l),
];
const stepCol = (n: string, title: string, desc: string): Node[] => [
  para(badge(n), { pb: 8 }),
  head(3, title, { pb: 4 }),
  para(desc),
];

const testimonialCard = (quote: string, name: string, role: string): Node =>
  container(
    [
      para(stars(), { color: DARK, pb: 8 }),
      para(`“${quote}”`, { color: DARK, pb: 8 }),
      divider(),
      avatar(name),
      para(`<strong>${name}</strong>`, { color: DARK, pt: 8, pb: 2 }),
      para(role),
    ],
    cardStyle(),
  );

const memberCard = (name: string, role: string, bio?: string): Node =>
  container(
    [
      avatar(name),
      para(`<strong>${name}</strong>`, { color: DARK, pt: 8, pb: 2 }),
      para(role, { pb: bio ? 6 : 6 }),
      ...(bio ? [para(bio, { pb: 6 })] : []),
      para(`${link('Twitter')} · ${link('LinkedIn')}`, { color: DARK }),
    ],
    { padding: pad(12, 8, 12, 8) },
  );

const productCard = (title: string, priceStr: string): Node =>
  container(
    [
      image(title),
      head(3, title, { pt: 8, pb: 2 }),
      para(priceStr, { color: DARK, pb: 8 }),
      button('View', { full: true, size: 'small' }),
    ],
    cardStyle(),
  );

const qa = (q: string, a: string): Node[] => [
  head(3, q, { align: 'left', pb: 4 }),
  para(a, { align: 'left', px: 0, pb: 0 }),
];
const tableRow = (feat: string, a: string, b: string): Node =>
  col3(
    [para(feat, { color: DARK, align: 'left' })],
    [para(a, { color: DARK })],
    [para(b, { color: DARK })],
  );

// --- Advanced helpers (background images, button radius, card variants, mobile)
//     See docs/plans/components-library-advanced-section-variants.md.

type BgPos =
  | 'center center'
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right';
type BgSize = 'cover' | 'contain' | 'auto';
type BgRepeat = 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';

/** Build a CSS `background` shorthand string compatible with `BackgroundImageInput`. */
const bg = (
  url: string = IMG,
  opts: { pos?: BgPos; size?: BgSize; repeat?: BgRepeat } = {},
): string => {
  const { pos = 'center center', size = 'cover', repeat = 'no-repeat' } = opts;
  return `url("${url}") ${repeat} ${pos} / ${size}`;
};

/**
 * Section with a background image + safety-net `backgroundColor`. The tint
 * doubles as a dark overlay for legible white text. Mobile padding is
 * tightened by default for phone-friendly layouts.
 */
const sectionBg = (
  children: Node[],
  opts: { url?: string; tint?: string; pos?: BgPos } = {},
  style: object = {},
): Node =>
  section(children, {
    backgroundColor: opts.tint ?? DARK,
    background: bg(opts.url, { pos: opts.pos }),
    mobilePadding: pad(28, 20, 28, 20),
    ...style,
  });

/** Pill (capsule) button — `shape: 'pill'` with `fullWidthMobile` on by default. */
const pillButton = (
  label: string,
  opts: {
    bg?: string;
    color?: string;
    full?: boolean;
    size?: 'x-small' | 'small' | 'medium';
    fullMobile?: boolean;
    pt?: number;
    pb?: number;
  } = {},
): Node => {
  const {
    bg: b = DARK,
    color = WHITE,
    full = false,
    size = 'medium',
    fullMobile = true,
    pt = 8,
    pb = 0,
  } = opts;
  return {
    t: 'button',
    style: {
      padding: pad(pt, 0, pb, 0),
      mobilePadding: pad(pt, 0, pb, 0),
      textAlign: 'center',
      buttonBackgroundColor: b,
      buttonTextColor: color,
      shape: 'pill',
    },
    props: {
      text: label,
      url: '#',
      buttonBackgroundColor: b,
      buttonTextColor: color,
      fullWidth: full,
      fullWidthMobile: fullMobile,
      size,
    },
  };
};

/** Asymmetric-corner button — pass any subset of `topLeft`/`topRight`/`bottomLeft`/`bottomRight`. */
const corneredButton = (
  label: string,
  corners: { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number },
  opts: {
    bg?: string;
    color?: string;
    full?: boolean;
    fullMobile?: boolean;
    size?: 'x-small' | 'small' | 'medium';
    pt?: number;
    pb?: number;
  } = {},
): Node => {
  const {
    bg: b = DARK,
    color = WHITE,
    full = false,
    fullMobile = true,
    size = 'medium',
    pt = 8,
    pb = 0,
  } = opts;
  return {
    t: 'button',
    style: {
      padding: pad(pt, 0, pb, 0),
      mobilePadding: pad(pt, 0, pb, 0),
      textAlign: 'center',
      buttonBackgroundColor: b,
      buttonTextColor: color,
      shape: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0, ...corners },
    },
    props: {
      text: label,
      url: '#',
      buttonBackgroundColor: b,
      buttonTextColor: color,
      fullWidth: full,
      fullWidthMobile: fullMobile,
      size,
    },
  };
};

/** Card with a vertical CSS gradient surface. */
const gradientCardStyle = (from: string = LIGHT, to: string = WHITE): object => ({
  backgroundColor: from,
  background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
  borderColor: BORDER,
  borderTop: 1,
  borderBottom: 1,
  borderLeft: 1,
  borderRight: 1,
  shape: round(16),
  padding: pad(28, 24, 28, 24),
  mobilePadding: pad(20, 18, 20, 18),
});

/** Card backed by a real image with a dark tint overlay for white-text legibility. */
const imageCardStyle = (url: string = IMG, tint: string = DARK): object => ({
  backgroundColor: tint,
  background: bg(url),
  shape: round(16),
  padding: pad(48, 28, 48, 28),
  mobilePadding: pad(36, 20, 36, 20),
});

/** Card with asymmetric corner radius (designer accent). */
const corneredCardStyle = (
  corners: { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = {
    topLeft: 24,
    bottomRight: 24,
  },
  highlight = false,
): object => ({
  backgroundColor: highlight ? LIGHT : WHITE,
  borderColor: highlight ? DARK : BORDER,
  borderTop: highlight ? 2 : 1,
  borderBottom: highlight ? 2 : 1,
  borderLeft: highlight ? 2 : 1,
  borderRight: highlight ? 2 : 1,
  shape: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0, ...corners },
  padding: pad(28, 24, 28, 24),
  mobilePadding: pad(22, 18, 22, 18),
});

/** Card with a thick top accent border, square top corners, rounded bottom. */
const topAccentCardStyle = (color: string = DARK): object => ({
  backgroundColor: WHITE,
  borderColor: color,
  borderTop: 4,
  borderBottom: 1,
  borderLeft: 1,
  borderRight: 1,
  shape: { topLeft: 0, topRight: 0, bottomLeft: 14, bottomRight: 14 },
  padding: pad(28, 24, 28, 24),
  mobilePadding: pad(22, 18, 22, 18),
});

/** Pill-silhouette card (only safe on short / single-row content). */
const pillCardStyle = (): object => ({
  backgroundColor: LIGHT,
  borderColor: BORDER,
  borderTop: 1,
  borderBottom: 1,
  borderLeft: 1,
  borderRight: 1,
  shape: 'pill',
  padding: pad(16, 24, 16, 24),
  mobilePadding: pad(14, 18, 14, 18),
});

/** Section with mobile-tightened padding (no background). */
const sectionM = (children: Node[], style: object = {}): Node =>
  section(children, { mobilePadding: pad(28, 20, 28, 20), ...style });

/** Heading that downsizes on mobile via block-level `fontSizeMobile`. */
const headM = (
  lvl: 1 | 2 | 3,
  s: string,
  opts: { color?: string; align?: Align; pt?: number; pb?: number; fzMobile?: number } = {},
): Node => {
  const fallback = lvl === 1 ? 28 : lvl === 2 ? 22 : 18;
  const { color = DARK, align = 'center', pt = 0, pb = 8, fzMobile = fallback } = opts;
  return text(hTag(lvl, s, align), {
    color,
    padding: pad(pt, 0, pb, 0),
    mobilePadding: pad(pt, 0, pb, 0),
    fontSizeMobile: fzMobile,
  });
};

/** 2-column with mobile-stack baked in. Wraps `col2` with `stackColumnsOnMobile: true`. */
const col2Stack = (
  a: Node[],
  b: Node[],
  widths: (number | null)[] = [50, 50, null],
  props: object = {},
  style: object = {},
): Node =>
  col2(
    a,
    b,
    widths,
    { stackColumnsOnMobile: true, contentAlignmentMobile: 'top', ...props },
    style,
  );

/** 3-column with mobile-stack baked in. */
const col3Stack = (a: Node[], b: Node[], c: Node[], props: object = {}, style: object = {}): Node =>
  col3(a, b, c, { stackColumnsOnMobile: true, contentAlignmentMobile: 'top', ...props }, style);

// --- 68 prebuilt sections (17 roles × 4) -----------------------------------

type SectionDef = { role: string; name: string; node: Node };

const SECTIONS: SectionDef[] = [
  // hero
  {
    role: 'hero',
    name: 'Centered',
    node: section(
      [
        eyebrow('NEW'),
        head(1, 'Build emails your whole team will love'),
        para('Hi [name], create beautiful, responsive emails in minutes — no code required.', {
          pb: 12,
          px: 24,
        }),
        button('Get started'),
        para(link('or take the tour →'), { pt: 8 }),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'hero',
    name: 'Split image',
    node: section([
      col2(
        [
          head(1, 'Ship campaigns faster', { align: 'left' }),
          para('Drag, drop, done. Launch on-brand emails without waiting on engineering.', {
            align: 'left',
            px: 0,
            pb: 12,
          }),
          button('Start free'),
        ],
        [image('Hero illustration')],
        [55, 45, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },
  {
    role: 'hero',
    name: 'Dark band',
    node: section(
      [
        head(1, 'Email that performs', { color: WHITE }),
        para('Everything you need to design, test, and send.', { color: SOFT, pb: 12 }),
        button('Get started', { bg: WHITE, color: DARK }),
      ],
      { backgroundColor: DARK },
    ),
  },
  {
    role: 'hero',
    name: 'Logo + headline',
    node: section([
      logo(),
      head(1, 'Welcome to Acme', { pt: 8 }),
      para('The fastest way to reach your audience.', { pb: 12 }),
      button('Get started'),
    ]),
  },

  // features
  {
    role: 'features',
    name: '3 columns with icons',
    node: section([
      eyebrow('FEATURES'),
      head(2, 'Everything you need', { pb: 16 }),
      col3(
        feature('⚡', 'Fast', 'Build and ship in minutes, not days.'),
        feature('🎨', 'On-brand', 'Themes keep every email consistent.'),
        feature('📈', 'Insightful', 'Track opens and clicks in real time.'),
      ),
    ]),
  },
  {
    role: 'features',
    name: 'Alternating rows',
    node: section([
      col2(
        [image('Feature one')],
        [
          head(3, 'Design visually', { align: 'left' }),
          para('Compose with blocks and see results instantly.', { align: 'left', px: 0 }),
        ],
        [45, 55, null],
        { contentAlignment: 'middle' },
      ),
      spacer(20),
      col2(
        [
          head(3, 'Reuse everything', { align: 'left' }),
          para('Save sections and drop them into any template.', { align: 'left', px: 0 }),
        ],
        [image('Feature two')],
        [55, 45, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },
  {
    role: 'features',
    name: 'Checklist',
    node: section([
      head(2, 'What you get', { pb: 12 }),
      col2(
        [checks(['Unlimited templates', 'Custom themes', 'Image gallery'])],
        [checks(['Merge tags', 'HTML & JSON export', 'Team sharing'])],
      ),
    ]),
  },
  {
    role: 'features',
    name: '4-up grid',
    node: section([
      head(2, 'Built for teams', { pb: 16 }),
      col2(
        feature('🚀', 'Launch fast', 'From idea to inbox quickly.'),
        feature('🔒', 'Secure', 'Your data stays protected.'),
      ),
      spacer(20),
      col2(
        feature('🧩', 'Modular', 'Mix and match blocks.'),
        feature('🌙', 'Dark mode', 'Looks great anywhere.'),
      ),
    ]),
  },

  // social_proof
  {
    role: 'social_proof',
    name: 'Logos row',
    node: section(
      [
        eyebrow('TRUSTED BY TEAMS WORLDWIDE'),
        col3([logo('Brand 1')], [logo('Brand 2')], [logo('Brand 3')], {
          contentAlignment: 'middle',
        }),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'social_proof',
    name: 'Rating band',
    node: section(
      [
        para(stars(), { color: DARK, pb: 4 }),
        head(2, '4.9 / 5', { pb: 2 }),
        para('from 2,000+ verified reviews', { pb: 0 }),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'social_proof',
    name: 'Press quotes',
    node: section([
      col3(
        [para('“A must-have tool.”', { color: DARK }), para('— The Verge')],
        [para('“Beautifully simple.”', { color: DARK }), para('— Wired')],
        [para('“Saves hours weekly.”', { color: DARK }), para('— TechCrunch')],
      ),
    ]),
  },
  {
    role: 'social_proof',
    name: 'Stat + logos',
    node: section([
      head(1, '10,000+', { pb: 2 }),
      para('teams send with us every day', { pb: 16 }),
      col3([logo('Brand 1')], [logo('Brand 2')], [logo('Brand 3')], { contentAlignment: 'middle' }),
    ]),
  },

  // cta
  {
    role: 'cta',
    name: 'Centered band',
    node: section(
      [
        head(2, 'Ready to get started?', { color: WHITE }),
        para('Join thousands of teams building better emails.', { color: SOFT, pb: 12 }),
        button('Start free', { bg: WHITE, color: DARK }),
      ],
      { backgroundColor: DARK },
    ),
  },
  {
    role: 'cta',
    name: 'Split',
    node: section(
      [
        col2(
          [
            head(3, 'Start building today', { align: 'left' }),
            para('No credit card required.', { align: 'left', px: 0 }),
          ],
          [button('Get started', { full: true })],
          [60, 40, null],
          { contentAlignment: 'middle' },
        ),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'cta',
    name: 'Card',
    node: section([
      container(
        [
          head(2, 'Try it free for 14 days'),
          para('Full access, cancel anytime.', { pb: 12 }),
          button('Start trial'),
          para('No credit card required.', { pt: 8 }),
        ],
        cardStyle(),
      ),
    ]),
  },
  {
    role: 'cta',
    name: 'Newsletter',
    node: section(
      [
        head(2, 'Subscribe to our newsletter'),
        para('Get product updates sent to [email].', { pb: 12 }),
        button('Subscribe'),
        para('We respect your privacy. Unsubscribe anytime.', { pt: 8 }),
      ],
      { backgroundColor: LIGHT },
    ),
  },

  // header
  {
    role: 'header',
    name: 'Logo + nav',
    node: container(
      [
        col2(
          [logo('Logo', 'left')],
          [
            para(`${link('Home')}&nbsp;&nbsp;${link('Pricing')}&nbsp;&nbsp;${link('Blog')}`, {
              align: 'right',
              px: 0,
              color: DARK,
            }),
          ],
          [40, 60, null],
          { contentAlignment: 'middle' },
        ),
      ],
      { padding: pad(20, 40, 20, 40) },
    ),
  },
  {
    role: 'header',
    name: 'Centered logo',
    node: container([logo(), para('Email made simple', { pt: 4 })], {
      padding: pad(24, 40, 24, 40),
    }),
  },
  {
    role: 'header',
    name: 'Logo + CTA',
    node: container(
      [
        col2(
          [logo('Logo', 'left')],
          [button('Sign in', { full: false, size: 'small' })],
          [50, 50, null],
          {
            contentAlignment: 'middle',
          },
        ),
      ],
      { padding: pad(16, 40, 16, 40) },
    ),
  },
  {
    role: 'header',
    name: 'Preheader + logo',
    node: container([para(`{webversion}View web version{/webversion}`, { pb: 8 }), logo()], {
      padding: pad(16, 40, 16, 40),
    }),
  },

  // footer
  {
    role: 'footer',
    name: 'Full',
    node: section(
      [
        logo(),
        spacer(12),
        col3(
          [
            para(`<strong>Product</strong><br>${link('Features')}<br>${link('Pricing')}`, {
              color: DARK,
            }),
          ],
          [
            para(`<strong>Company</strong><br>${link('About')}<br>${link('Careers')}`, {
              color: DARK,
            }),
          ],
          [
            para(`<strong>Legal</strong><br>${link('Privacy')}<br>${link('Terms')}`, {
              color: DARK,
            }),
          ],
        ),
        divider(),
        para('123 Market St, San Francisco, CA', { pb: 4 }),
        para(`{unsubscribe}Unsubscribe{/unsubscribe} · © [currentyear] Acme Inc.`),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'footer',
    name: 'Minimal',
    node: section(
      [
        para('<strong>Acme Inc.</strong>', { color: DARK, pb: 4 }),
        para(`{unsubscribe}Unsubscribe{/unsubscribe} · © [currentyear]`),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'footer',
    name: 'Social + links',
    node: section(
      [
        para(`${link('Twitter')}&nbsp;&nbsp;${link('LinkedIn')}&nbsp;&nbsp;${link('Instagram')}`, {
          pb: 12,
          color: DARK,
        }),
        col2(
          [para(`${link('Features')}<br>${link('Pricing')}`, { color: DARK })],
          [para(`${link('About')}<br>${link('Contact')}`, { color: DARK })],
        ),
        divider(),
        para('© [currentyear] Acme Inc. All rights reserved.'),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'footer',
    name: 'Contact',
    node: section(
      [
        para('<strong>Acme Inc.</strong>', { color: DARK, pb: 4 }),
        para('123 Market St, San Francisco, CA'),
        para('[email] · +1 (555) 123-4567', { pb: 8 }),
        para(`{unsubscribe}Unsubscribe{/unsubscribe}`),
      ],
      { backgroundColor: LIGHT },
    ),
  },

  // nav
  {
    role: 'nav',
    name: 'Horizontal links',
    node: container(
      [
        para(
          `${link('Home')}&nbsp;&nbsp;${link('Products')}&nbsp;&nbsp;${link('Pricing')}&nbsp;&nbsp;${link('Blog')}&nbsp;&nbsp;${link('Contact')}`,
          { color: DARK },
        ),
      ],
      { padding: pad(16, 40, 16, 40) },
    ),
  },
  {
    role: 'nav',
    name: 'Logo + links',
    node: container(
      [
        col2(
          [logo('Logo', 'left')],
          [
            para(`${link('Home')}&nbsp;&nbsp;${link('Pricing')}&nbsp;&nbsp;${link('Blog')}`, {
              align: 'right',
              px: 0,
              color: DARK,
            }),
          ],
          [40, 60, null],
          { contentAlignment: 'middle' },
        ),
      ],
      { padding: pad(16, 40, 16, 40) },
    ),
  },
  {
    role: 'nav',
    name: 'Pill links',
    node: container(
      [
        para(
          `${badge('Home', SURFACE, DARK)} ${badge('Pricing', SURFACE, DARK)} ${badge('Blog', SURFACE, DARK)}`,
          {
            color: DARK,
          },
        ),
      ],
      { padding: pad(16, 40, 16, 40) },
    ),
  },
  {
    role: 'nav',
    name: 'Categories',
    node: section([
      col3(
        [
          para(`<strong>Product</strong><br>${link('Features')}<br>${link('Pricing')}`, {
            color: DARK,
            align: 'left',
          }),
        ],
        [
          para(`<strong>Resources</strong><br>${link('Blog')}<br>${link('Guides')}`, {
            color: DARK,
            align: 'left',
          }),
        ],
        [
          para(`<strong>Company</strong><br>${link('About')}<br>${link('Careers')}`, {
            color: DARK,
            align: 'left',
          }),
        ],
      ),
    ]),
  },

  // logo
  { role: 'logo', name: 'Centered', node: container([logo()], { padding: pad(24, 40, 24, 40) }) },
  {
    role: 'logo',
    name: 'Left aligned',
    node: container([logo('Logo', 'left')], { padding: pad(24, 40, 24, 40) }),
  },
  {
    role: 'logo',
    name: 'Logo + tagline',
    node: container([logo(), para('Your tagline here', { pt: 4 })], {
      padding: pad(24, 40, 24, 40),
    }),
  },
  {
    role: 'logo',
    name: 'Wordmark',
    node: container([head(2, 'ACME', { pb: 0 })], { padding: pad(24, 40, 24, 40) }),
  },

  // pricing
  {
    role: 'pricing',
    name: '3 tiers with highlight',
    node: section([
      eyebrow('PRICING'),
      head(2, 'Simple, transparent pricing'),
      para('Choose the plan that fits your team.', { pb: 16 }),
      col3(
        [
          planCard(
            'Starter',
            '$9',
            '/mo',
            ['1 user', '10 templates', 'Email support'],
            'Choose plan',
          ),
        ],
        [
          planCard(
            'Pro',
            '$29',
            '/mo',
            ['5 users', 'Unlimited templates', 'Priority support', 'Custom themes'],
            'Choose plan',
            { highlight: true, badgeText: 'Most popular' },
          ),
        ],
        [
          planCard(
            'Scale',
            '$99',
            '/mo',
            ['Unlimited users', 'SSO & roles', 'Dedicated support'],
            'Choose plan',
          ),
        ],
      ),
    ]),
  },
  {
    role: 'pricing',
    name: 'Monthly / Annual',
    node: section([
      head(2, 'Pick your billing', { pb: 16 }),
      col2(
        [planCard('Monthly', '$12', '/mo', ['All features', 'Cancel anytime'], 'Choose')],
        [
          planCard('Annual', '$120', '/yr', ['All features', '2 months free'], 'Choose', {
            highlight: true,
            badgeText: 'Save 20%',
          }),
        ],
      ),
    ]),
  },
  {
    role: 'pricing',
    name: 'Single feature card',
    node: section([
      container(
        [
          head(2, 'Pro'),
          text(`${hTag(1, '$29')}${p('<strong>/mo</strong>')}`, {
            color: DARK,
            padding: pad(4, 0, 8, 0),
          }),
          col2(
            [checks(['Unlimited templates', 'Custom themes', 'Priority support'])],
            [checks(['Team sharing', 'HTML export', 'Analytics'])],
          ),
          button('Get started'),
          para('Billed monthly. Cancel anytime.', { pt: 8 }),
        ],
        { ...cardStyle(), borderTop: 3, borderColor: DARK, padding: pad(32, 28, 32, 28) },
      ),
    ]),
  },
  {
    role: 'pricing',
    name: 'Comparison table',
    node: section([
      head(2, 'Compare plans', { pb: 12 }),
      col3(
        [para('<strong>Feature</strong>', { color: DARK, align: 'left' })],
        [para('<strong>Free</strong>', { color: DARK })],
        [para('<strong>Pro</strong>', { color: DARK })],
        {},
        { backgroundColor: SURFACE },
      ),
      divider(),
      tableRow('Templates', '5', 'Unlimited'),
      divider(),
      tableRow('Team members', '1', 'Unlimited'),
      divider(),
      tableRow('Priority support', '✕', '✓'),
    ]),
  },

  // comparison
  {
    role: 'comparison',
    name: 'Us vs Them',
    node: section([
      head(2, 'Why choose us', { pb: 16 }),
      col2(
        [
          container([head(3, 'Us', { color: WHITE, pb: 0 })], {
            backgroundColor: DARK,
            shape: round(10),
            padding: pad(10, 16, 10, 16),
          }),
          checks(['Unlimited projects', 'Priority support', 'No hidden fees']),
        ],
        [
          container([head(3, 'Them', { color: DARK, pb: 0 })], {
            backgroundColor: SURFACE,
            shape: round(10),
            padding: pad(10, 16, 10, 16),
          }),
          checks(['Limited projects', 'Slow support', 'Extra fees'], { mark: '✕', color: MUTED }),
        ],
      ),
    ]),
  },
  {
    role: 'comparison',
    name: 'Before / After',
    node: section([
      col2(
        [
          image('Before'),
          para(badge('BEFORE', SURFACE, DARK), { pt: 8, pb: 4 }),
          para('Cluttered and slow.'),
        ],
        [image('After'), para(badge('AFTER'), { pt: 8, pb: 4 }), para('Clean and fast.')],
      ),
    ]),
  },
  {
    role: 'comparison',
    name: 'Feature matrix',
    node: section([
      head(2, 'Feature comparison', { pb: 12 }),
      col3(
        [para('<strong>Feature</strong>', { color: DARK, align: 'left' })],
        [para('<strong>Basic</strong>', { color: DARK })],
        [para('<strong>Premium</strong>', { color: DARK })],
        {},
        { backgroundColor: SURFACE },
      ),
      divider(),
      tableRow('Analytics', '—', '✓'),
      divider(),
      tableRow('Integrations', '3', 'Unlimited'),
      divider(),
      tableRow('Support', 'Email', '24/7'),
    ]),
  },
  {
    role: 'comparison',
    name: 'Option A vs B',
    node: section([
      col2(
        [
          container(
            [
              head(3, 'Option A'),
              checks(['Quick setup', 'Lower cost']),
              button('Choose A', { full: true }),
            ],
            cardStyle(),
          ),
        ],
        [
          container(
            [
              head(3, 'Option B'),
              checks(['More power', 'Scales further']),
              button('Choose B', { full: true }),
            ],
            cardStyle(),
          ),
        ],
      ),
    ]),
  },

  // testimonial
  {
    role: 'testimonial',
    name: 'Featured quote',
    node: section([
      eyebrow('TESTIMONIAL'),
      head(2, '“The most intuitive email tool we’ve ever used.”'),
      para(stars(), { color: DARK, pb: 8 }),
      avatar('Customer'),
      para('<strong>Jordan Pike</strong>', { color: DARK, pt: 8, pb: 2 }),
      para('Director of Design, Acme'),
    ]),
  },
  {
    role: 'testimonial',
    name: '3 testimonial cards',
    node: section([
      col3(
        [testimonialCard('Best decision we made all year.', 'Sam', 'Founder')],
        [testimonialCard('Support is genuinely incredible.', 'Jo', 'Product')],
        [testimonialCard('Saves our team hours weekly.', 'Lee', 'Ops')],
      ),
    ]),
  },
  {
    role: 'testimonial',
    name: 'Quote with author',
    node: section([
      col2(
        [avatar('Customer')],
        [
          para('“This changed how our team works.”', { color: DARK, align: 'left', px: 0, pb: 4 }),
          para(stars(), { color: DARK, align: 'left', px: 0, pb: 4 }),
          para('Alex Rivera · CEO, Acme', { align: 'left', px: 0 }),
        ],
        [25, 75, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },
  {
    role: 'testimonial',
    name: 'Trusted-by + quote',
    node: section([
      head(2, '“Leading teams trust us”'),
      para('used by 2,000+ companies', { pb: 16 }),
      col3([logo('Brand 1')], [logo('Brand 2')], [logo('Brand 3')], { contentAlignment: 'middle' }),
    ]),
  },

  // stats
  {
    role: 'stats',
    name: 'KPI band',
    node: section(
      [
        col3(
          [head(1, '10k+', { color: WHITE, pb: 2 }), para('Active users', { color: SOFT })],
          [head(1, '99.9%', { color: WHITE, pb: 2 }), para('Uptime', { color: SOFT })],
          [head(1, '4.9/5', { color: WHITE, pb: 2 }), para('Avg rating', { color: SOFT })],
        ),
      ],
      { backgroundColor: DARK },
    ),
  },
  {
    role: 'stats',
    name: '4 metrics grid',
    node: section([
      head(2, 'By the numbers', { pb: 16 }),
      col2(
        [head(1, '2M', { pb: 2 }), para('Emails sent')],
        [head(1, '150+', { pb: 2 }), para('Countries')],
      ),
      spacer(16),
      col2(
        [head(1, '98%', { pb: 2 }), para('Deliverability')],
        [head(1, '24/7', { pb: 2 }), para('Support')],
      ),
    ]),
  },
  {
    role: 'stats',
    name: 'Highlight + context',
    node: section([
      col2(
        [head(1, '500%', { align: 'left' })],
        [
          para('Average ROI reported by customers in their first year.', {
            align: 'left',
            px: 0,
            pb: 12,
          }),
          button('See case studies'),
        ],
        [40, 60, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },
  {
    role: 'stats',
    name: 'Stats with icons',
    node: section([
      col3(
        iconStat('👥', '10k+', 'Users'),
        iconStat('⚡', '99.9%', 'Uptime'),
        iconStat('⭐', '4.9', 'Rating'),
      ),
    ]),
  },

  // steps
  {
    role: 'steps',
    name: 'How it works',
    node: section([
      eyebrow('HOW IT WORKS'),
      head(2, 'Get started in 3 steps', { pb: 16 }),
      col3(
        stepCol('1', 'Sign up', 'Create your free account in seconds.'),
        stepCol('2', 'Build', 'Drag and drop your first email.'),
        stepCol('3', 'Send', 'Ship to your audience instantly.'),
      ),
    ]),
  },
  {
    role: 'steps',
    name: 'Onboarding vertical',
    node: section([
      col2(
        [para(badge('1'))],
        [
          head(3, 'Connect', { align: 'left', pb: 2 }),
          para('Link your data source.', { align: 'left', px: 0 }),
        ],
        [15, 85, null],
        { contentAlignment: 'middle' },
      ),
      divider(),
      col2(
        [para(badge('2'))],
        [
          head(3, 'Build', { align: 'left', pb: 2 }),
          para('Design your first flow.', { align: 'left', px: 0 }),
        ],
        [15, 85, null],
        { contentAlignment: 'middle' },
      ),
      divider(),
      col2(
        [para(badge('3'))],
        [
          head(3, 'Launch', { align: 'left', pb: 2 }),
          para('Go live with confidence.', { align: 'left', px: 0 }),
        ],
        [15, 85, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },
  {
    role: 'steps',
    name: 'Process with images',
    node: section([
      col3(
        [
          image('Step 1'),
          para('STEP 1', { pt: 8, pb: 2 }),
          head(3, 'Plan', { pb: 4 }),
          para('Define your goal.'),
        ],
        [
          image('Step 2'),
          para('STEP 2', { pt: 8, pb: 2 }),
          head(3, 'Create', { pb: 4 }),
          para('Design the content.'),
        ],
        [
          image('Step 3'),
          para('STEP 3', { pt: 8, pb: 2 }),
          head(3, 'Launch', { pb: 4 }),
          para('Go live with confidence.'),
        ],
      ),
    ]),
  },
  {
    role: 'steps',
    name: '2-step + CTA',
    node: section([
      col2(
        stepCol('1', 'Connect', 'Link your source.'),
        stepCol('2', 'Automate', 'Let the flows run.'),
      ),
      spacer(20),
      button('Get started'),
    ]),
  },

  // faq
  {
    role: 'faq',
    name: 'FAQ list',
    node: section([
      head(2, 'Frequently asked questions', { pb: 12 }),
      ...qa('Can I cancel anytime?', 'Yes, cancel with one click — no questions asked.'),
      divider(),
      ...qa('Is there a free trial?', 'Every plan includes a 14-day free trial.'),
      divider(),
      ...qa('Do you offer support?', 'Priority support is on all paid plans.'),
    ]),
  },
  {
    role: 'faq',
    name: 'FAQ 2 columns',
    node: section([
      head(2, 'Questions & answers', { pb: 12 }),
      col2(
        [
          ...qa('What is included?', 'All core features and updates.'),
          spacer(10),
          ...qa('Can I upgrade?', 'Anytime, instantly.'),
        ],
        [
          ...qa('How is billing handled?', 'Monthly or yearly — your choice.'),
          spacer(10),
          ...qa('Is my data safe?', 'Encrypted at rest and in transit.'),
        ],
      ),
    ]),
  },
  {
    role: 'faq',
    name: 'FAQ + contact CTA',
    node: section([
      head(2, 'FAQ', { pb: 12 }),
      ...qa('Where are servers located?', 'Globally distributed for low latency.'),
      divider(),
      ...qa('Do you offer refunds?', 'Yes, within 30 days.'),
      spacer(20),
      container(
        [
          head(3, 'Still have questions?'),
          para('Our team is here to help.', { pb: 12 }),
          button('Contact us'),
        ],
        cardStyle(),
      ),
    ]),
  },
  {
    role: 'faq',
    name: 'FAQ with categories',
    node: section([
      head(2, 'Billing', { align: 'left', pb: 8 }),
      ...qa('How does billing work?', 'Monthly or yearly — your choice.'),
      divider(),
      spacer(8),
      head(2, 'Security', { align: 'left', pb: 8 }),
      ...qa('Is my data encrypted?', 'Yes, at rest and in transit.'),
    ]),
  },

  // team
  {
    role: 'team',
    name: '3 member cards',
    node: section([
      col3(
        [memberCard('Maya Chen', 'CEO', 'Building tools that make teams faster.')],
        [memberCard('Tom Reed', 'CTO', 'Loves clean code and good coffee.')],
        [memberCard('Ana Lopez', 'Head of Design', 'Obsessed with great UX.')],
      ),
    ]),
  },
  {
    role: 'team',
    name: '2 founders',
    node: section([
      col2(
        [
          memberCard(
            'Maya Chen',
            'Co-founder & CEO',
            'Previously led design at two startups. Passionate about product.',
          ),
        ],
        [
          memberCard(
            'Tom Reed',
            'Co-founder & CTO',
            'Engineer at heart. Built systems used by millions.',
          ),
        ],
      ),
    ]),
  },
  {
    role: 'team',
    name: 'Team grid + heading',
    node: section([
      eyebrow('OUR TEAM'),
      head(2, 'Meet the people behind it'),
      para('A small team with big ambitions.', { pb: 16 }),
      col3(
        [memberCard('Maya Chen', 'CEO')],
        [memberCard('Tom Reed', 'CTO')],
        [memberCard('Ana Lopez', 'Design')],
      ),
    ]),
  },
  {
    role: 'team',
    name: 'Single spotlight',
    node: section([
      container(
        [
          avatar('Founder'),
          para('<strong>Maya Chen</strong>', { color: DARK, pt: 8, pb: 2 }),
          para('Founder & CEO', { pb: 8 }),
          para('“We’re building the email tool we always wished we had.”', { color: DARK, pb: 8 }),
          para(link('LinkedIn'), { color: DARK }),
        ],
        cardStyle(),
      ),
    ]),
  },

  // gallery
  {
    role: 'gallery',
    name: '3 product cards',
    node: section([
      col3(
        [productCard('Classic Tee', '$29')],
        [productCard('Canvas Bag', '$39')],
        [productCard('Ceramic Mug', '$15')],
      ),
    ]),
  },
  {
    role: 'gallery',
    name: '2 featured',
    node: section([
      col2(
        [
          image('Featured 1'),
          para('Spring collection', { color: DARK, pt: 8, pb: 2 }),
          para(link('Shop now →'), { color: DARK }),
        ],
        [
          image('Featured 2'),
          para('Summer essentials', { color: DARK, pt: 8, pb: 2 }),
          para(link('Shop now →'), { color: DARK }),
        ],
      ),
    ]),
  },
  {
    role: 'gallery',
    name: 'Hero + thumbnails',
    node: section([
      image('Featured'),
      spacer(12),
      col3([image('Thumb 1')], [image('Thumb 2')], [image('Thumb 3')]),
    ]),
  },
  {
    role: 'gallery',
    name: 'Lookbook grid',
    node: section([
      head(2, 'Lookbook', { pb: 16 }),
      col3(
        [image('Look 1'), para('Morning', { pt: 6 })],
        [image('Look 2'), para('Daytime', { pt: 6 })],
        [image('Look 3'), para('Evening', { pt: 6 })],
      ),
    ]),
  },

  // banner
  {
    role: 'banner',
    name: 'Promo CTA',
    node: section([
      container(
        [
          para(badge('LIMITED', WHITE, DARK), { pb: 8 }),
          head(2, 'Summer sale — 30% off', { color: WHITE }),
          para('Ends Sunday. Don’t miss out.', { color: SOFT, pb: 12 }),
          button('Shop now', { bg: WHITE, color: DARK }),
        ],
        { backgroundColor: DARK, shape: round(16), padding: pad(32, 28, 32, 28) },
      ),
    ]),
  },
  {
    role: 'banner',
    name: 'Sale banner',
    node: section(
      [
        col2(
          [
            head(2, 'Limited time offer', { color: WHITE, align: 'left' }),
            para('Save big this week only.', { color: SOFT, align: 'left', px: 0 }),
          ],
          [button('Claim offer', { bg: WHITE, color: DARK, full: true })],
          [60, 40, null],
          { contentAlignment: 'middle' },
        ),
      ],
      { backgroundColor: DARK },
    ),
  },
  {
    role: 'banner',
    name: 'Newsletter signup',
    node: section([
      container(
        [
          head(2, 'Stay in the loop'),
          para('Get the latest updates at [email].', { pb: 12 }),
          button('Subscribe'),
          para('No spam. Unsubscribe anytime.', { pt: 8 }),
        ],
        cardStyle(),
      ),
    ]),
  },

  // === Advanced variants — 51 sections (17 roles × 3) ============================
  // Background images, button radius (pill / cornered), richer cards, mobile-aware.
  // See docs/plans/components-library-advanced-section-variants.md.

  // hero — advanced
  {
    role: 'hero',
    name: 'BG image overlay',
    node: sectionBg(
      [
        eyebrow('NEW LAUNCH'),
        headM(1, 'Build emails your team will love', { color: WHITE }),
        para('Hi [name], create beautiful, responsive emails in minutes.', {
          color: SOFT,
          pb: 12,
          px: 24,
        }),
        pillButton('Get started', { bg: WHITE, color: DARK }),
        para(link('or take the tour →', SOFT), { color: SOFT, pt: 8 }),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'hero',
    name: 'Image card with pill CTA',
    node: sectionM([
      container(
        [
          headM(1, 'Ship campaigns faster', { color: WHITE }),
          para('Drag, drop, done. Launch on-brand emails without waiting on engineering.', {
            color: SOFT,
            pb: 12,
            px: 16,
          }),
          pillButton('Start free', { bg: WHITE, color: DARK }),
        ],
        imageCardStyle(),
      ),
    ]),
  },
  {
    role: 'hero',
    name: 'Split mobile reflow',
    node: sectionM([
      col2Stack(
        [
          headM(1, 'Email that performs', { align: 'left' }),
          para('Everything you need to design, test, and send.', { align: 'left', px: 0, pb: 12 }),
          corneredButton('Get started', { topLeft: 16, bottomRight: 16 }, { fullMobile: true }),
        ],
        [image('Hero illustration')],
        [55, 45, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },

  // features — advanced
  {
    role: 'features',
    name: 'Gradient cards',
    node: sectionM([
      eyebrow('FEATURES'),
      headM(2, 'Everything you need', { pb: 16 }),
      col3Stack(
        [
          container(
            feature('⚡', 'Fast', 'Build and ship in minutes, not days.'),
            gradientCardStyle(),
          ),
        ],
        [
          container(
            feature('🎨', 'On-brand', 'Themes keep every email consistent.'),
            gradientCardStyle(),
          ),
        ],
        [
          container(
            feature('📈', 'Insightful', 'Track opens and clicks in real time.'),
            gradientCardStyle(),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'features',
    name: 'Image-backed showcase rows',
    node: sectionM([
      col2Stack(
        [
          container(
            [
              para('FEATURED', { color: WHITE, pb: 6 }),
              headM(3, 'Design visually', { color: WHITE, align: 'left' }),
            ],
            imageCardStyle(),
          ),
        ],
        [
          headM(3, 'Build with blocks', { align: 'left' }),
          para('Compose with reusable blocks and see results instantly.', { align: 'left', px: 0 }),
        ],
        [45, 55, null],
        { contentAlignment: 'middle' },
      ),
      spacer(20),
      col2Stack(
        [
          headM(3, 'Reuse everything', { align: 'left' }),
          para('Save sections and drop them into any template.', { align: 'left', px: 0 }),
        ],
        [
          container(
            [
              para('LIBRARY', { color: WHITE, pb: 6 }),
              headM(3, 'Save & share', { color: WHITE, align: 'left' }),
            ],
            imageCardStyle(),
          ),
        ],
        [55, 45, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },
  {
    role: 'features',
    name: '4-up grid mobile reflow',
    node: sectionM([
      headM(2, 'Built for teams', { pb: 16 }),
      col2Stack(
        [
          container(
            feature('🚀', 'Launch fast', 'From idea to inbox quickly.'),
            topAccentCardStyle(),
          ),
        ],
        [container(feature('🔒', 'Secure', 'Your data stays protected.'), topAccentCardStyle())],
      ),
      spacer(20),
      col2Stack(
        [container(feature('🧩', 'Modular', 'Mix and match blocks.'), topAccentCardStyle())],
        [container(feature('🌙', 'Dark mode', 'Looks great anywhere.'), topAccentCardStyle())],
      ),
    ]),
  },

  // social_proof — advanced
  {
    role: 'social_proof',
    name: 'BG image quote band',
    node: sectionBg(
      [
        para(stars(), { color: WHITE, pb: 12 }),
        headM(2, '“The most intuitive email tool we’ve ever used.”', { color: WHITE }),
        avatar('Customer'),
        para('<strong>Jordan Pike</strong>', { color: WHITE, pt: 8, pb: 2 }),
        para('Director of Design, Acme', { color: SOFT }),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'social_proof',
    name: 'Pill rating card',
    node: sectionM([
      container(
        [
          para(stars(), { color: DARK, pb: 4 }),
          para('<strong>4.9 / 5 from 2,000+ reviews</strong>', { color: DARK, pb: 0 }),
        ],
        pillCardStyle(),
      ),
    ]),
  },
  {
    role: 'social_proof',
    name: 'Logos mobile stack',
    node: sectionM(
      [
        eyebrow('TRUSTED BY TEAMS WORLDWIDE'),
        col3Stack([logo('Brand 1')], [logo('Brand 2')], [logo('Brand 3')], {
          contentAlignment: 'middle',
        }),
      ],
      { backgroundColor: LIGHT },
    ),
  },

  // cta — advanced
  {
    role: 'cta',
    name: 'BG image promo card',
    node: sectionM([
      container(
        [
          para(badge('LIMITED', WHITE, DARK), { color: WHITE, pb: 8 }),
          headM(2, 'Summer sale — 30% off', { color: WHITE }),
          para('Ends Sunday. Don’t miss out.', { color: SOFT, pb: 12 }),
          pillButton('Shop now', { bg: WHITE, color: DARK, fullMobile: true }),
        ],
        imageCardStyle(),
      ),
    ]),
  },
  {
    role: 'cta',
    name: 'Cornered accent card',
    node: sectionM([
      container(
        [
          headM(2, 'Try it free for 14 days'),
          para('Full access. Cancel anytime.', { pb: 12 }),
          corneredButton('Start trial', { topLeft: 16, bottomRight: 16 }, { fullMobile: true }),
          para('No credit card required.', { pt: 8 }),
        ],
        corneredCardStyle({ topLeft: 24, bottomRight: 24 }),
      ),
    ]),
  },
  {
    role: 'cta',
    name: 'Two-column mobile stack',
    node: sectionM(
      [
        col2Stack(
          [
            headM(3, 'Start building today', { align: 'left' }),
            para('No credit card required.', { align: 'left', px: 0 }),
          ],
          [pillButton('Get started', { full: true, fullMobile: true })],
          [60, 40, null],
          { contentAlignment: 'middle' },
        ),
      ],
      { backgroundColor: LIGHT },
    ),
  },

  // header — advanced
  {
    role: 'header',
    name: 'BG image band',
    node: sectionBg(
      [
        logo(),
        spacer(8),
        headM(2, 'Welcome to Acme', { color: WHITE }),
        para('The fastest way to reach your audience.', { color: SOFT }),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'header',
    name: 'Pill nav buttons',
    node: container(
      [
        col2Stack(
          [logo('Logo', 'left')],
          [
            container(
              [
                pillButton('Home', {
                  bg: SURFACE,
                  color: DARK,
                  size: 'small',
                  fullMobile: false,
                  pt: 0,
                }),
                spacer(4),
                pillButton('Pricing', {
                  bg: SURFACE,
                  color: DARK,
                  size: 'small',
                  fullMobile: false,
                  pt: 0,
                }),
                spacer(4),
                pillButton('Blog', {
                  bg: SURFACE,
                  color: DARK,
                  size: 'small',
                  fullMobile: false,
                  pt: 0,
                }),
              ],
              { textAlign: 'right', padding: pad(0, 0, 0, 0) },
            ),
          ],
          [40, 60, null],
          { contentAlignment: 'middle' },
        ),
      ],
      { padding: pad(16, 40, 16, 40), mobilePadding: pad(14, 20, 14, 20) },
    ),
  },
  {
    role: 'header',
    name: 'Mobile-tight logo',
    node: container([logo(), para('Email made simple', { pt: 4 })], {
      padding: pad(24, 40, 24, 40),
      mobilePadding: pad(12, 16, 12, 16),
      borderColor: BORDER,
      borderBottomMobile: 1,
    }),
  },

  // footer — advanced
  {
    role: 'footer',
    name: 'Dark BG with pattern',
    node: sectionBg(
      [
        logo(),
        spacer(12),
        col3Stack(
          [
            para(
              `<strong>Product</strong><br>${link('Features', WHITE)}<br>${link('Pricing', WHITE)}`,
              {
                color: WHITE,
              },
            ),
          ],
          [
            para(
              `<strong>Company</strong><br>${link('About', WHITE)}<br>${link('Careers', WHITE)}`,
              { color: WHITE },
            ),
          ],
          [
            para(`<strong>Legal</strong><br>${link('Privacy', WHITE)}<br>${link('Terms', WHITE)}`, {
              color: WHITE,
            }),
          ],
        ),
        divider({ color: SOFT }),
        para('123 Market St, San Francisco, CA', { color: SOFT, pb: 4 }),
        para(`{unsubscribe}Unsubscribe{/unsubscribe} · © [currentyear] Acme Inc.`, { color: SOFT }),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'footer',
    name: 'Pill social row',
    node: sectionM(
      [
        para('<strong>Follow us</strong>', { color: DARK, pb: 8 }),
        col3Stack(
          [
            pillButton('Twitter', {
              bg: SURFACE,
              color: DARK,
              size: 'small',
              fullMobile: false,
              pt: 0,
            }),
          ],
          [
            pillButton('LinkedIn', {
              bg: SURFACE,
              color: DARK,
              size: 'small',
              fullMobile: false,
              pt: 0,
            }),
          ],
          [
            pillButton('Instagram', {
              bg: SURFACE,
              color: DARK,
              size: 'small',
              fullMobile: false,
              pt: 0,
            }),
          ],
        ),
        divider(),
        col2Stack(
          [para(`${link('Features')}<br>${link('Pricing')}`, { color: DARK })],
          [para(`${link('About')}<br>${link('Contact')}`, { color: DARK })],
        ),
        para('© [currentyear] Acme Inc. All rights reserved.', { pt: 12 }),
      ],
      { backgroundColor: LIGHT },
    ),
  },
  {
    role: 'footer',
    name: 'Mobile-stacked contact',
    node: sectionM(
      [
        col2Stack(
          [
            para('<strong>Acme Inc.</strong>', { color: DARK, align: 'left', px: 0, pb: 4 }),
            para('123 Market St, San Francisco, CA', { align: 'left', px: 0 }),
            para('[email] · +1 (555) 123-4567', { align: 'left', px: 0 }),
          ],
          [
            para('<strong>Quick links</strong>', { color: DARK, align: 'left', px: 0, pb: 4 }),
            para(`${link('Features')}<br>${link('Pricing')}`, {
              color: DARK,
              align: 'left',
              px: 0,
            }),
          ],
        ),
        divider(),
        para(`{unsubscribe}Unsubscribe{/unsubscribe}`),
      ],
      { backgroundColor: LIGHT },
    ),
  },

  // nav — advanced
  {
    role: 'nav',
    name: 'BG image band',
    node: sectionBg(
      [
        para(
          `${link('Home', WHITE)}&nbsp;&nbsp;${link('Products', WHITE)}&nbsp;&nbsp;${link('Pricing', WHITE)}&nbsp;&nbsp;${link('Blog', WHITE)}&nbsp;&nbsp;${link('Contact', WHITE)}`,
          { color: WHITE },
        ),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'nav',
    name: 'Pill button row',
    node: container(
      [
        col3Stack(
          [
            pillButton('Home', {
              bg: SURFACE,
              color: DARK,
              size: 'x-small',
              fullMobile: false,
              pt: 0,
            }),
          ],
          [
            pillButton('Pricing', {
              bg: SURFACE,
              color: DARK,
              size: 'x-small',
              fullMobile: false,
              pt: 0,
            }),
          ],
          [
            pillButton('Blog', {
              bg: SURFACE,
              color: DARK,
              size: 'x-small',
              fullMobile: false,
              pt: 0,
            }),
          ],
        ),
      ],
      { padding: pad(16, 40, 16, 40), mobilePadding: pad(14, 20, 14, 20) },
    ),
  },
  {
    role: 'nav',
    name: 'Mobile-stack categories',
    node: sectionM([
      col3Stack(
        [
          para(`<strong>Product</strong><br>${link('Features')}<br>${link('Pricing')}`, {
            color: DARK,
            align: 'left',
          }),
        ],
        [
          para(`<strong>Resources</strong><br>${link('Blog')}<br>${link('Guides')}`, {
            color: DARK,
            align: 'left',
          }),
        ],
        [
          para(`<strong>Company</strong><br>${link('About')}<br>${link('Careers')}`, {
            color: DARK,
            align: 'left',
          }),
        ],
      ),
    ]),
  },

  // logo — advanced
  { role: 'logo', name: 'On BG image', node: sectionBg([logo()], { tint: DARK }) },
  {
    role: 'logo',
    name: 'Cornered card',
    node: sectionM([
      container(
        [logo(), para('Your tagline here', { pt: 4, pb: 0 })],
        corneredCardStyle({ topLeft: 24, topRight: 24 }),
      ),
    ]),
  },
  {
    role: 'logo',
    name: 'Mobile-tight wordmark',
    node: container([headM(2, 'ACME', { fzMobile: 22 })], {
      padding: pad(24, 40, 24, 40),
      mobilePadding: pad(16, 16, 16, 16),
    }),
  },

  // pricing — advanced
  {
    role: 'pricing',
    name: 'Image-backed highlight tier',
    node: sectionM([
      eyebrow('PRICING'),
      headM(2, 'Simple, transparent pricing'),
      para('Choose the plan that fits your team.', { pb: 16 }),
      col3Stack(
        [
          planCard(
            'Starter',
            '$9',
            '/mo',
            ['1 user', '10 templates', 'Email support'],
            'Choose plan',
          ),
        ],
        [
          container(
            [
              para(badge('Most popular', WHITE, DARK), { color: WHITE, pb: 8 }),
              headM(3, 'Pro', { color: WHITE, pb: 2 }),
              text(`${hTag(1, '$29')}${p('<strong>/mo</strong>')}`, {
                color: WHITE,
                padding: pad(4, 0, 8, 0),
              }),
              checks(['5 users', 'Unlimited templates', 'Priority support', 'Custom themes'], {
                color: WHITE,
              }),
              pillButton('Choose plan', { bg: WHITE, color: DARK, full: true, fullMobile: true }),
            ],
            imageCardStyle(),
          ),
        ],
        [
          planCard(
            'Scale',
            '$99',
            '/mo',
            ['Unlimited users', 'SSO & roles', 'Dedicated support'],
            'Choose plan',
          ),
        ],
      ),
    ]),
  },
  {
    role: 'pricing',
    name: 'Cornered cards row',
    node: sectionM([
      headM(2, 'Pick your plan', { pb: 16 }),
      col3Stack(
        [
          container(
            [
              headM(3, 'Starter', { pb: 2 }),
              text(`${hTag(1, '$9')}${p('<strong>/mo</strong>')}`, {
                color: DARK,
                padding: pad(4, 0, 8, 0),
              }),
              checks(['1 user', '10 templates', 'Email support']),
              pillButton('Choose', { full: true, fullMobile: true }),
            ],
            corneredCardStyle({ topLeft: 24, bottomRight: 24 }),
          ),
        ],
        [
          container(
            [
              headM(3, 'Pro', { pb: 2 }),
              text(`${hTag(1, '$29')}${p('<strong>/mo</strong>')}`, {
                color: DARK,
                padding: pad(4, 0, 8, 0),
              }),
              checks(['5 users', 'Unlimited', 'Priority support']),
              pillButton('Choose', { full: true, fullMobile: true }),
            ],
            corneredCardStyle({ topLeft: 24, bottomRight: 24 }, true),
          ),
        ],
        [
          container(
            [
              headM(3, 'Scale', { pb: 2 }),
              text(`${hTag(1, '$99')}${p('<strong>/mo</strong>')}`, {
                color: DARK,
                padding: pad(4, 0, 8, 0),
              }),
              checks(['Unlimited users', 'SSO & roles', 'Dedicated']),
              pillButton('Choose', { full: true, fullMobile: true }),
            ],
            corneredCardStyle({ topLeft: 24, bottomRight: 24 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'pricing',
    name: 'Mobile-stacked plans',
    node: sectionM([
      headM(2, 'Pick your billing', { pb: 16 }),
      col2Stack(
        [
          container(
            [
              headM(3, 'Monthly', { pb: 2 }),
              text(`${hTag(1, '$12')}${p('<strong>/mo</strong>')}`, {
                color: DARK,
                padding: pad(4, 0, 8, 0),
              }),
              checks(['All features', 'Cancel anytime']),
              pillButton('Choose', { full: true, fullMobile: true }),
            ],
            gradientCardStyle(),
          ),
        ],
        [
          container(
            [
              para(badge('Save 20%'), { pb: 8 }),
              headM(3, 'Annual', { pb: 2 }),
              text(`${hTag(1, '$120')}${p('<strong>/yr</strong>')}`, {
                color: DARK,
                padding: pad(4, 0, 8, 0),
              }),
              checks(['All features', '2 months free']),
              pillButton('Choose', { full: true, fullMobile: true }),
            ],
            gradientCardStyle(SURFACE, WHITE),
          ),
        ],
      ),
    ]),
  },

  // comparison — advanced
  {
    role: 'comparison',
    name: 'BG image hero compare',
    node: sectionM([
      sectionBg(
        [
          headM(2, 'Why choose us', { color: WHITE }),
          para('See how we stack up against the alternatives.', { color: SOFT, pb: 0 }),
        ],
        { tint: DARK },
      ),
      spacer(16),
      col2Stack(
        [
          container(
            [
              headM(3, 'Us', { pb: 8 }),
              checks(['Unlimited projects', 'Priority support', 'No hidden fees']),
            ],
            corneredCardStyle({ topLeft: 24, bottomRight: 24 }, true),
          ),
        ],
        [
          container(
            [
              headM(3, 'Them', { pb: 8 }),
              checks(['Limited projects', 'Slow support', 'Extra fees'], {
                mark: '✕',
                color: MUTED,
              }),
            ],
            corneredCardStyle({ topRight: 24, bottomLeft: 24 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'comparison',
    name: 'Top-accent matrix',
    node: sectionM([
      headM(2, 'Feature comparison', { pb: 12 }),
      container(
        [
          col3Stack(
            [para('<strong>Feature</strong>', { color: WHITE, align: 'left' })],
            [para('<strong>Basic</strong>', { color: WHITE })],
            [para('<strong>Premium</strong>', { color: WHITE })],
          ),
        ],
        {
          backgroundColor: DARK,
          shape: { topLeft: 12, topRight: 12, bottomLeft: 0, bottomRight: 0 },
          padding: pad(12, 16, 12, 16),
        },
      ),
      tableRow('Analytics', '—', '✓'),
      divider(),
      tableRow('Integrations', '3', 'Unlimited'),
      divider(),
      tableRow('Support', 'Email', '24/7'),
    ]),
  },
  {
    role: 'comparison',
    name: 'Mobile-reflow A vs B',
    node: sectionM([
      col2Stack(
        [
          container(
            [
              headM(3, 'Option A'),
              checks(['Quick setup', 'Lower cost']),
              pillButton('Choose A', { full: true, fullMobile: true }),
            ],
            gradientCardStyle(),
          ),
        ],
        [
          container(
            [
              headM(3, 'Option B'),
              checks(['More power', 'Scales further']),
              pillButton('Choose B', { full: true, fullMobile: true }),
            ],
            gradientCardStyle(),
          ),
        ],
      ),
    ]),
  },

  // testimonial — advanced
  {
    role: 'testimonial',
    name: 'BG image featured quote',
    node: sectionBg(
      [
        para(stars(), { color: WHITE, pb: 12 }),
        headM(2, '“This changed how our team works.”', { color: WHITE }),
        avatar('Customer'),
        para('<strong>Alex Rivera</strong>', { color: WHITE, pt: 8, pb: 2 }),
        para('CEO, Acme', { color: SOFT }),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'testimonial',
    name: 'Pill avatar cards',
    node: sectionM([
      col3Stack(
        [
          container(
            [
              para(stars(), { color: DARK, pb: 8 }),
              para('“Best decision we made all year.”', { color: DARK, pb: 8 }),
              avatar('Sam'),
              para('<strong>Sam</strong>', { color: DARK, pt: 8, pb: 2 }),
              para('Founder', { pb: 8 }),
              pillButton('Read more', {
                bg: SURFACE,
                color: DARK,
                size: 'small',
                fullMobile: false,
                pt: 0,
              }),
            ],
            corneredCardStyle({ topLeft: 24, topRight: 24 }),
          ),
        ],
        [
          container(
            [
              para(stars(), { color: DARK, pb: 8 }),
              para('“Support is genuinely incredible.”', { color: DARK, pb: 8 }),
              avatar('Jo'),
              para('<strong>Jo</strong>', { color: DARK, pt: 8, pb: 2 }),
              para('Product', { pb: 8 }),
              pillButton('Read more', {
                bg: SURFACE,
                color: DARK,
                size: 'small',
                fullMobile: false,
                pt: 0,
              }),
            ],
            corneredCardStyle({ topLeft: 24, topRight: 24 }),
          ),
        ],
        [
          container(
            [
              para(stars(), { color: DARK, pb: 8 }),
              para('“Saves our team hours weekly.”', { color: DARK, pb: 8 }),
              avatar('Lee'),
              para('<strong>Lee</strong>', { color: DARK, pt: 8, pb: 2 }),
              para('Ops', { pb: 8 }),
              pillButton('Read more', {
                bg: SURFACE,
                color: DARK,
                size: 'small',
                fullMobile: false,
                pt: 0,
              }),
            ],
            corneredCardStyle({ topLeft: 24, topRight: 24 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'testimonial',
    name: 'Mobile-stack 3 quotes',
    node: sectionM([
      col3Stack(
        [testimonialCard('Best decision we made all year.', 'Sam', 'Founder')],
        [testimonialCard('Support is genuinely incredible.', 'Jo', 'Product')],
        [testimonialCard('Saves our team hours weekly.', 'Lee', 'Ops')],
      ),
    ]),
  },

  // stats — advanced
  {
    role: 'stats',
    name: 'BG image KPI band',
    node: sectionBg(
      [
        col3Stack(
          [headM(1, '10k+', { color: WHITE, pb: 2 }), para('Active users', { color: SOFT })],
          [headM(1, '99.9%', { color: WHITE, pb: 2 }), para('Uptime', { color: SOFT })],
          [headM(1, '4.9/5', { color: WHITE, pb: 2 }), para('Avg rating', { color: SOFT })],
        ),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'stats',
    name: 'Cornered cards 4-up',
    node: sectionM([
      headM(2, 'By the numbers', { pb: 16 }),
      col2Stack(
        [
          container(
            [headM(1, '2M', { pb: 2 }), para('Emails sent', { pb: 0 })],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
        [
          container(
            [headM(1, '150+', { pb: 2 }), para('Countries', { pb: 0 })],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
      ),
      spacer(16),
      col2Stack(
        [
          container(
            [headM(1, '98%', { pb: 2 }), para('Deliverability', { pb: 0 })],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
        [
          container(
            [headM(1, '24/7', { pb: 2 }), para('Support', { pb: 0 })],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'stats',
    name: 'Mobile-stack with icons',
    node: sectionM([
      col3Stack(
        iconStat('👥', '10k+', 'Users'),
        iconStat('⚡', '99.9%', 'Uptime'),
        iconStat('⭐', '4.9', 'Rating'),
      ),
    ]),
  },

  // steps — advanced
  {
    role: 'steps',
    name: 'BG image hero + numbered cards',
    node: sectionM([
      sectionBg([eyebrow('HOW IT WORKS'), headM(2, 'Get started in 3 steps', { color: WHITE })], {
        tint: DARK,
      }),
      spacer(16),
      col3Stack(
        [
          container(
            [
              para(badge('1'), { pb: 8 }),
              headM(3, 'Sign up', { pb: 4 }),
              para('Create your free account in seconds.', { pb: 0 }),
            ],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
        [
          container(
            [
              para(badge('2'), { pb: 8 }),
              headM(3, 'Build', { pb: 4 }),
              para('Drag and drop your first email.', { pb: 0 }),
            ],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
        [
          container(
            [
              para(badge('3'), { pb: 8 }),
              headM(3, 'Send', { pb: 4 }),
              para('Ship to your audience instantly.', { pb: 0 }),
            ],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'steps',
    name: 'Pill numbered cards',
    node: sectionM([
      headM(2, 'Three steps to launch', { pb: 16 }),
      col3Stack(
        [
          container([para('<strong>STEP 1</strong>', { color: DARK, pb: 0 })], pillCardStyle()),
          spacer(8),
          container(
            [headM(3, 'Connect', { pb: 4 }), para('Link your data source.', { pb: 0 })],
            topAccentCardStyle(),
          ),
        ],
        [
          container([para('<strong>STEP 2</strong>', { color: DARK, pb: 0 })], pillCardStyle()),
          spacer(8),
          container(
            [headM(3, 'Build', { pb: 4 }), para('Design your first flow.', { pb: 0 })],
            topAccentCardStyle(),
          ),
        ],
        [
          container([para('<strong>STEP 3</strong>', { color: DARK, pb: 0 })], pillCardStyle()),
          spacer(8),
          container(
            [headM(3, 'Launch', { pb: 4 }), para('Go live with confidence.', { pb: 0 })],
            topAccentCardStyle(),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'steps',
    name: 'Mobile vertical timeline',
    node: sectionM([
      col2Stack(
        [para(badge('1'))],
        [
          headM(3, 'Connect', { align: 'left', pb: 2 }),
          para('Link your data source.', { align: 'left', px: 0 }),
        ],
        [15, 85, null],
        { contentAlignment: 'middle' },
      ),
      divider(),
      col2Stack(
        [para(badge('2'))],
        [
          headM(3, 'Build', { align: 'left', pb: 2 }),
          para('Design your first flow.', { align: 'left', px: 0 }),
        ],
        [15, 85, null],
        { contentAlignment: 'middle' },
      ),
      divider(),
      col2Stack(
        [para(badge('3'))],
        [
          headM(3, 'Launch', { align: 'left', pb: 2 }),
          para('Go live with confidence.', { align: 'left', px: 0 }),
        ],
        [15, 85, null],
        { contentAlignment: 'middle' },
      ),
    ]),
  },

  // faq — advanced
  {
    role: 'faq',
    name: 'BG image hero + list',
    node: sectionM([
      sectionBg(
        [
          headM(2, 'Frequently asked questions', { color: WHITE }),
          para('Everything you need to know.', { color: SOFT, pb: 0 }),
        ],
        { tint: DARK },
      ),
      spacer(16),
      ...qa('Can I cancel anytime?', 'Yes, cancel with one click — no questions asked.'),
      divider(),
      ...qa('Is there a free trial?', 'Every plan includes a 14-day free trial.'),
      divider(),
      ...qa('Do you offer support?', 'Priority support is on all paid plans.'),
    ]),
  },
  {
    role: 'faq',
    name: 'Pill question rows',
    node: sectionM([
      headM(2, 'Common questions', { pb: 12 }),
      container(
        [para('<strong>Can I cancel anytime?</strong>', { color: DARK, pb: 0 })],
        pillCardStyle(),
      ),
      para('Yes, cancel with one click — no questions asked.', { align: 'left', pt: 8, pb: 12 }),
      container(
        [para('<strong>Is there a free trial?</strong>', { color: DARK, pb: 0 })],
        pillCardStyle(),
      ),
      para('Every plan includes a 14-day free trial.', { align: 'left', pt: 8, pb: 12 }),
      container(
        [para('<strong>Do you offer support?</strong>', { color: DARK, pb: 0 })],
        pillCardStyle(),
      ),
      para('Priority support is on all paid plans.', { align: 'left', pt: 8, pb: 0 }),
    ]),
  },
  {
    role: 'faq',
    name: 'Mobile reflow 2 columns',
    node: sectionM([
      headM(2, 'Questions & answers', { pb: 12 }),
      col2Stack(
        [
          ...qa('What is included?', 'All core features and updates.'),
          spacer(10),
          ...qa('Can I upgrade?', 'Anytime, instantly.'),
        ],
        [
          ...qa('How is billing handled?', 'Monthly or yearly — your choice.'),
          spacer(10),
          ...qa('Is my data safe?', 'Encrypted at rest and in transit.'),
        ],
      ),
    ]),
  },

  // team — advanced
  {
    role: 'team',
    name: 'BG image team band',
    node: sectionM([
      sectionBg(
        [
          eyebrow('OUR TEAM'),
          headM(2, 'Meet the people behind it', { color: WHITE }),
          para('A small team with big ambitions.', { color: SOFT, pb: 0 }),
        ],
        { tint: DARK },
      ),
      spacer(16),
      col3Stack(
        [memberCard('Maya Chen', 'CEO')],
        [memberCard('Tom Reed', 'CTO')],
        [memberCard('Ana Lopez', 'Design')],
      ),
    ]),
  },
  {
    role: 'team',
    name: 'Cornered member cards',
    node: sectionM([
      col3Stack(
        [
          container(
            [
              avatar('Maya'),
              para('<strong>Maya Chen</strong>', { color: DARK, pt: 8, pb: 2 }),
              para('CEO', { pb: 8 }),
              pillButton('Twitter', {
                bg: SURFACE,
                color: DARK,
                size: 'x-small',
                fullMobile: false,
                pt: 0,
              }),
            ],
            corneredCardStyle({ topLeft: 24, topRight: 24 }),
          ),
        ],
        [
          container(
            [
              avatar('Tom'),
              para('<strong>Tom Reed</strong>', { color: DARK, pt: 8, pb: 2 }),
              para('CTO', { pb: 8 }),
              pillButton('Twitter', {
                bg: SURFACE,
                color: DARK,
                size: 'x-small',
                fullMobile: false,
                pt: 0,
              }),
            ],
            corneredCardStyle({ topLeft: 24, topRight: 24 }),
          ),
        ],
        [
          container(
            [
              avatar('Ana'),
              para('<strong>Ana Lopez</strong>', { color: DARK, pt: 8, pb: 2 }),
              para('Design', { pb: 8 }),
              pillButton('Twitter', {
                bg: SURFACE,
                color: DARK,
                size: 'x-small',
                fullMobile: false,
                pt: 0,
              }),
            ],
            corneredCardStyle({ topLeft: 24, topRight: 24 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'team',
    name: 'Mobile-stacked grid',
    node: sectionM([
      col3Stack(
        [memberCard('Maya Chen', 'CEO', 'Building tools that make teams faster.')],
        [memberCard('Tom Reed', 'CTO', 'Loves clean code and good coffee.')],
        [memberCard('Ana Lopez', 'Head of Design', 'Obsessed with great UX.')],
      ),
    ]),
  },

  // gallery — advanced
  {
    role: 'gallery',
    name: 'BG image lookbook hero',
    node: sectionM([
      sectionBg(
        [
          headM(2, 'Spring 2026 lookbook', { color: WHITE }),
          para('Discover the latest collection.', { color: SOFT, pb: 12 }),
          pillButton('Shop the look', { bg: WHITE, color: DARK }),
        ],
        { tint: DARK },
      ),
      spacer(16),
      col3Stack([image('Look 1')], [image('Look 2')], [image('Look 3')]),
    ]),
  },
  {
    role: 'gallery',
    name: 'Cornered product cards',
    node: sectionM([
      col3Stack(
        [
          container(
            [
              image('Classic Tee'),
              headM(3, 'Classic Tee', { pt: 8, pb: 2 }),
              para('$29', { color: DARK, pb: 8 }),
              pillButton('View', { full: true, fullMobile: true, size: 'small' }),
            ],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
        [
          container(
            [
              image('Canvas Bag'),
              headM(3, 'Canvas Bag', { pt: 8, pb: 2 }),
              para('$39', { color: DARK, pb: 8 }),
              pillButton('View', { full: true, fullMobile: true, size: 'small' }),
            ],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
        [
          container(
            [
              image('Ceramic Mug'),
              headM(3, 'Ceramic Mug', { pt: 8, pb: 2 }),
              para('$15', { color: DARK, pb: 8 }),
              pillButton('View', { full: true, fullMobile: true, size: 'small' }),
            ],
            corneredCardStyle({ topLeft: 16, bottomRight: 16 }),
          ),
        ],
      ),
    ]),
  },
  {
    role: 'gallery',
    name: 'Mobile-stack 2 featured',
    node: sectionM([
      col2Stack(
        [
          image('Featured 1'),
          para('Spring collection', { color: DARK, pt: 8, pb: 2 }),
          para(link('Shop now →'), { color: DARK }),
        ],
        [
          image('Featured 2'),
          para('Summer essentials', { color: DARK, pt: 8, pb: 2 }),
          para(link('Shop now →'), { color: DARK }),
        ],
      ),
    ]),
  },

  // banner — advanced
  {
    role: 'banner',
    name: 'BG image promo',
    node: sectionBg(
      [
        para(badge('LIMITED', WHITE, DARK), { color: WHITE, pb: 8 }),
        headM(2, 'Summer sale — 30% off', { color: WHITE }),
        para('Ends Sunday. Don’t miss out.', { color: SOFT, pb: 12 }),
        pillButton('Shop now', { bg: WHITE, color: DARK, fullMobile: true }),
      ],
      { tint: DARK },
    ),
  },
  {
    role: 'banner',
    name: 'Cornered sale card',
    node: sectionM([
      container(
        [
          para(badge('LIMITED', WHITE, DARK), { color: WHITE, pb: 8 }),
          headM(2, 'Limited time offer', { color: WHITE }),
          para('Save big this week only.', { color: SOFT, pb: 12 }),
          corneredButton(
            'Claim offer',
            { topLeft: 16, bottomRight: 16 },
            { bg: WHITE, color: DARK, full: true, fullMobile: true },
          ),
        ],
        {
          ...corneredCardStyle({ topLeft: 24, bottomRight: 24 }, true),
          backgroundColor: DARK,
          borderColor: DARK,
        },
      ),
    ]),
  },
  {
    role: 'banner',
    // Antes existían dos gemelos aquí ("Announcement bar" y
    // "Announcement mobile-tight"): el mismo bloque salvo
    // `mobilePadding`/`fontSize`. Se consolidaron en esta única entrada
    // —la que sí trae esas props— con el nombre claro. Ver §22 de
    // COMPONENT_ICONS_PLAN.md.
    name: 'Announcement bar',
    node: container(
      [
        para(`🎉 New: dark mode is here! ${link('Learn more →', WHITE)}`, {
          color: WHITE,
          fz: 14,
          pb: 0,
        }),
      ],
      { backgroundColor: DARK, padding: pad(12, 16, 12, 16), mobilePadding: pad(10, 14, 10, 14) },
    ),
  },
];

type SeedSummary = { total: number; saved: number; skipped: number; failed: number };

export async function seedSections(
  options: { role?: string; limit?: number; force?: boolean } = {},
): Promise<SeedSummary> {
  const base = resolveBackendUrl();
  let list = options.role ? SECTIONS.filter((s) => s.role === options.role) : SECTIONS;
  if (options.limit) list = list.slice(0, options.limit);

  // Index existing sections by (role, name). In force mode we delete the
  // matching file first (so the prebuilt defaults overwrite older copies);
  // otherwise a matching name is skipped (idempotent seeding).
  const existing = new Map<string, { role: string; id: string }>();
  try {
    const r = await fetch(`${base}/dev/sections`);
    if (r.ok) {
      const { sections } = (await r.json()) as {
        sections: Array<{ role: string; name: string; id: string }>;
      };
      for (const s of sections)
        existing.set(`${s.role}/${s.name.trim()}`, { role: s.role, id: s.id });
    }
  } catch {
    /* best-effort dedup */
  }

  const summary: SeedSummary = { total: list.length, saved: 0, skipped: 0, failed: 0 };
  console.info(`[seedSections] seeding ${list.length} sections${options.force ? ' (force)' : ''}…`);

  for (const def of list) {
    const prev = existing.get(`${def.role}/${def.name}`);
    if (prev && !options.force) {
      summary.skipped++;
      continue;
    }
    try {
      if (prev && options.force) {
        await fetch(
          `${base}/dev/sections/${encodeURIComponent(prev.role)}/${encodeURIComponent(prev.id)}`,
          {
            method: 'DELETE',
          },
        );
      }
      const blocks = flatten(def.node);
      const res = await fetch(`${base}/dev/save-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: def.name, role: def.role, tags: [def.role], blocks }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(`HTTP ${res.status} ${JSON.stringify(b)}`);
      }
      summary.saved++;
    } catch (err) {
      summary.failed++;
      console.warn(
        `[seedSections] "${def.role}/${def.name}" failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.info('[seedSections] done', summary);
  return summary;
}
