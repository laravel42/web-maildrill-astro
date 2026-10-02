/**
 * persistence.ts — estado "visto/completado" por tour, versionado.
 *
 * Agnóstico de host (§0.4 del plan): el prefijo de `localStorage` es un parámetro obligatorio
 * del consumidor, nunca un default fijo. Así el mismo código sirve para EmailBuilder (`eb:`),
 * Builder42 dentro de Maildrill (`pb:`), y Builder42 el día que se extraiga como proyecto
 * independiente para la landing — con el prefijo que ese nuevo host decida, sin tocar esta
 * lógica.
 */

export interface TourPersistenceState {
  /** El usuario llegó al menos una vez a arrancar este tour (visto, completo o no). */
  seen: boolean;
  /** El usuario llegó al último paso y cerró con "Listo" (no con Escape/click fuera). */
  completed: boolean;
  /** Versión del tour bajo la que se marcó `seen`/`completed`. */
  version: number;
  /**
   * Índice (0-based, sobre los `driveSteps` elegibles de la corrida que lo guardó) del
   * último paso que el usuario llegó a VER (`onHighlighted`) antes de que el tour se
   * cerrara sin completarse — Escape, click en el overlay, ×, recarga de página. `undefined`
   * si el tour nunca arrancó, o si ya se completó (`markCompleted` lo limpia: un tour
   * completado no tiene "progreso a medias" que reanudar). Permite que `start()` reanude
   * desde ahí en vez de reiniciar siempre en el paso 0 cuando el usuario vuelve a abrir el
   * editor tras un cierre accidental.
   */
  lastStepIndex?: number;
}

const DEFAULT_STATE: TourPersistenceState = { seen: false, completed: false, version: 0 };

export interface TourPersistence {
  /**
   * Lee el estado persistido para `tourId`, comparado contra `currentVersion`. Si la versión
   * persistida es distinta de `currentVersion`, el estado se trata como no visto — un bump de
   * versión del tour vuelve a ofrecerlo (§ criterio de aceptación F4 del plan).
   */
  read(tourId: string, currentVersion: number): TourPersistenceState;
  /** Marca el tour como visto (arrancado), bajo `currentVersion`. */
  markSeen(tourId: string, currentVersion: number): void;
  /** Marca el tour como completado (llegó al final), bajo `currentVersion`. Limpia `lastStepIndex` — un tour completado no tiene progreso a medias que reanudar. */
  markCompleted(tourId: string, currentVersion: number): void;
  /**
   * Guarda `stepIndex` como el último paso visto, bajo `currentVersion` — llamado en cada
   * `tour_step_viewed` (ver `createTour.ts`'s `onHighlighted`). Sobrescribe cualquier
   * `lastStepIndex` previo: solo importa el más reciente.
   */
  saveProgress(tourId: string, stepIndex: number, currentVersion: number): void;
  /** Borra el estado persistido de `tourId` (útil para "ver de nuevo" / testing). */
  reset(tourId: string): void;
}

/**
 * Crea una implementación de `TourPersistence` sobre `localStorage`, con claves bajo
 * `${prefix}${tourId}`. `prefix` es obligatorio y queda enteramente a discreción del
 * consumidor — este paquete no asume ninguna convención de namespacing.
 *
 * Si `localStorage` no está disponible (SSR, entornos restringidos), degrada a un
 * almacenamiento en memoria que no persiste entre sesiones, sin lanzar.
 */
export function createLocalStoragePersistence(prefix: string): TourPersistence {
  const memoryFallback = new Map<string, TourPersistenceState>();
  const storage = getStorage();

  const key = (tourId: string) => `${prefix}${tourId}`;

  return {
    read(tourId, currentVersion) {
      const raw = storage ? storage.getItem(key(tourId)) : null;
      const parsed = raw ? safeParse(raw) : memoryFallback.get(key(tourId)) ?? null;
      if (!parsed || parsed.version !== currentVersion) return { ...DEFAULT_STATE, version: currentVersion };
      return parsed;
    },
    markSeen(tourId, currentVersion) {
      const state: TourPersistenceState = {
        ...this.read(tourId, currentVersion),
        seen: true,
        version: currentVersion,
      };
      write(storage, memoryFallback, key(tourId), state);
    },
    markCompleted(tourId, currentVersion) {
      // Un tour completado no tiene "progreso a medias" que reanudar — limpia
      // `lastStepIndex` explícitamente (en vez de dejar el valor del `read()` previo) para que
      // un futuro `reset()` + relanzamiento no herede un índice de una corrida ya terminada.
      const { lastStepIndex, ...rest } = this.read(tourId, currentVersion);
      void lastStepIndex;
      const state: TourPersistenceState = {
        ...rest,
        seen: true,
        completed: true,
        version: currentVersion,
      };
      write(storage, memoryFallback, key(tourId), state);
    },
    saveProgress(tourId, stepIndex, currentVersion) {
      const state: TourPersistenceState = {
        ...this.read(tourId, currentVersion),
        seen: true,
        version: currentVersion,
        lastStepIndex: stepIndex,
      };
      write(storage, memoryFallback, key(tourId), state);
    },
    reset(tourId) {
      storage?.removeItem(key(tourId));
      memoryFallback.delete(key(tourId));
    },
  };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Acceso a localStorage puede lanzar en contextos con almacenamiento bloqueado
    // (navegación privada estricta, políticas de cookies de terceros, etc.).
    return null;
  }
}

function safeParse(raw: string): TourPersistenceState | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      typeof value === 'object' &&
      value !== null &&
      'seen' in value &&
      'completed' in value &&
      'version' in value
    ) {
      return value as TourPersistenceState;
    }
    return null;
  } catch {
    return null;
  }
}

function write(
  storage: Storage | null,
  fallback: Map<string, TourPersistenceState>,
  key: string,
  state: TourPersistenceState,
): void {
  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(state));
      return;
    } catch {
      // Cuota excedida u otro fallo de escritura: cae al fallback en memoria.
    }
  }
  fallback.set(key, state);
}
