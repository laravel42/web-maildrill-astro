/**
 * NumericUnitInput — campo numérico con stepper ▲▼ y unidad seleccionable
 * (Fase 11.b, Inspector).
 *
 * Estructura visual:
 *   ┌────────────────────────────┐
 *   │  16  px ▾   │  ▲  │
 *   │             │  ▼  │
 *   └────────────────────────────┘
 *   Pill con borde redondeado, valor numérico editable, unidad como trigger
 *   del dropdown, stepper con flechas indigo apiladas.
 *
 * Contrato:
 *  - `value`  : string CSS completo ("16px", "1.5rem", "100%", "0 auto", "")
 *  - `units`  : lista de unidades válidas para este campo (["px","%","em","rem"…])
 *  - `onCommit`: se llama con el nuevo string CSS al perder foco, Enter o cambio de unidad
 *
 * Parseo: separa número y unidad del value actual. Si no hay número (ej. "auto",
 * "none", "") se muestra como texto libre — el componente degrada a CommittableInput
 * en ese caso para no perder valores especiales.
 *
 * Stepper: step configurable (default 1). Con Shift × 10, con Alt ÷ 10.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronUp, ChevronDown } from "@/components";

// ---------------------------------------------------------------------------
// Helpers de parseo / serialización
// ---------------------------------------------------------------------------

/**
 * Extrae { num, unit } de un string CSS de UN valor (ej. "16px" → { num: 16, unit: "px" }).
 * Devuelve null si el valor tiene múltiples tokens (padding shorthand) o no es numérico.
 */
function parse(raw: string): { num: number; unit: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "auto" || trimmed === "none" || trimmed.includes(" ")) return null;
  const m = trimmed.match(/^(-?[\d.]+)([a-z%]*)$/i);
  if (!m) return null;
  return { num: parseFloat(m[1]!), unit: m[2] ?? "px" };
}

/** Serializa número + unidad a string CSS */
function serialize(num: number, unit: string): string {
  // Redondear a 2 decimales, quitar .00
  const n = parseFloat(num.toFixed(2));
  return `${n}${unit}`;
}

/** Calcula el step según modificadores del teclado */
function calcStep(base: number, e: React.KeyboardEvent | React.MouseEvent): number {
  if (e.shiftKey) return base * 10;
  if (e.altKey) return base * 0.1;
  return base;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface NumericUnitInputProps {
  value: string;
  units: string[];
  step?: number;
  placeholder?: string;
  /**
   * Unidad por defecto (T7): si el valor entra sin unidad (`parse` da `unit=""`),
   * se muestra/commitea con esta unidad en vez de quedar *unitless*. Ausente =
   * comportamiento previo (respeta valores sin unidad, p. ej. `line-height`).
   */
  defaultUnit?: string;
  onCommit: (value: string) => void;
}

export function NumericUnitInput({
  value,
  units,
  step = 1,
  placeholder,
  defaultUnit,
  onCommit,
}: NumericUnitInputProps) {
  const parsedRaw = parse(value);
  // T7: un valor numérico sin unidad ("16") adopta `defaultUnit` (p. ej. "px")
  // para que al steppear/commitear se serialice "16px" en vez de "16". No aplica
  // a campos sin `defaultUnit` (line-height/font-weight → unitless válido).
  const parsed =
    parsedRaw && parsedRaw.unit === "" && defaultUnit
      ? { num: parsedRaw.num, unit: defaultUnit }
      : parsedRaw;

  // Si el valor no es parseble como número+unidad, delegar a input simple
  const [raw, setRaw] = useState(value);
  const lastExternal = useRef(value);

  // Sincronizar con cambios externos (undo, breakpoint, otro nodo)
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setRaw(value);
    }
  }, [value]);

  // Si no parseble, renderizar como input de texto simple con mismo estilo pill
  if (!parsed) {
    return (
      <SimpleTextPill
        value={raw}
        placeholder={placeholder}
        onChange={setRaw}
        onCommit={(v) => {
          lastExternal.current = v;
          onCommit(v);
        }}
      />
    );
  }

  return (
    <NumericPill
      num={parsed.num}
      unit={parsed.unit}
      units={units}
      step={step}
      onCommit={(n, u) => {
        const s = serialize(n, u);
        lastExternal.current = s;
        onCommit(s);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// SimpleTextPill — fallback para valores no-numéricos ("auto", "none", shorthands)
// ---------------------------------------------------------------------------

function SimpleTextPill({
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  return (
    <div className="pbx-numeric-input pbx-numeric-input--text">
      <input
        className="pbx-numeric-input__num"
        type="text"
        value={value}
        placeholder={placeholder ?? "auto"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumericPill — el componente principal
// ---------------------------------------------------------------------------

function NumericPill({
  num: externalNum,
  unit: externalUnit,
  units,
  step,
  onCommit,
}: {
  num: number;
  unit: string;
  units: string[];
  step: number;
  onCommit: (num: number, unit: string) => void;
}) {
  // Asegurar que la unidad externa está en la lista; si no, añadirla
  const validUnits = units.includes(externalUnit) ? units : [externalUnit, ...units];

  const [numDraft, setNumDraft] = useState(String(externalNum));
  const [unit, setUnit] = useState(externalUnit);
  const [dropOpen, setDropOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [invalid, setInvalid] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastNum = useRef(externalNum);
  const lastUnit = useRef(externalUnit);

  // Sincronizar con cambios externos
  useEffect(() => {
    if (externalNum !== lastNum.current || externalUnit !== lastUnit.current) {
      lastNum.current = externalNum;
      lastUnit.current = externalUnit;
      setNumDraft(String(externalNum));
      setUnit(externalUnit);
    }
  }, [externalNum, externalUnit]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!dropOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [dropOpen]);

  const commitNum = useCallback(
    (draftStr: string, currentUnit: string) => {
      const n = parseFloat(draftStr);
      if (!isNaN(n)) {
        lastNum.current = n;
        lastUnit.current = currentUnit;
        setInvalid(false);
        onCommit(n, currentUnit);
      } else {
        setNumDraft(String(lastNum.current));
        setInvalid(true);
        setTimeout(() => setInvalid(false), 500);
      }
    },
    [onCommit],
  );

  const step_ = (delta: number, e: React.MouseEvent) => {
    const s = calcStep(step, e);
    const current = parseFloat(numDraft);
    const next = isNaN(current) ? delta : current + delta * s;
    const rounded = parseFloat(next.toFixed(2));
    setNumDraft(String(rounded));
    lastNum.current = rounded;
    onCommit(rounded, unit);
  };

  const chooseUnit = (u: string) => {
    setUnit(u);
    setDropOpen(false);
    lastUnit.current = u;
    const n = parseFloat(numDraft);
    if (!isNaN(n)) onCommit(n, u);
  };

  // Navegación por teclado en el dropdown
  const handleUnitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setDropOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, validUnits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightedIdx >= 0) {
      e.preventDefault();
      chooseUnit(validUnits[highlightedIdx]!);
    }
  };

  // Resetear highlight al abrir
  const openDrop = () => {
    setHighlightedIdx(validUnits.indexOf(unit));
    setDropOpen(true);
  };

  return (
    <div
      ref={containerRef}
      className={`pbx-numeric-input${invalid ? " pbx-numeric-input--invalid" : ""}`}
      onKeyDown={handleUnitKeyDown}
    >
      {/* Número editable */}
      <input
        ref={inputRef}
        className="pbx-numeric-input__num"
        type="text"
        inputMode="numeric"
        value={numDraft}
        onChange={(e) => setNumDraft(e.target.value)}
        onBlur={() => commitNum(numDraft, unit)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitNum(numDraft, unit);
            (e.target as HTMLInputElement).blur();
          }
          // Stepper con teclas arriba/abajo en el número
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            if (!dropOpen) {
              e.preventDefault();
              const s = calcStep(step, e as unknown as React.KeyboardEvent);
              const delta = e.key === "ArrowUp" ? 1 : -1;
              const current = parseFloat(numDraft);
              const next = isNaN(current) ? delta : current + delta * s;
              const rounded = parseFloat(next.toFixed(2));
              setNumDraft(String(rounded));
              lastNum.current = rounded;
              onCommit(rounded, unit);
            }
          }
        }}
        aria-label="valor numérico"
      />

      {/* Unidad — trigger del dropdown */}
      <button
        type="button"
        className={`pbx-numeric-input__unit${dropOpen ? " pbx-numeric-input__unit--open" : ""}`}
        onClick={openDrop}
        aria-haspopup="listbox"
        aria-expanded={dropOpen}
        aria-label={`unidad: ${unit}`}
        tabIndex={0}
      >
        {unit}
      </button>

      {/* Stepper ▲▼ */}
      <div className="pbx-numeric-input__stepper" aria-hidden="true">
        <button
          type="button"
          className="pbx-numeric-input__step"
          onMouseDown={(e) => { e.preventDefault(); step_(1, e); }}
          tabIndex={-1}
          aria-label="incrementar"
        >
          <ChevronUp size={12} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pbx-numeric-input__step"
          onMouseDown={(e) => { e.preventDefault(); step_(-1, e); }}
          tabIndex={-1}
          aria-label="decrementar"
        >
          <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Dropdown de unidades */}
      {dropOpen && (
        <div
          ref={dropRef}
          className="pbx-numeric-input__dropdown"
          role="listbox"
          aria-label="unidades"
        >
          {validUnits.map((u, i) => (
            <button
              key={u}
              type="button"
              role="option"
              aria-selected={u === unit}
              className={[
                "pbx-numeric-input__option",
                u === unit ? "pbx-numeric-input__option--active" : "",
                i === highlightedIdx ? "pbx-numeric-input__option--highlighted" : "",
              ].filter(Boolean).join(" ")}
              onMouseDown={(e) => {
                e.preventDefault(); // evita que el blur del input se dispare antes
                chooseUnit(u);
              }}
              onMouseEnter={() => setHighlightedIdx(i)}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
