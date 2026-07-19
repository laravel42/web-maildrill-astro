import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { MonitorOutlined, PhoneIphoneOutlined } from '@mui/icons-material';
import { Box, Container, Tab, Tabs, useTheme } from '@mui/material';

import { COMPACT_PANEL_WIDTH, HEADER_HEIGHT } from '../../constants';
import { BLOCKS_DEFAULT_CSS } from '../../documents/blocks/helpers/constants';
import {
  lateralPanel,
  setSelectedScreenSize,
  setSidebarTab,
  setWindowWidth,
  useBlockTypeSelected,
  useInspectorDrawerMode,
  useSelectedBlockId,
  useSelectedScreenSize,
  useSelectedSidebarTab,
} from '../../documents/editor/EditorContext';

import { CompactModeProvider } from './CompactModeContext';
import ConfigurationPanel from './ConfigurationPanel';
import StylesPanel from './StylesPanel';

export default function InspectorDrawer({ sticky, heightContent }: { sticky: boolean; heightContent?: string }) {
  const selectedSidebarTab = useSelectedSidebarTab();
  const typeSelected = useBlockTypeSelected();
  const selectedBlockId = useSelectedBlockId();
  const selectedScreenSize = useSelectedScreenSize();
  const inspectorDrawerMode = useInspectorDrawerMode();
  const theme = useTheme();
  const { t } = useTranslation('inspector');

  useEffect(() => {
    const resizeWindow = (event: Event) => {
      const window = event.target! as Window;
      setWindowWidth(window.innerWidth);
    };
    if (window) {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', resizeWindow);

    return () => {
      window.removeEventListener('resize', resizeWindow);
    };
  }, [selectedSidebarTab]);

  const renderCurrentSidebarPanel = () => {
    const screenIconSx = {
      position: 'absolute',
      top: '1rem',
      right: '0.5rem',
      color: 'primary.main',
      fontSize: '20px',
      cursor: 'pointer',
      display: isCompact ? 'none' : undefined,
    } as const;

    const toggleScreen = () => setSelectedScreenSize(selectedScreenSize === 'desktop' ? 'mobile' : 'desktop');

    // In compact mode, always show ConfigurationPanel for blocks that have content+styles tabs
    const showConfiguration =
      selectedSidebarTab === 'block-configuration' ||
      selectedSidebarTab === 'css' ||
      (isCompact && selectedBlockId && !BLOCKS_DEFAULT_CSS.includes(typeSelected || ''));

    if (showConfiguration) {
      return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 0 auto' }}>
          {selectedScreenSize === 'desktop' ? (
            <MonitorOutlined sx={screenIconSx} onClick={toggleScreen} />
          ) : (
            <PhoneIphoneOutlined sx={screenIconSx} onClick={toggleScreen} />
          )}

          <ConfigurationPanel />
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 0 auto' }}>
        <StylesPanel />
        {selectedScreenSize === 'desktop' ? (
          <MonitorOutlined sx={screenIconSx} onClick={toggleScreen} />
        ) : (
          <PhoneIphoneOutlined sx={screenIconSx} onClick={toggleScreen} />
        )}
      </div>
    );
  };

  const ContentIcon = () => (
    <svg style={{ marginRight: '4px', color: 'inherit' }} width="21" height="20" viewBox="0 0 21 20" fill="none">
      <path
        d="M3.83398 5H17.1673M3.83398 10H17.1673M3.83398 15H9.66732"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const StyleIcon = () => (
    <svg style={{ marginRight: '4px', color: 'inherit' }} width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5.83333 17.5C3.99238 17.5 2.5 16.0076 2.5 14.1667V4.16667C2.5 3.24619 3.24619 2.5 4.16667 2.5H7.5C8.42047 2.5 9.16667 3.24619 9.16667 4.16667V14.1667C9.16667 16.0076 7.67428 17.5 5.83333 17.5ZM5.83333 17.5H15.8333C16.7538 17.5 17.5 16.7538 17.5 15.8333V12.5C17.5 11.5795 16.7538 10.8333 15.8333 10.8333H13.8807M9.16669 6.11927L10.5474 4.73858C11.1983 4.0877 12.2535 4.0877 12.9044 4.73858L15.2614 7.0956C15.9123 7.74647 15.9123 8.80175 15.2614 9.45262L8.19036 16.5237M5.83333 14.1667H5.84167"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const onChangeSideBar = (_: any, v: any) => {
    setSidebarTab(v);
  };
  const sideMaxHeight = sticky
    ? heightContent
      ? `calc(${heightContent} - 4px)`
      : undefined
    : (heightContent ?? undefined);

  const isCompact = inspectorDrawerMode === 'compact';

  return (
    <CompactModeProvider value={isCompact}>
      <Container
        sx={(t) => ({
          width: isCompact ? COMPACT_PANEL_WIDTH : lateralPanel,
          padding: '0!important',
          margin: '0!important',
          height: sideMaxHeight,
          maxHeight: sideMaxHeight,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: sticky ? 'sticky' : 'static',
          top: sticky ? HEADER_HEIGHT : 0,
          backgroundColor: `${t.palette.background.paper} !important`,
        })}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            backgroundColor: `${theme.palette.background.paper} !important`,
            display: isCompact ? 'none' : undefined,
          }}
        >
          <Tabs
            sx={{
              backgroundColor: `${theme.palette.background.paper} !important`,
            }}
            value={selectedSidebarTab}
            onChange={onChangeSideBar}
          >
            {selectedBlockId != null &&
              !BLOCKS_DEFAULT_CSS.includes(typeSelected || '') && [
                <Tab
                  sx={{
                    height: HEADER_HEIGHT,
                    minHeight: HEADER_HEIGHT,
                    fontWeight: 'bold',
                  }}
                  key="block-configuration"
                  value="block-configuration"
                  label={t('header.content')}
                  icon={<ContentIcon />}
                  iconPosition="start"
                />,
                <Tab
                  sx={{
                    height: HEADER_HEIGHT,
                    minHeight: HEADER_HEIGHT,
                    fontWeight: 'bold',
                  }}
                  key="css"
                  value="css"
                  label={t('header.styles')}
                  icon={<StyleIcon />}
                  iconPosition="start"
                />,
              ]}
            {selectedBlockId != null &&
              BLOCKS_DEFAULT_CSS.includes(typeSelected) && [
                <Tab
                  sx={{
                    height: HEADER_HEIGHT,
                    minHeight: HEADER_HEIGHT,
                    fontWeight: 'bold',
                  }}
                  key="styles"
                  value="styles"
                  label={t('header.styles')}
                  icon={<StyleIcon />}
                  iconPosition="start"
                />,
              ]}
            {selectedBlockId == null && (
              <Tab
                sx={{
                  height: HEADER_HEIGHT,
                  minHeight: HEADER_HEIGHT,
                  fontWeight: 'bold',
                }}
                key="styles"
                value="styles"
                label={t('header.styles')}
                icon={<StyleIcon />}
                iconPosition="start"
              />
            )}
          </Tabs>
        </Box>
        <Container
          sx={(t) => ({
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            px: isCompact ? '0.5rem!important' : '1rem!important',
            backgroundColor: `${t.palette.background.paper} !important`,
          })}
        >
          {renderCurrentSidebarPanel()}
        </Container>
      </Container>
    </CompactModeProvider>
  );
}
