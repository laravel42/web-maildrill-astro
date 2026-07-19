import React, { useEffect, useState } from 'react';

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
