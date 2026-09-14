/**
 * createTour.ts — factory sobre driver.js.
 *
 * Responsabilidades (§F1 del plan):
 * - Carga diferida de `driver.js` (`await import(...)`), invocada solo al arrancar el tour,
 *   nunca en el top-level del módulo — el bundle del consumidor no paga el costo si el tour
 *   nunca se abre.
 * - No-op silencioso cuando `root` es un `ShadowRoot` (§1.4.1 del plan / anchors.ts).
 * - Filtrado de pasos por `when()`, con `before()`/`after()` resueltos alrededor de cada highlight.
 * - Contención de Escape: mientras el tour está activo, un `keydown` de Escape se intercepta
 *   en fase de captura y se detiene su propagación, para no cerrar el editor anfitrión
 *   (§1.4.3 del plan).
 * - Respeta `prefers-reduced-motion` desactivando la animación de driver.js.
 * - Persistencia y analítica conectadas vía las factories de persistence.ts / analytics.ts,
 *   ambas inyectadas por el consumidor (nunca defaults con conocimiento de dominio).
 */

import type { Driver, DriveStep } from 'driver.js';
import { isSupportedRoot, resolveAnchor, waitForAnchor, type TourRoot } from './anchors';
import { toDriverPopover, type TourStep } from './steps';
import { createLocalStoragePersistence, type TourPersistence } from './persistence';
import { createAnalyticsEmitter, type TourAnalyticsCallback } from './analytics';

export interface CreateTourOptions {
  /** Identificador único del tour (usado como clave de persistencia y en eventos). */
  tourId: string;
  /** Versión del tour: incrementarla vuelve a ofrecer el tour a quien ya lo vio (§F4). */
  version: number;
  /** Pasos, ya en el orden en que deben mostrarse. Los que fallen `when()` se descartan. */
  steps: TourStep[];
  /**
   * Raíz del DOM contra la que se resuelven las anclas. Cuando es un `ShadowRoot`, el tour se
   * declara no soportado: `start()` es un no-op y `isSupported` es `false` (§1.4.1).
   */
  root?: TourRoot;
  /**
   * Prefijo de `localStorage` para la persistencia por defecto. Obligatorio si no se pasa
   * `persistence` directamente — este paquete nunca asume un prefijo (§0.4).
   */
  storagePrefix?: string;
  /** Implementación de persistencia alternativa (tests, o un backend distinto a localStorage). */
  persistence?: TourPersistence;
  /** Callback de analítica, agnóstico de proveedor (§0.2). */
  onEvent?: TourAnalyticsCallback;
  /** Textos de botones/progreso, ya traducidos por el consumidor (i18n vive en cada editor). */
  labels?: {
    nextBtnText?: string;
    prevBtnText?: string;
    doneBtnText?: string;
    progressText?: string;
  };
  /** Clase CSS aplicada al popover para el tema (`.md-tour` por convención, ver theme.css). */
  popoverClass?: string;
  /**
   * Fuerza el comportamiento de animación, ignorando `prefers-reduced-motion`. Solo para tests;
   * en producción se detecta automáticamente.
   */
  forceAnimate?: boolean;
}

export interface Tour {
  /** `false` si `root` es un `ShadowRoot` — el tour no puede resaltar nada de forma fiable. */
  isSupported: boolean;
  /** Arranca el tour desde el primer paso elegible. No-op si `isSupported` es `false`. */
  start(): Promise<void>;
  /** Destruye el tour activo, si lo hay, sin marcarlo como completado. */
  stop(): void;
  /** `true` mientras el overlay de driver.js está activo. */
  isActive(): boolean;
}

export function createTour(options: CreateTourOptions): Tour {
  const root: TourRoot = options.root ?? (typeof document !== 'undefined' ? document : (undefined as never));
  const isSupported = root !== undefined && isSupportedRoot(root);

  const persistence =
    options.persistence ??
    createLocalStoragePersistence(requireStoragePrefix(options.storagePrefix));
  const emit = createAnalyticsEmitter(options.onEvent);

  let driverInstance: Driver | null = null;
  let escapeGuardAttached = false;

  const handleEscapeCapture = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && driverInstance?.isActive()) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  function attachEscapeGuard() {
    if (escapeGuardAttached || typeof window === 'undefined') return;
    window.addEventListener('keydown', handleEscapeCapture, { capture: true });
    escapeGuardAttached = true;
  }

  function detachEscapeGuard() {
    if (!escapeGuardAttached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', handleEscapeCapture, { capture: true });
    escapeGuardAttached = false;
  }

  function prefersReducedMotion(): boolean {
    if (options.forceAnimate !== undefined) return !options.forceAnimate;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async function start(): Promise<void> {
    if (!isSupported) return;

    const eligibleSteps = options.steps.filter((step) => step.when?.() ?? true);
    if (eligibleSteps.length === 0) return;

    const { driver } = await import('driver.js');

    const driveSteps: DriveStep[] = [];
    for (const step of eligibleSteps) {
      const driveStep = await buildDriveStep(root, step);
      if (driveStep) driveSteps.push(driveStep);
    }
    if (driveSteps.length === 0) return;

    driverInstance = driver({
      animate: !prefersReducedMotion(),
      allowKeyboardControl: true,
      overlayClickBehavior: 'close',
      popoverClass: options.popoverClass ?? 'md-tour',
      showProgress: true,
      progressText: options.labels?.progressText,
      nextBtnText: options.labels?.nextBtnText,
      prevBtnText: options.labels?.prevBtnText,
      doneBtnText: options.labels?.doneBtnText,
      steps: driveSteps,
      onHighlighted: (_el, driveStep) => {
        const index = driveSteps.indexOf(driveStep);
        emit({
          event: 'tour_step_viewed',
          tourId: options.tourId,
          stepIndex: index,
          totalSteps: driveSteps.length,
        });
      },
      onDestroyStarted: () => {
        const wasLastStep = driverInstance?.isLastStep() ?? false;
        if (!wasLastStep) {
          const index = driverInstance?.getActiveIndex();
          emit({
            event: 'tour_dismissed',
            tourId: options.tourId,
            stepIndex: index,
            totalSteps: driveSteps.length,
          });
        }
        // No llamar a driverInstance.destroy() aquí: este hook ya se dispara *dentro* del
        // propio ciclo de destrucción de driver.js (incluido cuando lo invocamos nosotros
        // desde `stop()`); volver a llamar a `destroy()` reentra en ese ciclo.
      },
      onDoneClick: () => {
        persistence.markCompleted(options.tourId, options.version);
        emit({ event: 'tour_completed', tourId: options.tourId, totalSteps: driveSteps.length });
      },
      onDestroyed: () => {
        // El tour puede cerrarse desde dentro de driver.js mismo (click fuera del popover con
        // `overlayClickBehavior: 'close'`, botón de cerrar, o Escape si allowClose lo permite),
        // sin pasar por nuestro `stop()`. Sincronizamos el estado del wrapper para que
        // `isActive()` y el guard de Escape queden consistentes sin depender de esa llamada.
        driverInstance = null;
        detachEscapeGuard();
      },
    });

    attachEscapeGuard();
    persistence.markSeen(options.tourId, options.version);
    emit({ event: 'tour_started', tourId: options.tourId, totalSteps: driveSteps.length });
    driverInstance.drive();
  }

  function stop(): void {
    driverInstance?.destroy();
    driverInstance = null;
    detachEscapeGuard();
  }

  function isActive(): boolean {
    return driverInstance?.isActive() ?? false;
  }

  return { isSupported, start, stop, isActive };
}

async function buildDriveStep(root: TourRoot, step: TourStep): Promise<DriveStep | null> {
  if (step.before) await step.before();

  const skip = step.skipMissingElement ?? true;
  const element = skip
    ? await waitForAnchor(root, step.anchorKey, { timeoutMs: step.waitForElementMs ?? 2000 })
    : resolveAnchor(root, step.anchorKey);

  if (!element) {
    if (skip) return null;
    // No se pidió omitir: se deja que driver.js falle explícitamente en vez de ocultar el
    // problema (el consumidor optó a propósito por no tener red de seguridad en este paso).
  }

  return {
    element: element ?? step.anchorKey,
    popover: toDriverPopover(step.popover),
    skipMissingElement: skip,
    waitForElement: step.waitForElementMs ?? 2000,
    onDeselected: step.after
      ? () => {
          void step.after?.();
        }
      : undefined,
  };
}

function requireStoragePrefix(prefix: string | undefined): string {
  if (!prefix) {
    throw new Error(
      '[@md/product-tour] createTour requires either `storagePrefix` or a custom `persistence` ' +
        '— this package never assumes a default namespace (see docs/product-tour-driverjs-plan.md §0.4).',
    );
  }
  return prefix;
}
