/**
 * Toggle — interruptor (switch) unificado del chrome del editor (docs/18).
 *
 * Sustituye a los `<input type="checkbox">` crudos por un control visual
 * consistente (`.pbx-switch`, tokens `--pb-chrome-*`). Chrome del editor (P8).
 *
 * El texto opcional (`children`) se renderiza dentro del mismo `<label>`, así
 * que hacer click en la etiqueta también alterna el valor.
 */

import type { ReactNode } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto visible junto al switch (dentro del label). */
  children?: ReactNode;
  /** aria-label cuando no hay texto visible. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, children, label, disabled, className }: ToggleProps) {
  return (
    <label className={"pbx-switch" + (className ? ` ${className}` : "")} aria-label={label}>
      {children != null ? <span className="pbx-switch__label">{children}</span> : null}
      <input
        type="checkbox"
        className="pbx-switch__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pbx-switch__track" aria-hidden="true">
        <span className="pbx-switch__thumb" />
      </span>
    </label>
  );
}
