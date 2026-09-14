/**
 * @md/product-tour — API pública.
 *
 * Paquete agnóstico de dominio y de host (§0 de docs/product-tour-driverjs-plan.md): no
 * importa nada de `src/` de ningún proyecto consumidor, no conoce PostHog ni ningún otro SDK
 * de analítica, y no asume un prefijo de `localStorage`. Diseñado para viajar sin cambios el
 * día que `packages/builder42` se extraiga como proyecto independiente.
 */

export { createTour } from './createTour';
export type { CreateTourOptions, Tour } from './createTour';

export type { TourStep, TourStepPopover } from './steps';
export { toDriverPopover } from './steps';

export { isSupportedRoot, resolveAnchor, waitForAnchor } from './anchors';
export type { TourRoot } from './anchors';

export { createLocalStoragePersistence } from './persistence';
export type { TourPersistence, TourPersistenceState } from './persistence';

export { createAnalyticsEmitter } from './analytics';
export type {
  TourAnalyticsCallback,
  TourAnalyticsEvent,
  TourAnalyticsEventName,
} from './analytics';
