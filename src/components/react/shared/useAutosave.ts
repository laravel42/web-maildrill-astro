import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveStatus } from './EditorHeader';

/**
 * Draft autosave. Call `markDirty()` whenever the draft changes; every
 * `interval` ms (default 5s) the hook runs `save()` if there are pending
 * changes and reflects progress in `status` ('saving' → 'saved'). `flush()`
 * saves immediately (used by the manual Save button). A failed save keeps the
 * draft dirty so the next tick retries.
 */
export function useAutosave(save: () => Promise<void> | void, interval = 5000) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const markDirty = useCallback(() => {
    dirty.current = true;
    // Editing after a save makes the draft dirty again, so stop reporting
    // "saved" — otherwise the header keeps claiming a saved state while the
    // user types. A save already in flight is left alone.
    setStatus((s) => (s === 'saved' ? 'idle' : s));
  }, []);

  const run = useCallback(async (force: boolean): Promise<boolean> => {
    if (inFlight.current) return false;
    if (!force && !dirty.current) return false;
    inFlight.current = true;
    dirty.current = false;
    setStatus('saving');
    try {
      await saveRef.current();
      setStatus('saved');
      return true;
    } catch {
      dirty.current = true;
      setStatus('idle');
      return false;
    } finally {
      inFlight.current = false;
    }
  }, []);

  const flush = useCallback(() => run(true), [run]);

  useEffect(() => {
    const id = window.setInterval(() => void run(false), interval);
    return () => window.clearInterval(id);
  }, [interval, run]);

  return { status, markDirty, flush };
}
