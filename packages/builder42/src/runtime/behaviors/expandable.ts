/**
 * Expandable — runtime del OUTPUT (docs/44 §5 fila P2). Colapsa el contenido
 * a `options.collapsedHeight` e inyecta su PROPIO botón "Ver más"/"Ver menos"
 * al final del contenedor (patrón de inyección DOM de `carousel.ts` —
 * `createElement`/`appendChild`, nunca en el HTML exportado, P8: el core no
 * sabe qué es "expandable").
 *
 * **Degradación sin JS (crítico, ver `registry/behaviors/expandable.ts`):**
 * el recorte (`.pb-expandable--collapsed`) y el botón los agrega ÚNICAMENTE
 * este `enhance`. Si este módulo nunca corre (JS desactivado, error de red),
 * el bloque queda con su altura natural completa — nunca hay contenido
 * oculto sin una forma de revelarlo.
 *
 * a11y (patrón `accordion.ts`): el botón inyectado es un disclosure real —
 * `aria-expanded` en el botón, `aria-controls` apuntando al id del contenedor
 * (se le asigna uno si no tiene, sin pisar un `id` ya puesto para
 * `scroll-to`/anclas).
 *
 * `prefers-reduced-motion`: sin transición animada de `max-height` — el
 * cambio de estado es instantáneo (`transition: none` inline), pero el
 * recorte/expansión en sí sigue funcionando (nunca se desactiva el behavior
 * completo, a diferencia de `parallax`/`marquee`: aquí el motion es solo la
 * transición visual, no el efecto funcional).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface ExpandableOptions {
  /** Altura colapsada en px. Default 200. */
  collapsedHeight?: number;
  /** Texto del botón cuando el bloque está colapsado. Default "Ver más". */
  expandLabel?: string;
  /** Texto del botón cuando el bloque está expandido. Default "Ver menos". */
  collapseLabel?: string;
  /** Gradiente de fade al final del bloque colapsado. Default true. */
  fade?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

const DEFAULT_COLLAPSED_HEIGHT = 200;
const DEFAULT_EXPAND_LABEL = "Show more";
const DEFAULT_COLLAPSE_LABEL = "Show less";

let autoId = 0;
function ensureId(el: HTMLElement): string {
  if (!el.id) el.id = `pb-expandable-${(autoId++).toString(36)}`;
  return el.id;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function enhanceExpandable(el: HTMLElement, options: ExpandableOptions = {}): Cleanup | void {
  const {
    collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
    expandLabel = DEFAULT_EXPAND_LABEL,
    collapseLabel = DEFAULT_COLLAPSE_LABEL,
    fade = true,
  } = options;

  // Si el contenido ya es más bajo que la altura colapsada, no hay nada que
  // ocultar: se deja el bloque tal cual, sin botón (no tendría ningún efecto
  // útil y confundiría al visitante con un "Ver más" que no revela nada).
  if (el.scrollHeight <= collapsedHeight) return;

  el.style.setProperty("--pb-expandable-height", `${collapsedHeight}px`);
  el.classList.add("pb-expandable--collapsed");
  if (fade) el.classList.add("pb-expandable--fade");
  if (prefersReducedMotion()) el.style.transition = "none";

  const contentId = ensureId(el);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pb-expandable__toggle";
  button.textContent = expandLabel;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", contentId);

  let expanded = false;
  function toggle(): void {
    expanded = !expanded;
    el.classList.toggle("pb-expandable--collapsed", !expanded);
    button.textContent = expanded ? collapseLabel : expandLabel;
    button.setAttribute("aria-expanded", String(expanded));
  }
  button.addEventListener("click", toggle);

  // El botón vive DESPUÉS del contenedor (hermano, no hijo) para no quedar
  // recortado por el propio `overflow: hidden` mientras está colapsado.
  el.insertAdjacentElement("afterend", button);

  return () => {
    button.removeEventListener("click", toggle);
    button.remove();
    el.classList.remove("pb-expandable--collapsed", "pb-expandable--fade");
    el.style.removeProperty("--pb-expandable-height");
    el.style.removeProperty("transition");
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceExpandable = (el, options) =>
    enhanceExpandable(el, options as ExpandableOptions);
}
