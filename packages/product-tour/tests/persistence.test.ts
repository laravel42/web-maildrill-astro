import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalStoragePersistence } from '@/persistence';

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores state under the injected prefix, never a hardcoded default', () => {
    const persistence = createLocalStoragePersistence('custom-prefix:');
    persistence.markSeen('my-tour', 1);
    expect(localStorage.getItem('custom-prefix:my-tour')).not.toBeNull();
    expect(localStorage.getItem('eb:my-tour')).toBeNull();
    expect(localStorage.getItem('pb:my-tour')).toBeNull();
  });

  it('read returns the default (not seen) state when nothing is persisted', () => {
    const persistence = createLocalStoragePersistence('x:');
    const state = persistence.read('fresh-tour', 1);
    expect(state).toEqual({ seen: false, completed: false, version: 1 });
  });

  it('markSeen then read reflects seen=true under the same version', () => {
    const persistence = createLocalStoragePersistence('x:');
    persistence.markSeen('t', 3);
    const state = persistence.read('t', 3);
    expect(state.seen).toBe(true);
    expect(state.completed).toBe(false);
    expect(state.version).toBe(3);
  });

  it('markCompleted implies seen=true', () => {
    const persistence = createLocalStoragePersistence('x:');
    persistence.markCompleted('t', 1);
    const state = persistence.read('t', 1);
    expect(state.seen).toBe(true);
    expect(state.completed).toBe(true);
  });

  it('bumping the version resets seen/completed to false (re-offers the tour)', () => {
    const persistence = createLocalStoragePersistence('x:');
    persistence.markCompleted('t', 1);
    const stateAtOldVersion = persistence.read('t', 1);
    expect(stateAtOldVersion.completed).toBe(true);

    const stateAtNewVersion = persistence.read('t', 2);
    expect(stateAtNewVersion.seen).toBe(false);
    expect(stateAtNewVersion.completed).toBe(false);
    expect(stateAtNewVersion.version).toBe(2);
  });

  it('reset clears persisted state', () => {
    const persistence = createLocalStoragePersistence('x:');
    persistence.markCompleted('t', 1);
    persistence.reset('t');
    const state = persistence.read('t', 1);
    expect(state.seen).toBe(false);
  });

  it('two different prefixes for the same tourId do not collide', () => {
    const a = createLocalStoragePersistence('a:');
    const b = createLocalStoragePersistence('b:');
    a.markCompleted('shared-id', 1);
    expect(a.read('shared-id', 1).completed).toBe(true);
    expect(b.read('shared-id', 1).completed).toBe(false);
  });
});
