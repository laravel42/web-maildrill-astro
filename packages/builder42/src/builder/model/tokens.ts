/**
 * Design tokens — helpers puros (docs/08 §2-4).
 *
 * `StyleValue` (types.ts) ya admite `{ token: "colors.brand.primary" }` como
 * referencia a un token del sitio. Este módulo traduce esa referencia a CSS:
 *
 * - En el **export** y en el **canvas** una referencia se emite como
 *   `var(--colors-brand-primary)` (custom property nativa, sin runtime — P8).
 *   El navegador resuelve la variable; si no existe, hereda (token roto inocuo,
 *   docs/08 §7).
 * - La **definición** de los tokens (`site.meta.tokens` → `:root { --… }`) y el
 *   **token picker** del Inspector llegan en la fase de tokens (docs/08 §4-5),
 *   apoyados en el modelo de sitio (docs/06). Aquí solo se prepara el tipo y la
 *   serialización, que son independientes de ese modelo.
 *
 * `resolveStyle` NO usa esto: es token-agnóstico y propaga el `StyleValue` tal
 * cual (la conversión ocurre en el borde de serialización, canvas/export).
 */

import type { DesignTokens, StyleValue, TokenFontFamily, TokenGroupTree, ResponsiveTokenValue, BreakpointConfig, Breakpoint, OverrideBreakpoint } from "./types";
import { DEFAULT_BREAKPOINTS, isResponsiveTokenValue } from "./types";

/** Grupos de tokens "planos" (valor = string) editables por el CRUD (docs/08 §1). */
export type TokenGroup = "colors" | "spacing" | "radii" | "shadows" | "sizes";

/** Orden canónico de los grupos planos para recorrerlos en la UI. */
export const TOKEN_GROUPS: readonly TokenGroup[] = ["colors", "spacing", "radii", "shadows", "sizes"];

/** Subgrupos escalares de tipografía (valor = string), aparte de `families`. */
export type TypographyScalarGroup = "sizes" | "weights" | "lineHeights";

/** Orden canónico de los subgrupos escalares de tipografía. */
export const TYPOGRAPHY_SCALAR_GROUPS: readonly TypographyScalarGroup[] = [
  "sizes",
  "weights",
  "lineHeights",
];

/** ¿Es el valor una referencia a token (`{ token }`) y no un string crudo? */
export function isTokenRef(value: StyleValue): value is { token: string } {
  return typeof value === "object" && value !== null && "token" in value;
}

/**
 * Nombre de custom property para una clave de token jerárquica.
 * `"colors.brand.primary"` → `"--colors-brand-primary"` (docs/08 §4).
 */
export function cssVarName(tokenPath: string): string {
  return `--${tokenPath.replace(/\./g, "-")}`;
}

/** Referencia `var(--…)` para una clave de token. */
export function cssVarRef(tokenPath: string): string {
  return `var(${cssVarName(tokenPath)})`;
}

/**
 * ¿Es una clave de token válida? (docs/08 §7). Solo segmentos `[a-z0-9]`
 * separados por `.`; NO se admite `-` (evita colisión del mapeo `.`→`-` a
 * custom property). Ej. válidos: `sm`, `brand.primary`, `neutral.900`.
 */
export function isValidTokenKey(key: string): boolean {
  return /^[a-z0-9]+(\.[a-z0-9]+)*$/.test(key);
}

/**
 * Normaliza una entrada del usuario a una clave de token válida: minúsculas,
 * elimina caracteres no admitidos (incluido `-`), colapsa puntos y recorta los
 * de los bordes. Puede devolver "" si no queda nada válido (el caller valida).
 */
export function normalizeTokenKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Convierte un `StyleValue` a un string CSS listo para emitir (declaración de
 * export o estilo inline del canvas). Fuente única para ambos caminos, de modo
 * que canvas y export nunca divergen (P3).
 *
 * - `string`        → tal cual.
 * - `{ token }`     → `var(--token-path)`.
 * - `undefined`/`""`→ `undefined` (no declarado; hereda — docs/01 §7).
 */
export function styleValueToCss(value: StyleValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (isTokenRef(value)) return cssVarRef(value.token);
  return value === "" ? undefined : value;
}

/**
 * Aplana un árbol de tokens de un grupo a `subruta -> valor`, recurriendo en las
 * ramas (objetos) y tomando las hojas (strings). `{ surface: { default: "#fff",
 * alt: "#f9f9f9" } }` → `{ "surface.default": "#fff", "surface.alt": "#f9f9f9" }`.
 * Una clave-con-puntos y valor string (`{ "surface.default": "#fff" }`) es una
 * hoja y produce la MISMA subruta (retrocompat con la forma plana).
 */
export function flattenTree(node: TokenGroupTree): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (prefix: string, n: TokenGroupTree) => {
    for (const [k, v] of Object.entries(n)) {
      if (v === undefined || v === null) continue;
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out[key] = v;
      else walk(key, v);
    }
  };
  walk("", node);
  return out;
}

/** Valor base (string) de un `ResponsiveTokenValue`, sin overrides. */
export function baseValueOf(value: ResponsiveTokenValue): string {
  return isResponsiveTokenValue(value) ? value.base : value;
}

/**
 * Aplana un grupo escalar de tipografía responsive (`sizes`/`lineHeights`) a
 * `subruta -> valor BASE` (docs/49). El valor por breakpoint se resuelve
 * aparte en `tokensToCss` — este helper solo alimenta `flattenTokens`, que
 * sigue siendo `Record<string,string>` (retrocompat de sus consumidores:
 * pickers del Inspector, que listan rutas de token disponibles).
 */
function flattenResponsiveGroup(
  rec: Record<string, ResponsiveTokenValue> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rec) return out;
  for (const [k, v] of Object.entries(rec)) out[k] = baseValueOf(v);
  return out;
}

/**
 * Aplana `DesignTokens` a un mapa `tokenPath -> valor` (docs/08 §4). Las ramas
 * anidadas se recorren recursivamente (`flattenTree`), produciendo la ruta del
 * token que referencia un `{ token }` (`colors.surface.default`).
 *
 * Para `typography.sizes`/`lineHeights` (docs/49), un token responsive
 * (`{ base, overrides }`) se aplana a su valor `base` — mismo criterio que un
 * token de estilo de nodo sin breakpoint activo específico: quien necesite el
 * valor por breakpoint usa `tokensToCss` (que sí emite los `@media`) o
 * `resolveToken` con el parámetro `breakpoint`.
 */
export function flattenTokens(tokens: DesignTokens): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (prefix: string, rec?: TokenGroupTree) => {
    if (!rec) return;
    for (const [sub, val] of Object.entries(flattenTree(rec))) out[`${prefix}.${sub}`] = val;
  };
  put("colors", tokens.colors);
  put("spacing", tokens.spacing);
  put("radii", tokens.radii);
  put("shadows", tokens.shadows);
  put("sizes", tokens.sizes);
  const typo = tokens.typography;
  if (typo) {
    for (const [sub, val] of Object.entries(flattenResponsiveGroup(typo.sizes))) {
      out[`typography.sizes.${sub}`] = val;
    }
    put("typography.weights", typo.weights);
    for (const [sub, val] of Object.entries(flattenResponsiveGroup(typo.lineHeights))) {
      out[`typography.lineHeights.${sub}`] = val;
    }
    if (typo.families) {
      for (const [k, fam] of Object.entries(typo.families)) {
        out[`typography.families.${k}`] = fam.stack;
      }
    }
  }
  return out;
}

/**
 * Emite los tokens del sitio como CSS custom properties en `:root` (docs/08 §4).
 * Devuelve "" si no hay tokens. Es la MISMA fuente que resuelve las referencias
 * `var(--…)` en export y canvas (P3: cero divergencia).
 *
 * Tokens responsive (docs/49, `typography.sizes`/`lineHeights` con `overrides`
 * por breakpoint) — DOS modos, según si se pasa `activeBreakpoint`:
 *
 * - **Sin `activeBreakpoint` (export, `rootSelector = ":root"`):** la
 *   declaración BASE se emite sin `@media` y cada override se emite en un
 *   `@media (min-width: …)` propio, en orden ascendente, MISMO formato que
 *   `cssSerializer.serializeNodeCss` — el navegador REAL del visitante resuelve
 *   cuál `@media` gana según su viewport (docs/01 §5, "el export sí tiene un
 *   viewport real").
 * - **Con `activeBreakpoint` (canvas/miniatura de plantilla):** el
 *   `.pbx-canvas__frame`/`.pbx-template-card__preview` es un `<div>` de ancho
 *   fijo dentro de la ventana REAL del navegador del editor — un `@media
 *   (min-width)` se evaluaría contra esa ventana, NO contra el ancho lógico
 *   del breakpoint seleccionado (bug real: editar `xl` y volver a `base` no
 *   cambiaba el tamaño visible, porque el `@media` de `xl` seguía activo si la
 *   ventana del editor medía más de 1280px). Por eso se resuelve el valor
 *   EFECTIVO en JS para ESE breakpoint (mobile-first, mismo criterio que
 *   `resolveStyle` para `NodeStyle.overrides` — docs/01 §2) y se emite como un
 *   único valor plano sin `@media`, igual que un token no-responsive.
 *
 * En ambos modos la custom property es la MISMA (`--typography-sizes-h1`); lo
 * que cambia es solo CÓMO se resuelve el valor — cero cambios en
 * `cssSerializer.ts` ni en ningún `ComponentDefinition` (P8/P3).
 */
export function tokensToCss(
  tokens: DesignTokens | undefined,
  rootSelector = ":root",
  cfg: BreakpointConfig = DEFAULT_BREAKPOINTS,
  activeBreakpoint?: Breakpoint,
): string {
  if (!tokens) return "";
  const flat = activeBreakpoint
    ? flattenTokensAt(tokens, activeBreakpoint, cfg)
    : flattenTokens(tokens);
  const entries = Object.entries(flat);
  if (entries.length === 0) return "";
  const decls = entries.map(([path, value]) => `  ${cssVarName(path)}: ${value};`);
  const blocks = [`${rootSelector} {\n${decls.join("\n")}\n}`];

  // Canvas/miniatura (`activeBreakpoint` presente): el valor ya quedó resuelto
  // arriba vía `flattenTokensAt` — nunca se emite un `@media` (no hay viewport
  // real que lo dispare correctamente en ese contexto).
  if (activeBreakpoint) return blocks.join("\n\n");

  // Export (`rootSelector` es lo que ve un navegador real): @media por
  // breakpoint (mobile-first, orden ascendente — mismo criterio que
  // cssSerializer.ts): junta los overrides de sizes/lineHeights que caen
  // en ESE breakpoint, un solo bloque de :root por @media (no uno por token).
  const typo = tokens.typography;
  if (typo) {
    const responsiveGroups: Array<["sizes" | "lineHeights", Record<string, ResponsiveTokenValue> | undefined]> = [
      ["sizes", typo.sizes],
      ["lineHeights", typo.lineHeights],
    ];
    for (const bp of cfg.order) {
      if (bp === "base") continue;
      const minWidth = cfg.minWidth[bp];
      const bpDecls: string[] = [];
      for (const [sub, rec] of responsiveGroups) {
        if (!rec) continue;
        for (const [key, value] of Object.entries(rec)) {
          if (!isResponsiveTokenValue(value)) continue;
          const override = value.overrides?.[bp];
          if (override === undefined) continue;
          bpDecls.push(`  ${cssVarName(`typography.${sub}.${key}`)}: ${override};`);
        }
      }
      if (bpDecls.length > 0) {
        blocks.push(`@media (min-width: ${minWidth}px) {\n${rootSelector} {\n${bpDecls.join("\n")}\n}\n}`);
      }
    }
  }

  return blocks.join("\n\n");
}

/**
 * Como `flattenTokens`, pero resuelve `typography.sizes`/`lineHeights`
 * responsive (docs/49) al valor EFECTIVO en `active` (mobile-first, sin
 * `@media`) en vez de al valor `base`. Para los demás grupos (no responsive)
 * es idéntico a `flattenTokens`. Usado por `tokensToCss` en modo canvas.
 */
function flattenTokensAt(
  tokens: DesignTokens,
  active: Breakpoint,
  cfg: BreakpointConfig,
): Record<string, string> {
  const out = flattenTokens(tokens);
  const typo = tokens.typography;
  if (!typo) return out;
  const responsiveGroups: Array<["sizes" | "lineHeights", Record<string, ResponsiveTokenValue> | undefined]> = [
    ["sizes", typo.sizes],
    ["lineHeights", typo.lineHeights],
  ];
  for (const [sub, rec] of responsiveGroups) {
    if (!rec) continue;
    for (const [key, value] of Object.entries(rec)) {
      out[`typography.${sub}.${key}`] = resolveResponsiveTokenAt(value, active, cfg);
    }
  }
  return out;
}

/**
 * Resuelve un `ResponsiveTokenValue` en `active`, mobile-first: el override
 * propio de ese breakpoint si existe, si no el del breakpoint anterior más
 * cercano con override declarado, si no `base` — mismo criterio de cascada
 * que `resolveStyle` para `NodeStyle.overrides`. Un valor `string` plano
 * (no-responsive) se devuelve tal cual en cualquier breakpoint.
 */
function resolveResponsiveTokenAt(
  value: ResponsiveTokenValue,
  active: Breakpoint,
  cfg: BreakpointConfig,
): string {
  if (!isResponsiveTokenValue(value)) return value;
  if (active === "base") return value.base;
  const idx = cfg.order.indexOf(active);
  for (let i = idx; i >= 0; i--) {
    const bp = cfg.order[i];
    if (bp === undefined) continue;
    if (bp === "base") return value.base;
    const override = value.overrides?.[bp];
    if (override !== undefined) return override;
  }
  return value.base;
}

/**
 * Resuelve la ruta de un token a su valor crudo (o undefined si no existe —
 * token roto, docs/08 §7). Útil para el Inspector (mostrar el valor real).
 *
 * Si se pasa `breakpoint` y el token resuelto es responsive (docs/49), se
 * resuelve mobile-first: el valor del breakpoint pedido si tiene override
 * propio, o el del breakpoint anterior más cercano con override, o `base` —
 * mismo criterio de cascada que `resolveStyle` para `NodeStyle.overrides`.
 * Sin `breakpoint` (u omitido), devuelve el valor `base`.
 */
export function resolveToken(
  tokens: DesignTokens | undefined,
  tokenPath: string,
  breakpoint?: Breakpoint,
  cfg: BreakpointConfig = DEFAULT_BREAKPOINTS,
): string | undefined {
  if (!tokens) return undefined;
  if (breakpoint && breakpoint !== "base") {
    const responsive = responsiveTokenAt(tokens, tokenPath);
    if (responsive) return resolveResponsiveAt(responsive, breakpoint, cfg);
  }
  return flattenTokens(tokens)[tokenPath];
}

/** Si `tokenPath` es `typography.sizes.*`/`typography.lineHeights.*`, devuelve su `ResponsiveTokenValue` crudo. */
function responsiveTokenAt(tokens: DesignTokens, tokenPath: string): ResponsiveTokenValue | undefined {
  const typo = tokens.typography;
  if (!typo) return undefined;
  if (tokenPath.startsWith("typography.sizes.")) {
    return typo.sizes?.[tokenPath.slice("typography.sizes.".length)];
  }
  if (tokenPath.startsWith("typography.lineHeights.")) {
    return typo.lineHeights?.[tokenPath.slice("typography.lineHeights.".length)];
  }
  return undefined;
}

/**
 * Resuelve un `ResponsiveTokenValue` en un breakpoint no-`base`, mobile-first
 * (docs/49): el override propio de ese breakpoint si existe, si no el del
 * breakpoint anterior más cercano con override declarado, si no `base` —
 * mismo criterio de cascada que `resolveStyle` para `NodeStyle.overrides`.
 */
function resolveResponsiveAt(
  value: ResponsiveTokenValue,
  breakpoint: OverrideBreakpoint,
  cfg: BreakpointConfig,
): string {
  if (!isResponsiveTokenValue(value)) return value;
  const idx = cfg.order.indexOf(breakpoint);
  for (let i = idx; i >= 0; i--) {
    const bp = cfg.order[i];
    if (bp === undefined) continue;
    if (bp === "base") return value.base;
    const override = value.overrides?.[bp];
    if (override !== undefined) return override;
  }
  return value.base;
}

// ---------------------------------------------------------------------------
// Tokens semánticos base (AGENTS-COMPONENTS.md §2)
// ---------------------------------------------------------------------------

/**
 * Tokens semánticos base que todo sitio incluye por defecto. El usuario puede
 * editar sus VALORES (cambiar `#ffffff` por `#f8f9fa`), pero NO puede eliminar
 * las CLAVES — protegen la retrocompatibilidad y garantizan que los
 * componentes nuevos (que referencian estos tokens en su `defaultStyle`)
 * funcionen out-of-the-box.
 *
 * Las claves siguen la convención semántica (qué representan) en vez de
 * primitiva (qué color son). Así un theme system futuro (Fase 9) remapea
 * semánticos sin tocar componentes.
 */
export const BASE_TOKENS: DesignTokens = {
  colors: {
    surface: { default: "#ffffff", alt: "#f9fafb" },
    text: "#1a1a1a",
    border: "#e2e8f0",
    primary: { default: "#2563eb", on: "#ffffff" },
    muted: "#6b7280",
    error: { default: "#dc2626", surface: "#fef2f2" },
    success: "#16a34a",
    // Banda enfática (docs/48 §3.2): fondo oscuro de una sección a sangre y el
    // color de texto que va ENCIMA. Existen como par semántico propio porque la
    // convención anterior (docs/43 §3) usaba `colors.text` como fondo de banda:
    // con un tema de `colorScheme: "dark"` ese token es CLARO, así que la banda
    // "oscura" salía clara y la guarda de contraste dejaba de detectar nada. Un
    // tema remapea `band.dark`/`band.on` de forma independiente al par
    // `text`/`surface`, y la banda sigue siendo oscura en cualquier tema.
    band: { dark: "#1a1a1a", on: "#ffffff" },
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
  },
  radii: {
    sm: "4px",
    md: "8px",
    lg: "16px",
  },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
  },
  sizes: {
    container: "1200px",
  },
  typography: {
    families: {
      sans: {
        stack: "Inter, system-ui, sans-serif",
        webFont: { provider: "google", family: "Inter", weights: ["400", "600", "700"] },
      },
    },
    sizes: {
      sm: "14px",
      base: "16px",
      lg: "20px",
    },
    weights: {
      regular: "400",
      bold: "700",
    },
    lineHeights: {
      tight: "1.25",
      normal: "1.5",
    },
  },
};

/**
 * Set de claves (paths) de tokens base — para consulta rápida O(1).
 * Incluye todas las rutas de `BASE_TOKENS` (`colors.surface`, `spacing.sm`,
 * `typography.families.sans`, etc.).
 */
export const BASE_TOKEN_PATHS: ReadonlySet<string> = new Set(
  Object.keys(flattenTokens(BASE_TOKENS)),
);

/**
 * ¿Es un token base (protegido contra borrado)?
 * `group` + `key` se combinan en la ruta canónica (`colors.surface`, etc.).
 */
export function isBaseToken(group: string, key: string): boolean {
  return BASE_TOKEN_PATHS.has(`${group}.${key}`);
}

/**
 * Merge profundo de dos árboles de tokens: las ramas (objetos) se combinan
 * recursivamente; las hojas del usuario ganan sobre las base.
 */
function deepMergeTree(base: TokenGroupTree, user: TokenGroupTree): TokenGroupTree {
  const out: TokenGroupTree = { ...base };
  for (const [k, v] of Object.entries(user)) {
    const b = out[k];
    if (v && typeof v === "object" && b && typeof b === "object") {
      out[k] = deepMergeTree(b, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Combina los tokens base con tokens del usuario (merge profundo): las claves
 * base siempre existen (con el valor que el usuario haya puesto, o el default);
 * las claves extra del usuario se preservan.
 */
export function mergeWithBaseTokens(userTokens: DesignTokens | undefined): DesignTokens {
  const base = structuredClone(BASE_TOKENS);
  if (!userTokens) return base;

  // Merge grupos planos (con soporte de ramas anidadas — deep merge).
  for (const group of TOKEN_GROUPS) {
    const baseRec = (base[group] ?? {}) as TokenGroupTree;
    const userRec = (userTokens[group] ?? {}) as TokenGroupTree;
    (base as Record<string, unknown>)[group] = deepMergeTree(baseRec, userRec);
  }

  // Merge tipografía
  const baseTypo = base.typography!;
  const userTypo = userTokens.typography;
  if (userTypo) {
    if (userTypo.sizes) baseTypo.sizes = { ...baseTypo.sizes, ...userTypo.sizes };
    if (userTypo.weights) baseTypo.weights = { ...baseTypo.weights, ...userTypo.weights };
    if (userTypo.lineHeights) baseTypo.lineHeights = { ...baseTypo.lineHeights, ...userTypo.lineHeights };
    if (userTypo.families) baseTypo.families = { ...baseTypo.families, ...userTypo.families };
  }

  return base;
}

/**
 * URL de la hoja de estilos de Google Fonts para UNA familia-token
 * (docs/40 §2.2). Fuente compartida con `export/usage.ts` (`fontLinks`, que
 * combina varias familias en un solo `<link>` para el sitio exportado) — aquí
 * se expone la construcción de una sola familia para el preview del chrome
 * (`FamilyRow` en `TokensEditor`), que no depende de qué nodos referencian el
 * token (a diferencia del export, que solo carga fuentes REALMENTE usadas).
 * Devuelve `undefined` si la familia no tiene `webFont` de Google.
 */
export function googleFontHref(family: TokenFontFamily): string | undefined {
  const web = family.webFont;
  if (!web || web.provider !== "google" || !web.family) return undefined;
  const weights = web.weights?.length ? `:wght@${web.weights.join(";")}` : "";
  const spec = `family=${web.family.replace(/ /g, "+")}${weights}`;
  return `https://fonts.googleapis.com/css2?${spec}&display=swap`;
}
