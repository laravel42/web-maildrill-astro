/**
 * commandPaletteControl.test.ts — verifica la guardia del paso `eb.commandPalette` (§T5):
 * `isCommandPaletteOpen`, `dispatchCommandPaletteHotkey`, `enterCommandPaletteStep` /
 * `leaveCommandPaletteStep` (D26/D27) y `resetCommandPaletteStepGuard`.
 *
 * El controlador real (`@josecortez1/c42-core`) no se importa aquí (§ fuera de alcance): el
 * fixture simula a mano el contrato que el módulo consume — un root con `data-c42-command-palette`
 * + `data-state` y un input `data-c42-command-input` — y un listener espía en fase de captura
 * que imita lo que `openPalette()`/`toggle()` le hacen al DOM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMMAND_PALETTE_INPUT_SELECTOR,
  COMMAND_PALETTE_ROOT_SELECTOR,
  dispatchCommandPaletteHotkey,
  enterCommandPaletteStep,
  isCommandPaletteOpen,
  leaveCommandPaletteStep,
  resetCommandPaletteStepGuard,
} from '../src/tour/commandPaletteControl';

let root: HTMLDivElement;
let input: HTMLInputElement;

/** Fixture mínimo: root oculto + input, tal como los monta el controlador al inicializar. */
function mountFixture(): void {
  root = document.createElement('div');
  root.setAttribute('data-c42-command-palette', '');
  root.hidden = true;
  root.dataset.state = 'closed';

  input = document.createElement('input');
  input.setAttribute('data-c42-command-input', '');
  root.appendChild(input);

  document.body.appendChild(root);
}

function removeFixture(): void {
  root?.remove();
}

beforeEach(() => {
  mountFixture();
});

afterEach(() => {
  removeFixture();
  resetCommandPaletteStepGuard();
});

describe('isCommandPaletteOpen', () => {
  it('es false cuando el root está cerrado', () => {
    expect(isCommandPaletteOpen()).toBe(false);
  });

  it('es true cuando el root tiene data-state="open"', () => {
    root.hidden = false;
    root.dataset.state = 'open';
    expect(isCommandPaletteOpen()).toBe(true);
  });

  it('es false cuando no hay ningún root en el scope', () => {
    removeFixture();
    expect(isCommandPaletteOpen()).toBe(false);
  });
});

describe('dispatchCommandPaletteHotkey', () => {
  it('despacha un keydown con ctrlKey y key "k" que un listener en fase de captura recibe', () => {
    const spy = vi.fn();
    document.addEventListener('keydown', spy, true);

    dispatchCommandPaletteHotkey();

    expect(spy).toHaveBeenCalledTimes(1);
    const event = spy.mock.calls[0][0] as KeyboardEvent;
    expect(event.ctrlKey).toBe(true);
    expect(event.key.toLowerCase()).toBe('k');

    document.removeEventListener('keydown', spy, true);
  });
});

/**
 * Instala un listener de captura que imita al controlador real: al ver Ctrl/Cmd+K hace
 * `toggle()` sobre el fixture (abre si está cerrado, cierra si está abierto), incluyendo el
 * foco del input al abrir — el mismo efecto que describe `openPalette()`/`closePalette()`.
 */
function installControllerSpy(): ReturnType<typeof vi.fn> {
  const spy = vi.fn((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    if (root.dataset.state === 'open') {
      root.hidden = true;
      root.dataset.state = 'closed';
    } else {
      root.hidden = false;
      root.dataset.state = 'open';
      input.focus();
    }
  });
  document.addEventListener('keydown', spy, true);
  return spy;
}

describe('enterCommandPaletteStep', () => {
  it('despacha exactamente UN hotkey cuando la paleta está cerrada, y la abre', () => {
    const spy = installControllerSpy();

    enterCommandPaletteStep();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(root.dataset.state).toBe('open');

    document.removeEventListener('keydown', spy, true);
  });

  it('despacha CERO hotkeys cuando la paleta ya está abierta', () => {
    root.hidden = false;
    root.dataset.state = 'open';
    const spy = installControllerSpy();

    enterCommandPaletteStep();

    expect(spy).toHaveBeenCalledTimes(0);
    expect(root.dataset.state).toBe('open');

    document.removeEventListener('keydown', spy, true);
  });

  it('quita el foco del input tras abrir (el input ya no es document.activeElement)', () => {
    const spy = installControllerSpy();

    enterCommandPaletteStep();

    expect(document.activeElement).not.toBe(input);

    document.removeEventListener('keydown', spy, true);
  });

  it('es seguro llamarlo dos veces seguidas', () => {
    const spy = installControllerSpy();

    enterCommandPaletteStep();
    expect(() => enterCommandPaletteStep()).not.toThrow();
    // El segundo enter no debería re-abrir (ya está abierta) ni disparar otro hotkey.
    expect(spy).toHaveBeenCalledTimes(1);

    document.removeEventListener('keydown', spy, true);
  });

  it('es un no-op seguro cuando no hay root en el DOM', () => {
    removeFixture();
    expect(() => enterCommandPaletteStep()).not.toThrow();
  });
});

describe('leaveCommandPaletteStep', () => {
  it('cierra la paleta despachando el hotkey solo si este paso la abrió', () => {
    const spy = installControllerSpy();

    enterCommandPaletteStep();
    expect(root.dataset.state).toBe('open');
    spy.mockClear();

    leaveCommandPaletteStep();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(root.dataset.state).toBe('closed');

    document.removeEventListener('keydown', spy, true);
  });

  it('no despacha nada si la paleta ya estaba abierta antes de entrar al paso', () => {
    root.hidden = false;
    root.dataset.state = 'open';
    const spy = installControllerSpy();

    enterCommandPaletteStep();
    expect(spy).toHaveBeenCalledTimes(0);

    leaveCommandPaletteStep();

    expect(spy).toHaveBeenCalledTimes(0);
    expect(root.dataset.state).toBe('open');

    document.removeEventListener('keydown', spy, true);
  });

  it('es seguro llamarlo dos veces seguidas (idempotente)', () => {
    const spy = installControllerSpy();

    enterCommandPaletteStep();
    leaveCommandPaletteStep();
    spy.mockClear();

    expect(() => leaveCommandPaletteStep()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(0);
    expect(root.dataset.state).toBe('closed');

    document.removeEventListener('keydown', spy, true);
  });

  it('es un no-op seguro cuando no hay root en el DOM', () => {
    const spy = installControllerSpy();
    enterCommandPaletteStep();
    document.removeEventListener('keydown', spy, true);

    removeFixture();
    expect(() => leaveCommandPaletteStep()).not.toThrow();
  });

  it('sin haber entrado antes al paso, es un no-op (no toca una paleta ajena)', () => {
    root.hidden = false;
    root.dataset.state = 'open';
    const spy = installControllerSpy();

    leaveCommandPaletteStep();

    expect(spy).toHaveBeenCalledTimes(0);
    expect(root.dataset.state).toBe('open');

    document.removeEventListener('keydown', spy, true);
  });
});

describe('resetCommandPaletteStepGuard', () => {
  it('olvida que el paso abrió la paleta, sin tocar el DOM', () => {
    const spy = installControllerSpy();

    enterCommandPaletteStep();
    expect(root.dataset.state).toBe('open');

    resetCommandPaletteStepGuard();

    // Tras el reset, leaveCommandPaletteStep ya no sabe que fue este paso quien abrió.
    leaveCommandPaletteStep();
    expect(root.dataset.state).toBe('open');

    document.removeEventListener('keydown', spy, true);
  });

  it('es seguro llamarlo dos veces seguidas', () => {
    resetCommandPaletteStepGuard();
    expect(() => resetCommandPaletteStepGuard()).not.toThrow();
  });
});

// Sanity: los selectores exportados coinciden con el contrato DOM publicado por el controlador.
describe('selectores exportados', () => {
  it('COMMAND_PALETTE_ROOT_SELECTOR y COMMAND_PALETTE_INPUT_SELECTOR', () => {
    expect(COMMAND_PALETTE_ROOT_SELECTOR).toBe('[data-c42-command-palette]');
    expect(COMMAND_PALETTE_INPUT_SELECTOR).toBe('[data-c42-command-input]');
  });
});
