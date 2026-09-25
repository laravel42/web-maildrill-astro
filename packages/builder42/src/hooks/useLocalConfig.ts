/**
 * useLocalConfig — hook para persistir configuraciones del editor en localStorage.
 *
 * Todas las claves usan el prefijo `pb:` para evitar colisiones con otras apps
 * que compartan el mismo origin. El mapa `CONFIG_KEYS` centraliza las claves
 * válidas y sus valores por defecto, haciendo que el typecheck impida claves
 * inventadas o valores incorrectos.
 *
 * Uso:
 *   const [lang, setLang] = useLocalConfig("editorLang");
 *   // lee "pb:editorLang" de localStorage; si no hay, devuelve "es"
 *   setLang("en"); // persiste "pb:editorLang" = "en"
 *
 * Para acceso fuera de React (ej: i18n/index.ts que corre antes del render):
 *   import { readConfig, writeConfig } from "@/hooks/useLocalConfig";
 *   const lang = readConfig("editorLang"); // "es" | "en" | "it"
 */

import { useCallback, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Prefijo global — namespace del page builder en localStorage
// ---------------------------------------------------------------------------

const PREFIX = "pb:";

// ---------------------------------------------------------------------------
// Mapa de configuraciones: clave → tipo + default
// ---------------------------------------------------------------------------

/**
 * Registro de todas las configuraciones persistibles. Agregar una nueva es
 * declarar aquí su clave y valor por defecto — el hook y los helpers tipan
 * automáticamente.
 */
export interface ConfigMap {
  /** Idioma del editor: "es" | "en" | "it" */
  editorLang: "es" | "en" | "it";
  /** Modo de tema del chrome del editor (Fase 11.d) */
  themeMode: "system" | "light" | "dark";
  /** Prefijo del nombre de archivo de salida al guardar el sitio (Fase 19.i). */
  outputFilePrefix: string;
  /** Añadir marca de tiempo al nombre de archivo de salida (default: sí). */
  outputFileTimestamp: boolean;
  /** Prefijo del nombre del .zip del proyecto exportado (Fase 19.l, independiente). */
  outputZipPrefix: string;
  /** Añadir marca de tiempo al nombre del .zip (default: sí). */
  outputZipTimestamp: boolean;
  /**
   * Posición persistida de la burbuja de elementos no-visibles (docs/20 §5),
   * en px desde el borde superior-izquierdo del canvas. `x < 0` = aún sin
   * posicionar → se ancla por defecto (esquina inferior-izquierda vía CSS).
   */
  invisibleBubblePos: { x: number; y: number };
  /**
   * Visibilidad de los controles de reordenamiento por flechas (▲▼◀▶,
   * docs/24 §2.3) sobre el `SelectionHandle`: "auto" los muestra solo con
   * puntero "coarse" (`usePointerCoarse`, tablets/touch), "on"/"off" fuerza
   * mostrar/ocultar siempre, independiente del dispositivo.
   */
  reorderControls: "auto" | "on" | "off";
  /**
   * Modo del panel lateral izquierdo (Fase 11.10, homologación UI/UX fase B):
   * "open" muestra la paleta completa (categorías/acordeones); "compact" la
   * reduce a un riel angosto con solo los bloques esenciales/utilidades en
   * tiles verticales icon+label — mismo concepto que el rail compacto de
   * email-builder (`CompactBlocksList.tsx`, `COMPACT_LIBRARY_DRAWER_WIDTH`).
   * A propósito NO hay un tercer estado "colapsado a 0": el sidebar siempre
   * ocupa como mínimo el ancho compacto, nunca desaparece del todo.
   */
  sidebarMode: "compact" | "open";
  /** Panel inspector derecho colapsado (Fase 11.10). */
  inspectorCollapsed: boolean;
  /**
   * Nivel de experiencia de la UI: "simple" | "advanced". Bandera global
   * NUEVA e independiente del `uiComplexity` derogado en docs/41 (D1) — ese
   * solo afectaba el Inspector y fue eliminado por completo; este flag no lo
   * reintroduce ni revive ninguna de sus condicionales. El alcance concreto
   * (qué secciones de la UI cambian con cada valor) se define incrementalmente
   * fuera de este hook. Se pregunta una única vez vía `OnboardingExperienceModal`
   * al primer inicio (ver `experienceLevelChosen`) y luego se puede cambiar
   * desde `ProfileMenu` (`ExperienceLevelToggle`, junto a sistema de color y
   * controles de reordenamiento).
   */
  experienceLevel: "simple" | "advanced";
  /**
   * Si el usuario ya respondió el modal de onboarding de `experienceLevel`.
   * Mientras sea `false`, `OnboardingExperienceModal` se muestra al montar
   * `App`. Se separa de `experienceLevel` (en vez de usar `null` como
   * "sin elegir") para que el tipo de `experienceLevel` quede simple y
   * porque el valor por defecto de un usuario que nunca respondió no debe
   * confundirse con una elección explícita de "simple".
   */
  experienceLevelChosen: boolean;
  /**
   * Product tour (F4, docs/product-tour-driverjs-plan.md §4). Cableadas a la
   * persistencia por defecto de `@md/product-tour`
   * (`createLocalStoragePersistence`) a través del prefijo `pb:` que YA
   * inyecta este hook — el paquete `@md/product-tour` en sí no sabe nada de
   * `useLocalConfig` ni de este prefijo (§0.4): estas dos claves son solo el
   * espejo local que le permite a `app/tour/useBuilder42Tour.ts` decidir
   * cuándo auto-arrancar sin depender de un import cruzado.
   *
   * `tourSeen`: si el tour ya se ofreció (arrancó) al menos una vez, a la
   * versión persistida en `tourVersion`. `tourVersion`: versión bajo la que
   * se marcó `tourSeen` — un bump de la versión real del tour (constante en
   * `useBuilder42Tour.ts`) hace que `tourSeen` se trate como no visto de
   * nuevo (mismo criterio que `TourPersistenceState.version` del paquete).
   */
  tourSeen: boolean;
  tourVersion: number;
  /**
   * Si el usuario llegó al último paso y cerró con "Listo" (no con Escape/click fuera/×) —
   * espejo local de `TourPersistenceState.completed` (`@md/product-tour`'s `persistence.ts`).
   * Independiente de `tourSeen`: `tourSeen` se marca en CADA `start()` (incluida la primera
   * llamada, mucho antes de que el usuario llegue al final), así que derivar `completed` de
   * `seen` (como hacía antes este puente) reportaba el tour como completado desde el primer
   * paso — rompiendo la reanudación (`createTour.ts`'s `start()` solo reanuda desde
   * `lastStepIndex` cuando `seen && !completed`) y el auto-arranque tras un cierre a medias
   * (`shouldAutoStartTour` exige lo mismo). Bug real reportado: "el tour no persiste cuando
   * se queda a mitad del recorrido".
   */
  tourCompleted: boolean;
  /**
   * Índice (0-based) del último paso del tour que el usuario llegó a ver antes de un cierre
   * sin completar (Escape, click en el overlay, ×, cierre de pestaña) — espejo local de
   * `TourPersistenceState.lastStepIndex` (`@md/product-tour`'s `persistence.ts`), mismo
   * motivo que `tourSeen`/`tourVersion` arriba: permite reanudar desde ahí en vez de reiniciar
   * siempre en el paso 0. `-1` = sin progreso guardado (equivalente a `undefined` en el tipo
   * del paquete — `useLocalConfig` no admite `undefined` como valor persistido).
   */
  tourLastStepIndex: number;
}

const DEFAULTS: ConfigMap = {
  editorLang: "es",
  themeMode: "system",
  outputFilePrefix: "page",
  outputFileTimestamp: true,
  outputZipPrefix: "page",
  outputZipTimestamp: true,
  invisibleBubblePos: { x: -1, y: -1 },
  reorderControls: "auto",
  sidebarMode: "open",
  inspectorCollapsed: false,
  experienceLevel: "advanced",
  experienceLevelChosen: false,
  tourSeen: false,
  tourVersion: 0,
  tourCompleted: false,
  tourLastStepIndex: -1,
};

// ---------------------------------------------------------------------------
// Helpers puros (usables fuera de React)
// ---------------------------------------------------------------------------

function storageKey<K extends keyof ConfigMap>(key: K): string {
  return `${PREFIX}${key}`;
}

/** Lee una configuración de localStorage (o devuelve el default si no existe). */
export function readConfig<K extends keyof ConfigMap>(key: K): ConfigMap[K] {
  const fallback = DEFAULTS[key];
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(storageKey(key));
  if (raw === null) return fallback;
  // Valores booleanos: se persisten como "true"/"false" (via String()).
  if (typeof fallback === "boolean") {
    return (raw === "true") as ConfigMap[K];
  }
  // Valores numéricos (p. ej. `tourVersion`): `writeConfig` los persiste con
  // `String()` como cualquier escalar no-objeto — sin este branch se leerían
  // de vuelta como string, rompiendo comparaciones `=== number` en quien
  // consume la clave (ver `createConfigBackedTourPersistence`, F4).
  if (typeof fallback === "number") {
    const parsed = Number(raw);
    return (Number.isNaN(parsed) ? fallback : parsed) as ConfigMap[K];
  }
  // Valores objeto: se persisten como JSON; se parsean con fallback seguro.
  if (typeof fallback === "object" && fallback !== null) {
    try {
      return JSON.parse(raw) as ConfigMap[K];
    } catch {
      return fallback;
    }
  }
  return raw as ConfigMap[K];
}

/**
 * Escribe una configuración en localStorage y **notifica** a todas las
 * instancias de `useLocalConfig` suscritas a esa clave.
 *
 * La notificación vive aquí (y no solo en el setter del hook) porque es lo que
 * el bloque de abajo documenta —"listeners notificados en cada `writeConfig`"—
 * y porque `writeConfig` es API exportada: quien la llama desde fuera de React
 * (`LanguageSelect`, `OnboardingExperienceModal`, `useThemeMode`, tests) espera
 * que un componente ya montado que lee la misma clave se actualice. Sin esto,
 * escribir después de montar dejaba la UI congelada hasta un remount — el
 * mismo antipatrón que el bloque de abajo dice haber corregido.
 */
export function writeConfig<K extends keyof ConfigMap>(key: K, value: ConfigMap[K]): void {
  if (typeof localStorage === "undefined") return;
  const serialized = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  localStorage.setItem(storageKey(key), serialized);
  notify(key);
}

// ---------------------------------------------------------------------------
// Store externo compartido (bug real, feedback de usuario): antes cada
// instancia de `useLocalConfig` guardaba su propio `useState` inicializado
// SOLO al montar, sin ningún mecanismo de sincronización entre instancias —
// el antipatrón que AGENTS.md §5.4 pide evitar. Cambiar una preferencia desde
// un componente (p. ej. `ReorderControlsToggle` en el `ProfileMenu`) NO se
// reflejaba en otro que ya estuviera montado leyendo la misma clave (p. ej.
// `SelectionHandle`, vía `useReorderControlsVisible`) hasta desmontar y
// remontar — el toggle "on/off" parecía no tener efecto en vivo. Mismo patrón
// que `useThemeMode.ts`: un `Set` de listeners POR CLAVE, notificados en cada
// `writeConfig`, consumidos con `useSyncExternalStore` para snapshots
// estables y sincronía entre TODAS las instancias que leen la misma clave.
// ---------------------------------------------------------------------------

const listenersByKey = new Map<keyof ConfigMap, Set<() => void>>();

function getListeners(key: keyof ConfigMap): Set<() => void> {
  let set = listenersByKey.get(key);
  if (!set) {
    set = new Set();
    listenersByKey.set(key, set);
  }
  return set;
}

function notify(key: keyof ConfigMap): void {
  for (const l of getListeners(key)) l();
}

/**
 * Suscribe `listener` a las notificaciones de una clave sin pasar por React —
 * mismo `Set` de listeners que consume el hook (`getListeners`), expuesto para
 * callers que corren fuera del árbol de componentes (p. ej. el `before()` de un
 * paso del tour guiado, o un test que quiere comprobar que `writeConfig` notificó
 * de verdad y no solo persistió el valor). Devuelve la función de "unsubscribe".
 */
export function subscribeConfig<K extends keyof ConfigMap>(key: K, listener: () => void): () => void {
  const listeners = getListeners(key);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cache de snapshot por clave (bug real, feedback de usuario: "Maximum update
// depth exceeded" / "getSnapshot should be cached"). `useSyncExternalStore`
// exige que `getSnapshot` devuelva la MISMA referencia si el valor no cambió
// — para los tipos escalares (string/boolean) eso ya es cierto por igualdad
// primitiva, pero `invisibleBubblePos` es un OBJETO: `readConfig` lo
// reconstruye con `JSON.parse` en CADA llamada, devolviendo una referencia
// nueva aunque el contenido sea idéntico. React detectaba "cambió" en cada
// render, volvía a suscribirse, y entraba en loop infinito. Se cachea la
// última referencia devuelta por clave, comparando por valor serializado
// (`JSON.stringify`) — solo se crea un objeto nuevo cuando el contenido
// realmente cambió.
const snapshotCache = new Map<keyof ConfigMap, { raw: string; value: unknown }>();

function getCachedSnapshot<K extends keyof ConfigMap>(key: K): ConfigMap[K] {
  const value = readConfig(key);
  // Escalares (string/boolean): comparación por igualdad primitiva basta, el
  // cache no aporta nada pero tampoco molesta — se simplifica igual para
  // todos los tipos con una única ruta.
  const raw = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.value as ConfigMap[K];
  }
  snapshotCache.set(key, { raw, value });
  return value;
}

// ---------------------------------------------------------------------------
// Hook React
// ---------------------------------------------------------------------------

/**
 * Hook para leer y escribir una configuración del editor con persistencia en
 * localStorage. Todas las instancias que leen la MISMA clave se mantienen
 * sincronizadas en vivo (store externo compartido, arriba) — cambiar el valor
 * desde cualquier componente se refleja de inmediato en los demás, sin
 * necesidad de desmontar/remontar.
 */
export function useLocalConfig<K extends keyof ConfigMap>(
  key: K,
): [ConfigMap[K], (value: ConfigMap[K]) => void] {
  const value = useSyncExternalStore(
    useCallback((listener) => {
      const listeners = getListeners(key);
      listeners.add(listener);
      return () => listeners.delete(listener);
    }, [key]),
    useCallback(() => getCachedSnapshot(key), [key]),
    useCallback(() => DEFAULTS[key], [key]),
  );

  const set = useCallback(
    (next: ConfigMap[K]) => {
      // `writeConfig` ya notifica a los listeners de la clave.
      writeConfig(key, next);
    },
    [key],
  );

  return [value, set];
}
