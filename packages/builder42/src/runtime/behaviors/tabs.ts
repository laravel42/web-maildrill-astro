/**
 * Tabs — runtime del OUTPUT (docs/10 §4/§5, Bloque D — docs/16 §12.4 #22).
 * Convierte una lista `role="tablist"` + paneles `role="tabpanel"` en pestañas
 * interactivas:
 *   - muestra solo el panel activo, oculta el resto (`hidden`);
 *   - transición de entrada del panel (fade + leve slide) vía WAAPI;
 *   - navegación por teclado WAI-ARIA: ←/→ (y Home/End) mueven y activan la
 *     pestaña con foco (roving `tabindex`), coherente con `aria-selected`.
 *
 * Progressive enhancement (P8/P9): SIN JS, el export deja TODOS los paneles
 * visibles (apilados y legibles) — el contenido es accesible; el JS solo añade
 * el comportamiento de pestañas. Nunca se oculta contenido sin JS.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface TabsOptions {
  /** Duración de la transición del panel en ms. Default 220. */
  duration?: number;
}

export type Cleanup = () => void;

const DEFAULT_DURATION = 220;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canAnimate(node: HTMLElement): boolean {
  return !prefersReducedMotion() && typeof node.animate === "function";
}

export function enhanceTabs(el: HTMLElement, options: TabsOptions = {}): Cleanup | void {
  const list = el.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
  if (!list || tabs.length === 0) return;

  const duration =
    typeof options.duration === "number" && options.duration >= 0 ? options.duration : DEFAULT_DURATION;

  const panelFor = (tab: HTMLElement): HTMLElement | null => {
    const id = tab.getAttribute("aria-controls");
    return id ? el.ownerDocument.getElementById(id) : null;
  };

  let activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"),
  );

  const select = (index: number, focusTab: boolean): void => {
    activeIndex = index;
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = panelFor(tab);
      if (!panel) return;
      if (selected) {
        panel.hidden = false;
        if (canAnimate(panel)) {
          panel.animate(
            { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0)"] },
            { duration, easing: "ease-out" },
          );
        }
      } else {
        panel.hidden = true;
      }
    });
    if (focusTab) tabs[index]?.focus();
  };

  // Estado inicial: activa la pestaña marcada (u la primera), ocultando el resto.
  select(activeIndex, false);

  const onTabClick = (event: Event): void => {
    const i = tabs.indexOf(event.currentTarget as HTMLElement);
    if (i >= 0) select(i, false);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (activeIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (activeIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next, true);
  };

  tabs.forEach((tab) => tab.addEventListener("click", onTabClick));
  list.addEventListener("keydown", onKeydown);

  return () => {
    tabs.forEach((tab) => tab.removeEventListener("click", onTabClick));
    list.removeEventListener("keydown", onKeydown);
    // Restaura el estado sin JS (todos los paneles visibles).
    tabs.forEach((tab) => {
      const panel = panelFor(tab);
      if (panel) panel.hidden = false;
    });
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
  window.__pbBehaviors.enhanceTabs = (el, options) => enhanceTabs(el, options as TabsOptions);
}
