/**
 * Lightbox — runtime del OUTPUT (docs/44 §5 fila P3, tier 2). Click en una
 * imagen (`el`, la propia `<img>`) abre un overlay de pantalla completa con
 * la imagen ampliada. Alcance de esta fase (docs/44 §6): nodos `image`
 * individuales — si varias imágenes `lightbox` comparten el mismo padre
 * inmediato en el DOM exportado (patrón "grid de imágenes" más simple, sin
 * necesitar un tipo de componente nuevo), se agrupan automáticamente y el
 * overlay ofrece navegación anterior/siguiente entre ellas.
 *
 * **Overlay 100% inyectado por el runtime** (patrón `carousel.ts`/
 * `modal.ts`): nunca existe en el HTML exportado (P8) — se crea al abrir y se
 * remueve al cerrar. El `<img>` base SIGUE siendo una imagen normal,
 * funcional sin este script (P8/P9: el behavior solo AÑADE la interacción,
 * nunca oculta ni reemplaza el contenido base).
 *
 * **Foco (criterio no-negociable del plan):** al abrir, el foco se mueve al
 * botón de cerrar del overlay; al cerrar, vuelve exactamente al `<img>` que
 * abrió el lightbox (se le asigna `tabindex="0"` para poder recibir foco).
 * Mientras el overlay está abierto, el foco queda ATRAPADO dentro (Tab/
 * Shift+Tab cíclico entre cerrar/prev/next) — no se usa `<dialog>` nativo
 * aquí (a diferencia de `modal.ts`) porque un `<dialog>` no admite fácilmente
 * el swipe/gestos táctiles sin interferir con su propio manejo de foco al
 * cambiar de imagen sin cerrar/reabrir; el focus-trap se implementa a mano,
 * mismo criterio de robustez que cualquier overlay custom.
 *
 * **Teclado:** Escape cierra; con más de una imagen en el grupo, flecha
 * izquierda/derecha navegan.
 *
 * **Swipe:** un gesto táctil horizontal simple (`touchstart`/`touchend`,
 * sin librería) navega entre imágenes del grupo.
 *
 * **`prefers-reduced-motion`:** la transición de apertura/cierre (opacidad)
 * se omite si el usuario la prefiere reducida — el overlay igual abre/cierra,
 * solo sin animación.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface LightboxOptions {
  /** Duración de la transición de apertura/cierre en ms. Default 180. */
  duration?: number;
  /** Etiqueta accesible del botón de cerrar. Default "Cerrar". */
  closeLabel?: string;
  /** Etiqueta accesible del botón "anterior". Default "Imagen anterior". */
  prevLabel?: string;
  /** Etiqueta accesible del botón "siguiente". Default "Imagen siguiente". */
  nextLabel?: string;
}

export type Cleanup = () => void;

const DEFAULT_DURATION = 180;
const DEFAULT_CLOSE_LABEL = "Cerrar";
const DEFAULT_PREV_LABEL = "Imagen anterior";
const DEFAULT_NEXT_LABEL = "Imagen siguiente";
/** px mínimos de desplazamiento horizontal para contar como swipe (no un tap/scroll accidental). */
const SWIPE_THRESHOLD = 40;

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Grupo de imágenes navegables: todas las `<img>` HERMANAS de `el` (mismo
 * padre inmediato) que también tengan el behavior `lightbox` activo
 * (`data-pb-behavior` incluye "lightbox"). Si `el` no tiene hermanas así,
 * el grupo es `[el]` (single-image, sin navegación prev/next). Se recalcula
 * en cada apertura (no en el montaje) para tolerar cambios de DOM entre
 * medio — coherente con que este runtime nunca muta el árbol de imágenes.
 */
function resolveGroup(el: HTMLImageElement): HTMLImageElement[] {
  const parent = el.parentElement;
  if (!parent) return [el];
  const siblings = Array.from(parent.children).filter((child): child is HTMLImageElement => {
    if (child.tagName !== "IMG") return false;
    const behaviorAttr = (child as HTMLImageElement).dataset.pbBehavior ?? "";
    return behaviorAttr.split(/\s+/).includes("lightbox");
  });
  return siblings.length > 0 ? siblings : [el];
}

export function enhanceLightbox(el: HTMLElement, options: LightboxOptions = {}): Cleanup | void {
  if (el.tagName !== "IMG") return;
  const img = el as HTMLImageElement;

  const {
    duration = DEFAULT_DURATION,
    closeLabel = DEFAULT_CLOSE_LABEL,
    prevLabel = DEFAULT_PREV_LABEL,
    nextLabel = DEFAULT_NEXT_LABEL,
  } = options;

  // Foco alcanzable: una `<img>` no es focusable de por sí; se necesita para
  // poder devolver el foco al cerrar (criterio no-negociable del plan).
  if (!img.hasAttribute("tabindex")) img.tabIndex = 0;
  img.style.cursor = "pointer";

  let overlay: HTMLDivElement | null = null;
  let currentIndex = 0;
  let group: HTMLImageElement[] = [img];
  let touchStartX: number | null = null;
  let triggerEl: HTMLImageElement = img;

  function reducedMotion(): boolean {
    return prefersReducedMotion();
  }

  function renderOverlayImage(): void {
    if (!overlay) return;
    const target = group[currentIndex] ?? img;
    const overlayImg = overlay.querySelector<HTMLImageElement>(".pb-lightbox__image");
    if (overlayImg) {
      overlayImg.src = target.currentSrc || target.src;
      overlayImg.alt = target.alt;
    }
    const prevBtn = overlay.querySelector<HTMLButtonElement>(".pb-lightbox__nav--prev");
    const nextBtn = overlay.querySelector<HTMLButtonElement>(".pb-lightbox__nav--next");
    const showNav = group.length > 1;
    if (prevBtn) prevBtn.hidden = !showNav;
    if (nextBtn) nextBtn.hidden = !showNav;
  }

  function goTo(index: number): void {
    if (group.length === 0) return;
    currentIndex = ((index % group.length) + group.length) % group.length;
    renderOverlayImage();
  }

  function focusableInOverlay(): HTMLElement[] {
    if (!overlay) return [];
    return Array.from(
      overlay.querySelectorAll<HTMLElement>("button:not([hidden])"),
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (group.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      goTo(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
      return;
    }
    if (event.key === "Tab") {
      // Focus trap básico: cicla el foco entre los controles del overlay.
      const focusable = focusableInOverlay();
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function onTouchStart(event: TouchEvent): void {
    touchStartX = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent): void {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || group.length <= 1) return;
    // Swipe a la izquierda (deltaX negativo) → siguiente; a la derecha → anterior.
    goTo(currentIndex + (deltaX < 0 ? 1 : -1));
  }

  function close(): void {
    if (!overlay) return;
    const node = overlay;
    overlay = null;
    document.removeEventListener("keydown", onKeydown, true);

    const finish = (): void => {
      node.remove();
      document.body.style.overflow = "";
      // Devuelve el foco al elemento que abrió el lightbox (criterio del plan).
      triggerEl.focus();
    };

    if (!reducedMotion() && typeof node.animate === "function") {
      const anim = node.animate({ opacity: [1, 0] }, { duration, easing: "ease-in" });
      anim.onfinish = finish;
      anim.oncancel = finish;
    } else {
      finish();
    }
  }

  function open(): void {
    if (overlay) return;
    triggerEl = img;
    group = resolveGroup(img);
    currentIndex = group.indexOf(img);
    if (currentIndex < 0) currentIndex = 0;

    const node = document.createElement("div");
    node.className = "pb-lightbox__overlay";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "true");
    node.setAttribute("aria-label", img.alt || closeLabel);

    const figure = document.createElement("div");
    figure.className = "pb-lightbox__figure";

    const overlayImg = document.createElement("img");
    overlayImg.className = "pb-lightbox__image";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pb-lightbox__close";
    closeBtn.setAttribute("aria-label", closeLabel);
    closeBtn.innerHTML = "&#10005;";
    closeBtn.addEventListener("click", close);

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "pb-lightbox__nav pb-lightbox__nav--prev";
    prevBtn.setAttribute("aria-label", prevLabel);
    prevBtn.innerHTML = "&#8249;";
    prevBtn.addEventListener("click", () => goTo(currentIndex - 1));

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pb-lightbox__nav pb-lightbox__nav--next";
    nextBtn.setAttribute("aria-label", nextLabel);
    nextBtn.innerHTML = "&#8250;";
    nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

    figure.appendChild(overlayImg);
    node.appendChild(figure);
    node.appendChild(closeBtn);
    node.appendChild(prevBtn);
    node.appendChild(nextBtn);

    // Cierra al hacer click en el fondo (fuera de la imagen/controles), no en la imagen misma.
    node.addEventListener("click", (event) => {
      if (event.target === node) close();
    });
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });

    document.body.appendChild(node);
    document.body.style.overflow = "hidden";
    overlay = node;
    renderOverlayImage();

    document.addEventListener("keydown", onKeydown, true);

    if (!reducedMotion() && typeof node.animate === "function") {
      node.animate({ opacity: [0, 1] }, { duration, easing: "ease-out" });
    }

    // Foco al control de cerrar (criterio no-negociable del plan).
    closeBtn.focus();
  }

  const onClick = (event: Event): void => {
    event.preventDefault();
    open();
  };
  const onKeyOpen = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  img.addEventListener("click", onClick);
  img.addEventListener("keydown", onKeyOpen);

  return () => {
    img.removeEventListener("click", onClick);
    img.removeEventListener("keydown", onKeyOpen);
    close();
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
  window.__pbBehaviors.enhanceLightbox = (el, options) =>
    enhanceLightbox(el, options as LightboxOptions);
}
