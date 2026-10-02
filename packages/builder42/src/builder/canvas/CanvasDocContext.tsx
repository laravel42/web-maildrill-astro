/**
 * CanvasDocContext — los valores del store que son IGUALES para todos los nodos
 * del árbol, suscritos UNA vez (chain F31, T3).
 *
 * El problema que resuelve: `NodeRenderer` se monta una vez por nodo y abría
 * **once** suscripciones a valores que no dependen del nodo (`document.rootId`,
 * `activeBreakpoint`, `site.assets`, `editingLocale`, `site.meta.defaultLang`,
 * las `translations` de la página activa, `site.meta.i18n`, `site.meta.basePath`,
 * el `slug` de la página activa, `site` completo y `activePageId`). A 9 377
 * nodos eso son ~103 000 suscripciones que devuelven exactamente el mismo valor
 * 9 377 veces y se re-evalúan en CADA escritura del store. Aquí se suscriben una
 * sola vez para todo el canvas.
 *
 * Y además DERIVA aquí lo que antes cada nodo derivaba por su cuenta: `localeInfo`
 * y `pagesInfo` (con `buildPathMap`, el MISMO helper puro que usa el export, para
 * que canvas y output coincidan — P3) se calculaban dentro de un `useMemo` por
 * nodo, así que `buildPathMap` corría 9 377 veces por cambio. Ahora corre una.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA TRAMPA, y es la razón por la que este archivo existe tal como está:
 * **`s.site` NO se suscribe en ninguna parte de este proveedor.**
 *
 * Con el structural sharing de immer, `s.site` recibe una identidad nueva cuando
 * cambia CUALQUIER cosa debajo — incluidas las props de un nodo al teclear una
 * letra. Si `s.site` entrara al contexto (o si el `useMemo` del valor lo tuviera
 * como dependencia), cada pulsación de tecla cambiaría el valor del contexto y
 * re-renderizaría los 9 377 consumidores: exactamente el coste que esta tarea
 * viene a quitar, pero ahora a través del contexto. Sería PEOR que antes, porque
 * parecería arreglado.
 *
 * En su lugar: `pagesInfo` depende solo de `pageOrder`, del `meta` de cada página
 * y del `basePath`/`i18n`/`activePageId`/`editingLocale`. El `pathMap` y los
 * títulos resueltos se suscriben con `useShallow` sobre el resultado de
 * `buildPathMap` (un `Record<PageId, string>` plano, así que el compare
 * superficial lo mantiene estable mientras ningún slug cambie). El selector
 * corre en cada escritura — pero una vez, en el proveedor, sobre 1-5 páginas, no
 * 9 377 veces sobre el árbol entero.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDocumentStore } from "../store/documentStore";
import { buildPathMap, localizedRoute, withBasePath } from "../export/links";
import { resolveMetaForLocale } from "../model/i18nContent";
import { resolveImageSrc } from "../model/assets";
import type { Breakpoint, ImageSource, NodeId, NodeTranslations } from "../model/types";
import type { RenderContext } from "../registry/types";

export interface CanvasDocValue {
  /** `document.rootId` de la página activa. */
  rootId: NodeId;
  /** Breakpoint activo del canvas. */
  activeBreakpoint: Breakpoint;
  /** Idioma de edición activo (el canvas muestra este, igual que el Inspector). */
  editingLocale: string;
  /** `site.meta.defaultLang`. */
  defaultLang: string;
  /** `translations` de la página activa, o `undefined`. */
  activePageTranslations: Record<NodeId, NodeTranslations> | undefined;
  /** Resuelve el `src` de una imagen contra `site.assets`. Referencia estable. */
  resolveImageSrc: (source: ImageSource) => string;
  /** `localeInfo` ya derivado (docs/14 §2.5). `undefined` en sitios monolingües. */
  localeInfo: RenderContext["localeInfo"];
  /** `pagesInfo` ya derivado (docs/16 §12.4). Siempre presente. */
  pagesInfo: NonNullable<RenderContext["pagesInfo"]>;
}

const CanvasDocContext = createContext<CanvasDocValue | null>(null);

/**
 * Lee el contexto. Lanza si se usa fuera del proveedor: es un error de montaje,
 * y un fallo ruidoso es mejor que un canvas que renderiza con valores obsoletos
 * de forma silenciosa. Los dos únicos sitios que montan un `NodeRenderer`
 * (`Canvas.tsx` y `ModalEditorOverlay`, ambos dentro de `.pbx-canvas__frame`)
 * quedan bajo el proveedor.
 */
export function useCanvasDoc(): CanvasDocValue {
  const value = useContext(CanvasDocContext);
  if (!value) {
    throw new Error(
      "useCanvasDoc: falta <CanvasDocProvider>. El canvas debe envolver todo NodeRenderer (chain F31, T3).",
    );
  }
  return value;
}

/**
 * Proveedor. Es un componente aparte (no parte de `Canvas`) a propósito: cuando
 * uno de sus valores cambia, re-renderiza solo él. Sus `children` llegan como la
 * misma referencia de elemento que creó `Canvas`, así que React salta el subárbol
 * entero salvo los consumidores del contexto — que es justo el comportamiento
 * que se quiere.
 */
export function CanvasDocProvider({ children }: { children: ReactNode }) {
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const assets = useDocumentStore((s) => s.site.assets);
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const activePageTranslations = useDocumentStore(
    (s) => s.site.pages[s.activePageId]?.translations,
  );
  const siteI18n = useDocumentStore((s) => s.site.meta.i18n);
  const basePath = useDocumentStore((s) => s.site.meta.basePath);
  const activePageSlug = useDocumentStore((s) => s.site.pages[s.activePageId]?.meta.slug);
  const activePageId = useDocumentStore((s) => s.activePageId);

  // `pageOrder` y el `pathMap`: planos y comparables superficialmente, así que
  // su referencia solo cambia cuando cambia de verdad el conjunto de páginas o
  // un slug — NO cuando se teclea una letra. `buildPathMap` es el mismo helper
  // puro que usa el export (P3), llamado aquí UNA vez en vez de una por nodo.
  const pageOrder = useDocumentStore(useShallow((s) => s.site.pageOrder));
  const pathMap = useDocumentStore(useShallow((s) => buildPathMap(s.site)));
  // Títulos de página resueltos al `editingLocale` (docs/12 §B.9): si el usuario
  // tradujo el título, el menú cambia de idioma con el resto del contenido.
  // `Record<PageId, string>` plano → `useShallow` lo mantiene estable.
  const pageTitles = useDocumentStore(
    useShallow((s) => {
      const defaultLocale = s.site.meta.i18n?.defaultLocale ?? s.site.meta.defaultLang;
      const out: Record<string, string> = {};
      for (const pid of s.site.pageOrder) {
        const page = s.site.pages[pid];
        if (page) out[pid] = resolveMetaForLocale(page.meta, s.editingLocale, defaultLocale).title;
      }
      return out;
    }),
  );

  const resolveImgSrc = useCallback(
    (source: ImageSource) => resolveImageSrc(source, { assets, forExport: false }),
    [assets],
  );

  const localeInfo = useMemo<RenderContext["localeInfo"]>(() => {
    if (!siteI18n) return undefined;
    const slug = activePageSlug ?? "";
    return {
      locales: siteI18n.locales,
      currentLocale: editingLocale,
      defaultLocale: siteI18n.defaultLocale,
      localizedHref: (target: string) =>
        withBasePath(
          basePath,
          localizedRoute(slug, target, siteI18n.defaultLocale, siteI18n.routeStrategy),
        ),
    };
  }, [siteI18n, activePageSlug, editingLocale, basePath]);

  const pagesInfo = useMemo<NonNullable<RenderContext["pagesInfo"]>>(
    () =>
      pageOrder
        .filter((pid) => pathMap[pid] !== undefined || pageTitles[pid] !== undefined)
        .map((pid) => ({
          pageId: pid,
          title: pageTitles[pid] ?? "",
          href: withBasePath(basePath, pathMap[pid] ?? "/"),
          isCurrent: pid === activePageId,
        })),
    [pageOrder, pathMap, pageTitles, basePath, activePageId],
  );

  const value = useMemo<CanvasDocValue>(
    () => ({
      rootId,
      activeBreakpoint,
      editingLocale,
      defaultLang,
      activePageTranslations,
      resolveImageSrc: resolveImgSrc,
      localeInfo,
      pagesInfo,
    }),
    [
      rootId,
      activeBreakpoint,
      editingLocale,
      defaultLang,
      activePageTranslations,
      resolveImgSrc,
      localeInfo,
      pagesInfo,
    ],
  );

  return <CanvasDocContext.Provider value={value}>{children}</CanvasDocContext.Provider>;
}
