/**
 * Sidebar izquierdo — dos pestañas (chrome del editor, docs/05):
 *  - "Componentes": paleta del registry (draggable como `new-component`, y
 *    en touch/tablet — cuando `reorderControlsVisible` — también "tomable"
 *    con un tap directo para iniciar un pick & insert nuevo, Vía B, docs/24
 *    §3.1b). En desktop el tap NO inicia pick & insert (bug real, feedback
 *    de usuario: el click sintético que el navegador dispara al soltar tras
 *    un mousedown+drag colisionaba con el DnD nativo, duplicando el nodo o
 *    dejando un pick & insert fantasma armado) — mismo criterio de
 *    visibilidad que el resto del sistema touch (`SelectionHandle`/
 *    `PickInsertBar`, docs/24 §2/§4): si el usuario desactiva o deja en
 *    automático los controles touch, este flujo se desactiva con ellos.
 *  - "Tokens": editor CRUD de design tokens del sitio (docs/08 §5-6).
 *
 * Fase 11: iconos SVG por categoría, micro-icono por tipo de componente,
 * paleta como cards con hover visual.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { getDefinition, listDefinitionsByCategory } from "@/builder/registry/componentRegistry";
import { useDraggable } from "@/builder/dnd/useDraggable";
import { useDocumentStore } from "@/builder/store/documentStore";
import { useReorderControlsVisible } from "@/hooks/usePointerCoarse";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import type { DragData } from "@/builder/dnd/contract";
import type { ComponentCategory, ComponentDefinition } from "@/builder/registry/types";
import {
  ComponentTypeIcon,
  GripVertical,
  LayoutGrid,
  Type,
  ClipboardList,
  Navigation,
  Star,
  ChevronDown,
} from "@/components";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { TokensEditor } from "./TokensEditor";
import { TemplatesPanel } from "./TemplatesPanel";

// ---------------------------------------------------------------------------
// Iconos por categoría — Lucide (Fase 11.f), 16×16 vía CSS, currentColor
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<ComponentCategory, ComponentType<LucideProps>> = {
  layout:     LayoutGrid,
  content:    Type,
  form:       ClipboardList,
  navigation: Navigation,
};

// ---------------------------------------------------------------------------
// Sección "Básicos" (docs/39 §2.5, D1 docs/41: la sección pasa a estar
// SIEMPRE visible tras borrar `uiComplexity` — antes solo aparecía en modo
// simple): ~10 componentes de uso frecuente que cubren el 90% de una
// landing, antepuestos a las categorías normales. No se deduplican de su
// categoría original (mismo `SidebarItem`, misma UX de drag/tap).
//
// docs/46 §3 Fase 3 (H3): los 10 tipos en un solo grid plano superaban el
// techo de 4 opciones simultáneas del criterio de aceptación #5. Se dividen
// en 3 subgrupos de ≤4 con el MISMO `CategoryAccordion` que ya agrupa las
// categorías normales (reutilización, no un primitivo nuevo): "Esenciales"
// (los 4 bloques mínimos de cualquier landing), "Contenido" (bloques grandes
// ya armados) y "Utilidad" (espaciado/estructura + formulario). El primero
// queda abierto por defecto (mismo criterio que antes: lo más frecuente,
// visible sin un click extra); los otros dos colapsados.
// ---------------------------------------------------------------------------

const BASICS_GROUPS = [
  { key: "essentials", types: ["section", "text", "image", "button"] as const },
  { key: "content", types: ["hero", "card", "footer"] as const },
  { key: "utility", types: ["divider", "spacer", "form"] as const },
] as const;

// ---------------------------------------------------------------------------
// Acordeón de categoría (layout/content/form/navigation, y ahora también los
// subgrupos de "Básicos" — docs/46 §3 Fase 3) — mismo patrón visual que
// `TokenGroupAccordion` (TokensEditor.tsx) y `StyleGroupAccordion` del
// Inspector: reutiliza las clases `pbx-style-group*` ya existentes
// (inspector-controls.css). `defaultOpen` (default `false`) permite abrir el
// primer subgrupo de "Básicos" sin un click extra, igual que antes de
// dividirlo en subgrupos, mientras las categorías normales siguen
// colapsadas por defecto para no abrumar con las ~40 opciones restantes.
// ---------------------------------------------------------------------------

function CategoryAccordion({
  title,
  count,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`pbx-style-group${open ? " pbx-style-group--open" : " pbx-style-group--collapsed"}`}>
      <button
        type="button"
        className="pbx-style-group__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {icon ? <span className="pbx-style-group__icon">{icon}</span> : null}
        <span className="pbx-style-group__name">
          {title} ({count})
        </span>
        <motion.span
          className="pbx-palette__accordion-chevron"
          aria-hidden="true"
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="pbx-palette__accordion-body-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="pbx-style-group__body">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ def }: { def: ComponentDefinition }) {
  const { t } = useTranslation("sidebar");
  const { t: tc } = useTranslation("common");
  const ref = useRef<HTMLElement>(null);
  const translatedLabel = tc(`components.${def.type}`, { defaultValue: def.label });
  const getData = useCallback<() => DragData>(
    () => ({ kind: "new-component", componentType: def.type }),
    [def.type],
  );
  const getPreviewLabel = useCallback(() => translatedLabel, [translatedLabel]);
  const { dragging } = useDraggable(ref, getData, true, getPreviewLabel);
  const startPickInsertNew = useDocumentStore((s) => s.startPickInsertNew);
  const reorderControlsVisible = useReorderControlsVisible();
  // Tap-to-pick (Vía B, docs/24 §3.1b) solo cuando los controles touch están
  // activos (`reorderControlsVisible`, misma preferencia `reorderControls`
  // que rige el resto del sistema — SelectionHandle/PickInsertBar, docs/24
  // §2/§4): en desktop el drag nativo (`useDraggable`, arriba) ya cubre
  // colocar el componente, y el CLICK SINTÉTICO que el navegador dispara al
  // soltar un elemento tras un mousedown+drag con desplazamiento mínimo
  // colisionaba con este `onClick` — el mismo gesto de arrastrar y soltar
  // terminaba disparando AMBOS sistemas (el DnD colocaba el nodo Y el click
  // armaba un pick & insert nuevo), duplicando el componente al soltar de
  // nuevo o dejando un pick & insert fantasma activo (bug real, feedback de
  // usuario). "Todo esto es parte de un mismo sistema": si el usuario
  // desactiva/deja en automático los controles touch, este flujo de
  // click-para-tomar debe desactivarse igual que las flechas/mover.
  const handleClick = useCallback(() => {
    if (!reorderControlsVisible) return;
    startPickInsertNew(def.type);
  }, [def.type, startPickInsertNew, reorderControlsVisible]);

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={"pbx-palette__item" + (dragging ? " pbx-palette__item--dragging" : "")}
      onClick={handleClick}
      title={t("palette.dragTooltip")}
    >
      <GripVertical className="pbx-palette__grip" aria-hidden="true" />
      <ComponentTypeIcon type={def.type} className="pbx-palette__icon" />
      <span className="pbx-palette__label">{translatedLabel}</span>
    </button>
  );
}

function ComponentsPanel() {
  const { t } = useTranslation("sidebar");
  const groups = listDefinitionsByCategory();
  const basicsGroups = useMemo(
    () =>
      BASICS_GROUPS.map((g) => ({
        key: g.key,
        defs: g.types.map((type) => getDefinition(type)).filter((def): def is ComponentDefinition => def != null),
      })).filter((g) => g.defs.length > 0),
    [],
  );
  return (
    <>
      {basicsGroups.length > 0 ? (
        <div className="pbx-palette__group">
          <h3 className="pbx-palette__category">
            <Star className="pbx-palette__cat-icon" aria-hidden="true" />
            {t("palette.categories.basics")}
          </h3>
          {basicsGroups.map((g, idx) => (
            <CategoryAccordion
              key={g.key}
              title={t(`palette.categories.basicsGroups.${g.key}`)}
              count={g.defs.length}
              defaultOpen={idx === 0}
            >
              <div className="pbx-palette">
                {g.defs.map((def) => (
                  <SidebarItem key={`basics-${def.type}`} def={def} />
                ))}
              </div>
            </CategoryAccordion>
          ))}
        </div>
      ) : null}
      {groups.map((group) => {
        const CatIcon = CATEGORY_ICONS[group.category as ComponentCategory];
        return (
          <CategoryAccordion
            key={group.category}
            title={t(`palette.categories.${group.category}`)}
            count={group.definitions.length}
            icon={CatIcon ? <CatIcon size={14} aria-hidden="true" /> : null}
          >
            <div className="pbx-palette">
              {group.definitions.map((def) => (
                <SidebarItem key={def.type} def={def} />
              ))}
            </div>
          </CategoryAccordion>
        );
      })}
    </>
  );
}

type SideTab = "components" | "tokens" | "templates";

const ALL_TAB_IDS: SideTab[] = ["components", "tokens", "templates"];

export function Sidebar() {
  const { t } = useTranslation("sidebar");
  const [tab, setTab] = useState<SideTab>("components");
  const [sidebarCollapsed] = useLocalConfig("sidebarCollapsed");
  // D1 (docs/41 §3): `uiComplexity` se elimina por completo — la tab
  // "Tokens" queda SIEMPRE disponible (antes solo en modo avanzado).
  const tabIds = ALL_TAB_IDS;
  const activeTab = tabIds.includes(tab) ? tab : "components";

  return (
    <aside
      className={
        "pbx-sidebar" +
        (!sidebarCollapsed ? " pbx-sidebar--open" : "")
      }
    >
      <div className="pbx-side-tabs" role="tablist" aria-label={t("tabs.ariaLabel")}>
        {tabIds.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`pbx-side-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`pbx-side-panel-${id}`}
            className={"pbx-side-tabs__trigger" + (activeTab === id ? " pbx-side-tabs__trigger--active" : "")}
            onClick={() => setTab(id)}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      <div
        className="pbx-side-tabs__panel"
        role="tabpanel"
        id={`pbx-side-panel-${activeTab}`}
        aria-labelledby={`pbx-side-tab-${activeTab}`}
      >
        {activeTab === "components" ? (
          <ComponentsPanel />
        ) : activeTab === "tokens" ? (
          <TokensEditor />
        ) : (
          <TemplatesPanel />
        )}
      </div>
    </aside>
  );
}
