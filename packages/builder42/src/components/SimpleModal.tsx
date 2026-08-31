/**
 * SimpleModal — modal de chrome StrictMode-safe (bug real, feedback de
 * usuario: "aparece un modal pero se cierra al instante"/"los templates no se
 * insertan"). El `Modal` de `@josecortez1/c42-react` (P10) construye su
 * controller headless con side effects DENTRO de un `useLayoutEffect`
 * (`new Modal(root, { defaultOpen: true })` — abre synchronamente en el
 * constructor). Confirmado con un repro aislado: cuando ese `<Modal>` se
 * monta como resultado de una actualización de estado POSTERIOR al montaje
 * inicial (exactamente el patrón de "click en una tarjeta → aparece el
 * modal"), bajo `React.StrictMode` (activo en `main.tsx` de producción) el
 * doble-invocado de efectos de montaje deja el estado de React que activó el
 * modal revertido — un `<div>` plano en el mismo punto sí sobrevive, así que
 * el defecto es específico del controller imperativo de `Modal`, no de
 * nuestro código. No hay forma de arreglarlo desde fuera del paquete (no
 * expone ref/API imperativa alternativa a `defaultOpen`).
 *
 * Este componente reimplementa el subconjunto de UX que estos dos usos
 * (`PageLayoutConfirmModal`, `TranslationModal`) necesitan, con el MISMO
 * contrato de marcado/clases que `Modal` de c42 (`data-c42-modal*`,
 * `.pbx-modal*`) para no tocar el CSS existente — pero con `useState`/
 * `useEffect` planos (mismo patrón ya usado y probado en
 * `canvas/ModalEditorOverlay.tsx`, que nunca tuvo este bug): overlay-click
 * cierra, Escape cierra, foco entra al montar y un focus trap básico (Tab/
 * Shift+Tab cicla dentro). Siempre se monta ya "abierto" (no hay
 * `defaultOpen` opcional): el caller controla la presencia condicionalmente,
 * igual que antes.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface SimpleModalProps {
  className?: string;
  children: ReactNode;
  onClose: () => void;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled") && !el.hasAttribute("hidden"));
}

export function SimpleModal({ className, children, onClose }: SimpleModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const content = rootRef.current?.querySelector<HTMLElement>("[data-c42-modal-content]");
    // Mismo comportamiento que `init()` del controller de c42 (docs arriba):
    // el content declara su propio rol de diálogo si el caller no lo hizo.
    if (content) {
      if (!content.hasAttribute("role")) content.setAttribute("role", "dialog");
      content.setAttribute("aria-modal", "true");
      if (!content.hasAttribute("tabindex")) content.setAttribute("tabindex", "-1");
    }
    const [first] = content ? getFocusable(content) : [];
    (first ?? content)?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const content = rootRef.current?.querySelector<HTMLElement>("[data-c42-modal-content]");
      if (!content) return;
      const focusable = getFocusable(content);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeydown, true);
    return () => document.removeEventListener("keydown", onKeydown, true);
  }, [onClose]);

  // Delega el click de cualquier `[data-c42-modal-close]`/overlay interno —
  // mismo contrato de marcado que `Modal` de c42, así los callers no cambian.
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-c42-modal-overlay], [data-c42-modal-close]")) {
      onClose();
    }
  }

  return createPortal(
    <div ref={rootRef} className={className} data-c42-modal="" onClick={handleClick}>
      {children}
    </div>,
    document.body,
  );
}
