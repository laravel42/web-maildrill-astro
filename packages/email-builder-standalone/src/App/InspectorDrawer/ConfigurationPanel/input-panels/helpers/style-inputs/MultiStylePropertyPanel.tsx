import React from 'react';

import { BLOCKS_DEFAULT_CSS } from '../../../../../../documents/blocks/helpers/constants';
import { TStyle } from '../../../../../../documents/blocks/helpers/TStyle';
import {
  useBlockTypeSelected,
  useSelectedSidebarTab,
} from '../../../../../../documents/editor/EditorContext';
import { useCompactMode } from '../../../../CompactModeContext';

import SingleStylePropertyPanel from './SingleStylePropertyPanel';

type MultiStylePropertyPanelProps = {
  names: (keyof TStyle)[];
  value: TStyle | undefined | null;
  onChange: (style: TStyle) => void;
  disabledCSSValidation?: boolean;
  shapeMaxValue?: number;
  shapeSteps?: number;
};
export default function MultiStylePropertyPanel({
  names,
  value,
  onChange,
  disabledCSSValidation = false,
  shapeMaxValue,
  shapeSteps,
}: MultiStylePropertyPanelProps) {
  const selectedTab = useSelectedSidebarTab();
  const typeSelectedBlock = useBlockTypeSelected();
  const compact = useCompactMode();
  return (
    (compact ||
      disabledCSSValidation ||
      selectedTab == 'css' ||
      BLOCKS_DEFAULT_CSS.includes(typeSelectedBlock || '')) && (
      <>
        {names.map((name) => (
          <SingleStylePropertyPanel
            shapeMaxValue={shapeMaxValue}
            shapeSteps={shapeSteps}
            key={name}
            name={name}
            value={value || {}}
            onChange={onChange}
          />
        ))}
      </>
    )
  );
}
