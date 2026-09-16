/**
 * createTour.ts — factory sobre driver.js.
 *
 * Responsabilidades (§F1 del plan):
 * - Carga diferida de `driver.js` (`await import(...)`), invocada solo al arrancar el tour,
 *   nunca en el top-level del módulo — el bundle del consumidor no paga el costo si el tour
 *   nunca se abre.
 * - No-op silencioso cuando `root` es un `ShadowRoot` (§1.4.1 del plan / anchors.ts).
 * - Filtrado de pasos por `when()` — sigue pasando una sola vez en `start()`, antes de construir
 *   los `DriveStep` (sin cambios respecto a antes de D35).
 * - **D35 — activación por paso, no por arranque (supersede D23/D24 por completo).** El defecto
 *   reportado por el usuario: abrir el tour del editor de email disparaba de inmediato el
 *   command palette, el drawer de librería de componentes y el inspector — UI que solo un paso
 *   TARDÍO debía revelar — porque `start()` recorría TODOS los pasos elegibles y `await`eaba el
 *   `before()` de cada uno antes de pintar el primer popover. Bajo D35:
 *     1. `before()` de un paso corre en el momento en que el tour SE MUEVE a ese paso — para el
 *        primer paso, inmediatamente antes de `driverInstance.drive()`; para cualquier otro,
 *        dentro de `transitionTo()` (ver más abajo), justo antes de pedirle a driver.js que
 *        avance/retroceda. El significado documentado de `before()` en `steps.ts` ("antes de
 *        resaltar la ancla") no cambia: lo que cambia es CUÁNDO se resuelve esa ancla.
 *     2. Las anclas se resuelven de forma perezosa: cada `DriveStep.element` es una función
 *        (`() => resolveAnchor(root, step.anchorKey) ?? undefined`), no un valor ya resuelto —
 *        driver.js la invoca en el momento de intentar resaltar ese paso (verificado leyendo
 *        `driver.js@1.8.0`'s `dist/driver.js.mjs`, helper `f(e)`), nunca antes.
 *        `skipMissingElement` (`step.skipMissingElement ?? true`) era real y SINCRÓNICO en
 *        driver.js (`F(e,t)`: omite cuando la bandera está puesta y `f(t.element)` es falsy;
 *        `I(e,from,dir)` camina al siguiente índice no-omitible; cuando no queda ninguno, `L()`
 *        enruta a `onDoneClick`). **Corregido bajo D44** (ver ese bloque más abajo, y el bloque
 *        D43 corregido a continuación): este paquete ya NUNCA reenvía el `skipMissingElement`
 *        del consumidor a driver.js — cada `DriveStep` fija `skipMissingElement: false` sin
 *        condición, así que `F()` siempre devuelve `false` dentro de driver.js y ni `I()` ni
 *        `L()` pueden omitir ni enrutar nada por su cuenta. El campo público
 *        `TourStep.skipMissingElement` conserva su significado documentado, pero ahora lo
 *        consume el MOTOR (`transitionTo()`/`start()`, ver D45/D45b), nunca driver.js.
 *        `waitForElement` (`step.waitForElementMs ?? 2000`) se sigue DECLARANDO en `TourStep`
 *        con el mismo significado, pero — corregido bajo **D47** (ver ese bloque más abajo) —
 *        cada `DriveStep` le pasa a driver.js `waitForElement: 0` (su propio valor por
 *        defecto) en vez de `step.waitForElementMs`: driver.js@1.8.0 SÍ lee su `waitForElement`
 *        de verdad (verificado leyendo `dist/driver.js.mjs`, función de montaje de paso `m()`:
 *        cuando `waitForElement > 0` y la ancla no existe aún, instala un `MutationObserver` +
 *        `setTimeout` propios — función `p()` — antes de decidir si omite el paso), así que
 *        una afirmación previa de este bloque ("NUNCA lo lee", "la espera es ficción") era
 *        falsa. Bajo D47, ese mecanismo de driver.js queda inerte a propósito: el motor ya
 *        decidió, ANTES de pedirle a driver.js que se mueva, si la ancla existe o si el paso se
 *        omite — dejar `waitForElement` en un valor > 0 solo añadiría latencia después de que
 *        esa decisión ya se tomó. Construir los `driveSteps` a partir de `eligibleSteps` sigue
 *        siendo SINCRÓNICO justo después del `await import('driver.js')` — no hay ninguna
 *        resolución de anclas de TODOS los pasos en `start()`; D45/D45b esperan, como máximo,
 *        la ancla de UN paso candidato a la vez, dentro del propio recorrido del motor.
 *     3. **D45 (reemplaza la versión anterior de este punto)** — el motor es dueño de las
 *        transiciones a través de UN solo helper interno, `transitionTo(fromIndex, direction)`,
 *        usado por los tres puntos de entrada: el `onNextClick`/`onPrevClick` GLOBALES (pasados
 *        a `driver()`, que por eso le entrega a este paquete la transición ENTERA en vez de
 *        avanzar él mismo — verificado leyendo el internal `L()`: cuando hay un `onNextClick`
 *        configurado, se usa en vez del avance interno) y el propio handler de flechas de este
 *        paquete (capture-phase, más abajo). A diferencia de antes de D45, `transitionTo()` ya
 *        no recibe un índice destino fijo: RESUELVE el índice destino él mismo, caminando desde
 *        `fromIndex` en `direction`, porque — bajo D44 — driver.js ya nunca omite pasos por su
 *        cuenta, así que el motor tiene que ser quien decida cuál es el siguiente paso
 *        ACTIVABLE. Orden exacto: (a) corre el `after()` del paso SALIENTE (una sola vez, antes
 *        de evaluar cualquier candidato) y lo marca como ya manejado; (b) para cada candidato,
 *        en orden, en la dirección dada: corre su `before()` (`await`eado), luego
 *        `await waitForStepAnchor()` para su ancla; si resuelve, `driverInstance.moveTo(index)`
 *        y se detiene; si no resuelve y `skipMissingElement !== false`, el candidato se omite y
 *        continúa con el siguiente en la misma dirección; si no resuelve y
 *        `skipMissingElement === false`, `moveTo(index)` de todos modos (driver.js pinta un
 *        popover centrado sobre su `driver-dummy-element`) y se detiene. Si la dirección se
 *        agota sin ningún candidato tomado: hacia delante, el tour terminó de verdad — mismo
 *        camino terminal que `onDoneClick` (persistir con `persistence.markCompleted`, emitir
 *        `tour_completed`, destruir) sin además reportarlo como `tour_dismissed`; hacia atrás,
 *        no hace nada y se queda en el paso actual. Ese orden — `after()` del saliente antes que
 *        el `before()` de cualquier candidato — es lo que deja que una guardia que restaura
 *        estado compartido (p.ej. el guard del drawer de librería del editor de email, que
 *        cancela una restauración pendiente en cuanto se entra al siguiente paso de librería)
 *        siga funcionando.
 *     4. `after()` corre exactamente una vez por salida. Sigue conectado al `onDeselected` del
 *        `DriveStep` — eso es lo que cubre los cierres (×, click en el overlay, Escape,
 *        `stop()`, Done), porque `onDeselected` dispara tanto en una transición normal (interno
 *        `J()`) como en destroy (interno `h()`) — pero se suprime la duplicación cuando la
 *        transición ya la corrió desde `transitionTo()`: un único marcador "paso ya manejado"
 *        (el `DriveStep` saliente), puesto en (a) y consumido/limpiado por `onDeselected` la
 *        primera vez que lo ve. Los pasos que el motor OMITE durante el recorrido de (b) nunca
 *        se activaron, así que tampoco corren `after()`.
 *     5. **D44 vuelve obsoleta la reconciliación que vivía aquí** (una versión anterior de este
 *        bloque describía un paso 5 donde, tras `moveNext()`/`movePrevious()`, este paquete
 *        detectaba que driver.js había omitido pasos por su cuenta y corregía después del
 *        hecho). Bajo D44 cada `DriveStep` fija `skipMissingElement: false` sin condición, así
 *        que `F()` dentro de driver.js siempre devuelve `false` y ni `I()` ni el `m()` interno
 *        de driver.js pueden omitir un paso jamás — no hay nada que reconciliar DESPUÉS del
 *        `moveTo()`, porque el motor ya decidió el índice destino ANTES de llamarlo (punto 3).
 *   D35 vuelve obsoleta a D23/D24 en su totalidad: ya no existe resolución de anclas al arrancar,
 *   así que la superposición concurrente de esperas que D23/D24 describían ya no aplica — no hay
 *   nada que solapar porque no hay espera de ancla en `start()`.
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
 *   owner. Since D35, both arrow branches route through the shared `transitionTo()` helper
 *   instead of calling `driverInstance.moveNext()`/`movePrevious()` directly — `transitionTo()`
 *   itself still ends by calling one of those two driver.js methods, so the observable
 *   navigation is unchanged. `transitionTo()` is async (it awaits the incoming step's
 *   `before()`); the synchronous key handler calls it as `void transitionTo(...)` on purpose —
 *   making the handler itself `async` would delay `stopPropagation()`/`preventDefault()` past
 *   the point where they need to run. Gated exactly like Escape (`isActive()`, then
 *   `hasCompetingModalOpen()` yields to a visible competing modal without consuming the key,
 *   D11/D12). D21: arrows move between EXISTING steps only — `ArrowRight` on the last step and
 *   `ArrowLeft` on the first step are no-ops (checked via `isLastStep()`/`getActiveIndex()`
 *   before calling `transitionTo()`), because advancing past the last step would route into
 *   driver.js's own advance handler — replaced by `onDoneClick`, which persists completion and
 *   emits `tour_completed` — and a keypress must never silently finish and persist the tour;
 *   completing stays the Done button's job. D22: the engine does not steal arrows from text
 *   entry — any modifier key held, or a `target` that is an editable surface (`<input>`,
 *   `<textarea>`, `<select>`, or `isContentEditable`), and the handler returns without consuming,
 *   host-agnostically (D1).
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
 * - **D36 — `start()` espera su propia hoja de estilos antes de que driver.js dibuje el
 *   popover.** Defecto medido en navegador real por el orquestador: ambos editores vendorizados
 *   llaman `ensureTourThemeCss(); void tour.start();`, donde `ensureTourThemeCss()` es un
 *   `void import('@md/product-tour/style.css')` fire-and-forget — y `start()`, antes de D36,
 *   solo `await`eaba `import('driver.js')`. Ese import (dependencia pre-bundleada) resuelve
 *   ANTES de que la hoja de estilos llegue, así que driver.js insertaba y POSICIONABA el
 *   popover con `driver.css` (importado por `theme.css`, D36) todavía sin aplicar — el popover
 *   se medía `position: static`, ancho completo del viewport, y el cálculo de posición de
 *   driver.js (que usa esas medidas erróneas) dejaba offsets inline absurdos que la hoja de
 *   estilos, al llegar milisegundos después, congelaba en un `position: fixed` fuera de
 *   pantalla — el usuario veía el overlay y el resaltado, pero nunca el popover. Bajo D36, el
 *   MOTOR es dueño de garantizar el orden — no el consumidor — porque `driver.css` no es
 *   opcional para driver.js y `theme.css` (que lo `@import`ea) vive dentro de este paquete:
 *     1. `CreateTourOptions.loadStyles?: () => Promise<unknown>` — inyectable para tests: por
 *        defecto, `() => import('./theme.css')`.
 *     2. En `start()`, se espera CONCURRENTEMENTE con el import de driver.js —
 *        `const [{ driver }] = await Promise.all([import('driver.js'), loadStyles()])` — para
 *        no añadir latencia nueva: la hoja de estilos se carga en paralelo, nunca en serie.
 *     3. El re-chequeo `isCurrentGeneration(options.tourId, generation)` (D7) sigue corriendo
 *        inmediatamente después de este await combinado, exactamente donde antes corría tras
 *        el import de driver.js a secas — una generación más nueva puede haber reclamado el
 *        registro mientras este `start()` seguía suspendido.
 *     4. D36 es puramente una garantía de ORDEN: no añade `refresh()` posterior a `drive()`, ni
 *        `MutationObserver`, ni `rAF`, ni ninguna otra red de reposicionamiento — si el orden es
 *        correcto, driver.js mide y posiciona el popover ya con sus estilos aplicados, y no
 *        hace falta corregir nada después.
 *     5. Bajo Vitest (entorno de test de este paquete, sin bundler real de CSS), el import de
 *        `./theme.css` resuelve a un módulo inerte — el `loadStyles` por defecto funciona igual
 *        de bien ahí que en producción, sin necesitar la opción inyectada salvo para probar
 *        explícitamente la garantía de orden (ver `tests/`).
 * - **D44/D45/D45b/D47 — el motor es dueño ABSOLUTO de la ruta Next/Done y de la omisión de
 *   pasos; driver.js ya no puede terminar ni adelantar el tour por su cuenta.** Defecto real
 *   verificado leyendo `driver.js@1.8.0`'s `dist/driver.js.mjs`: `F(e,t)` decide omitir un paso
 *   —SINCRÓNICAMENTE— cuando `(t.skipMissingElement ?? config.skipMissingElement)` es verdadero
 *   Y el resolver `element` del paso devuelve un valor falsy EN ESE INSTANTE; `I(e,from,dir)`
 *   camina desde `from` en `dir` y devuelve el primer índice para el que `F()` es falso; `L(e,t)`
 *   —el enrutador del botón Next— calcula `I(e,activeIndex+1,1)` y, si no encuentra nada hacia
 *   delante, usa `onDoneClick` en vez del `onNextClick` de este paquete (así que un click en
 *   Next podía terminar y persistir el tour sin que este paquete se enterara); `B()` usa esa
 *   misma condición para decidir si el botón dice "Done" uno o más pasos antes del final real;
 *   y la función de montaje `m(index, retry)` —invocada por `moveTo`/`moveNext`/`movePrevious`/
 *   `drive`— SÍ lee `waitForElement` de verdad (instala un `MutationObserver` + `setTimeout`
 *   propios vía `p()` cuando `waitForElement > 0` y la ancla no existe aún) y, si tras eso
 *   `F()` sigue siendo verdadero, salta UN índice en la dirección del viaje y se remonta a sí
 *   misma SIN la bandera `retry` — así que cada ancla ausente adicional cuesta otra ventana de
 *   `waitForElement` completa.
 *     1. **D44** — cada `DriveStep` que este paquete construye fija `skipMissingElement: false`
 *        SIN CONDICIÓN, sin importar lo que declare `TourStep.skipMissingElement` (ver
 *        `buildDriveStep()`). Con esa bandera en `false`, `F()` es SIEMPRE falso dentro de
 *        driver.js, así que `I()` degenera a un recorrido de límites llano, `L()` nunca puede
 *        enrutar un click en Next hacia `onDoneClick`, `B()` nunca puede rotular "Done" antes
 *        de tiempo, y la rama de salto-y-remontaje de `m()` nunca se dispara. El campo público
 *        `TourStep.skipMissingElement` conserva su significado documentado — pero ahora lo
 *        consume el MOTOR (punto 3 más abajo), nunca driver.js.
 *     2. **D47** — cada `DriveStep` fija `waitForElement: 0` (el valor por defecto de driver.js)
 *        en vez de `step.waitForElementMs`. El motor ya decidió, ANTES de llamar a
 *        `moveTo()`/`drive()`, si la ancla existe o si el paso se omite (punto 3) — dejar el
 *        `waitForElement` propio de driver.js en un valor > 0 solo podría añadir latencia
 *        DESPUÉS de que esa decisión ya se tomó, nunca cambiarla. `TourStep.waitForElementMs`
 *        conserva su significado: es el presupuesto de la propia `waitForStepAnchor()` del
 *        motor, no el de driver.js.
 *     3. **D45** — `transitionTo(fromIndex, direction)` resuelve el índice destino él mismo y
 *        es dueño de la omisión. Ver el punto 3 de la sección D35 más arriba para el
 *        recorrido exacto; en resumen, camina candidato a candidato desde `fromIndex` en
 *        `direction`, corriendo `before()` + `waitForStepAnchor()` de cada uno, y solo llama a
 *        `driverInstance.moveTo(index)` sobre el primer candidato que resuelve su ancla (o,
 *        si `skipMissingElement === false` para ese candidato, sobre el primero que no la
 *        resuelve). `moveTo()` reemplaza a `moveNext()`/`movePrevious()`: bajo D44,
 *        `moveNext()`/`movePrevious()` solo mueven al índice CONTIGUO (planos, por límites) —
 *        ya no hay omisión que delegarles, así que usarlos aquí aterrizaría siempre en el
 *        candidato inmediato en vez del que el motor decidió tras su propio recorrido.
 *     4. **D45b** — `start()` usa el mismo recorrido para encontrar el PRIMER índice activable
 *        (mismo antes()+espera+omisión) y llama a `driverInstance.drive(thatIndex)` en vez de
 *        `drive()` a secas. Sin esto, D44 convierte una primera ancla ausente de "se omite en
 *        silencio" en "lo primero que ve el usuario es un popover centrado huérfano". Si NINGÚN
 *        índice es activable, `start()` no llama a `drive()`: cierra sin reclamar completado y
 *        sin dejar un registro de generación ni un guard de teclado adjuntos.
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

/** Tolerancia de comparación de rects para D50 — ver `ratesEqual()`. Medio píxel, como pide el contrato. */
const D50_RECT_TOLERANCE_PX = 0.5;
/** Intervalo de muestreo del settle de D50 — "cada ~50 ms", como pide el contrato (nunca `requestAnimationFrame`, ver el bloque D50). */
const D50_SETTLE_SAMPLE_INTERVAL_MS = 50;
/** Presupuesto del settle POSTERIOR al `moveTo()`/`drive()` (mitad 2 de D50) — acotado a "unos 400 ms", nunca al presupuesto de la mitad 1. */
const D50_POST_MOVE_SETTLE_BUDGET_MS = 400;

/** Snapshot mínimo de un `DOMRect` que D50 necesita comparar — evita acoplarse al tipo completo. */
interface D50RectSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lee el rect de `element` de forma defensiva (D50): si `getBoundingClientRect` no existe en el
 * nodo resuelto (no debería pasar en un DOM real, pero el contrato pide guardia explícita),
 * devuelve `null` en vez de lanzar. `element` puede ser `null` (ancla nunca resuelta).
 */
function readRectSafely(element: Element | null): D50RectSnapshot | null {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** `true` si dos snapshots de rect son iguales dentro de `D50_RECT_TOLERANCE_PX` en las cuatro dimensiones (D50). */
function ratesEqual(a: D50RectSnapshot | null, b: D50RectSnapshot | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.x - b.x) <= D50_RECT_TOLERANCE_PX &&
    Math.abs(a.y - b.y) <= D50_RECT_TOLERANCE_PX &&
    Math.abs(a.width - b.width) <= D50_RECT_TOLERANCE_PX &&
    Math.abs(a.height - b.height) <= D50_RECT_TOLERANCE_PX
  );
}

/** `await`ea `ms` milisegundos vía `setTimeout` — nunca `requestAnimationFrame` (D50: no existe en todo runtime de test de este paquete, y un settle real de ~150ms puede producir dos frames rAF idénticos a mitad de camino). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * D50 (mitad 1) — dado que `element` ya resolvió, espera hasta que dos muestras consecutivas de
 * su `getBoundingClientRect()`, tomadas cada `D50_SETTLE_SAMPLE_INTERVAL_MS` (~50 ms, nunca
 * `requestAnimationFrame`), sean iguales dentro de medio píxel — y entonces devuelve `element`.
 * Acotado por `deadline` (un `Date.now()` absoluto, no una duración): nunca espera más allá de
 * él, y si el presupuesto se agota a mitad de un muestreo, devuelve `element` de todos modos con
 * lo que tenga — esta función NUNCA lanza y NUNCA cuelga, exactamente el contrato que ya tenía
 * `waitForStepAnchor()` antes de D50, ahora extendido a "existe Y dejó de moverse".
 *
 * D50b (corrección factual sobre la primera versión de esta función): un par de muestras SOLO
 * es evidencia de asentamiento si está separado en el TIEMPO. Dos lecturas síncronas de
 * `getBoundingClientRect()` en el mismo task no pueden diferir nunca en un navegador real — no
 * se comete ningún layout entre dos statements del mismo task — así que compararlas no prueba
 * nada: la primera versión de esta función tomaba esas dos muestras síncronas como su primera
 * comparación, y esa comparación SIEMPRE resolvía verdadera en producción, haciendo inerte todo
 * el polling de abajo. Bajo D50b, la PRIMERA muestra se toma inmediatamente (sin esperar nada,
 * igual que antes), pero toda comparación posterior — incluida la primera — solo ocurre después
 * de `await delay(...)`: nunca se compara una muestra contra otra tomada en el mismo task.
 *
 * Guardado explícito para runtimes sin motor de layout real (happy-dom, el entorno de test de
 * este paquete): ahí `getBoundingClientRect()` devuelve típicamente todo-ceros en cualquier
 * instante, así que la muestra inicial y la primera muestra separada por temporizador ya
 * coinciden — esta función resuelve en su primera iteración con retraso (un intervalo de
 * muestreo), comportamiento correcto e inofensivo, no un caso especial que haya que detectar.
 */
async function waitForRectToSettle(element: Element, deadline: number): Promise<Element> {
  let previous = readRectSafely(element);

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await delay(Math.min(D50_SETTLE_SAMPLE_INTERVAL_MS, remaining));
    const current = readRectSafely(element);
    if (ratesEqual(previous, current)) return element;
    previous = current;
  }
  return element;
}

/**
 * D43 — espera, como máximo, la ancla de UN paso candidato a la vez, acotada por su propio
 * `waitForElementMs` (por defecto 2000 ms), sin importar si aparece o no: nunca lanza y nunca
 * cuelga el tour. Motivado por B34: un `before()` que recién abre un panel React (D40) podía
 * perder la carrera contra un resaltado síncrono demasiado pronto. **Corrección factual (esta
 * función ya no depende de que driver.js "no lea" `waitForElement` — SÍ lo lee, ver el bloque
 * D44/D45/D45b/D47 al inicio del archivo): bajo D47, cada `DriveStep` le pasa a driver.js
 * `waitForElement: 0`, así que el propio mecanismo de espera de driver.js queda inerte a
 * propósito — esta función es la ÚNICA espera de ancla que de verdad corre, y el motor decide
 * con su resultado ANTES de pedirle nada a driver.js, en vez de dejar que ambas esperas
 * compitan.**
 *
 * Delega en `waitForAnchor()` (`anchors.ts`), que ya resuelve síncronamente si la ancla existe
 * y si no, hace polling — aquí con el intervalo que pide D43 (25 ms) — hasta el timeout, momento
 * en el que resuelve `null` en vez de rechazar. Esto NO reintroduce D23/D24 (resolución de
 * TODAS las anclas al arrancar): solo se llama dentro del recorrido candidato-a-candidato de
 * `transitionTo()`/`start()` (D45/D45b) — nunca por adelantado para el resto de los pasos.
 *
 * **D50 (mitad 1) — "ready" ya no significa "existe", significa "existe Y dejó de moverse".**
 * Defecto medido en navegador real por el orquestador (B46): en pasos cuyo `before()` cambia lo
 * que el panel objetivo renderiza (cambiar de pestaña, seleccionar un nodo), esta función
 * resolvía en el instante en que `resolveAnchor()` encontraba el elemento — el frame en el que
 * el contenido SALIENTE todavía estaba montado, así que la ancla ENTRANTE se medía mientras
 * estaba debajo de él. React confirmaba luego la remoción, la ancla saltaba hacia arriba, y
 * nada volvía a recalcular el stage de driver.js — el cut-out quedaba dibujado más abajo de
 * donde correspondía, permanentemente (nunca se autocorregía).
 *
 * Bajo D50, tras que `waitForAnchor()` resuelva el elemento, esta función le resta el tiempo ya
 * consumido al `timeoutMs` total y gasta el resto (si queda algo) esperando a que su rect se
 * asiente vía `waitForRectToSettle()` — el settle se COBRA contra el mismo presupuesto de
 * `waitForElementMs`, nunca se añade encima como espera nueva sin cota: si el elemento nunca se
 * asienta, esta función igual devuelve el elemento (con lo último que midió) en cuanto se agota
 * el presupuesto total, en vez de colgar el tour. Si `waitForAnchor()` nunca encontró el
 * elemento (`null`), no hay nada que asentar — se devuelve `null` de inmediato, sin gastar
 * settle en un elemento que no existe.
 */
async function waitForStepAnchor(root: TourRoot, step: TourStep): Promise<Element | null> {
  const timeoutMs = step.waitForElementMs ?? 2000;
  const startedAt = Date.now();
  const overallDeadline = startedAt + timeoutMs;

  const found = await waitForAnchor(root, step.anchorKey, { timeoutMs, intervalMs: 25 });
  if (!found) return null;

  // D50: el settle se cobra contra lo que quede del mismo presupuesto — nunca por encima.
  if (Date.now() >= overallDeadline) return found;
  return waitForRectToSettle(found, overallDeadline);
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
  /**
   * Resuelve cuando la hoja de estilos del tour ya está aplicada; inyectable para tests (D36).
   * Por defecto, `() => import('./theme.css')`.
   */
  loadStyles?: () => Promise<unknown>;
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
  /** `driveSteps` de la corrida activa, en orden — usado por `transitionTo()` para resolver el `TourStep` original de cada índice y por la reconciliación de D35.5. */
  let currentDriveSteps: DriveStep[] = [];
  /**
   * Marcador "el `after()` de este `TourStep` saliente ya corrió, vía `transitionTo()`" (D35.4).
   * `onDeselected` (conectado en `buildDriveStep()`) dispara SIEMPRE que driver.js deselecciona
   * un paso, tanto en una transición normal como en destroy (verificado leyendo
   * `driver.js@1.8.0`'s `dist/driver.js.mjs`, funciones `J()` y `h()`) — así que sin este
   * marcador, un paso que salió vía `transitionTo()` (flechas, `onNextClick`/`onPrevClick`
   * globales) correría su `after()` DOS veces: una desde `transitionTo()` y otra desde
   * `onDeselected` al llegar la transición real. Guarda el `TourStep` ORIGINAL (no el `DriveStep`
   * — verificado leyendo `driver.js@1.8.0`'s internal `B()`: el objeto que driver.js pasa de
   * vuelta a `onDeselected` es un `{...step, popover: {...}}` recién creado por cada llamada a
   * `m()`, nunca el mismo objeto `DriveStep` que este paquete puso en `steps: driveSteps` — así
   * que comparar por identidad de `DriveStep` nunca matchea. `data` sí sobrevive ese spread por
   * referencia superficial, así que `data.tourStep` — el `TourStep` original — es lo único
   * estable para comparar). Se limpia en cuanto `onDeselected` lo consume, así que nunca hace
   * falta llevar cuenta por índice ni por generación.
   */
  let alreadyHandledAfterStep: TourStep | null = null;
  /**
   * D46 — at most one `transitionTo()` in flight per tour instance. `true` from the moment a
   * `transitionTo()` call is accepted until it settles (every exit path, via `finally` — see
   * `transitionTo()`), across all three call sites (`onNextClick`, `onPrevClick`, and the
   * capture-phase arrow handler). While `true`, any further Next/Prev click or ArrowRight/
   * ArrowLeft press is DROPPED, not queued: the tour does not remember it and does not replay
   * it once the in-flight transition settles. This is what stops the defect this task closes —
   * without it, `driverInstance.getActiveIndex()` stays stale for the whole duration of the
   * first transition's awaits (`after()`, then each candidate's `before()` +
   * `waitForStepAnchor()`), so every further click/arrow starts an INDEPENDENT walk from that
   * same stale index and eventually issues its own `moveTo()` — several stacked transitions
   * landing as one multi-step jump once they all resolve.
   *
   * Reset by every `start()` (declared as a local, reassigned per `createTour()` call — see
   * below) so a relaunched tour never inherits a stuck flag from a previous run. Released on
   * EVERY exit path of `transitionTo()` via `finally`, so a thrown `before()`/`after()` can
   * never leave it stuck (a stuck flag would freeze navigation permanently, which is worse than
   * the bug being fixed).
   */
  let transitionInFlight = false;

  /**
   * Corre `after()` del `TourStep` dado exactamente una vez, sin importar si el llamador es
   * `transitionTo()` (antes de pedirle a driver.js que avance) o `onDeselected` (cuando driver.js
   * decide deseleccionar un paso por su cuenta — cierre, destroy, o el asentamiento real de un
   * `moveNext()`/`movePrevious()` cuyo paso intermedio se omitió). Ver `alreadyHandledAfterStep`.
   */
  function runAfterOnce(tourStep: TourStep | undefined, after: (() => void | Promise<void>) | undefined): void {
    if (!after) return;
    if (tourStep && alreadyHandledAfterStep === tourStep) {
      alreadyHandledAfterStep = null;
      return;
    }
    void after();
  }

  /**
   * D50 (mitad 2) — cubre lo que la mitad 1 (`waitForStepAnchor()`) no puede: un movimiento
   * causado por driver.js MISMO, después de que ya dibujó el stage. Se llama alrededor de CADA
   * punto en el que este motor pide un movimiento real de paso — `instance.moveTo(index)` en
   * `transitionTo()` y `instance.drive(index)` para el primer paso en `start()` — nunca antes de
   * llamar a `move()`, siempre inmediatamente antes y después.
   *
   * Invoca `move()` de forma sincrónica (así que el stage que driver.js dibuja al montar el paso
   * queda intacto — D50 nunca retrasa el primer pintado), y entonces espera a que el mismo
   * elemento se asiente (muestras reales, separadas en el tiempo — ver D50b en
   * `waitForRectToSettle()`) acotado a `D50_POST_MOVE_SETTLE_BUDGET_MS` (~400 ms, NUNCA cargado
   * contra el `waitForElementMs` del paso, que es un presupuesto distinto ya consumido por la
   * mitad 1 dentro de `waitForStepAnchor()`) y entonces llama a `driverInstance.refresh()`
   * EXACTAMENTE una vez, SIEMPRE — la única operación pública de driver.js@1.8.0 que recalcula
   * el stage de la instancia activa sin remontar el paso (ver el bloque D50 al inicio del
   * archivo).
   *
   * D50b (corrección factual sobre la primera versión): la condición "solo si el rect cambió"
   * que tenía esta función se ha retirado. Esa condición comparaba un `beforeMoveRect` capturado
   * ANTES de `move()` contra un `afterMoveRect` leído tras una espera que, por el defecto de
   * `waitForRectToSettle()` corregido en D50b, antes resolvía de inmediato sin esperar nada real
   * — así que "el rect cambió" casi nunca era cierto y el `refresh()` quedaba deshabilitado en
   * silencio exactamente en el caso que este mecanismo existe para cubrir. El contrato pide
   * ahora un `refresh()` incondicional: se llama siempre, se haya movido o no el rect, una vez
   * que la espera de asentamiento posterior al movimiento termina.
   *
   * `anchorElement` se resuelve por el llamador ANTES de invocar este helper (vía
   * `resolveAnchor()`, la misma función síncrona que ya usa `buildDriveStep()`) — si la ancla del
   * candidato nunca resolvió (`skipMissingElement === false`, popover centrado sobre el
   * `driver-dummy-element` de driver.js), `anchorElement` es `null` y no hay nada que vigilar:
   * esta función se convierte en un no-op salvo por invocar `move()`.
   *
   * Revalida liveness (`isLive()` + una relectura de `driverInstance`) tras el único `await`
   * interno (el settle posterior), igual que el resto de este archivo: si el tour dejó de ser
   * la generación vigente mientras esperaba, nunca llama a `refresh()` sobre una instancia que
   * ya no es la actual.
   */
  async function moveAndRefreshIfMoved(
    anchorElement: Element | null,
    move: () => void,
    isLive: () => boolean,
  ): Promise<void> {
    move();

    if (!anchorElement) return;

    const deadline = Date.now() + D50_POST_MOVE_SETTLE_BUDGET_MS;
    await waitForRectToSettle(anchorElement, deadline);

    if (!driverInstance || !isLive()) return;

    driverInstance.refresh();
  }

  /**
   * D45 — camina desde `fromIndex` en `direction` (`1` para "next", `-1` para "previous") y
   * devuelve el primer candidato TOMABLE, corriendo su `before()` y esperando su ancla
   * (`waitForStepAnchor()`) en el camino — sin mover a driver.js todavía; eso lo decide quien
   * llama a este helper (`transitionTo()`/`start()`), una vez conoce el resultado. Un candidato
   * es tomable si: (a) su ancla resolvió, o (b) su ancla no resolvió pero
   * `candidate.skipMissingElement === false` (el consumidor pidió expresamente NO omitirlo, así
   * que se toma igual y driver.js pintará un popover centrado sobre su `driver-dummy-element`).
   * Si no resolvió y `skipMissingElement !== false` (el valor por defecto documentado en
   * `steps.ts` es omitir), el candidato se descarta y el recorrido continúa con el siguiente
   * índice en la misma `direction`.
   *
   * Devuelve `undefined` si `direction` se agota sin ningún candidato tomable — el llamador
   * decide qué significa eso (fin genuino del tour hacia delante, no-op hacia atrás).
   *
   * Liveness (T8b — Fix 1): revalida `driverInstance`/generación tras CADA `await` (el
   * `before()` de cada candidato, y su `waitForStepAnchor()`), y devuelve `undefined`
   * inmediatamente si el run dejó de ser el vigente — nunca sigue caminando ni deja narrowing de
   * TypeScript de antes de un `await` decidir nada.
   */
  async function findNextActivatableIndex(
    fromIndex: number,
    direction: 1 | -1,
    isLive: () => boolean,
  ): Promise<number | undefined> {
    for (let candidateIndex = fromIndex; candidateIndex >= 0 && candidateIndex < currentDriveSteps.length; candidateIndex += direction) {
      if (!driverInstance || !isLive()) return undefined;

      const candidateDriveStep = currentDriveSteps[candidateIndex];
      const candidateStep = candidateDriveStep?.data?.tourStep as TourStep | undefined;
      if (!candidateStep) continue;

      if (candidateStep.before) await candidateStep.before();
      if (!driverInstance || !isLive()) return undefined;

      const resolved = await waitForStepAnchor(root, candidateStep);
      if (!driverInstance || !isLive()) return undefined;

      if (resolved) return candidateIndex;
      if (candidateStep.skipMissingElement === false) return candidateIndex;
      // else: skip this candidate (engine-owned, D44 — driver.js itself can never do this
      // anymore) and continue the loop in the same direction.
    }
    return undefined;
  }

  /**
   * D45 — el mismo camino terminal que `onDoneClick` toma (ver `driver()` más abajo): persiste
   * el completado, emite `tour_completed` exactamente una vez y destruye la instancia. Se
   * comparte entre `onDoneClick` (el usuario hizo click en el botón visible) y el agotamiento
   * hacia delante del recorrido de `transitionTo()` (el usuario hizo click en Next, o avanzó
   * con la flecha derecha, y no quedaba ningún paso activable por delante) — ambos casos son la
   * MISMA terminación real del tour, así que comparten la misma emisión y persistencia, nunca
   * una emisión de `tour_dismissed` adicional para el mismo cierre.
   */
  function completeTour(totalSteps: number): void {
    persistence.markCompleted(options.tourId, options.version);
    emit({ event: 'tour_completed', tourId: options.tourId, totalSteps });
    destroyActiveInstance();
  }

  /**
   * D45 — el único punto por el que este paquete pide una transición de paso, usado por los
   * tres puntos de entrada: el `onNextClick`/`onPrevClick` GLOBALES pasados a `driver()` (ver
   * `start()`) y el propio handler de flechas de este paquete (`handleEscapeCapture`, más abajo).
   *
   * A diferencia de la versión pre-D45 (que recibía un índice destino ya decidido por el
   * llamador y confiaba en que driver.js pudiera omitir pasos por su cuenta), este helper
   * RESUELVE el destino él mismo: bajo D44 cada `DriveStep` fija `skipMissingElement: false`, así
   * que driver.js nunca vuelve a omitir nada — si alguien tiene que caminar más allá de un
   * candidato con ancla ausente, es este paquete.
   *
   * Orden exacto (no reordenable): (a) corre el `after()` del paso SALIENTE (el `activeIndex`
   * actual, antes de moverse) y lo marca como ya manejado, para que el `onDeselected` de
   * driver.js no lo repita cuando `moveTo()` dispare la transición real en (c); (b) llama a
   * `findNextActivatableIndex(fromIndex + direction, direction)`, que corre `before()` +
   * `waitForStepAnchor()` de cada candidato en orden hasta encontrar uno tomable; (c) si
   * encontró uno, `driverInstance.moveTo(candidateIndex)`. Ese orden — `after()` del saliente
   * antes que el `before()` de CUALQUIER candidato — es lo que deja que una guardia que
   * restaura estado compartido entre pasos (p.ej. el guard del drawer de librería del editor de
   * email, que cancela una restauración pendiente en cuanto se entra al siguiente paso de
   * librería) siga funcionando: si el `before()` de un candidato entrante corriera antes del
   * `after()` del saliente, ese `after()` podría deshacer algo que el `before()` entrante ya
   * había dejado montado.
   *
   * Si `findNextActivatableIndex()` no encuentra ningún candidato tomable: hacia delante
   * (`direction === 1`), el tour terminó de verdad — se toma el MISMO camino terminal que
   * `onDoneClick` (`completeTour()`: persistir, emitir `tour_completed`, destruir), sin además
   * reportar `tour_dismissed` para el mismo cierre; hacia atrás (`direction === -1`), no hace
   * nada y el tour se queda en el paso actual (no hay "antes del primer paso" a donde ir).
   *
   * `moveTo(index)` reemplaza a `moveNext()`/`movePrevious()`: bajo D44 esos dos métodos solo
   * mueven al índice CONTIGUO (planos, sin omisión que delegarles — ver los hechos verificados
   * en el bloque D44/D45/D45b/D47 al inicio del archivo), así que usarlos aquí aterrizaría
   * siempre en el candidato inmediato en vez del que este recorrido decidió.
   *
   * **D46 — at most one `transitionTo()` in flight per tour instance.** The caller (each of the
   * three call sites: the global `onNextClick`/`onPrevClick`, and the capture-phase arrow
   * handler) is responsible for checking `transitionInFlight` BEFORE calling this function —
   * that check happens at the call site, not here, because the arrow-key call site must decide
   * whether to consume the key (`stopPropagation()`/`preventDefault()`) even when it drops the
   * navigation, and that decision has to run synchronously before this async function is ever
   * invoked. Once entered, this function sets `transitionInFlight = true` for its entire
   * lifetime and clears it in a `finally` that wraps EVERY line below — including every early
   * `return` (dead outgoing instance/generation, no activatable candidate, nothing before the
   * first step) and the terminal `completeTour()` path — so a thrown `before()`/`after()` can
   * never leave the flag stuck (a stuck flag would freeze navigation permanently, which is worse
   * than the bug D46 fixes).
   */
  async function transitionTo(fromIndex: number, direction: 'next' | 'previous'): Promise<void> {
    transitionInFlight = true;
    try {
      // T8b — Fix 1: capture the generation this transition belongs to (the same value `start()`
      // used, via the `ownGeneration` closure variable at call time) and re-validate it — together
      // with a freshly-read `driverInstance` local, never the narrowing from the top of this
      // function — after EVERY await below. `driverInstance` is a closure variable `onDestroyed`
      // sets to `null`, and a newer `start()` can also bump the registered generation; either one
      // means this run is no longer live (the tour closed — Escape, overlay click, ×, `stop()` —
      // or a fresher `start()` superseded it) while this transition was suspended on an `await`.
      // TypeScript's narrowing from the guard below does NOT survive an `await` (the variable can
      // be reassigned by a callback that runs during that suspension), so every dereference below
      // reads `driverInstance` into a local first and checks that local, never the outer variable
      // directly.
      const generation = ownGeneration;
      const isLive = () => isCurrentGeneration(options.tourId, generation);

      let instance = driverInstance;
      if (!instance || !isLive()) return;

      const outgoingIndex = instance.getActiveIndex();
      const outgoingDriveStep = outgoingIndex !== undefined ? currentDriveSteps[outgoingIndex] : undefined;
      const outgoingStep = outgoingDriveStep?.data?.tourStep as TourStep | undefined;
      if (outgoingStep?.after) {
        alreadyHandledAfterStep = outgoingStep;
        await outgoingStep.after();
      }

      instance = driverInstance;
      if (!instance || !isLive()) return;

      const delta = direction === 'next' ? 1 : -1;
      const candidateIndex = await findNextActivatableIndex(fromIndex + delta, delta, isLive);

      instance = driverInstance;
      if (!instance || !isLive()) return;

      if (candidateIndex === undefined) {
        if (direction === 'next') {
          completeTour(currentTotalSteps);
        }
        // direction === 'previous': nothing before the first step — stay put, do nothing.
        return;
      }

      // D50 (mitad 2): resuelve la ancla del candidato ENTRANTE (síncronamente, misma función
      // que usa `buildDriveStep()`) ANTES de mover, para que `moveAndRefreshIfMoved()` pueda
      // capturar su rect justo antes de `moveTo()` y comparar contra el rect posterior — cubre
      // el movimiento causado por driver.js MISMO después de dibujar el stage, que la mitad 1
      // (dentro de `waitForStepAnchor()`, ya corrida arriba por `findNextActivatableIndex()`) no
      // puede ver porque ocurre DESPUÉS del `moveTo()`, no antes. Si la ancla del candidato nunca
      // resolvió (`skipMissingElement === false`, popover centrado), `resolveAnchor()` también
      // devuelve `null` y el helper se reduce a invocar `moveTo()` sin vigilar nada.
      const incomingAnchorKey = currentDriveSteps[candidateIndex]?.data?.tourStep?.anchorKey;
      const incomingAnchor = incomingAnchorKey ? resolveAnchor(root, incomingAnchorKey) : null;
      await moveAndRefreshIfMoved(incomingAnchor, () => instance!.moveTo(candidateIndex), isLive);
    } finally {
      transitionInFlight = false;
    }
  }

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
        // D21: ArrowRight moves between EXISTING steps only. On the last step, advancing would
        // route into driver.js's own advance handler — replaced by `onDoneClick`, which
        // persists completion and emits `tour_completed` (see `start()`) — so a keypress must
        // not silently finish and persist the tour. Checked BEFORE stopping propagation/default:
        // a no-op arrow on the last step must not behave as if the tour had consumed the key.
        //
        // T5/D43 correction: this used to read `driverInstance.isLastStep()`, which is NOT a
        // plain index-bounds check — reading driver.js@1.8.0's source (`I()`/`F()`, called from
        // both `isLastStep()` and its own internal `moveNext()`-equivalent routing) shows it
        // walks forward from the active index and, for each candidate step, SYNCHRONOUSLY calls
        // the step's `element` resolver right now to decide whether that step currently counts
        // as reachable (respecting `skipMissingElement`). D43 exists precisely because a step's
        // anchor can still be missing at the exact moment its `before()` is about to mount it —
        // so on the second-to-last step, `isLastStep()` incorrectly read `true` and this guard
        // swallowed a legitimate ArrowRight before `transitionTo()` (and D43's wait inside it)
        // ever ran, silently breaking keyboard navigation into precisely the step D43 is meant
        // to reach. The correct bounds check is the plain array this package already owns for
        // every other index computation in this file (`transitionTo()`/`findNextActivatableIndex()`,
        // D45): there is a next step to move to iff `activeIndex + 1 < currentDriveSteps.length`,
        // independent of whether that step's anchor exists yet — this bounds check is about
        // "is there ANY further slot in the array", not "is the immediately next one
        // activatable"; `transitionTo()` itself (D45) is what walks past unactivatable
        // candidates and decides whether the tour is genuinely over.
        const activeIndexForRight = driverInstance.getActiveIndex() ?? 0;
        if (activeIndexForRight + 1 >= currentDriveSteps.length) return;
        e.stopPropagation();
        e.preventDefault();
        // D46: a transition is already in flight — drop this press (do not start a second,
        // independent `transitionTo()` walk from this same stale active index) but the key is
        // still CONSUMED (`stopPropagation()`/`preventDefault()` already ran above): dropping
        // the navigation must never let the key leak through to the host editor. See the doc
        // block on `transitionInFlight` for why an independent second walk is exactly the
        // multi-step-jump defect this task closes.
        if (transitionInFlight) return;
        // D45: route through the shared `transitionTo()` helper instead of calling
        // `driverInstance.moveNext()` directly, so the incoming step's `before()` runs right
        // before the move instead of having run for every step back at `start()`, and so the
        // engine (not driver.js) decides which candidate index the tour actually lands on.
        // `transitionTo()` is async; calling it as `void ...()` here (rather than making this
        // handler `async`) keeps `stopPropagation()`/`preventDefault()` above running
        // synchronously, exactly when they always have. Passes the CURRENT active index — not
        // `activeIndexForRight + 1` — because `transitionTo()` now computes the first candidate
        // itself (`fromIndex + delta`).
        void transitionTo(activeIndexForRight, 'next');
      } else {
        // D21: symmetric no-op at the other boundary — ArrowLeft on the first step must not
        // move backwards (there is nowhere to go, and driver.js has no "before the first step"
        // state to route into, but the no-op must still not consume the key).
        if (driverInstance.getActiveIndex() === 0) return;
        e.stopPropagation();
        e.preventDefault();
        // D46: same drop-but-consume as the ArrowRight branch above — see that comment.
        if (transitionInFlight) return;
        const activeIndex = driverInstance.getActiveIndex() ?? 0;
        // Passes the CURRENT active index, same reasoning as the ArrowRight branch above:
        // `transitionTo()` computes the first backward candidate itself (`fromIndex - 1`).
        void transitionTo(activeIndex, 'previous');
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

  /**
   * D35.2 — construye el `DriveStep` de `step` con resolución de ancla PEREZOSA: `element` es
   * una función, `() => resolveAnchor(root, step.anchorKey) ?? undefined`, invocada por
   * driver.js en el momento de intentar resaltar este paso (verificado leyendo
   * `driver.js@1.8.0`'s `dist/driver.js.mjs`, helper `f(e)` — `typeof e==='function' ? e() :
   * ...`), no aquí. El cast `as unknown as string` compensa que el tipo público de
   * `DriveStep.element` es `string | Element | (() => Element)` — sin `null`/`undefined` en la
   * firma de retorno de la función — aunque driver.js maneja el caso "no resolvió" internamente
   * exactamente igual que con un selector de cadena que no matchea nada (su propio helper
   * `F()`/`m()` comprueba el resultado antes de usarlo).
   *
   * **D44** — `skipMissingElement: false` SIN CONDICIÓN, sin importar `step.skipMissingElement`.
   * Con la bandera apagada, el helper `F()` de driver.js siempre devuelve `false`, así que su
   * `I()` interno degenera a un recorrido de límites llano y NUNCA puede omitir este paso por
   * su cuenta ni enrutar un click en Next hacia `onDoneClick` (`L()`) ni rotular el botón
   * "Done" antes de tiempo (`B()`). `step.skipMissingElement` (documentado en `steps.ts`)
   * conserva su significado — pero ahora lo consulta el MOTOR, en `transitionTo()`/`start()`
   * (D45/D45b), nunca driver.js.
   *
   * **D47** — `waitForElement: 0` (el valor por defecto de driver.js) en vez de
   * `step.waitForElementMs`. driver.js@1.8.0 SÍ lee `waitForElement` de verdad (su función de
   * montaje `m()` instala un `MutationObserver`/`setTimeout` propios cuando es > 0) — pero para
   * cuando este paquete llama a `moveTo()`/`drive()`, el motor ya decidió si la ancla existe o
   * si el paso se omite (`waitForStepAnchor()` dentro del recorrido de D45/D45b), así que dejar
   * el `waitForElement` de driver.js en > 0 solo añadiría latencia DESPUÉS de esa decisión,
   * nunca la cambiaría. `step.waitForElementMs` conserva su significado — es el presupuesto de
   * la espera del MOTOR, no la de driver.js.
   *
   * `data.tourStep` guarda una referencia al `TourStep` original: es lo que `transitionTo()`
   * usa para encontrar el `before()`/`after()`/`skipMissingElement`/`waitForElementMs` de cada
   * índice sin mantener un mapa aparte.
   *
   * `onDeselected` sigue siendo la vía por la que corren los cierres (×, overlay, Escape,
   * `stop()`, Done) — pero ahora pasa por `runAfterOnce()` para no repetir un `after()` que
   * `transitionTo()` ya corrió (D35.4).
   */
  function buildDriveStep(root: TourRoot, step: TourStep): DriveStep {
    const driveStep: DriveStep = {
      element: (() => resolveAnchor(root, step.anchorKey) ?? undefined) as unknown as string,
      popover: toDriverPopover(step.popover),
      skipMissingElement: false,
      waitForElement: 0,
      data: { tourStep: step },
      onDeselected: step.after
        ? () => {
            runAfterOnce(step, step.after);
          }
        : undefined,
    };
    return driveStep;
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
    // D46: a fresh `start()` never inherits a stuck in-flight flag from a previous run of this
    // same `Tour` instance (e.g. `stop()` + `start()` again, or a superseding `start()` landing
    // while a transition from the PREVIOUS generation was still suspended on an await — that
    // previous transition's own `finally` will still clear the flag when it settles, but this
    // reset makes the new generation's navigation available immediately rather than depending
    // on that unrelated settle).
    transitionInFlight = false;

    // D36: la hoja de estilos del tour se espera CONCURRENTEMENTE con el import de driver.js —
    // nunca en serie después — así el motor garantiza que `driver.css` (importado por
    // `theme.css`) ya está aplicado cuando driver.js mida y posicione el popover, sin añadir
    // latencia nueva (ver el bloque D36 al inicio de este archivo).
    const loadStyles = options.loadStyles ?? (() => import('./theme.css'));
    const [{ driver }] = await Promise.all([import('driver.js'), loadStyles()]);

    // Una generación más nueva pudo haber reclamado el registro mientras esperábamos el
    // import — abortar sin construir nada ni tocar el DOM.
    if (!isCurrentGeneration(options.tourId, generation)) return;

    // D35: construir los `driveSteps` es ahora SINCRÓNICO — no hay resolución de anclas aquí.
    // Cada `DriveStep.element` es una función que driver.js invoca perezosamente, en el momento
    // de intentar resaltar ESE paso (ver `buildDriveStep()` más abajo y el bloque D35 al inicio
    // de este archivo). `before()` del primer paso todavía no ha corrido — corre justo antes de
    // `driverInstance.drive()`, más abajo, no aquí.
    const driveSteps: DriveStep[] = eligibleSteps.map((step) => buildDriveStep(root, step));
    if (driveSteps.length === 0) return;

    currentDriveSteps = driveSteps;
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
      // D45: global `onNextClick`/`onPrevClick` — when configured, driver.js hands the ENTIRE
      // transition to these hooks and does not advance/retreat on its own (verified reading
      // `driver.js@1.8.0`'s internal `L()`/`R()`: a configured `onNextClick`/`onPrevClick` is
      // used INSTEAD of the internal advance/retreat, except on the LAST step, where
      // `onDoneClick` still takes priority over `onNextClick` — so this global hook is simply
      // never invoked there, and the existing `onDoneClick` below keeps working untouched).
      // Under D44, "the LAST step" here means the true last array index — `B()`'s condition for
      // labelling the button "Done" (`I(e,t+1,1)===undefined`) degenerates to a plain bounds
      // check now that `skipMissingElement: false` makes `F()` always false, so it can no
      // longer mislabel the button early. Both hooks route through the same `transitionTo()`
      // helper the arrow-key handler uses, so a click on the popover's Next/Previous button
      // gets the identical `after()`-then-candidate-walk ordering (D45) as a keyboard-driven
      // transition — including the engine's own skip-ahead when the immediately next step's
      // anchor never materialises.
      //
      // D46: both hooks drop the click while a transition is already in flight
      // (`transitionInFlight`) instead of starting a second, independent `transitionTo()` walk
      // from the same stale `getActiveIndex()` — see the doc block on `transitionInFlight` and
      // on `transitionTo()` itself for why an independent second walk is exactly the defect
      // this task closes.
      onNextClick: () => {
        if (transitionInFlight) return;
        const activeIndex = driverInstance?.getActiveIndex() ?? 0;
        void transitionTo(activeIndex, 'next');
      },
      onPrevClick: () => {
        if (transitionInFlight) return;
        const activeIndex = driverInstance?.getActiveIndex() ?? 0;
        void transitionTo(activeIndex, 'previous');
      },
      onHighlighted: (_el, driveStep) => {
        // T8b — Fix 2: driver.js never hands back the same `DriveStep` object this package put
        // in `steps` — its internal `B()` builds a fresh `{...step, popover: {...}}` clone for
        // every drive, so `driveSteps.indexOf(driveStep)` can never match and always returned
        // -1 (proven empirically in `tests/stepActivation.test.ts`, "defect 2 proof + fix").
        // `data` survives that spread by shallow reference though (same reasoning already
        // documented above for `alreadyHandledAfterStep`), so resolve the index through the
        // stable `data.tourStep` reference instead: find the position in `currentDriveSteps`
        // (the same array `transitionTo()` already uses to resolve steps by index) whose
        // `data.tourStep` is the identical `TourStep` this hook's clone carries. Fall back to
        // the original `indexOf` only if that lookup somehow fails (e.g. `data` missing).
        const tourStep = (driveStep as DriveStep)?.data?.tourStep as TourStep | undefined;
        const resolvedIndex = tourStep
          ? currentDriveSteps.findIndex((candidate) => candidate.data?.tourStep === tourStep)
          : -1;
        const index = resolvedIndex !== -1 ? resolvedIndex : driveSteps.indexOf(driveStep);
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
        // Close the tour on "Done" via the shared `completeTour()` helper (D45) — the same
        // terminal path `transitionTo()` takes when its forward candidate walk exhausts
        // `currentDriveSteps` with nothing activatable left. Pre-existing gap fixed under B7B8
        // (in scope: this exact file — proven while wiring the e2e "full step walk finishes the
        // tour" assertion, DONE WHEN 1(b)): driver.js substitutes `onDoneClick` for its own
        // "advance" handler on the last step (verified reading driver.js@1.8.0's source,
        // function `L()`), so without an explicit `destroy()` here the popover/overlay never
        // closed after "Done" — the tour would sit on its last step forever.
        // `destroyActiveInstance()` (not `dismissActiveInstance()`), inside `completeTour()`:
        // finishing via Done is a completion, not a dismissal, so `tour_dismissed` must not
        // also fire for the very same close.
        completeTour(driveSteps.length);
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

    // D45b — resolve the FIRST activatable index with the same walker `transitionTo()` uses:
    // run each candidate's `before()`, await its anchor, skip when unresolved and skippable
    // (`skipMissingElement !== false`), take it anyway (centred popover) when unresolved and
    // NOT skippable. Must happen BEFORE `registerGenerationDestroy()`/`attachEscapeGuard()`/
    // `markSeen()`/the `tour_started` emission below: under D44, `skipMissingElement: false`
    // means driver.js itself can never again silently skip a missing first anchor — without
    // this walker, a missing first anchor would turn into an orphan centred popover being the
    // first thing the user sees. If NO index is activatable at all, this `start()` must not
    // drive, must not claim completion, and must leave no registered generation or attached key
    // guard behind — so this check runs first, and returns early (after destroying the
    // just-created `driverInstance` and releasing the generation this call claimed) without any
    // of those side effects ever happening.
    if (!isCurrentGeneration(options.tourId, generation)) return;
    const firstActivatableIndex = await findNextActivatableIndex(0, 1, () =>
      isCurrentGeneration(options.tourId, generation),
    );

    if (!isCurrentGeneration(options.tourId, generation)) return;

    if (firstActivatableIndex === undefined) {
      // No step in this run is activatable. Tear down the driver.js instance this call just
      // created (never driven, so no popover/overlay was ever shown) without registering it,
      // without attaching the key guard, and without touching persistence/analytics — none of
      // those side effects have happened yet at this point.
      driverInstance?.destroy();
      driverInstance = null;
      return;
    }

    // A partir de aquí la generación tiene un `destroy` real: si otro `start()` (de este u
    // otro `Tour` con el mismo `tourId`) reclama la siguiente generación, `claimTourGeneration`
    // llamará a este `destroy` sincrónicamente antes de construir la instancia nueva.
    registerGenerationDestroy(options.tourId, generation, destroyActiveInstance);

    attachEscapeGuard();
    persistence.markSeen(options.tourId, options.version);
    emit({ event: 'tour_started', tourId: options.tourId, totalSteps: driveSteps.length });
    // D45b: `firstActivatableIndex`'s `before()` and anchor wait already ran inside
    // `findNextActivatableIndex()` above — drive directly to that index instead of `drive()`
    // (which always means index 0) so a leading run of unactivatable candidates is skipped by
    // the ENGINE, never by driver.js (which, under D44, cannot skip anything on its own).
    //
    // D50 (mitad 2): same treatment as `transitionTo()`'s `moveTo()` call — the tour's very
    // first popover must not be stale either. Resolve the first step's anchor synchronously
    // before driving, so `moveAndRefreshIfMoved()` can capture its rect immediately before
    // `drive()` and compare against the post-drive rect, calling `driverInstance.refresh()`
    // exactly once if driver.js itself moved it after drawing the stage.
    const firstAnchorKey = currentDriveSteps[firstActivatableIndex]?.data?.tourStep?.anchorKey;
    const firstAnchor = firstAnchorKey ? resolveAnchor(root, firstAnchorKey) : null;
    const instanceAtDrive = driverInstance;
    if (!instanceAtDrive) return;
    await moveAndRefreshIfMoved(
      firstAnchor,
      () => instanceAtDrive.drive(firstActivatableIndex),
      () => isCurrentGeneration(options.tourId, generation),
    );
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

function requireStoragePrefix(prefix: string | undefined): string {
  if (!prefix) {
    throw new Error(
      '[@md/product-tour] createTour requires either `storagePrefix` or a custom `persistence` ' +
        '— this package never assumes a default namespace (see docs/product-tour-driverjs-plan.md §0.4).',
    );
  }
  return prefix;
}
