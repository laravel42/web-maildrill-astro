/**
 * hoverPreviewStore — minimal Zustand atom that powers the singleton
 * `LibraryHoverPreviewPortal`. Centralises:
 *
 *   - The currently active hover descriptor (or `null`).
 *   - The open / close timers (one global pair, not one per card).
 *
 * Why a store instead of per-card state: the previous implementation
 * kept timing + Popper anchor inside each card via `useHoverPreview`
 * and mounted a `<LibraryCardHoverPreview>` per card. With many cards
 * that meant N popovers and N HTML buffers. Centralising lets us mount
 * a SINGLE iframe (in `LibraryHoverPreviewPortal`) and reuse it across
 * hovers — memory becomes O(1) regardless of how many cards exist.
 *
 * The store exposes imperative setters (`requestHoverEnter`,
 * `requestHoverLeave`, `cancelClose`) and a `useActiveHoverPreview`
 * hook for the singleton component to subscribe.
 */

import { useSyncExternalStore } from 'react';

/** Discriminator + payload describing what the active hover should preview. */
export type HoverPreviewDescriptor = {
  /** DOM element to anchor the Popper to. */
  anchor: HTMLElement;
  category: 'section' | 'layout' | 'primitive' | 'template' | 'theme';
  /** Axis value (role/type/shape); empty string for templates/themes. */
  axis: string;
  /** Stable id of the saved item. */
  id: string;
  /** Display name shown in the popper title. */
  name: string;
  /** For primitives: the inlined block payload from /dev/primitives (avoids fetch). */
  primitiveBlock?: unknown;
  /** For themes: the inlined theme bundle from /dev/themes. */
  themeBundle?: {
    globals?: Record<string, unknown>;
    blocks?: Record<string, Record<string, unknown>>;
  };
};

/** Delay before opening the popper after the cursor enters a card. */
const HOVER_OPEN_DELAY_MS = 400;

/** Delay before closing the popper after the cursor leaves the card or popper. */
const HOVER_CLOSE_DELAY_MS = 300;

type HoverState = {
  active: HoverPreviewDescriptor | null;
};

let state: HoverState = { active: null };
const listeners = new Set<() => void>();
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function setState(next: HoverState): void {
  if (next.active === state.active) return;
  state = next;
  for (const listener of listeners) listener();
}

function getSnapshot(): HoverState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearOpenTimer(): void {
  if (openTimer !== null) {
    clearTimeout(openTimer);
    openTimer = null;
  }
}

function clearCloseTimer(): void {
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

/**
 * Cards call this on `onMouseEnter`. If the cursor leaves card A and
 * enters card B before the close fires, we reuse the same Popper
 * (anchor swaps) so the user never sees a flicker.
 */
export function requestHoverEnter(descriptor: HoverPreviewDescriptor): void {
  clearCloseTimer();
  // If a popper is already open (cursor moved between cards), swap
  // descriptor immediately — the open delay only applies when nothing
  // is currently shown.
  if (state.active !== null) {
    setState({ active: descriptor });
    clearOpenTimer();
    return;
  }
  clearOpenTimer();
  openTimer = setTimeout(() => {
    openTimer = null;
    setState({ active: descriptor });
  }, HOVER_OPEN_DELAY_MS);
}

/** Cards call this on `onMouseLeave`. */
export function requestHoverLeave(): void {
  clearOpenTimer();
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    closeTimer = null;
    setState({ active: null });
  }, HOVER_CLOSE_DELAY_MS);
}

/**
 * The popper's own `onMouseEnter` calls this so the cursor can travel
 * from the card onto the popper without triggering a close.
 */
export function cancelHoverClose(): void {
  clearCloseTimer();
}

/**
 * Hard reset — used when the drawer closes or unmounts so we don't
 * fire a delayed open while the user has already navigated away.
 */
export function resetHoverPreview(): void {
  clearOpenTimer();
  clearCloseTimer();
  setState({ active: null });
}

/** Subscribe to the active descriptor (singleton component uses this). */
export function useActiveHoverPreview(): HoverPreviewDescriptor | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).active;
}
