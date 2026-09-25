/**
 * templateHoverPreviewStore — estado mínimo del hover-preview AMPLIADO de
 * templates/secciones (fase A, homologación UI/UX; concepto de
 * `hoverPreviewStore.ts` + `LibraryHoverPreviewPortal.tsx` de email-builder).
 *
 * Un único portal (`TemplateHoverPreviewPortal.tsx`) se monta una vez al nivel
 * del `Sidebar`/`TemplatesPanel` y lee este store; cada tarjeta
 * (`TemplateCardPreview` en `TemplateCard.tsx`) solo despacha
 * `requestHoverEnter`/`requestHoverLeave` sin renderizar nada propio del
 * popover — mismo desacoplamiento "N cards → 1 portal" que el original.
 *
 * A diferencia de email-builder (que reutiliza un iframe + `<Reader>` para no
 * bloquear el hilo principal con `renderToStaticMarkup` sobre documentos
 * grandes), builder42 YA renderiza sus miniaturas con HTML/CSS en vivo
 * (`layoutPreviewMarkup`/`fragmentPreviewMarkup`, síncronos y baratos — no hay
 * such bloqueo real que evitar aquí), así que no hace falta un iframe: el
 * portal reutiliza el mismo `dangerouslySetInnerHTML` que la miniatura
 * pequeña, solo a mayor escala. No hay lib de terceros (Popper/etc.) — la
 * posición se calcula a mano, mismo patrón que `SelectionHandle`/
 * `NodeActionsRail` (medir rect contra un ancla, sin CSS `position: relative`
 * de terceros).
 */

import { useSyncExternalStore } from "react";
import type { LayoutDefinition } from "../registry/layoutRegistry";

export interface HoverPreviewDescriptor {
  /** Layout completo (página o sección) — ya resuelto por la tarjeta, sin refetch. */
  layout: LayoutDefinition;
  /** Elemento ancla (la tarjeta) contra el que se posiciona el popover. */
  anchor: HTMLElement;
}

let active: HoverPreviewDescriptor | null = null;
const listeners = new Set<() => void>();

// ms — sostenido antes de mostrar (evita parpadeo al pasar el mouse de paso,
// mismo criterio que `HoverHandle.tsx` HOVER_DELAY_MS) y antes de ocultar
// (deja tiempo a que el puntero viaje de la tarjeta al popover sin cerrarlo).
const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 150;

let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  for (const l of listeners) l();
}

function clearOpenTimer(): void {
  if (openTimer !== null) {
    clearTimeout(openTimer);
    openTimer = null;
  }
}

function clearCloseTimer(): void {
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

/** Programa la apertura del popover para `descriptor` tras `OPEN_DELAY_MS`. */
export function requestHoverEnter(descriptor: HoverPreviewDescriptor): void {
  clearCloseTimer();
  clearOpenTimer();
  openTimer = setTimeout(() => {
    openTimer = null;
    active = descriptor;
    notify();
  }, OPEN_DELAY_MS);
}

/** Programa el cierre tras `CLOSE_DELAY_MS` — cancelable por `cancelHoverClose`. */
export function requestHoverLeave(): void {
  clearOpenTimer();
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    closeTimer = null;
    active = null;
    notify();
  }, CLOSE_DELAY_MS);
}

/** El puntero entró al popover mismo (viniendo de la tarjeta): cancela el cierre pendiente. */
export function cancelHoverClose(): void {
  clearCloseTimer();
}

/** Hook de lectura del descriptor activo (o `null`). */
export function useActiveTemplateHoverPreview(): HoverPreviewDescriptor | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => active,
  );
}
