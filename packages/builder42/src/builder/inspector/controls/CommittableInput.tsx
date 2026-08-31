/**
 * Input controlado localmente que CONFIRMA el valor al perder foco o con Enter
 * (docs/03 §5). Así cada edición de campo es UN paso de historia (undo) en vez
 * de uno por pulsación, sin depender de un debounce por tiempo.
 *
 * Se re-sincroniza con `value` externo (cambios por undo, cambio de breakpoint,
 * selección de otro nodo).
 */

import { useEffect, useRef, useState } from "react";

interface CommittableInputProps {
  value: string;
  placeholder?: string;
  type?: "text" | "url";
  onCommit: (value: string) => void;
}

export function CommittableInput({
  value,
  placeholder,
  type = "text",
  onCommit,
}: CommittableInputProps) {
  const [draft, setDraft] = useState(value);
  const lastExternal = useRef(value);

  // Sincroniza cuando el valor externo cambia (undo, breakpoint, otro nodo).
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setDraft(value);
    }
  }, [value]);

  const commit = () => {
    if (draft !== value) {
      lastExternal.current = draft;
      onCommit(draft);
    }
  };

  return (
    <input
      className="pbx-control__input"
      type={type}
      value={draft}
      placeholder={placeholder}
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
