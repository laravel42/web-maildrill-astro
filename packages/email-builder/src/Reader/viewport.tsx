import React, { createContext, useContext } from 'react';

export type Viewport = 'desktop' | 'mobile';

/**
 * Store-free viewport context for the email Reader.
 *
 * The reusable rendering package (`@eb/email-builder`) must resolve the
 * effective viewport WITHOUT reading the editor's Zustand store, so the
 * Node-safe HTML renderer can run in a plain Node process.
 *
 * - `Reader` provides the viewport it is rendering for (its `viewport`
 *   prop, defaulting to `'desktop'`). Block components read it via
 *   `useViewport()`.
 * - The editor composes ON TOP of this: its `useSelectedScreenSize`
 *   reads the live store value and the editor canvas provides it through
 *   this same context, so the user's viewport toggle keeps working.
 *
 * Default is `'desktop'` so any consumer rendering outside a provider
 * (e.g. a bare unit test) gets deterministic desktop output.
 */
export const ViewportContext = createContext<Viewport>('desktop');

export const ViewportProvider: React.FC<{
  value: Viewport;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>
);

/**
 * Read the effective viewport for the current render subtree.
 * Store-free — safe to call from Node (react-dom/server).
 */
export function useViewport(): Viewport {
  return useContext(ViewportContext);
}
