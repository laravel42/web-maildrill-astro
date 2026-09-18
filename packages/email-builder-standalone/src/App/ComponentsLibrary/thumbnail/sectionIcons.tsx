/**
 * sectionIcons — hand-designed 2D outline icons for Components Library
 * items (Sections / Layouts / Templates / Primitives), replacing the
 * captured PNG thumbnail. See `COMPONENT_ICONS_PLAN.md` (repo root of
 * `feat/ui-polish-p1`) for the full design plan, inventory, and
 * per-tanda workflow.
 *
 * Tanda 1 (9/145): `sections`, roles `banner` + `comparison` — eran 10
 * hasta que los dos `Announcement` gemelos se consolidaron en uno
 * (§22 de COMPONENT_ICONS_PLAN.md).
 * Tanda 2 (10/146): `sections`, roles `cta` + `faq`.
 * Tanda 3 (10/146): `sections`, roles `features` + `footer`.
 * Tanda 4 (10/146): `sections`, roles `gallery` + `header`.
 * Tanda 5 (10/146): `sections`, roles `hero` + `logo`.
 * Tanda 6 (10/146): `sections`, roles `nav` + `pricing`.
 * Tanda 7 (10/146): `sections`, roles `social_proof` + `stats`.
 * Tanda 8 (10/146): `sections`, roles `steps` + `team`.
 * Tanda 9 (10/146): `sections` role `testimonial` (5/85, completes
 * sections) + `layouts` (5/13, first batch).
 * Tanda 10 (8/146): `layouts`, remaining 8/13 — completes layouts
 * (13/13).
 * Keyed by the item's stable `id` from `localPresets.data.json` — NOT
 * by role, since the design is per-component, not per-category/role.
 *
 * Status: **draft, pending visual approval**. Rendered here so the
 * user can review each icon in the real Components Library UI before
 * approving the tanda and moving on to the next one. Do not treat this
 * map as final/complete — only the 98 ids below are designed so far.
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
    | 'header'
    | 'hero'
    | 'logo'
    | 'nav'
    | 'pricing'
    | 'social_proof'
    | 'stats'
    | 'steps'
    | 'team'
    | 'testimonial'
    | 'layout';
  svg: React.ReactNode;
};

/**
 * Stroke system (COMPONENT_ICONS_PLAN.md §19/§20) — TWO weights only.
 *
 * Why: these are layout *diagrams* (up to 12 shapes on a 24×24 grid), not
 * 3-5 stroke glyphs. The set previously used the Lucide default
 * (`strokeWidth: 2`) plus 10 ad-hoc weights (1, 1.2, 1.6, 1.8, 2.4, 2.5,
 * 2.6, 3, 3.2, 4). Measured on the old render (28px box, viewBox 24 →
 * 1 unit = 1.17px) that base stroke was **2.33px**, so any two parallel
 * strokes closer than 2 units overlapped: 50 of the 98 icons read as a
 * blob. Halving the base to 1 unit is what actually separates them.
 *
 * Pixel math with the current box (48px, `LibraryCardThumbnail`):
 * scale = 48/24 = 2, so 1 unit = 2px exactly and the 0.5-unit grid the
 * whole set is authored on lands on whole pixels → axis-aligned strokes
 * are crisp instead of antialiased across two rows (which is what a
 * non-integer 1.1667 scale produced at 28px).
 *
 *   SW_HAIRLINE (1u → 2px)  — everything structural and every detail.
 *   SW_ACCENT   (2u → 4px)  — the emphasized element only: accent bar,
 *                             highlighted tier border, "big number"
 *                             line, category header, wordmark slab.
 *                             Used sparingly, and never on a shape
 *                             thinner than ~3u (the stroke would fill
 *                             it). If an icon needs three levels,
 *                             simplify the geometry instead.
 *
 * Emphasis beyond those two levels is expressed with **geometry and
 * `fillOpacity`**, not with a third stroke weight. The old set had 11
 * weights; the 10 non-default ones collapsed into these two (values
 * below the old base → hairline, values above it → accent).
 */
export const SW_HAIRLINE = 1;
export const SW_ACCENT = 2;

const strokeProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: SW_HAIRLINE,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SECTION_ICONS: Record<string, SectionIconEntry> = {
  // #1 — Announcement bar (banner)
  '0398040b-0b75-46f2-80cf-f3317d7cad8b': {
    name: 'Announcement bar',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        {/* Franja oscura a sangre completa (`Container > NotionText`,
            `backgroundColor: #111827`, sin radio): el bloque ocupa todo
            el ancho, así que el icono también. El relleno tenue
            representa ese fondo oscuro.

            Antes había DOS entradas para esto — "Announcement bar" y
            "Announcement mobile-tight" —, el mismo bloque salvo
            `mobilePadding`/`fontSize`, invisible a este tamaño. Se
            consolidaron en este id (el que sí traía esas props) con el
            nombre claro; ver §22 de COMPONENT_ICONS_PLAN.md. */}
        <rect x={1.5} y={9.5} width={21} height={5} fill="currentColor" fillOpacity={0.08} />
        <line x1={5} y1={12} x2={19} y2={12} />
      </svg>
    ),
  },
  // #2 — Cornered sale card (banner)
  '4ce2d759-a608-4d6c-b3cc-d42fb2f3428f': {
    name: 'Cornered sale card',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        {/* Esquinas opuestas redondeadas (top-left + bottom-right), las
            otras dos en escuadra — es el `shape` real del bloque:
            `{topLeft: 24, topRight: 0, bottomLeft: 0, bottomRight: 24}`.
            Mismo footprint que #3 (Promo CTA) a propósito: lo único que
            los distingue son las esquinas y el botón fullWidth. */}
        <path d="M5.5 1.5H22.5V18.5a4 4 0 0 1-4 4H1.5V5.5a4 4 0 0 1 4-4z" />
        {/* Badge en la esquina (no centrado como en #3). */}
        <rect x={4.5} y={5} width={5} height={2} rx={1} />
        <line x1={4.5} y1={12} x2={19.5} y2={12} />
        {/* Button `fullWidth: true` — abarca todo el ancho útil. */}
        <rect x={4.5} y={16} width={15} height={3} rx={1} />
      </svg>
    ),
  },
  // #3 — Promo CTA (banner)
  '769366f5-1d1a-413d-9603-887ca1750651': {
    name: 'Promo CTA',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        {/* Card con radio uniforme en las 4 esquinas (`shape` real:
            16 en las cuatro) — contraste directo con las esquinas
            asimétricas de #2. */}
        <rect x={1.5} y={1.5} width={21} height={21} rx={2.5} />
        {/* Badge centrado, alineado con el botón. */}
        <rect x={8.5} y={5} width={7} height={2.5} rx={1} />
        <line x1={5} y1={12} x2={19} y2={12} />
        {/* Button `fullWidth: false` — pill centrado, más angosto que la
            card, frente al botón a todo el ancho de #2. */}
        <rect x={8.5} y={16} width={7} height={3} rx={1.5} />
      </svg>
    ),
  },
  // #4 — Sale banner (banner)
  '639a5360-f271-4409-acc6-13cd8de70872': {
    name: 'Sale banner',
    role: 'banner',
    svg: (
      <svg {...strokeProps}>
        {/* Banda oscura a sangre con un split real de 2 columnas — es el
            único `banner` respaldado por un `ColumnsContainer`
            (`fixedWidths: [60, 40]`): texto a la izquierda, chip de
            precio/CTA a la derecha, en la misma fila. */}
        <rect x={1.5} y={6.5} width={21} height={11} fill="currentColor" fillOpacity={0.08} />
        <line x1={4} y1={10} x2={12} y2={10} />
        <line x1={4} y1={14} x2={9.5} y2={14} />
        <rect x={15} y={10} width={5.5} height={4} rx={1} />
      </svg>
    ),
  },
  // #5 — Option A vs B (comparison)
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
  // #6 — Mobile-reflow A vs B (comparison)
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
        <path d="M11 2v20" strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },
  // #7 — Before / After (comparison)
  '4512a455-9b75-43d5-9db6-2d96e85b804d': {
    name: 'Before / After',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={3.5} width={8.5} height={17} rx={1} />
        <rect x={13} y={3.5} width={8.5} height={17} rx={1} />
        <rect x={4} y={5} width={5.5} height={6} rx={0.6} />
        <path d="M4.8 9.2l1.5-2 1.2 1.5 1.4-1.8" />
        <rect x={14.5} y={5} width={5.5} height={6} rx={0.6} />
        <path d="M15.3 9.2l1.5-2 1.2 1.5 1.4-1.8" />
        <line x1={4.5} y1={14.5} x2={9} y2={14.5} />
        <line x1={15} y1={14.5} x2={19.5} y2={14.5} />
      </svg>
    ),
  },
  // #8 — Feature matrix (comparison)
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
  // #9 — Top-accent matrix (comparison)
  '8a9ec9f9-46d1-4d3d-a7b8-c9cb8c3b1b04': {
    name: 'Top-accent matrix',
    role: 'comparison',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={7.5} width={19} height={13} rx={1} />
        {/* Acento = 2× la hairline (SW_ACCENT) — es el borde superior
            real del componente, no un nivel de detalle. */}
        <line x1={2.5} y1={8.3} x2={21.5} y2={8.3} strokeWidth={SW_ACCENT} />
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
        <line x1={7.5} y1={19} x2={16.5} y2={19} />
      </svg>
    ),
  },
  // #4 — BG image promo card (cta)
  '71da79ee-59c5-4492-ab8d-09076a6afe94': {
    name: 'BG image promo card',
    role: 'cta',
    svg: (
      <svg {...strokeProps}>
        <rect x={1.5} y={1.5} width={21} height={21} rx={1} />
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
        <rect x={2} y={3} width={20} height={18} rx={1.5} />
        <rect x={4.5} y={6} width={15} height={12} rx={1.8} />
        <line x1={7.5} y1={10} x2={16.5} y2={10} />
        <rect x={8.5} y={13} width={7} height={2.6} rx={1} />
        <line x1={8} y1={17} x2={16} y2={17} />
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
        <line x1={2.5} y1={8.5} x2={8} y2={8.5} />
        <line x1={2.5} y1={12} x2={10} y2={12} />
        <line x1={2.5} y1={14.5} x2={8} y2={14.5} />
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
        <line x1={2.5} y1={3} x2={8.5} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={2.5} y1={6.5} x2={11} y2={6.5} />
        <line x1={2.5} y1={9} x2={9} y2={9} />
        <line x1={2.5} y1={13} x2={8.5} y2={13} strokeWidth={SW_ACCENT} />
        <line x1={2.5} y1={16.5} x2={11} y2={16.5} />
        <line x1={2.5} y1={19} x2={9} y2={19} />
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
        <line x1={2.5} y1={9} x2={9} y2={9} />
        <line x1={2.5} y1={11.5} x2={21.5} y2={11.5} />
        <line x1={2.5} y1={14} x2={11} y2={14} />
        <line x1={2.5} y1={16.5} x2={9} y2={16.5} />
        <line x1={2.5} y1={19} x2={21.5} y2={19} />
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
        <line x1={2.5} y1={8.3} x2={7.5} y2={8.3} />
        <line x1={2.5} y1={12} x2={9.5} y2={12} />
        <line x1={2.5} y1={14.3} x2={7.5} y2={14.3} />
        <line x1={14.5} y1={6} x2={21.5} y2={6} />
        <line x1={14.5} y1={8.3} x2={19.5} y2={8.3} />
        <line x1={14.5} y1={12} x2={21.5} y2={12} />
        <line x1={14.5} y1={14.3} x2={19.5} y2={14.3} />
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
        <line x1={2.5} y1={13.3} x2={6.5} y2={13.3} />
        <circle cx={12} cy={7} r={1.6} />
        <line x1={9.5} y1={11} x2={14.5} y2={11} />
        <line x1={9.5} y1={13.3} x2={14.5} y2={13.3} />
        <circle cx={19.5} cy={7} r={1.6} />
        <line x1={17.5} y1={11} x2={21.5} y2={11} />
        <line x1={17.5} y1={13.3} x2={21.5} y2={13.3} />
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
        <line x1={12.5} y1={7.8} x2={19} y2={7.8} />
        <line x1={2} y1={14.5} x2={10.5} y2={14.5} />
        <line x1={2} y1={16.8} x2={8.5} y2={16.8} />
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
        <line x1={9.5} y1={8.3} x2={13} y2={8.3} />
        <circle cx={18} cy={7} r={1.4} />
        <circle cx={6} cy={15} r={1.4} />
        <line x1={9.5} y1={14.3} x2={13.5} y2={14.3} />
        <line x1={9.5} y1={16.3} x2={13} y2={16.3} />
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
        <path d="M2.5 6.5l1 1 1.8-2" />
        <line x1={6.5} y1={6.5} x2={11} y2={6.5} />
        <path d="M2.5 11.5l1 1 1.8-2" />
        <line x1={6.5} y1={11.5} x2={11} y2={11.5} />
        <path d="M13 6.5l1 1 1.8-2" />
        <line x1={17} y1={6.5} x2={21.5} y2={6.5} />
        <path d="M13 11.5l1 1 1.8-2" />
        <line x1={17} y1={11.5} x2={21.5} y2={11.5} />
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
        <line x1={4.5} y1={10} x2={8} y2={10} />
        <line x1={10} y1={10} x2={13.5} y2={10} />
        <line x1={15.5} y1={10} x2={19} y2={10} />
        <line x1={2.5} y1={15} x2={21.5} y2={15} />
        <line x1={6} y1={18} x2={18} y2={18} />
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
        <line x1={2.5} y1={12.5} x2={21.5} y2={12.5} />
        <line x1={4.5} y1={16} x2={9} y2={16} />
        <line x1={14} y1={16} x2={18.5} y2={16} />
        <line x1={6} y1={19.5} x2={18} y2={19.5} />
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
        <line x1={4.5} y1={10} x2={8} y2={10} />
        <line x1={10} y1={10} x2={13.5} y2={10} />
        <line x1={15.5} y1={10} x2={19} y2={10} />
        <line x1={2.5} y1={15} x2={21.5} y2={15} />
        <line x1={6} y1={18} x2={18} y2={18} />
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
        <line x1={5.5} y1={10} x2={9.5} y2={10} />
        <line x1={14.5} y1={10} x2={18.5} y2={10} />
        <line x1={2.5} y1={15} x2={21.5} y2={15} />
        <line x1={6} y1={18.5} x2={18} y2={18.5} />
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
        <line x1={6} y1={14} x2={18} y2={14} />
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
        <line x1={3} y1={14.5} x2={6.5} y2={14.5} />
        <line x1={10} y1={14.5} x2={13.5} y2={14.5} />
        <line x1={17} y1={14.5} x2={20.5} y2={14.5} />
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
        <line x1={3} y1={14.5} x2={6.5} y2={14.5} />
        <line x1={10} y1={14.5} x2={13.5} y2={14.5} />
        <line x1={17} y1={14.5} x2={20.5} y2={14.5} />
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
        <rect
          x={2}
          y={2}
          width={20}
          height={10.5}
          rx={1.4}
          fill="currentColor"
          fillOpacity={0.08}
        />
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
        <line x1={2.5} y1={14.5} x2={10.5} y2={14.5} />
        <line x1={2.5} y1={17} x2={7.5} y2={17} />
        <rect x={13} y={3} width={9} height={9} rx={1.2} />
        <line x1={13.5} y1={14.5} x2={21.5} y2={14.5} />
        <line x1={13.5} y1={17} x2={18.5} y2={17} />
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
        <line x1={6} y1={16.5} x2={18} y2={16.5} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} />
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
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} />
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
        <line x1={13.5} y1={10.5} x2={16.5} y2={10.5} />
        <line x1={17.5} y1={10.5} x2={19.5} y2={10.5} />
        <line x1={20.5} y1={10.5} x2={21.5} y2={10.5} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} />
      </svg>
    ),
  },
  // #9 — Preheader + logo (header)
  'bd457ce3-75f4-4161-9e3e-6937c9594ae5': {
    name: 'Preheader + logo',
    role: 'header',
    svg: (
      <svg {...strokeProps}>
        <line x1={6} y1={5.5} x2={18} y2={5.5} />
        <rect x={8.5} y={9.5} width={7} height={6} rx={1} />
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} />
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
        <line x1={2.5} y1={20.5} x2={21.5} y2={20.5} />
      </svg>
    ),
  },

  // ---- Tanda 5 — sections, roles `hero` + `logo` (10/146) ----

  // #1 — Centered (hero)
  '04033fa8-61be-4f01-b046-eae103b4ea5e': {
    name: 'Centered',
    role: 'hero',
    svg: (
      <svg {...strokeProps}>
        <line x1={10.5} y1={3} x2={13.5} y2={3} />
        <line x1={6} y1={6.5} x2={18} y2={6.5} />
        <line x1={7.5} y1={9.5} x2={16.5} y2={9.5} />
        <rect x={9} y={12.5} width={6} height={3} rx={1.2} />
        <line x1={8} y1={19} x2={16} y2={19} />
      </svg>
    ),
  },
  // #2 — Image card with pill CTA (hero)
  '37898f65-478b-4026-a10e-f98931e292c5': {
    name: 'Image card with pill CTA',
    role: 'hero',
    svg: (
      <svg {...strokeProps}>
        <rect
          x={2.5}
          y={3}
          width={19}
          height={18}
          rx={2.5}
          fill="currentColor"
          fillOpacity={0.08}
        />
        <line x1={7} y1={9} x2={17} y2={9} />
        <line x1={8.5} y1={12} x2={15.5} y2={12} />
        <rect x={9} y={15} width={6} height={3} rx={1.5} />
      </svg>
    ),
  },
  // #3 — Split mobile reflow (hero)
  '3881fe2f-2a14-453a-8993-bc96d5c2f8ca': {
    name: 'Split mobile reflow',
    role: 'hero',
    svg: (
      <svg {...strokeProps}>
        <line x1={2.5} y1={6} x2={10} y2={6} />
        <line x1={2.5} y1={9} x2={9} y2={9} />
        <rect x={2.5} y={12.5} width={6} height={3} rx={1.2} />
        <rect x={13} y={4} width={8.5} height={16} rx={1.4} />
      </svg>
    ),
  },
  // #4 — "Footer" (catalog role is "hero" but the block tree is a real
  // footer: SocialMedia + text + Divider + 2-col links/image — designed
  // from the actual structure, not the mislabeled role).
  '4fae03fe-d95d-405c-890d-08a6d8edbb9c': {
    name: 'Footer',
    role: 'hero',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={1.5} fill="currentColor" fillOpacity={0.08} />
        <circle cx={4.8} cy={6} r={1.3} />
        <circle cx={8.4} cy={6} r={1.3} />
        <circle cx={12} cy={6} r={1.3} />
        <line x1={3.5} y1={10.5} x2={16.5} y2={10.5} />
        <line x1={2.5} y1={13.5} x2={21.5} y2={13.5} />
        <line x1={4} y1={17.5} x2={10.5} y2={17.5} />
        <rect x={15.5} y={15.5} width={6} height={4.5} rx={1} />
      </svg>
    ),
  },
  // #5 — Logo + headline (hero)
  'bf07aee7-3472-40fc-a289-e98e9acddbaf': {
    name: 'Logo + headline',
    role: 'hero',
    svg: (
      <svg {...strokeProps}>
        <rect x={8.5} y={3} width={7} height={4.5} rx={1} />
        <line x1={6} y1={11.5} x2={18} y2={11.5} />
        <line x1={7.5} y1={14.5} x2={16.5} y2={14.5} />
        <rect x={9} y={17} width={6} height={3} rx={1.2} />
      </svg>
    ),
  },
  // #6 — Wordmark (logo)
  '2d705565-c805-4571-b446-977543111c5a': {
    name: 'Wordmark',
    role: 'logo',
    svg: (
      <svg {...strokeProps}>
        <line x1={6} y1={12} x2={18} y2={12} strokeWidth={SW_ACCENT} />
      </svg>
    ),
  },
  // #7 — Logo + tagline (logo)
  '3cf56fed-981a-4c87-862d-cea340dfd16d': {
    name: 'Logo + tagline',
    role: 'logo',
    svg: (
      <svg {...strokeProps}>
        <rect x={8} y={6} width={8} height={6} rx={1.1} />
        <line x1={7} y1={16} x2={17} y2={16} />
      </svg>
    ),
  },
  // #8 — Left aligned (logo)
  '4f9491aa-be6c-4c95-ba75-e077fb9763d0': {
    name: 'Left aligned',
    role: 'logo',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={9} width={9} height={6} rx={1.1} />
      </svg>
    ),
  },
  // #9 — On BG image (logo)
  '624b4835-df2d-46cb-af3a-a666a8af6585': {
    name: 'On BG image',
    role: 'logo',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={1.5} fill="currentColor" fillOpacity={0.08} />
        <rect x={8} y={9} width={8} height={6} rx={1.1} />
      </svg>
    ),
  },
  // #10 — Cornered card (logo)
  '71b06d77-9da6-4fe3-be3a-ad3b6785af0c': {
    name: 'Cornered card',
    role: 'logo',
    svg: (
      <svg {...strokeProps}>
        <path d="M2.5 8.5A6 6 0 0 1 8.5 2.5h7A6 6 0 0 1 21.5 8.5V21.5h-19z" />
        <rect x={8} y={8} width={8} height={5.5} rx={1} />
        <line x1={7.5} y1={17} x2={16.5} y2={17} />
      </svg>
    ),
  },

  // ---- Tanda 6 — sections, roles `nav` + `pricing` (10/146) ----

  // #1 — Pill links (nav)
  '037c8276-fc0c-43d7-bae6-e7239e395358': {
    name: 'Pill links',
    role: 'nav',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={9.5} width={5.5} height={5} rx={2.5} />
        <rect x={9.2} y={9.5} width={5.5} height={5} rx={2.5} />
        <rect x={16} y={9.5} width={5.5} height={5} rx={2.5} />
      </svg>
    ),
  },
  // #2 — BG image band (nav)
  '241630b5-f1c7-4e5d-bbfe-c54db0ae984d': {
    name: 'BG image band',
    role: 'nav',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={1.5} fill="currentColor" fillOpacity={0.08} />
        <line x1={4.5} y1={12} x2={8} y2={12} />
        <line x1={9.5} y1={12} x2={12.5} y2={12} />
        <line x1={14} y1={12} x2={17} y2={12} />
        <line x1={18.5} y1={12} x2={19.5} y2={12} />
      </svg>
    ),
  },
  // #3 — Logo + links (nav)
  '2af2bf4e-90d1-42a1-ba8a-369955157b4f': {
    name: 'Logo + links',
    role: 'nav',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={9.5} width={7} height={5} rx={1} />
        <line x1={13.5} y1={10.5} x2={16.5} y2={10.5} />
        <line x1={17.5} y1={10.5} x2={19.5} y2={10.5} />
        <line x1={20.5} y1={10.5} x2={21.5} y2={10.5} />
      </svg>
    ),
  },
  // #4 — Mobile-stack categories (nav)
  '645106fd-44c0-4d9d-ba9a-9519f5b0802e': {
    name: 'Mobile-stack categories',
    role: 'nav',
    svg: (
      <svg {...strokeProps}>
        <line x1={2.5} y1={3} x2={6.5} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={2.5} y1={6.5} x2={7.5} y2={6.5} />
        <line x1={2.5} y1={9} x2={7} y2={9} />
        <line x1={9.2} y1={3} x2={13.2} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={9.2} y1={6.5} x2={14.2} y2={6.5} />
        <line x1={9.2} y1={9} x2={13.7} y2={9} />
        <line x1={16} y1={3} x2={20} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={16} y1={6.5} x2={21} y2={6.5} />
        <line x1={16} y1={9} x2={20.5} y2={9} />
      </svg>
    ),
  },
  // #5 — Categories (nav) — same 3-group link grid as #4 (Mobile-stack
  // categories); structurally identical except for the mobile-stack
  // flag, which has no visual analogue in a static icon.
  '91915ee2-5d62-46c3-89b3-654cac1670ef': {
    name: 'Categories',
    role: 'nav',
    svg: (
      <svg {...strokeProps}>
        <line x1={2.5} y1={3} x2={6.5} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={2.5} y1={6.5} x2={7.5} y2={6.5} />
        <line x1={2.5} y1={9} x2={7} y2={9} />
        <line x1={9.2} y1={3} x2={13.2} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={9.2} y1={6.5} x2={14.2} y2={6.5} />
        <line x1={9.2} y1={9} x2={13.7} y2={9} />
        <line x1={16} y1={3} x2={20} y2={3} strokeWidth={SW_ACCENT} />
        <line x1={16} y1={6.5} x2={21} y2={6.5} />
        <line x1={16} y1={9} x2={20.5} y2={9} />
        <line x1={2.5} y1={13} x2={21.5} y2={13} strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },
  // #6 — Monthly / Annual (pricing)
  '36ea3e52-d5a2-41b8-86b7-3dea022fa658': {
    name: 'Monthly / Annual',
    role: 'pricing',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <rect x={2} y={5} width={9.3} height={16} rx={1.6} />
        <rect x={12.7} y={5} width={9.3} height={16} rx={1.6} strokeWidth={SW_ACCENT} />
        <line x1={4.2} y1={8} x2={9.1} y2={8} />
        <line x1={4.2} y1={10.5} x2={7.5} y2={10.5} />
        <line x1={14.9} y1={8} x2={19.8} y2={8} />
        <line x1={14.9} y1={10.5} x2={18.2} y2={10.5} />
        <rect x={4.2} y={17} width={4.9} height={2.4} rx={1} />
        <rect x={14.9} y={17} width={4.9} height={2.4} rx={1} />
      </svg>
    ),
  },
  // #7 — Cornered cards row (pricing)
  '42e75ffc-b7ef-4486-b25b-e57eda80b179': {
    name: 'Cornered cards row',
    role: 'pricing',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <rect x={2} y={5.5} width={6} height={15.5} rx={2.6} />
        <rect x={9} y={5.5} width={6} height={15.5} rx={2.6} strokeWidth={SW_ACCENT} />
        <rect x={16} y={5.5} width={6} height={15.5} rx={2.6} />
        <line x1={3} y1={9} x2={6.5} y2={9} />
        <line x1={10} y1={9} x2={13.5} y2={9} />
        <line x1={17} y1={9} x2={20.5} y2={9} />
        <rect x={3} y={17.5} width={4} height={2} rx={0.8} />
        <rect x={10} y={17.5} width={4} height={2} rx={0.8} />
        <rect x={17} y={17.5} width={4} height={2} rx={0.8} />
      </svg>
    ),
  },
  // #8 — Single feature card (pricing)
  '7fcd1b9a-a856-4375-b6f9-a095d97288b7': {
    name: 'Single feature card',
    role: 'pricing',
    svg: (
      <svg {...strokeProps}>
        <rect x={3} y={3} width={18} height={18} rx={1.8} />
        <line x1={3} y1={4.5} x2={21} y2={4.5} strokeWidth={SW_ACCENT} />
        <line x1={9} y1={7} x2={15} y2={7} />
        <line x1={7} y1={11} x2={11.2} y2={11} />
        <line x1={12.8} y1={11} x2={17} y2={11} />
        <rect x={9} y={15} width={6} height={2.6} rx={1} />
      </svg>
    ),
  },
  // #9 — Mobile-stacked plans (pricing) — same 2-plan layout as #6
  // (Monthly / Annual), with a soft gradient card fill and a "Save 20%"
  // badge above the highlighted plan.
  'ac3e7550-d9c2-4757-b470-c3d8001811b9': {
    name: 'Mobile-stacked plans',
    role: 'pricing',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <rect x={2} y={5} width={9.3} height={16} rx={2.2} />
        <rect
          x={12.7}
          y={7.2}
          width={9.3}
          height={13.8}
          rx={2.2}
          fill="currentColor"
          fillOpacity={0.08}
        />
        <rect x={14.9} y={8.4} width={5} height={2} rx={1} />
        <line x1={4.2} y1={9.5} x2={9.1} y2={9.5} />
        <line x1={4.2} y1={12} x2={7.5} y2={12} />
        <line x1={14.9} y1={12.5} x2={19.8} y2={12.5} />
        <line x1={14.9} y1={15} x2={18.2} y2={15} />
        <rect x={4.2} y={17.8} width={4.9} height={2.2} rx={1} />
        <rect x={14.9} y={17.8} width={4.9} height={2.2} rx={1} />
      </svg>
    ),
  },
  // #10 — 3 tiers with highlight (pricing)
  'adcd51b6-b598-49e6-a228-1b21d1e25155': {
    name: '3 tiers with highlight',
    role: 'pricing',
    svg: (
      <svg {...strokeProps}>
        <line x1={10} y1={1.5} x2={14} y2={1.5} />
        <line x1={7.5} y1={3.6} x2={16.5} y2={3.6} />
        <rect x={2} y={7} width={6} height={14.5} rx={1.6} />
        <rect x={9} y={5.6} width={6} height={15.9} rx={1.6} strokeWidth={SW_ACCENT} />
        <rect x={16} y={7} width={6} height={14.5} rx={1.6} />
        <rect x={9.8} y={6.6} width={4.4} height={1.6} rx={0.8} />
        <rect x={3} y={16.5} width={4} height={2} rx={0.8} />
        <rect x={10} y={17.5} width={4} height={2} rx={0.8} />
        <rect x={17} y={16.5} width={4} height={2} rx={0.8} />
      </svg>
    ),
  },

  // ---- Tanda 7 — sections, roles `social_proof` + `stats` (10/146) ----

  // #1 — BG image quote band (social_proof)
  '164d7f04-5b3e-492e-937d-46dc1a98207d': {
    name: 'BG image quote band',
    role: 'social_proof',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={1.5} fill="currentColor" fillOpacity={0.08} />
        <line x1={9.5} y1={5.5} x2={14.5} y2={5.5} />
        <line x1={6.5} y1={8.5} x2={17.5} y2={8.5} />
        <circle cx={12} cy={14} r={2.4} />
        <line x1={9} y1={18.5} x2={15} y2={18.5} />
      </svg>
    ),
  },
  // #2 — Pill rating card (social_proof)
  '419a3823-cfd6-4cfd-b07f-c37ac71d736f': {
    name: 'Pill rating card',
    role: 'social_proof',
    svg: (
      <svg {...strokeProps}>
        <rect x={2.5} y={8.5} width={19} height={7} rx={3.5} />
        <line x1={7} y1={11} x2={17} y2={11} />
        <line x1={8.5} y1={13.7} x2={15.5} y2={13.7} />
      </svg>
    ),
  },
  // #3 — Stat + logos (social_proof)
  '43ef55b1-6f84-4e6e-a6e9-494c604b62bf': {
    name: 'Stat + logos',
    role: 'social_proof',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={4} x2={15} y2={4} strokeWidth={SW_ACCENT} />
        <line x1={8} y1={7.5} x2={16} y2={7.5} />
        <rect x={2.5} y={13} width={5.5} height={5} rx={1} />
        <rect x={9.2} y={13} width={5.5} height={5} rx={1} />
        <rect x={16} y={13} width={5.5} height={5} rx={1} />
      </svg>
    ),
  },
  // #4 — Press quotes (social_proof)
  '56f3d4cd-3506-48ac-9222-9fe9d6f2b261': {
    name: 'Press quotes',
    role: 'social_proof',
    svg: (
      <svg {...strokeProps}>
        <line x1={2.5} y1={5} x2={7} y2={5} />
        <line x1={2.5} y1={8} x2={6} y2={8} />
        <line x1={9.2} y1={5} x2={13.7} y2={5} />
        <line x1={9.2} y1={8} x2={12.7} y2={8} />
        <line x1={16} y1={5} x2={20.5} y2={5} />
        <line x1={16} y1={8} x2={19.5} y2={8} />
      </svg>
    ),
  },
  // #5 — Logos mobile stack (social_proof)
  '9e322371-a8b4-4856-bb6c-931ec1e43938': {
    name: 'Logos mobile stack',
    role: 'social_proof',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={4} x2={15} y2={4} />
        <rect x={2.5} y={9.5} width={5.5} height={5} rx={1} />
        <rect x={9.2} y={9.5} width={5.5} height={5} rx={1} />
        <rect x={16} y={9.5} width={5.5} height={5} rx={1} />
      </svg>
    ),
  },
  // #6 — Mobile-stack with icons (stats)
  '403ab92c-2906-40f9-8e9e-b86519788bab': {
    name: 'Mobile-stack with icons',
    role: 'stats',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4.5} cy={5.5} r={1.6} />
        <line x1={2.5} y1={10} x2={6.5} y2={10} strokeWidth={SW_ACCENT} />
        <line x1={2.5} y1={13.3} x2={6.5} y2={13.3} />
        <circle cx={12} cy={5.5} r={1.6} />
        <line x1={9.5} y1={10} x2={14.5} y2={10} strokeWidth={SW_ACCENT} />
        <line x1={9.5} y1={13.3} x2={14.5} y2={13.3} />
        <circle cx={19.5} cy={5.5} r={1.6} />
        <line x1={17.5} y1={10} x2={21.5} y2={10} strokeWidth={SW_ACCENT} />
        <line x1={17.5} y1={13.3} x2={21.5} y2={13.3} />
        <line x1={2.5} y1={18} x2={21.5} y2={18} strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },
  // #7 — 4 metrics grid (stats)
  '487d3679-619d-4e38-ba82-daf16e6a985d': {
    name: '4 metrics grid',
    role: 'stats',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <line x1={4} y1={7} x2={9} y2={7} strokeWidth={SW_ACCENT} />
        <line x1={4} y1={9.7} x2={8.5} y2={9.7} />
        <line x1={15} y1={7} x2={20} y2={7} strokeWidth={SW_ACCENT} />
        <line x1={15} y1={9.7} x2={19.5} y2={9.7} />
        <line x1={4} y1={15} x2={9} y2={15} strokeWidth={SW_ACCENT} />
        <line x1={4} y1={17.7} x2={8.5} y2={17.7} />
        <line x1={15} y1={15} x2={20} y2={15} strokeWidth={SW_ACCENT} />
        <line x1={15} y1={17.7} x2={19.5} y2={17.7} />
      </svg>
    ),
  },
  // #8 — Highlight + context (stats)
  '5ba31193-4e40-4e7e-a15d-674735bc7509': {
    name: 'Highlight + context',
    role: 'stats',
    svg: (
      <svg {...strokeProps}>
        <line x1={2.5} y1={11} x2={9} y2={11} strokeWidth={SW_ACCENT} />
        <line x1={12.5} y1={7.5} x2={21.5} y2={7.5} />
        <line x1={12.5} y1={10} x2={20} y2={10} />
        <rect x={12.5} y={13} width={7} height={3} rx={1.2} />
      </svg>
    ),
  },
  // #9 — Stats with icons (stats) — same 3-col icon+number+label grid as
  // #6 (Mobile-stack with icons); no mobile-stack flag here.
  'a2ccde5c-4903-4962-804f-77978c5f8463': {
    name: 'Stats with icons',
    role: 'stats',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4.5} cy={5.5} r={1.6} />
        <line x1={2.5} y1={10} x2={6.5} y2={10} strokeWidth={SW_ACCENT} />
        <line x1={2.5} y1={13.3} x2={6.5} y2={13.3} />
        <circle cx={12} cy={5.5} r={1.6} />
        <line x1={9.5} y1={10} x2={14.5} y2={10} strokeWidth={SW_ACCENT} />
        <line x1={9.5} y1={13.3} x2={14.5} y2={13.3} />
        <circle cx={19.5} cy={5.5} r={1.6} />
        <line x1={17.5} y1={10} x2={21.5} y2={10} strokeWidth={SW_ACCENT} />
        <line x1={17.5} y1={13.3} x2={21.5} y2={13.3} />
      </svg>
    ),
  },
  // #10 — Cornered cards 4-up (stats)
  'c174aa06-7d33-4247-a551-26f61c4868e5': {
    name: 'Cornered cards 4-up',
    role: 'stats',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <rect x={3} y={5.5} width={8} height={6.5} rx={2.2} />
        <rect x={13} y={5.5} width={8} height={6.5} rx={2.2} />
        <rect x={3} y={13.5} width={8} height={6.5} rx={2.2} />
        <rect x={13} y={13.5} width={8} height={6.5} rx={2.2} />
        <line x1={4.5} y1={8.3} x2={8} y2={8.3} />
        <line x1={14.5} y1={8.3} x2={18} y2={8.3} />
        <line x1={4.5} y1={16.3} x2={8} y2={16.3} />
        <line x1={14.5} y1={16.3} x2={18} y2={16.3} />
      </svg>
    ),
  },

  // ---- Tanda 8 — sections, roles `steps` + `team` (10/146) ----

  // #1 — Mobile vertical timeline (steps)
  '02621ec6-b152-4fa6-8bce-390c31ea3986': {
    name: 'Mobile vertical timeline',
    role: 'steps',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4} cy={4.5} r={1.8} />
        <line x1={7.5} y1={4.5} x2={16} y2={4.5} />
        <line x1={7.5} y1={6.8} x2={13} y2={6.8} />
        <line x1={4} y1={9} x2={4} y2={11} strokeDasharray="1.2 1.2" />
        <circle cx={4} cy={12} r={1.8} />
        <line x1={7.5} y1={12} x2={16} y2={12} />
        <line x1={7.5} y1={14.3} x2={13} y2={14.3} />
        <line x1={4} y1={16.5} x2={4} y2={18.5} strokeDasharray="1.2 1.2" />
        <circle cx={4} cy={19.5} r={1.8} />
        <line x1={7.5} y1={19.5} x2={16} y2={19.5} />
      </svg>
    ),
  },
  // #2 — How it works (steps)
  '4d7a6968-7d71-4de8-9a7a-457927c5f70e': {
    name: 'How it works',
    role: 'steps',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <circle cx={4.5} cy={9} r={1.7} />
        <line x1={2.5} y1={13.5} x2={6.5} y2={13.5} />
        <circle cx={12} cy={9} r={1.7} />
        <line x1={9.5} y1={13.5} x2={14.5} y2={13.5} />
        <circle cx={19.5} cy={9} r={1.7} />
        <line x1={17.5} y1={13.5} x2={21.5} y2={13.5} />
      </svg>
    ),
  },
  // #3 — Pill numbered cards (steps)
  '88d32150-af31-482b-b77f-19afdeea27cc': {
    name: 'Pill numbered cards',
    role: 'steps',
    svg: (
      <svg {...strokeProps}>
        <line x1={9} y1={2.2} x2={15} y2={2.2} />
        <rect x={2.5} y={5} width={5.5} height={3} rx={1.5} />
        <rect x={9.2} y={5} width={5.5} height={3} rx={1.5} />
        <rect x={16} y={5} width={5.5} height={3} rx={1.5} />
        <rect x={2.5} y={10} width={5.5} height={10} rx={1} strokeWidth={SW_ACCENT} />
        <rect x={9.2} y={10} width={5.5} height={10} rx={1} strokeWidth={SW_ACCENT} />
        <rect x={16} y={10} width={5.5} height={10} rx={1} strokeWidth={SW_ACCENT} />
      </svg>
    ),
  },
  // #4 — BG image hero + numbered cards (steps)
  '94205636-ff4c-4095-aa97-3bf4c78f3c17': {
    name: 'BG image hero + numbered cards',
    role: 'steps',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={7} rx={1.3} fill="currentColor" fillOpacity={0.08} />
        <line x1={9} y1={4.2} x2={15} y2={4.2} />
        <line x1={7} y1={6.5} x2={17} y2={6.5} />
        <rect x={2.5} y={12} width={5.5} height={9} rx={1} />
        <rect x={9.2} y={12} width={5.5} height={9} rx={1} />
        <rect x={16} y={12} width={5.5} height={9} rx={1} />
      </svg>
    ),
  },
  // #5 — Process with images (steps)
  'a7d991de-6787-40da-944e-858abe0fa977': {
    name: 'Process with images',
    role: 'steps',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4.5} cy={4} r={1.4} />
        <rect x={2} y={6.5} width={6} height={5} rx={1} />
        <line x1={2.5} y1={13} x2={7.5} y2={13} />
        <circle cx={12} cy={4} r={1.4} />
        <rect x={9} y={6.5} width={6} height={5} rx={1} />
        <line x1={9.5} y1={13} x2={14.5} y2={13} />
        <circle cx={19.5} cy={4} r={1.4} />
        <rect x={16} y={6.5} width={6} height={5} rx={1} />
        <line x1={16.5} y1={13} x2={21.5} y2={13} />
      </svg>
    ),
  },
  // #6 — Cornered member cards (team)
  '038aeb83-d141-4f04-927f-ed02a0995a72': {
    name: 'Cornered member cards',
    role: 'team',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={2.6} ry={2.6} />
        <rect x={9} y={4} width={6} height={16} rx={2.6} ry={2.6} />
        <rect x={16} y={4} width={6} height={16} rx={2.6} ry={2.6} />
        <circle cx={5} cy={9} r={1.7} />
        <circle cx={12} cy={9} r={1.7} />
        <circle cx={19} cy={9} r={1.7} />
        <line x1={3.2} y1={13.5} x2={6.8} y2={13.5} />
        <line x1={10.2} y1={13.5} x2={13.8} y2={13.5} />
        <line x1={17.2} y1={13.5} x2={20.8} y2={13.5} />
        <rect x={3.5} y={16} width={3} height={1.8} rx={0.9} />
        <rect x={10.5} y={16} width={3} height={1.8} rx={0.9} />
        <rect x={17.5} y={16} width={3} height={1.8} rx={0.9} />
      </svg>
    ),
  },
  // #7 — BG image team band (team)
  '353542c8-6e6f-4eff-911f-d5d26e087ddb': {
    name: 'BG image team band',
    role: 'team',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={7} rx={1.3} fill="currentColor" fillOpacity={0.08} />
        <line x1={9} y1={4.2} x2={15} y2={4.2} />
        <line x1={7} y1={6.5} x2={17} y2={6.5} />
        <circle cx={5.2} cy={13.2} r={1.7} />
        <circle cx={12} cy={13.2} r={1.7} />
        <circle cx={18.8} cy={13.2} r={1.7} />
        <line x1={3.2} y1={17.5} x2={7.2} y2={17.5} />
        <line x1={10} y1={17.5} x2={14} y2={17.5} />
        <line x1={16.8} y1={17.5} x2={20.8} y2={17.5} />
      </svg>
    ),
  },
  // #8 — Mobile-stacked grid (team) — same 3-avatar grid as #6/#7 but
  // without the card frame or social button, plus a bio line.
  '741f0e71-8b8e-4884-9828-06eff2bc6f71': {
    name: 'Mobile-stacked grid',
    role: 'team',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4.5} cy={4} r={1.7} />
        <line x1={2.5} y1={8.3} x2={6.5} y2={8.3} />
        <line x1={2.5} y1={10.6} x2={6.5} y2={10.6} />
        <circle cx={12} cy={4} r={1.7} />
        <line x1={9.5} y1={8.3} x2={14.5} y2={8.3} />
        <line x1={9.5} y1={10.6} x2={14.5} y2={10.6} />
        <circle cx={19.5} cy={4} r={1.7} />
        <line x1={17} y1={8.3} x2={21.5} y2={8.3} />
        <line x1={17} y1={10.6} x2={21.5} y2={10.6} />
      </svg>
    ),
  },
  // #9 — 2 founders (team)
  '9c62ea3b-1248-475d-8686-3409f7ea6233': {
    name: '2 founders',
    role: 'team',
    svg: (
      <svg {...strokeProps}>
        <circle cx={7} cy={5} r={2.2} />
        <line x1={3.5} y1={10.5} x2={10.5} y2={10.5} />
        <line x1={3.5} y1={13} x2={9.5} y2={13} />
        <circle cx={17} cy={5} r={2.2} />
        <line x1={13.5} y1={10.5} x2={20.5} y2={10.5} />
        <line x1={13.5} y1={13} x2={19.5} y2={13} />
      </svg>
    ),
  },
  // #10 — 3 member cards (team)
  'cd3b47fc-4701-4547-b634-0935b674c827': {
    name: '3 member cards',
    role: 'team',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4.5} cy={6} r={2} />
        <line x1={2.5} y1={11.5} x2={6.5} y2={11.5} />
        <circle cx={12} cy={6} r={2} />
        <line x1={9.5} y1={11.5} x2={14.5} y2={11.5} />
        <circle cx={19.5} cy={6} r={2} />
        <line x1={17.5} y1={11.5} x2={21.5} y2={11.5} />
      </svg>
    ),
  },

  // ---- Tanda 9 — sections `testimonial` (5/85) + layouts (5/13) ----

  // #1 — Quote with author (testimonial)
  '57f8146b-cf8c-43de-bf76-3b33c808910f': {
    name: 'Quote with author',
    role: 'testimonial',
    svg: (
      <svg {...strokeProps}>
        <circle cx={4.5} cy={12} r={3} />
        <line x1={10} y1={8.5} x2={20} y2={8.5} />
        <line x1={10} y1={12} x2={17} y2={12} />
        <line x1={10} y1={15} x2={16.5} y2={15} />
      </svg>
    ),
  },
  // #2 — Pill avatar cards (testimonial)
  'af63d2e0-f52b-4382-ac69-1751852c2403': {
    name: 'Pill avatar cards',
    role: 'testimonial',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={6.5} height={16.5} rx={2.6} />
        <rect x={9} y={3} width={6.5} height={16.5} rx={2.6} />
        <rect x={16} y={3} width={6.5} height={16.5} rx={2.6} />
        <line x1={3.2} y1={6} x2={7.3} y2={6} />
        <circle cx={5.25} cy={11} r={1.6} />
        <rect x={3.7} y={14.5} width={3.1} height={1.6} rx={0.8} />
        <line x1={10.2} y1={6} x2={14.3} y2={6} />
        <circle cx={12.25} cy={11} r={1.6} />
        <rect x={10.7} y={14.5} width={3.1} height={1.6} rx={0.8} />
        <line x1={17.2} y1={6} x2={21.3} y2={6} />
        <circle cx={19.25} cy={11} r={1.6} />
        <rect x={17.7} y={14.5} width={3.1} height={1.6} rx={0.8} />
      </svg>
    ),
  },
  // #3 — Mobile-stack 3 quotes (testimonial)
  'cede2521-b110-48f6-8d58-11b419f9ad10': {
    name: 'Mobile-stack 3 quotes',
    role: 'testimonial',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={6.5} height={16.5} rx={1.4} />
        <rect x={9} y={3} width={6.5} height={16.5} rx={1.4} />
        <rect x={16} y={3} width={6.5} height={16.5} rx={1.4} />
        <line x1={3.2} y1={6} x2={7.3} y2={6} />
        <line x1={3.2} y1={11} x2={7.3} y2={11} strokeDasharray="1 1" />
        <circle cx={5.25} cy={14.5} r={1.4} />
        <line x1={10.2} y1={6} x2={14.3} y2={6} />
        <line x1={10.2} y1={11} x2={14.3} y2={11} strokeDasharray="1 1" />
        <circle cx={12.25} cy={14.5} r={1.4} />
        <line x1={17.2} y1={6} x2={21.3} y2={6} />
        <line x1={17.2} y1={11} x2={21.3} y2={11} strokeDasharray="1 1" />
        <circle cx={19.25} cy={14.5} r={1.4} />
      </svg>
    ),
  },
  // #4 — BG image featured quote (testimonial)
  'd292fda6-dabd-4963-89b8-7fc28ee428e2': {
    name: 'BG image featured quote',
    role: 'testimonial',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={1.5} fill="currentColor" fillOpacity={0.08} />
        <line x1={9.5} y1={5.5} x2={14.5} y2={5.5} />
        <line x1={6.5} y1={8.5} x2={17.5} y2={8.5} />
        <circle cx={12} cy={14} r={2.4} />
        <line x1={9} y1={18.5} x2={15} y2={18.5} />
      </svg>
    ),
  },
  // #5 — 3 testimonial cards (testimonial) — same 3-card layout as #2
  // (Pill avatar cards) without the trailing "Read more" button.
  'df94d9e8-1e31-4339-a036-5ea5e99233a8': {
    name: '3 testimonial cards',
    role: 'testimonial',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={3} width={6.5} height={16.5} rx={2.6} />
        <rect x={9} y={3} width={6.5} height={16.5} rx={2.6} />
        <rect x={16} y={3} width={6.5} height={16.5} rx={2.6} />
        <line x1={3.2} y1={6} x2={7.3} y2={6} />
        <line x1={3.2} y1={9.5} x2={7.3} y2={9.5} />
        <circle cx={5.25} cy={14.5} r={1.6} />
        <line x1={10.2} y1={6} x2={14.3} y2={6} />
        <line x1={10.2} y1={9.5} x2={14.3} y2={9.5} />
        <circle cx={12.25} cy={14.5} r={1.6} />
        <line x1={17.2} y1={6} x2={21.3} y2={6} />
        <line x1={17.2} y1={9.5} x2={21.3} y2={9.5} />
        <circle cx={19.25} cy={14.5} r={1.6} />
      </svg>
    ),
  },
  // #6 — Media + text (layout, columns-2, 45/55) — empty composition
  // scaffold (no real content, `childrenIds: []`): icon shows only the
  // column geometry (image card + text card), no inner detail.
  '53f33c42-9871-46cd-b000-5d1327215e10': {
    name: 'Media + text',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={9} height={16} rx={2} fill="currentColor" fillOpacity={0.08} />
        <rect x={13} y={4} width={9} height={16} rx={2} strokeDasharray="2 1.4" />
      </svg>
    ),
  },
  // #7 — Hero split (layout, columns-2, 60/40)
  '98cdcd2a-8db3-428f-894e-835a7414861a': {
    name: 'Hero split',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={12} height={16} rx={2} strokeDasharray="2 1.4" />
        <rect x={16} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.08} />
      </svg>
    ),
  },
  // #8 — Sidebar shell (layout, columns-2, 32/68)
  'a8fabafc-6419-4827-82ad-7fe9e0789a88': {
    name: 'Sidebar shell',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.08} />
        <rect x={10} y={4} width={12} height={7} rx={1.8} strokeDasharray="2 1.4" />
        <rect x={10} y={13} width={12} height={7} rx={1.8} strokeDasharray="2 1.4" />
      </svg>
    ),
  },
  // #9 — Magazine (layout, columns-2, 66/34, nested 2-up in main col)
  'c4f900a4-071c-45e6-89b2-9a164f6cd905': {
    name: 'Magazine',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={7} height={16} rx={1.8} strokeDasharray="2 1.4" />
        <rect x={10.2} y={4} width={7} height={16} rx={1.8} strokeDasharray="2 1.4" />
        <rect
          x={17.4}
          y={4}
          width={4.6}
          height={16}
          rx={1.8}
          fill="currentColor"
          fillOpacity={0.08}
        />
      </svg>
    ),
  },
  // #10 — Bento grid (layout, columns-3, gradient · image · glass)
  '10bf9ad2-303c-474e-a247-a28b25ed4a97': {
    name: 'Bento grid',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.16} />
        <rect x={9} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.08} />
        <rect x={16} y={4} width={6} height={16} rx={2} strokeDasharray="1.4 1.4" />
      </svg>
    ),
  },

  // ---- Tanda 10 — layouts, rest (8/13, completes layouts) ----

  // #1 — Feature trio (layout, columns-3)
  '6dfb5ae2-a92f-4b3b-92ac-6146d851da7f': {
    name: 'Feature trio',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={1.4} />
        <rect x={9} y={4} width={6} height={16} rx={1.4} />
        <rect x={16} y={4} width={6} height={16} rx={1.4} />
        <line x1={2} y1={4.8} x2={8} y2={4.8} strokeWidth={SW_ACCENT} />
        <line x1={9} y1={4.8} x2={15} y2={4.8} strokeWidth={SW_ACCENT} />
        <line x1={16} y1={4.8} x2={22} y2={4.8} strokeWidth={SW_ACCENT} />
      </svg>
    ),
  },
  // #2 — Pricing trio (layout, columns-3, highlighted middle tier)
  '7b429d27-b6bd-43f6-9bdc-f3917dc3b2d9': {
    name: 'Pricing trio',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={1.4} />
        <line x1={2} y1={4.8} x2={8} y2={4.8} strokeWidth={SW_ACCENT} />
        <rect x={9} y={2.5} width={6} height={19} rx={2} fill="currentColor" fillOpacity={0.14} />
        <rect x={16} y={4} width={6} height={16} rx={1.4} />
        <line x1={16} y1={4.8} x2={22} y2={4.8} strokeWidth={SW_ACCENT} />
      </svg>
    ),
  },
  // #3 — Gallery grid (layout, columns-3, 3 identical bg-image cards)
  'cb2adfc1-4a36-437b-a18f-84708b76f684': {
    name: 'Gallery grid',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.1} />
        <rect x={9} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.1} />
        <rect x={16} y={4} width={6} height={16} rx={2} fill="currentColor" fillOpacity={0.1} />
      </svg>
    ),
  },
  // #4 — Spotlight (image overlay) (layout, container: bg-image band +
  // centered inset card)
  '0218f056-aebf-4d19-b742-508e467cad8e': {
    name: 'Spotlight (image overlay)',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={2.2} fill="currentColor" fillOpacity={0.12} />
        <rect x={6} y={7} width={12} height={10} rx={1.8} strokeDasharray="1.6 1.4" />
      </svg>
    ),
  },
  // #5 — Gradient hero band (layout, container: gradient band + centered
  // inset card) — same "band + inset card" pattern as #4, gradient
  // fill instead of an image (diagonal hatch stands in for the
  // gradient direction).
  '46b33349-e766-4bef-a443-a500da282912': {
    name: 'Gradient hero band',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={2} y={2} width={20} height={20} rx={2.2} />
        <line x1={4} y1={20} x2={20} y2={4} strokeDasharray="1.4 1.4" />
        <rect
          x={6}
          y={7}
          width={12}
          height={10}
          rx={1.8}
          fill="currentColor"
          fillOpacity={0.12}
          strokeDasharray="0"
        />
      </svg>
    ),
  },
  // #6 — Feature grid 2×2 (layout, container wrapping two 2-col rows)
  'e928d346-3cbe-4ceb-aa54-0eb15a8e80d1': {
    name: 'Feature grid 2×2',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={1.5} y={1.5} width={21} height={21} rx={1.6} />
        <rect x={4} y={4} width={7.5} height={7} rx={1.4} />
        <rect x={12.5} y={4} width={7.5} height={7} rx={1.4} />
        <rect x={4} y={13} width={7.5} height={7} rx={1.4} />
        <rect x={12.5} y={13} width={7.5} height={7} rx={1.4} />
      </svg>
    ),
  },
  // #7 — Stacked sections (layout, container wrapping 3 stacked cards)
  'f60bfba6-d3c7-4327-8c5c-34642cf44546': {
    name: 'Stacked sections',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect x={1.5} y={1.5} width={21} height={21} rx={1.6} />
        <rect x={4} y={3.5} width={16} height={4.5} rx={1.2} />
        <rect x={4} y={9.5} width={16} height={4.5} rx={1.2} />
        <rect x={4} y={15.5} width={16} height={4.5} rx={1.2} />
      </svg>
    ),
  },
  // #8 — Split callout (layout, container: tinted band + 60/40 card
  // split)
  'f6c65ea8-78ca-4ef1-9a70-0c6f652b6954': {
    name: 'Split callout',
    role: 'layout',
    svg: (
      <svg {...strokeProps}>
        <rect
          x={1.5}
          y={5}
          width={21}
          height={14}
          rx={2.2}
          fill="currentColor"
          fillOpacity={0.08}
        />
        <rect x={3.5} y={7.2} width={11} height={9.6} rx={1.6} />
        <rect x={16} y={7.2} width={6.5} height={9.6} rx={1.6} />
      </svg>
    ),
  },
};

/** Looks up the designed icon for an item id, if any (Tanda 1-10: 98/146). */
export function getSectionIcon(id: string): SectionIconEntry | null {
  return SECTION_ICONS[id] ?? null;
}
