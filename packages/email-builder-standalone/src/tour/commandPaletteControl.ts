/**
 * commandPaletteControl.ts — guardia del paso `eb.commandPalette` del tour (§T5).
 *
 * El ancla del paso vive dentro del root del controlador de la paleta
 * (`@josecortez1/c42-core`), que se monta con `hidden` mientras está cerrada — sin abrirla
 * primero, el paso resalta un elemento invisible. Este módulo no importa el controlador ni
 * `App/CommandPalette/index.tsx`: abre y cierra la paleta a través de su único contrato
 * público, el atajo de teclado (D27), igual que lo haría cualquier usuario real.
 *
 * La paleta expone el atajo como un `toggle()`, no como `open()`/`close()` independientes:
 * despachar el evento sin mirar el estado actual cerraría una paleta que el usuario ya tenía
 * abierta. Por eso ambas funciones del paso (`enterCommandPaletteStep` /
 * `leaveCommandPaletteStep`) están guardadas por `data-state`, y `leaveCommandPaletteStep`
 * solo actúa si fue este mismo paso el que abrió la paleta (D26) — así el tour nunca le cierra
 * al usuario algo que no abrió él mismo.
 */

/** Root del controlador de la paleta (`@josecortez1/c42-core`, no de este paquete). */
export const COMMAND_PALETTE_ROOT_SELECTOR = '[data-c42-command-palette]';
/** Input de búsqueda de la paleta, foco al abrir. */
export const COMMAND_PALETTE_INPUT_SELECTOR = '[data-c42-command-input]';

/** Recuerda si fue `enterCommandPaletteStep` quien abrió la paleta en este paso. */
let openedByThisStep = false;

/** `true` solo cuando el root de la paleta existe en `scope` y su `data-state` es `"open"`. */
export function isCommandPaletteOpen(scope: ParentNode = document): boolean {
  if (typeof document === 'undefined' || !scope) return false;
  const root = scope.querySelector(COMMAND_PALETTE_ROOT_SELECTOR);
  return root instanceof HTMLElement && root.dataset.state === 'open';
}

/**
 * Despacha el atajo Ctrl+K del propio controlador sobre `document` (fase de captura, sin
 * mirar `isTrusted` — ver comentario de cabecera). Incondicional: quien llama decide cuándo
 * hacerlo (guardado por estado en `enterCommandPaletteStep`/`leaveCommandPaletteStep`).
 */
export function dispatchCommandPaletteHotkey(): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }),
  );
}

/**
 * `before()` del paso `eb.commandPalette`: si la paleta está cerrada, la abre con su propio
 * atajo y recuerda que fue este paso quien lo hizo (para el restore simétrico de
 * `leaveCommandPaletteStep`). Si ya estaba abierta (el usuario la abrió antes de llegar a
 * este paso), no la toca.
 *
 * Tras abrir, quita el foco del input: con el foco ahí dentro el motor del tour no roba las
 * flechas de un campo editable (D22) y `Tab` queda atrapado por el focus trap de la paleta —
 * sacar el foco del input es lo único que le devuelve el teclado al popover, porque el trap
 * solo intercepta `Tab`.
 */
export function enterCommandPaletteStep(): void {
  if (typeof document === 'undefined') return;
  const root = document.querySelector(COMMAND_PALETTE_ROOT_SELECTOR);
  if (!(root instanceof HTMLElement)) return;

  if (root.dataset.state !== 'open') {
    dispatchCommandPaletteHotkey();
    openedByThisStep = true;
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches(COMMAND_PALETTE_INPUT_SELECTOR)) {
    active.blur();
  }
}

/**
 * `after()` del paso `eb.commandPalette`: cierra la paleta solo si fue este paso quien la
 * abrió, y solo si sigue abierta (idempotente — D26). Si el usuario ya la tenía abierta antes
 * de entrar al paso, no se toca al salir.
 */
export function leaveCommandPaletteStep(): void {
  if (!openedByThisStep) return;
  openedByThisStep = false;

  if (typeof document === 'undefined') return;
  const root = document.querySelector(COMMAND_PALETTE_ROOT_SELECTOR);
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.state !== 'open') return;

  dispatchCommandPaletteHotkey();
}

/** Olvida si el tour abrió la paleta, sin tocar el DOM (solo para tests). */
export function resetCommandPaletteStepGuard(): void {
  openedByThisStep = false;
}
