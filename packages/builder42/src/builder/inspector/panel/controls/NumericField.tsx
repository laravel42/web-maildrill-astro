/**
 * NumericField — campo numérico de una medida con unidad, con icono interno
 * a la izquierda y scrubbing por arrastre horizontal (docs/41 §4.3 "Campos
 * numéricos", §4.4 `numeric`, Paso 3 de la tabla §7).
 *
 * Envuelve `controls/NumericUnitInput.tsx` (pill número + unidad + stepper
 * ▲▼) SIN modificarlo — este componente solo añade: (a) un icono dentro del
 * campo que sustituye la etiqueta cuando la fila usa iconos (p. ej. un lado
 * de padding, o un eje X/Y), y (b) scrubbing: arrastre horizontal sobre ese
 * icono incrementa/decrementa el valor. Las flechas ↑/↓ y Shift ya las
 * cubre `NumericUnitInput` internamente (input nativo) — aquí solo se
 * documenta el contrato de step (±1, Shift ±10) porque la tarea lo pide
 * también sobre el gesto de arrastre, que SÍ es nuevo.
 *
 * CRÍTICO (docs/41 §11.3): toda la aritmética vive en funciones PURAS
 * exportadas (`parseMeasure`, `stepValue`), testeadas sin DOM. jsdom no
 * tiene layout ni pointer capture real — el gesto de arrastre no se
 * testea aquí, la aritmética que lo respalda sí.
 */

import { useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { NumericUnitInput } from "../../controls/NumericUnitInput";

// ---------------------------------------------------------------------------
// Funciones puras (docs/41 §11.3) — sin React, sin DOM
// ---------------------------------------------------------------------------

/** Resultado de parsear un string CSS de una sola medida. */
export interface ParsedMeasure {
  num: number;
  unit: string;
}

/**
 * Extrae `{ num, unit }` de un valor CSS de una sola medida ("16px" →
 * `{ num: 16, unit: "px" }`). Devuelve `null` si el valor no es una medida
 * numérica simple (vacío, "auto", "none", shorthands con espacios, o
 * cualquier string no numérico) — en ese caso el llamador debe tratarlo
 * como valor libre y no steppear.
 */
export function parseMeasure(raw: string | undefined): ParsedMeasure | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes(" ")) return null;
  const m = trimmed.match(/^(-?[\d.]+)([a-z%]*)$/i);
  if (!m) return null;
  const numStr = m[1];
  if (!numStr) return null;
  return { num: parseFloat(numStr), unit: m[2] ?? "" };
}

/**
 * Calcula el nuevo valor CSS tras aplicar un `delta` de step (±1 con
 * flechas, ±10 con Shift — docs/41 §4.4) a un valor crudo.
 *
 * DECISIÓN DOCUMENTADA (regla de unidad al steppear, pedida por la tarea):
 * el step SIEMPRE preserva la unidad ya presente en `raw` — "1.5rem" + ↑
 * (delta=1) da "2.5rem", nunca "1.5px" ni un cambio de unidad. Solo cuando
 * `raw` no tiene unidad propia (vacío, o un número "pelado" como "16") se
 * usa `defaultUnit` para no dejar el resultado *unitless* en un campo que
 * espera medida (p. ej. un `gap` vacío + ↑ con `defaultUnit="px"` → "1px",
 * no "1"). Si tampoco hay `defaultUnit` (campos unitless válidos como
 * `line-height`/`font-weight`), el resultado queda sin unidad. Redondea a 2
 * decimales para evitar artefactos de coma flotante (0.1 + 0.2 → 0.30000…4).
 */
export function stepValue(raw: string | undefined, delta: number, defaultUnit?: string): string {
  const parsed = parseMeasure(raw);
  const currentNum = parsed?.num ?? 0;
  const unit = parsed?.unit || defaultUnit || "";
  const next = parseFloat((currentNum + delta).toFixed(2));
  return `${next}${unit}`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export interface NumericFieldProps {
  /** Valor CSS actual completo ("16px", "1.5rem", "", "auto"…). */
  value: string;
  /** Unidades válidas para este campo (docs/41 §6, viene del `StyleFieldDef`). */
  units: string[];
  /** Unidad por defecto si el valor entra sin unidad (docs/41 §6, T7 heredado de `NumericUnitInput`). */
  defaultUnit?: string;
  placeholder?: string;
  /**
   * Icono que sustituye la etiqueta de fila (docs/41 §4.3): lado de padding,
   * eje X/Y, etc. También es el "handle" de scrubbing. Si se omite, el
   * campo no muestra icono interno (caso `Alto`/`Gap` sin icono de lado).
   */
  icon?: ReactNode;
  /** `aria-label` del icono/handle de scrubbing (obligatorio si se pasa `icon`). */
  iconLabel?: string;
  onCommit: (value: string) => void;
}

/** Umbral de píxeles arrastrados para que el scrubbing avance un step. */
const SCRUB_PX_PER_STEP = 4;

export function NumericField({
  value,
  units,
  defaultUnit,
  placeholder,
  icon,
  iconLabel,
  onCommit,
}: NumericFieldProps) {
  // Estado del gesto de arrastre — vive en un ref porque el scrubbing no
  // necesita re-render por frame, solo acumula desplazamiento y commitea.
  const dragState = useRef<{ startX: number; startValue: string; accumulated: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Solo botón primario; evita interferir con scroll táctil multitouch.
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startValue: value, accumulated: 0 };
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragState.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const stepsFromStart = Math.trunc(dx / SCRUB_PX_PER_STEP);
      if (stepsFromStart === drag.accumulated) return;
      const delta = stepsFromStart - drag.accumulated;
      const multiplier = e.shiftKey ? 10 : 1;
      const next = stepValue(dragState.current ? value : drag.startValue, delta * multiplier, defaultUnit);
      dragState.current = { ...drag, accumulated: stepsFromStart };
      onCommit(next);
    },
    [value, defaultUnit, onCommit],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragState.current = null;
  }, []);

  return (
    <div className="pbx-numeric-field">
      {icon != null && (
        <button
          type="button"
          className="pbx-numeric-field__icon"
          aria-label={iconLabel}
          title={iconLabel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {icon}
        </button>
      )}
      <NumericUnitInput
        value={value}
        units={units}
        defaultUnit={defaultUnit}
        placeholder={placeholder}
        onCommit={onCommit}
      />
    </div>
  );
}
