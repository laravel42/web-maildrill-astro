/**
 * Carousel — behavior de referencia (docs/10 §5, §8.3). En 8.1 es solo la
 * DECLARACIÓN: schema de opciones para el Inspector + metadata del runtime.
 * El `enhanceCarousel` real (Embla) y el bundling llegan en 8.3; hasta entonces
 * el nodo se ve como el slider CSS base (grado 0) + un badge en el canvas.
 *
 * Aplica a containers (nodos que aceptan hijos): el carrusel envuelve una
 * pista de slides que ya existe como slider `scroll-snap` (PLAN §2.1).
 */

import { createElement, type ReactNode } from "react";
import { getDefinition } from "../componentRegistry";
import type { BehaviorDefinition } from "../types";

/**
 * Chrome fantasma en Edit (docs/10 §5, feedback de usuario): dos botones de
 * solo-vista en las MISMAS posiciones donde `enhanceCarousel` los pondría en
 * Preview/export — mismas clases CSS (`pb-carousel__arrow`,
 * `pb-carousel--horizontal|vertical`) que ya declara `runtime.css` abajo,
 * así la posición es IDÉNTICA sin duplicar reglas. No son botones reales:
 * sin `onClick` (no hay ninguna instancia de Embla en Edit que mover) y
 * `aria-hidden` (es previsualización, no una interacción real). Respeta
 * `showArrows`: si el usuario ya las quitó, no hay nada que fingir.
 */
function carouselEditPreviewChrome(options: Record<string, unknown>): ReactNode {
  const showArrows = options.showArrows !== false;
  if (!showArrows) return null;
  const isVertical = options.orientation === "vertical";

  // Envuelve en un `span` con la clase `pb-carousel--horizontal|vertical`:
  // el CSS existente (`.pb-carousel--vertical .pb-carousel__arrow { … }`)
  // posiciona por DESCENDENCIA de esa clase, así que reutilizarla aquí
  // mantiene la posición idéntica a Preview/export sin declarar selectores
  // nuevos. `position:relative` porque el padre real (`Container`) no tiene
  // por qué serlo si el usuario no lo declaró — las flechas son `absolute`.
  return createElement(
    "span",
    {
      className: `pb-carousel--${isVertical ? "vertical" : "horizontal"} pb-carousel__preview`,
      "aria-hidden": "true",
      style: { position: "absolute", inset: 0, pointerEvents: "none" },
    },
    createElement("span", {
      key: "prev",
      className: "pb-carousel__arrow pb-carousel__arrow--prev pb-carousel__arrow--preview",
      dangerouslySetInnerHTML: { __html: isVertical ? "&#9650;" : "&#8249;" },
    }),
    createElement("span", {
      key: "next",
      className: "pb-carousel__arrow pb-carousel__arrow--next pb-carousel__arrow--preview",
      dangerouslySetInnerHTML: { __html: isVertical ? "&#9660;" : "&#8250;" },
    }),
  );
}

export const carouselBehavior: BehaviorDefinition = {
  type: "carousel",
  // Menciona "Embla" explícitamente (feedback de usuario, Fase 8.4-fix): en la
  // lista de behaviors disponibles del Inspector debe quedar claro que esto es
  // una integración real con una librería concreta, no solo el slider CSS base.
  label: "Carrusel (Embla)",
  category: "content",
  appliesTo: (node) => getDefinition(node.type)?.acceptsChildren ?? false,
  // Controles reducidos a lo que un usuario final necesita para armar un
  // carousel usable (feedback de usuario): orientación (elige el eje de
  // scroll de Embla + el flex-direction del runtime), gap entre slides, y el
  // tamaño de cada slide en el eje de scroll (ancho en horizontal, alto en
  // vertical — el eje cruzado siempre se limita al 100% del contenedor, ver
  // `carousel.ts` del runtime). `align` se quita del Inspector: `start` ya es
  // el criterio correcto para el 100% de los casos de uso reales y exponerlo
  // solo añadía una decisión sin valor práctico.
  defaultOptions: {
    orientation: "horizontal",
    loop: false,
    autoplay: false,
    gap: "16px",
    slideSize: "80%",
    showArrows: true,
  },
  optionsSchema: {
    fields: [
      {
        key: "orientation",
        label: "Orientación",
        control: "select",
        group: "Carrusel",
        options: [
          { label: "Horizontal", value: "horizontal" },
          { label: "Vertical", value: "vertical" },
        ],
      },
      {
        key: "slideSize",
        label: "Tamaño de cada slide",
        control: "numeric",
        units: ["%", "px", "em", "rem", "vw", "vh"],
        defaultUnit: "%",
        group: "Carrusel",
        placeholder: "80%",
      },
      {
        key: "gap",
        label: "Espacio entre slides",
        control: "numeric",
        units: ["px", "%", "em", "rem"],
        defaultUnit: "px",
        group: "Carrusel",
        placeholder: "16px",
      },
      { key: "loop", label: "Loop", control: "toggle", group: "Carrusel" },
      { key: "autoplay", label: "Autoplay", control: "toggle", group: "Carrusel" },
      { key: "showArrows", label: "Mostrar flechas", control: "toggle", group: "Carrusel" },
    ],
  },
  runtime: {
    moduleId: "carousel",
    npm: { pkg: "embla-carousel", version: "8.6.0" },
    enhance: "enhanceCarousel",
    // Chrome mínimo de flechas + dots inyectado por `enhanceCarousel` en
    // runtime (docs/10 §5, §8.3). El slider base sigue funcionando sin esto
    // (progressive enhancement); solo aplica estética/posicionamiento a los
    // elementos que el JS crea. Nunca se emite si el behavior no se usa.
    //
    // El eje de scroll (`flex-direction`) NO se fija aquí: depende de
    // `orientation` y lo aplica `enhanceCarousel` como estilo inline sobre
    // `.pb-carousel__container` en runtime (mismo elemento, sin clases
    // condicionales nuevas — evita duplicar reglas horizontal/vertical acá).
    css: [
      ".pb-carousel--enhanced { position: relative !important; display: block !important; }",
      ".pb-carousel__viewport { overflow: hidden; width: 100%; }",
      ".pb-carousel__container { display: flex !important; align-items: stretch; }",
      ".pb-carousel__slide { flex: 0 0 auto; min-width: 0; min-height: 0; }",
      ".pb-carousel__arrow { position: absolute; z-index: 1; border: none; border-radius: 999px; width: 2.25rem; height: 2.25rem; background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 1.25rem; line-height: 1; cursor: pointer; }",
      ".pb-carousel__arrow:disabled { opacity: 0.35; cursor: default; }",
      // Horizontal: flechas a los lados, centradas verticalmente.
      ".pb-carousel--horizontal .pb-carousel__arrow { top: 50%; transform: translateY(-50%); }",
      ".pb-carousel--horizontal .pb-carousel__arrow--prev { left: 0.5rem; }",
      ".pb-carousel--horizontal .pb-carousel__arrow--next { right: 0.5rem; }",
      // Vertical: flechas arriba/abajo, centradas horizontalmente.
      ".pb-carousel--vertical .pb-carousel__arrow { left: 50%; transform: translateX(-50%); }",
      ".pb-carousel--vertical .pb-carousel__arrow--prev { top: 0.5rem; }",
      ".pb-carousel--vertical .pb-carousel__arrow--next { bottom: 0.5rem; }",
      ".pb-carousel__dots { position: absolute; z-index: 1; display: flex; gap: 0.4rem; }",
      ".pb-carousel--horizontal .pb-carousel__dots { bottom: 0.5rem; left: 50%; transform: translateX(-50%); flex-direction: row; }",
      ".pb-carousel--vertical .pb-carousel__dots { right: 0.5rem; top: 50%; transform: translateY(-50%); flex-direction: column; }",
      ".pb-carousel__dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; border: none; background: rgba(255, 255, 255, 0.6); cursor: pointer; padding: 0; }",
      ".pb-carousel__dot--selected { background: #fff; }",
      // Chrome FANTASMA en Edit (`editPreviewChrome` abajo): mismas reglas de
      // posición que las flechas reales (por las clases compartidas
      // `pb-carousel--horizontal|vertical` + `pb-carousel__arrow`), pero con
      // una apariencia distinta — semitransparente y con borde punteado —
      // para que quede claro que es una vista previa, no el control real
      // (que solo existe cuando el runtime está hidratado en Preview/export).
      ".pb-carousel__arrow--preview { background: rgba(124, 58, 237, 0.18); border: 1px dashed rgba(124, 58, 237, 0.6); color: #7c3aed; cursor: default; }",
    ].join("\n"),
    // Preview hidratado (docs/10 §5, Fase 8.4): import() dinámico del módulo
    // real del runtime, code-split por Vite (chunk propio, no se carga en el
    // editor si ningún nodo usa el behavior). El export sigue sin esta rama:
    // exportSite lee `dist/*.js` como texto, nunca ejecuta este import.
    loadPreview: async () => (await import("../../../runtime/behaviors/carousel")).enhanceCarousel,
    // El carousel muestra un slide (o página de slides) a la vez cuando está
    // hidratado (Preview/export); en Edit, donde el runtime nunca corre, el
    // usuario suele fijar en el Inspector el tamaño (altura del vertical,
    // overflow) que ese recorte necesita — sin este flag, ese mismo tamaño
    // ocultaría visualmente los demás slides mientras se edita, aunque sigan
    // en el documento (feedback de usuario, ver `Container.tsx`).
    clipsContentWhenActive: true,
    editPreviewChrome: carouselEditPreviewChrome,
  },
};
