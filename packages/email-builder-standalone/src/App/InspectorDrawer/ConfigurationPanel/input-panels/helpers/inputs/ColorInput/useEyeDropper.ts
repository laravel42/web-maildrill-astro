import './eyedropper.types';

import { useCallback, useRef } from 'react';

const isSupported = () => typeof window !== 'undefined' && 'EyeDropper' in window;

export function useEyeDropper() {
  const abortRef = useRef<AbortController | null>(null);

  const pick = useCallback(async (): Promise<string | null> => {
    if (!isSupported()) return null;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const dropper = new window.EyeDropper!();
      const { sRGBHex } = await dropper.open({ signal: controller.signal });
      return sRGBHex;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    } finally {
      abortRef.current = null;
    }
  }, []);

  return { supported: isSupported(), pick };
}
