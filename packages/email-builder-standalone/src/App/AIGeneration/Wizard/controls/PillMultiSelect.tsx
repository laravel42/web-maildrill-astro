import React from 'react';

import FieldShell from './FieldShell';
import WrapPills, { type PillOption } from './WrapPills';

interface Props {
  label: string;
  hint?: string;
  values: string[];
  options: PillOption[];
  onChange: (next: string[]) => void;
  /** Optional cap on how many can be selected. */
  max?: number;
}

/**
 * Multi-select rendered as wrapping pill/badge toggles — the app's pill button
 * language, replacing the old multi `Chip`. Toggling adds/removes a value.
 */
export default function PillMultiSelect({ label, hint, values, options, onChange, max }: Props) {
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      if (max !== undefined && values.length >= max) return;
      onChange([...values, value]);
    }
  };

  return (
    <FieldShell label={label} hint={hint}>
      <WrapPills
        options={options}
        isSelected={(v) => values.includes(v)}
        onToggle={toggle}
        ariaLabel={label}
      />
    </FieldShell>
  );
}
