/**
 * Navbar — runtime del OUTPUT (docs/10 §4/§5, Bloque D — docs/16 §12.4 #20).
 * Añade el menú hamburguesa MÓVIL a una barra de navegación:
 *   - marca la raíz con `pb-navbar--js` (el CSS solo muestra la hamburguesa y
 *     colapsa el menú en móvil CUANDO hay JS — sin JS el menú queda visible);
 *   - alterna el menú con `aria-expanded` + clase `pb-navbar--open`;
 *   - anima la apertura/cierre (altura) vía WAAPI, con fallback instantáneo;
 *   - cierra al pulsar un enlace o Escape.
 *
 * Progressive enhancement (P8/P9): SIN JS, la barra muestra TODOS los enlaces
 * (sin hamburger) — navegación accesible. El JS solo añade el patrón móvil.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface NavbarOptions {
  /** Duración de la animación del menú en ms. Default 240. */
  duration?: number;
}

export type Cleanup = () => void;

const DEFAULT_DURATION = 240;

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

export function enhanceNavbar(el: HTMLElement, options: NavbarOptions = {}): Cleanup | void {
  const toggle = el.querySelector<HTMLElement>(".pb-navbar__toggle");
  const menu = el.querySelector<HTMLElement>(".pb-navbar__menu");
  if (!toggle || !menu) return;

  const duration =
    typeof options.duration === "number" && options.duration >= 0 ? options.duration : DEFAULT_DURATION;

  // Revela la hamburguesa + habilita el colapso del menú en móvil (solo con JS).
  el.classList.add("pb-navbar--js");
  toggle.setAttribute("aria-expanded", "false");

  let open = false;
  let animation: Animation | null = null;

  const setOpen = (next: boolean): void => {
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    animation?.cancel();

    if (open) {
      el.classList.add("pb-navbar--open");
      if (canAnimate(menu)) {
        animation = menu.animate(
          { height: ["0px", `${menu.scrollHeight}px`] },
          { duration, easing: "ease-out" },
        );
        animation.onfinish = () => {
          animation = null;
        };
      }
    } else if (canAnimate(menu)) {
      const from = menu.getBoundingClientRect().height || menu.scrollHeight;
      animation = menu.animate({ height: [`${from}px`, "0px"] }, { duration, easing: "ease-in" });
      animation.onfinish = () => {
        el.classList.remove("pb-navbar--open");
        animation = null;
      };
      animation.oncancel = () => {
        animation = null;
      };
    } else {
      el.classList.remove("pb-navbar--open");
    }
  };

  const onToggleClick = (): void => setOpen(!open);
  const onMenuClick = (event: Event): void => {
    // Cerrar al elegir un enlace (navegación en móvil).
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      toggle.focus();
    }
  };

  toggle.addEventListener("click", onToggleClick);
  menu.addEventListener("click", onMenuClick);
  el.addEventListener("keydown", onKeydown);

  return () => {
    toggle.removeEventListener("click", onToggleClick);
    menu.removeEventListener("click", onMenuClick);
    el.removeEventListener("keydown", onKeydown);
    animation?.cancel();
    el.classList.remove("pb-navbar--js", "pb-navbar--open");
    menu.style.height = "";
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
  window.__pbBehaviors.enhanceNavbar = (el, options) => enhanceNavbar(el, options as NavbarOptions);
}
