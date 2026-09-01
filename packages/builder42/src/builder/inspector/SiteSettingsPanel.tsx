/**
 * SiteSettingsPanel — configuración de página/sitio centralizada (panel del
 * Inspector cuando NO hay nodo seleccionado). Fase 19.f: se organiza en tabs
 * para descargar el panel (antes todas las secciones se apilaban). Cada tab es
 * una configuración distinta: páginas, idiomas, temas, SEO y ajustes.
 *
 * El estado de la tab es UI-state local (`useState`). Junto a las tabs vive un
 * icono de info (Tooltip c42, P10) que al hover explica qué se hace en la
 * sección activa — antes estaba junto al título "Inspector", que se eliminó
 * (Fase 19.n) para dar más aire al panel.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { FileText, Languages, Palette, Search, SlidersHorizontal, Rocket, Tooltip, Info } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { SiteTab } from "@/builder/store/documentStore";
import { useExperienceLevel } from "@/hooks/useExperienceLevel";
import { fetchHealth } from "@/services/apiClient";
import { PageManager } from "./PageManager";
import { I18nSettings } from "./I18nSettings";
import { SeoSettings } from "./SeoSettings";
import { ThemesEditor } from "./ThemesEditor";
import { SiteFileActions } from "./SiteFileActions";
import { PublishPanel } from "./PublishPanel";
import { PublishedSitesList } from "./PublishedSitesList";

export type { SiteTab };

/** Orden e iconos de las tabs de configuración del sitio. */
export const SITE_TABS: { id: SiteTab; icon: ComponentType<LucideProps> }[] = [
  { id: "pages", icon: FileText },
  { id: "languages", icon: Languages },
  { id: "themes", icon: Palette },
  { id: "seo", icon: Search },
  { id: "settings", icon: SlidersHorizontal },
  { id: "publish", icon: Rocket },
];

/**
 * Tabs ocultas en modo simple (docs/46 §2 D1). Actualmente ninguna: `languages`
 * y `seo` se ocultaban por requerir conceptos técnicos (locales/fallback,
 * canonical/robots/OG), pero el usuario reportó que ese comportamiento era
 * incorrecto (2026-08-28) — deben quedar siempre visibles, en ambos modos.
 * Se conserva el mecanismo (Set vacío) por si una tab futura sí lo necesita.
 */
const SIMPLE_HIDDEN_TABS = new Set<SiteTab>([]);

export function SiteSettingsPanel() {
  const { t } = useTranslation("inspector");
  const [tab, setTab] = useState<SiteTab>("pages");
  const { isSimple, setLevel } = useExperienceLevel();
  // Contador que `PublishedSitesList` observa para re-hacer su fetch tras un
  // publish/republish exitoso en el hermano `PublishPanel` (ver doc de
  // cabecera de `PublishedSitesList.tsx`).
  const [publishRefreshSignal, setPublishRefreshSignal] = useState(0);
  // `PublishPanel` ya se auto-explica cuando `publish.enabled` es `false`
  // (mensaje "disabled" en vez del formulario), pero eso no evita que la tab
  // en sí aparezca en la lista para un host que aún no habilitó publicación
  // — `undefined` (aún no resuelto) mantiene la tab visible para no hacerla
  // parpadear on/off en el primer render.
  const [publishEnabled, setPublishEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    fetchHealth()
      .then((h) => setPublishEnabled(h.publish.enabled))
      .catch(() => setPublishEnabled(false));
  }, []);

  // Petición externa de abrir una tab concreta (p. ej. desde el control
  // `theme-select` del panel de Interactividad cuando no hay temas): se aplica
  // una vez y se limpia, para no volver a forzar la tab si el usuario navega.
  const requestedSiteTab = useDocumentStore((s) => s.requestedSiteTab);
  const clearRequestedSiteTab = useDocumentStore((s) => s.clearRequestedSiteTab);
  useEffect(() => {
    if (requestedSiteTab) {
      // Borde crítico (docs/46 §6): si la navegación programática apunta a
      // una tab oculta en modo simple, subir a avanzado en vez de dejar el
      // panel en blanco (la tab se renderiza pero no tiene botón visible en
      // `visibleTabs`, así que el fallback de abajo la regresaría a "pages"
      // sin que el usuario entienda por qué). Ej: `ProfileMenu` navega a
      // "publish" (siempre visible, no dispara esto); una navegación futura
      // hacia "seo"/"languages" en modo simple sí lo haría.
      if (isSimple && SIMPLE_HIDDEN_TABS.has(requestedSiteTab)) {
        setLevel("advanced");
      }
      setTab(requestedSiteTab);
      clearRequestedSiteTab();
    }
  }, [requestedSiteTab, clearRequestedSiteTab, isSimple, setLevel]);

  // D1/D2 (docs/46 §2): en modo simple se ocultan las tabs técnicas
  // ("languages", "seo"); en avanzado las 6 tabs quedan siempre visibles,
  // igual que hoy (cero regresión, docs/41 D1 sigue derogado). Además, la tab
  // "publish" se oculta por completo (en ambos modos) mientras el host no
  // reporte `publish.enabled` — sin esto, el mensaje "disabled" de
  // `PublishPanel` seguiría siendo alcanzable, solo que detrás de un botón
  // que no debería estar ahí.
  const visibleTabs = SITE_TABS.filter((t) => {
    if (t.id === "publish" && publishEnabled === false) return false;
    if (isSimple && SIMPLE_HIDDEN_TABS.has(t.id)) return false;
    return true;
  });

  // Si la tab activa deja de estar visible (p. ej. el usuario cambia a modo
  // simple estando en "seo") cae a "pages" — mismo fallback que el Inspector
  // usa para su tab de Interactividad condicional. Cubre el segundo borde de
  // docs/46 §6 (tab activa ocultada por un cambio de modo, no solo por una
  // petición programática).
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab("pages");
    }
  }, [visibleTabs, tab]);

  return (
    <div className="pbx-site-settings">
      <div className="pbx-site-settings__tabrow">
        <div
          className="pbx-inspector-tabs pbx-inspector-tabs--wrap"
          role="tablist"
          aria-label={t("siteSettings.tabsAriaLabel")}
        >
          {visibleTabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`pbx-site-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`pbx-site-panel-${id}`}
              className={"pbx-inspector-tab" + (tab === id ? " pbx-inspector-tab--active" : "")}
              onClick={() => setTab(id)}
            >
              <Icon size={13} aria-hidden="true" />
              <span className="pbx-inspector-tab__label">{t(`siteSettings.tabs.${id}`)}</span>
            </button>
          ))}
        </div>

        <Tooltip className="pbx-info-tip" placement="bottom-end" openDelay={60} closeDelay={120}>
          <button
            type="button"
            className="pbx-info-tip__trigger"
            data-c42-tooltip-trigger
            aria-label={t("siteSettings.infoLabel")}
          >
            <Info size={14} aria-hidden="true" />
          </button>
          <span className="pbx-info-tip__content" data-c42-tooltip-content>
            {t(`siteSettings.tabsHelp.${tab}`)}
          </span>
        </Tooltip>
      </div>

      <div
        className="pbx-inspector-tabpanel"
        role="tabpanel"
        id={`pbx-site-panel-${tab}`}
        aria-labelledby={`pbx-site-tab-${tab}`}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {tab === "pages" && <PageManager />}
            {tab === "languages" && <I18nSettings />}
            {tab === "themes" && <ThemesEditor />}
            {tab === "seo" && <SeoSettings />}
            {tab === "settings" && (
              <section className="pbx-site-settings__section">
                <SiteFileActions />
              </section>
            )}
            {tab === "publish" && (
              <section className="pbx-site-settings__section">
                <PublishPanel onPublished={() => setPublishRefreshSignal((n) => n + 1)} />
                <PublishedSitesList refreshSignal={publishRefreshSignal} />
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
