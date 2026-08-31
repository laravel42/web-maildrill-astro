/**
 * Theme system — resolución pura (docs/11 §2-3, Fase 9.1).
 *
 * Un **token** es un valor de diseño (docs/08). Un **tema** es un conjunto
 * nombrado de valores de token que se puede intercambiar (`Theme` en types.ts).
 * Este módulo calcula, de forma pura y testeable (P7, sin React/DOM):
 *
 *  1. La **cadena de temas efectiva** resolviendo `extends` (base → hoja), con
 *     guarda de ciclos.
 *  2. El **mapa de tokens efectivo** del tema activo: los tokens base del sitio
 *     (`site.meta.tokens`) superpuestos con los deltas de la cadena de temas.
 *  3. La **resolución de una ruta de token a su valor concreto**, siguiendo
 *     referencias encadenadas (`semántico → primitivo → valor`) con guarda de
 *     ciclos; una referencia rota o cíclica resuelve a `undefined` (token roto
 *     inocuo, mismo criterio que docs/08 §7).
 *
 * Nota de arquitectura (por qué NO se toca `resolveStyle`): en el diseño
 * implementado (docs/08 §3) `resolveStyle` es **token-agnóstico** y la
 * conversión de `{ token }` a CSS ocurre en el **borde de serialización**
 * (`styleValueToCss`/`tokensToCss` en canvas y export). El tema encaja en ese
 * mismo borde: el canvas (`TokensStyle`) y el export emiten el mapa efectivo
 * del tema como `:root { --… }` (o bloques `[data-theme]`, docs/11 §4), y los
 * componentes siguen emitiendo `var(--…)` sin cambiar (P3/P8). Por eso aquí se
 * expone la resolución del mapa efectivo, no una nueva firma de `resolveStyle`.
 */

import type {
  BuilderPage,
  BuilderSite,
  DesignTokens,
  StyleValue,
  Theme,
  ThemeId,
} from "./types";
import { flattenTokens, isTokenRef, cssVarName } from "./tokens";

/**
 * Genera un `ThemeId` único (`theme-1`, `theme-2`, …) que no colisione con los
 * temas existentes. Puro.
 */
export function uniqueThemeId(themes: Record<ThemeId, Theme> | undefined): ThemeId {
  const existing = themes ?? {};
  let n = 1;
  let id = `theme-${n}`;
  while (id in existing) {
    n += 1;
    id = `theme-${n}`;
  }
  return id;
}

/**
 * Cadena de temas efectiva para `themeId`, de **base → hoja** (el tema pedido
 * es el último, de modo que superponer en este orden hace ganar sus deltas).
 * Resuelve `extends` con guarda de ciclos: una referencia rota o un ciclo
 * cortan la cadena (no lanza). `undefined`/tema inexistente → `[]`.
 */
export function resolveThemeChain(
  themes: Record<ThemeId, Theme> | undefined,
  themeId: ThemeId | undefined,
): Theme[] {
  if (!themes || !themeId) return [];
  const chainLeafFirst: Theme[] = [];
  const seen = new Set<ThemeId>();
  let current: ThemeId | undefined = themeId;
  while (current) {
    if (seen.has(current)) break; // ciclo en `extends`
    const theme: Theme | undefined = themes[current];
    if (!theme) break; // referencia rota a un tema inexistente
    seen.add(current);
    chainLeafFirst.push(theme);
    current = theme.extends;
  }
  return chainLeafFirst.reverse(); // base → hoja
}

/**
 * Tema efectivo de una página (docs/11 §2): `page.meta.themeId` si está, si no
 * el `site.meta.defaultThemeId`. `undefined` = el sitio no usa temas.
 */
export function effectiveThemeId(
  site: BuilderSite,
  page?: BuilderPage,
): ThemeId | undefined {
  return page?.meta.themeId ?? site.meta.defaultThemeId;
}

/**
 * Mapa de tokens efectivo (`rutaDeToken → StyleValue`) del tema activo: parte
 * de los tokens base del sitio (aplanados) y superpone, en orden base→hoja, los
 * `tokens` de cada tema de la cadena. El valor puede seguir siendo una
 * referencia `{ token }` (aún sin resolver a concreto — ver `resolveTokenValue`).
 */
export function effectiveThemeTokens(
  baseTokens: DesignTokens | undefined,
  themes: Record<ThemeId, Theme> | undefined,
  themeId: ThemeId | undefined,
): Record<string, StyleValue> {
  const map: Record<string, StyleValue> = {};
  if (baseTokens) Object.assign(map, flattenTokens(baseTokens));
  for (const theme of resolveThemeChain(themes, themeId)) {
    for (const [path, value] of Object.entries(theme.tokens)) {
      if (value !== undefined) map[path] = value;
    }
  }
  return map;
}

/**
 * Resuelve la ruta de un token a su **valor concreto** (string), siguiendo
 * referencias encadenadas (`semántico → primitivo → …`) con guarda de ciclos.
 *
 * - Valor string no vacío → ese valor.
 * - Valor `""` → `undefined` (no declarado; hereda, docs/01 §7).
 * - `{ token }` → resuelve recursivamente el token apuntado.
 * - Ruta inexistente, referencia rota o **ciclo** → `undefined` (token roto
 *   inocuo, docs/08 §7). Nunca entra en bucle infinito.
 */
export function resolveTokenValue(
  tokens: Record<string, StyleValue>,
  path: string,
  seen: ReadonlySet<string> = new Set(),
): string | undefined {
  const value = tokens[path];
  if (value === undefined) return undefined;
  if (isTokenRef(value)) {
    if (seen.has(path)) return undefined; // ciclo de referencias de token
    return resolveTokenValue(tokens, value.token, new Set(seen).add(path));
  }
  return value === "" ? undefined : value;
}

/**
 * Aplana un mapa de tokens efectivo a `rutaDeToken → valorConcreto`, resolviendo
 * cada referencia con `resolveTokenValue`. Las rutas cuyo valor no se puede
 * resolver (rotas/cíclicas/vacías) se **omiten** (el navegador hereda). Es lo
 * que se emitirá como custom properties en `:root`/`[data-theme]` (docs/11 §4).
 */
export function resolvedTokenMap(
  tokens: Record<string, StyleValue>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of Object.keys(tokens)) {
    const resolved = resolveTokenValue(tokens, path);
    if (resolved !== undefined) out[path] = resolved;
  }
  return out;
}

/**
 * Atajo: mapa de tokens **resuelto a valores concretos** del tema activo,
 * combinando `effectiveThemeTokens` + `resolvedTokenMap`. Es la fuente única
 * que consumirán canvas y export para emitir las custom properties del tema.
 */
export function effectiveResolvedTokens(
  baseTokens: DesignTokens | undefined,
  themes: Record<ThemeId, Theme> | undefined,
  themeId: ThemeId | undefined,
): Record<string, string> {
  return resolvedTokenMap(effectiveThemeTokens(baseTokens, themes, themeId));
}

/**
 * Declaraciones CSS (custom properties + `color-scheme`) del mapa efectivo
 * resuelto de un tema. Devuelve `[]` si el tema no aporta nada.
 */
function themeDeclarations(
  baseTokens: DesignTokens | undefined,
  themes: Record<ThemeId, Theme> | undefined,
  id: ThemeId,
): string[] {
  const resolved = effectiveResolvedTokens(baseTokens, themes, id);
  const decls = Object.entries(resolved).map(
    ([path, value]) => `  ${cssVarName(path)}: ${value};`,
  );
  const scheme = themes?.[id]?.colorScheme;
  if (scheme) decls.push(`  color-scheme: ${scheme};`);
  return decls;
}

/**
 * Serializa los temas del sitio a CSS custom properties (docs/11 §4, Fases
 * 9.2/9.4). Orden (importa para la cascada):
 *
 * 1. `:root { … }` — tema por defecto (baseline; aplica sin `data-theme`).
 * 2. `@media (prefers-color-scheme: …) { :root { … } }` — **claro/oscuro
 *    automático sin JS** (9.4): si el default es claro (o sin pista) y existe un
 *    tema `dark`, se aplica ese tema al `:root` cuando el SO prefiere oscuro (y
 *    viceversa). Se emite ANTES de los bloques `[data-theme]` para que una
 *    elección explícita del usuario gane por orden de fuente.
 * 3. `[data-theme="<id>"] { … }` — un bloque por tema (todos), que el
 *    `<html data-theme="…">` de cada página o el toggle en runtime seleccionan.
 *    Al ir al final, una elección explícita SIEMPRE gana sobre el media query.
 *
 * `color-scheme: light|dark` se añade al bloque del tema que lo declare (mejora
 * controles nativos/scrollbars sin JS). Devuelve "" si el sitio no tiene temas
 * (retrocompat). Función pura (P7), MISMA fuente para canvas y export (P3).
 */
export function themesToCss(
  baseTokens: DesignTokens | undefined,
  themes: Record<ThemeId, Theme> | undefined,
  defaultThemeId: ThemeId | undefined,
  opts: { rootSelector?: string; includePrefersColorScheme?: boolean } = {},
): string {
  if (!themes) return "";
  const ids = Object.keys(themes);
  if (ids.length === 0) return "";

  const rootSelector = opts.rootSelector ?? ":root";
  const includePrefers = opts.includePrefersColorScheme ?? true;
  const scoped = rootSelector !== ":root";
  // Selector de un tema: en el output (`:root`) los bloques son `[data-theme]`
  // globales (el `<html data-theme>` los activa); en el editor van scopeados al
  // frame (`.pbx-canvas__frame[data-theme]`) para NO filtrar al chrome (aislamiento).
  const themeSelector = (id: string): string =>
    scoped ? `${rootSelector}[data-theme="${id}"]` : `[data-theme="${id}"]`;

  const blocks: string[] = [];

  // 1. Baseline: el tema por defecto en el selector raíz.
  if (defaultThemeId && themes[defaultThemeId]) {
    const decls = themeDeclarations(baseTokens, themes, defaultThemeId);
    if (decls.length > 0) blocks.push(`${rootSelector} {\n${decls.join("\n")}\n}`);
  }

  // 2. Auto claro/oscuro (docs/11 §4): esquema opuesto al del default. Se omite
  //    en el editor (preview manual por `activeThemeId`, no por el SO).
  if (includePrefers) {
    const defaultScheme = defaultThemeId ? themes[defaultThemeId]?.colorScheme : undefined;
    const autoScheme = defaultScheme === "dark" ? "light" : "dark";
    const autoId = ids.find(
      (id) => id !== defaultThemeId && themes[id]?.colorScheme === autoScheme,
    );
    if (autoId) {
      const decls = themeDeclarations(baseTokens, themes, autoId);
      if (decls.length > 0) {
        const inner = decls.map((d) => `  ${d}`).join("\n");
        blocks.push(
          `@media (prefers-color-scheme: ${autoScheme}) {\n  ${rootSelector} {\n${inner}\n  }\n}`,
        );
      }
    }
  }

  // 3. Cada tema scopeado por [data-theme] (la elección explícita gana).
  for (const id of ids) {
    const decls = themeDeclarations(baseTokens, themes, id);
    if (decls.length === 0) continue;
    blocks.push(`${themeSelector(id)} {\n${decls.join("\n")}\n}`);
  }

  return blocks.join("\n\n");
}
