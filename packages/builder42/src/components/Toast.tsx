/**
 * Toast — primitivo de notificación transitoria del CHROME del editor
 * (docs/46 Fase 1, H1). Verificado antes de construirlo (AGENTS.md §5.2
 * paso 1): `@josecortez1/c42-react` no ofrece toast/snackbar (su
 * `dist/index.d.ts` no declara nada parecido) y el chrome tampoco tiene
 * ninguno hoy — lo único similar es `canvas/reorderAnnouncer.ts`, una live
 * region de anuncios para lectores de pantalla sin acción ni UI visible. Por
 * eso este componente se crea como componente de proyecto y se re-exporta
 * desde `src/components/index.ts` (P10, excepción documentada en §5.2: no
 * hay primitivo c42 equivalente que envolver).
 *
 * No es un sistema de cola/gestor global: expone el primitivo de UI
 * (`Toast`) + un hook mínimo de un solo slot (`useToast`) para el caso real
 * de esta fase (un toast de "Deshacer" a la vez tras borrar un nodo). Un
 * gestor con cola de N toasts simultáneos queda fuera de alcance hasta que
 * haya un segundo consumidor real que lo necesite.
 *
 * Accesibilidad: `role="status"` + `aria-live="polite"` (anuncio no
 * disruptivo, no `alert`/`assertive` — no es un error). Cierre automático
 * con temporizador (pausado mientras el usuario tiene el foco o el puntero
 * encima, para no cerrarlo mientras interactúa) y botón de acción alcanzable
 * por teclado. La entrada/salida usa `framer-motion` (asset de animación,
 * excepción a P10 ya documentada en AGENTS.md §5.2) — respeta
 * `prefers-reduced-motion` a través del `<MotionConfig reducedMotion="user">`
 * que envuelve `App.tsx`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

const DEFAULT_DURATION_MS = 6000;

export interface ToastState {
  /** Texto principal del toast. */
  message: string;
  /** Etiqueta del botón de acción (ej. "Deshacer"). Sin acción si se omite. */
  actionLabel?: string;
  /** Callback de la acción. El toast se cierra solo tras invocarla (ver `handleAction`). */
  onAction?: () => void;
  /** Duración en ms antes del cierre automático. Default 6000. */
  durationMs?: number;
}

export interface ToastProps extends ToastState {
  onClose: () => void;
}

/**
 * Presentacional: un solo toast, ya "visible" mientras esté montado (igual
 * patrón que `SimpleModal` — el caller controla la presencia condicionalmente).
 */
export function Toast({ message, actionLabel, onAction, durationMs = DEFAULT_DURATION_MS, onClose }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const remainingRef = useRef(durationMs);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(onClose, remainingRef.current);
  }, [clearTimer, onClose]);

  useEffect(() => {
    remainingRef.current = durationMs;
    scheduleClose();
    return clearTimer;
    // Solo se re-programa si cambia la duración pedida; onClose se asume estable por render de toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  function handleAction() {
    onAction?.();
    onClose();
  }

  return createPortal(
    <div
      className="pbx-toast-viewport"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <motion.div
        role="status"
        aria-live="polite"
        className="pbx-toast"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <span className="pbx-toast__message">{message}</span>
        {actionLabel ? (
          <button type="button" className="pbx-toast__action" onClick={handleAction}>
            {actionLabel}
          </button>
        ) : null}
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * Wrapper con `AnimatePresence` para que el caller pueda montar/desmontar el
 * `Toast` con salida animada. Uso: `<ToastHost toast={toastState} onClose={...} />`.
 */
export function ToastHost({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {toast ? (
        <Toast
          key={toast.message}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          durationMs={toast.durationMs}
          onClose={onClose}
        />
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Hook de un solo slot: `show(state)` reemplaza cualquier toast visible
 * (no hay cola — fuera de alcance, ver comentario de cabecera). `hide()` lo
 * cierra manualmente si el caller lo necesita (p. ej. al desmontar el nodo
 * padre).
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((state: ToastState) => setToast(state), []);
  const hide = useCallback(() => setToast(null), []);

  return { toast, show, hide };
}
