import { useEffect } from 'react';

/**
 * Calls `onClose` when the user presses Escape while a modal/drawer/overlay is
 * mounted. Shared by every editor and detail drawer.
 */
export function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
