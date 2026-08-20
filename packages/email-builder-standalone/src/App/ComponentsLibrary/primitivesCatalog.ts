/**
 * primitivesCatalog — the showcase catalog of prebuilt Primitives
 * (single, non-container blocks) across three primitive axes: `button`,
 * `notion-text`, `social-media`. Pure data + builders, no network —
 * shared by:
 *
 *   - `devSeedPrimitives.ts`: POSTs each entry to `/dev/save-primitive`
 *     (dev-console seeding, unrelated to this module's consumers).
 *   - `BlocksCategoryContent.tsx`: renders one exclusive accordion per
 *     type below the plain block tiles, so users can drag/click a
 *     ready-made variant straight onto the canvas without touching the
 *     backend at all.
 *
 * Deliberately scoped to exactly 6 variants per type, each with an
 * unmistakable, distinct real-world reason to exist — not filler to
 * hit a round number. `divider` and `spacer` have no entries here (too
 * little to meaningfully vary — the plain Blocks-tab tile + inspector
 * fields already cover them); Columns/Container aren't primitives at
 * all (structural blocks).
 *
 * `image` was tried and removed (2026-07-07): every variant needs a
 * placeholder image to render, and neither the single shared
 * `DEFAULT_IMAGE_PLACEHOLDER` photo nor role-specific `placehold.co`
 * placeholders (distinct dimensions + printed label per role) read as
 * visually distinct/usable at the small accordion-tile size — user
 * feedback was that none of the attempts looked "espectacular o
 * visualmente usable". Left out entirely rather than shipping a weak
 * accordion; revisit with real photography if this comes back.
 *
 * No gradients anywhere in this catalog: `background: linear-gradient(...)`
 * has no VML fallback in `packages/email-builder/src/blocks/helpers/Wrapper.tsx`,
 * so Outlook desktop and other legacy clients render NO background at
 * all (not even a solid fallback) when they hit an unsupported value —
 * a gradient preset looks great in the editor and breaks in the inbox.
 */

import {
  getIconUrl,
  options as SOCIAL_OPTIONS,
  type SizeType,
  type ThemeType,
} from '@eb/block-social-media/utils/icons';

// --- Axis ------------------------------------------------------------------

export type PrimitiveType = 'button' | 'notion-text' | 'social-media';

// Showcase palette — indigo/violet accent over slate neutrals. Brand
// colors are intentional here (apply-theme strips the governed keys, so
// these still rebrand cleanly when a theme is applied).
const WHITE = '#FFFFFF';
const INK = '#0F172A'; // near-black text / neutral solid surface
const MUTED = '#64748B'; // muted body text
const ACCENT = '#6366F1'; // indigo
const ACCENT_DK = '#4F46E5';
const SUCCESS = '#10B981';

const round = (r: number) => ({ topLeft: r, topRight: r, bottomLeft: r, bottomRight: r });

// --- Button builder --------------------------------------------------------

type ButtonShape =
  | 'rectangle'
  | 'pill'
  | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number };

const button = (
  text: string,
  opts: {
    shape?: ButtonShape;
    size?: 'x-small' | 'small' | 'medium';
    full?: boolean;
    bg?: string;
    color?: string;
    border?: { color: string; width: number };
  } = {},
): unknown => {
  const {
    shape = 'rectangle',
    size = 'medium',
    full = false,
    bg = ACCENT,
    color = WHITE,
    border,
  } = opts;
  const style: Record<string, unknown> = {
    buttonBackgroundColor: bg,
    buttonTextColor: color,
    shape,
    textAlign: 'center',
  };
  if (border) {
    style.borderColor = border.color;
    style.borderTop = border.width;
    style.borderBottom = border.width;
    style.borderLeft = border.width;
    style.borderRight = border.width;
  }
  return {
    type: 'Button',
    data: { style, props: { text, url: '#', size, fullWidth: full, fullWidthMobile: full } },
  };
};

// --- NotionText builder + rich fragments -----------------------------------

const notion = (html: string, style: object = {}): unknown => ({
  type: 'NotionText',
  data: { style, props: { html } },
});

type Align = 'left' | 'center' | 'right';
const p = (s: string, align: Align = 'left'): string => `<p style="text-align:${align};">${s}</p>`;
const h = (lvl: 1 | 2 | 3, s: string, align: Align = 'left'): string =>
  `<h${lvl} style="text-align:${align};">${s}</h${lvl}>`;
// Flat color label (bubble-menu compliant — nested spans for bg + text color).
const badge = (s: string, bg: string, color: string): string =>
  `<span style="background-color:${bg};"><span style="color:${color};">&nbsp;${s}&nbsp;</span></span>`;
const span = (s: string, color: string): string => `<span style="color:${color};">${s}</span>`;
const link = (s: string, color = ACCENT): string =>
  `<a href="#"><span style="color:${color};">${s}</span></a>`;
const checks = (items: string[], align: Align = 'left'): string =>
  items.map((i) => p(`${span('✓', SUCCESS)} ${i}`, align)).join('');

// --- SocialMedia builder ---------------------------------------------------

const social = (
  keys: string[],
  opts: { theme?: ThemeType; size?: SizeType; align?: Align } = {},
): unknown => {
  const { theme = 'original', size = 'medium', align = 'center' } = opts;
  const sizePx = size === 'small' ? '24px' : size === 'large' ? '48px' : '36px';
  const items = keys.map((key, i) => {
    const base = SOCIAL_OPTIONS.find((o) => o.key === key);
    const iconName = base?.iconName ?? key;
    return {
      id: `seed-social-${i + 1}`,
      key,
      label: base?.label ?? key,
      iconName,
      theme,
      size,
      sizePx,
      url: getIconUrl(iconName, theme, size),
      href: base?.href ?? '',
    };
  });
  return { type: 'SocialMedia', data: { style: { textAlign: align }, items, gap: 12 } };
};

// --- Catalog ---------------------------------------------------------------

export type PrimitiveDef = {
  type: PrimitiveType;
  name: string;
  description?: string;
  block: unknown;
};

export const PRIMITIVES: PrimitiveDef[] = [
  // ===== Buttons — 6 distinct real CTA patterns, no gradients =====
  {
    type: 'button',
    name: 'Primary',
    description: 'Solid accent — the default main action.',
    block: button('Get started', { shape: round(10) }),
  },
  {
    type: 'button',
    name: 'Secondary',
    description: 'Solid neutral — pairs with Primary for two-CTA rows.',
    block: button('Learn more', { shape: round(10), bg: INK }),
  },
  {
    type: 'button',
    name: 'Outline',
    description: 'Ghost button with accent border — lower-emphasis alternative.',
    block: button('View details', {
      shape: round(10),
      bg: WHITE,
      color: ACCENT_DK,
      border: { color: ACCENT, width: 2 },
    }),
  },
  {
    type: 'button',
    name: 'Pill, full width',
    description: 'Full-width capsule CTA — stacks cleanly on mobile.',
    block: button('Start your free trial', { shape: 'pill', full: true }),
  },
  {
    type: 'button',
    name: 'Text link style',
    description: 'Button-sized tap target that reads as a plain text link.',
    block: button('No thanks, maybe later', {
      shape: round(6),
      size: 'small',
      bg: WHITE,
      color: ACCENT_DK,
    }),
  },
  {
    type: 'button',
    name: 'Compact inline',
    description: 'Small action for dense layouts — list rows, inline stats.',
    block: button('Details', { size: 'small', shape: round(8) }),
  },

  // ===== NotionText — 6 distinct structural/content patterns =====
  {
    type: 'notion-text',
    name: 'Section heading',
    description: 'Plain heading + subtext — starts a section, no decoration.',
    block: notion(
      `${h(2, 'Everything you need to get started')}${p(span('One line of supporting context goes here.', MUTED))}`,
      {
        color: INK,
      },
    ),
  },
  {
    type: 'notion-text',
    name: 'Announcement',
    description: 'Badge + heading + body + link — a "what\'s new" opener.',
    block: notion(
      `${p(badge('NEW', '#EEF2FF', '#3730A3'))}${h(2, 'Introducing instant publishing')}${p(`Ship campaigns in seconds. ${span('No code, no waiting on engineering.', MUTED)}`)}${p(link('See what’s new →'))}`,
      { color: INK },
    ),
  },
  {
    type: 'notion-text',
    name: 'Feature checklist',
    description: 'Heading + green checkmark list — the classic benefits block.',
    block: notion(
      `${h(3, 'Everything included')}${checks(['Unlimited templates', 'Custom themes &amp; fonts', 'HTML &amp; JSON export', 'Team sharing'])}`,
      { color: INK },
    ),
  },
  {
    type: 'notion-text',
    name: 'Testimonial quote',
    description: 'Large italic quote + attribution — a distinct visual register.',
    block: notion(
      `${h(2, `<em>“The most intuitive email tool we’ve ever used.”</em>`, 'center')}${p(`<strong>Jordan Pike</strong> — Director of Design, Acme`, 'center')}`,
      { color: INK },
    ),
  },
  {
    type: 'notion-text',
    name: 'Pricing callout',
    description: 'Big price figure + short perk list — number-forward and action-adjacent.',
    block: notion(
      `${h(1, `$29 ${span('<strong>/ month</strong>', MUTED)}`, 'center')}${checks(['5 team members', 'Unlimited sends', 'Priority support'], 'center')}`,
      { color: INK },
    ),
  },
  {
    type: 'notion-text',
    name: 'FAQ Q&A',
    description: 'Bold question + muted answer, repeated — support/FAQ pattern.',
    block: notion(
      `${p(`<strong>How do I cancel my subscription?</strong>`)}${p(span('Go to Settings → Billing → Cancel plan. Your access continues until the end of the billing period.', MUTED))}${p(`<strong>Can I change plans later?</strong>`)}${p(span('Yes, upgrade or downgrade anytime from the Billing page — changes apply on your next invoice.', MUTED))}`,
      { color: INK },
    ),
  },

  // ===== SocialMedia — 6 distinct theme/size/alignment/purpose combinations =====
  {
    type: 'social-media',
    name: 'Icon row — light',
    description: 'Neutral-background footer row — the default.',
    block: social(['facebook', 'x', 'instagram', 'linkedin'], { theme: 'positive' }),
  },
  {
    type: 'social-media',
    name: 'Icon row — dark',
    description: 'For dark-background sections and footers.',
    block: social(['facebook', 'x', 'instagram', 'linkedin'], { theme: 'negative' }),
  },
  {
    type: 'social-media',
    name: 'Icon row — color',
    description: 'Full brand colors — playful, consumer-brand footer.',
    block: social(['facebook', 'x', 'instagram', 'linkedin'], { theme: 'original' }),
  },
  {
    type: 'social-media',
    name: 'Large icon row',
    description: 'Social as a primary visual element — header or hero placement.',
    block: social(['facebook', 'x', 'instagram', 'youtube', 'tiktok'], {
      theme: 'positive',
      size: 'large',
    }),
  },
  {
    type: 'social-media',
    name: 'Contact row',
    description: 'Web · Mail · WhatsApp — a "get in touch" utility row, not a follow row.',
    block: social(['web', 'mail', 'whatsapp'], { size: 'small' }),
  },
  {
    type: 'social-media',
    name: 'Left-aligned compact row',
    description: 'Pairs with left-aligned legal/address text in a footer.',
    block: social(['x', 'instagram', 'linkedin'], { size: 'small', align: 'left' }),
  },
];
