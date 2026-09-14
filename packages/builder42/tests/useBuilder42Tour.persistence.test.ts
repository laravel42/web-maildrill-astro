/**
 * useBuilder42Tour.persistence.test.ts — F4 acceptance criteria
 * (docs/product-tour-driverjs-plan.md §4), exercised at the level this package's
 * `environment: "node"` vitest config (no jsdom/happy-dom, see
 * `tour-anchors-coverage.test.ts`'s own precedent/rationale) can actually run without
 * adding a new dependency:
 *   - First offer marks `tourSeen`/`tourVersion` (mirrors "primer arranque ofrece el
 *     tour una vez").
 *   - "Already seen" persists across a fresh read (mirrors "reload").
 *   - Bumping the tour version re-offers it to someone who already saw a previous one.
 *
 * `createConfigBackedTourPersistence()` is the REAL bridge `useBuilder42Tour` wires to
 * `createTour({ persistence })` — this test exercises it directly (not a re-implementation),
 * through the real `readConfig`/`writeConfig` from `useLocalConfig.ts`, backed by a minimal
 * in-memory `Storage` polyfill (plain JS, no dependency) assigned to `globalThis.localStorage`
 * for the duration of the suite — Node has no `localStorage` global by default.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createConfigBackedTourPersistence } from "@/app/tour/useBuilder42Tour";
import { readConfig } from "@/hooks/useLocalConfig";

/** Minimal `Storage` implementation — no dependency, just enough for `useLocalConfig`. */
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

describe("createConfigBackedTourPersistence — F4 acceptance", () => {
  it("read() reports unseen before anything is marked", () => {
    const persistence = createConfigBackedTourPersistence();
    expect(persistence.read("builder42", 1)).toEqual({
      seen: false,
      completed: false,
      version: 1,
    });
  });

  it("markSeen() persists tourSeen=true and tourVersion under useLocalConfig's own keys", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);

    expect(readConfig("tourSeen")).toBe(true);
    expect(readConfig("tourVersion")).toBe(1);
    expect(persistence.read("builder42", 1).seen).toBe(true);
  });

  it('"already seen" persists across a fresh read (mirrors a reload)', () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);

    // A brand new persistence instance, reading the same (fake) localStorage —
    // equivalent to a fresh page load re-creating the tour controller.
    const afterReload = createConfigBackedTourPersistence();
    expect(afterReload.read("builder42", 1).seen).toBe(true);
  });

  it("bumping the tour version re-offers it to someone who already saw a previous version", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);
    expect(persistence.read("builder42", 1).seen).toBe(true);

    // Version bump (2): stale persisted version reads back as unseen.
    expect(persistence.read("builder42", 2).seen).toBe(false);
  });

  it("markCompleted() also marks seen + persists the version", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markCompleted("builder42", 3);
    expect(readConfig("tourSeen")).toBe(true);
    expect(readConfig("tourVersion")).toBe(3);
    const state = persistence.read("builder42", 3);
    expect(state.seen).toBe(true);
    expect(state.completed).toBe(true);
  });

  it("reset() clears tourSeen so the tour can be offered again", () => {
    const persistence = createConfigBackedTourPersistence();
    persistence.markSeen("builder42", 1);
    expect(persistence.read("builder42", 1).seen).toBe(true);

    persistence.reset("builder42");
    expect(readConfig("tourSeen")).toBe(false);
    expect(persistence.read("builder42", 1).seen).toBe(false);
  });
});
