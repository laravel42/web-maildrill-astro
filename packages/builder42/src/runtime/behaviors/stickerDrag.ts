/**
 * Sticker drag — runtime del OUTPUT. Hace arrastrable con puntero (ratón, dedo
 * o lápiz) el nodo que lleve el behavior `sticker-drag`.
 *
 * Reparto de tiers, igual que `sticky`: la pegatina ya está colocada, anclada y
 * rotada SIN este archivo (lo hacen el `css` y el estilo inline de
 * `registry/components/Sticker.tsx`). Este módulo es el único tier 1 y solo
 * añade el gesto. Si el bundle no carga, la pegatina se ve exactamente igual;
 * lo único que no ocurre es que se pueda mover.
 *
 * ## Por qué escribe variables CSS y no `transform`
 *
 * El componente emite `transform: translate(var(--pb-sticker-dx, 0px),
 * var(--pb-sticker-dy, 0px)) rotate(Ndeg)`. Este runtime escribe ÚNICAMENTE las
 * dos variables. Así no tiene que leer, parsear ni reconstruir la cadena de
 * transform — que además lleva la rotación y, en el anclaje centrado, un
 * `translate(-50%, -50%)` previo que un `el.style.transform = ...` destruiría.
 *
 * ## Puntero, no ratón
 *
 * Un solo juego de Pointer Events cubre ratón, táctil y lápiz.
 * `setPointerCapture` mantiene los eventos dirigidos al elemento aunque el
 * puntero se salga de él a media pasada, lo que elimina la necesidad de
 * escuchar en `document` y el clásico "se quedó pegado" al soltar fuera de la
 * ventana. El CSS del behavior pone `touch-action: none` para que en móvil el
 * gesto arrastre la pegatina en vez de hacer scroll de la página.
 *
 * ## Accesibilidad
 *
 * La pegatina es decorativa en su comportamiento, no en su contenido: su texto
 * sigue siendo texto real y accesible, y moverla no cambia nada del sitio. Por
 * eso NO se hace focusable ni se le añade alternativa por teclado — un control
 * enfocable que no lleva a ninguna parte es peor para quien navega con teclado
 * que un adorno que se ignora. El gesto es puro enriquecimiento: si no ocurre,
 * no se pierde ninguna información ni ninguna acción.
 *
 * Regla dura (P8): este archivo NUNCA importa nada de `src/builder/`. Solo
 * conoce el DOM y sus `options`.
 */

export interface StickerDragOptions {
  /** Ejes permitidos. Default "both". */
  axis?: "both" | "x" | "y";
  /**
   * Si la pegatina no puede salir del rectángulo de su elemento padre.
   * Default `true` — lo contrario deja arrastrarla fuera de la sección y
   * perderla de vista, que casi nunca es lo que se quiere.
   */
  bounded?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

const DRAGGING_CLASS = "pb-sticker--dragging";
const DRAGGABLE_CLASS = "pb-sticker--draggable";

export function enhanceStickerDrag(el: HTMLElement, options: StickerDragOptions = {}): Cleanup | void {
  const { axis = "both", bounded = true } = options;

  // El cursor lo pone el JS, no el CSS del behavior: si el bundle no cargara,
  // un `cursor: grab` declarado en la hoja prometería un gesto que no existe
  // (mismo criterio que la clase `--scrolled` de `sticky`).
  el.classList.add(DRAGGABLE_CLASS);

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let baseDx = 0;
  let baseDy = 0;
  let dx = 0;
  let dy = 0;
  let frame = 0;

  function currentVar(name: string): number {
    const raw = el.style.getPropertyValue(name).trim();
    if (raw === "") return 0;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * Límites del desplazamiento para que la pegatina no se salga del padre.
   * Se calculan en cada `pointerdown` (no al inicializar) porque el layout
   * puede haber cambiado entre medias: un breakpoint distinto, una imagen que
   * acabó de cargar, o la propia sección creciendo con su contenido.
   */
  function clampRange(): { minX: number; maxX: number; minY: number; maxY: number } | null {
    const parent = el.parentElement;
    if (!parent) return null;
    const box = el.getBoundingClientRect();
    const bounds = parent.getBoundingClientRect();
    // `box` ya incluye el desplazamiento actual, así que los límites se
    // expresan relativos a él y luego se suman al acumulado.
    return {
      minX: bounds.left - box.left + baseDx,
      maxX: bounds.right - box.right + baseDx,
      minY: bounds.top - box.top + baseDy,
      maxY: bounds.bottom - box.bottom + baseDy,
    };
  }

  let range: ReturnType<typeof clampRange> = null;

  function paint(): void {
    frame = 0;
    el.style.setProperty("--pb-sticker-dx", `${Math.round(dx)}px`);
    el.style.setProperty("--pb-sticker-dy", `${Math.round(dy)}px`);
  }

  function schedulePaint(): void {
    if (frame !== 0) return;
    frame = requestAnimationFrame(paint);
  }

  function onPointerDown(event: PointerEvent): void {
    // Solo el botón primario: un clic derecho o el botón central no arrastran.
    if (event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    baseDx = currentVar("--pb-sticker-dx");
    baseDy = currentVar("--pb-sticker-dy");
    dx = baseDx;
    dy = baseDy;
    range = bounded ? clampRange() : null;
    el.setPointerCapture(pointerId);
    el.classList.add(DRAGGING_CLASS);
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (axis !== "y") dx = baseDx + (event.clientX - startX);
    if (axis !== "x") dy = baseDy + (event.clientY - startY);
    if (range) {
      dx = Math.min(Math.max(dx, range.minX), range.maxX);
      dy = Math.min(Math.max(dy, range.minY), range.maxY);
    }
    schedulePaint();
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    pointerId = null;
    el.classList.remove(DRAGGING_CLASS);
    // Pinta la posición final por si el último move quedó en un frame pendiente.
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    paint();
  }

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerUp);
    el.classList.remove(DRAGGING_CLASS, DRAGGABLE_CLASS);
    el.style.removeProperty("--pb-sticker-dx");
    el.style.removeProperty("--pb-sticker-dy");
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
  window.__pbBehaviors.enhanceStickerDrag = (el, options) =>
    enhanceStickerDrag(el, options as StickerDragOptions);
}
