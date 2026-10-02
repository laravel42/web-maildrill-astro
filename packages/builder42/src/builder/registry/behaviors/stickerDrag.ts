/**
 * Sticker drag — hace arrastrable por el VISITANTE la pegatina a la que se
 * adjunta (`registry/components/Sticker.tsx`).
 *
 * Tier 0 + 1, mismo reparto que `sticky`: la pegatina ya aparece colocada,
 * anclada y rotada sin ejecutar JS — eso lo hacen el `css` del componente y su
 * estilo inline. Este behavior aporta solo el gesto, y su CSS se limita a lo
 * que es verdad incluso si el bundle no carga.
 *
 * **Por qué `cursor: grab` NO está en este CSS.** El export siempre emite
 * `data-pb-behavior="sticker-drag"` en el nodo, cargue o no el runtime
 * (`exportToHtml.ts#behaviorRootProps`), así que una regla de cursor anclada al
 * atributo prometería un arrastre que no existe si el JS falla o está
 * desactivado. El cursor lo pone `enhanceStickerDrag` con la clase
 * `pb-sticker--draggable`, igual que `sticky` reserva `pb-sticky--scrolled`
 * para lo que solo el runtime puede saber.
 *
 * `touch-action: none` sí va en tier 0 y es deliberado: es la única declaración
 * que debe existir ANTES del primer `pointerdown` para que en móvil el gesto
 * arrastre la pegatina en vez de hacer scroll de la página. Si el runtime no
 * carga, no tener scroll sobre los ~120px de la pegatina es inocuo (el resto de
 * la sección scrollea con normalidad); si se dejara para el runtime, el primer
 * gesto de cada visita se perdería en un scroll no deseado.
 *
 * `appliesTo` restringido a `sticker` a propósito: el CSS de superposición vive
 * en el componente `sticker`, así que adjuntarlo a un nodo cualquiera movería
 * algo que sigue ocupando su hueco en el flujo — el resultado es un elemento
 * desplazado que deja un agujero, no una pegatina. Ampliarlo el día que exista
 * otro componente superpuesto es tocar una línea.
 */

import type { BehaviorDefinition } from "../types";

export const stickerDragBehavior: BehaviorDefinition = {
  type: "sticker-drag",
  label: "Pegatina arrastrable",
  category: "interactive",
  appliesTo: (node) => node.type === "sticker",
  defaultOptions: { axis: "both", bounded: true },
  optionsSchema: {
    fields: [
      {
        key: "axis",
        label: "Ejes",
        control: "select",
        group: "Arrastre",
        options: [
          { label: "Ambos", value: "both" },
          { label: "Solo horizontal", value: "x" },
          { label: "Solo vertical", value: "y" },
        ],
      },
      {
        key: "bounded",
        label: "Limitar al contenedor",
        control: "toggle",
        group: "Arrastre",
        help: "behaviors.fields.sticker-drag.boundedHelp",
      },
    ],
  },
  runtime: {
    moduleId: "stickerDrag",
    enhance: "enhanceStickerDrag",
    css: [
      '[data-pb-behavior~="sticker-drag"] { touch-action: none; -webkit-user-select: none; user-select: none; }',
      ".pb-sticker--draggable { cursor: grab; }",
      ".pb-sticker--dragging { cursor: grabbing; }",
    ].join("\n"),
    loadPreview: async () => (await import("../../../runtime/behaviors/stickerDrag")).enhanceStickerDrag,
  },
};
