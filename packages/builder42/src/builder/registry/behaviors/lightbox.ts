/**
 * Lightbox — click en una imagen abre una vista de pantalla completa, con
 * foco/teclado/swipe (docs/44 §5 fila P3, tier 2 — única fase tier 2 del
 * plan, con superficie propia: foco, teclado, gestos táctiles).
 *
 * **Alcance de esta fase (docs/44 §6, encargo cerrado):** restringido a nodos
 * `image` individuales. El plan menciona también "grids de imágenes" como
 * caso de uso, pero eso NO requiere un `appliesTo` más amplio ni un tipo de
 * componente nuevo: el runtime (`runtime/behaviors/lightbox.ts`,
 * `resolveGroup`) agrupa automáticamente varias `<img>` hermanas (mismo padre
 * inmediato) que también tengan `lightbox` activo — el usuario simplemente
 * adjunta el behavior a cada `image` dentro de un `container` a modo de
 * grid, sin ningún control nuevo en el Inspector para "definir el grupo".
 * Resolver el catálogo completo de layouts de grid queda fuera de esta fase
 * (docs/44 §6: "no hace falta resolver todos los casos de uso del catálogo
 * en un commit").
 *
 * **Sin dependencia npm** (alcance modesto aceptado por el plan): overlay,
 * focus-trap, teclado y swipe implementados a mano en el runtime, sin
 * librería externa.
 *
 * **Degradación sin JS (P8/P9):** el behavior nunca oculta ni envuelve la
 * `<img>` base — sigue siendo una imagen normal, visible y funcional, con o
 * sin este runtime. El overlay entero es DOM inyectado por `enhance`, nunca
 * parte del HTML exportado.
 *
 * **`prefers-reduced-motion`:** ver el `@media` en `runtime.css` (aplica al
 * fade CSS del overlay que deja el propio DOM inyectado) y el chequeo del
 * runtime antes de animar con WAAPI.
 *
 * No declara `clipsContentWhenActive`: no recorta ningún contenido existente
 * del documento (el overlay es 100% ajeno al árbol, no un recorte de un nodo
 * ya presente) — a diferencia de `carousel`/`marquee`.
 */

import type { BehaviorDefinition } from "../types";

export const lightboxBehavior: BehaviorDefinition = {
  type: "lightbox",
  label: "Lightbox (pantalla completa)",
  category: "content",
  // Alcance de esta fase: solo nodos `image` (ver nota de cabecera). El
  // runtime maneja el agrupamiento de varias imágenes hermanas sin necesitar
  // restringir `appliesTo` a un tipo de container/grid nuevo.
  appliesTo: (node) => node.type === "image",
  defaultOptions: { duration: 180 },
  optionsSchema: {
    fields: [
      {
        key: "duration",
        label: "Duración de la transición (ms)",
        control: "number",
        group: "Lightbox",
        placeholder: "180",
        help: "behaviors.fields.lightbox.durationHelp",
      },
    ],
  },
  runtime: {
    moduleId: "lightbox",
    enhance: "enhanceLightbox",
    // Overlay + controles inyectados 100% por el runtime (nunca en el HTML
    // exportado, P8). El fondo semitransparente y el `<img>` centrado son lo
    // mínimo para que la imagen ampliada se vea bien en cualquier tamaño de
    // pantalla; el sitio del usuario no necesita aportar nada.
    css: [
      ".pb-lightbox__overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.9); }",
      ".pb-lightbox__figure { display: flex; align-items: center; justify-content: center; max-width: 90vw; max-height: 90vh; }",
      ".pb-lightbox__image { max-width: 90vw; max-height: 90vh; object-fit: contain; }",
      ".pb-lightbox__close, .pb-lightbox__nav { position: absolute; border: none; border-radius: 999px; background: rgba(255, 255, 255, 0.12); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }",
      ".pb-lightbox__close { top: 1rem; right: 1rem; width: 2.5rem; height: 2.5rem; font-size: 1.1rem; }",
      ".pb-lightbox__nav { top: 50%; transform: translateY(-50%); width: 2.75rem; height: 2.75rem; font-size: 1.75rem; }",
      ".pb-lightbox__nav--prev { left: 1rem; }",
      ".pb-lightbox__nav--next { right: 1rem; }",
      ".pb-lightbox__close:hover, .pb-lightbox__nav:hover { background: rgba(255, 255, 255, 0.24); }",
      // `prefers-reduced-motion`: la apertura/cierre igual ocurre (el runtime
      // sigue moviendo foco y creando/removiendo el overlay), solo sin la
      // transición de opacidad — el runtime comprueba la preferencia antes
      // de llamar a `animate()`, este bloque es un refuerzo declarativo por
      // si algún día se agrega una transición puramente CSS.
      "@media (prefers-reduced-motion: reduce) { .pb-lightbox__overlay { transition: none; } }",
    ].join("\n"),
    loadPreview: async () => (await import("../../../runtime/behaviors/lightbox")).enhanceLightbox,
  },
};
