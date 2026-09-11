/**
 * sectionIcons — hand-designed 2D outline icons for Components Library
 * items (Sections / Layouts / Templates / Primitives), replacing the
 * captured PNG thumbnail. See `COMPONENT_ICONS_PLAN.md` (repo root of
 * `feat/ui-polish-p1`) for the full design plan, inventory, and
 * per-tanda workflow.
 *
 * Tanda 1 (10/146): `sections`, roles `banner` + `comparison`.
 * Tanda 2 (10/146): `sections`, roles `cta` + `faq`.
 * Tanda 3 (10/146): `sections`, roles `features` + `footer`.
 * Tanda 4 (10/146): `sections`, roles `gallery` + `header`.
 * Keyed by the item's stable `id` from `localPresets.data.json` — NOT
 * by role, since the design is per-component, not per-category/role.
 *
 * Status: **draft, pending visual approval**. Rendered here so the
 * user can review each icon in the real Components Library UI before
 * approving the tanda and moving on to the next one. Do not treat this
 * map as final/complete — only the 40 ids below are designed so far.
 */

import React from 'react';

/** viewBox 0 0 24 24, outline-only, inherits `currentColor` (theme text). */
export type SectionIconEntry = {
  name: string;
  role:
    | 'banner'
    | 'comparison'
    | 'cta'
    | 'faq'
    | 'features'
    | 'footer'
    | 'gallery'
    | 'header';
  svg: React.ReactNode;
};

const strokeProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  // Corregido: `ComponentTypeIcon.tsx` (Builder42) NO pasa `strokeWidth`
  // explícito a sus iconos Lucide (`.pbx-palette__icon`) — usan el
  // default real de Lucide, que es `strokeWidth={2}`, no 1.25/1.5 como
  // se había asumido antes sin confirmar contra el código fuente.
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SECTION_ICONS: Record<string, SectionIconEntry> = {
  // #1 — Announcement mobile-tight (banner)
  '0398040b-0b75-46f2-80cf-f3317d7cad8b': {
    name: 'Announcement mobile-tight',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        <rect x={1.5} y={9.5} width={21} height={5} rx={0.8} />
        <line x1={4} y1={12} x2={20} y2={12} />
      </svg>
    ),
  },
  // #2 — Announcement bar (banner)
  '82a88271-0ed0-46f9-93d6-26ca2e0448de': {
    name: 'Announcement bar',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        <rect x={3.5} y={8.5} width={17} height={7} rx={1.2} />
        <line x1={6} y1={12} x2={18} y2={12} />
      </svg>
    ),
  },
  // #3 — Cornered sale card (banner)
  '4ce2d759-a608-4d6c-b3cc-d42fb2f3428f': {
    name: 'Cornered sale card',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        <rect x={3} y={3} width={18} height={18} rx={1.5} />
        <path d="M3 3h5v2.5a1 1 0 0 1-1 1H3z" strokeWidth={1.2} />
        <line x1={5.5} y1={11.5} x2={16} y2={11.5} />
        <line x1={5.5} y1={14} x2={14} y2={14} />
        <rect x={5.5} y={16.8} width={7} height={2.8} rx={1} />
      </svg>
    ),
  },
  // #4 — Promo CTA (banner)
  '769366f5-1d1a-413d-9603-887ca1750651': {
    name: 'Promo CTA',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        <rect x={3} y={3} width={18} height={18} rx={1.5} />
        <rect x={8.5} y={5.5} width={7} height={2.5} rx={1.2} />
        <line x1={5.5} y1={11.5} x2={18.5} y2={11.5} />
        <line x1={5.5} y1={14} x2={15.5} y2={14} />
        <rect x={8.5} y={16.8} width={7} height={2.8} rx={1} />
      </svg>
    ),
  },
  // #5 — Sale banner (banner)
  '639a5360-f271-4409-acc6-13cd8de70872': {
    name: 'Sale banner',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={8} width={20} height={8} rx={1} />
        <line x1={4.5} y1={11} x2={11} y2={11} />
        <line x1={4.5} y1={13.5} x2={9} y2={13.5} />
        <rect x={14.5} y={10.5} width={5.5} height={3} rx={0.8} />
      </svg>
    ),
  },
  // #6 — Option A vs B (comparison)
  '266e4e0f-d92e-4351-992e-6d7fff8f6823': {
    name: 'Option A vs B',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={3.5} width={8.5} height={17} rx={1} />
        <rect x={13} y={3.5} width={8.5} height={17} rx={1} />
        <line x1={4.5} y1={7} x2={9} y2={7} />
        <line x1={15} y1={7} x2={19.5} y2={7} />
        <rect x={4.5} y={16} width={4.5} height={2.5} rx={0.6} />
        <rect x={15} y={16} width={4.5} height={2.5} rx={0.6} />
      </svg>
    ),
  },
  // #7 — Mobile-reflow A vs B (comparison)
  '6add8418-aa6c-4ddc-9e42-f98da7314299': {
    name: 'Mobile-reflow A vs B',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={3.5} width={8.5} height={17} rx={1} />
        <rect x={13} y={3.5} width={8.5} height={17} rx={1} />
        <line x1={4.5} y1={7} x2={9} y2={7} />
        <line x1={15} y1={7} x2={19.5} y2={7} />
        <rect x={4.5} y={16} width={4.5} height={2.5} rx={0.6} />
        <rect x={15} y={16} width={4.5} height={2.5} rx={0.6} />
        <path d="M11 2v20" strokeWidth={1} strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },
  // #8 — Before / After (comparison)
  '4512a455-9b75-43d5-9db6-2d96e85b804d': {
    name: 'Before / After',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={3.5} width={8.5} height={17} rx={1} />
        <rect x={13} y={3.5} width={8.5} height={17} rx={1} />
        <rect x={4} y={5} width={5.5} height={6} rx={0.6} />
        <path d="M4.8 9.2l1.5-2 1.2 1.5 1.4-1.8" strokeWidth={1.2} />
        <rect x={14.5} y={5} width={5.5} height={6} rx={0.6} />
        <path d="M15.3 9.2l1.5-2 1.2 1.5 1.4-1.8" strokeWidth={1.2} />
        <line x1={4.5} y1={14.5} x2={9} y2={14.5} />
        <line x1={15} y1={14.5} x2={19.5} y2={14.5} />
      </svg>
    ),
  },
  // #9 — Feature matrix (comparison)
  '782eba2d-959e-4f1e-9a16-3375531ef934': {
    name: 'Feature matrix',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <line x1={3} y1={4.5} x2={12} y2={4.5} />
        <rect x={2.5} y={7.5} width={19} height={13} rx={1} />
        <line x1={9.5} y1={7.5} x2={9.5} y2={20.5} />
        <line x1={15.5} y1={7.5} x2={15.5} y2={20.5} />
        <line x1={2.5} y1={11.5} x2={21.5} y2={11.5} />
        <line x1={2.5} y1={14.5} x2={21.5} y2={14.5} />
        <line x1={2.5} y1={17.5} x2={21.5} y2={17.5} />
      </svg>
    ),
  },
  // #10 — Top-accent matrix (comparison)
  '8a9ec9f9-46d1-4d3d-a7b8-c9cb8c3b1b04': {
    name: 'Top-accent matrix',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={7.5} width={19} height={13} rx={1} />
        {/* Acento 2x la base (antes 3 sobre base 1.5, ahora 4 sobre base 2 —
            misma proporción relativa tras corregir strokeWidth a 2). */}
        <line x1={2.5} y1={8.3} x2={21.5} y2={8.3} strokeWidth={4} />
        <line x1={9.5} y1={10.5} x2={9.5} y2={20.5} />
        <line x1={15.5} y1={10.5} x2={15.5} y2={20.5} />
        <line x1={2.5} y1={13.5} x2={21.5} y2={13.5} />
        <line x1={2.5} y1={16.5} x2={21.5} y2={16.5} />
        <line x1={2.5} y1={19} x2={21.5} y2={19} />
      </svg>
    ),
  },

  // ---- Tanda 2 — sections, roles `cta` + `faq` (10/146) ----

  // #1 — Centered band (cta)
  '2bfc7466-90a7-43fc-bcd1-a65a9fbe3589': {
    name: 'Centered band',
    role: 'cta',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={20} height={18} rx={1.5} />
        <line x1={7} y1={9} x2={17} y2={9} />
        <line x1={8.5} y1={12} x2={15.5} y2={12} />
        <rect x={8.5} y={15} width={7} height={3} rx={1} />
      </svg>
    ),
  },
  // #2 — Two-column mobile stack (cta)
  '6c4e2918-c5c6-4598-94e5-807550ad2944': {
    name: 'Two-column mobile stack',
    role: 'cta',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={20} height={16} rx={1.5} />
        <line x1={4.5} y1={9} x2={12} y2={9} />
        <line x1={4.5} y1={12} x2={10.5} y2={12} />
        <rect x={14.5} y={9.5} width={6.5} height={6} rx={1} />
      </svg>
    ),
  },
  // #3 — Newsletter (cta)
  '6eae46e2-6b5f-4a3f-8f14-b48d5ddda2fd': {
    name: 'Newsletter',
    role: 'cta',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={20} height={18} rx={1.5} />
        <line x1={7} y1={8} x2={17} y2={8} />
        <line x1={8.5} y1={11} x2={15.5} y2={11} />
        <rect x={8.5} y={13.5} width={7} height={3} rx={1} />
        <line x1={7.5} y1={19} x2={16.5} y2={19} strokeWidth={1} />
      </svg>
    ),
  },
  // #4 — BG image promo card (cta)
  '71da79ee-59c5-4492-ab8d-09076a6afe94': {
    name: 'BG image promo card',
    role: 'cta',
    svg: (
      <svg {...strokeProps}>
        <rect x={1.5} y={1.5} width={21} height={21} rx={1} strokeWidth={1} />
        <rect x={3.5} y={3.5} width={17} height={17} rx={2.5} />
        <rect x={9} y={6.5} width={6} height={2} rx={1} />
        <line x1={7} y1={12} x2={17} y2={12} />
        <rect x={9} y={15.5} width={6} height={2.8} rx={1} />
      </svg>
    ),
  },
  // #5 — Card (cta)
  '78b538c5-54d0-4de2-a407-d5b8004f262d': {
    name: 'Card',
    role: 'cta',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={20} height={18} rx={1.5} strokeWidth={1} />
        <rect x={4.5} y={6} width={15} height={12} rx={1.8} />
        <line x1={7.5} y1={10} x2={16.5} y2={10} />
        <rect x={8.5} y={13} width={7} height={2.6} rx={1} />
        <line x1={8} y1={17} x2={16} y2={17} strokeWidth={1} />
      </svg>
    ),
  },
  // #6 — FAQ + contact CTA (faq)
  '2f03b3cf-34be-4d04-b08e-9a1b9a244146': {
    name: 'FAQ + contact CTA',
    role: 'faq',
    svg: (
      <svg {...strokeProps}>
        <line x1={8} y1={2.5} x2={16} y2={2.5} />
        <line x1={2.5} y1={6} x2={10} y2={6} />
        <line x1={2.5} y1={8.5} x2={8} y2={8.5} strokeWidth={1} />
        <line x1={2.5} y1={12} x2={10} y2={12} />
        <line x1={2.5} y1={14.5} x2={8} y2={14.5} strokeWidth={1} />
        <rect x={2.5} y={17.5} width={19} height={5} rx={1.2} />
      </svg>
    ),
  },
  // #7 — Pill question rows (faq)
  '6344fb2f-fc29-4ef5-b441-acf01fa649c8': {
    name: 'Pill question rows',
    role: 'faq',
    svg: (
      <svg {...strokeProps}>
        <line x1={8} y1={2.2} x2={16} y2={2.2} />
        <rect x={2.5} y={4.7} width={19} height={4.2} rx={2.1} />
        <rect x={2.5} y={10.7} width={19} height={4.2} rx={2.1} />
        <rect x={2.5} y={16.7} width={19} height={4.2} rx={2.1} />
      </svg>
    ),
  },
  // #8 — FAQ with categories (faq)
  'c404de6f-0227-4e69-8971-f37f74fe7b0f': {
    name: 'FAQ with categories',
    role: 'faq',
    svg: (
      <svg {...strokeProps}>
        <line x1={2.5} y1={3} x2={8.5} y2={3} strokeWidth={2.5} />
        <line x1={2.5} y1={6.5} x2={11} y2={6.5} />
        <line x1={2.5} y1={9} x2={9} y2={9} strokeWidth={1} />
        <line x1={2.5} y1={13} x2={8.5} y2={13} strokeWidth={2.5} />
        <line x1={2.5} y1={16.5} x2={11} y2={16.5} />
        <line x1={2.5} y1={19} x2={9} y2={19} strokeWidth={1} />
      </svg>
    ),
  },
  // #9 — FAQ list (faq)
  'cebd6caa-c867-4e45-b778-3cdb06636df2': {
    name: 'FAQ list',
    role: 'faq',
    svg: (
      <svg {...strokeProps}>
        <line x1={7} y1={2.5} x2={17} y2={2.5} />
        <line x1={2.5} y1={6.5} x2={11} y2={6.5} />
        <line x1={2.5} y1={9} x2={9} y2={9} strokeWidth={1} />
        <line x1={2.5} y1={11.5} x2={21.5} y2={11.5} strokeWidth={1} />
        <line x1={2.5} y1={14} x2={11} y2={14} />
        <line x1={2.5} y1={16.5} x2={9} y2={16.5} strokeWidth={1} />
        <line x1={2.5} y1={19} x2={21.5} y2={19} strokeWidth={1} />
      </svg>
    ),
  },
  // #10 — Mobile reflow 2 columns (faq)
  'cec0c438-d335-46e6-9ad9-1f65dfd45aae': {
    name: 'Mobile reflow 2 columns',
    role: 'faq',
    svg: (
      <svg {...strokeProps}>
        <line x1={8} y1={2.2} x2={16} y2={2.2} />
        <line x1={2.5} y1={6} x2={9.5} y2={6} />
        <line x1={2.5} y1={8.3} x2={7.5} y2={8.3} strokeWidth={1} />
        <line x1={2.5} y1={12} x2={9.5} y2={12} />
        <line x1={2.5} y1={14.3} x2={7.5} y2={14.3} strokeWidth={1} />
        <line x1={14.5} y1={6} x2={21.5} y2={6} />
        <line x1={14.5} y1={8.3} x2={19.5} y2={8.3} strokeWidth={1} />
        <line x1={14.5} y1={12} x2={21.5} y2={12} />
        <line x1={14.5} y1={14.3} x2={19.5} y2={14.3} strokeWidth={1} />
      </svg>
    ),
  },

  // ---- Tanda 3 — sections, roles `features` + `footer` (10/146) ----

  // #1 — 3 columns with icons (features)
  '445b8b55-10bc-4171-8800-b4d48c425b50': {
    name: '3 columns with icons',
    role: 'features',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.5} x2={15} y2={2.5} />
        <circle cx={4.5} cy={7} r={1.6} />
        <line x1={2.5} y1={11} x2={6.5} y2={11} />
        <line x1={2.5} y1={13.3} x2={6.5} y2={13.3} strokeWidth={1} />
        <circle cx={12} cy={7} r={1.6} />
        <line x1={9.5} y1={11} x2={14.5} y2={11} />
        <line x1={9.5} y1={13.3} x2={14.5} y2={13.3} strokeWidth={1} />
        <circle cx={19.5} cy={7} r={1.6} />
        <line x1={17.5} y1={11} x2={21.5} y2={11} />
        <line x1={17.5} y1={13.3} x2={21.5} y2={13.3} strokeWidth={1} />
      </svg>
    ),
  },
  // #2 — Image-backed showcase rows (features)
  '525f66f6-293d-434f-9f39-6b608a1ef320': {
    name: 'Image-backed showcase rows',
    role: 'features',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3.5} width={8.5} height={6} rx={1.2} />
        <line x1={12.5} y1={5.5} x2={21.5} y2={5.5} />
        <line x1={12.5} y1={7.8} x2={19} y2={7.8} strokeWidth={1} />
        <line x1={2} y1={14.5} x2={10.5} y2={14.5} />
        <line x1={2} y1={16.8} x2={8.5} y2={16.8} strokeWidth={1} />
        <rect x={13} y={12.5} width={8.5} height={6} rx={1.2} />
      </svg>
    ),
  },
  // #3 — Gradient cards (features)
  '70add1ca-9009-43d3-9386-bac9479f2bfb': {
    name: 'Gradient cards',
    role: 'features',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <rect x={2} y={5.5} width={6} height={15} rx={1.6} />
        <rect x={9} y={5.5} width={6} height={15} rx={1.6} />
        <rect x={16} y={5.5} width={6} height={15} rx={1.6} />
        <circle cx={5} cy={9.5} r={1.3} />
        <circle cx={12} cy={9.5} r={1.3} />
        <circle cx={19} cy={9.5} r={1.3} />
      </svg>
    ),
  },
  // #4 — 4-up grid (features)
  'ad7f3a04-80a7-4e24-8793-7250d55387fb': {
    name: '4-up grid',
    role: 'features',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.5} x2={15} y2={2.5} />
        <circle cx={6} cy={7} r={1.4} />
        <line x1={9.5} y1={6.3} x2={13.5} y2={6.3} />
        <line x1={9.5} y1={8.3} x2={13} y2={8.3} strokeWidth={1} />
        <circle cx={18} cy={7} r={1.4} />
        <circle cx={6} cy={15} r={1.4} />
        <line x1={9.5} y1={14.3} x2={13.5} y2={14.3} />
        <line x1={9.5} y1={16.3} x2={13} y2={16.3} strokeWidth={1} />
        <circle cx={18} cy={15} r={1.4} />
      </svg>
    ),
  },
  // #5 — Checklist (features)
  'cff4cce6-7006-429c-8fda-993c17fed9f8': {
    name: 'Checklist',
    role: 'features',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.5} x2={15} y2={2.5} />
        <path d="M2.5 6.5l1 1 1.8-2" strokeWidth={1.6} />
        <line x1={6.5} y1={6.5} x2={11} y2={6.5} strokeWidth={1} />
        <path d="M2.5 11.5l1 1 1.8-2" strokeWidth={1.6} />
        <line x1={6.5} y1={11.5} x2={11} y2={11.5} strokeWidth={1} />
        <path d="M13 6.5l1 1 1.8-2" strokeWidth={1.6} />
        <line x1={17} y1={6.5} x2={21.5} y2={6.5} strokeWidth={1} />
        <path d="M13 11.5l1 1 1.8-2" strokeWidth={1.6} />
        <line x1={17} y1={11.5} x2={21.5} y2={11.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #6 — Dark BG with pattern (footer)
  '1a254a1d-4d36-4a4f-9ab4-0197c3adb4bf': {
    name: 'Dark BG with pattern',
    role: 'footer',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={1.5} fill="currentColor" fillOpacity={0.08} />
        <line x1={9} y1={5.5} x2={15} y2={5.5} />
        <line x1={4.5} y1={10} x2={8} y2={10} strokeWidth={1} />
        <line x1={10} y1={10} x2={13.5} y2={10} strokeWidth={1} />
        <line x1={15.5} y1={10} x2={19} y2={10} strokeWidth={1} />
        <line x1={2.5} y1={15} x2={21.5} y2={15} strokeWidth={1} />
        <line x1={6} y1={18} x2={18} y2={18} strokeWidth={1} />
      </svg>
    ),
  },
  // #7 — Pill social row (footer)
  '1a97c98f-a4d4-4610-b416-1a73be62e899': {
    name: 'Pill social row',
    role: 'footer',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.5} x2={15} y2={2.5} />
        <rect x={2.5} y={5.5} width={5.5} height={3.4} rx={1.7} />
        <rect x={9.2} y={5.5} width={5.5} height={3.4} rx={1.7} />
        <rect x={16} y={5.5} width={5.5} height={3.4} rx={1.7} />
        <line x1={2.5} y1={12.5} x2={21.5} y2={12.5} strokeWidth={1} />
        <line x1={4.5} y1={16} x2={9} y2={16} strokeWidth={1} />
        <line x1={14} y1={16} x2={18.5} y2={16} strokeWidth={1} />
        <line x1={6} y1={19.5} x2={18} y2={19.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #8 — Full (footer)
  '5d9a93e2-d086-478e-946c-c1c34ad70904': {
    name: 'Full',
    role: 'footer',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={5.5} x2={15} y2={5.5} />
        <line x1={4.5} y1={10} x2={8} y2={10} strokeWidth={1} />
        <line x1={10} y1={10} x2={13.5} y2={10} strokeWidth={1} />
        <line x1={15.5} y1={10} x2={19} y2={10} strokeWidth={1} />
        <line x1={2.5} y1={15} x2={21.5} y2={15} strokeWidth={1} />
        <line x1={6} y1={18} x2={18} y2={18} strokeWidth={1} />
      </svg>
    ),
  },
  // #9 — Social + links (footer)
  '6fc20489-3492-49aa-9b58-322f70bc442e': {
    name: 'Social + links',
    role: 'footer',
    svg: (
      <svg {...strokeProps}>
        <line x1={5} y1={4.5} x2={9} y2={4.5} />
        <line x1={10.5} y1={4.5} x2={14} y2={4.5} />
        <line x1={15.5} y1={4.5} x2={19} y2={4.5} />
        <line x1={5.5} y1={10} x2={9.5} y2={10} strokeWidth={1} />
        <line x1={14.5} y1={10} x2={18.5} y2={10} strokeWidth={1} />
        <line x1={2.5} y1={15} x2={21.5} y2={15} strokeWidth={1} />
        <line x1={6} y1={18.5} x2={18} y2={18.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #10 — Minimal (footer)
  'a42a309f-9d55-49db-a891-1899d04095af': {
    name: 'Minimal',
    role: 'footer',
    svg: (
      <svg {...strokeProps}>
        <line x1={8} y1={10} x2={16} y2={10} />
        <line x1={6} y1={14} x2={18} y2={14} strokeWidth={1} />
      </svg>
    ),
  },

  // ---- Tanda 4 — sections, roles `gallery` + `header` (10/146) ----

  // #1 — 3 product cards (gallery)
  '127b953d-476a-4714-bd26-ee909bd10eac': {
    name: '3 product cards',
    role: 'gallery',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={1.4} />
        <rect x={9} y={4} width={6} height={16} rx={1.4} />
        <rect x={16} y={4} width={6} height={16} rx={1.4} />
        <rect x={3} y={5.5} width={4} height={4} rx={0.6} />
        <rect x={10} y={5.5} width={4} height={4} rx={0.6} />
        <rect x={17} y={5.5} width={4} height={4} rx={0.6} />
        <line x1={3} y1={14.5} x2={6.5} y2={14.5} strokeWidth={1} />
        <line x1={10} y1={14.5} x2={13.5} y2={14.5} strokeWidth={1} />
        <line x1={17} y1={14.5} x2={20.5} y2={14.5} strokeWidth={1} />
        <rect x={3} y={16.8} width={4} height={2} rx={0.6} />
        <rect x={10} y={16.8} width={4} height={2} rx={0.6} />
        <rect x={17} y={16.8} width={4} height={2} rx={0.6} />
      </svg>
    ),
  },
  // #2 — Hero + thumbnails (gallery)
  '4bc7b5e2-d31a-47e7-a23d-89903c1b180e': {
    name: 'Hero + thumbnails',
    role: 'gallery',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={2.5} width={19} height={11} rx={1.4} />
        <rect x={2.5} y={15.5} width={5.5} height={6} rx={1} />
        <rect x={9.2} y={15.5} width={5.5} height={6} rx={1} />
        <rect x={16} y={15.5} width={5.5} height={6} rx={1} />
      </svg>
    ),
  },
  // #3 — Cornered product cards (gallery)
  '5228ffb8-1cc6-4f35-afd4-8b670da9614b': {
    name: 'Cornered product cards',
    role: 'gallery',
    svg: (
      <svg {...strokeProps}>
        {/* Asymmetric corners (topLeft+bottomRight rounded, others square) —
            approximated with a single rounded rect per card since SVG rect
            doesn't support per-corner radius; the pill button (vs. #1's
            rectangle) is the clearer visual differentiator here. */}
        <rect x={2} y={4} width={6} height={16} rx={2.2} />
        <rect x={9} y={4} width={6} height={16} rx={2.2} />
        <rect x={16} y={4} width={6} height={16} rx={2.2} />
        <rect x={3} y={5.5} width={4} height={4} rx={0.6} />
        <rect x={10} y={5.5} width={4} height={4} rx={0.6} />
        <rect x={17} y={5.5} width={4} height={4} rx={0.6} />
        <line x1={3} y1={14.5} x2={6.5} y2={14.5} strokeWidth={1} />
        <line x1={10} y1={14.5} x2={13.5} y2={14.5} strokeWidth={1} />
        <line x1={17} y1={14.5} x2={20.5} y2={14.5} strokeWidth={1} />
        <rect x={3} y={16.6} width={4} height={2.4} rx={1.2} />
        <rect x={10} y={16.6} width={4} height={2.4} rx={1.2} />
        <rect x={17} y={16.6} width={4} height={2.4} rx={1.2} />
      </svg>
    ),
  },
  // #4 — BG image lookbook hero (gallery)
  '7dd4acee-36dd-4b01-bd7d-99f7da123919': {
    name: 'BG image lookbook hero',
    role: 'gallery',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={10.5} rx={1.4} fill="currentColor" fillOpacity={0.08} />
        <line x1={8} y1={6} x2={16} y2={6} />
        <rect x={9.5} y={9} width={5} height={2.2} rx={1} />
        <rect x={2} y={15} width={5.7} height={6.5} rx={1} />
        <rect x={9.15} y={15} width={5.7} height={6.5} rx={1} />
        <rect x={16.3} y={15} width={5.7} height={6.5} rx={1} />
      </svg>
    ),
  },
  // #5 — Mobile-stack 2 featured (gallery)
  'a17f162d-07ae-4830-8491-6eb2fb60ff07': {
    name: 'Mobile-stack 2 featured',
    role: 'gallery',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={9} height={9} rx={1.2} />
        <line x1={2.5} y1={14.5} x2={10.5} y2={14.5} strokeWidth={1} />
        <line x1={2.5} y1={17} x2={7.5} y2={17} strokeWidth={1} />
        <rect x={13} y={3} width={9} height={9} rx={1.2} />
        <line x1={13.5} y1={14.5} x2={21.5} y2={14.5} strokeWidth={1} />
        <line x1={13.5} y1={17} x2={18.5} y2={17} strokeWidth={1} />
      </svg>
    ),
  },
  // #6 — Mobile-tight logo (header)
  '20751f09-4ff1-4c57-b60d-78b314ba6797': {
    name: 'Mobile-tight logo',
    role: 'header',
    svg: (
      <svg {...strokeProps}>
        <rect x={8.5} y={6} width={7} height={6} rx={1} />
        <line x1={6} y1={16.5} x2={18} y2={16.5} strokeWidth={1} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #7 — Logo + CTA (header)
  '35742add-9d96-4f7e-8985-e8f8141ad927': {
    name: 'Logo + CTA',
    role: 'header',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={9} width={7.5} height={6} rx={1} />
        <rect x={14.5} y={10} width={7} height={4} rx={1} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #8 — Logo + nav (header)
  '8a46ec83-0f12-46c1-85b1-1134324c7a22': {
    name: 'Logo + nav',
    role: 'header',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={9.5} width={7} height={5} rx={1} />
        <line x1={13.5} y1={10.5} x2={16.5} y2={10.5} strokeWidth={1} />
        <line x1={17.5} y1={10.5} x2={19.5} y2={10.5} strokeWidth={1} />
        <line x1={20.5} y1={10.5} x2={21.5} y2={10.5} strokeWidth={1} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #9 — Preheader + logo (header)
  'bd457ce3-75f4-4161-9e3e-6937c9594ae5': {
    name: 'Preheader + logo',
    role: 'header',
    svg: (
      <svg {...strokeProps}>
        <line x1={6} y1={5.5} x2={18} y2={5.5} strokeWidth={1} />
        <rect x={8.5} y={9.5} width={7} height={6} rx={1} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} strokeWidth={1} />
      </svg>
    ),
  },
  // #10 — Pill nav buttons (header)
  'c08045a7-4237-43a3-8f12-e3abfa8b09f6': {
    name: 'Pill nav buttons',
    role: 'header',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={10} width={7} height={5} rx={1} />
        <rect x={12.5} y={10.7} width={3.6} height={3} rx={1.5} />
        <rect x={16.6} y={10.7} width={4.9} height={3} rx={1.5} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} strokeWidth={1} />
      </svg>
    ),
  },
};

/** Looks up the designed icon for an item id, if any (Tanda 1+2+3+4: 40/146). */
export function getSectionIcon(id: string): SectionIconEntry | null {
  return SECTION_ICONS[id] ?? null;
}
