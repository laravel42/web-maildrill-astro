import React, { useEffect, useState } from 'react';

/**
 * Renders children only after the component has mounted on the client.
 * On the server / in a Node render (`typeof window === 'undefined'`) it
 * renders nothing on the first pass.
 *
 * Local copy in `@eb/document-core` so `buildBlockComponent` does not
 * depend on the editor app (`email-builder-standalone`) — keeping the
 * package consumable from the Node-safe renderer.
 */
export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const isBrowser = typeof window !== 'undefined';
  const [isClient, setIsClient] = useState(isBrowser);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return <>{children}</>;
}
