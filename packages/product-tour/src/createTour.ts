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
 *   en fase de captura, se detiene su propagación/default (para no cerrar el editor anfitrión,
 *   §1.4.3 del plan) y ESTE MISMO handler cierra el tour (D8) llamando a `driverInstance.destroy()`
 *   — nunca se depende del propio handler de Escape de driver.js (bubble-phase, inalcanzable
 *   tras el `stopPropagation()` de arriba). El cierre emite `tour_dismissed` él mismo antes de
 *   destruir, porque `destroy()` público de driver.js salta su hook `onDestroyStarted` (solo se
 *   dispara en cierres iniciados por driver.js mismo: su botón de cerrar, `overlayClickBehavior`)
 *   — ver `dismissActiveInstance()`.
 * - Keyboard step navigation (D18): the SAME capture-phase `window` keydown handler that owns
 *   Escape also owns `ArrowRight`/`ArrowLeft` — one listener per key, this package the only
 *   owner. `ArrowRight` calls `driverInstance.moveNext()`, `ArrowLeft` calls
 *   `driverInstance.movePrevious()`, gated exactly like Escape (`isActive()`, then
 *   `hasCompetingModalOpen()` yields to a visible competing modal without consuming the key,
 *   D11/D12). D21: arrows move between EXISTING steps only — `ArrowRight` on the last step and
 *   `ArrowLeft` on the first step are no-ops (checked via `isLastStep()`/`getActiveIndex()`
 *   before calling `moveNext()`/`movePrevious()`), because `moveNext()` on the last step would
 *   route into driver.js's own advance handler — replaced by `onDoneClick`, which persists
 *   completion and emits `tour_completed` — and a keypress must never silently finish and
 *   persist the tour; completing stays the Done button's job. D22: the engine does not steal
 *   arrows from text entry — any modifier key held, or a `target` that is an editable surface
 *   (`<input>`, `<textarea>`, `<select>`, or `isContentEditable`), and the handler returns
 *   without consuming, host-agnostically (D1).
 * - Escape le pertenece a la superficie más alta, no incondicionalmente al tour (D11): antes de
 *   consumir el Escape, el guard comprueba si hay un MODAL VISIBLE abierto por encima de la
 *   página (ver `hasCompetingModalOpen()` / `isElementVisible()`, D12) — un elemento que matchee
 *   `[aria-modal="true"], dialog[open], [role="dialog"]`, que esté realmente pintado en pantalla
 *   (no solo presente en el DOM: `hidden`, `display:none`, `visibility:hidden` o tamaño cero no
 *   cuentan) y que no sea el propio popover de driver.js (`.driver-popover`, que también lleva
 *   `role="dialog"`) ni esté contenido en él. Si existe ese modal visible, el guard NO llama a
 *   `stopPropagation()`/`preventDefault()` ni cierra el tour: deja que el Escape se propague, así
 *   el propio handler del modal lo cierra, y el tour queda intacto en su paso actual. Si no hay
 *   modal competidor visible, el comportamiento es exactamente el de siempre (caso llano, D8, sin
 *   cambios). La detección es genérica y agnóstica de host (D1: este paquete no sabe nada de
 *   Maildrill, MUI ni de ningún editor en particular) y barata (un `querySelectorAll` acotado a
 *   esos tres selectores, solo cuando la tecla es Escape — no en cada keydown).
 * - Invariante "a lo sumo un tour activo por `tourId`" (D7): un registro a nivel de módulo,
 *   por `tourId`, garantiza que un segundo `start()` — incluso si llega mientras el primero
 *   sigue esperando su `import('driver.js')` diferido — nunca deja dos instancias de driver.js
 *   vivas a la vez. Semántica: LAST START WINS — relanzar destruye la instancia anterior antes
 *   de arrancar la nueva, así un restart explícito siempre muestra pasos frescos.
 * - Respeta `prefers-reduced-motion` desactivando la animación de driver.js.
 * - Persistencia y analítica conectadas vía las factories de persistence.ts / analytics.ts,
 *   ambas inyectadas por el consumidor (nunca defaults con conocimiento de dominio).
 */

import type { Driver, DriveStep } from 'driver.js';
import { isSupportedRoot, resolveAnchor, waitForAnchor, type TourRoot } from './anchors';
import { toDriverPopover, type TourStep } from './steps';
import { createLocalStoragePersistence, type TourPersistence } from './persistence';
import { createAnalyticsEmitter, type TourAnalyticsCallback } from './analytics';

/**
 * Registro proceso-global de "qué generación de `start()` es la vigente para este `tourId`"
 * (D7). No guarda la instancia de driver.js en sí (eso sigue viviendo en el closure de cada
 * `createTour()`) — solo un número de generación y un `destroy` para poder tumbar la instancia
 * previa de forma sincrónica antes de que la nueva empiece a construirse.
 *
 * Por qué un registro y no solo un flag "hay un start en curso": `start()` es async (espera el
 * import diferido de driver.js + la resolución de anclas), así que un segundo `start()` para el
 * mismo `tourId` puede llegar mientras el primero todavía no ha creado su `Driver`. Sin este
 * registro, `stop()` del primero (si el consumidor lo llamara) o el propio criterio "el segundo
 * gana" no tendrían con qué invalidar al primero antes de que materialice su `driverInstance`.
 */
interface TourRegistryEntry {
  generation: number;
  destroy: () => void;
}

const activeTourRegistry = new Map<string, TourRegistryEntry>();

/**
 * Reclama la próxima generación para `tourId`: destruye sincrónicamente cualquier instancia
 * previa registrada (LAST START WINS, D7) y registra la nueva generación con un `destroy`
 * no-op hasta que la instancia real de driver.js exista. Devuelve el número de generación que
 * el llamador debe usar para validar, tras cualquier `await`, si sigue siendo la vigente.
 */
function claimTourGeneration(tourId: string): number {
  const previous = activeTourRegistry.get(tourId);
  previous?.destroy();
  const generation = (previous?.generation ?? 0) + 1;
  activeTourRegistry.set(tourId, { generation, destroy: () => {} });
  return generation;
}

/** `true` si `generation` sigue siendo la generación vigente registrada para `tourId`. */
function isCurrentGeneration(tourId: string, generation: number): boolean {
  return activeTourRegistry.get(tourId)?.generation === generation;
}

/** Actualiza el `destroy` real de la generación vigente, una vez la instancia de driver.js existe. */
function registerGenerationDestroy(tourId: string, generation: number, destroy: () => void): void {
  if (isCurrentGeneration(tourId, generation)) {
    activeTourRegistry.set(tourId, { generation, destroy });
  }
}

/** Libera el registro de `tourId` si `generation` sigue siendo la vigente (tras un `destroy` real). */
function releaseTourGeneration(tourId: string, generation: number): void {
  if (isCurrentGeneration(tourId, generation)) {
    activeTourRegistry.delete(tourId);
  }
}

/**
 * Selector genérico y agnóstico de host (D1, D11) para cualquier superficie modal que pueda
 * estar abierta por encima de la página: `aria-modal="true"`, un `<dialog open>`, o cualquier
 * elemento con `role="dialog"`. Deliberadamente amplio — este paquete no conoce Maildrill, MUI
 * ni ningún editor en particular, así que no hay lista de clases ni de componentes permitidos.
 */
const COMPETING_MODAL_SELECTOR = '[aria-modal="true"], dialog[open], [role="dialog"]';

/**
 * `true` si `candidate` está realmente pintado en pantalla, no solo presente en el DOM (D12).
 * Muchos UI kits dejan un diálogo cerrado montado y solo oculto (`display:none`,
 * `visibility:hidden`, el atributo `hidden`, o tamaño cero) — sin esta comprobación, ese nodo
 * seguiría matcheando `COMPETING_MODAL_SELECTOR` y el guard de Escape cedería SIEMPRE, dejando
 * el tour sin forma de cerrarse por teclado (una regresión silenciosa de D8/D11).
 *
 * El atributo `hidden` se comprueba siempre de forma explícita, incluso cuando la plataforma
 * ofrece `checkVisibility`: por spec ese atributo solo oculta el elemento a través de la regla
 * `[hidden] { display: none }` de la hoja de estilos UA por defecto, y no todo runtime aplica
 * esa hoja de estilos (verificado leyendo el propio `Element.checkVisibility` de happy-dom —
 * el motor de tests de este paquete — que nunca inspecciona `hidden` ni añade esa regla), así
 * que confiar solo en `checkVisibility` para este caso sería no-determinista según el runtime.
 *
 * Para el resto (`display:none`, `visibility:hidden`, tamaño cero), usa la comprobación de
 * plataforma cuando existe: `Element.checkVisibility({ checkVisibilityCSS: true, checkOpacity:
 * false })` — no se asume disponible en todo runtime (no está en todos los builds de
 * jsdom/happy-dom que puedan usar los tests de este paquete), así que se detecta por feature
 * antes de usarla.
 *
 * Sin `checkVisibility`, el fallback comprueba explícitamente `display`/`visibility` (inline y
 * computado) y el rect del cliente — y falla siempre hacia el caso llano: si la visibilidad no
 * puede determinarse, se trata el candidato como NO competidor, porque "Escape no hace nada" es
 * peor para quien usa el teclado que "Escape cerró el tour" (D12). Deliberadamente barato: nada
 * de layout adicional más allá de lo que `getBoundingClientRect()` ya da gratis.
 */
function isElementVisible(candidate: Element): boolean {
  if ((candidate as HTMLElement).hidden) return false;

  const checkVisibility = (candidate as { checkVisibility?: (options?: Record<string, boolean>) => boolean })
    .checkVisibility;
  if (typeof checkVisibility === 'function') {
    return checkVisibility.call(candidate, { checkVisibilityCSS: true, checkOpacity: false });
  }

  const htmlElement = candidate as HTMLElement;
  const inlineDisplay = htmlElement.style?.display;
  const inlineVisibility = htmlElement.style?.visibility;
  if (inlineDisplay === 'none' || inlineVisibility === 'hidden') return false;

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const computed = window.getComputedStyle(htmlElement);
    if (computed.display === 'none' || computed.visibility === 'hidden') return false;
  }

  if (typeof candidate.getBoundingClientRect === 'function') {
    const rect = candidate.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  }

  return true;
}

/**
 * `true` si hay, en este momento, un elemento modal VISIBLE (ver `COMPETING_MODAL_SELECTOR` e
 * `isElementVisible`, D12) abierto por encima de la página que NO sea el propio popover de
 * driver.js. driver.js pinta su popover con `role="dialog"` (verificado leyendo
 * `driver.js@1.8.0`'s `dist/driver.js.mjs`: `m.setAttribute('role','dialog')` sobre el nodo
 * `.driver-popover`), así que ese nodo — y cualquier cosa contenida en él — queda
 * explícitamente excluido: de lo contrario el propio tour se detectaría a sí mismo como
 * "modal competidor" y el caso llano (D8) se rompería.
 *
 * Barata a propósito (D11: "this runs on every Escape keydown, not on every key"; D18 extiende
 * lo mismo a ArrowLeft/ArrowRight): un solo `querySelectorAll` acotado a los tres selectores de
 * arriba, invocado solo cuando la tecla es Escape o una flecha (ver `handleEscapeCapture`),
 * nunca en cada `keydown`.
 */
function hasCompetingModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  const candidates = document.querySelectorAll(COMPETING_MODAL_SELECTOR);
  for (const candidate of candidates) {
    if (candidate.closest('.driver-popover')) continue;
    if (!isElementVisible(candidate)) continue;
    return true;
  }
  return false;
}

/**
 * `true` if `target` is an editable surface where ArrowLeft/ArrowRight mean caret or option
 * movement rather than tour step navigation (D22): an `<input>`, `<textarea>`, `<select>`, or
 * any element with `isContentEditable` (rich-text editors). Deliberately generic and
 * host-agnostic (D1) — no class names, no component names, just the shapes the DOM itself
 * already exposes for "this element consumes arrow keys for editing".
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  return (target as HTMLElement).isContentEditable === true;
}

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
  /** Generación de `start()` que posee la instancia `driverInstance` actual (o está en curso de crearla). */
  let ownGeneration = 0;
  /** Total de pasos elegibles de la corrida activa — usado por `dismissActiveInstance()` para dar forma al `tour_dismissed` que emite en nombre de driver.js. */
  let currentTotalSteps = 0;

  const handleEscapeCapture = (e: KeyboardEvent) => {
    if (!driverInstance?.isActive()) return;

    if (e.key === 'Escape') {
      // D11: Escape le pertenece a la superficie más alta, no incondicionalmente al tour. Si hay
      // un modal abierto por encima de la página (y no es el propio popover de driver.js), este
      // guard NO consume la tecla: no llama a stopPropagation()/preventDefault() ni cierra el
      // tour — deja que el evento se propague para que el propio handler del modal lo cierre. El
      // tour permanece activo, en su paso actual. Esto solo es seguro porque `allowKeyboardControl`
      // se configura en `false` (ver `start()`): sin eso, este mismo evento —dejado propagar a
      // propósito para que el modal lo vea— también llegaría al handler interno de Escape de
      // driver.js (bubble-phase en `window`) y, ahora que `onDestroyStarted` sí destruye (D15),
      // cerraría el tour de todos modos, rompiendo este caso (D11 se rompió exactamente así al
      // arreglar D15, hasta desactivar `allowKeyboardControl`; ver el comentario en `start()`).
      if (hasCompetingModalOpen()) return;
      // D8: mientras el tour está activo, Escape cierra EL TOUR y nada más. Se detiene la
      // propagación/default en fase de captura para que el editor anfitrión nunca vea esta
      // tecla (los tests F4 del host dependen de eso), y el cierre se hace aquí mismo — nunca
      // se depende del propio handler de Escape de driver.js: con `allowKeyboardControl: false`
      // (D15) ese handler interno ni siquiera se registra, así que este paquete es la ÚNICA
      // vía de cierre por teclado, sin importar si esta rama llega a `stopPropagation()` o no.
      e.stopPropagation();
      e.preventDefault();
      dismissActiveInstance();
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      // D18: this same capture-phase handler also owns arrow-key step navigation — one
      // listener per key, this package the only owner (see the top-of-file doc block and the
      // `allowKeyboardControl: false` comment in `start()` for why driver.js's own internal
      // keyboard handling stays disabled instead of growing a second listener here).
      //
      // D22: the engine does not steal arrows from text entry. Any modifier held, or a
      // `target` that is an editable surface, means the key means caret/option movement to
      // whoever is focused, not step navigation — bail out without consuming, host-agnostically
      // (D1: no class names, no component names, just the generic editable-surface shapes).
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isEditableTarget(e.target)) return;
      // D11/D12: same gating as Escape — a visible competing modal on top of the page owns
      // the keyboard, so the tour must not consume the arrow either.
      if (hasCompetingModalOpen()) return;

      if (e.key === 'ArrowRight') {
        // D21: ArrowRight moves between EXISTING steps only. On the last step, `moveNext()`
        // would route into driver.js's own advance handler — replaced by `onDoneClick`, which
        // persists completion and emits `tour_completed` (see `start()`) — so a keypress must
        // not silently finish and persist the tour. Checked BEFORE stopping propagation/default:
        // a no-op arrow on the last step must not behave as if the tour had consumed the key.
        if (driverInstance.isLastStep()) return;
        e.stopPropagation();
        e.preventDefault();
        driverInstance.moveNext();
      } else {
        // D21: symmetric no-op at the other boundary — ArrowLeft on the first step must not
        // call `movePrevious()` (there is nowhere to go, and driver.js has no "before the
        // first step" state to route into, but the no-op must still not consume the key).
        if (driverInstance.getActiveIndex() === 0) return;
        e.stopPropagation();
        e.preventDefault();
        driverInstance.movePrevious();
      }
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

  /**
   * Destruye la instancia de driver.js activa de este `Tour`, si la hay, a través del propio
   * ciclo de destrucción de driver.js (`driverInstance.destroy()`) — nunca a mano (nunca
   * removiendo nodos del DOM nosotros mismos). Usado tanto por `stop()` como por la
   * reclamación de una nueva generación en `start()` (D7, LAST START WINS).
   *
   * IMPORTANTE (verificado leyendo el propio `driver.js@1.8.0`): el método público
   * `destroy()` invoca internamente su ciclo de destrucción con la bandera que SALTA el
   * hook `onDestroyStarted` (esa etapa solo se dispara en los cierres iniciados por driver.js
   * mismo: su botón de cerrar del popover, `overlayClickBehavior: 'close'`, o su propio
   * handler interno de Escape). Por eso `destroy()`, a secas, JAMÁS emite `tour_dismissed` —
   * ver `dismissActiveInstance()` para el cierre iniciado por ESTE paquete (Escape), que sí
   * debe emitir el evento (D8).
   */
  function destroyActiveInstance(): void {
    driverInstance?.destroy();
    driverInstance = null;
    detachEscapeGuard();
  }

  /**
   * Cierre del tour iniciado por ESTE paquete (hoy: solo el guard de Escape, D8) — a
   * diferencia de `destroy()` a secas, este SÍ emite `tour_dismissed`, exactamente el evento
   * que `onDestroyStarted` habría emitido si el cierre hubiera venido de dentro de driver.js
   * (mismo shape: `stepIndex`/`totalSteps` del paso activo en el momento del cierre). Sin
   * esto, un Escape gestionado por nuestro propio guard —en vez del handler interno de
   * driver.js, que D8 prohíbe usar— dejaría de reportar el dismiss.
   *
   * El cierre en sí sigue yendo por `destroy()` (nunca se desmonta el DOM a mano): D8 exige
   * "dismiss by destroying the instance, not by bypassing driver.js".
   */
  function dismissActiveInstance(): void {
    if (!driverInstance) return;
    const wasLastStep = driverInstance.isLastStep();
    if (!wasLastStep) {
      const index = driverInstance.getActiveIndex();
      emit({
        event: 'tour_dismissed',
        tourId: options.tourId,
        stepIndex: index,
        totalSteps: currentTotalSteps,
      });
    }
    destroyActiveInstance();
  }

  async function start(): Promise<void> {
    if (!isSupported) return;

    const eligibleSteps = options.steps.filter((step) => step.when?.() ?? true);
    if (eligibleSteps.length === 0) return;

    // D7: reclama la próxima generación para este `tourId` ANTES de cualquier `await` —
    // esto destruye sincrónicamente cualquier instancia previa (de este `Tour` o de cualquier
    // otro `createTour()` con el mismo `tourId`) sin esperar a que termine de construirse.
    // LAST START WINS: si mientras este `start()` sigue esperando el import diferido llega
    // otra llamada a `start()` para el mismo `tourId` (de este objeto o de otro), esa llamada
    // reclama una generación más nueva y esta invocación se abortará al notar, tras el
    // `await`, que ya no es la vigente (ver los dos checks de `isCurrentGeneration` abajo).
    const generation = claimTourGeneration(options.tourId);
    ownGeneration = generation;

    const { driver } = await import('driver.js');

    // Una generación más nueva pudo haber reclamado el registro mientras esperábamos el
    // import — abortar sin construir nada ni tocar el DOM.
    if (!isCurrentGeneration(options.tourId, generation)) return;

    const driveSteps: DriveStep[] = [];
    for (const step of eligibleSteps) {
      const driveStep = await buildDriveStep(root, step);
      if (driveStep) driveSteps.push(driveStep);
    }

    // Idem tras resolver `before()`/anclas: pudo haber llegado un `start()` más nuevo durante
    // esa espera también.
    if (!isCurrentGeneration(options.tourId, generation)) return;
    if (driveSteps.length === 0) return;

    currentTotalSteps = driveSteps.length;

    driverInstance = driver({
      animate: !prefersReducedMotion(),
      // D15/D11: `false`, no `true`. driver.js's OWN internal keydown listener (bubble-phase
      // on `window`, gated by this flag — verified reading `driver.js@1.8.0`'s source,
      // function `Q(e,t)`) reacts to Escape by calling the very same internal teardown that
      // `onDestroyStarted` now (correctly, per D15) destroys the instance from. While that
      // hook was a no-op (the pre-fix bug this task closes), driver.js's own Escape listener
      // being reachable was harmless — it fired but destroyed nothing. Now that the hook
      // really destroys, leaving this `true` reintroduced a second, competing path to close
      // the tour on Escape: the D11 case (`hasCompetingModalOpen()` true) deliberately lets
      // the keydown bubble PAST our own capture-phase guard, uninterrupted, so a modal
      // opened on top of the tour can close itself — but that same bubbling keydown also
      // reaches driver.js's bubble-phase `window` listener, which would then destroy the
      // tour anyway, breaking D11 (proven by execution: the existing "Escape yields to the
      // send-test dialog" test started failing — tour destroyed — the moment `onDestroyStarted`
      // was fixed to call `destroy()`, with `allowKeyboardControl` still `true`). This package
      // already owns 100% of Escape handling via its own capture-phase guard (D8); driver.js's
      // internal keyboard handling stays disabled entirely so there is never a second listener
      // for the same key — including for ArrowLeft/ArrowRight (D18): this package's capture-phase
      // guard now implements step navigation itself (`moveNext()`/`movePrevious()`, gated the
      // same way as Escape, plus the D21 last/first-step no-ops and the D22 editable-target
      // bail-out — see `handleEscapeCapture`), so re-enabling this flag would, exactly as with
      // Escape above, recreate a second, competing bubble-phase listener for the same keys.
      allowKeyboardControl: false,
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
        // D15: cuando el consumidor (nosotros) define `onDestroyStarted`, driver.js le
        // entrega la responsabilidad ENTERA de cerrar y no destruye nada por su cuenta —
        // verificado leyendo `driver.js@1.8.0`'s `dist/driver.js.mjs`, función `h(e=!0)`:
        // `if(e && a){ a(...); return }` corta el ciclo de destrucción ahí mismo cuando hay
        // un `onDestroyStarted` configurado (`a`) y el cierre vino con `e` en su valor por
        // defecto (`true`) — el caso de TODOS los cierres que driver.js inicia él mismo: su
        // botón de cerrar del popover (`.driver-popover-close-btn` → `onCloseClick` →
        // `closeClick` → esta misma `h()`), `overlayClickBehavior: 'close'` (`overlayClick`
        // → esta misma `h()`), y su propio handler interno de Escape (inalcanzable aquí por
        // el guard de captura de arriba, pero también pasaría por esta función). Sin un
        // `driverInstance.destroy()` explícito en este hook, ninguno de esos tres cierres
        // desmontaba el popover/overlay — el defecto reportado por el usuario en la «×».
        //
        // El comentario que vivía aquí antes afirmaba que llamar a `destroy()` desde dentro
        // de este hook reentraría el ciclo de destrucción. Es falso: el método PÚBLICO
        // `destroy()` es `()=>{h(!1)}` — siempre invoca `h` con `e=false`, así que la
        // condición `if(e && a)` de arriba nunca es cierta para una llamada a `destroy()`,
        // sea desde donde sea. `destroy()` no puede reentrar `onDestroyStarted`: esa etapa
        // solo se dispara con `e` en su valor por defecto (`true`), nunca desde el propio
        // `destroy()` público.
        //
        // Exactamente un `tour_dismissed` por cierre (D15): este hook es ahora el ÚNICO
        // lugar que emite el evento para los cierres que driver.js inicia (×, overlay); el
        // guard de Escape de este paquete (`dismissActiveInstance()`) sigue emitiéndolo él
        // mismo para SU cierre porque nunca llega a disparar este hook (`e.stopPropagation()`
        // en fase de captura evita que el handler interno de Escape de driver.js —y por
        // tanto este `onDestroyStarted`— vea la tecla). Un mismo cierre nunca pasa por los
        // dos caminos a la vez, así que nunca hay doble emisión.
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
        destroyActiveInstance();
      },
      onDoneClick: () => {
        persistence.markCompleted(options.tourId, options.version);
        emit({ event: 'tour_completed', tourId: options.tourId, totalSteps: driveSteps.length });
        // Close the tour on "Done". Pre-existing gap fixed under B7B8 (in scope: this exact
        // file — proven while wiring the e2e "full step walk finishes the tour" assertion,
        // DONE WHEN 1(b)): driver.js substitutes `onDoneClick` for its own "advance" handler
        // on the last step (verified reading driver.js@1.8.0's source, function `L()`), so
        // without an explicit `destroy()` here the popover/overlay never closed after
        // "Done" — the tour would sit on its last step forever. `destroyActiveInstance()` (not
        // `dismissActiveInstance()`): finishing via Done is a completion, not a dismissal, so
        // `tour_dismissed` must not also fire for the very same close.
        destroyActiveInstance();
      },
      onDestroyed: () => {
        // El tour puede cerrarse desde dentro de driver.js mismo (click fuera del popover con
        // `overlayClickBehavior: 'close'`, botón de cerrar) sin pasar por nuestro `stop()` ni
        // por nuestro guard de Escape (D8 ya intercepta Escape antes de que driver.js lo vea).
        // Sincronizamos el estado del wrapper para que `isActive()` y el guard queden
        // consistentes sin depender de esa llamada, y liberamos el registro de generación si
        // seguía siendo el nuestro.
        driverInstance = null;
        detachEscapeGuard();
        releaseTourGeneration(options.tourId, generation);
      },
    });

    // A partir de aquí la generación tiene un `destroy` real: si otro `start()` (de este u
    // otro `Tour` con el mismo `tourId`) reclama la siguiente generación, `claimTourGeneration`
    // llamará a este `destroy` sincrónicamente antes de construir la instancia nueva.
    registerGenerationDestroy(options.tourId, generation, destroyActiveInstance);

    attachEscapeGuard();
    persistence.markSeen(options.tourId, options.version);
    emit({ event: 'tour_started', tourId: options.tourId, totalSteps: driveSteps.length });
    driverInstance.drive();
  }

  function stop(): void {
    destroyActiveInstance();
    releaseTourGeneration(options.tourId, ownGeneration);
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
