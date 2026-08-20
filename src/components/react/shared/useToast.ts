import { useCallback, useState } from 'react';

/** Success (default) or a failure/attention message. */
export type ToastTone = 'success' | 'alert';

/**
 * Transient toast state shared by workspace screens: `show(msg)` displays a
 * message that auto-clears after `duration` ms. Pass a tone as the second
 * argument when the message reports a failure or an unfinished state, so the
 * host can render it as an alert rather than a checkmark.
 */
export function useToast(duration = 2800): {
  toast: string | null;
  tone: ToastTone;
  show: (msg: string, tone?: ToastTone) => void;
} {
  const [toast, setToast] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>('success');
  const show = useCallback(
    (msg: string, nextTone: ToastTone = 'success') => {
      setToast(msg);
      setTone(nextTone);
      window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), duration);
    },
    [duration],
  );
  return { toast, tone, show };
}
