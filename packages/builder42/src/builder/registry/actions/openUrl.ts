/**
 * `open-url` — navega a una URL libre al hacer click (docs/44 §4 fila P2).
 * Hace clickable un bloque entero (`card`, `container`, `image`) sin
 * envolverlo en un `<a>` a mano. A diferencia de `scroll-to`/`close-modal`
 * (`targetKind: "modal"`/`"node"`, un objetivo DENTRO del documento), esta
 * acción apunta a una URL arbitraria fuera del árbol: `targetKind: "none"`,
 * la URL viaja en `params.url` (validada por `optionsSchema`), no en
 * `NodeAction.target`.
 *
 * Desviación documentada de "tier 0" (mismo criterio que `scroll-to`, ver
 * `runtime/actions/openUrl.ts`): con SOLO un `<a href="…">` bastaría si el
 * nodo ya renderizara como link nativo, pero esta acción se ofrece en
 * CUALQUIER nodo (`appliesTo` ausente = todos), incluyendo componentes que no
 * son `<a>` en absoluto. Por eso necesita runtime propio — no es tier 0 puro,
 * es tier 1, igual que `scroll-to`.
 *
 * a11y: rol `"link"`, no `"button"` — la acción NAVEGA (cambia de URL/
 * contexto), que es exactamente la semántica de `role="link"` en el patrón
 * WAI-ARIA (un botón EJECUTA una operación en la página actual). El runtime
 * (`runtime/actions/openUrl.ts`) agrega `role="link"` + `tabindex="0"` +
 * teclado (Enter/Espacio, NO Espacio-scroll porque un link no reacciona a
 * Espacio de forma nativa — se replica el comportamiento de un `<a>` real:
 * solo Enter) a los nodos que no son ya nativamente interactivos.
 *
 * Degradación sin JS (P8/P9, criterio §7.4): SIN este runtime, el click no
 * navega — mismo criterio ya aceptado para `scroll-to`/`close-modal`
 * (Fase 2): el contenido sigue siendo visible/usable, solo el atajo de click
 * no funciona. Si el usuario necesita que funcione SIN JS, la vía nativa ya
 * existe: usar el campo `link` de un componente que lo soporte (`button`) en
 * vez de esta acción.
 */

import type { ActionDefinition } from "../types";

export interface OpenUrlParams {
  /** URL de destino (absoluta o relativa). Sin valor, el runtime no hace nada. */
  url?: string;
  /** Abre en una pestaña nueva (`target="_blank"` + `rel="noopener noreferrer"`). Default false. */
  newTab?: boolean;
}

export const openUrlAction: ActionDefinition = {
  type: "open-url",
  label: "Abrir URL",
  targetKind: "none",
  defaultParams: { url: "", newTab: false },
  optionsSchema: {
    fields: [
      {
        key: "url",
        label: "URL",
        control: "url",
        group: "Abrir URL",
        placeholder: "https://ejemplo.com",
      },
      {
        key: "newTab",
        label: "Abrir en pestaña nueva",
        control: "toggle",
        group: "Abrir URL",
      },
    ],
  },
  // Marcador vacío + params por `data-pb-options` (mismo criterio que
  // `dismiss.ts`): `dataAttributes` es PURA (P7), solo strings — la URL y
  // `newTab` viajan por el canal de opciones JSON que `enhance.ts` ya parsea,
  // no como atributos `data-pb-open-url-*` sueltos.
  dataAttributes: () => ({ "data-pb-open-url": "" }),
  runtime: {
    moduleId: "openUrl",
    enhance: "enhanceOpenUrl",
    loadPreview: async () => {
      const { enhanceOpenUrl } = await import("../../../runtime/actions/openUrl");
      return (el, action) => enhanceOpenUrl(el, (action.params ?? {}) as import("../../../runtime/actions/openUrl").OpenUrlOptions);
    },
  },
};
