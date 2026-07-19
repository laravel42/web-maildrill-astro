import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InfoOutlined } from '@mui/icons-material';
import { InputLabel, Stack } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';

import TextDimensionInput from './TextDimensionInput';
export const DEFAULT_2_COLUMNS = [6] as [number];
export const DEFAULT_3_COLUMNS = [4, 8] as [number, number];

type TWidthValue = number | null | undefined;
type FixedWidths = [
  //
  number | null | undefined,
  number | null | undefined,
  number | null | undefined,
];
type ColumnsLayoutInputProps = {
  defaultValue: FixedWidths | null | undefined;
  onChange: (v: FixedWidths | null | undefined) => void;
  columnsCount: 2 | 3;
};
export default function ColumnWidthsInput({ defaultValue, onChange, columnsCount }: ColumnsLayoutInputProps) {
  const { t } = useTranslation('inspector');
  const [currentValue, setCurrentValue] = useState<[TWidthValue, TWidthValue, TWidthValue]>(() => {
    if (defaultValue) {
      return defaultValue;
    }
    return [null, null, null];
  });
  useEffect(() => {
    if (defaultValue?.find((v) => v !== null)) {
      setCurrentValue(defaultValue);
    }
  }, [defaultValue]);

  const setIndexValue = (index: 0 | 1 | 2, value: number | null | undefined) => {
    const nValue: FixedWidths = [...currentValue];
    nValue[index] = value;
    setCurrentValue(nValue);
    onChange(nValue);
  };

  const column3 = () => {
    if (columnsCount === 3) {
      return (
        <TextDimensionInput
          width
          label={t('inputs.columnWidths.right')}
          value={currentValue?.[2]}
          onChange={(v) => {
            setIndexValue(2, v);
          }}
        />
      );
    }
    return null;
  };

  return (
    <div>
      <InputLabel shrink>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {t('inputs.columnWidths.label')}
          <Tooltip title={t('inputs.columnWidths.tooltip')}>
            <InfoOutlined sx={{ fontSize: 16, color: '#6b7280' }} />
          </Tooltip>
        </span>
      </InputLabel>
      <Stack direction="row" spacing={1} sx={{ marginTop: '1rem' }}>
        <TextDimensionInput
          label={t('inputs.columnWidths.left')}
          width
          value={currentValue?.[0]}
          onChange={(v) => {
            setIndexValue(0, v);
          }}
        />
        <TextDimensionInput
          width
          label={columnsCount === 3 ? t('inputs.columnWidths.center') : t('inputs.columnWidths.right')}
          value={currentValue?.[1]}
          onChange={(v) => {
            setIndexValue(1, v);
          }}
        />
        {column3()}
      </Stack>
    </div>
  );
}
