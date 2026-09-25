/**
 * steps.ts — tipo `TourStep`, agnóstico de dominio.
 *
 * Un `TourStep` describe un paso en términos puramente estructurales: qué ancla resaltar, qué
 * texto mostrar y qué gating aplicar (`when`/`before`/`after`). El paquete no conoce el
 * significado de la ancla ni el idioma del copy — eso lo resuelve cada editor consumidor en su
 * propio `tourSteps.ts` (F3a/F3b del plan).
 */

import type { Popover, Side, Alignment } from 'driver.js';

export interface TourStepPopover {
  title?: string;
  description?: string;
  side?: Side;
  align?: Alignment;
}

export interface TourStep {
  /** Clave de ancla (`data-tour="<anchorKey>"`) que este paso resalta. */
  anchorKey: string;
  /** Copy del popover. Ya traducido por el consumidor — el paquete no hace i18n. */
  popover: TourStepPopover;
  /**
   * Gate síncrono: si devuelve `false`, el paso se omite por completo (nunca se muestra ni
   * cuenta en la barra de progreso). Útil para pasos condicionados a flags del host
   * (ej. "solo si `enableAI` está activo") — ver §1.4.6 del plan.
   */
  when?: () => boolean;
  /**
   * Efecto asíncrono a resolver **antes** de resaltar la ancla (ej. abrir un drawer,
   * seleccionar un nodo). El tour espera a que la promesa resuelva antes de intentar
   * localizar el elemento.
   */
  before?: () => void | Promise<void>;
  /** Efecto a ejecutar después de que el usuario avance desde este paso. */
  after?: () => void | Promise<void>;
  /**
   * Si la ancla no aparece en el DOM tras `before()` (dentro del timeout de espera), el paso
   * se omite en vez de bloquear el tour. Por defecto `true` — un tour roto por un refactor no
   * debe congelar al usuario en un paso muerto (§1.4.9 / riesgos del plan).
   */
  skipMissingElement?: boolean;
  /** Milisegundos a esperar por la ancla antes de aplicar `skipMissingElement`. */
  waitForElementMs?: number;
}

/**
 * Convierte el `popover` agnóstico de `TourStep` al shape que espera driver.js. Se usa
 * internamente por `createTour`; se expone por si un consumidor necesita construir sus propios
 * `DriveStep` sin pasar por `createTour`.
 */
export function toDriverPopover(popover: TourStepPopover): Popover {
  const result: Popover = {};
  if (popover.title !== undefined) result.title = popover.title;
  if (popover.description !== undefined) result.description = popover.description;
  if (popover.side !== undefined) result.side = popover.side;
  if (popover.align !== undefined) result.align = popover.align;
  return result;
}
