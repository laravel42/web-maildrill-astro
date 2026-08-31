/**
 * Marquee — desplaza en bucle continuo el contenido de un `logo-cloud`
 * (docs/44 §5 fila P1). Tier 0: el loop es 100% CSS (`@keyframes` + duplicación
 * de contenido en el propio `render()`, ver `LogoCloud.tsx`), sin ningún
 * runtime JS obligatorio — funciona igual con JS desactivado.
 *
 * **OBLIGATORIO (AGENTS.md §5, cita explícita de este caso):**
 * `runtime.clipsContentWhenActive: true`. El recorte (`overflow: hidden`) NO
 * proviene del estilo propio de `LogoCloud` (que hoy no aplica ningún
 * overflow, confirmado en su código) ni de una clase que solo el `enhance`
 * agregaría en runtime (a diferencia de `carousel`, que recorta vía
 * `.pb-carousel--enhanced` puesta por JS) — proviene del CSS ESTÁTICO de
 * este behavior, anclado al selector de ATRIBUTO `[data-pb-behavior~="marquee"]`
 * que el export SIEMPRE emite cuando el behavior está adjunto (igual mecanismo
 * que `sticky`, ver `registry/behaviors/sticky.ts` para el razonamiento
 * completo de por qué un atributo y no una clase). Es la única forma de que
 * el recorte sea tier 0 real: si dependiera de una clase puesta por JS, sin
 * runtime no habría loop NI recorte, y el muro de logos duplicado se vería
 * roto (dos copias completas, sin cortar).
 *
 * `LogoCloud.tsx` SÍ necesita consumir `ctx.suppressClip` — no para anular un
 * overflow propio (no tiene ninguno hoy), sino porque este behavior hace que
 * `LogoCloud.tsx` DUPLIQUE sus hijos en el propio `render()` (ver ese archivo)
 * para el loop continuo; sin acotar esa duplicación en modo Edit, el usuario
 * vería el doble de logos sin ningún límite visual que le indique dónde
 * recorta el marquee real. `suppressClip` le dice al componente que está en
 * Edit (el mismo booleano genérico que ya consume `Container`), así que
 * puede optar por NO duplicar en ese modo — el usuario edita/selecciona los
 * logos reales, una sola vez, sin el efecto fantasma de scroll infinito
 * (que de todos modos nunca corre en Edit, docs/10 §5 tabla).
 */

import type { BehaviorDefinition } from "../types";

export const marqueeBehavior: BehaviorDefinition = {
  type: "marquee",
  label: "Desplazamiento continuo (marquee)",
  category: "content",
  appliesTo: (node) => node.type === "logo-cloud",
  defaultOptions: { duration: 30, direction: "left", pauseOnHover: true },
  optionsSchema: {
    fields: [
      {
        key: "duration",
        label: "Duración del ciclo (s)",
        control: "number",
        group: "Marquee",
        placeholder: "30",
      },
      {
        key: "direction",
        label: "Dirección",
        control: "select",
        group: "Marquee",
        options: [
          { label: "Izquierda", value: "left" },
          { label: "Derecha", value: "right" },
        ],
      },
      { key: "pauseOnHover", label: "Pausar al pasar el mouse", control: "toggle", group: "Marquee" },
    ],
  },
  runtime: {
    moduleId: "marquee",
    // Sin `enhance` obligatorio para el efecto en sí (tier 0: CSS puro). El
    // runtime existe solo para el detalle de accesibilidad de `pauseOnHover`
    // en touch (sin :hover real) — ver `runtime/behaviors/marquee.ts` — y para
    // que `prefers-reduced-motion` pueda detenerse también si el usuario abrió
    // la pestaña con esa preferencia cambiada en caliente (el CSS `@media` ya
    // cubre el caso normal sin JS).
    enhance: "enhanceMarquee",
    css: [
      // Selector de ATRIBUTO (no de clase, ver comentario de arriba): recorta
      // SIEMPRE que el behavior esté adjunto, con o sin runtime JS.
      '[data-pb-behavior~="marquee"] { overflow: hidden; }',
      // Pista de movimiento: cada mitad duplicada (ver `LogoCloud.tsx`) se
      // desplaza el 100% de SU PROPIO ancho; como son dos copias idénticas
      // consecutivas, cuando la primera termina de salir la segunda ya ocupa
      // exactamente su lugar → loop sin salto visible.
      '[data-pb-behavior~="marquee"] > [data-pb-marquee-track] { display: flex; width: max-content; animation: pb-marquee var(--pb-marquee-duration, 30s) linear infinite; }',
      '[data-pb-behavior~="marquee"].pb-marquee--right > [data-pb-marquee-track] { animation-direction: reverse; }',
      '[data-pb-behavior~="marquee"].pb-marquee--paused > [data-pb-marquee-track] { animation-play-state: paused; }',
      "@keyframes pb-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }",
      "@media (prefers-reduced-motion: reduce) {",
      '  [data-pb-behavior~="marquee"] > [data-pb-marquee-track] { animation: none; }',
      "}",
    ].join("\n"),
    // El recorte de `marquee` viene del CSS estático de este behavior (arriba),
    // no del estilo propio de `LogoCloud` — pero igual afecta la
    // editabilidad de sus hijos en Edit (ver nota de arriba sobre la
    // duplicación): declarar el flag es lo que le permite a `LogoCloud.tsx`
    // saber que debe evitar duplicar contenido mientras se edita.
    clipsContentWhenActive: true,
    loadPreview: async () => (await import("../../../runtime/behaviors/marquee")).enhanceMarquee,
  },
};
