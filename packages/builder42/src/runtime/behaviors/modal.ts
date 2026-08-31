/**
 * Modal — runtime del OUTPUT (docs/20 §2.3). El `<dialog>` es la raíz del nodo
 * (cerrado = cero espacio). Se abre desde disparadores EXTERNOS que llevan
 * `data-pb-modal-target="<id>"` (acción `onClick` universal, docs/20 §3): el
 * runtime lee `data-pb-modal-id` del diálogo y engancha esos disparadores.
 *   - `showModal()` → backdrop + focus-trap e `inert` nativos (no reinventados);
 *   - cierre por botón (`[data-pb-modal-close]`), backdrop y Escape;
 *   - transición de apertura/cierre (opacidad + escala) vía WAAPI, con fallback
 *     instantáneo si no hay WAAPI o el usuario pide movimiento reducido.
 *
 * Progressive enhancement (P8/P9): SIN JS, un disparador-ancla + el CSS
 * `:target` muestran el diálogo (docs/20 §3.3). El JS lo eleva a modal real.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 */

export interface ModalOptions {
  /** Cerrar al hacer click en el backdrop. Default true. */
  closeOnBackdrop?: boolean;
  /** Duración de la transición en ms. Default 200. */
  duration?: number;
}

export type Cleanup = () => void;

const DEFAULT_DURATION = 200;

// ---------------------------------------------------------------------------
// Bloqueo del scroll de la página mientras hay un modal abierto (feedback de
// usuario): sin esto, el `<dialog>` en top-layer deja la página scrolleable por
// detrás → doble barra de scroll fea que come pantalla. El "hay algún modal
// abierto" se deriva del DOM (`dialog.pb-modal__dialog[open]`), no de un
// contador global — así varios modales anidados no se pisan y no queda estado
// colgado. Se compensa el ancho de la scrollbar para que el contenido no
// "salte" al ocultarla.
// ---------------------------------------------------------------------------
let savedOverflow = "";
let savedPaddingRight = "";

function openModalDialogs(): number {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll("dialog.pb-modal__dialog[open]").length;
}

function lockPageScroll(): void {
  if (typeof document === "undefined" || !document.body) return;
  const body = document.body;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPaddingRight = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbarWidth}px`;
  }
}

function unlockPageScroll(): void {
  if (typeof document === "undefined" || !document.body) return;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPaddingRight;
}

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

export function enhanceModal(el: HTMLElement, options: ModalOptions = {}): Cleanup | void {
  // `el` es el propio <dialog> en el export; en Preview del editor puede ser un
  // placeholder (sin diálogo) → no-op seguro.
  const dialog = (
    el.tagName.toLowerCase() === "dialog" ? el : el.querySelector("dialog.pb-modal__dialog")
  ) as HTMLDialogElement | null;
  if (!dialog) return;

  const modalId = dialog.dataset.pbModalId ?? dialog.id;
  const closeOnBackdrop = options.closeOnBackdrop !== false;
  const duration =
    typeof options.duration === "number" && options.duration >= 0 ? options.duration : DEFAULT_DURATION;
  const box = dialog.querySelector<HTMLElement>(".pb-modal__box") ?? dialog;
  const closeButtons = Array.from(dialog.querySelectorAll<HTMLElement>("[data-pb-modal-close]"));

  // Disparadores externos ligados a este modal por id (docs/20 §3).
  const triggers = modalId
    ? Array.from(document.querySelectorAll<HTMLElement>(`[data-pb-modal-target="${modalId}"]`))
    : [];

  const open = (event?: Event): void => {
    event?.preventDefault();
    if (dialog.open) return;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch {
      dialog.setAttribute("open", "");
    }
    // Bloquea el scroll en la transición 0→1 (este es el único modal abierto).
    if (openModalDialogs() === 1) lockPageScroll();
    if (canAnimate(box)) {
      box.animate(
        { opacity: [0, 1], transform: ["scale(0.96)", "scale(1)"] },
        { duration, easing: "ease-out" },
      );
    }
  };

  const finishClose = (): void => {
    const wasOpen = dialog.open;
    try {
      dialog.close();
    } catch {
      dialog.removeAttribute("open");
    }
    // Restaura el scroll en la transición 1→0 (ya no queda ningún modal abierto).
    if (wasOpen && openModalDialogs() === 0) unlockPageScroll();
  };

  const close = (): void => {
    if (!dialog.open) return;
    if (canAnimate(box)) {
      const anim = box.animate(
        { opacity: [1, 0], transform: ["scale(1)", "scale(0.96)"] },
        { duration, easing: "ease-in" },
      );
      anim.onfinish = finishClose;
      anim.oncancel = finishClose;
    } else {
      finishClose();
    }
  };

  const onTriggerClick = (event: Event): void => open(event);
  const onBackdropClick = (event: MouseEvent): void => {
    if (closeOnBackdrop && event.target === dialog) close();
  };
  const onCancel = (event: Event): void => {
    event.preventDefault();
    close();
  };
  const onCloseClick = (event: Event): void => {
    event.preventDefault();
    close();
  };

  triggers.forEach((t) => t.addEventListener("click", onTriggerClick));
  dialog.addEventListener("click", onBackdropClick);
  dialog.addEventListener("cancel", onCancel);
  closeButtons.forEach((btn) => btn.addEventListener("click", onCloseClick));

  return () => {
    triggers.forEach((t) => t.removeEventListener("click", onTriggerClick));
    dialog.removeEventListener("click", onBackdropClick);
    dialog.removeEventListener("cancel", onCancel);
    closeButtons.forEach((btn) => btn.removeEventListener("click", onCloseClick));
    if (dialog.open) finishClose();
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
  window.__pbBehaviors.enhanceModal = (el, options) => enhanceModal(el, options as ModalOptions);
}
