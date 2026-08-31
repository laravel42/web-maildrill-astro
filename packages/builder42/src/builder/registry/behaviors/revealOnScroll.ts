/**
 * Reveal on scroll — behavior de referencia #2 (docs/10 §1, §8.4). Aplica a
 * CUALQUIER nodo (a diferencia de `carousel`, que solo aplica a containers):
 * revela con una transición cuando el elemento entra en el viewport.
 *
 * Prueba deliberada de P4: se agrega registrando esta definición, SIN tocar
 * `NodeRenderer`, `exportSite`, `usePreviewBehaviors` ni `behaviorRegistry`
 * más allá de sumarlo a la lista de definiciones.
 *
 * **Fase 5 (docs/44 §8.2 D2) — etiqueta renombrada + opción `mode`:** el id
 * interno (`type: "reveal-on-scroll"`) NO cambia — cero migración de
 * documentos existentes. Solo cambia (a) el `label` visible (de cara al
 * usuario, "revelar" es jerga de diseño; "aparecer al entrar en pantalla"
 * describe lo que el visitante ve — la traducción real en es/en/it vive en
 * los JSON de locales (`inspector.json`) bajo `behaviors.name["reveal-on-scroll"]`,
 * con fallback a este `label`, patrón ya usado por `BehaviorsSection.tsx`) y
 * (b) se agrega el campo `mode` (`together`/`sequence`, ver runtime): NO es
 * un behavior nuevo, sigue siendo el mismo tipo con una opción más — evita
 * que `stagger` se convierta en una entrada separada del catálogo (§4.1/§6).
 */

import type { BehaviorDefinition } from "../types";

export const revealOnScrollBehavior: BehaviorDefinition = {
  type: "reveal-on-scroll",
  label: "Aparecer al entrar en pantalla",
  category: "motion",
  // Sin `appliesTo`: aplica a todos los tipos de nodo.
  defaultOptions: { threshold: 0.15, once: true, mode: "together" },
  optionsSchema: {
    fields: [
      {
        key: "threshold",
        label: "Umbral de visibilidad",
        control: "number",
        group: "Revelar",
        placeholder: "0.15",
      },
      { key: "once", label: "Solo una vez", control: "toggle", group: "Revelar" },
      {
        key: "mode",
        label: "Modo de entrada",
        control: "select",
        group: "Revelar",
        options: [
          { label: "Todo a la vez", value: "together" },
          { label: "Uno tras otro", value: "sequence" },
        ],
      },
    ],
  },
  runtime: {
    moduleId: "revealOnScroll",
    enhance: "enhanceRevealOnScroll",
    // Estado inicial (oculto) + transición. El JS solo AGREGA la clase
    // `pb-reveal--visible`; sin JS, `.pb-reveal` nunca existiría en el HTML
    // exportado (el export no la agrega — solo el `enhance` lo hace en
    // runtime), así que el contenido es visible por defecto (P8/P9:
    // progressive enhancement, nunca oculta contenido sin JS).
    //
    // `mode: "sequence"` (docs/44 §8.2): el runtime asigna `--i` (índice) a
    // CADA HIJO DIRECTO del elemento observado cuando entra en viewport (no
    // al elemento mismo — ver `runtime/behaviors/revealOnScroll.ts`). Este
    // CSS la consume como `transition-delay` escalonado; sigue habiendo un
    // solo `IntersectionObserver` observando el contenedor, nunca uno por
    // hijo. `together` (default) no toca `--i` en absoluto y su transición
    // es IDÉNTICA a la de antes de esta fase (retrocompat de comportamiento).
    css: [
      ".pb-reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.6s ease, transform 0.6s ease; }",
      ".pb-reveal--visible { opacity: 1; transform: none; }",
      // Estagonado: el hijo hereda `--i` solo cuando el padre está en modo
      // `sequence` (marcado por `pb-reveal--sequence`); en `together` esta
      // regla nunca aplica porque la clase no existe.
      ".pb-reveal--sequence.pb-reveal > * { transition-delay: calc(var(--i, 0) * 100ms); }",
      "@media (prefers-reduced-motion: reduce) { .pb-reveal { transition: none; transform: none; } .pb-reveal--sequence.pb-reveal > * { transition-delay: 0s; } }",
    ].join("\n"),
    loadPreview: async () =>
      (await import("../../../runtime/behaviors/revealOnScroll")).enhanceRevealOnScroll,
  },
};
