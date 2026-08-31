/**
 * FieldHelp — icono de información con tooltip explicativo, para colocar a la
 * derecha del label de un control cuya función no es obvia (p. ej. la clave de
 * `localStorage` del theme-toggle). Al pasar el cursor (o enfocar el disparador)
 * muestra una descripción detallada de qué hace esa configuración.
 *
 * Por qué NO usa el `Tooltip` de c42 (P10): el controller de c42 posiciona el
 * contenido con `position:absolute` y SIN portal, así que cualquier ancestro con
 * `overflow` (el Inspector tiene `overflow:auto`) lo recorta. Como este helper
 * se reutiliza en muchos controles densos, el contenido se **teletransporta a
 * `document.body`** (`createPortal`) y se posiciona con `@floating-ui/dom`
 * (`strategy:"fixed"` + `flip`/`shift`, con `autoUpdate` en scroll/resize) para
 * que nunca quede cortado. floating-ui es una primitiva de posicionamiento (la
 * usa el propio c42 internamente), no una librería de controladores de UI —
 * excepción acotada a este helper, análoga a la medición manual de rects de
 * `SelectionHandle`/`TextToolbar`.
 *
 * Chrome del editor (P8): nunca sale al HTML exportado. El texto llega ya
 * traducido por el consumidor (P9) — este componente no fija idioma.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type Placement,
} from "@floating-ui/dom";
import { Info } from "@/components";

export function FieldHelp({
  message,
  label,
  placement = "top-end",
}: {
  /** Texto del tooltip, ya traducido por el consumidor. */
  message: string;
  /** aria-label del disparador (opcional; por defecto uno genérico i18n). */
  label?: string;
  /** Colocación preferida (floating-ui la ajusta con flip/shift). */
  placement?: Placement;
}) {
  const { t } = useTranslation("inspector");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();

  // Posicionamiento con floating-ui mientras está abierto: computa una vez y se
  // re-sincroniza en scroll/resize/reflow vía `autoUpdate`. `strategy:"fixed"`
  // + portal a body → el tooltip escapa cualquier `overflow` de ancestros.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const update = () => {
      void computePosition(trigger, content, {
        placement,
        strategy: "fixed",
        middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(content.style, { left: `${x}px`, top: `${y}px` });
      });
    };

    const stop = autoUpdate(trigger, content, update);
    return stop;
  }, [open, placement, message]);

  // Cierra al presionar Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="pbx-field-help">
      <button
        ref={triggerRef}
        type="button"
        className="pbx-field-help__trigger"
        aria-label={label ?? t("fieldHelp.label")}
        aria-describedby={open ? id : undefined}
        data-state={open ? "open" : "closed"}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <span
              ref={contentRef}
              id={id}
              role="tooltip"
              className="pbx-field-help__content"
              // Mientras floating-ui calcula la primera posición, se mantiene
              // fuera de vista para evitar un salto visible en (0,0).
              style={{ position: "fixed", left: 0, top: 0 }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              {message}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
