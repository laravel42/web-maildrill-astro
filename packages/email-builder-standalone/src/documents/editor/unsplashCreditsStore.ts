/**
 * Ephemeral Zustand store for Unsplash photo credits.
 *
 * This store is intentionally **separate** from the document state so that
 * credit metadata never leaks into the exported JSON/HTML. It lives only in
 * memory (optionally persisted to localStorage for refresh survival) and is
 * consumed by the side panel credit chip and canvas overlay.
 */
import { create } from 'zustand';

export interface UnsplashCredit {
  photoId: string;
  photographerName: string;
  photographerUrl: string;
  unsplashUrl: string;
}

interface UnsplashCreditsState {
  credits: Record<string, UnsplashCredit>;
}

export const unsplashCreditsStore = create<UnsplashCreditsState>(() => ({
  credits: {},
}));

export function setUnsplashCredit(blockId: string, credit: UnsplashCredit): void {
  unsplashCreditsStore.setState((s) => ({
    credits: { ...s.credits, [blockId]: credit },
  }));
}

export function clearUnsplashCredit(blockId: string): void {
  unsplashCreditsStore.setState((s) => {
    const { [blockId]: _, ...rest } = s.credits;
    return { credits: rest };
  });
}

export function useUnsplashCredit(blockId: string | null | undefined): UnsplashCredit | null {
  return unsplashCreditsStore((s) => (blockId ? (s.credits[blockId] ?? null) : null));
}
