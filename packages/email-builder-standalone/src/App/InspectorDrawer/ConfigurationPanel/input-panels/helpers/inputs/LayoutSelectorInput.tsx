import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EditOutlined } from '@mui/icons-material';
import { Box, Button, Collapse, Slider, Stack, Typography, useTheme } from '@mui/material';

import FieldContainer from './components/FieldContainer';
import LabelProperty from './LabelProperty';

/** Persisted in document `props.layout` when the user applies a custom split from this control. */
export const LAYOUT_CUSTOM_ID = 'layout-custom';

type LayoutDistribution = {
  id: string;
  distribution: (null | number)[];
};

const LAYOUTS_TWO_COLUMNS: LayoutDistribution[] = [
  { id: 'layout-50-50', distribution: [50, 50, null] },
  { id: 'layout-55-45', distribution: [55, 45, null] },
  { id: 'layout-45-55', distribution: [45, 55, null] },
  { id: 'layout-60-40', distribution: [60, 40, null] },
  { id: 'layout-40-60', distribution: [40, 60, null] },
  { id: 'layout-70-30', distribution: [70, 30, null] },
  { id: 'layout-30-70', distribution: [30, 70, null] },
  { id: 'layout-75-25', distribution: [75, 25, null] },
  { id: 'layout-25-75', distribution: [25, 75, null] },
  { id: 'layout-80-20', distribution: [80, 20, null] },
  { id: 'layout-20-80', distribution: [20, 80, null] },
];

const LAYOUTS_THREE_COLUMNS: LayoutDistribution[] = [
  { id: 'layout-33-33-33', distribution: [33.34, 33.33, 33.33] },
  { id: 'layout-30-40-30', distribution: [30, 40, 30] },
  { id: 'layout-25-50-25', distribution: [25, 50, 25] },
  { id: 'layout-20-60-20', distribution: [20, 60, 20] },
  { id: 'layout-50-25-25', distribution: [50, 25, 25] },
  { id: 'layout-25-25-50', distribution: [25, 25, 50] },
  { id: 'layout-60-20-20', distribution: [60, 20, 20] },
  { id: 'layout-20-20-60', distribution: [20, 20, 60] },
  { id: 'layout-40-30-30', distribution: [40, 30, 30] },
  { id: 'layout-40-20-40', distribution: [40, 20, 40] },
  { id: 'layout-15-70-15', distribution: [15, 70, 15] },
];

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
    width: '100%',
  },
  card: {
    cursor: 'pointer',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'primary',
  } as const,
  cardContent: {
    padding: '8px',
  },
  layoutPreview: {
    display: 'grid',
    gap: '4px',
    height: '30px',
    width: '100%',
    minHeight: '30px',
  },
};

function initTwoColDraft(fixedWidths: (number | null)[] | undefined): number {
  const a = fixedWidths?.[0];
  if (typeof a === 'number' && !Number.isNaN(a)) {
    return Math.min(99, Math.max(1, Math.round(a)));
  }
  return 50;
}

function initThreeColDraft(fixedWidths: (number | null)[] | undefined): [number, number] {
  let w1 = typeof fixedWidths?.[0] === 'number' ? Math.round(fixedWidths[0]!) : 34;
  let w2 = typeof fixedWidths?.[1] === 'number' ? Math.round(fixedWidths[1]!) : 33;
  w1 = Math.min(98, Math.max(1, w1));
  w2 = Math.min(98, Math.max(1, w2));
  if (w1 + w2 >= 99) {
    w2 = Math.max(1, 99 - w1);
  }
  return [w1, w2];
}

type ProportionPreviewBarProps = {
  fractions: number[];
  highlight: boolean;
};

const ProportionPreviewBar: FC<ProportionPreviewBarProps> = ({ fractions, highlight }) => {
  const theme = useTheme();
  const track = highlight ? theme.palette.secondary.main : '#e5e7eb';
  return (
    <div
      style={{
        ...styles.layoutPreview,
        gridTemplateColumns: fractions.map((w) => `${w}fr`).join(' '),
      }}
    >
      {fractions.map((_, index) => (
        <div
          key={index}
          style={{
            minWidth: 0,
            backgroundColor: track,
            borderRadius: '4px',
            transition: 'background-color 0.2s ease',
          }}
        />
      ))}
    </div>
  );
};

type LayoutSelectorProps = {
  defaultValue?: string | null;
  fixedWidths?: (number | null)[] | null;
  onChange: (v: { layout: string; fixedWidths: (number | null)[] }) => void;
  columns: 2 | 3;
};

const LayoutSelector: FC<LayoutSelectorProps> = ({
  defaultValue,
  fixedWidths,
  onChange,
  columns,
}) => {
  const { t } = useTranslation('inspector');
  const theme = useTheme();
  const [selectionOverride, setSelectionOverride] = useState<string | null>(null);
  const [customPanelOpen, setCustomPanelOpen] = useState(false);
  const [twoColLeft, setTwoColLeft] = useState(() => initTwoColDraft(fixedWidths ?? undefined));
  const [threeW1, setThreeW1] = useState(() => initThreeColDraft(fixedWidths ?? undefined)[0]);
  const [threeW2, setThreeW2] = useState(() => initThreeColDraft(fixedWidths ?? undefined)[1]);

  const fallbackPresetId = columns === 2 ? 'layout-50-50' : 'layout-33-33-33';
  const rawLayout = defaultValue ?? fallbackPresetId;
  const normalizedDefault = rawLayout === 'layout-33-34-33' ? 'layout-33-33-33' : rawLayout;
  const effectiveLayout = selectionOverride ?? normalizedDefault;

  const [columnsCount, setColumnsCount] = useState(
    columns === 2 ? LAYOUTS_TWO_COLUMNS : LAYOUTS_THREE_COLUMNS,
  );

  const applyPreset = (layoutId: string, distribution: (null | number)[]) => {
    setSelectionOverride(null);
    setCustomPanelOpen(false);
    onChange({ layout: layoutId, fixedWidths: distribution });
  };

  const openCustomEditor = () => {
    setSelectionOverride(LAYOUT_CUSTOM_ID);
    setCustomPanelOpen(true);
    if (columns === 2) {
      setTwoColLeft(initTwoColDraft(fixedWidths ?? undefined));
    } else {
      const [a, b] = initThreeColDraft(fixedWidths ?? undefined);
      setThreeW1(a);
      setThreeW2(b);
    }
  };

  const confirmCustom = () => {
    if (columns === 2) {
      const left = twoColLeft;
      onChange({ layout: LAYOUT_CUSTOM_ID, fixedWidths: [left, 100 - left, null] });
    } else {
      const w1 = threeW1;
      const w2 = threeW2;
      onChange({ layout: LAYOUT_CUSTOM_ID, fixedWidths: [w1, w2, 100 - w1 - w2] });
    }
    setSelectionOverride(null);
  };

  useEffect(() => {
    setColumnsCount(columns === 2 ? LAYOUTS_TWO_COLUMNS : LAYOUTS_THREE_COLUMNS);
  }, [columns]);

  useEffect(() => {
    setSelectionOverride(null);
    setCustomPanelOpen(false);
  }, [columns, defaultValue]);

  useEffect(() => {
    const id = defaultValue;
    if (columns === 2) {
      if (
        id !== LAYOUT_CUSTOM_ID &&
        (id == null || !LAYOUTS_TWO_COLUMNS.some((l) => l.id === id))
      ) {
        onChange({ layout: 'layout-50-50', fixedWidths: [50, 50, null] });
      }
    } else if (id === 'layout-33-34-33') {
      onChange({ layout: 'layout-33-33-33', fixedWidths: [33.34, 33.33, 33.33] });
    } else if (
      id !== LAYOUT_CUSTOM_ID &&
      (id == null || !LAYOUTS_THREE_COLUMNS.some((l) => l.id === id))
    ) {
      onChange({ layout: 'layout-33-33-33', fixedWidths: [33.34, 33.33, 33.33] });
    }
  }, [columns, defaultValue, onChange]);

  const handleThreeW1 = (_: Event, v: number | number[]) => {
    const next = v as number;
    setThreeW1(next);
    setThreeW2((prev) => Math.max(1, Math.min(prev, 100 - next - 1)));
  };

  const handleThreeW2 = (_: Event, v: number | number[]) => {
    const next = v as number;
    const max = 100 - threeW1 - 1;
    setThreeW2(Math.max(1, Math.min(next, max)));
  };

  const twoRight = 100 - twoColLeft;
  const threeW3 = 100 - threeW1 - threeW2;

  const customCardSelected = effectiveLayout === LAYOUT_CUSTOM_ID;

  return (
    <FieldContainer>
      <LabelProperty label={t('inputs.layout.label')} />

      <div style={styles.grid}>
        {columnsCount.map((layout) => (
          <div
            key={layout.id}
            onClick={() => applyPreset(layout.id, layout.distribution)}
            style={{
              ...styles.card,
              border:
                effectiveLayout === layout.id
                  ? `2px solid ${theme.palette.secondary.main}`
                  : styles.card.border,
            }}
          >
            <div style={styles.cardContent}>
              <ProportionPreviewBar
                fractions={layout.distribution.filter((w): w is number => w != null)}
                highlight={effectiveLayout === layout.id}
              />
            </div>
          </div>
        ))}

        <div
          onClick={openCustomEditor}
          style={{
            ...styles.card,
            border: customCardSelected
              ? `2px solid ${theme.palette.secondary.main}`
              : styles.card.border,
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openCustomEditor();
            }
          }}
        >
          <div style={styles.cardContent}>
            <Box
              sx={{
                width: '100%',
                height: 30,
                minHeight: 30,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: customCardSelected ? 'action.selected' : 'action.hover',
                color: 'text.primary',
                transition: theme.transitions.create(['background-color'], {
                  duration: theme.transitions.duration.shorter,
                }),
              }}
            >
              <EditOutlined sx={{ fontSize: 18, color: 'text.primary' }} />
            </Box>
          </div>
        </div>
      </div>

      <Collapse in={customPanelOpen} timeout="auto" unmountOnExit>
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {columns === 2 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {twoColLeft}% | {twoRight}%
              </Typography>
              <Slider
                value={twoColLeft}
                min={1}
                max={99}
                step={1}
                valueLabelDisplay="auto"
                aria-label={t('inputs.layout.custom.split2')}
                onChange={(_, v) => setTwoColLeft(v as number)}
              />
              <ProportionPreviewBar fractions={[twoColLeft, twoRight]} highlight />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {threeW1}% | {threeW2}% | {threeW3}%
              </Typography>
              <Box>
                <Typography variant="caption" color="text.secondary" component="div">
                  {t('inputs.layout.custom.firstColumn')}
                </Typography>
                <Slider
                  value={threeW1}
                  min={1}
                  max={98}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={handleThreeW1}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" component="div">
                  {t('inputs.layout.custom.secondColumn')}
                </Typography>
                <Slider
                  value={threeW2}
                  min={1}
                  max={100 - threeW1 - 1}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={handleThreeW2}
                />
              </Box>
              <ProportionPreviewBar fractions={[threeW1, threeW2, threeW3]} highlight />
            </Stack>
          )}

          <Button variant="contained" size="small" sx={{ mt: 2 }} onClick={confirmCustom}>
            <Typography
              variant="button"
              component="span"
              sx={{ color: '#FFFFFF', fontWeight: 'bold' }}
            >
              {t('inputs.layout.custom.apply')}
            </Typography>
          </Button>
        </Box>
      </Collapse>
    </FieldContainer>
  );
};

export default LayoutSelector;
