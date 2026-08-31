/**
 * Scroll-spy — runtime del OUTPUT (docs/44 §5 fila P3). Busca todos los
 * `<a href="#...">` DESCENDIENTES del elemento, resuelve sus ids de destino
 * (`document.getElementById`, ver `registry/behaviors/scrollSpy.ts` — las
 * secciones referenciadas por ancla ya ganan `id="<nodeId>"` en el export vía
 * `nodesReferencedAsTarget`), observa esas secciones con UN solo
 * `IntersectionObserver`, y marca el `<a>` de la sección "más visible ahora"
 * con `pb-scroll-spy__link--active` + `aria-current="true"`, quitándolo del
 * anterior.
 *
 * **Cómo se decide "la sección más visible ahora" (un solo observer, varios
 * targets):** el observer usa `rootMargin` como una BANDA horizontal de
 * activación en el viewport (default `-20% 0px -60% 0px` — descarta el 20%
 * superior y el 60% inferior, dejando una banda angosta cerca de la parte
 * alta del viewport: la sección que la cruza es la que el visitante está
 * "leyendo ahora"). Entre TODAS las secciones actualmente `isIntersecting`
 * dentro de esa banda, se elige la de mayor `intersectionRatio` (más superficie
 * dentro de la banda = la más "actual"); si ninguna intersecta (huecos entre
 * secciones, o tope/fondo de la página), se conserva la última activa —
 * nunca se apaga el resaltado por un hueco momentáneo. Alternativa descartada:
 * un solo umbral con `threshold` en vez de banda por `rootMargin` — con
 * secciones de alturas dispares (hero corto junto a una sección larga), un
 * `threshold` fijo de "% de la sección visible" favorece a las secciones
 * cortas de forma desproporcionada; la banda por `rootMargin` no depende de
 * la altura de cada sección, solo de qué cruza esa franja del viewport (mismo
 * patrón que usan la mayoría de implementaciones de scroll-spy en producción).
 *
 * Progressive enhancement (P8/P9): SIN este runtime, cada `<a href="#id">`
 * sigue siendo un enlace normal — navega/salta a la sección (con
 * `scroll-behavior:smooth` si el sitio ya lo declaró globalmente). Solo se
 * pierde el resaltado del ítem activo, nunca la navegación en sí. Si el
 * elemento no tiene ningún `<a href="#...">` descendiente, o ninguno resuelve
 * a un id presente en el documento, el runtime es un no-op silencioso (no
 * lanza, no rompe nada) — es universal (`appliesTo` ausente en el registry)
 * y depende de que el usuario haya puesto enlaces de ancla dentro.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface ScrollSpyOptions {
  /**
   * `rootMargin` del `IntersectionObserver`, como banda de activación del
   * viewport (ver nota arriba). Default `-20% 0px -60% 0px`.
   */
  rootMargin?: string;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

const DEFAULT_ROOT_MARGIN = "-20% 0px -60% 0px";
const ACTIVE_CLASS = "pb-scroll-spy__link--active";

export function enhanceScrollSpy(el: HTMLElement, options: ScrollSpyOptions = {}): Cleanup | void {
  const rootMargin =
    typeof options.rootMargin === "string" && options.rootMargin.trim() !== ""
      ? options.rootMargin
      : DEFAULT_ROOT_MARGIN;

  const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  if (links.length === 0) return;

  // Mapa sección observada -> link que la referencia. Solo se observan
  // secciones que de verdad existen en el documento (defensivo: un ancla a
  // un id borrado/inexistente simplemente no participa, no rompe el resto).
  const sectionToLink = new Map<Element, HTMLAnchorElement>();
  for (const link of links) {
    const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
    if (!id) continue;
    const section = document.getElementById(id);
    if (section) sectionToLink.set(section, link);
  }
  if (sectionToLink.size === 0) return;

  if (typeof IntersectionObserver === "undefined") {
    // Sin IntersectionObserver (navegador muy antiguo): no hay forma de saber
    // qué sección es la activa. No se marca ninguna — los enlaces siguen
    // siendo navegables con normalidad (progressive enhancement, P8/P9).
    return;
  }

  let activeLink: HTMLAnchorElement | null = null;
  // Ratio de intersección actual de cada sección observada, para poder
  // recalcular "la más visible" cada vez que cambia cualquiera de ellas.
  const ratios = new Map<Element, number>();

  const setActive = (link: HTMLAnchorElement | null): void => {
    if (link === activeLink) return;
    if (activeLink) {
      activeLink.classList.remove(ACTIVE_CLASS);
      activeLink.removeAttribute("aria-current");
    }
    if (link) {
      link.classList.add(ACTIVE_CLASS);
      link.setAttribute("aria-current", "true");
    }
    activeLink = link;
  };

  const recompute = (): void => {
    let bestSection: Element | null = null;
    let bestRatio = 0;
    for (const [section, ratio] of ratios) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestSection = section;
      }
    }
    // Ninguna sección intersecta la banda de activación ahora mismo (hueco
    // entre secciones, tope o fondo de la página): se conserva la última
    // activa en vez de apagar el resaltado (evita parpadeo entre secciones).
    if (!bestSection) return;
    setActive(sectionToLink.get(bestSection) ?? null);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      recompute();
    },
    { rootMargin, threshold: [0, 0.25, 0.5, 0.75, 1] },
  );

  for (const section of sectionToLink.keys()) {
    ratios.set(section, 0);
    observer.observe(section);
  }

  return () => {
    observer.disconnect();
    setActive(null);
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
  window.__pbBehaviors.enhanceScrollSpy = (el, options) =>
    enhanceScrollSpy(el, options as ScrollSpyOptions);
}
