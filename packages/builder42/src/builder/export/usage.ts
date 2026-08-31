import type { BuilderDocument, BuilderPage, BuilderSite, StyleValue } from "../model/types";
import { getBehaviorDefinition } from "../registry/behaviorRegistry";
import { getActionDefinition } from "../registry/actionRegistry";
import { nodeActions } from "../model/nodeAction";
import { getDefinition } from "../registry/componentRegistry";

const FAMILY_TOKEN_PREFIX = "typography.families.";

/**
 * Recolecta las claves de familia tipográfica **referenciadas por token** en
 * algún nodo del documento (base u overrides). Solo un `fontFamily` con
 * `{ token: "typography.families.<k>" }` cuenta como "usada" (docs/08 §7); una
 * familia definida pero no referenciada NO dispara `<link>`.
 *
 * Trabaja sobre el `BuilderDocument` (y no sobre la `BuilderPage`) para que el
 * chrome del editor pueda reusarla con su copia de trabajo del documento, que no
 * vive dentro de una `BuilderPage` (docs/48 §3.3): el canvas necesita cargar las
 * MISMAS webfonts que el export para que el WYSIWYG sea real.
 */
export function usedFontFamilyKeysInDocument(doc: BuilderDocument): Set<string> {
  const used = new Set<string>();
  const scan = (v: StyleValue | undefined) => {
    if (v && typeof v === "object" && "token" in v && v.token.startsWith(FAMILY_TOKEN_PREFIX)) {
      used.add(v.token.slice(FAMILY_TOKEN_PREFIX.length));
    }
  };
  for (const node of Object.values(doc.nodes)) {
    scan(node.style.base.typography?.fontFamily);
    const overrides = node.style.overrides;
    if (overrides) {
      for (const layer of Object.values(overrides)) scan(layer?.typography?.fontFamily);
    }
  }
  return used;
}

/** Ídem para una página completa (camino del export). */
export function usedFontFamilyKeys(page: BuilderPage): Set<string> {
  return usedFontFamilyKeysInDocument(page.document);
}

/**
 * `<link>` combinado a Google Fonts para las familias-token con `webFont` que
 * **la página usa** (docs/08 §7). Devuelve [] si la página no referencia ninguna
 * familia con fuente web.
 */
export function fontLinks(page: BuilderPage, site: BuilderSite): string[] {
  const families = site.meta.tokens?.typography?.families;
  if (!families) return [];
  const used = usedFontFamilyKeys(page);
  const specs: string[] = [];
  for (const [key, fam] of Object.entries(families)) {
    if (!used.has(key)) continue;
    if (!fam.webFont || fam.webFont.provider !== "google") continue;
    const weights = fam.webFont.weights?.length
      ? `:wght@${fam.webFont.weights.join(";")}`
      : "";
    specs.push(`family=${fam.webFont.family.replace(/ /g, "+")}${weights}`);
  }
  if (specs.length === 0) return [];
  const href = `https://fonts.googleapis.com/css2?${specs.join("&")}&display=swap`;
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${href}">`,
  ];
}

/**
 * `moduleId`s de behaviors REALMENTE usados por una página, vía el
 * `behaviorRegistry` (`type` del nodo → `runtime.moduleId`). Vacío = página
 * sin behaviors → invariante cero-JS (docs/10 §9, P8/P9).
 */
export function usedBehaviorModuleIds(page: BuilderPage): Set<string> {
  const moduleIds = new Set<string>();
  for (const node of Object.values(page.document.nodes)) {
    for (const behavior of node.behaviors ?? []) {
      const def = getBehaviorDefinition(behavior.type);
      if (def) moduleIds.add(def.runtime.moduleId);
    }
  }
  return moduleIds;
}

/**
 * `moduleId`s de ACCIONES de click realmente usadas por una página, vía el
 * `actionRegistry` (`type` de `node.onClick` → `runtime.moduleId`, docs/44
 * §2.4). Mismo criterio que `usedBehaviorModuleIds`: una acción sin `runtime`
 * propio (ej. `open-modal`, que reutiliza el runtime del componente `modal`)
 * no aporta módulo aquí — su JS ya se cuenta por el behavior del `modal`.
 * Vacío = página sin acciones con runtime propio → invariante cero-JS.
 */
export function usedActionModuleIds(page: BuilderPage): Set<string> {
  const moduleIds = new Set<string>();
  for (const node of Object.values(page.document.nodes)) {
    for (const action of nodeActions(node)) {
      const def = getActionDefinition(action.type);
      if (def?.runtime) moduleIds.add(def.runtime.moduleId);
    }
  }
  return moduleIds;
}

/**
 * ¿La página tiene al menos un nodo cuyo `ComponentDefinition.css` (T10,
 * AGENTS.md) está declarado? Determina si `exportPage` debe enlazar
 * `components.css` — tree-shake por uso del COMPONENTE, independiente de si
 * tiene un behavior JS adjunto (a diferencia de `usedBehaviorModuleIds`).
 */
export function pageHasComponentsCss(page: BuilderPage): boolean {
  return Object.values(page.document.nodes).some((node) => !!getDefinition(node.type)?.css);
}

/**
 * `moduleId`s usados en TODO el sitio (todas las páginas). Determina qué
 * bundles emitir una sola vez en `assets/js/` (docs/10 §4 punto 2, tree-shake
 * por uso: 3 carousels y 0 lightbox → solo se emite el bundle de carousel).
 */
export function usedBehaviorModuleIdsForSite(site: BuilderSite): Set<string> {
  const moduleIds = new Set<string>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    for (const moduleId of usedBehaviorModuleIds(page)) moduleIds.add(moduleId);
  }
  return moduleIds;
}

/** `moduleId`s de acciones usados en TODO el sitio (todas las páginas, docs/44 §2.4). */
export function usedActionModuleIdsForSite(site: BuilderSite): Set<string> {
  const moduleIds = new Set<string>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    for (const moduleId of usedActionModuleIds(page)) moduleIds.add(moduleId);
  }
  return moduleIds;
}

/**
 * Script INLINE de persistencia de tema para el `<head>` de TODAS las páginas
 * (docs/11 §4). El behavior `theme-toggle` guarda el tema elegido en
 * `localStorage` bajo su `storageKey` (default `pb-theme`), pero su runtime solo
 * corre en las páginas que tienen el botón — así que al navegar a otra página la
 * preferencia se perdía. Este helper recolecta las `storageKey` usadas por todos
 * los theme-toggle del sitio + los ids de tema válidos, y devuelve un
 * micro-script que, en cada página, reaplica el tema recordado al
 * `<html data-theme>` antes de pintar (validando contra los temas existentes
 * para ignorar valores obsoletos). Va sin `src` (código propio, sin red) y
 * envuelto en try/catch (localStorage puede fallar en modo privado).
 *
 * Devuelve `undefined` si el sitio no tiene temas o no usa ningún theme-toggle
 * (invariante cero-JS por defecto, P8/P9: nada que persistir → no se inyecta
 * script). Puro.
 */
export function themePersistScriptForSite(site: BuilderSite): string | undefined {
  const themes = site.meta.themes;
  if (!themes || Object.keys(themes).length === 0) return undefined;

  const storageKeys = new Set<string>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    for (const node of Object.values(page.document.nodes)) {
      for (const behavior of node.behaviors ?? []) {
        if (behavior.type !== "theme-toggle") continue;
        const raw = behavior.options?.["storageKey"];
        const key = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "pb-theme";
        storageKeys.add(key);
      }
    }
  }
  if (storageKeys.size === 0) return undefined;

  const keysJson = JSON.stringify(Array.from(storageKeys));
  const idsJson = JSON.stringify(Object.keys(themes));
  // Lee cada storageKey; aplica el primer valor recordado que sea un tema
  // válido. `d.setAttribute` en vez de dataset por brevedad de bytes.
  return (
    `(function(){try{var K=${keysJson},V=${idsJson},d=document.documentElement;` +
    `for(var i=0;i<K.length;i++){var t=localStorage.getItem(K[i]);` +
    `if(t&&V.indexOf(t)>-1){d.setAttribute("data-theme",t);break;}}}catch(e){}})();`
  );
}

/**
 * ¿La página tiene ≥1 componente que participa en el micro-runtime `ui.js`
 * (tier 1, docs/15 §1.5)? Consulta el registry por `ComponentDefinition.uiRuntime`
 * (declarativo, P4: el core no conoce "select"). Determina si se emite `ui.js`
 * y su `<script>` (tree-shake por uso, cero-JS por defecto).
 */
export function pageUsesUIRuntime(page: BuilderPage): boolean {
  for (const node of Object.values(page.document.nodes)) {
    if (getDefinition(node.type)?.uiRuntime) return true;
  }
  return false;
}

/** ¿Algún nodo de alguna página del sitio usa el micro-runtime `ui.js`? */
export function siteUsesUIRuntime(site: BuilderSite): boolean {
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page && pageUsesUIRuntime(page)) return true;
  }
  return false;
}

/**
 * Nombres de iconos Lucide usados en todo el sitio (docs/34 §2.4).
 * Recorrido puro de `nodes` — sin tocar el registry ni los catálogos.
 * Usado por el servidor para precalentar el `GlyphCatalog` de Lucide
 * antes de llamar a `exportSite`.
 */
export function usedIconNames(site: BuilderSite): readonly string[] {
  const names = new Set<string>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    for (const node of Object.values(page.document.nodes)) {
      if (node.type === "icon") {
        if (typeof node.props.name === "string" && node.props.name) {
          names.add(node.props.name);
        }
        if (typeof node.props.pressedName === "string" && node.props.pressedName) {
          names.add(node.props.pressedName);
        }
      }
    }
  }
  return [...names];
}

/**
 * Slugs de simple-icons usados en los componentes `social-links` del sitio
 * (docs/34 §2.4). Recorrido puro de `nodes`.
 * Usado por el servidor para precalentar el `GlyphCatalog` de simple-icons.
 */
export function usedSocialIconSlugs(site: BuilderSite): readonly string[] {
  const slugs = new Set<string>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    for (const node of Object.values(page.document.nodes)) {
      if (node.type === "social-links" && Array.isArray(node.props.links)) {
        for (const link of node.props.links as { label: string; value: string }[]) {
          if (typeof link?.label === "string" && link.label) {
            slugs.add(link.label.trim().toLowerCase());
          }
        }
      }
    }
  }
  return [...slugs];
}
