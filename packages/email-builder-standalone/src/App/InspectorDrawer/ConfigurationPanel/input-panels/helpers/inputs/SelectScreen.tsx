import React from 'react';
import { useTranslation } from 'react-i18next';

import { MonitorOutlined, PhoneIphoneOutlined } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

import { setSelectedScreenSize, useSelectedScreenSize } from '../../../../../../documents/editor/EditorContext';

const ScreenSizeSelector = () => {
  const selectedScreenSize = useSelectedScreenSize();
  const { t } = useTranslation('inspector');

  const handleScreenSizeChange = (_: unknown, value: unknown) => {
    switch (value) {
      case 'mobile':
      case 'desktop':
        setSelectedScreenSize(value);
        return;
      default:
        setSelectedScreenSize('desktop');
    }
  };

  return (
    <ToggleButtonGroup
      value={selectedScreenSize}
      exclusive
      size="small"
      onChange={handleScreenSizeChange}
      sx={{ '& .MuiToggleButtonGroup-grouped': { minWidth: 40, py: 0.75 } }}
    >
      <ToggleButton value="desktop">
        <Tooltip title={t('inputs.screenSelector.desktop')}>
          <MonitorOutlined fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="mobile">
        <Tooltip title={t('inputs.screenSelector.mobile')}>
          <PhoneIphoneOutlined fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
};

export default ScreenSizeSelector;
