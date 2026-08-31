/**
 * `dismiss` — oculta el propio nodo (o su ancestro, vía la opción `scope`) al
 * hacer click (docs/44 §4 fila P1). Cierra el hueco de `alert`, que hoy no se
 * puede descartar; sirve igual a banners de cookies/promo.
 *
 * A diferencia de `close-modal`/`open-modal`, SÍ necesita runtime propio: la
 * ocultación es 100% JS (P8/P9 — sin JS el contenido debe seguir visible, el
 * export nunca emite un `display:none` ni una clase que oculte por defecto).
 * `remember` (opt-in, `optionsSchema`) persiste el descarte en `localStorage`
 * bajo una key derivada del nodeId, para no volver a mostrarlo en visitas
 * futuras — mismo patrón de "recordar" que `theme-toggle`
 * (`registry/behaviors/themeToggle.ts`), pero por nodo en vez de por tema.
 *
 * a11y: si el nodo no es nativamente interactivo, el runtime
 * (`runtime/actions/dismiss.ts`) le agrega `role="button"`/`tabindex="0"` y
 * maneja Enter/Space al hidratar. La `ActionDefinition` solo marca la
 * intención vía `data-pb-dismiss` (marcador vacío); `scope`/`remember` viajan
 * por el canal `data-pb-options` (JSON), igual que las `options` de un
 * behavior — no se duplican como atributos `data-pb-dismiss-*` sueltos, que
 * `enhanceDismiss` nunca leería (P7: `dataAttributes` es pura, solo strings).
 */

import type { ActionDefinition } from "../types";

export interface DismissParams {
  /** Qué se oculta: el propio nodo o su ancestro directo (contenedor del banner). Default "self". */
  scope?: "self" | "parent";
  /** Si está activo, persiste el descarte en localStorage (no volver a mostrar). Default false. */
  remember?: boolean;
}

export const dismissAction: ActionDefinition = {
  type: "dismiss",
  label: "Descartar",
  targetKind: "none",
  defaultParams: { scope: "self", remember: false },
  optionsSchema: {
    fields: [
      {
        key: "scope",
        label: "Qué ocultar",
        control: "select",
        group: "Descartar",
        options: [
          { value: "self", label: "Este elemento" },
          { value: "parent", label: "Su contenedor" },
        ],
      },
      {
        key: "remember",
        label: "Recordar con localStorage",
        control: "toggle",
        group: "Descartar",
        help: "clickAction.fields.dismiss.rememberHelp",
      },
    ],
  },
  dataAttributes: () => ({ "data-pb-dismiss": "" }),
  runtime: {
    moduleId: "dismiss",
    enhance: "enhanceDismiss",
    // El contrato de `loadPreview` recibe la `NodeAction` completa (para
    // acciones con `target`, ej. un futuro `scroll-to`); `dismiss` no usa
    // `target`, solo sus `params` — se adaptan aquí al mismo shape de
    // `DismissOptions` que ya consume `enhanceDismiss` en producción (vía
    // `data-pb-options`, `enhance.ts`), sin duplicar la función real.
    loadPreview: async () => {
      const { enhanceDismiss } = await import("../../../runtime/actions/dismiss");
      return (el, action) => enhanceDismiss(el, (action.params ?? {}) as import("../../../runtime/actions/dismiss").DismissOptions);
    },
  },
};
