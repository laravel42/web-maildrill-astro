import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Lock, LockOpen, type SvgIconComponent } from '@mui/icons-material';
import { IconButton, Stack, SvgIcon, type SvgIconProps, Tooltip } from '@mui/material';

import FieldContainer from './components/FieldContainer';
import LabelProperty from './LabelProperty';
import RawSliderInput from './raw/RawSliderInput';

function PaddingTopIcon(props: any) {
  return (
    <SvgIcon {...props} viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M0 0v16h16V0zm15 3h-1v1h1v11H1V3h1V2H1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1z"
      />
      <path
        fill="currentColor"
        d="M3 2h1v1H3zM2 3h1v1H2zm2 0h1v1H4zm2 0h1v1H6zM5 2h1v1H5zm2 0h1v1H7zm2 0h1v1H9zM8 3h1v1H8zm2 0h1v1h-1zm2 0h1v1h-1zm-1-1h1v1h-1zm2 0h1v1h-1z"
      />
    </SvgIcon>
  );
}

function PaddingBottomIcon(props: any) {
  return (
    <SvgIcon {...props} viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M16 16V0H0v16zM1 13h1v-1H1V1h14v12h-1v1h1v1h-1v-1h-1v1h-1v-1h-1v1h-1v-1H9v1H8v-1H7v1H6v-1H5v1H4v-1H3v1H2v-1H1z"
      />
      <path
        fill="currentColor"
        d="M12 13h1v1h-1zm1-1h1v1h-1zm-2 0h1v1h-1zm-2 0h1v1H9zm1 1h1v1h-1zm-2 0h1v1H8zm-2 0h1v1H6zm1-1h1v1H7zm-2 0h1v1H5zm-2 0h1v1H3zm1 1h1v1H4zm-2 0h1v1H2z"
      />
    </SvgIcon>
  );
}

function PaddingLeftIcon(props: any) {
  return (
    <SvgIcon {...props} viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M0 16h16V0H0zM3 1v1h1V1h11v14H3v-1H2v1H1v-1h1v-1H1v-1h1v-1H1v-1h1V9H1V8h1V7H1V6h1V5H1V4h1V3H1V2h1V1z"
      />
      <path
        fill="currentColor"
        d="M2 12h1v1H2zm1 1h1v1H3zm0-2h1v1H3zm0-2h1v1H3zm-1 1h1v1H2zm0-2h1v1H2zm0-2h1v1H2zm1 1h1v1H3zm0-2h1v1H3zm0-2h1v1H3zM2 4h1v1H2zm0-2h1v1H2z"
      />
    </SvgIcon>
  );
}

function PaddingRightIcon(props: any) {
  return (
    <SvgIcon {...props} viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M16 0H0v16h16zm-3 15v-1h-1v1H1V1h12v1h1V1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1z"
      />
      <path
        fill="currentColor"
        d="M13 3h1v1h-1zm-1-1h1v1h-1zm0 2h1v1h-1zm0 2h1v1h-1zm1-1h1v1h-1zm0 2h1v1h-1zm0 2h1v1h-1zm-1-1h1v1h-1zm0 2h1v1h-1zm0 2h1v1h-1zm1-1h1v1h-1zm0 2h1v1h-1z"
      />
    </SvgIcon>
  );
}

export const PaddingIcon: SvgIconComponent = ((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 16 16">
    <path
      fill="currentColor"
      d="M0 0v16h16V0zm15 3h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v1h1v1h-1v-1h-1v1h-1v-1h-1v1h-1v-1H9v1H8v-1H7v1H6v-1H5v1H4v-1H3v1H2v-1H1v-1h1v-1H1v-1h1v-1H1V9h1V8H1V7h1V6H1V5h1V4H1V3h1V2H1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1V1h1v1h1z"
    />
    <path
      fill="currentColor"
      d="M3 2h1v1H3zm1 1h1v1H4zm2 0h1v1H6zM5 2h1v1H5zm2 0h1v1H7zm2 0h1v1H9zM8 3h1v1H8zm2 0h1v1h-1zm2 0h1v1h-1zm-1-1h1v1h-1zm2 0h1v1h-1zm-1 3h1v1h-1zm1-1h1v1h-1zm-1 3h1v1h-1zm1-1h1v1h-1zm-1 3h1v1h-1zm1-1h1v1h-1zm-1 3h1v1h-1zm1-1h1v1h-1zm-1 3h1v1h-1zm1-1h1v1h-1zM2 3h1v1H2zm1 1h1v1H3zM2 5h1v1H2zm1 1h1v1H3zM2 7h1v1H2zm1 1h1v1H3zM2 9h1v1H2zm1 1h1v1H3zm-1 1h1v1H2zm0 2h1v1H2zm1-1h1v1H3zm1-1h1v1H4zm0 2h1v1H4zm1-1h1v1H5zm1 1h1v1H6zm1-1h1v1H7zm2 0h1v1H9zm-1 1h1v1H8zm3-1h1v1h-1zm-1 1h1v1h-1z"
    />
  </SvgIcon>
)) as unknown as SvgIconComponent;
PaddingIcon.muiName = 'PaddingIcon';

type TPaddingValue = {
  top: number;
  bottom: number;
  right: number;
  left: number;
};
type Props = {
  label: string;
  labelAction?: React.ReactNode;
  defaultValue: TPaddingValue | null;
  onChange: (value: TPaddingValue) => void;
  /** Persisted: single-slider mode only when `true`. */
  sidesLinked?: boolean;
  onSidesLinkedChange: (linked: boolean) => void;
  /**
   * Phase 2c — signals that the value comes from the document theme
   * (`'theme'`) or the block schema default (`'default'`). The input
   * applies a muted visual treatment so the inheritance is obvious;
   * editing always promotes the value to explicit on the block.
   */
  inheritedFrom?: 'theme' | 'default';
};

export default function PaddingInput({
  label,
  labelAction,
  defaultValue,
  onChange,
  sidesLinked,
  onSidesLinkedChange,
  inheritedFrom,
}: Props) {
  const MAX_SIZE_PADDING = 120;
  const { t } = useTranslation('inspector');
  const [value, setValue] = useState(() => {
    if (defaultValue) {
      return defaultValue;
    }
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    };
  });
  useEffect(() => {
    if (!defaultValue) return;
    if (
      defaultValue.top !== value.top ||
      defaultValue.left !== value.left ||
      defaultValue.bottom !== value.bottom ||
      defaultValue.right !== value.right
    ) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);
  const allSidesEqual =
    value.top === value.bottom && value.top === value.left && value.top === value.right;
  const isLocked = sidesLinked === true && allSidesEqual;

  function handleChange(internalName: keyof TPaddingValue, nValue: number) {
    let v: TPaddingValue;
    if (isLocked) {
      // Cuando está bloqueado, aplicar el mismo valor a todos los lados
      v = {
        top: nValue,
        bottom: nValue,
        left: nValue,
        right: nValue,
      };
    } else {
      v = {
        ...value,
        [internalName]: nValue,
      };
    }
    setValue(v);
    onChange(v);
  }

  const toggleLock = () => {
    const nextLocked = !isLocked;
    if (!isLocked) {
      // Unificar al valor actual superior para evitar saltos inesperados
      const lockedValue: TPaddingValue = {
        top: value.top,
        bottom: value.top,
        left: value.top,
        right: value.top,
      };
      setValue(lockedValue);
      onChange(lockedValue);
    }
    onSidesLinkedChange(nextLocked);
  };

  return (
    <FieldContainer>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <LabelProperty label={label} action={labelAction} />
        <Tooltip title={isLocked ? t('lockValues.unlockTooltip') : t('lockValues.lockTooltip')}>
          <IconButton
            size="small"
            onClick={toggleLock}
            sx={{
              marginTop: '0!important',
              color: isLocked ? 'primary.main' : 'text.secondary',
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            {isLocked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack
        spacing={1}
        sx={{ opacity: inheritedFrom ? 0.55 : 1, transition: 'opacity 120ms ease-out' }}
      >
        {isLocked ? (
          <RawSliderInput
            iconLabel={<span>{t('inputs.responsiveSize.allSides')}</span>}
            value={value.top}
            setValue={(num) => handleChange('top', num)}
            units="px"
            step={16}
            min={0}
            max={MAX_SIZE_PADDING}
            marks
          />
        ) : (
          <>
            <RawSliderInput
              iconLabel={<PaddingTopIcon sx={{ fontSize: 16, color: 'text.primary' }} />}
              value={value.top}
              setValue={(num) => handleChange('top', num)}
              units="px"
              step={16}
              min={0}
              max={MAX_SIZE_PADDING}
              marks
            />

            <RawSliderInput
              iconLabel={<PaddingBottomIcon sx={{ fontSize: 16, color: 'text.primary' }} />}
              value={value.bottom}
              setValue={(num) => handleChange('bottom', num)}
              units="px"
              step={16}
              min={0}
              max={MAX_SIZE_PADDING}
              marks
            />

            <RawSliderInput
              iconLabel={<PaddingLeftIcon sx={{ fontSize: 16, color: 'text.primary' }} />}
              value={value.left}
              setValue={(num) => handleChange('left', num)}
              units="px"
              step={16}
              min={0}
              max={MAX_SIZE_PADDING}
              marks
            />

            <RawSliderInput
              iconLabel={<PaddingRightIcon sx={{ fontSize: 16, color: 'text.primary' }} />}
              value={value.right}
              setValue={(num) => handleChange('right', num)}
              units="px"
              step={16}
              min={0}
              max={MAX_SIZE_PADDING}
              marks
            />
          </>
        )}
      </Stack>
    </FieldContainer>
  );
}
