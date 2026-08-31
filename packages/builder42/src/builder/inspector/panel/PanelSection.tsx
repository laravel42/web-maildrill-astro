/**
 * PanelSection — encabezado de sección + cuerpo colapsable del panel de
 * propiedades unificado (docs/41 §4.1, §5.3, Paso 2 de la tabla §7).
 * Primitiva de PRESENTACIÓN pura: recibe el conteo de modificados y el
 * estado de expansión de la sección YA CALCULADOS por props — no lee
 * `PANEL_SECTIONS` ni el store.
 *
 * Encabezado 40px: icono opcional + nombre a la izquierda, badge de conteo +
 * chevron a la derecha. Sin tarjetas con borde (docs/41 §5.3): la separación
 * entre secciones es una línea de 1px al ~8% de opacidad, no un contenedor.
 *
 * **Cambio (fase 2 de simplificación del panel, petición explícita del
 * usuario):** este componente ya NO tiene un bloque "Avanzado ⌄" propio.
 * Antes recibía `advancedChildren`/`advancedOpen`/`onToggleAdvanced` para
 * pintar un disclosure LOCAL por sección; se eliminó porque el gateo de
 * filas avanzadas pasó a ser GLOBAL vía `useExperienceLevel` (ver
 * `StylePanel.tsx`) — mantener los dos mecanismos a la vez era redundante.
 * `children` ahora recibe TODAS las filas ya filtradas por quien llama
 * (`StylePanel`), sin distinción visual entre "común" y "avanzada".
 */

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "@/components";

export interface PanelSectionProps {
  /** Nombre de la sección, ya traducido (p. ej. `t("panel.sections.layout")`). */
  label: string;
  /** Icono opcional de 14px (el llamador pasa el componente ya dimensionado). */
  icon?: ReactNode;
  /**
   * Nº de propiedades modificadas en el breakpoint activo (docs/41 §4.2,
   * `modifiedCountAt` del Paso 1). `0` → badge gris/oculto; `>0` → azul
   * (única superficie de "modificado" fuera del campo mismo, D4/§10.9: el
   * azul del panel SOLO significa esto, nunca decorativo).
   */
  modifiedCount: number;
  /** Filas visibles de la sección (ya filtradas por tier + experienceLevel por el llamador). */
  children: ReactNode;
  /** Estado de expansión de la sección completa. Controlado por el llamador. */
  open: boolean;
  onToggleOpen: () => void;
  /** `id` estable de la sección (docs/41 §4.2 `SectionDescriptor.id`), para `aria-controls` y tests. */
  id: string;
}

export function PanelSection({
  label,
  icon,
  modifiedCount,
  children,
  open,
  onToggleOpen,
  id,
}: PanelSectionProps) {
  const bodyId = `pbx-panel-section-body-${id}`;

  const badgeClassName = [
    "pbx-panel-section__badge",
    modifiedCount > 0 ? "pbx-panel-section__badge--active" : "pbx-panel-section__badge--zero",
  ].join(" ");

  return (
    <section className="pbx-panel-section">
      <button
        type="button"
        className="pbx-panel-section__trigger"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        {icon != null && <span className="pbx-panel-section__icon">{icon}</span>}
        <span className="pbx-panel-section__name">{label}</span>
        {/* Con 0 modificados el badge sigue en el DOM para que el ancho del
            encabezado no cambie al cruzar de breakpoint (docs/41 §10.7), pero
            se oculta a la tecnología asistiva: "Layout 0" no aporta nada al
            nombre accesible del trigger. */}
        <span className={badgeClassName} aria-hidden={modifiedCount === 0 ? "true" : undefined}>
          {modifiedCount}
        </span>
        <span className="pbx-panel-section__chevron" aria-hidden="true">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div className="pbx-panel-section__body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
