/**
 * Dev-only seeder for prebuilt theme bundles. Mirrors `devSeedSections`:
 * runs in the browser and POSTs each theme to `/dev/save-theme`. The
 * backend mints a UUID and writes `themes/{uuid}.json` under
 * `skills/email-builder/references/`.
 *
 * Trigger from the dev console after `pnpm dev` + `pnpm dev:backend`:
 *
 *   await window.__seedThemes()                  // seed all 30
 *   await window.__seedThemes({ limit: 5 })      // smoke-test first 5
 *   await window.__seedThemes({ force: true })   // overwrite same-name themes
 *
 * Naming is intentionally distinct from the 10 toolbar `THEME_PRESETS`
 * (`Classic Light`, `Midnight`, `Ocean`, `Sunset`, `Forest`, `Royal`,
 * `Slate`, `Coral`, `Mocha`, `Mono`) so the seeder is purely additive
 * for a typical install. Idempotent by trimmed `name`: existing themes
 * with the same name are skipped (or deleted + recreated under `force`).
 *
 * See `docs/plans/components-library-theme-seeder.md` for the design
 * rationale and the full 30-theme catalog.
 */

import type { ThemeBundlePayload } from '@eb/document-core';

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';

// --- Types ------------------------------------------------------------------

type Font =
  | 'MODERN_SANS'
  | 'LATO'
  | 'MERRIWEATHER'
  | 'MONTSERRAT'
  | 'OPEN_SANS'
  | 'OSWALD'
  | 'PACIFICO'
  | 'PLAYFAIR'
  | 'ROBOTO'
  | 'INHERIT';

type Shape = 'rectangle' | 'pill' | { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number };

/** Palette tuple — every theme defines one. */
type Palette = {
  /** Outer canvas (page background, behind the email body). */
  backdrop: string;
  /** Email body fill. */
  canvas: string;
  /** Global text color. */
  text: string;
  /** Global link color. */
  link: string;
  /** Button background / accent. */
  primary: string;
  /** Button text color (must contrast `primary`). */
  primaryText: string;
  /** Divider color (also reused as default border on Containers). */
  divider: string;
  /** Optional explicit Container border color (defaults to `divider`). */
  border?: string;
};

type ThemeDef = {
  name: string;
  description?: string;
  palette: Palette;
  font: Font;
  /** Global radius cascade — picked up by Container/Button defaults. */
  radius?: number;
  /** `linkGlobal.underline` (default `true`). */
  underline?: boolean;
  /** Override `Button.style.shape`. */
  buttonShape?: Shape;
  /** Override `Button.style.fontFamily`. */
  buttonFont?: Font;
  /** Override `Button.style.fontWeight`. */
  buttonWeight?: 'bold' | 'normal';
  /** Override `NotionText.style.fontFamily` (e.g. serif headings). */
  notionFont?: Font;
};

// --- Builders ---------------------------------------------------------------

/** Build a `ThemeBundlePayload` from a `ThemeDef`. */
function buildBundle(def: ThemeDef): ThemeBundlePayload {
  const { palette, font, radius, underline = true, buttonShape, buttonFont, buttonWeight, notionFont } = def;

  const globals: NonNullable<ThemeBundlePayload['globals']> = {
    backdropColor: palette.backdrop,
    canvasColor: palette.canvas,
    textColor: palette.text,
    fontFamily: font,
    linkGlobal: { linkColor: palette.link, underline },
    ...(radius !== undefined ? { borderRadius: radius } : {}),
    ...(palette.border ? { borderColor: palette.border } : {}),
  };

  const buttonStyle: Record<string, unknown> = {
    buttonBackgroundColor: palette.primary,
    buttonTextColor: palette.primaryText,
  };
  if (buttonFont) buttonStyle.fontFamily = buttonFont;
  if (buttonWeight) buttonStyle.fontWeight = buttonWeight;
  if (buttonShape) buttonStyle.shape = buttonShape;

  const blocks: NonNullable<ThemeBundlePayload['blocks']> = {
    Button: { style: buttonStyle },
    Divider: { style: { color: palette.divider } },
    Container: {
      style: {
        backgroundColor: palette.canvas,
        ...(palette.border ? { borderColor: palette.border } : {}),
      },
    },
    ColumnsContainer: { style: { backgroundColor: palette.canvas } },
  };
  if (notionFont) blocks.NotionText = { style: { fontFamily: notionFont } };

  return { globals, blocks };
}

/** Build the API payload (`name`, `description?`, `bundle`). */
function buildPayload(def: ThemeDef): { name: string; description?: string; bundle: ThemeBundlePayload } {
  return {
    name: def.name,
    ...(def.description ? { description: def.description } : {}),
    bundle: buildBundle(def),
  };
}

// --- Palettes ---------------------------------------------------------------

const PALETTES: Record<string, Palette> = {
  // === Light bucket ===
  slatePro: {
    backdrop: '#F8FAFC',
    canvas: '#FFFFFF',
    text: '#0F172A',
    link: '#2563EB',
    primary: '#0F172A',
    primaryText: '#FFFFFF',
    divider: '#E2E8F0',
    border: '#E2E8F0',
  },
  indigoTrust: {
    backdrop: '#F1F5F9',
    canvas: '#FFFFFF',
    text: '#0F172A',
    link: '#3730A3',
    primary: '#3730A3',
    primaryText: '#FFFFFF',
    divider: '#E2E8F0',
    border: '#C7D2FE',
  },
  mintFresh: {
    backdrop: '#F0FDFA',
    canvas: '#FFFFFF',
    text: '#134E4A',
    link: '#0D9488',
    primary: '#0D9488',
    primaryText: '#FFFFFF',
    divider: '#CCFBF1',
  },
  citrusRetail: {
    backdrop: '#FFFBEB',
    canvas: '#FFFFFF',
    text: '#1F2937',
    link: '#EA580C',
    primary: '#EA580C',
    primaryText: '#FFFFFF',
    divider: '#FED7AA',
  },
  pacificTravel: {
    backdrop: '#ECFEFF',
    canvas: '#FFFFFF',
    text: '#0E7490',
    link: '#0891B2',
    primary: '#0891B2',
    primaryText: '#FFFFFF',
    divider: '#A5F3FC',
  },
  creamEditorial: {
    backdrop: '#FAF7F2',
    canvas: '#FFFEF7',
    text: '#1F2937',
    link: '#92400E',
    primary: '#1F2937',
    primaryText: '#FFFEF7',
    divider: '#1F2937',
  },
  sageWellness: {
    backdrop: '#F4F7F2',
    canvas: '#FFFFFF',
    text: '#1F2937',
    link: '#4D7C0F',
    primary: '#4D7C0F',
    primaryText: '#FFFFFF',
    divider: '#D9E2D0',
  },
  coralStudio: {
    backdrop: '#FFF7F5',
    canvas: '#FFFFFF',
    text: '#1F2937',
    link: '#F97056',
    primary: '#1F2937',
    primaryText: '#FFFFFF',
    divider: '#FBD7CD',
  },
  lemonNotes: {
    backdrop: '#FFFBEB',
    canvas: '#FFFFFF',
    text: '#1C1917',
    link: '#A16207',
    primary: '#1C1917',
    primaryText: '#FEF3C7',
    divider: '#FEF3C7',
  },
  cloudKids: {
    backdrop: '#EFF6FF',
    canvas: '#FFFFFF',
    text: '#0F172A',
    link: '#2563EB',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    divider: '#DBEAFE',
  },

  // === Dark bucket ===
  onyxLuxe: {
    backdrop: '#0A0A0A',
    canvas: '#000000',
    text: '#F5F0E8',
    link: '#C9A84C',
    primary: '#C9A84C',
    primaryText: '#000000',
    divider: '#2A2A2A',
  },
  cyberTech: {
    backdrop: '#020617',
    canvas: '#0F172A',
    text: '#E2E8F0',
    link: '#22D3EE',
    primary: '#06B6D4',
    primaryText: '#020617',
    divider: '#1E293B',
  },
  neonStudio: {
    backdrop: '#050505',
    canvas: '#0A0A0A',
    text: '#F5F5F5',
    link: '#EC4899',
    primary: '#EC4899',
    primaryText: '#0A0A0A',
    divider: '#262626',
  },
  forestOutdoor: {
    backdrop: '#052E16',
    canvas: '#14532D',
    text: '#F0FDF4',
    link: '#FDE68A',
    primary: '#FDE68A',
    primaryText: '#14532D',
    divider: '#166534',
  },
  crimsonSports: {
    backdrop: '#1A1A1A',
    canvas: '#0F0F0F',
    text: '#F5F5F5',
    link: '#DC2626',
    primary: '#DC2626',
    primaryText: '#FFFFFF',
    divider: '#262626',
  },
  cryptoLime: {
    backdrop: '#0A0A0A',
    canvas: '#111111',
    text: '#F5F5F5',
    link: '#A3E635',
    primary: '#A3E635',
    primaryText: '#0A0A0A',
    divider: '#262626',
  },
  mulberryGalaxy: {
    backdrop: '#1E0B36',
    canvas: '#2D1B4E',
    text: '#F5F0FF',
    link: '#FBBF24',
    primary: '#EC4899',
    primaryText: '#FFFFFF',
    divider: '#4C1D95',
  },
  espressoBar: {
    backdrop: '#1C1410',
    canvas: '#2C1F18',
    text: '#FAF6F1',
    link: '#D4A574',
    primary: '#D4A574',
    primaryText: '#2C1F18',
    divider: '#3F2D22',
  },

  // === Pastel bucket ===
  pastelBakery: {
    backdrop: '#FFF1F2',
    canvas: '#FFF7F3',
    text: '#5C3A2E',
    link: '#BE5A38',
    primary: '#BE5A38',
    primaryText: '#FFF7F3',
    divider: '#F5D5C8',
  },
  skyWedding: {
    backdrop: '#F0F9FF',
    canvas: '#FFFFFF',
    text: '#1F2937',
    link: '#B45309',
    primary: '#B45309',
    primaryText: '#FFFFFF',
    divider: '#BAE6FD',
  },
  lavenderBeauty: {
    backdrop: '#F5F3FF',
    canvas: '#FFFFFF',
    text: '#3B0764',
    link: '#7C3AED',
    primary: '#7C3AED',
    primaryText: '#FFFFFF',
    divider: '#E9D5FF',
  },
  peachBoutique: {
    backdrop: '#FFF7ED',
    canvas: '#FFFAF5',
    text: '#3E2B23',
    link: '#C2410C',
    primary: '#C2410C',
    primaryText: '#FFFAF5',
    divider: '#FED7AA',
  },
  petalFloral: {
    backdrop: '#FFF1F2',
    canvas: '#FFFAFA',
    text: '#3F1D1D',
    link: '#9F1239',
    primary: '#9F1239',
    primaryText: '#FFFAFA',
    divider: '#FBCFE8',
  },
  vanillaSpa: {
    backdrop: '#FBF7F0',
    canvas: '#FFFEF9',
    text: '#3F2E1A',
    link: '#15803D',
    primary: '#15803D',
    primaryText: '#FFFEF9',
    divider: '#E7E5E4',
  },

  // === Vibrant bucket ===
  citrusFitness: {
    backdrop: '#0A0A0A',
    canvas: '#FFFFFF',
    text: '#0A0A0A',
    link: '#65A30D',
    primary: '#65A30D',
    primaryText: '#0A0A0A',
    divider: '#D9F99D',
  },
  tropicalResort: {
    backdrop: '#ECFEFF',
    canvas: '#FFFFFF',
    text: '#0F172A',
    link: '#0891B2',
    primary: '#F97316',
    primaryText: '#FFFFFF',
    divider: '#A5F3FC',
  },
  spicyRestaurant: {
    backdrop: '#FFFBEB',
    canvas: '#FFFFFF',
    text: '#3F2E1A',
    link: '#B91C1C',
    primary: '#B91C1C',
    primaryText: '#FFFFFF',
    divider: '#FED7AA',
  },
  royalEditorial: {
    backdrop: '#FFFFFF',
    canvas: '#FFFFFF',
    text: '#0A0A0A',
    link: '#1E40AF',
    primary: '#1E40AF',
    primaryText: '#FFFFFF',
    divider: '#0A0A0A',
  },
  verdantEco: {
    backdrop: '#F7FEE7',
    canvas: '#FFFFFF',
    text: '#1A2E05',
    link: '#15803D',
    primary: '#15803D',
    primaryText: '#FFFFFF',
    divider: '#D9F99D',
  },
  magentaPop: {
    backdrop: '#FFFFFF',
    canvas: '#FFFFFF',
    text: '#0A0A0A',
    link: '#DB2777',
    primary: '#DB2777',
    primaryText: '#FFFFFF',
    divider: '#FBCFE8',
  },
};

// --- 30 curated themes (Light → Dark → Pastel → Vibrant) -------------------

const THEMES: ThemeDef[] = [
  // === Light (10) ===
  {
    name: 'Slate Pro',
    description: 'Professional SaaS · pill CTAs',
    palette: PALETTES.slatePro,
    font: 'MODERN_SANS',
    radius: 8,
    buttonShape: 'pill',
  },
  {
    name: 'Indigo Trust',
    description: 'Fintech · sharp & confident',
    palette: PALETTES.indigoTrust,
    font: 'MODERN_SANS',
    radius: 4,
  },
  {
    name: 'Mint Fresh',
    description: 'Health & wellness',
    palette: PALETTES.mintFresh,
    font: 'OPEN_SANS',
    radius: 16,
    underline: false,
    buttonShape: 'pill',
  },
  {
    name: 'Citrus Retail',
    description: 'E-commerce / retail',
    palette: PALETTES.citrusRetail,
    font: 'MONTSERRAT',
    radius: 6,
    underline: false,
  },
  {
    name: 'Pacific Travel',
    description: 'Travel & cruise',
    palette: PALETTES.pacificTravel,
    font: 'MONTSERRAT',
    radius: 20,
    buttonShape: 'pill',
  },
  {
    name: 'Cream Editorial',
    description: 'Newsletter / publishing',
    palette: PALETTES.creamEditorial,
    font: 'MERRIWEATHER',
    radius: 0,
    buttonWeight: 'normal',
    notionFont: 'MERRIWEATHER',
  },
  {
    name: 'Sage Wellness',
    description: 'Yoga & spa',
    palette: PALETTES.sageWellness,
    font: 'MERRIWEATHER',
    radius: 28,
    underline: false,
    buttonShape: 'pill',
    buttonWeight: 'normal',
  },
  {
    name: 'Coral Studio',
    description: 'Creative agency',
    palette: PALETTES.coralStudio,
    font: 'OSWALD',
    radius: 8,
    notionFont: 'OSWALD',
  },
  {
    name: 'Lemon Notes',
    description: 'Personal blog / newsletter',
    palette: PALETTES.lemonNotes,
    font: 'MERRIWEATHER',
    radius: 4,
    buttonWeight: 'normal',
  },
  {
    name: 'Cloud Kids',
    description: 'Kids & edtech',
    palette: PALETTES.cloudKids,
    font: 'MODERN_SANS',
    radius: 16,
    underline: false,
    buttonShape: 'pill',
  },

  // === Dark (8) ===
  {
    name: 'Onyx Luxe',
    description: 'Luxury fashion · serif gold',
    palette: PALETTES.onyxLuxe,
    font: 'PLAYFAIR',
    radius: 0,
    notionFont: 'PLAYFAIR',
  },
  {
    name: 'Cyber Tech',
    description: 'DevOps & SaaS dev',
    palette: PALETTES.cyberTech,
    font: 'MODERN_SANS',
    radius: 4,
    underline: false,
  },
  {
    name: 'Neon Studio',
    description: 'Music & gaming',
    palette: PALETTES.neonStudio,
    font: 'OSWALD',
    radius: 4,
    underline: false,
    notionFont: 'OSWALD',
  },
  {
    name: 'Forest Outdoor',
    description: 'Outdoor brand',
    palette: PALETTES.forestOutdoor,
    font: 'MONTSERRAT',
    radius: 8,
  },
  {
    name: 'Crimson Sports',
    description: 'Sports & gym · sharp red',
    palette: PALETTES.crimsonSports,
    font: 'OSWALD',
    radius: 0,
    underline: false,
    notionFont: 'OSWALD',
  },
  {
    name: 'Crypto Lime',
    description: 'Web3 / crypto',
    palette: PALETTES.cryptoLime,
    font: 'MODERN_SANS',
    radius: 6,
    underline: false,
  },
  {
    name: 'Mulberry Galaxy',
    description: 'Music festival',
    palette: PALETTES.mulberryGalaxy,
    font: 'PACIFICO',
    radius: 12,
    buttonShape: 'pill',
  },
  {
    name: 'Espresso Bar',
    description: 'Specialty coffee',
    palette: PALETTES.espressoBar,
    font: 'MERRIWEATHER',
    radius: 4,
    buttonWeight: 'normal',
    notionFont: 'MERRIWEATHER',
  },

  // === Pastel (6) ===
  {
    name: 'Pastel Bakery',
    description: 'Bakery / cafe',
    palette: PALETTES.pastelBakery,
    font: 'MERRIWEATHER',
    radius: 16,
    buttonShape: 'pill',
    buttonWeight: 'normal',
    notionFont: 'MERRIWEATHER',
  },
  {
    name: 'Sky Wedding',
    description: 'Wedding & events',
    palette: PALETTES.skyWedding,
    font: 'PLAYFAIR',
    radius: 32,
    underline: false,
    buttonShape: 'pill',
    buttonWeight: 'normal',
    notionFont: 'PLAYFAIR',
  },
  {
    name: 'Lavender Beauty',
    description: 'Beauty & cosmetics',
    palette: PALETTES.lavenderBeauty,
    font: 'PACIFICO',
    radius: 16,
    buttonShape: 'pill',
  },
  {
    name: 'Peach Boutique',
    description: 'Boutique retail',
    palette: PALETTES.peachBoutique,
    font: 'MONTSERRAT',
    radius: 12,
    underline: false,
    buttonShape: 'pill',
    buttonWeight: 'normal',
  },
  {
    name: 'Petal Floral',
    description: 'Florist',
    palette: PALETTES.petalFloral,
    font: 'PLAYFAIR',
    radius: 24,
    buttonShape: 'pill',
    buttonWeight: 'normal',
    notionFont: 'PLAYFAIR',
  },
  {
    name: 'Vanilla Spa',
    description: 'Spa & wellness',
    palette: PALETTES.vanillaSpa,
    font: 'OPEN_SANS',
    radius: 20,
    underline: false,
    buttonShape: 'pill',
    buttonWeight: 'normal',
  },

  // === Vibrant (6) ===
  {
    name: 'Citrus Fitness',
    description: 'Fitness / gym · bold lime',
    palette: PALETTES.citrusFitness,
    font: 'OSWALD',
    radius: 4,
    underline: false,
    notionFont: 'OSWALD',
  },
  {
    name: 'Tropical Resort',
    description: 'Beach / resort',
    palette: PALETTES.tropicalResort,
    font: 'MONTSERRAT',
    radius: 12,
    buttonShape: 'pill',
  },
  {
    name: 'Spicy Restaurant',
    description: 'Restaurant',
    palette: PALETTES.spicyRestaurant,
    font: 'MERRIWEATHER',
    radius: 8,
  },
  {
    name: 'Royal Editorial',
    description: 'Premium news · serif',
    palette: PALETTES.royalEditorial,
    font: 'PLAYFAIR',
    radius: 0,
    buttonWeight: 'normal',
    notionFont: 'PLAYFAIR',
  },
  {
    name: 'Verdant Eco',
    description: 'Sustainability / nonprofit',
    palette: PALETTES.verdantEco,
    font: 'OPEN_SANS',
    radius: 24,
    buttonShape: 'pill',
  },
  {
    name: 'Magenta Pop',
    description: 'Music / youth',
    palette: PALETTES.magentaPop,
    font: 'OSWALD',
    radius: 6,
    underline: false,
    notionFont: 'OSWALD',
  },
];

// --- Runner ----------------------------------------------------------------

type SeedSummary = { total: number; saved: number; skipped: number; failed: number };

export async function seedThemes(options: { limit?: number; force?: boolean } = {}): Promise<SeedSummary> {
  const base = resolveBackendUrl();
  const list = options.limit ? THEMES.slice(0, options.limit) : THEMES;

  // Index existing themes by trimmed name. In force mode we delete the
  // matching file first (so the prebuilt overwrites older copies);
  // otherwise a matching name is skipped (idempotent seeding).
  const existing = new Map<string, { id: string }>();
  try {
    const r = await fetch(`${base}/dev/themes`);
    if (r.ok) {
      const { themes } = (await r.json()) as { themes: Array<{ id: string; name: string }> };
      for (const t of themes) existing.set(t.name.trim(), { id: t.id });
    }
  } catch {
    /* best-effort dedup */
  }

  const summary: SeedSummary = { total: list.length, saved: 0, skipped: 0, failed: 0 };
  console.info(`[seedThemes] seeding ${list.length} themes${options.force ? ' (force)' : ''}…`);

  for (const def of list) {
    const prev = existing.get(def.name.trim());
    if (prev && !options.force) {
      summary.skipped++;
      continue;
    }
    try {
      if (prev && options.force) {
        await fetch(`${base}/dev/themes/${encodeURIComponent(prev.id)}`, {
          method: 'DELETE',
        });
      }
      const res = await fetch(`${base}/dev/save-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(def)),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(`HTTP ${res.status} ${JSON.stringify(b)}`);
      }
      summary.saved++;
    } catch (err) {
      summary.failed++;
      console.warn(`[seedThemes] "${def.name}" failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.info('[seedThemes] done', summary);
  return summary;
}
