/**
 * Theme toggle — behavior opt-in de claro/oscuro en runtime (docs/10, docs/11
 * §4/§9.4). Convierte el nodo (típicamente un botón) en un interruptor que
 * alterna `document.documentElement.dataset.theme` entre dos temas configurados
 * y persiste la elección en `localStorage`. Cero-JS por defecto: sin este
 * behavior el sitio respeta `prefers-color-scheme` vía CSS (themes.css) sin
 * ningún runtime; el toggle solo AÑADE control manual (progressive enhancement).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 * Solo conoce el DOM y sus `options`.
 */

export interface ThemeToggleOptions {
  /** Id del tema claro (valor de `data-theme`). */
  light?: string;
  /** Id del tema oscuro (valor de `data-theme`). */
  dark?: string;
  /** Clave de `localStorage` para recordar la elección. Default `pb-theme`. */
  storageKey?: string;
}

export type Cleanup = () => void;

export function enhanceThemeToggle(
  el: HTMLElement,
  options: ThemeToggleOptions = {},
): Cleanup | void {
  const light = options.light;
  const dark = options.dark;
  // Sin ambos temas configurados no hay nada que alternar (no-op seguro).
  if (!light || !dark) return;
  const storageKey = options.storageKey ?? "pb-theme";
  const root = document.documentElement;

  const prefersDark = (): boolean =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const apply = (theme: string): void => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      /* localStorage puede fallar (modo privado); el toggle sigue funcionando */
    }
    el.setAttribute("aria-pressed", String(theme === dark));
  };

  // Estado inicial: elección recordada > `data-theme` ya presente > SO.
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    stored = null;
  }
  const initial =
    stored === light || stored === dark
      ? stored
      : root.dataset.theme === light || root.dataset.theme === dark
        ? root.dataset.theme
        : prefersDark()
          ? dark
          : light;
  apply(initial);

  const onClick = (): void => {
    apply(root.dataset.theme === dark ? light : dark);
  };
  el.addEventListener("click", onClick);

  return () => {
    el.removeEventListener("click", onClick);
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<
      string,
      (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void
    >;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceThemeToggle = (el, options) =>
    enhanceThemeToggle(el, options as ThemeToggleOptions);
}
