import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for the guided-tour e2e coverage (F6,
 * docs/product-tour-driverjs-plan.md §4).
 *
 * The tour engine (`@md/product-tour`, `packages/product-tour/src/createTour.ts`)
 * decides "seen" strictly from persisted storage read at `start()` time, and the
 * two host controllers (`useEmailBuilderTour`, `useBuilder42Tour`) auto-start
 * synchronously on mount, before Playwright's own load-state waiting would ever
 * get a chance to clear storage after navigation. So every test that cares about
 * a deterministic first-run must clear the relevant keys via
 * `page.addInitScript` — injected before any page script runs, per navigation.
 */

/** `eb:` prefix — `createLocalStoragePersistence('eb:')`, tour id `email-builder`. */
const EMAIL_TOUR_STORAGE_KEY = 'eb:email-builder';

/**
 * Clears the email editor's persisted tour state so the next navigation looks
 * like a true first run. Must be called before `page.goto`/`gotoApp` — an
 * `addInitScript` runs on every subsequent navigation in this test, which is
 * exactly what's needed for the "reload after completing" persistence check
 * too (call again right before a scripted `localStorage.setItem` to flip it
 * back if a test needs "already seen" instead).
 */
export async function resetEmailTourState(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, EMAIL_TOUR_STORAGE_KEY);
}

/** Marks the email tour as already seen/completed, before any navigation. */
export async function markEmailTourSeen(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ seen: true, completed: true, version: 1 }),
    );
  }, EMAIL_TOUR_STORAGE_KEY);
}

/**
 * Clears Builder42's tour state and forces `pb:experienceLevelChosen` to `true` so the
 * tour is eligible to auto-start without `OnboardingExperienceModal` competing for the
 * same first paint (§4 F4 acceptance: "must never overlap").
 *
 * Borra `pb:tours` (la fuente de verdad, ver `markLandingTourSeen`) y, por higiene, las
 * cuatro claves planas legacy que algún navegador desplegado todavía puede llevar
 * escritas (`useLocalConfig.ts`, D-F29.18) — no las lee nadie, pero dejarlas puestas
 * mientras el test dice "primer uso" es engañoso.
 */
export async function resetLandingTourState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('pb:tours');
    window.localStorage.removeItem('pb:tourSeen');
    window.localStorage.removeItem('pb:tourVersion');
    window.localStorage.removeItem('pb:tourCompleted');
    window.localStorage.removeItem('pb:tourLastStepIndex');
    window.localStorage.setItem('pb:experienceLevelChosen', JSON.stringify(true));
  });
}

/**
 * Los cuatro tours de Builder42, en el MISMO orden que `BUILDER42_TOUR_ORDER`
 * (`packages/builder42/src/app/tour/tourSteps.ts`, cadena F29 T2a) — que es el orden en
 * el que `TourChooserModal` pinta sus botones. El índice es lo que usa
 * `startLandingTour()` para elegir, en vez del texto del botón, que es i18n.
 */
export const LANDING_TOUR_ORDER = ['overview', 'library', 'canvas', 'rightPanel'] as const;

export type LandingTourName = (typeof LANDING_TOUR_ORDER)[number];

/** `TOUR_VERSION` en `useBuilder42Tour.ts`. Un valor distinto se lee como "no visto". */
const LANDING_TOUR_VERSION = 1;

/**
 * Marca los cuatro tours como ya vistos Y COMPLETADOS, antes de cualquier navegación, de
 * modo que nada auto-arranque en la ruta del editor.
 *
 * TRAMPA 1 — la clave. Hasta la cadena F29 esto se escribía en las claves planas
 * `pb:tourSeen`/`pb:tourVersion`. Desde T1 (D-F29.17/.18) esas claves son LEGACY: siguen
 * declaradas en `ConfigMap` porque hay navegadores con ellas escritas, pero
 * `useBuilder42Tour.ts` ya no las lee ni las escribe — persiste en el record `tours`
 * (`pb:tours` en `localStorage`), una entrada por `tourId`. Escribir las viejas no suprime
 * nada y el tour arranca igual.
 *
 * TRAMPA 2 — `completed`, no solo `seen`. `shouldAutoStartTour()` suprime con
 * `!(persistedSeen && persistedCompleted)`: un tour visto pero NO completado (cerrado a
 * medias con Escape, click fuera, × o cierre de pestaña) **debe** volver a auto-arrancar en
 * el siguiente mount, porque `start()` reanuda desde `lastStepIndex`. Así que "ya visto" en
 * el sentido de este helper es "el visitante lo terminó con Listo" → `completed: true`.
 * `lastStepIndex` se omite, igual que hace `markCompleted()` del bridge: un tour terminado
 * no tiene progreso a medias que reanudar.
 *
 * TRAMPA 3 — por qué los CUATRO y no solo `builder42.overview` (el único que auto-arranca).
 * `zoneTourTriggers.ts` arma los tours de zona justo cuando el overview está `completed` y
 * el de esa zona no lo está (D-F29.11). Marcando los cuatro, ningún disparador de zona
 * puede colarse en mitad de una aserción.
 */
export async function markLandingTourSeen(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version, ids }) => {
      const tours: Record<string, { seen: boolean; completed: boolean; version: number }> = {};
      for (const id of ids) {
        tours[id] = { seen: true, completed: true, version };
      }
      window.localStorage.setItem('pb:tours', JSON.stringify(tours));
      window.localStorage.setItem('pb:experienceLevelChosen', JSON.stringify(true));
    },
    {
      version: LANDING_TOUR_VERSION,
      ids: LANDING_TOUR_ORDER.map((name) => `builder42.${name}`),
    },
  );
}

/** El selector de tours (`TourChooserModal`), con sus cuatro opciones. */
export function landingTourChooserOptions(page: Page): Locator {
  return page.locator('.pbx-onboarding-modal__options .pbx-onboarding-modal__option');
}

/**
 * Abre el control "tour otra vez" de la toolbar del host y elige `tour` en el selector.
 *
 * Desde D-F29.27 ese botón ya NO relanza el overview directamente: abre
 * `TourChooserModal` para que el visitante elija entre los cuatro tours. Es la única vía
 * de arrancar un tour concreto desde un e2e — `startBuilder42Tour(tourId)` es un bridge
 * de ámbito de módulo, no está expuesto en `window`.
 *
 * La opción se elige por ÍNDICE (`LANDING_TOUR_ORDER`), no por el texto del botón: la
 * copy sale de `tour.json` vía i18next y esta ruta ha renderizado en más de un idioma
 * (B33), así que fijar el texto volvería el test frágil sin ganar nada.
 */
export async function startLandingTour(page: Page, tour: LandingTourName): Promise<void> {
  await page.getByRole('button', { name: 'View the guided tour' }).click();

  const options = landingTourChooserOptions(page);
  await expect(options, 'the tour chooser lists the four tours').toHaveCount(
    LANDING_TOUR_ORDER.length,
    { timeout: 10_000 },
  );

  await options.nth(LANDING_TOUR_ORDER.indexOf(tour)).click();
  await expect(tourPopover(page), `the "${tour}" tour started`).toHaveCount(1, {
    timeout: 10_000,
  });
}

/** The driver.js popover currently on screen, themed via `popoverClass: 'md-tour'`. */
export function tourPopover(page: Page): Locator {
  return page.locator('.driver-popover.md-tour');
}

/** The single element driver.js is currently highlighting (`.driver-active-element`). */
export function tourHighlightedElement(page: Page): Locator {
  return page.locator('.driver-active-element');
}

/** driver.js's "Next"/"Done" footer button inside the popover. */
export function tourNextButton(page: Page): Locator {
  return tourPopover(page).locator('.driver-popover-next-btn');
}

/**
 * Asserts the currently-visible tour popover's `getBoundingClientRect()` sits
 * entirely within the viewport (D36): driver.js positioned `.driver-popover`
 * before its own stylesheet was applied, so it measured an unstyled full-width
 * popover and wrote bogus inline offsets that parked the real, styled popover
 * off-screen — e.g. `[1280, 1242, 250, 164]` in a 1280x720 viewport. Every
 * existing content/visibility assertion (`toHaveCount(1)`, `toHaveClass`,
 * `toBeVisible()`, computed colours) stayed green through that, because
 * Playwright's `toBeVisible()` only checks that an element has a non-empty
 * bounding box and is not hidden by CSS — it does NOT fail for an element
 * whose box lies entirely outside the viewport. This helper is the one check
 * that actually looks at where the box is.
 */
export async function expectTourPopoverInsideViewport(page: Page, message?: string): Promise<void> {
  const measured = await page.evaluate(() => {
    const popover = document.querySelector('.driver-popover.md-tour');
    if (!popover) {
      return null;
    }
    const rect = popover.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(measured, message ?? 'tour popover is present to measure').not.toBeNull();
  const rect = measured!;
  const insideViewport =
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= rect.viewportWidth &&
    rect.bottom <= rect.viewportHeight;

  // Assert on the measured object itself (not just the boolean) so a future
  // regression's report includes the actual numbers — the rect and the
  // viewport size — instead of just "false is not true".
  expect(
    insideViewport,
    `${message ?? 'tour popover must render inside the viewport'} — measured ${JSON.stringify(rect)}`,
  ).toBe(true);
}
