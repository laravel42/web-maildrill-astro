import { useCallback, useState } from 'react';

/**
 * Local "is this row live?" state for CMS-style tables. Each row keeps its
 * seeded default until the admin toggles it, after which the override wins.
 */
export function useLiveToggles() {
  const [state, setState] = useState<Record<string, boolean>>({});

  const isLive = useCallback(
    (key: string, fallback: boolean) => state[key] ?? fallback,
    [state],
  );

  const toggleLive = useCallback(
    (key: string, fallback: boolean) =>
      setState((s) => ({ ...s, [key]: !(s[key] ?? fallback) })),
    [],
  );

  return { isLive, toggleLive };
}

export type LiveToggles = ReturnType<typeof useLiveToggles>;
