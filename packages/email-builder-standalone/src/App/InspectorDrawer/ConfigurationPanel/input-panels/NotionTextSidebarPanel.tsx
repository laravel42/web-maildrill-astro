import React from 'react';
import { useTranslation } from 'react-i18next';

import { NotionTextProps } from '@eb/block-notion-text';

import { TStyle } from '../../../../documents/blocks/helpers/TStyle';
import { useSelectedSidebarTab } from '../../../../documents/editor/EditorContext';
import { useCompactMode } from '../../CompactModeContext';

import BaseSidebarPanel, { CompactDivider } from './helpers/BaseSidebarPanel';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type NotionTextSidebarPanelProps = {
  data: NotionTextProps;
  setData: (v: NotionTextProps) => void;
};

export default function NotionTextSidebarPanel({ data, setData }: NotionTextSidebarPanelProps) {
  const selectedTab = useSelectedSidebarTab();
  const compact = useCompactMode();
  const { t } = useTranslation('inspector');

  const style = (data.style as TStyle) || {};

  const updateStylesGranular = (newStyle: TStyle) => {
    const mergedStyle: TStyle = { ...(style || {}), ...(newStyle || {}) };
    setData({ ...data, style: mergedStyle });
  };

  return (
    <BaseSidebarPanel title={t('inputs.panels.notionText.title', 'Text')}>
      {(selectedTab === 'block-configuration' || compact) && (
        <>
          {compact ? (
            <>
              <MultiStylePropertyPanel
                disabledCSSValidation
                names={['fontFamily']}
                value={style}
                onChange={updateStylesGranular}
              />
              <MultiStylePropertyPanel
                disabledCSSValidation
                names={['lineHeight']}
                value={style}
                onChange={updateStylesGranular}
              />
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <MultiStylePropertyPanel
                  disabledCSSValidation
                  names={['fontFamily']}
                  value={style}
                  onChange={updateStylesGranular}
                />
              </div>
              <div style={{ flex: 1 }}>
                <MultiStylePropertyPanel
                  disabledCSSValidation
                  names={['lineHeight']}
                  value={style}
                  onChange={updateStylesGranular}
                />
              </div>
            </div>
          )}

          <MultiStylePropertyPanel
            disabledCSSValidation
            names={['fontSize', 'fontSizeMobile']}
            value={style}
            onChange={updateStylesGranular}
          />
        </>
      )}

      {(selectedTab === 'css' || compact) && (
        <>
          <CompactDivider />
          <MultiStylePropertyPanel
            names={['backgroundColor', 'border', 'borderMobile', 'padding', 'mobilePadding']}
            value={style}
            onChange={updateStylesGranular}
          />
        </>
      )}
    </BaseSidebarPanel>
  );
}
