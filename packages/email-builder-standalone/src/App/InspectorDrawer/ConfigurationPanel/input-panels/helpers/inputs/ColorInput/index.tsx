import React from 'react';

import BaseColorInput from './BaseColorInput';

/**
 * Phase 2c — Inspector Theme panel.
 *
 * The optional `inheritedFrom` prop signals that the displayed value
 * does not come from `block.data` directly: it has been resolved from
 * `theme.blocks[type]` (`'theme'`) or from the block's hardcoded schema
 * default (`'default'`). The input applies a muted visual treatment
 * (reduced opacity) to communicate the inheritance, matching the
 * "greyed placeholder" UX described in the components-library plan.
 *
 * Editing the input always promotes the value to explicit (atomic
 * update writes to `block.data` exactly as today). No special handling
 * is required at the call site.
 */
export type InheritedFrom = 'theme' | 'default';

type Props = {
  label?: string;
  labelAction?: React.ReactNode;
  onChange: (value: string) => void;
  defaultValue: string;
  compact?: boolean;
  inheritedFrom?: InheritedFrom;
};
export default function ColorInput(props: Props) {
  return <BaseColorInput {...props} nullable={false} />;
}

type NullableProps = {
  label?: string;
  labelAction?: React.ReactNode;
  onChange: (value: null | string) => void;
  defaultValue: null | string;
  compact?: boolean;
  inheritedFrom?: InheritedFrom;
};
export function NullableColorInput(props: NullableProps) {
  return <BaseColorInput {...props} nullable />;
}
