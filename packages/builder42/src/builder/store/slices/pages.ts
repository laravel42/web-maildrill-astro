/**
 * Páginas del sitio (docs/06 §5, docs/27 §4.1): CRUD de páginas, meta,
 * traducciones SEO por campo (docs/12 §B.9), home y cambio de página activa.
 *
 * `switchToPage` (privada de este módulo, igual que hoy es privada de
 * `documentStore.ts`) usa `getStoreHandle().setState(...)` en vez de importar
 * el barrel (`useDocumentStore`) como valor: esta slice se compone DENTRO del
 * `create()` de `documentStore.ts`, así que un import de valor del barrel
 * cerraría un ciclo de inicialización. `getStoreHandle()` (`historyRuntime.ts`)
 * es el punto de acceso imperativo acordado para este caso (docs/27 §6.1,
 * decisión D6).
 */
import {
  createPage,
  uniqueSlug,
  uniqueTitle,
  writeDocIntoSite,
} from "../../model/site";
import type {
  BuilderSite,
  PageId,
  PageMeta,
  PageMetaTranslation,
} from "../../model/types";
import {
  deletePageHistory,
  getStoreHandle,
  restorePageHistory,
  savePageHistory,
  withHistoryPaused,
} from "../historyRuntime";
import type { SliceCreator } from "./types";
import type { SiteState } from "../documentStore";

/**
 * Rutas de campo soportadas por `setPageMetaTranslation` (docs/12 §B.9).
 * Cubre los mismos campos que `PageMetaTranslation`; `slug` queda fuera a
 * propósito (no se traduce).
 */
export type MetaFieldPath =
  | "title"
  | "description"
  | "seo.canonical"
  | "seo.robots"
  | "seo.openGraph.title"
  | "seo.openGraph.description"
  | "seo.openGraph.image"
  | "seo.openGraph.type"
  | "seo.twitter.card"
  | "seo.twitter.title"
  | "seo.twitter.description"
  | "seo.twitter.image";

/** Construye el `Partial<PageMeta>` para escribir `field` en el idioma default. */
function metaPatchForField(field: MetaFieldPath, value: string): Partial<PageMeta> {
  if (field === "title") return { title: value };
  if (field === "description") return { description: value };
  const [, group, key] = field.split(".") as ["seo", "canonical" | "robots" | "openGraph" | "twitter", string?];
  if (group === "canonical" || group === "robots") {
    return { seo: { [group]: value } };
  }
  return { seo: { [group]: { [key!]: value } } };
}

/** Escribe `field` (docs/12 §B.9) en una `PageMetaTranslation` mutable (Immer). */
function writeMetaTranslationField(t: PageMetaTranslation, field: MetaFieldPath, value: string): void {
  if (field === "title") {
    t.title = value;
    return;
  }
  if (field === "description") {
    t.description = value;
    return;
  }
  const [, group, key] = field.split(".") as ["seo", "canonical" | "robots" | "openGraph" | "twitter", string?];
  t.seo ??= {};
  if (group === "canonical" || group === "robots") {
    t.seo[group] = value;
    return;
  }
  const sub = (t.seo[group] ??= {});
  (sub as Record<string, string>)[key!] = value;
}

export interface PagesSlice {
  // Páginas (docs/06 §5)
  setActivePage: (pageId: PageId) => void;
  addPage: (meta?: Partial<PageMeta>) => PageId;
  duplicatePage: (pageId: PageId) => PageId;
  removePage: (pageId: PageId) => void;
  updatePageMeta: (pageId: PageId, patch: Partial<PageMeta>) => void;
  /**
   * Escribe un campo SEO de la página respetando `editingLocale` (docs/12
   * §B.9, análogo a `setProp` para nodos): en el idioma default escribe
   * directo en `page.meta` (vía `updatePageMeta`); en otro idioma escribe en
   * `page.meta.metaTranslations[editingLocale]`, sin tocar el meta default.
   * `field` acepta rutas planas (`"title"`, `"description"`) o anidadas en
   * `seo` (`"seo.canonical"`, `"seo.openGraph.title"`, `"seo.twitter.image"`…).
   */
  setPageMetaTranslation: (pageId: PageId, field: MetaFieldPath, value: string) => void;
  reorderPages: (from: number, to: number) => void;
  setHomePage: (pageId: PageId) => void;
}

export const createPagesSlice: SliceCreator<PagesSlice> = (set, get) => ({
  // --- Páginas --------------------------------------------------------
  setActivePage: (pageId) => {
    const s = get();
    if (pageId === s.activePageId || !s.site.pages[pageId]) return;
    switchToPage(s, pageId, writeDocIntoSite(s.site, s.activePageId, s.document));
  },

  addPage: (patch) => {
    const s = get();
    // Título por defecto derivado del nombre del sitio (feedback de
    // usuario): un punto de partida más útil que un genérico "Nueva
    // página" — el usuario sigue pudiendo editarlo después sin ninguna
    // restricción (`updatePageMeta` no lo ata a `site.meta.name`, es solo
    // el valor inicial). `uniqueTitle` evita duplicados visuales en el
    // `PageManager` si se crean varias páginas nuevas seguidas.
    const title = patch?.title ?? uniqueTitle(s.site, s.site.meta.name);
    const slug = uniqueSlug(s.site, patch?.slug ?? title);
    const page = createPage({ ...patch, title, slug });
    const flushed = writeDocIntoSite(s.site, s.activePageId, s.document);
    set({
      site: {
        ...flushed,
        pages: { ...flushed.pages, [page.id]: page },
        pageOrder: [...flushed.pageOrder, page.id],
      },
    });
    return page.id;
  },

  duplicatePage: (pageId) => {
    const s = get();
    const flushed = writeDocIntoSite(s.site, s.activePageId, s.document);
    const src = flushed.pages[pageId];
    if (!src) return pageId;
    const slug = uniqueSlug(flushed, src.meta.slug || src.meta.title);
    const copy = createPage(
      { ...src.meta, title: `${src.meta.title} (copia)`, slug },
      structuredClone(src.document),
    );
    set({
      site: {
        ...flushed,
        pages: { ...flushed.pages, [copy.id]: copy },
        pageOrder: [...flushed.pageOrder, copy.id],
      },
    });
    return copy.id;
  },

  removePage: (pageId) => {
    const s = get();
    const order = s.site.pageOrder;
    if (order.length <= 1 || !s.site.pages[pageId]) return; // no borrar la última
    const flushed = writeDocIntoSite(s.site, s.activePageId, s.document);
    const nextOrder = order.filter((id) => id !== pageId);
    const nextPages = { ...flushed.pages };
    delete nextPages[pageId];
    const homePageId =
      flushed.homePageId === pageId ? nextOrder[0]! : flushed.homePageId;
    const nextSite: BuilderSite = {
      ...flushed,
      pages: nextPages,
      pageOrder: nextOrder,
      homePageId,
    };
    deletePageHistory(pageId);
    if (s.activePageId === pageId) {
      // La página activa se borró: saltamos a la home (con su historial).
      switchToPage(s, homePageId, nextSite);
    } else {
      set({ site: nextSite });
    }
  },

  updatePageMeta: (pageId, patch) => {
    const s = get();
    const page = s.site.pages[pageId];
    if (!page) return;
    const meta: PageMeta = { ...page.meta, ...patch };
    if (pageId === s.site.homePageId) {
      meta.slug = ""; // la home siempre resuelve a "/"
    } else if (patch.slug !== undefined) {
      meta.slug = uniqueSlug(s.site, patch.slug, pageId);
    }
    set({
      site: {
        ...s.site,
        pages: { ...s.site.pages, [pageId]: { ...page, meta } },
      },
    });
  },

  setPageMetaTranslation: (pageId, field, value) => {
    const s = get();
    // docs/12 §B.9: en el idioma default, escribe directo en `page.meta`
    // (mismo camino que editar el campo "normal", vía `updatePageMeta`).
    if (s.editingLocale === s.site.meta.defaultLang) {
      get().updatePageMeta(pageId, metaPatchForField(field, value));
      return;
    }
    set((draft) => {
      const page = draft.site.pages[pageId];
      if (!page) return;
      page.meta.metaTranslations ??= {};
      const t = (page.meta.metaTranslations[draft.editingLocale] ??= {});
      writeMetaTranslationField(t, field, value);
    });
  },

  reorderPages: (from, to) => {
    const s = get();
    const order = [...s.site.pageOrder];
    if (from < 0 || from >= order.length || to < 0 || to >= order.length) return;
    const [moved] = order.splice(from, 1);
    if (moved === undefined) return;
    order.splice(to, 0, moved);
    set({ site: { ...s.site, pageOrder: order } });
  },

  setHomePage: (pageId) => {
    const s = get();
    if (!s.site.pages[pageId] || pageId === s.site.homePageId) return;
    const pages = { ...s.site.pages };
    const prevHome = pages[s.site.homePageId];
    if (prevHome) {
      // La antigua home necesita un slug real para seguir siendo alcanzable.
      const slug = uniqueSlug(s.site, prevHome.meta.title, s.site.homePageId);
      pages[s.site.homePageId] = { ...prevHome, meta: { ...prevHome.meta, slug } };
    }
    const newHome = pages[pageId]!;
    pages[pageId] = { ...newHome, meta: { ...newHome.meta, slug: "" } };
    set({ site: { ...s.site, pages, homePageId: pageId } });
  },
});

/**
 * Conmuta la página activa (docs/06 §6): vuelca el doc de trabajo al sitio,
 * cambia de página SIN registrar el salto en el historial (pausa zundo) y
 * restaura la pila de la página destino. `flushedSite` ya trae el doc actual
 * volcado en la página que dejamos.
 */
function switchToPage(s: SiteState, pageId: PageId, flushedSite: BuilderSite): void {
  const target = flushedSite.pages[pageId];
  if (!target) return;
  // Guarda (copiada) la pila de la página que dejamos.
  savePageHistory(s.activePageId);
  // Cambia de página sin registrar el salto como paso de historia.
  withHistoryPaused(() => {
    getStoreHandle().setState({
      site: flushedSite,
      activePageId: pageId,
      document: target.document,
      selectedId: null,
      editingTextNodeId: null,
      activeTiptapEditor: null,
      editingModalId: null,
      pickInsert: null,
      activeSlotByComposite: {},
      previewStateBySelectedId: {},
      // Si la página destino tiene un tema asignado explícitamente, activarlo
      // en el canvas. Si no, caer al default del sitio. Mismo criterio que el
      // export (docs/11 §4, exportPage usa page.meta.themeId ?? defaultThemeId).
      activeThemeId: target.meta.themeId ?? flushedSite.meta.defaultThemeId ?? null,
    });
  });
  // Restaura (o inicia vacía) la pila de la página destino.
  restorePageHistory(pageId);
}
