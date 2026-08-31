/**
 * Panel "Plantillas" del sidebar (Fase 13, docs/16 §13).
 * Plantillas de página (reemplazo con confirmación) y de sección (pick & insert).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listLayoutsByCategory,
  loadPageLayout,
  type LayoutCategory,
  type LayoutDefinition,
  type PageLayoutDefinition,
  type SectionLayoutDefinition,
} from "@/builder/registry/layoutRegistry";
import { useDocumentStore } from "@/builder/store/documentStore";
import { useDraggable } from "@/builder/dnd/useDraggable";
import { fragmentPreviewMarkup, layoutPreviewMarkup } from "@/builder/dnd/ghost";
import { cssVarName, tokensToCss } from "@/builder/model/tokens";
import { themesToCss } from "@/builder/model/theme";
import { useReorderControlsVisible } from "@/hooks/usePointerCoarse";
import { useWebFontLinks } from "@/hooks/useWebFontLinks";
import {
  SimpleModal,
  IconButton,
  CloseIcon,
  LayoutGrid,
  FileText,
  Tooltip,
  Info,
} from "@/components";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { DragData } from "@/builder/dnd/contract";
import { AiSectionGenerator } from "@/builder/inspector/AiSectionGenerator";

const CATEGORY_ICONS: Record<LayoutCategory, ComponentType<LucideProps>> = {
  page: FileText,
  section: LayoutGrid,
};

/** Ancho de referencia del contenedor "de escritorio" simulado en la miniatura
 * (~ `sizes.container` real, docs/38 §2.2). El `scale()` lo comprime al ancho
 * real de la tarjeta. */
const PREVIEW_BASE_WIDTH = 1200;

type PreviewMarkup = { html: string; css: string };

/**
 * CSS del tema propio de la plantilla, scopeado a **su** tarjeta (docs/48 §3.3).
 *
 * La miniatura debe mostrar la personalidad de la plantilla (color + tipografía)
 * **antes** de aplicarla, y sin efectos secundarios: el tema no está registrado
 * en el sitio todavía, así que se emiten sus deltas de token como custom
 * properties dentro del selector de la tarjeta, superpuestas a las del sitio. Las
 * familias de `theme.fontFamilies` se emiten como `--typography-families-<key>`
 * (su *stack*); el archivo de la fuente lo carga `useWebFontLinks`.
 */
function layoutThemePreviewCss(layout: LayoutDefinition, scopeSelector: string): string {
  const theme = layout.theme;
  if (!theme) return "";
  const decls = Object.entries(theme.tokens).map(
    ([path, value]) => `  ${cssVarName(path)}: ${value};`,
  );
  for (const [key, family] of Object.entries(theme.fontFamilies ?? {})) {
    decls.push(`  ${cssVarName(`typography.families.${key}`)}: ${family.stack};`);
  }
  if (decls.length === 0) return "";
  return `${scopeSelector} {\n${decls.join("\n")}\n}`;
}

/**
 * Markup (html+css) de la miniatura de un layout, cacheado por `layoutId`
 * mientras el panel esté montado (docs/38 §2.3) — el html/css del fragmento no
 * varía (el tema activo se inyecta aparte, scopeado por tarjeta), así que no
 * hace falta recalcularlo.
 *
 * Dos caminos, por la carga perezosa de docs/48 §4:
 *  - **sección**: `layoutPreviewMarkup` es síncrono, se resuelve en el primer render.
 *  - **página**: el fragmento llega por `import()`, y solo se pide cuando la
 *    tarjeta es **visible** (`visible`), para no traer 20 módulos de plantilla al
 *    abrir el panel.
 */
const previewCache = new Map<string, PreviewMarkup | null>();

function useLayoutPreviewMarkup(
  layout: LayoutDefinition,
  visible: boolean,
): { preview: PreviewMarkup | null; loading: boolean } {
  const layoutId = layout.id;
  const isSection = layout.category === "section";

  // Las secciones no necesitan estado asíncrono: se calculan en el render.
  const sectionPreview = useMemo(() => {
    if (!isSection) return null;
    if (previewCache.has(layoutId)) return previewCache.get(layoutId) ?? null;
    const result = layoutPreviewMarkup(layoutId, "base");
    previewCache.set(layoutId, result);
    return result;
  }, [isSection, layoutId]);

  const [pagePreview, setPagePreview] = useState<PreviewMarkup | null>(() =>
    previewCache.get(layoutId) ?? null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSection || !visible) return;
    if (previewCache.has(layoutId)) {
      setPagePreview(previewCache.get(layoutId) ?? null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadPageLayout(layoutId).then((loaded) => {
      const markup = loaded ? fragmentPreviewMarkup(loaded.fragment, "base") : null;
      previewCache.set(layoutId, markup);
      if (cancelled) return;
      setPagePreview(markup);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isSection, visible, layoutId]);

  if (isSection) return { preview: sectionPreview, loading: false };
  return { preview: pagePreview, loading };
}

/**
 * `true` en cuanto el elemento entra (o está a punto de entrar) en el viewport
 * del panel, y ya no vuelve a `false`: solo sirve para disparar la carga una vez.
 * Sin `IntersectionObserver` (jsdom) devuelve `true` de entrada, para que los
 * tests no dependan de un observer simulado.
 */
function useVisibleOnce(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      // Margen generoso: la tarjeta empieza a cargar justo antes de asomar.
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, visible]);
  return visible;
}

/**
 * Miniatura visual del fragmento (docs/38 §2.2): `<div>` escalado con el
 * html/css real del layout + CSS scopeado de tokens/tema activo. Sin runtime,
 * sin iframe (`aria-hidden`, decorativo — el label textual ya identifica la
 * tarjeta).
 */
function TemplateCardPreview({
  layout,
  visible,
}: {
  layout: LayoutDefinition;
  visible: boolean;
}) {
  const layoutId = layout.id;
  const { preview, loading } = useLayoutPreviewMarkup(layout, visible);
  const tokens = useDocumentStore((s) => s.site.meta.tokens);
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const defaultThemeId = useDocumentStore((s) => s.site.meta.defaultThemeId);
  const breakpoints = useDocumentStore((s) => s.site.meta.breakpoints);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const scopeSelector = `.pbx-template-card__preview[data-layout="${layoutId}"]`;
  const tokensCss = useMemo(
    () =>
      [
        tokensToCss(tokens, scopeSelector, breakpoints),
        themesToCss(tokens, themes, defaultThemeId, {
          rootSelector: scopeSelector,
          includePrefersColorScheme: false,
        }),
        // Tema propio de la plantilla (docs/48 §3): se superpone a los tokens del
        // sitio SOLO dentro de esta tarjeta, para que la miniatura muestre la
        // personalidad de la plantilla sin tocar el sitio del usuario.
        layoutThemePreviewCss(layout, scopeSelector),
      ]
        .filter(Boolean)
        .join("\n\n"),
    [tokens, themes, defaultThemeId, breakpoints, scopeSelector, layout],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const width = el.clientWidth || 1;
      setScale(width / PREVIEW_BASE_WIDTH);
    };
    compute();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!preview) {
    return (
      <div
        ref={containerRef}
        className="pbx-template-card__preview pbx-template-card__preview--empty"
        data-layout={layoutId}
        aria-hidden="true"
      >
        {loading ? <span className="pbx-template-card__spinner" /> : "—"}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pbx-template-card__preview"
      data-layout={layoutId}
      aria-hidden="true"
    >
      <style>{[tokensCss, preview.css].filter(Boolean).join("\n\n")}</style>
      <div
        className="pbx-template-card__preview-inner"
        style={{ transform: `scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: preview.html }}
      />
    </div>
  );
}

/**
 * Fila de título de la tarjeta (docs/38 corrección): el título siempre visible;
 * la descripción vive en un tooltip accesible disparado por el botón "info"
 * (mismo patrón que `SiteSettingsPanel.tsx`/`TokensEditor.tsx`: `Tooltip` de
 * c42-react + `pbx-info-tip*`, P10).
 */
function TemplateCardLabelRow({ label }: { label: string }) {
  return (
    <span className="pbx-template-card__label-row">
      <span className="pbx-template-card__label">{label}</span>
    </span>
  );
}

/** Botón "info" con la descripción de la plantilla; hermano del control principal. */
function TemplateCardInfo({ descriptionKey }: { descriptionKey?: string }) {
  const { t } = useTranslation("sidebar");
  if (!descriptionKey) return null;
  return (
    <Tooltip
      className="pbx-info-tip pbx-template-card__info"
      placement="top"
      openDelay={60}
      closeDelay={120}
    >
      <button
        type="button"
        className="pbx-info-tip__trigger"
        data-c42-tooltip-trigger
        aria-label={t("templates.descInfoLabel")}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      <span className="pbx-info-tip__content" data-c42-tooltip-content>
        {t(descriptionKey)}
      </span>
    </Tooltip>
  );
}

/**
 * Cuerpo visual de la tarjeta: miniatura + etiqueta, **inerte**.
 *
 * `inert` (no solo `aria-hidden`) porque la miniatura pinta el HTML REAL del
 * fragmento (docs/38 §2.2) y ese HTML trae controles propios: el `<button>` del
 * toggle de un `navbar`, el submit de un `form`… Marcado únicamente
 * `aria-hidden` seguirían siendo enfocables con Tab — un control anunciado como
 * oculto que igual recibe foco.
 */
function TemplateCardBody({
  layout,
  label,
  visible,
}: {
  layout: LayoutDefinition;
  label: string;
  visible: boolean;
}) {
  return (
    <div className="pbx-template-card__body" inert>
      <TemplateCardPreview layout={layout} visible={visible} />
      <TemplateCardLabelRow label={label} />
    </div>
  );
}

function SectionTemplateCard({ layout }: { layout: SectionLayoutDefinition }) {
  const { t } = useTranslation("sidebar");
  const ref = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleOnce(cardRef);
  const startPickInsertFragment = useDocumentStore((s) => s.startPickInsertFragment);
  const reorderControlsVisible = useReorderControlsVisible();
  const getData = useCallback<() => DragData>(
    () => ({ kind: "fragment", layoutId: layout.id }),
    [layout.id],
  );
  const translatedLabel = t(layout.labelKey);
  const getPreviewLabel = useCallback(() => translatedLabel, [translatedLabel]);
  const { dragging } = useDraggable(ref, getData, true, getPreviewLabel);

  // Tap-to-pick (Vía B, docs/24 §3.1b) solo en touch/tablet, mismo criterio
  // que `SidebarItem` (Sidebar.tsx): en desktop el drag nativo (`useDraggable`,
  // arriba) ya cubre la inserción, y el click sintético que dispara el
  // navegador al soltar tras un mousedown+drag colisiona con este `onClick`.
  const handleClick = useCallback(() => {
    if (!reorderControlsVisible) return;
    startPickInsertFragment(layout.id);
  }, [layout.id, startPickInsertFragment, reorderControlsVisible]);

  return (
    <div
      ref={cardRef}
      className={
        "pbx-template-card pbx-template-card--section" +
        (dragging ? " pbx-template-card--dragging" : "")
      }
    >
      <TemplateCardBody layout={layout} label={translatedLabel} visible={visible} />
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className="pbx-template-card__action"
        aria-label={translatedLabel}
        onClick={handleClick}
        title={t("templates.sectionTooltip")}
      />
      <TemplateCardInfo descriptionKey={layout.descriptionKey} />
    </div>
  );
}

function PageTemplateCard({
  layout,
  onSelect,
}: {
  layout: PageLayoutDefinition;
  onSelect: (layoutId: string) => void;
}) {
  const { t } = useTranslation("sidebar");
  const translatedLabel = t(layout.labelKey);
  const cardRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleOnce(cardRef);

  // Webfonts del tema de la plantilla (docs/48 §3.3): sin esto la miniatura
  // muestra la tipografía de personalidad con el fallback de sistema. Solo se
  // pide cuando la tarjeta está visible, para no traer 20 fuentes al abrir el
  // panel.
  const themeFamilies = useMemo(
    () => Object.values(layout.theme?.fontFamilies ?? {}),
    [layout.theme],
  );
  useWebFontLinks(themeFamilies, visible);

  return (
    <div ref={cardRef} className="pbx-template-card pbx-template-card--page">
      <TemplateCardBody layout={layout} label={translatedLabel} visible={visible} />
      <button
        type="button"
        className="pbx-template-card__action"
        aria-label={translatedLabel}
        onClick={() => onSelect(layout.id)}
      />
      <TemplateCardInfo descriptionKey={layout.descriptionKey} />
    </div>
  );
}

function PageLayoutConfirmModal({
  layoutId,
  onClose,
}: {
  layoutId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("sidebar");
  const applyPageLayout = useDocumentStore((s) => s.applyPageLayout);
  const [applying, setApplying] = useState(false);
  const layout = listLayoutsByCategory()
    .flatMap((g) => g.layouts)
    .find((l) => l.id === layoutId);

  // `applyPageLayout` es asíncrona desde la carga perezosa (docs/48 §4): el
  // fragmento se importa al confirmar. El modal se queda abierto con el botón en
  // estado de espera hasta que termina, para no cerrarse antes de que el canvas
  // muestre la plantilla.
  const handleApply = () => {
    setApplying(true);
    void applyPageLayout(layoutId).finally(() => {
      setApplying(false);
      onClose();
    });
  };

  // Portal a `document.body` vía `SimpleModal` (bug real, feedback de
  // usuario: "aparece un modal pero se cierra al instante"/"los templates no
  // se insertan"). El `Modal` de c42-react tiene un defecto confirmado bajo
  // `React.StrictMode` (activo en `main.tsx`) cuando se monta como resultado
  // de una actualización de estado posterior al montaje inicial — exactamente
  // este caso (click en la tarjeta → aparece el modal): el controller
  // imperativo del paquete pierde el estado de React que lo activó durante el
  // doble-invocado de efectos de StrictMode. `SimpleModal` (`src/components/`)
  // reimplementa el mismo contrato de marcado/CSS con `useState`/`useEffect`
  // planos, StrictMode-safe (ver comentario en su código fuente).
  return (
    <SimpleModal className="pbx-modal" onClose={onClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div data-c42-modal-content className="pbx-modal__content pbx-template-confirm">
        <div className="pbx-modal__header">
          <div>
            <h3 className="pbx-modal__title">{t("templates.confirm.title")}</h3>
            <p className="pbx-modal__subtitle">
              {t("templates.confirm.body", {
                name: layout ? t(layout.labelKey) : layoutId,
              })}
            </p>
          </div>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("templates.confirm.cancel")}
            data-c42-modal-close
          />
        </div>
        <div className="pbx-modal__body pbx-template-confirm__actions">
          <button type="button" className="pbx-template-confirm__btn" onClick={onClose}>
            {t("templates.confirm.cancel")}
          </button>
          <button
            type="button"
            className="pbx-template-confirm__btn pbx-template-confirm__btn--primary"
            onClick={handleApply}
            disabled={applying}
            aria-busy={applying || undefined}
          >
            {applying ? t("templates.confirm.applying") : t("templates.confirm.apply")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}

export function TemplatesPanel() {
  const { t } = useTranslation("sidebar");
  const [pendingPageLayout, setPendingPageLayout] = useState<string | null>(null);
  const groups = listLayoutsByCategory();

  return (
    <>
      
      {groups.map((group) => {
        const CatIcon = CATEGORY_ICONS[group.category];
        return (
          <div key={group.category} className="pbx-template__group">
            <h3 className="pbx-palette__category">
              {CatIcon && <CatIcon className="pbx-palette__cat-icon" aria-hidden="true" />}
              {t(`templates.categories.${group.category}`)}
            </h3>
            <div className="pbx-template__grid">
              {group.layouts.map((layout) =>
                layout.category === "page" ? (
                  <PageTemplateCard
                    key={layout.id}
                    layout={layout}
                    onSelect={setPendingPageLayout}
                  />
                ) : (
                  <SectionTemplateCard key={layout.id} layout={layout} />
                ),
              )}
            </div>
          </div>
        );
      })}
      {pendingPageLayout ? (
        <PageLayoutConfirmModal
          layoutId={pendingPageLayout}
          onClose={() => setPendingPageLayout(null)}
        />
      ) : null}
      <AiSectionGenerator />
    </>
  );
}
