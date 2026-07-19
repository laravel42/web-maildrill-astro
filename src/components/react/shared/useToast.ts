import { useCallback, useState } from 'react';

/**
 * Transient toast state shared by workspace screens: `show(msg)` displays a
 * message that auto-clears after `duration` ms.
 */
export function useToast(duration = 2800): {
  toast: string | null;
  show: (msg: string) => void;
} {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback(
    (msg: string) => {
      setToast(msg);
      window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), duration);
    },
    [duration],
  );
  return { toast, show };
}
