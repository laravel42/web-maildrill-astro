/**
 * Validación de schema del sitio (Fase 4, docs/04 §Fase 4 · docs/06 §8).
 *
 * Función PURA (P7): valida un valor desconocido (típicamente el resultado de
 * `JSON.parse`) contra la forma de `BuilderSite`, acumulando errores con su
 * ruta. No lanza; devuelve un resultado discriminado para que la UI muestre los
 * problemas y la carga sea segura. Se testea sin DOM ni React (AGENTS §6).
 *
 * No se usa Zod a propósito: el roadmap admite "Zod o similar" y la capa
 * `model/` se mantiene sin dependencias (coherente con P8). El validador cubre
 * los invariantes que importan para no corromper el store al cargar:
 *  - estructura de `meta` (breakpoints, version…),
 *  - páginas normalizadas coherentes con `pageOrder`/`homePageId`,
 *  - cada documento con `rootId ∈ nodes` y nodos bien formados,
 *  - assets opcionales bien formados.
 */

import type { Breakpoint, BuilderSite, OverrideBreakpoint } from "./types";
import type { NodeFragment } from "./tree";
import { getDefinition } from "../registry/componentRegistry";
import { canPlaceChild } from "../registry/placement";
import type { ComponentDefinition } from "../registry/types";
import { resolveOptions } from "../registry/types";

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const BREAKPOINTS: readonly Breakpoint[] = ["base", "sm", "md", "lg", "xl"];
const OVERRIDE_BREAKPOINTS: readonly OverrideBreakpoint[] = ["sm", "md", "lg", "xl"];

// ---------------------------------------------------------------------------
// Colector de errores con ruta
// ---------------------------------------------------------------------------

class Errors {
  readonly list: string[] = [];
  push(path: string, message: string): void {
    this.list.push(`${path}: ${message}`);
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// ---------------------------------------------------------------------------
// Validadores de piezas
// ---------------------------------------------------------------------------

function validateBreakpoints(v: unknown, path: string, e: Errors): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto BreakpointConfig");
    return;
  }
  if (!Array.isArray(v.order) || !v.order.every((b) => isString(b) && (BREAKPOINTS as string[]).includes(b))) {
    e.push(`${path}.order`, "debe ser un array de breakpoints válidos");
  }
  if (!isObject(v.minWidth)) {
    e.push(`${path}.minWidth`, "debe ser un objeto { sm, md, lg, xl }");
  } else {
    for (const bp of OVERRIDE_BREAKPOINTS) {
      if (!isNumber(v.minWidth[bp])) {
        e.push(`${path}.minWidth.${bp}`, "debe ser un número (px)");
      }
    }
  }
}

function validateSiteMeta(v: unknown, path: string, e: Errors): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto SiteMeta");
    return;
  }
  if (!isString(v.name)) e.push(`${path}.name`, "debe ser string");
  if (!isString(v.defaultLang)) e.push(`${path}.defaultLang`, "debe ser string");
  if (!isNumber(v.version)) e.push(`${path}.version`, "debe ser número");
  // `siteId` (docs/36 B1/F2): opcional, ausente = nunca publicado (retrocompat).
  if (v.siteId !== undefined && !isString(v.siteId)) {
    e.push(`${path}.siteId`, "debe ser string si está presente");
  }
  validateBreakpoints(v.breakpoints, `${path}.breakpoints`, e);
  if (v.i18n !== undefined) validateI18nConfig(v.i18n, `${path}.i18n`, e);
  validateThemes(v.themes, v.defaultThemeId, `${path}`, e);
}

/**
 * Temas del sitio (docs/11 §2). `undefined` = sin sistema de temas (retrocompat).
 * Valida la forma de cada `Theme` y que `defaultThemeId`/`extends` (si están)
 * apunten a temas existentes. No resuelve ciclos aquí (eso es tolerante en
 * runtime, `model/theme.ts`); solo cubre lo que evita corromper el store.
 */
function validateThemes(
  themes: unknown,
  defaultThemeId: unknown,
  path: string,
  e: Errors,
): void {
  if (themes === undefined) {
    if (defaultThemeId !== undefined) {
      e.push(`${path}.defaultThemeId`, "definido pero no hay `themes`");
    }
    return;
  }
  if (!isObject(themes)) {
    e.push(`${path}.themes`, "debe ser un Record<ThemeId, Theme>");
    return;
  }
  const ids = Object.keys(themes);
  for (const id of ids) {
    const tp = `${path}.themes.${id}`;
    const theme: unknown = themes[id];
    if (!isObject(theme)) {
      e.push(tp, "debe ser un objeto Theme");
      continue;
    }
    if (!isString(theme.id)) e.push(`${tp}.id`, "debe ser string");
    if (!isString(theme.name)) e.push(`${tp}.name`, "debe ser string");
    if (theme.tokens !== undefined && !isObject(theme.tokens)) {
      e.push(`${tp}.tokens`, "debe ser un objeto Partial<Record<token, StyleValue>>");
    }
    if (theme.extends !== undefined) {
      if (!isString(theme.extends)) {
        e.push(`${tp}.extends`, "debe ser un ThemeId (string)");
      } else if (!(theme.extends in themes)) {
        e.push(`${tp}.extends`, `"${theme.extends}" no existe en themes`);
      }
    }
    if (
      theme.colorScheme !== undefined &&
      theme.colorScheme !== "light" &&
      theme.colorScheme !== "dark"
    ) {
      e.push(`${tp}.colorScheme`, 'debe ser "light" o "dark"');
    }
  }
  if (defaultThemeId !== undefined) {
    if (!isString(defaultThemeId)) {
      e.push(`${path}.defaultThemeId`, "debe ser string");
    } else if (!(defaultThemeId in themes)) {
      e.push(`${path}.defaultThemeId`, `"${defaultThemeId}" no existe en themes`);
    }
  }
}

/**
 * Config de idiomas del sitio (docs/12 §B.4). `undefined` = sitio monolingüe;
 * no se valida nada (retrocompat).
 */
function validateI18nConfig(v: unknown, path: string, e: Errors): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto I18nConfig");
    return;
  }
  let locales: string[] = [];
  if (!Array.isArray(v.locales) || !v.locales.every(isString) || v.locales.length === 0) {
    e.push(`${path}.locales`, "debe ser un array de idiomas (string) no vacío");
  } else {
    locales = v.locales;
  }
  if (!isString(v.defaultLocale)) {
    e.push(`${path}.defaultLocale`, "debe ser string");
  } else if (locales.length > 0 && !locales.includes(v.defaultLocale)) {
    e.push(`${path}.defaultLocale`, `"${v.defaultLocale}" debe estar en locales`);
  }
  if (v.routeStrategy !== "prefix-except-default" && v.routeStrategy !== "prefix-all") {
    e.push(`${path}.routeStrategy`, 'debe ser "prefix-except-default" o "prefix-all"');
  }
}

/**
 * Valida `page.translations` contra los `locales` configurados y los nodos
 * reales del documento de la página (docs/12 §B.4, §B.10). Si `locales` está
 * vacío (i18n mal formado o ausente) solo se valida la forma estructural, sin
 * chequear pertenencia a un conjunto de idiomas.
 */
function validateTranslations(
  v: unknown,
  path: string,
  e: Errors,
  nodeIds: ReadonlySet<string>,
  locales: readonly string[],
): void {
  if (v === undefined) return;
  if (!isObject(v)) {
    e.push(path, "debe ser un Record<NodeId, NodeTranslations>");
    return;
  }
  for (const nodeId of Object.keys(v)) {
    const np = `${path}.${nodeId}`;
    if (!nodeIds.has(nodeId)) {
      e.push(np, `referencia un nodo inexistente "${nodeId}"`);
      continue;
    }
    const nodeT = v[nodeId];
    if (!isObject(nodeT)) {
      e.push(np, "debe ser un objeto NodeTranslations (Record<locale, props>)");
      continue;
    }
    for (const locale of Object.keys(nodeT)) {
      if (locales.length > 0 && !locales.includes(locale)) {
        e.push(`${np}.${locale}`, `idioma "${locale}" no está en site.meta.i18n.locales`);
      }
      if (!isObject(nodeT[locale])) {
        e.push(`${np}.${locale}`, "debe ser un objeto de props traducidas");
      }
    }
  }
}

function validateNode(v: unknown, path: string, e: Errors): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto BuilderNode");
    return;
  }
  if (!isString(v.id)) e.push(`${path}.id`, "debe ser string");
  if (!isString(v.type)) e.push(`${path}.type`, "debe ser string");
  if (!isObject(v.props)) e.push(`${path}.props`, "debe ser un objeto");
  if (!isObject(v.style)) {
    e.push(`${path}.style`, "debe ser un objeto NodeStyle");
  } else if (!isObject(v.style.base)) {
    e.push(`${path}.style.base`, "debe ser un objeto StyleProperties");
  }
  if (v.children !== undefined) {
    if (!Array.isArray(v.children) || !v.children.every(isString)) {
      e.push(`${path}.children`, "debe ser un array de NodeId (string)");
    }
  }
  if (v.behaviors !== undefined) {
    if (!Array.isArray(v.behaviors)) {
      e.push(`${path}.behaviors`, "debe ser un array de BehaviorInstance");
    } else {
      v.behaviors.forEach((b: unknown, i: number) => {
        if (!isObject(b) || !isString(b.type)) {
          e.push(`${path}.behaviors[${i}]`, "debe tener un `type` string");
        } else if (b.options !== undefined && !isObject(b.options)) {
          e.push(`${path}.behaviors[${i}].options`, "debe ser un objeto JSON");
        }
      });
    }
  }
  if (v.onClick !== undefined) {
    if (!isObject(v.onClick) || !isString(v.onClick.type)) {
      e.push(`${path}.onClick`, "debe ser un NodeAction { type: string, target?, params? }");
    } else {
      if (v.onClick.target !== undefined && !isString(v.onClick.target)) {
        e.push(`${path}.onClick.target`, "debe ser string si está presente");
      }
      if (v.onClick.params !== undefined && !isObject(v.onClick.params)) {
        e.push(`${path}.onClick.params`, "debe ser un objeto JSON si está presente");
      }
    }
  }
}

function validateDocument(v: unknown, path: string, e: Errors): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto BuilderDocument");
    return;
  }
  if (!isString(v.rootId)) {
    e.push(`${path}.rootId`, "debe ser string");
  }
  if (!isObject(v.nodes)) {
    e.push(`${path}.nodes`, "debe ser un Record<NodeId, BuilderNode>");
    return;
  }
  const nodes = v.nodes;
  for (const id of Object.keys(nodes)) {
    validateNode(nodes[id], `${path}.nodes.${id}`, e);
  }
  // rootId debe existir en nodes.
  if (isString(v.rootId) && !(v.rootId in nodes)) {
    e.push(`${path}.rootId`, `"${v.rootId}" no existe en nodes`);
  }
  // Cada child referenciado debe existir como nodo (integridad referencial).
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    if (isObject(node) && Array.isArray(node.children)) {
      for (const childId of node.children) {
        if (isString(childId) && !(childId in nodes)) {
          e.push(`${path}.nodes.${id}.children`, `referencia inexistente "${childId}"`);
        }
      }
    }
  }
}

/**
 * Traducciones de metadata SEO de una página, por idioma (docs/12 §B.9).
 * `undefined` = sin traducciones SEO (usa el meta default en todos los
 * locales, retrocompat). Solo valida forma estructural básica: cada entrada
 * debe ser un objeto y, si están presentes, `title`/`description` strings y
 * `seo` un objeto (sin validar sus subcampos en detalle — son todos opcionales
 * y de forma libre, igual que `PageMeta.seo`).
 */
function validateMetaTranslations(
  v: unknown,
  path: string,
  e: Errors,
  locales: readonly string[],
): void {
  if (v === undefined) return;
  if (!isObject(v)) {
    e.push(path, "debe ser un Record<locale, PageMetaTranslation>");
    return;
  }
  for (const locale of Object.keys(v)) {
    const lp = `${path}.${locale}`;
    if (locales.length > 0 && !locales.includes(locale)) {
      e.push(lp, `idioma "${locale}" no está en site.meta.i18n.locales`);
    }
    const t = v[locale];
    if (!isObject(t)) {
      e.push(lp, "debe ser un objeto PageMetaTranslation");
      continue;
    }
    if (t.title !== undefined && !isString(t.title)) e.push(`${lp}.title`, "debe ser string");
    if (t.description !== undefined && !isString(t.description)) {
      e.push(`${lp}.description`, "debe ser string");
    }
    if (t.seo !== undefined && !isObject(t.seo)) e.push(`${lp}.seo`, "debe ser un objeto");
  }
}

function validatePageMeta(v: unknown, path: string, e: Errors, locales: readonly string[] = []): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto PageMeta");
    return;
  }
  if (!isString(v.title)) e.push(`${path}.title`, "debe ser string");
  if (!isString(v.slug)) e.push(`${path}.slug`, "debe ser string");
  if (v.themeId !== undefined && !isString(v.themeId)) {
    e.push(`${path}.themeId`, "debe ser un ThemeId (string)");
  }
  if (v.metaTranslations !== undefined) {
    validateMetaTranslations(v.metaTranslations, `${path}.metaTranslations`, e, locales);
  }
}

function validatePage(v: unknown, path: string, e: Errors, locales: readonly string[]): void {
  if (!isObject(v)) {
    e.push(path, "debe ser un objeto BuilderPage");
    return;
  }
  if (!isString(v.id)) e.push(`${path}.id`, "debe ser string");
  validatePageMeta(v.meta, `${path}.meta`, e, locales);
  validateDocument(v.document, `${path}.document`, e);
  if (v.translations !== undefined) {
    const nodeIds = new Set(
      isObject(v.document) && isObject(v.document.nodes) ? Object.keys(v.document.nodes) : [],
    );
    validateTranslations(v.translations, `${path}.translations`, e, nodeIds, locales);
  }
}

function validateAssets(v: unknown, path: string, e: Errors): void {
  if (v === undefined) return;
  if (!isObject(v)) {
    e.push(path, "debe ser un Record<AssetId, Asset>");
    return;
  }
  for (const id of Object.keys(v)) {
    const asset = v[id];
    const ap = `${path}.${id}`;
    if (!isObject(asset)) {
      e.push(ap, "debe ser un objeto Asset");
      continue;
    }
    if (!isString(asset.id)) e.push(`${ap}.id`, "debe ser string");
    if (!isString(asset.fileName)) e.push(`${ap}.fileName`, "debe ser string");
    if (!isString(asset.mimeType)) e.push(`${ap}.mimeType`, "debe ser string");
    if (!isString(asset.dataUrl)) e.push(`${ap}.dataUrl`, "debe ser string");
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * ¿El valor tiene forma de `BuilderDocument` v1 (single-doc, sin `pages`)?
 * Se usa para decidir la migración v1→v2 al cargar (docs/06 §8).
 */
export function looksLikeDocumentV1(v: unknown): boolean {
  return (
    isObject(v) &&
    isString(v.rootId) &&
    isObject(v.nodes) &&
    !("pages" in v)
  );
}

/**
 * Valida un valor desconocido contra `BuilderSite`. No muta ni lanza: devuelve
 * `{ ok, value }` o `{ ok:false, errors }` con rutas legibles.
 */
export function validateSite(input: unknown): ValidationResult<BuilderSite> {
  const e = new Errors();

  if (!isObject(input)) {
    return { ok: false, errors: ["$: el sitio debe ser un objeto"] };
  }

  validateSiteMeta(input.meta, "$.meta", e);
  const i18nLocales =
    isObject(input.meta) && isObject(input.meta.i18n) && Array.isArray(input.meta.i18n.locales)
      ? (input.meta.i18n.locales.filter(isString) as string[])
      : [];

  // pages
  const pages = input.pages;
  if (!isObject(pages)) {
    e.push("$.pages", "debe ser un Record<PageId, BuilderPage>");
  } else {
    for (const id of Object.keys(pages)) {
      validatePage(pages[id], `$.pages.${id}`, e, i18nLocales);
    }
  }

  // pageOrder
  const pageOrder = input.pageOrder;
  if (!Array.isArray(pageOrder) || !pageOrder.every(isString)) {
    e.push("$.pageOrder", "debe ser un array de PageId (string)");
  } else if (isObject(pages)) {
    for (const id of pageOrder) {
      if (!(id in pages)) e.push("$.pageOrder", `"${id}" no existe en pages`);
    }
    for (const id of Object.keys(pages)) {
      if (!pageOrder.includes(id)) e.push("$.pageOrder", `falta la página "${id}"`);
    }
  }

  // homePageId
  const homePageId = input.homePageId;
  if (!isString(homePageId)) {
    e.push("$.homePageId", "debe ser string");
  } else if (isObject(pages) && !(homePageId in pages)) {
    e.push("$.homePageId", `"${homePageId}" no existe en pages`);
  }

  validateAssets(input.assets, "$.assets", e);

  if (e.list.length > 0) return { ok: false, errors: e.list };
  // Validado estructuralmente: el cast es seguro respecto a los invariantes
  // comprobados. (Los tipos ricos de style/props se relajan a lo esencial.)
  return { ok: true, value: input as unknown as BuilderSite };
}

// Re-export: única fuente de verdad en tree.ts (B1/B5, docs/32 §2).
export type { NodeFragment } from "./tree";

export interface ValidateFragmentOptions {
  getDefinition?: (type: string) => ComponentDefinition | undefined;
  canPlaceChild?: (parentType: string, childType: string) => boolean;
  /**
   * Opciones para la validación de nivel 2 (props + tokens, docs/33 §8 Fase 3).
   * Si se proporciona, `validateFragment` verifica además:
   *   - Props con opciones fijas (control: "select" / "searchable-select") tienen valores válidos.
   *   - Props con control: "toggle" son boolean.
   *   - Props con control: "number" son números.
   *   - Style values con `{ token: "..." }` referencian tokens existentes en `availableTokens`.
   */
  level2?: {
    /** Claves de tokens disponibles del sitio para validar referencias de token. */
    availableTokens?: Set<string>;
  };
}

/**
 * Validación de fragmento nivel 1 (B5, docs/32 §2): forma estructural +
 * tipos del registry + guards de slot. No valida props/tokens (nivel 2).
 */
export function validateFragment(
  fragment: NodeFragment,
  options?: ValidateFragmentOptions,
): ValidationResult<NodeFragment> {
  const e = new Errors();
  const getDef = options?.getDefinition ?? getDefinition;
  const canPlace = options?.canPlaceChild ?? canPlaceChild;
  const { rootId, nodes } = fragment;
  const base = "$";

  if (!(rootId in nodes)) {
    e.push(`${base}.rootId`, `"${rootId}" no existe en nodes`);
  }

  for (const id of Object.keys(nodes)) {
    validateNode(nodes[id], `${base}.nodes.${id}`, e);
    const node = nodes[id];
    if (isObject(node) && isString(node.id) && node.id !== id) {
      e.push(`${base}.nodes.${id}.id`, `no coincide con la clave "${id}"`);
    }
    if (isObject(node) && isString(node.type) && !getDef(node.type)) {
      e.push(`${base}.nodes.${id}.type`, `tipo desconocido "${node.type}"`);
    }
  }

  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    if (!isObject(node) || !Array.isArray(node.children)) continue;
    const parentDef = isString(node.type) ? getDef(node.type) : undefined;
    if (parentDef && !parentDef.acceptsChildren) {
      e.push(`${base}.nodes.${id}.children`, "el nodo no acepta hijos");
    }
    for (const childId of node.children) {
      if (!isString(childId)) continue;
      if (!(childId in nodes)) {
        e.push(`${base}.nodes.${id}.children`, `referencia inexistente "${childId}"`);
        continue;
      }
      const child = nodes[childId];
      if (isObject(node) && isString(node.type) && isObject(child) && isString(child.type)) {
        if (!canPlace(node.type, child.type)) {
          e.push(
            `${base}.nodes.${id}.children`,
            `no se puede colocar "${child.type}" dentro de "${node.type}"`,
          );
        }
      }
    }
  }

  if (rootId in nodes) {
    const reachable = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      const n = nodes[cur];
      if (isObject(n) && Array.isArray(n.children)) {
        for (const c of n.children) {
          if (isString(c)) stack.push(c);
        }
      }
    }
    for (const id of Object.keys(nodes)) {
      if (!reachable.has(id)) {
        e.push(`${base}.nodes.${id}`, "nodo huérfano (no alcanzable desde rootId)");
      }
    }
  }

  if (e.list.length > 0) return { ok: false, errors: e.list };

  // ─── Nivel 2: props + tokens (docs/33 §8, docs/32 §B5) ────────────────────
  if (options?.level2) {
    const { availableTokens } = options.level2;
    for (const [id, rawNode] of Object.entries(nodes)) {
      if (!isObject(rawNode) || !isString(rawNode.type)) continue;
      const def = getDef(rawNode.type);
      if (!def) continue; // tipo desconocido ya capturado en nivel 1
      const schema = def.propsSchema;
      if (!schema) continue;
      const props = isObject(rawNode.props) ? rawNode.props : {};
      const nodePath = `${base}.nodes.${id}.props`;

      for (const field of schema.fields) {
        const value = (props as Record<string, unknown>)[field.key];
        if (value === undefined) continue; // prop ausente — usa default, no es error

        // Validar tipo básico según control
        if (field.control === "toggle" && value !== undefined && typeof value !== "boolean") {
          e.push(`${nodePath}.${field.key}`, `debe ser boolean, se recibió ${typeof value}`);
        }
        if (field.control === "number" && value !== undefined && typeof value !== "number") {
          e.push(`${nodePath}.${field.key}`, `debe ser número, se recibió ${typeof value}`);
        }

        // Validar que el valor esté en las opciones si el field tiene lista fija
        if ((field.control === "select" || field.control === "searchable-select") && field.options) {
          const optionList = resolveOptions(field.options);
          if (optionList.length > 0) {
            const valid = optionList.some((o) => o.value === String(value));
            if (!valid) {
              const validValues = optionList.slice(0, 5).map((o) => `"${o.value}"`).join(", ");
              e.push(
                `${nodePath}.${field.key}`,
                `valor "${String(value)}" no está en las opciones válidas (ej: ${validValues}${optionList.length > 5 ? "…" : ""})`,
              );
            }
          }
        }
      }

      // Validar referencias de token en style (solo si se proporcionan tokens disponibles)
      if (availableTokens && isObject(rawNode.style)) {
        const checkStyleValue = (path: string, sv: unknown): void => {
          if (!isObject(sv)) return;
          const svObj = sv as Record<string, unknown>;
          if (isString(svObj["token"])) {
            if (!availableTokens.has(svObj["token"])) {
              e.push(path, `token "${svObj["token"]}" no existe en el sitio`);
            }
          } else {
            for (const [k, v] of Object.entries(svObj)) {
              if (isObject(v)) checkStyleValue(`${path}.${k}`, v);
            }
          }
        };
        checkStyleValue(`${base}.nodes.${id}.style`, rawNode.style);
      }
    }
  }

  if (e.list.length > 0) return { ok: false, errors: e.list };
  return { ok: true, value: fragment };
}
