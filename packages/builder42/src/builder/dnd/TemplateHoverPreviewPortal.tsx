/**
 * TemplateHoverPreviewPortal — hover-preview AMPLIADO de templates/secciones
 * (fase A, homologación UI/UX). Concepto tomado de
 * `LibraryHoverPreviewPortal.tsx` de email-builder: un único popover
 * singleton, montado una vez (en `Sidebar.tsx`/`TemplatesPanel.tsx`), que
 * todas las `TemplateCard`/`SectionTemplateCard` alimentan vía
 * `templateHoverPreviewStore` en vez de montar su propio popover cada una.
 *
 * Diferencia deliberada con el original: email-builder necesita un iframe +
 * `<Reader>` portalado porque su preview corre sobre documentos MUI/React
 * completos y `renderToStaticMarkup` bloquearía el hilo principal. builder42
 * ya resuelve sus miniaturas con HTML/CSS estático y barato
 * (`layoutPreviewMarkup`/`fragmentPreviewMarkup`, síncronos) — no hay tal
 * costo que evitar, así que el popover reutiliza el MISMO
 * `dangerouslySetInnerHTML` que la miniatura chica de `TemplateCard.tsx`
 * (vía `layoutThemePreviewCss` reexportado), solo a mayor escala y con
 * controles de zoom + toggle desktop/mobile (cambia el `Breakpoint` pasado a
 * `layoutPreviewMarkup`, no hay emulación de verdad — mismo criterio que el
 * resto del chrome, que no monta un iframe real para esto).
 *
 * Posición: a la derecha de la tarjeta ancla, mismo patrón de medición manual
 * (sin lib de terceros) que `SelectionHandle`/`NodeActionsRail` — un
 * `useLayoutEffect` mide el rect del ancla contra el viewport (aquí NO hay un
 * "frame" del canvas de por medio, el ancla vive en el sidebar) y compone
 * `top`/`left` en `position: fixed`.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  loadPageLayout,
  type LayoutDefinition,
} from "@/builder/registry/layoutRegistry";
import { fragmentPreviewMarkup, layoutPreviewMarkup } from "./ghost";
import { useDocumentStore } from "../store/documentStore";
import { tokensToCss } from "@/builder/model/tokens";
import { themesToCss } from "@/builder/model/theme";
import { useWebFontLinks } from "@/hooks/useWebFontLinks";
import { layoutThemePreviewCss } from "@/app/layout/TemplateCard";
import { Monitor, Smartphone, ZoomIn, ZoomOut } from "@/components";
import type { Breakpoint } from "@/builder/model/types";
import {
  cancelHoverClose,
  requestHoverLeave,
  useActiveTemplateHoverPreview,
} from "./templateHoverPreviewStore";

/** Ancho de referencia del contenedor "de escritorio" simulado — mismo valor
 * base que `TemplateCardPreview` usa para su miniatura chica. */
const PREVIEW_BASE_WIDTH = 1200;
/** Ancho de referencia en el toggle "mobile" del popover (no hay emulación
 * real de viewport — solo cambia el breakpoint resuelto por el registry). */
const PREVIEW_MOBILE_WIDTH = 420;

/** Caja de despliegue del popover — igual criterio de topes que email-builder
 * (una caja con tope máximo, nunca a pantalla completa). */
const BOX_WIDTH = 420;
const BOX_MAX_HEIGHT = 560;
const BOX_MIN_HEIGHT = 96;
const VIEWPORT_EDGE_GAP = 12;

type PreviewMarkup = { html: string; css: string };

/** Caché propia del portal, separada de la de `TemplateCard.tsx`: la
 * miniatura chica cachea SIEMPRE en "base"; aquí el breakpoint es variable
 * (toggle desktop/mobile), así que se cachea por `layoutId + breakpoint`. */
const hoverPreviewCache = new Map<string, PreviewMarkup | null>();

function useHoverPreviewMarkup(
  layout: LayoutDefinition | null,
  breakpoint: Breakpoint,
): { preview: PreviewMarkup | null; loading: boolean } {
  const [pagePreview, setPagePreview] = useState<PreviewMarkup | null>(null);
  const [loading, setLoading] = useState(false);

  const isSection = layout?.category === "section";
  const cacheKey = layout ? `${layout.id}|${breakpoint}` : null;

  const sectionPreview = useMemo(() => {
    if (!layout || !isSection || !cacheKey) return null;
    if (hoverPreviewCache.has(cacheKey)) return hoverPreviewCache.get(cacheKey) ?? null;
    const result = layoutPreviewMarkup(layout.id, breakpoint);
    hoverPreviewCache.set(cacheKey, result);
    return result;
  }, [layout, isSection, cacheKey, breakpoint]);

  useEffect(() => {
    if (!layout || isSection || !cacheKey) {
      setPagePreview(null);
      return;
    }
    if (hoverPreviewCache.has(cacheKey)) {
      setPagePreview(hoverPreviewCache.get(cacheKey) ?? null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadPageLayout(layout.id).then((loaded) => {
      const markup = loaded ? fragmentPreviewMarkup(loaded.fragment, breakpoint) : null;
      hoverPreviewCache.set(cacheKey, markup);
      if (cancelled) return;
      setPagePreview(markup);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [layout, isSection, cacheKey, breakpoint]);

  if (!layout) return { preview: null, loading: false };
  if (isSection) return { preview: sectionPreview, loading: false };
  return { preview: pagePreview, loading };
}

interface Box {
  top: number;
  left: number;
}

export function TemplateHoverPreviewPortal() {
  const { t } = useTranslation("sidebar");
  const active = useActiveTemplateHoverPreview();
  const layout = active?.layout ?? null;

  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [zoomed, setZoomed] = useState(false);
  const breakpoint: Breakpoint = previewViewport === "mobile" ? "base" : "lg";
  const { preview, loading } = useHoverPreviewMarkup(layout, breakpoint);

  const tokens = useDocumentStore((s) => s.site.meta.tokens);
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const defaultThemeId = useDocumentStore((s) => s.site.meta.defaultThemeId);
  const breakpoints = useDocumentStore((s) => s.site.meta.breakpoints);

  const scopeSelector = layout ? `.pbx-template-hover-preview__inner[data-layout="${layout.id}"]` : "";
  const tokensCss = useMemo(() => {
    if (!layout) return "";
    return [
      tokensToCss(tokens, scopeSelector, breakpoints),
      themesToCss(tokens, themes, defaultThemeId, {
        rootSelector: scopeSelector,
        includePrefersColorScheme: false,
      }),
      layoutThemePreviewCss(layout, scopeSelector),
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [layout, tokens, themes, defaultThemeId, breakpoints, scopeSelector]);

  const themeFamilies = useMemo(
    () => Object.values(layout?.theme?.fontFamilies ?? {}),
    [layout],
  );
  useWebFontLinks(themeFamilies, active !== null);

  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Reinicia zoom/viewport cada vez que cambia la tarjeta activa — mismo
  // criterio que email-builder (no arrastrar el estado de una tarjeta a la
  // siguiente).
  useEffect(() => {
    setZoomed(false);
    setPreviewViewport("desktop");
  }, [active?.layout.id]);

  useLayoutEffect(() => {
    if (!active) {
      setBox(null);
      return;
    }
    const measure = () => {
      const anchorRect = active.anchor.getBoundingClientRect();
      const boxEl = boxRef.current;
      const boxWidth = boxEl?.offsetWidth ?? BOX_WIDTH;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Preferencia: a la derecha de la tarjeta. Si no cabe, a la izquierda.
      const spaceRight = viewportW - anchorRect.right;
      const openRight = spaceRight >= boxWidth + VIEWPORT_EDGE_GAP;
      const left = openRight
        ? anchorRect.right + 8
        : Math.max(VIEWPORT_EDGE_GAP, anchorRect.left - boxWidth - 8);

      // Verticalmente alineado con el tope de la tarjeta, acotado para no
      // desbordar el viewport por abajo.
      const boxHeight = boxEl?.offsetHeight ?? BOX_MAX_HEIGHT;
      const top = Math.min(
        Math.max(VIEWPORT_EDGE_GAP, anchorRect.top),
        viewportH - boxHeight - VIEWPORT_EDGE_GAP,
      );
      setBox({ top, left });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, preview, zoomed, previewViewport]);

  if (!active || !layout) return null;

  const emuWidth = previewViewport === "mobile" ? PREVIEW_MOBILE_WIDTH : PREVIEW_BASE_WIDTH;
  const scale = zoomed ? BOX_WIDTH / emuWidth : Math.min(1, (BOX_WIDTH - 16) / emuWidth);
  const contentHeight = 900; // tope de referencia; el contenido real puede ser más corto (overflow: hidden lo recorta visualmente).

  return createPortal(
    <div
      ref={boxRef}
      className="pbx-template-hover-preview"
      style={box ? { top: box.top, left: box.left } : { visibility: "hidden" }}
      onMouseEnter={cancelHoverClose}
      onMouseLeave={requestHoverLeave}
    >
      <div className="pbx-template-hover-preview__toolbar">
        <span className="pbx-template-hover-preview__title">{t(layout.labelKey)}</span>
        <button
          type="button"
          className="pbx-template-hover-preview__btn"
          onClick={() => setPreviewViewport((v) => (v === "mobile" ? "desktop" : "mobile"))}
          aria-label={
            previewViewport === "mobile"
              ? t("templates.preview.desktop")
              : t("templates.preview.mobile")
          }
          title={
            previewViewport === "mobile"
              ? t("templates.preview.desktop")
              : t("templates.preview.mobile")
          }
        >
          {previewViewport === "mobile" ? (
            <Monitor size={14} aria-hidden="true" />
          ) : (
            <Smartphone size={14} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="pbx-template-hover-preview__btn"
          onClick={() => setZoomed((z) => !z)}
          aria-label={
            zoomed
              ? t("templates.preview.fit")
              : t("templates.preview.zoom")
          }
          title={
            zoomed
              ? t("templates.preview.fit")
              : t("templates.preview.zoom")
          }
        >
          {zoomed ? <ZoomOut size={14} aria-hidden="true" /> : <ZoomIn size={14} aria-hidden="true" />}
        </button>
      </div>
      <div
        className="pbx-template-hover-preview__viewport"
        style={{ height: Math.max(BOX_MIN_HEIGHT, Math.min(BOX_MAX_HEIGHT, contentHeight * scale)) }}
      >
        {preview ? (
          <>
            <style>{[tokensCss, preview.css].filter(Boolean).join("\n\n")}</style>
            <div
              className="pbx-template-hover-preview__inner"
              data-layout={layout.id}
              style={{ width: emuWidth, transform: `scale(${scale})` }}
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </>
        ) : loading ? (
          <span className="pbx-template-card__spinner" />
        ) : (
          <span className="pbx-template-hover-preview__empty">—</span>
        )}
      </div>
    </div>,
    document.body,
  );
}
