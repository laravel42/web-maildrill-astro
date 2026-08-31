/**
 * ChipsTextField — texto libre + chips de preset que aparecen AL ENFOCAR
 * (docs/41 §4.4 `chipsText`, §6: `gridTemplateColumns`). Los chips nunca
 * desplazan la fila al aparecer (docs/41 §10.10): se muestran en una capa
 * flotante posicionada debajo del campo (mismo patrón que el dropdown de
 * `NumericUnitInput.__unit`/`ColorPicker` — `position: absolute`, no
 * `position: static` empujando contenido).
 *
 * Primitiva de PRESENTACIÓN + commit: recibe el valor de texto actual y un
 * callback de commit. Elegir un chip escribe su valor tal cual (reemplaza
 * el texto libre, no lo concatena — cada preset es un valor CSS completo,
 * p. ej. "1fr", "1fr 1fr", "repeat(3, 1fr)").
 */

import { useRef, useState } from "react";
import { CommittableInput } from "../../controls/CommittableInput";

export interface ChipsTextFieldPreset {
  /** Etiqueta ya traducida del chip (p. ej. "3 columnas"). */
  label: string;
  /** Valor CSS completo que escribe este chip. */
  value: string;
}

export interface ChipsTextFieldProps {
  value: string;
  presets: ChipsTextFieldPreset[];
  placeholder?: string;
  onCommit: (value: string) => void;
}

export function ChipsTextField({ value, presets, placeholder, onCommit }: ChipsTextFieldProps) {
  const [showChips, setShowChips] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFocus = () => setShowChips(true);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // No cerrar si el foco se mueve a un chip DENTRO del mismo contenedor.
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setShowChips(false);
  };

  return (
    <div className="pbx-chips-text" ref={containerRef} onFocus={handleFocus} onBlur={handleBlur}>
      <CommittableInput value={value} placeholder={placeholder} onCommit={onCommit} />
      {showChips && presets.length > 0 && (
        <div className="pbx-chips-text__popover" role="listbox" aria-label="presets">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              role="option"
              aria-selected={value === preset.value}
              className={
                "pbx-chips-text__chip" +
                (value === preset.value ? " pbx-chips-text__chip--active" : "")
              }
              // `onMouseDown` + `preventDefault` evita que el blur del input
              // se dispare antes del click (mismo patrón que
              // `NumericUnitInput__option`), así el commit del chip no se
              // pierde por el cierre del popover.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCommit(preset.value);
                setShowChips(false);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
