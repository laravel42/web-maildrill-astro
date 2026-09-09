/**
 * Tabs — pestañas con panel por pestaña, **composite con slots** (docs/23).
 * Interactivo: trae de fábrica el behavior `tabs` (`defaultBehaviors`) que
 * muestra el panel activo, anima el cambio (fade+slide) y da navegación por
 * teclado WAI-ARIA (runtime opt-in, docs/10).
 *
 * Modelo children-based (docs/23 §3.1): cada pestaña es un nodo hijo `tab`
 * (`slots.itemType`), con `props.label` = título y `children` = contenido real
 * del panel (arrastrable desde la paleta). El `tabs` es `splitRender`: el botón
 * (en `.pb-tabs__list`) y el panel (en `.pb-tabs__panels`) viven en regiones
 * separadas del DOM, así que se arma desde `ctx.slots` — la tablist con el
 * `label` de cada slot y los paneles envolviendo cada slot ya renderizada.
 *
 * Degrada sin JS (P8/P9): todos los paneles quedan visibles (apilados); el JS
 * oculta los inactivos. En Edit (docs/23 §5, T11) el runtime nunca corre, así
 * que el propio canvas marca `hidden` los paneles no activos y muestra solo el
 * de la pestaña activa (`ctx.activeSlotId`) — click en un botón la activa
 * (`ctx.onActivateSlot`), permitiendo editar/insertar en cualquier pestaña. En
 * export/preview `activeSlotId` es undefined → se renderizan todos (el runtime
 * los gobierna). El `data-pb-behavior` lo añade el export desde
 * `node.behaviors` (docs/10 §4).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStateStyle, resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import { classNameForNode } from "../../export/cssSerializer";
import type { ComponentDefinition, RenderContext } from "../types";

export const TABS_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    size: { width: "100%" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: { color: { token: "colors.text" } },
  },
};

/**
 * CSS estático presentacional (T10, AGENTS.md): layout de la tablist, estados
 * de la pestaña activa/foco y el panel — nada de esto depende de que el
 * behavior `tabs` esté adjunto, así que vive en el COMPONENTE, no en
 * `registry/behaviors/tabs.ts`. Se emite mientras exista al menos un nodo
 * `tabs` en el documento (`usedComponentsCssForNodes`), con o sin JS.
 *
 * `.pb-tabs__list { width: 0; min-width: 100% }` (bug real, preservado de la
 * migración): el truncado del label (`.pb-tabs__tab`, `overflow:hidden` +
 * `text-overflow:ellipsis` + flex-shrink) solo funciona si el ancho del
 * flex-container es DEFINIDO. En un ancestro shrink-to-fit (padre
 * `inline-block`, `width:fit-content`, una celda flex/grid que ajusta al
 * contenido…), `width:100%` se resuelve contra el propio contenido → el
 * navegador usa el max-content del label → la tab NO trunca y estira el
 * contenedor (overflow, en canvas/preview/export por igual — es puro layout,
 * no depende del runtime). El truco `width:0; min-width:100%` hace que la
 * aportación intrínseca (max-content) de la lista sea 0 —así no ensancha a un
 * padre que se ajusta al contenido— pero sigue llenando el 100% del ancho
 * disponible cuando lo hay, y las tabs truncan dentro de ese ancho.
 */
const TABS_CSS = [
  ".pb-tabs__list { display: flex; gap: 4px; width: 0; min-width: 100%; max-width: 100%; border-bottom: 1px solid var(--colors-border, rgba(0, 0, 0, 0.12)); }",
  ".pb-tabs__tab { appearance: none; border: none; background: transparent; padding: 10px 16px; cursor: pointer; font: inherit; color: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; min-width: 0; max-width: 100%; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
  '.pb-tabs__tab[aria-selected="true"] { border-bottom-color: var(--colors-primary-default, #2563eb); color: var(--colors-primary-default, #2563eb); font-weight: 600; }',
  ".pb-tabs__tab:focus-visible { outline: 2px solid var(--colors-primary-default, #2563eb); outline-offset: -2px; border-radius: 4px; }",
  ".pb-tabs__panel { padding: 16px 4px; }",
].join("\n");

function TabsRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, slots, slotAffordance, activeSlotId, onActivateSlot } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const base = `pb-tabs-${node.id}`;
  const items = slots ?? [];

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = ["pb-tabs", className, rootClassName].filter(Boolean).join(" ") || undefined;

  // T9: clase derivada del botón (`n-{id}--tab`), a la que se ancla la regla
  // CSS del estado "selected" en el HTML exportado (`export/exportToHtml.ts`/
  // `site.ts`, vía `styleSchema.states`). En canvas (`!exportMode`) el estado
  // no puede expresarse con un pseudo-selector (no hay `[aria-selected]` real
  // que el navegador resuelva por sí solo de forma útil aquí, y `NodeRenderer`
  // no inyecta CSS de clase por nodo) — como SÍ sabemos qué botón está
  // seleccionado, se aplica `resolveStateStyle` como `style` inline solo a esa
  // pestaña, igual de fiel al modelo sin necesitar un `<style>` extra.
  const tabButtonClassName = classNameForNode(node.id, "tab");
  const selectedInlineStyle: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStateStyle(node.style, "selected"));

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      <div className="pb-tabs__list" role="tablist">
        {items.map((slot, i) => {
          const raw = slot.node.props.label;
          const label = typeof raw === "string" && raw !== "" ? raw : "Tab";
          // Pestaña seleccionada: la activa en edición (docs/23 §5, T11) si el
          // canvas la fijó (`activeSlotId`, solo en Edit); si no (export/
          // preview, o ninguna activa aún), la primera — comportamiento previo.
          const selected = activeSlotId ? slot.id === activeSlotId : i === 0;
          return (
            <button
              key={slot.id}
              className={`pb-tabs__tab ${tabButtonClassName}`}
              type="button"
              role="tab"
              id={`${base}-tab-${i}`}
              aria-controls={`${base}-panel-${i}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              title={label}
              style={selected ? selectedInlineStyle : undefined}
              // Solo en Edit: click en la pestaña la activa para editar su panel
              // (docs/23 §5, T11). `undefined` en export/preview (P8) → el
              // runtime real gobierna el cambio de pestaña.
              onClick={onActivateSlot ? () => onActivateSlot(slot.id) : undefined}
            >
              {label}
            </button>
          );
        })}
        {slotAffordance}
      </div>
      <div className="pb-tabs__panels">
        {items.map((slot, i) => {
          const selected = activeSlotId ? slot.id === activeSlotId : i === 0;
          return (
            <div
              key={slot.id}
              className="pb-tabs__panel"
              role="tabpanel"
              id={`${base}-panel-${i}`}
              aria-labelledby={`${base}-tab-${i}`}
              // En Edit (docs/23 §5, T11) se muestra SOLO el panel de la pestaña
              // activa (`activeSlotId`): "cambiar de pestaña" en el canvas. En
              // export/preview (`activeSlotId` undefined) todos los paneles se
              // renderizan (apilados sin JS, P8/P9); el runtime oculta los
              // inactivos al hidratar.
              hidden={activeSlotId ? !selected : undefined}
            >
              {slot.content}
            </div>
          );
        })}
      </div>
      {!exportMode && items.length === 0 ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty tabs — add a tab
        </span>
      ) : null}
    </div>
  );
}

export const tabsDefinition: ComponentDefinition = {
  type: "tabs",
  label: "Pestañas",
  category: "content",
  acceptsChildren: true,
  slots: { itemType: "tab", min: 1, addLabel: "Add tab", splitRender: true },
  defaultProps: {},
  defaultStyle: structuredClone(TABS_DEFAULT_STYLE),
  defaultBehaviors: [{ type: "tabs", options: { duration: 220 } }],
  css: TABS_CSS,
  // Un `tabs` nuevo nace con 3 pestañas, cada una con un `text` de contenido
  // (docs/23 §7). El usuario añade/quita/reordena pestañas y edita su contenido.
  defaultChildren: [
    { type: "tab", props: { label: "Overview" }, children: [{ type: "text", props: { content: "<p>General details about the product or service.</p>" } }] },
    { type: "tab", props: { label: "Specs" }, children: [{ type: "text", props: { content: "<p>Technical sheet and key features.</p>" } }] },
    { type: "tab", props: { label: "Reviews" }, children: [{ type: "text", props: { content: "<p>What our customers say.</p>" } }] },
  ],
  propsSchema: { fields: [] },
  styleSchema: {
    enabledGroups: ["typography", "spacing", "size", "appearance"],
    // T9: el botón de cada `tab` admite un estilo distinto cuando está
    // seleccionado (hoy fijo en `TABS_CSS`; con esto el usuario lo edita desde
    // el Inspector). `classSuffix: "tab"` → clase derivada `n-{id}--tab`,
    // aplicada a cada botón en `TabsRender` (`classNameForNode`).
    states: [{ state: "selected", classSuffix: "tab", label: "Selected" }],
  },
  render: TabsRender,
};
