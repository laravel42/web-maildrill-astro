/**
 * useThemeMode — modo de tema del CHROME del editor (Fase 11.d, docs/18).
 *
 * Tres estados: "system" | "light" | "dark". `system` sigue en vivo la
 * preferencia del SO (`prefers-color-scheme`). El tema efectivo se aplica como
 * atributo `data-theme="light" | "dark"` en `<html>`; el CSS del chrome
 * (`styles/chrome.css`) reasigna la capa semántica de tokens bajo
 * `[data-theme="dark"]`.
 *
 * Persistencia: clave `themeMode` de `useLocalConfig` (localStorage, prefijo
 * `pb:`). El flash inicial (FOUC) lo evita un script inline en `index.html`
 * que aplica `data-theme` antes del primer paint leyendo la misma clave.
 *
 * Implementación: un **store externo único** (module-level) consumido con
 * `useSyncExternalStore` — así todas las instancias del hook comparten estado
 * y reaccionan tanto al cambio de modo como a la preferencia del SO. El
 * snapshot es un string estable `"<mode>:<effective>"` (cambia cuando cambia
 * cualquiera de los dos), evitando el antipatrón de snapshots no estables.
 *
 * Chrome del editor (P8): no afecta al sitio exportado. El fondo del área de
 * trabajo (`--pb-chrome-canvas-bg`) SÍ se oscurece en dark (docs/52 F4, D6 —
 * deroga la regla previa de esta sección, coherencia con el resto de
 * editores de Maildrill, que oscurecen su lienzo). El frame de la página
 * (`--pb-chrome-canvas-frame-bg`) sigue sin tocarse: ese representa el sitio
 * del usuario, con su propio tema (docs/11) — la derogación aplica solo al
 * área de trabajo alrededor, nunca al documento en sí.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readConfig, writeConfig, type ConfigMap } from "./useLocalConfig";

export type ThemeMode = ConfigMap["themeMode"];
export type EffectiveTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** ¿El SO prefiere oscuro? (SSR/jsdom-safe: false si no hay matchMedia) */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(DARK_QUERY).matches;
}

/** Resuelve el tema efectivo a partir del modo. */
export function resolveTheme(mode: ThemeMode): EffectiveTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

/**
 * Aplica `data-theme` al elemento raíz. Idempotente y SSR-safe. No-op si el
 * modo es host-controlled (docs/52 F7, I6) — el host gestiona el atributo.
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined" || hostControlled) return;
  document.documentElement.setAttribute("data-theme", resolveTheme(mode));
}

// ---------------------------------------------------------------------------
// Modo host-controlled (docs/52 F7, I6) — embebido en otra app
// ---------------------------------------------------------------------------

/**
 * Cuando `Builder42Editor` se monta con `themeMode="host"` (default en modo
 * embebido), el chrome NO debe escribir `data-theme` — el host ya lo
 * gestiona (con su propio atributo, hoy el mismo `data-theme`) y decide
 * cuándo cambia. Sin este flag, `ThemeToggle` (montado dentro de `Header`,
 * compartido con standalone) seguiría llamando `applyTheme` vía su propio
 * `useEffect` de sincronización, pisando lo que el host puso.
 *
 * `ThemeToggle` lee este flag para OCULTARSE en vez de mostrar un control
 * que no haría nada (docs/52 F7): no tiene sentido ofrecer un toggle de tema
 * de chrome si el tema lo decide el host.
 */
let hostControlled = false;

export function setThemeHostControlled(value: boolean): void {
  hostControlled = value;
  notify();
}

export function isThemeHostControlled(): boolean {
  return hostControlled;
}

// ---------------------------------------------------------------------------
// Store externo único
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** Snapshot estable: cambia si cambia el modo o el tema efectivo. */
function getSnapshot(): string {
  const mode = readConfig("themeMode");
  return `${mode}:${resolveTheme(mode)}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Cuando el SO cambia de preferencia (relevante en modo system), reaplicar
  // el tema y notificar a los consumidores.
  const unsubSystem = subscribeToSystem(() => {
    applyTheme(readConfig("themeMode"));
    notify();
  });
  return () => {
    listeners.delete(listener);
    unsubSystem();
  };
}

function subscribeToSystem(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * Cambia el modo de tema: persiste, aplica `data-theme` (no-op si
 * host-controlled) y notifica.
 */
export function setThemeMode(next: ThemeMode): void {
  writeConfig("themeMode", next);
  applyTheme(next);
  notify();
}

// ---------------------------------------------------------------------------
// Hook React
// ---------------------------------------------------------------------------

/**
 * Devuelve `[mode, effective, setMode, hostControlled]`. Mantiene
 * `data-theme` sincronizado con el modo y con la preferencia del SO (cuando
 * el modo es `system`) — salvo que `hostControlled` sea `true` (docs/52 F7,
 * I6), en cuyo caso el chrome no toca el DOM y deja que el host decida.
 */
export function useThemeMode(): [ThemeMode, EffectiveTheme, (next: ThemeMode) => void, boolean] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "system:light");
  const [mode, effective] = snapshot.split(":") as [ThemeMode, EffectiveTheme];

  // Asegurar que el DOM refleja el tema efectivo actual (montaje + cambios).
  // No-op si host-controlled — ver `applyTheme`.
  useEffect(() => {
    applyTheme(mode);
  }, [mode, effective]);

  const setMode = useCallback((next: ThemeMode) => setThemeMode(next), []);
  return [mode, effective, setMode, isThemeHostControlled()];
}
