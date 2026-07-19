import React from 'react';

import ColorInput from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/ColorInput/BaseColorInput';

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export default function ColorPickerField({ label, value, onChange }: Props) {
  return <ColorInput label={label} nullable={false} defaultValue={value || '#000000'} onChange={onChange} />;
}
