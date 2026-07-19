import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import { BlockSocialMediaPropsScheme, SocialMediaProps } from '@eb/block-social-media';
import { IconOptions } from '@eb/block-social-media/utils/icons';
import { ShareOutlined, SpaceBar } from '@mui/icons-material';
import { Box } from '@mui/material';

import { TStyle } from '../../../../documents/blocks/helpers/TStyle';
import { useSelectedScreenSize, useSelectedSidebarTab } from '../../../../documents/editor/EditorContext';
import { useCompactMode } from '../../CompactModeContext';

import BaseSidebarPanel, { CompactDivider } from './helpers/BaseSidebarPanel';
import CompactableInput from './helpers/inputs/CompactableInput';
import FieldContainer from './helpers/inputs/components/FieldContainer';
import LabelProperty from './helpers/inputs/LabelProperty';
import RawSliderInput from './helpers/inputs/raw/RawSliderInput';
import { SocialMediaInput } from './helpers/inputs/SocialMediaInput';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type SocialMediaSidebarPanelProps = {
  data: SocialMediaProps;
  setData: (v: SocialMediaProps) => void;
};

export const SocialMediaSidebarPanel = ({ data, setData }: SocialMediaSidebarPanelProps) => {
  const [, setErrors] = useState<ZodError | null>(null);
  const selectedScreen = useSelectedScreenSize();
  const { t } = useTranslation('inspector');
  const updateData = (d: unknown) => {
    const res: any = BlockSocialMediaPropsScheme.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  const updateContent = (items: IconOptions[]) => {
    updateData({ ...data, items });
  };

  const updateStyles = (style: TStyle) => {
    updateData({ ...data, style });
  };

  const updateGap = (gap: number, mobile = false) => {
    if (mobile) {
      updateData({ ...data, gapMobile: gap });
      return;
    }
    updateData({ ...data, gap });
  };

  const selectedTab = useSelectedSidebarTab();
  const compact = useCompactMode();

  return (
    <BaseSidebarPanel title={t('inputs.panels.social.title')}>
      {(selectedTab == 'block-configuration' || compact) && (
        <CompactableInput icon={ShareOutlined} label={t('inputs.panels.social.title')}>
          <Box sx={{ minWidth: 120, margin: 1 }}>
            <SocialMediaInput items={(data?.items ?? []) as IconOptions[]} onChange={updateContent} />
          </Box>
        </CompactableInput>
      )}

      {(selectedTab == 'css' || compact) && (
        <>
          <CompactDivider />
          <CompactableInput icon={SpaceBar} label={t('inputs.panels.social.gap')}>
            <FieldContainer>
              <LabelProperty label={t('inputs.panels.social.gap')} />
              {selectedScreen == 'desktop' ? (
                <RawSliderInput
                  iconLabel={<SpaceBar sx={{ color: 'text.primary' }} />}
                  value={Number(data?.gap ?? 4)}
                  setValue={(v) => updateGap(v, false)}
                  marks
                  step={4}
                  units={'px'}
                  min={0}
                  max={40}
                />
              ) : (
                <RawSliderInput
                  iconLabel={<SpaceBar sx={{ color: 'text.primary' }} />}
                  value={Number(data?.gapMobile ?? data?.gap ?? 4)}
                  setValue={(value) => updateGap(value, true)}
                  marks
                  step={4}
                  units={'px'}
                  min={0}
                  max={40}
                />
              )}
            </FieldContainer>
          </CompactableInput>

          <MultiStylePropertyPanel
            names={['textAlign', 'textAlignMobile', 'backgroundColor', 'padding', 'mobilePadding']}
            value={data.style}
            onChange={(style) => updateStyles(style)}
          />
        </>
      )}
    </BaseSidebarPanel>
  );
};
