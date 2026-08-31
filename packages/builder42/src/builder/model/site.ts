/**
 * Operaciones puras de nivel sitio (P7, docs/06).
 *
 * Un `BuilderSite` normaliza páginas igual que el documento normaliza nodos
 * (P2, un nivel arriba). Estas funciones son `site -> site` deterministas y no
 * mutan la entrada; el store las usa para las acciones de página. Las puras de
 * árbol/estilo (`tree.ts`, `style.ts`) NO cambian: operan sobre *una* página.
 */

import {
  DEFAULT_BREAKPOINTS,
  type BreakpointConfig,
  type BuilderDocument,
  type BuilderPage,
  type BuilderSite,
  type PageId,
  type PageMeta,
} from "./types";
import { BASE_TOKENS } from "./tokens";

/** Genera un id de página único. */
export function newPageId(): PageId {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `page-${rand}`;
}

/**
 * Normaliza un slug: minúsculas, `kebab-case`, sin barras iniciales/finales
 * redundantes ni caracteres inválidos (docs/06 §5).
 */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-") // no alfanumérico → guion (conserva "/")
    .replace(/\/{2,}/g, "/") // colapsa barras repetidas
    .replace(/^[-/]+|[-/]+$/g, "") // sin bordes de guion/barra
    .replace(/-{2,}/g, "-");
}

/** Conjunto de slugs en uso, excluyendo opcionalmente una página. */
function usedSlugs(site: BuilderSite, exceptPageId?: PageId): Set<string> {
  const set = new Set<string>();
  for (const id of site.pageOrder) {
    if (id === exceptPageId) continue;
    const page = site.pages[id];
    if (page) set.add(page.meta.slug);
  }
  return set;
}

/**
 * Slug único dentro del sitio: si `desired` ya existe, sufija `-2`, `-3`, …
 * (docs/06 §5). El slug vacío (home) se devuelve tal cual (lo gestiona
 * `setHomePage`, no colisiona).
 */
export function uniqueSlug(
  site: BuilderSite,
  desired: string,
  exceptPageId?: PageId,
): string {
  const base = normalizeSlug(desired);
  if (base === "") return base;
  const used = usedSlugs(site, exceptPageId);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Conjunto de títulos en uso, excluyendo opcionalmente una página. */
function usedTitles(site: BuilderSite, exceptPageId?: PageId): Set<string> {
  const set = new Set<string>();
  for (const id of site.pageOrder) {
    if (id === exceptPageId) continue;
    const page = site.pages[id];
    if (page) set.add(page.meta.title);
  }
  return set;
}

/**
 * Título único dentro del sitio (mismo criterio que `uniqueSlug`, pero sin
 * normalizar mayúsculas/formato — un título es texto libre, no una ruta): si
 * `desired` ya está en uso, sufija " 2", " 3"… Usado por `addPage` para que
 * el título por defecto de una página nueva ("Mi Sitio" derivado del nombre
 * del sitio, feedback de usuario) no quede duplicado visualmente en el
 * `PageManager` al crear varias páginas nuevas seguidas — sigue siendo 100%
 * editable después, independiente de `site.meta.name` (`updatePageMeta` no
 * está atado a él, es solo el valor inicial).
 */
export function uniqueTitle(
  site: BuilderSite,
  desired: string,
  exceptPageId?: PageId,
): string {
  const base = desired.trim();
  if (base === "") return base;
  const used = usedTitles(site, exceptPageId);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Documento vacío (un container raíz en flex column). */
export function createEmptyDocument(): BuilderDocument {
  return {
    rootId: "root",
    meta: { version: 1 },
    nodes: {
      root: {
        id: "root",
        type: "container",
        props: { gridPlacement: "auto" },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "16px" },
            spacing: { padding: "24px" },
            size: { minHeight: "150px" },
            appearance: { background: "#ffffff" },
          },
        },
        children: [],
      },
    },
  };
}

/** Crea una página nueva con metadata por defecto (slug ya normalizado/único). */
export function createPage(meta: PageMeta, document?: BuilderDocument): BuilderPage {
  return {
    id: newPageId(),
    meta,
    document: document ?? createEmptyDocument(),
  };
}

/**
 * Escribe (inmutable) `document` en la página `pageId` del sitio. Usado por el
 * store para volcar la copia de trabajo activa al sitio antes de leerlo entero
 * (export/JSON/persistencia) o al cambiar de página. No-op si la página no
 * existe.
 */
export function writeDocIntoSite(
  site: BuilderSite,
  pageId: PageId,
  document: BuilderDocument,
): BuilderSite {
  const page = site.pages[pageId];
  if (!page) return site;
  return {
    ...site,
    pages: { ...site.pages, [pageId]: { ...page, document } },
  };
}

/** Página por id (o undefined). */
export function getPage(site: BuilderSite, pageId: PageId): BuilderPage | undefined {
  return site.pages[pageId];
}

/**
 * Migra un `BuilderDocument` v1 (breakpoints en `doc.meta`) a un `BuilderSite`
 * de una sola página (docs/06 §8). Como `DocumentMeta` ya no lleva breakpoints,
 * se aceptan por parámetro (default: DEFAULT_BREAKPOINTS).
 */
export function migrateDocToSite(
  doc: BuilderDocument,
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS,
): BuilderSite {
  const pageId = "page-1";
  return {
    meta: {
      name: "Sitio",
      defaultLang: "es",
      breakpoints,
      version: 2,
      tokens: structuredClone(BASE_TOKENS),
    },
    pages: {
      [pageId]: {
        id: pageId,
        meta: { title: "Inicio", slug: "" },
        document: { rootId: doc.rootId, nodes: doc.nodes, meta: { version: 1 } },
      },
    },
    pageOrder: [pageId],
    homePageId: pageId,
  };
}

/** Crea un sitio de una sola página a partir de un documento (home, slug ""). */
export function createSiteFromDocument(
  document: BuilderDocument,
  siteName = "Sitio",
): BuilderSite {
  const pageId = newPageId();
  return {
    meta: {
      name: siteName,
      defaultLang: "es",
      breakpoints: DEFAULT_BREAKPOINTS,
      version: 2,
      tokens: structuredClone(BASE_TOKENS),
    },
    pages: {
      [pageId]: { id: pageId, meta: { title: "Inicio", slug: "" }, document },
    },
    pageOrder: [pageId],
    homePageId: pageId,
  };
}
