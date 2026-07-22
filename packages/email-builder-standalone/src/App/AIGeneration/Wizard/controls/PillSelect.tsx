import React from 'react';

import InspectorPillToggleGroup from '../../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/InspectorPillToggleGroup';

import FieldShell from './FieldShell';
import WrapPills, { type PillOption } from './WrapPills';

interface Props {
  label: string;
  hint?: string;
  value: string | undefined;
  options: PillOption[];
  onChange: (value: string) => void;
  /**
   * `segmented` → the app's connected radio-pill bar (`InspectorPillToggleGroup`),
   * best for short sets (≤4). `wrap` → wrapping pills, best for long sets
   * (purpose, vertical). Defaults to `wrap`.
   */
  layout?: 'segmented' | 'wrap';
}

/**
 * Single-select rendered as the app's radio-pill control. Replaces the wizard's
 * old single-select `Chip` usage with the same `ToggleButton` pill language used
 * across the inspector (`ContentAlignment`, `Shape`, `TextAlignInput`, …).
 */
export default function PillSelect({ label, hint, value, options, onChange, layout = 'wrap' }: Props) {
  return (
    <FieldShell label={label} hint={hint}>
      {layout === 'segmented' ? (
        <InspectorPillToggleGroup value={value ?? ''} onChange={onChange} options={options} />
      ) : (
        <WrapPills options={options} isSelected={(v) => v === value} onToggle={onChange} ariaLabel={label} />
      )}
    </FieldShell>
  );
}
