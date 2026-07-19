import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ImageProps, ImagePropsSchema } from '@eb/block-image';
import {
  AspectRatio,
  Crop,
  DescriptionOutlined,
  FitScreen,
  HeightOutlined,
  LinkOutlined,
  WallpaperOutlined,
} from '@mui/icons-material';
import { Box, MenuItem, Stack } from '@mui/material';

import { MAX_WIDTH_DESKTOP } from '../../../../constants';
import useParentImageWidth from '../../../../documents/blocks/customHooks/useParentImageWidth';
import { getParentWidth } from '../../../../documents/blocks/helpers/changeWidth';
import {
  useSelectedBlockId,
  useSelectedScreenSize,
  useSelectedSidebarTab,
} from '../../../../documents/editor/EditorContext';
import { useCompactMode } from '../../CompactModeContext';

import BaseSidebarPanel, { CompactDivider } from './helpers/BaseSidebarPanel';
import CompactableInput from './helpers/inputs/CompactableInput';
import Select from './helpers/inputs/components/Select';
import HeightInput from './helpers/inputs/HeightInput';
import ImageInput from './helpers/inputs/ImageInput';
import SizeSelector from './helpers/inputs/InputSizeSelector';
import LabelProperty from './helpers/inputs/LabelProperty';
import { getPositionI18nKey, getPositionIcon, POSITIONS_NINE } from './helpers/inputs/positionIcons';
import TextInput from './helpers/inputs/TextInput';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type ObjectFit = 'cover' | 'contain' | 'fill';

const FIT_ICONS: Record<ObjectFit, React.ReactElement> = {
  cover: <Crop fontSize="small" />,
  contain: <FitScreen fontSize="small" />,
  fill: <AspectRatio fontSize="small" />,
};

const getFitIcon = (fit: string): React.ReactElement => {
  if (fit === 'cover' || fit === 'contain' || fit === 'fill') {
    return FIT_ICONS[fit];
  }
  return FIT_ICONS.cover;
};

const capitalize = (s: string): string => (s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1));

type ImageSidebarPanelProps = {
  data: ImageProps;
  setData: (v: ImageProps) => void;
};

export default function ImageSidebarPanel({ data, setData }: ImageSidebarPanelProps) {
  const [_errors, setErrors] = useState<z.ZodError | null>(null);
  const blockSelected = useSelectedBlockId();
  const selectedTab = useSelectedSidebarTab();
  const selectedScreen = useSelectedScreenSize();
  const compact = useCompactMode();
  const { t } = useTranslation('inspector');

  useParentImageWidth(blockSelected || '', setData, data);

  // Dispatch event when Image block panel opens with current image data
  React.useEffect(() => {
    if (blockSelected) {
      window.dispatchEvent(
        new CustomEvent('email-builder-image-panel-opened', {
          detail: {
            blockId: blockSelected,
            currentImageUrl: data.props?.url || null,
            alt: data.props?.alt || null,
            source: 'image',
          },
        })
      );
    }
  }, [blockSelected, data.props?.url, data.props?.alt]);

  const updateData = useCallback(
    (d: unknown) => {
      const res = ImagePropsSchema.safeParse(d);
      if (res.success) {
        if (JSON.stringify(data) !== JSON.stringify(res.data)) {
          setData(res.data);
          setErrors(null);
        }
      } else {
        setErrors(res.error);
      }
    },
    [data, setData]
  );

  const getSizeUpdate = useCallback(
    (currentData, value, isMobile) => {
      const parentWidth = getParentWidth(blockSelected) || MAX_WIDTH_DESKTOP;
      const baseProps = { ...currentData.props };

      if (isMobile) {
        baseProps.touchedMobile = true;
      }

      if (value.mode === 'original') {
        const originalWidth = currentData.props?.original_width ?? null;

        if (isMobile) {
          return {
            ...baseProps,
            sizeMobile: value.mode,
            widthMobile: originalWidth,
          };
        }

        return {
          ...baseProps,
          size: value.mode,
          width: originalWidth,
          sizeMobile: baseProps.touchedMobile ? baseProps.sizeMobile : value.mode,
          widthMobile: baseProps.touchedMobile ? baseProps.widthMobile : originalWidth,
        };
      }

      if (value.mode === 'fill') {
        if (isMobile) {
          return {
            ...baseProps,
            sizeMobile: value.mode,
            widthMobile: null,
          };
        }

        return {
          ...baseProps,
          size: value.mode,
          width: null,
          sizeMobile: baseProps.touchedMobile ? baseProps.sizeMobile : value.mode,
          widthMobile: baseProps.touchedMobile ? baseProps.widthMobile : null,
        };
      }

      if (value.mode === 'scale') {
        const widthScale = Math.ceil((parentWidth / 100) * value.scale);

        if (isMobile) {
          return {
            ...baseProps,
            sizeMobile: value.mode,
            scaleMobile: value.scale,
            widthMobile: widthScale,
          };
        }

        return {
          ...baseProps,
          size: value.mode,
          scale: value.scale,
          width: widthScale,
          sizeMobile: baseProps.touchedMobile ? baseProps.sizeMobile : value.mode,
          scaleMobile: baseProps.touchedMobile ? baseProps.scaleMobile : value.scale,
          widthMobile: baseProps.touchedMobile ? baseProps.widthMobile : widthScale,
        };
      }

      return baseProps;
    },
    [blockSelected]
  );

  const handleSizeChange = useCallback(
    (value, mobile) => {
      const updatedProps = getSizeUpdate(data, value, mobile);
      updateData({
        ...data,
        props: updatedProps,
      });
    },
    [data, updateData, getSizeUpdate]
  );

  const currentSizeValues = useMemo(() => {
    if (selectedScreen !== 'desktop') {
      return {
        size: data.props?.touchedMobile ? data.props?.sizeMobile : (data.props?.size ?? 'original'),
        scale: data.props?.touchedMobile ? data.props?.scaleMobile : data.props?.scale,
      };
    }
    return {
      size: data.props?.size ?? 'original',
      scale: data.props?.scale,
    };
  }, [
    selectedScreen,
    data.props?.touchedMobile,
    data.props?.sizeMobile,
    data.props?.size,
    data.props?.scaleMobile,
    data.props?.scale,
  ]);

  const handleAltTextChange = useCallback(
    (alt) => {
      updateData({ ...data, props: { ...data.props, alt } });
    },
    [data, updateData]
  );

  const handleUrlChange = useCallback(
    (v) => {
      const linkHref = v.trim().length === 0 ? null : v.trim();
      updateData({ ...data, props: { ...data.props, linkHref } });
    },
    [data, updateData]
  );

  const handleStyleChange = useCallback(
    (style) => {
      updateData({ ...data, style });
    },
    [data, updateData]
  );

  const currentHeight = useMemo(() => {
    if (selectedScreen !== 'desktop') {
      return data.style?.heightMobile ?? data.style?.height ?? undefined;
    }
    return data.style?.height ?? undefined;
  }, [selectedScreen, data.style?.height, data.style?.heightMobile]);

  const handleHeightChange = useCallback(
    (next: number | null) => {
      const isMobile = selectedScreen !== 'desktop';
      const nextStyle = { ...(data.style ?? {}) };
      if (isMobile) {
        nextStyle.heightMobile = next;
      } else {
        nextStyle.height = next;
      }
      updateData({ ...data, style: nextStyle });
    },
    [data, updateData, selectedScreen]
  );

  const handleObjectFitChange = useCallback(
    (next: 'cover' | 'contain' | 'fill' | null) => {
      const isMobile = selectedScreen !== 'desktop';
      const nextStyle = { ...(data.style ?? {}) };
      if (isMobile) {
        nextStyle.objectFitMobile = next;
      } else {
        nextStyle.objectFit = next;
      }
      updateData({ ...data, style: nextStyle });
    },
    [data, updateData, selectedScreen]
  );

  const handleObjectPositionChange = useCallback(
    (next: string) => {
      const isMobile = selectedScreen !== 'desktop';
      const nextStyle = { ...(data.style ?? {}) };
      if (isMobile) {
        nextStyle.objectPositionMobile = next;
      } else {
        nextStyle.objectPosition = next;
      }
      updateData({ ...data, style: nextStyle });
    },
    [data, updateData, selectedScreen]
  );

  return (
    <BaseSidebarPanel title={t('inputs.panels.image.title')}>
      {(selectedTab === 'block-configuration' || compact) && (
        <>
          <CompactableInput icon={WallpaperOutlined} label={t('inputs.panels.image.title')}>
            <ImageInput data={data} setData={setData} blockId={blockSelected} />
          </CompactableInput>
          <CompactableInput icon={DescriptionOutlined} label={t('inputs.panels.image.altLabel')}>
            <TextInput
              label={t('inputs.panels.image.altLabel')}
              placeholder={t('inputs.panels.image.altPlaceholder')}
              defaultValue={data.props?.alt ?? ''}
              onChange={handleAltTextChange}
            />
          </CompactableInput>
          <CompactableInput icon={LinkOutlined} label={t('inputs.panels.image.urlLabel')}>
            <TextInput
              label={t('inputs.panels.image.urlLabel')}
              placeholder={t('inputs.panels.image.urlPlaceholder')}
              defaultValue={data.props?.linkHref ?? ''}
              onChange={handleUrlChange}
            />
          </CompactableInput>
          <CompactableInput icon={AspectRatio} label={t('inputs.panels.image.sizeLabel', 'Size')}>
            <SizeSelector
              defaultValue={currentSizeValues.size}
              scale={currentSizeValues.scale ?? undefined}
              onChange={(v) => handleSizeChange(v, selectedScreen !== 'desktop')}
            />
          </CompactableInput>

          <CompactableInput icon={HeightOutlined} label={t('inputs.panels.image.heightLabel')}>
            <>
              <HeightInput
                label={t('inputs.panels.image.heightLabel')}
                defaultValue={currentHeight ?? undefined}
                min={0}
                max={800}
                step={4}
                onChange={(v) => handleHeightChange(v > 0 ? v : null)}
              />

              {currentHeight ? (
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <LabelProperty label={t('inputs.panels.image.objectFitLabel')} />
                    <Select
                      style={{ width: '100%' }}
                      size="small"
                      value={
                        (selectedScreen === 'desktop'
                          ? (data.style?.objectFit ?? 'cover')
                          : (data.style?.objectFitMobile ?? data.style?.objectFit ?? 'cover')) as string
                      }
                      onChange={(e) => handleObjectFitChange(e.target.value as 'cover' | 'contain' | 'fill')}
                      renderValue={(v) => {
                        const value = String(v ?? 'cover');
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: '1rem' }}>
                            {getFitIcon(value)}
                            {t(`inputs.panels.image.objectFit${capitalize(value)}`)}
                          </Box>
                        );
                      }}
                    >
                      {(['cover', 'contain', 'fill'] as const).map((fit) => (
                        <MenuItem key={fit} value={fit} sx={{ padding: '0.5rem 1rem 0.5rem 0.5rem!important' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getFitIcon(fit)}
                            {t(`inputs.panels.image.objectFit${capitalize(fit)}`)}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </div>

                  {(() => {
                    const effectiveFit =
                      selectedScreen === 'desktop'
                        ? (data.style?.objectFit ?? 'cover')
                        : (data.style?.objectFitMobile ?? data.style?.objectFit ?? 'cover');
                    const effectivePosition =
                      selectedScreen === 'desktop'
                        ? (data.style?.objectPosition ?? 'center')
                        : (data.style?.objectPositionMobile ?? data.style?.objectPosition ?? 'center');
                    if (effectiveFit === 'fill') return null;
                    return (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <LabelProperty label={t('inputs.panels.image.objectPositionLabel')} />
                        <Select
                          style={{ width: '100%' }}
                          size="small"
                          value={effectivePosition as string}
                          onChange={(e) => handleObjectPositionChange(String(e.target.value))}
                          renderValue={(v) => {
                            const value = String(v ?? 'center');
                            return (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: '1rem' }}>
                                {getPositionIcon(value)}
                                {t(`inputs.backgroundImage.positions.${getPositionI18nKey(value)}`)}
                              </Box>
                            );
                          }}
                        >
                          {POSITIONS_NINE.map((position) => (
                            <MenuItem
                              key={position}
                              value={position}
                              sx={{ padding: '0.5rem 1rem 0.5rem 0.5rem!important' }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {getPositionIcon(position)}
                                {t(`inputs.backgroundImage.positions.${getPositionI18nKey(position)}`)}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </div>
                    );
                  })()}
                </Stack>
              ) : null}
            </>
          </CompactableInput>
        </>
      )}

      <CompactDivider />
      <MultiStylePropertyPanel
        names={['textAlign', 'textAlignMobile', 'backgroundColor', 'shape', 'padding', 'mobilePadding']}
        value={data.style}
        shapeMaxValue={300}
        shapeSteps={20}
        onChange={handleStyleChange}
      />
    </BaseSidebarPanel>
  );
}
