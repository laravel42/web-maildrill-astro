/**
 * Accordion — runtime del OUTPUT (docs/10 §4/§5, Bloque D — docs/16 §12.4).
 * Mejora un grupo de `<details class="pb-accordion__item">` nativos con:
 *   - animación de apertura/cierre suave vía Web Animations API (WAAPI), que
 *     CSS puro no resuelve para `height:auto` (se anima la altura del panel de
 *     0 ↔ contenido real, patrón estándar de animación de `<details>`);
 *   - modo "solo una sección abierta" (`single`) — al abrir una, cierra las demás;
 *   - respeto de `prefers-reduced-motion` (si el usuario lo pide, alterna al
 *     instante sin animar);
 *   - a11y: `aria-expanded` en el `<summary>` sincronizado con el estado.
 *
 * Progressive enhancement (P8/P9): SIN JS, los `<details>/<summary>` colapsan de
 * forma nativa — todo el contenido es accesible, solo sin transición. El JS
 * únicamente AÑADE el pulido; nunca es requisito para leer el contenido.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options` (JSON plano ya validado).
 */

export interface AccordionOptions {
  /** Solo una sección abierta a la vez (al abrir una, cierra el resto). Default true. */
  single?: boolean;
  /** Duración de la animación en ms. Default 280. */
  duration?: number;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

const DEFAULT_DURATION = 280;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * ¿Debe animarse? No si el usuario pide movimiento reducido, ni si el entorno
 * no soporta la Web Animations API (`Element.animate` — ausente p. ej. en
 * jsdom o navegadores muy antiguos): en esos casos se alterna al instante, sin
 * perder funcionalidad (progressive enhancement).
 */
function canAnimate(panel: HTMLElement): boolean {
  return !prefersReducedMotion() && typeof panel.animate === "function";
}

export function enhanceAccordion(el: HTMLElement, options: AccordionOptions = {}): Cleanup | void {
  const single = options.single !== false;
  const duration =
    typeof options.duration === "number" && options.duration >= 0 ? options.duration : DEFAULT_DURATION;

  const items = Array.from(el.querySelectorAll<HTMLDetailsElement>("details.pb-accordion__item"));
  if (items.length === 0) return;

  const cleanups: Cleanup[] = [];

  items.forEach((details) => {
    const summary = details.querySelector<HTMLElement>(".pb-accordion__summary");
    const panel = details.querySelector<HTMLElement>(".pb-accordion__panel");
    if (!summary || !panel) return;

    // a11y: el summary refleja el estado abierto/cerrado.
    summary.setAttribute("aria-expanded", String(details.open));

    // Estado de INTENCIÓN explícito (no leer `details.open`, que se mantiene
    // true durante la animación de cierre y sería ambiguo a mitad de camino).
    let expanded = details.open;
    // Animación en curso de ESTE item (para poder revertir a mitad de camino).
    let animation: Animation | null = null;

    const clearInline = (): void => {
      panel.style.height = "";
      panel.style.overflow = "";
    };

    const finishOpen = (): void => {
      details.open = true;
      summary.setAttribute("aria-expanded", "true");
      clearInline();
      animation = null;
    };

    const finishClose = (): void => {
      details.open = false;
      summary.setAttribute("aria-expanded", "false");
      clearInline();
      animation = null;
    };

    const animateTo = (from: number, to: number, onDone: () => void): void => {
      panel.style.overflow = "hidden";
      animation?.cancel();
      animation = panel.animate(
        { height: [`${from}px`, `${to}px`] },
        { duration, easing: "ease" },
      );
      animation.onfinish = onDone;
      animation.oncancel = () => {
        animation = null;
      };
    };

    const open = (): void => {
      expanded = true;
      if (!canAnimate(panel)) {
        finishOpen();
        return;
      }
      // `details.open` debe ser true para que el panel esté en flujo y sea medible.
      details.open = true;
      summary.setAttribute("aria-expanded", "true");
      const from = animation ? panel.getBoundingClientRect().height : 0;
      animateTo(from, panel.scrollHeight, finishOpen);
    };

    const close = (): void => {
      expanded = false;
      if (!canAnimate(panel)) {
        finishClose();
        return;
      }
      const from = panel.getBoundingClientRect().height || panel.scrollHeight;
      // Mantener `open` durante el cierre; se apaga al terminar (finishClose).
      details.open = true;
      summary.setAttribute("aria-expanded", "false");
      animateTo(from, 0, finishClose);
    };

    const closeOthers = (): void => {
      if (!single) return;
      items.forEach((other) => {
        if (other !== details && other.open) {
          other.dispatchEvent(new CustomEvent("pb-accordion:close"));
        }
      });
    };

    // Permite que `closeOthers` cierre este item de forma animada sin re-disparar clicks.
    const onExternalClose = (): void => {
      if (expanded) close();
    };
    details.addEventListener("pb-accordion:close", onExternalClose);

    const onSummaryClick = (event: MouseEvent): void => {
      // Tomamos el control del toggle para animarlo (el nativo es instantáneo).
      event.preventDefault();
      if (expanded) {
        close();
      } else {
        closeOthers();
        open();
      }
    };
    summary.addEventListener("click", onSummaryClick);

    cleanups.push(() => {
      summary.removeEventListener("click", onSummaryClick);
      details.removeEventListener("pb-accordion:close", onExternalClose);
      animation?.cancel();
      clearInline();
    });
  });

  return () => {
    cleanups.forEach((fn) => fn());
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
  window.__pbBehaviors.enhanceAccordion = (el, options) =>
    enhanceAccordion(el, options as AccordionOptions);
}
