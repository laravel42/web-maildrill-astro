/**
 * Carousel — runtime del OUTPUT (docs/10 §4, §5, §8.3, §11). Hidrata el
 * slider CSS `scroll-snap` ya existente (grado 0, PLAN §2.1) con Embla
 * (https://www.embla-carousel.com): flechas prev/next, dots, loop, autoplay,
 * y a11y (roles/aria + navegación por teclado) — Embla no los provee solo.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/` (core del editor). Solo conoce el DOM, `embla-carousel` y sus
 * `options` (JSON plano, ya validadas por el `optionsSchema` del behavior).
 *
 * Estructura del DOM esperada (emitida por el export, docs/07 §…): el nodo
 * `container` con `overflow-x: auto/scroll` + hijos = slides directos (sin
 * wrapper `viewport`/`container` — eso es chrome del slider CSS, no de Embla).
 * Embla exige dos niveles (`viewport` > `container` de slides), así que el
 * `enhance` los CREA en runtime, envolviendo los hijos existentes SIN alterar
 * el HTML exportado (el envoltorio es DOM, no JSON — P1/P8 intactos): el sitio
 * sin JS sigue viendo exactamente el slider plano de siempre.
 */

import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";

export interface CarouselOptions {
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  autoplay?: boolean;
  /** Espacio entre slides (cualquier longitud CSS válida, ej. "16px"). */
  gap?: string;
  /**
   * Tamaño de cada slide en el EJE DE SCROLL (ancho si horizontal, alto si
   * vertical) — cualquier longitud/porcentaje CSS válido (ej. "80%", "320px").
   * El eje CRUZADO siempre se limita al 100% del viewport (ancho completo en
   * vertical, alto completo en horizontal) para que el carousel nunca
   * desborde el contenedor sin que el usuario tenga que fijarlo a mano.
   */
  slideSize?: string;
  /** Muestra las flechas prev/next generadas por el runtime. Default true. */
  showArrows?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

const AUTOPLAY_INTERVAL_MS = 4000;
const DEFAULT_GAP = "16px";
const DEFAULT_SLIDE_SIZE = "80%";

function createArrowButton(
  direction: "prev" | "next",
  label: string,
  isVertical: boolean,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pb-carousel__arrow pb-carousel__arrow--${direction}`;
  button.setAttribute("aria-label", label);
  // Los glifos deben apuntar en el eje de scroll real (feedback de usuario:
  // en vertical, "anterior/siguiente" es arriba/abajo, no izquierda/derecha).
  // &#8963; (⌃) / &#8964; (⌄) no son universales en todas las fuentes; se usan
  // los triángulos ▲/▼ (más soportados) para vertical.
  const glyphs = isVertical
    ? { prev: "&#9650;", next: "&#9660;" } // ▲ ▼
    : { prev: "&#8249;", next: "&#8250;" }; // ‹ ›
  button.innerHTML = direction === "prev" ? glyphs.prev : glyphs.next;
  return button;
}

function createDotsNav(count: number): { nav: HTMLElement; dots: HTMLButtonElement[] } {
  const nav = document.createElement("div");
  nav.className = "pb-carousel__dots";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "Diapositivas");
  const dots: HTMLButtonElement[] = [];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "pb-carousel__dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `Ir a la diapositiva ${i + 1}`);
    nav.appendChild(dot);
    dots.push(dot);
  }
  return { nav, dots };
}

/**
 * Hidrata un contenedor de carousel: envuelve sus hijos (slides) en la
 * estructura de dos niveles que Embla necesita, monta la instancia real, y
 * agrega flechas + dots + a11y alrededor. `el` sigue siendo el mismo nodo del
 * export (mismo `className`); el envoltorio interno es 100% runtime.
 *
 * Orientación (feedback de usuario): Embla exige que el CSS stackee los
 * slides en el mismo eje que `axis` — eso lo resuelve este runtime, no el
 * usuario. En horizontal, `container` es `flex-direction: row` y cada slide
 * mide `width: <slideSize>` + `height: 100%` (el eje cruzado siempre ocupa el
 * viewport completo). En vertical es al revés: `flex-direction: column`,
 * slide con `height: <slideSize>` + `width: 100%`, y el viewport necesita una
 * altura explícita (a diferencia del horizontal, un bloque no tiene alto
 * "natural" que recortar) — se toma la altura ya renderizada de `el` antes de
 * reemplazar sus hijos, para no depender de que el usuario fije `size.height`
 * a mano en el Inspector.
 */
export function enhanceCarousel(el: HTMLElement, options: CarouselOptions = {}): Cleanup | void {
  const {
    orientation = "horizontal",
    loop = false,
    autoplay = false,
    gap = DEFAULT_GAP,
    slideSize = DEFAULT_SLIDE_SIZE,
    showArrows = true,
  } = options;
  const isVertical = orientation === "vertical";
  const slides = Array.from(el.children) as HTMLElement[];
  if (slides.length === 0) return;

  // Altura pre-hidratación (solo relevante en vertical, ver comentario arriba).
  const measuredHeight = isVertical ? el.getBoundingClientRect().height : 0;

  // --- Estructura de dos niveles exigida por Embla (viewport > container) --
  const viewport = document.createElement("div");
  viewport.className = "pb-carousel__viewport";
  const container = document.createElement("div");
  container.className = "pb-carousel__container";
  container.style.flexDirection = isVertical ? "column" : "row";
  container.style.gap = gap;
  if (isVertical) {
    viewport.style.height = measuredHeight > 0 ? `${measuredHeight}px` : "100%";
    container.style.height = "100%";
  }
  slides.forEach((slide, i) => {
    slide.classList.add("pb-carousel__slide");
    if (isVertical) {
      slide.style.height = slideSize;
      slide.style.width = "100%";
    } else {
      slide.style.width = slideSize;
      slide.style.height = "100%";
    }
    // Con `loop: true`, el CSS `gap` de flexbox no aplica en la "costura"
    // entre el último slide y el primero (Embla los trata como contiguos en
    // el ciclo, pero `gap` solo separa elementos consecutivos en el DOM —
    // documentado por Embla: https://www.embla-carousel.com/docs/guides/slide-gaps/#gap-with-loop-enabled).
    // El workaround oficial es agregar al ÚLTIMO slide un margin, en el eje
    // de scroll activo, igual al `gap` — así la vuelta al principio conserva
    // el mismo espaciado que el resto (feedback de usuario: sin esto, el
    // último y el primer slide quedaban pegados en loop).
    if (loop && i === slides.length - 1) {
      if (isVertical) slide.style.marginBottom = gap;
      else slide.style.marginRight = gap;
    }
    container.appendChild(slide);
  });
  viewport.appendChild(container);
  el.replaceChildren(viewport);
  el.classList.add("pb-carousel--enhanced", `pb-carousel--${orientation}`);

  const emblaApi: EmblaCarouselType = EmblaCarousel(viewport, {
    loop,
    align: "start",
    axis: isVertical ? "y" : "x",
  });

  // --- Flechas prev/next (a11y: aria-label + disabled cuando no aplica) ----
  // Opt-out vía `showArrows: false` (feedback de usuario): algunos diseños
  // prefieren solo dots, o navegación por swipe/teclado sin flechas visibles.
  const prevBtn = showArrows ? createArrowButton("prev", "Anterior", isVertical) : null;
  const nextBtn = showArrows ? createArrowButton("next", "Siguiente", isVertical) : null;
  prevBtn?.addEventListener("click", () => emblaApi.scrollPrev());
  nextBtn?.addEventListener("click", () => emblaApi.scrollNext());
  if (prevBtn) el.appendChild(prevBtn);
  if (nextBtn) el.appendChild(nextBtn);

  // --- Dots: uno por snap point, activo = aria-selected -------------------
  const { nav: dotsNav, dots } = createDotsNav(emblaApi.scrollSnapList().length);
  dots.forEach((dot, i) => dot.addEventListener("click", () => emblaApi.scrollTo(i)));
  el.appendChild(dotsNav);

  function updateUi(): void {
    if (prevBtn) prevBtn.disabled = !loop && !emblaApi.canScrollPrev();
    if (nextBtn) nextBtn.disabled = !loop && !emblaApi.canScrollNext();
    const selected = emblaApi.selectedScrollSnap();
    dots.forEach((dot, i) => {
      const isSelected = i === selected;
      dot.classList.toggle("pb-carousel__dot--selected", isSelected);
      dot.setAttribute("aria-selected", String(isSelected));
    });
  }

  emblaApi.on("select", updateUi);
  emblaApi.on("reInit", updateUi);
  updateUi();

  // --- Navegación por teclado (docs/10 §6: Embla no la da sola) -----------
  // Flechas del eje de scroll activo mueven el carousel cuando el foco está
  // dentro de él (contenedor, flechas o dots) — patrón estándar de widget
  // "carousel". En vertical son ↑/↓; en horizontal, ←/→ (feedback de usuario:
  // debe coincidir con el eje elegido, no quedar fijo a horizontal).
  el.setAttribute("role", "region");
  el.setAttribute("aria-roledescription", "carousel");
  const prevKey = isVertical ? "ArrowUp" : "ArrowLeft";
  const nextKey = isVertical ? "ArrowDown" : "ArrowRight";
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === prevKey) {
      event.preventDefault();
      emblaApi.scrollPrev();
    } else if (event.key === nextKey) {
      event.preventDefault();
      emblaApi.scrollNext();
    }
  }
  el.addEventListener("keydown", handleKeydown);

  // --- Autoplay manual (mantiene el bundle sin la dep extra del plugin) ---
  let autoplayTimer: ReturnType<typeof setInterval> | undefined;
  if (autoplay) {
    autoplayTimer = setInterval(() => {
      if (!loop && !emblaApi.canScrollNext()) {
        emblaApi.scrollTo(0);
      } else {
        emblaApi.scrollNext();
      }
    }, AUTOPLAY_INTERVAL_MS);
  }

  return () => {
    if (autoplayTimer) clearInterval(autoplayTimer);
    el.removeEventListener("keydown", handleKeydown);
    emblaApi.destroy();
    prevBtn?.remove();
    nextBtn?.remove();
    dotsNav.remove();
    el.classList.remove("pb-carousel--enhanced", `pb-carousel--${orientation}`);
    // Restaura los slides como hijos directos de `el` (estado pre-hidratación),
    // incluyendo los estilos inline de tamaño/margin que este `enhance` les puso.
    slides.forEach((slide) => {
      slide.classList.remove("pb-carousel__slide");
      slide.style.width = "";
      slide.style.height = "";
      slide.style.marginRight = "";
      slide.style.marginBottom = "";
      el.appendChild(slide);
    });
    viewport.remove();
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`)
// ---------------------------------------------------------------------------
// Cada bundle de behavior se emite y carga de forma independiente y
// tree-shakeada por uso (`assets/js/<moduleId>.js`); el loader (`enhance.js`)
// no lo importa estáticamente. Este side-effect es el único punto de
// acoplamiento: registra la función bajo el nombre por convención
// (`enhance<Type>`) para que `enhance.ts` la resuelva sin conocer `carousel`.
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceCarousel = (el, options) => enhanceCarousel(el, options as CarouselOptions);
}
