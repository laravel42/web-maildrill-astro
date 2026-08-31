/**
 * GridColumnsSimple — control SIMPLE de "número de columnas" para la fila
 * `layout.gridColumns` cuando `experienceLevel` es `simple` (Fase 4 de
 * simplificación del panel, docs/41). Sustituye al `ChipsTextField` (texto
 * libre + presets de `grid-template-columns`) por un único input numérico
 * SIN unidad: el usuario piensa "3 columnas", no "repeat(3, 1fr)".
 *
 * No reutiliza `NumericField`/`NumericUnitInput`: ambos están diseñados
 * alrededor de un par número+unidad (`NumericUnitInput` siempre pinta un
 * botón de unidad, incluso con `units=[]` degradaría a una unidad vacía
 * visible — revisado en su código antes de decidir esto). Como este campo
 * NO es una medida CSS sino un conteo puro, se implementa como un input
 * numérico nativo mínimo, mismo patrón de "confirma al perder foco / Enter"
 * que `CommittableInput` (docs/03 §5: cada edición es un paso de historia).
 *
 * Traducción valor mostrado <-> valor CSS (funciones puras, sin React):
 * - `parseColumnCount(raw)`: extrae `N` de un `"repeat(N, 1fr)"` ya
 *   guardado. Si el string no matchea ESE formato exacto (p. ej. viene de
 *   modo avanzado con `"200px 1fr 100px"` o `"1fr 1fr"` escrito a mano), NO
 *   intenta adivinar un número — devuelve `""` (el campo se muestra vacío,
 *   con placeholder, en vez de un valor inventado).
 * - `columnCountToTemplate(n)`: arma `"repeat(N, 1fr)"`. Escribir un número
 *   nuevo SOBREESCRIBE cualquier valor avanzado previo no compatible — es
 *   una pérdida de datos INTENCIONAL (documentada en la tarea/AGENTS): el
 *   usuario está en modo simple a propósito, y preservar un shorthand
 *   arbitrario ("200px 1fr 100px") no tiene representación en "número de
 *   columnas". No se ofrece un mecanismo de recuperación.
 */

import { useEffect, useRef, useState } from "react";

/** Matchea EXACTAMENTE el formato que este control produce: `repeat(<N>, 1fr)`. */
const REPEAT_1FR_RE = /^repeat\(\s*(\d+)\s*,\s*1fr\s*\)$/i;

/**
 * Extrae el número de columnas de un valor CSS de `grid-template-columns`,
 * solo si matchea el formato exacto `"repeat(N, 1fr)"` que este control
 * escribe. Cualquier otro valor (vacío, `"1fr 1fr"`, `"200px 1fr"`,
 * `"repeat(3, 2fr)"`…) devuelve `""` — no se adivina un número a partir de
 * un shorthand no compatible con este control simple.
 */
export function parseColumnCount(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.trim().match(REPEAT_1FR_RE);
  if (!m) return "";
  return m[1] ?? "";
}

/** Arma el valor CSS `"repeat(N, 1fr)"` a partir del número de columnas mostrado. */
export function columnCountToTemplate(count: string): string {
  const trimmed = count.trim();
  if (!trimmed) return "";
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `repeat(${n}, 1fr)`;
}

export interface GridColumnsSimpleProps {
  /** Valor CSS actual completo de `layout.gridTemplateColumns`. */
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  onCommit: (value: string) => void;
}

export function GridColumnsSimple({ value, placeholder, ariaLabel, onCommit }: GridColumnsSimpleProps) {
  const displayValue = parseColumnCount(value);
  const [draft, setDraft] = useState(displayValue);
  const lastExternal = useRef(displayValue);

  // Re-sincroniza con el valor externo (undo, cambio de breakpoint, otro nodo).
  useEffect(() => {
    if (displayValue !== lastExternal.current) {
      lastExternal.current = displayValue;
      setDraft(displayValue);
    }
  }, [displayValue]);

  const commit = () => {
    if (draft === lastExternal.current) return;
    const next = columnCountToTemplate(draft);
    lastExternal.current = parseColumnCount(next);
    onCommit(next);
  };

  return (
    <input
      className="pbx-control__input"
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
