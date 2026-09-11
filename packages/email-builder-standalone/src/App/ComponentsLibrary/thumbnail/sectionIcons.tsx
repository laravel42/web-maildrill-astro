/**
 * sectionIcons — hand-designed 2D outline icons for Components Library
 * items (Sections / Layouts / Templates / Primitives), replacing the
 * captured PNG thumbnail. See `COMPONENT_ICONS_PLAN.md` (repo root of
 * `feat/ui-polish-p1`) for the full design plan, inventory, and
 * per-tanda workflow.
 *
 * Tanda 1 (10/146): `sections`, roles `banner` + `comparison`. Keyed by
 * the item's stable `id` from `localPresets.data.json` — NOT by role,
 * since the design is per-component, not per-category/role.
 *
 * Status: **draft, pending visual approval**. Rendered here so the
 * user can review each icon in the real Components Library UI before
 * approving the tanda and moving on to the next one. Do not treat this
 * map as final/complete — only the 10 ids below are designed so far.
 */

import React from 'react';

/** viewBox 0 0 24 24, outline-only, inherits `currentColor` (theme text). */
export type SectionIconEntry = {
  name: string;
  role: 'banner' | 'comparison';
  svg: React.ReactNode;
};

const strokeProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
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
        <line x1={2.5} y1={8.3} x2={21.5} y2={8.3} strokeWidth={3} />
        <line x1={9.5} y1={10.5} x2={9.5} y2={20.5} />
        <line x1={15.5} y1={10.5} x2={15.5} y2={20.5} />
        <line x1={2.5} y1={13.5} x2={21.5} y2={13.5} />
        <line x1={2.5} y1={16.5} x2={21.5} y2={16.5} />
        <line x1={2.5} y1={19} x2={21.5} y2={19} />
      </svg>
    ),
  },
};

/** Looks up the designed icon for an item id, if any (Tanda 1: 10/146). */
export function getSectionIcon(id: string): SectionIconEntry | null {
  return SECTION_ICONS[id] ?? null;
}
