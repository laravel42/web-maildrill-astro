import React, { useEffect, useMemo, useRef, useState } from 'react';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';

/**
 * Context that exposes the shadow root container so MUI portals
 * (Popover, Menu, Modal, Popper) render inside the shadow DOM.
 */
export const ShadowContainerContext = React.createContext<HTMLElement | undefined>(undefined);

/**
 * Hook to get the shadow container for MUI portal props.
 * Returns undefined when not inside a shadow DOM (portals use document.body as usual).
 */
export function useShadowContainer(): HTMLElement | undefined {
  return React.useContext(ShadowContainerContext);
}

interface ShadowDomProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps children with Emotion cache targeting the shadow root and provides
 * the container reference for MUI portals.
 *
 * Must be rendered inside a shadow DOM (r2wc with shadow: 'open').
 */
export function ShadowDomProvider({ children }: ShadowDomProviderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.getRootNode();
    if (root instanceof ShadowRoot) {
      setContainer(root as unknown as HTMLElement);
    } else if (import.meta.env.DEV) {
      console.error(
        '[ShadowDomProvider] Expected to be mounted inside a ShadowRoot. ' +
          'Styles will not be encapsulated. Check r2wc shadow config.'
      );
    }
  }, []);

  const emotionCache = useMemo(() => {
    if (!container) return null;
    return createCache({ key: 'eb', container });
  }, [container]);

  if (!container || !emotionCache) {
    // First render: mount a ref node to detect shadow root
    return <div ref={ref} style={{ display: 'contents' }} />;
  }

  return (
    <CacheProvider value={emotionCache}>
      <ShadowContainerContext.Provider value={container}>{children}</ShadowContainerContext.Provider>
    </CacheProvider>
  );
}
