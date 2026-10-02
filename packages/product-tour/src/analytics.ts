/**
 * analytics.ts — callback de telemetría genérico.
 *
 * @md/product-tour no importa ningún SDK de analítica (§0.2 del plan): no conoce PostHog, no
 * conoce Maildrill. El paquete solo emite `TourAnalyticsEvent` a un callback `onEvent` que el
 * consumidor conecta a lo que sea que use — PostHog en Maildrill hoy, cualquier otra cosa en
 * el host de la landing el día que Builder42 se extraiga.
 */

export type TourAnalyticsEventName =
  | 'tour_started'
  | 'tour_step_viewed'
  | 'tour_completed'
  | 'tour_dismissed';

export interface TourAnalyticsEvent {
  event: TourAnalyticsEventName;
  tourId: string;
  /** Índice del paso (0-based) cuando aplica (`tour_step_viewed`, `tour_dismissed`). */
  stepIndex?: number;
  /** Total de pasos efectivos del tour (tras filtrar por `when`), cuando aplica. */
  totalSteps?: number;
}

export type TourAnalyticsCallback = (event: TourAnalyticsEvent) => void;

/**
 * Envuelve un callback opcional en una función segura: si `onEvent` lanza, el error se
 * silencia (con log en consola) en vez de romper el tour. La analítica nunca debe poder
 * tumbar la experiencia del editor.
 */
export function createAnalyticsEmitter(onEvent?: TourAnalyticsCallback): TourAnalyticsCallback {
  if (!onEvent) return () => {};
  return (event) => {
    try {
      onEvent(event);
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error('[@md/product-tour] onEvent callback threw', error);
      }
    }
  };
}
