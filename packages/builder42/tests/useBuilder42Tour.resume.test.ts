/**
 * useBuilder42Tour.resume.test.ts — regression test for the reported defect: "el tour no
 * persiste cuando se queda a mitad del recorrido" / "no persiste [tras] cerrar o recargar,
 * debería continuar desde el step guardado al presionar el botón del tour".
 *
 * Root cause: `createConfigBackedTourPersistence().read()` derived `completed` from `seen`
 * (`completed: seen`) instead of tracking real completion. `markSeen()` runs on every
 * `start()` — including the very first call, long before the user reaches the last step —
 * so `tourSeen` flips to `true` immediately and `read()` reported `completed: true` from
 * step 0 onward. `createTour.ts`'s own `start()` only resumes from `lastStepIndex` when
 * `persistedState.seen && !persistedState.completed` — with `completed` always mirroring
 * `seen`, that condition could never be true, so every relaunch (auto-start on reload, or
 * the "restart tour" button) silently restarted at step 0 no matter what `tourLastStepIndex`
 * held.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createConfigBackedTourPersistence } from "@/app/tour/useBuilder42Tour";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage();
});

describe("createConfigBackedTourPersistence — progreso persistido a medias (regresión)", () => {
  it("saveProgress() + a later read() (simulating reload) reports the saved lastStepIndex", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);
    persistence.saveProgress("builder42", 2, 1);

    // Fresh instance, same (fake) localStorage — mirrors a page reload.
    const afterReload = createConfigBackedTourPersistence();
    const state = afterReload.read("builder42", 1);
    expect(state.lastStepIndex).toBe(2);
  });

  it("a tour that only started (markSeen) but never completed must NOT read back as completed", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);
    persistence.saveProgress("builder42", 1, 1);

    const state = persistence.read("builder42", 1);
    // This is the actual regression: completion must be tracked independently of "seen" —
    // `markSeen()` alone (start of the tour) must never imply `completed`.
    expect(state.completed).toBe(false);
    expect(state.lastStepIndex).toBe(1);
  });

  it("markCompleted() (Done button) reports completed=true and clears lastStepIndex", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);
    persistence.saveProgress("builder42", 2, 1);
    persistence.markCompleted("builder42", 1);

    const state = persistence.read("builder42", 1);
    expect(state.completed).toBe(true);
    expect(state.lastStepIndex).toBeUndefined();
  });
});
