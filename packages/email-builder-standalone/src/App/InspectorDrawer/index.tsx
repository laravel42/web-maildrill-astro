import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  KeyboardDoubleArrowLeftOutlined,
  KeyboardDoubleArrowRightOutlined,
} from '@mui/icons-material';
import { Box, Container, IconButton, Tab, Tabs, Tooltip, useTheme } from '@mui/material';

import { COMPACT_PANEL_WIDTH, HEADER_HEIGHT } from '../../constants';
import { BLOCKS_DEFAULT_CSS } from '../../documents/blocks/helpers/constants';
import {
  lateralPanel,
  setSelectedScreenSize,
  setSidebarTab,
  setWindowWidth,
  useBlockTypeSelected,
  setInspectorDrawerMode,
  useInspectorDrawerMode,
  useSelectedBlockId,
  useSelectedScreenSize,
  useSelectedSidebarTab,
} from '../../documents/editor/EditorContext';

import { CompactModeProvider } from './CompactModeContext';
import ConfigurationPanel from './ConfigurationPanel';
import StylesPanel from './StylesPanel';
import { dataTourAttr, EMAIL_BUILDER_TOUR_ANCHORS } from '../../tour/tourAnchors';

export default function InspectorDrawer({
  sticky,
  heightContent,
}: {
  sticky: boolean;
  heightContent?: string;
}) {
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
    // In compact mode, always show ConfigurationPanel for blocks that have content+styles tabs
    const showConfiguration =
      selectedSidebarTab === 'block-configuration' ||
      selectedSidebarTab === 'css' ||
      (isCompact && selectedBlockId && !BLOCKS_DEFAULT_CSS.includes(typeSelected || ''));

    if (showConfiguration) {
      return (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 0 auto',
          }}
        >
          <ConfigurationPanel />
        </div>
      );
    }

    return (
      <div
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 0 auto' }}
      >
        <StylesPanel />
      </div>
    );
  };

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
        {...dataTourAttr(EMAIL_BUILDER_TOUR_ANCHORS.inspectorPanel)}
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
        {/* One row for the tab strip and the collapse control, at the same
            height as the canvas toolbar so the two read as a single band
            across the editor. The control stays outside <Tabs> so it survives
            compact mode, which hides the strip. */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCompact ? 'center' : 'space-between',
            gap: 0.5,
            minHeight: HEADER_HEIGHT,
            height: HEADER_HEIGHT,
            px: isCompact ? 0 : 0.5,
            backgroundColor: `${theme.palette.background.paper} !important`,
          }}
        >
          <Box
            {...dataTourAttr(EMAIL_BUILDER_TOUR_ANCHORS.inspectorTabs)}
            sx={{ display: isCompact ? 'none' : 'flex', alignItems: 'center', minWidth: 0 }}
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
                      // Toned down from bold/14: the tab strip labels a panel,
                      // it shouldn't out-shout the controls beneath it.
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                    key="block-configuration"
                    value="block-configuration"
                    label={t('header.content')}
                  />,
                  <Tab
                    sx={{
                      height: HEADER_HEIGHT,
                      minHeight: HEADER_HEIGHT,
                      // Toned down from bold/14: the tab strip labels a panel,
                      // it shouldn't out-shout the controls beneath it.
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                    key="css"
                    value="css"
                    label={t('header.styles')}
                  />,
                ]}
              {selectedBlockId != null &&
                BLOCKS_DEFAULT_CSS.includes(typeSelected) && [
                  <Tab
                    sx={{
                      height: HEADER_HEIGHT,
                      minHeight: HEADER_HEIGHT,
                      // Toned down from bold/14: the tab strip labels a panel,
                      // it shouldn't out-shout the controls beneath it.
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                    key="styles"
                    value="styles"
                    label={t('header.styles')}
                  />,
                ]}
              {selectedBlockId == null && (
                <Tab
                  sx={{
                    height: HEADER_HEIGHT,
                    minHeight: HEADER_HEIGHT,
                    fontSize: '12.5px',
                    fontWeight: 600,
                  }}
                  key="styles"
                  value="styles"
                  label={t('header.styles')}
                />
              )}
            </Tabs>
          </Box>
          <Tooltip
            title={
              isCompact
                ? t('header.expandPanel', 'Expand panel')
                : t('header.collapsePanel', 'Collapse panel')
            }
            placement="left"
          >
            <IconButton
              size="small"
              aria-label={
                isCompact
                  ? t('header.expandPanel', 'Expand panel')
                  : t('header.collapsePanel', 'Collapse panel')
              }
              onClick={() => setInspectorDrawerMode(isCompact ? 'full' : 'compact')}
            >
              {isCompact ? (
                <KeyboardDoubleArrowLeftOutlined fontSize="small" />
              ) : (
                <KeyboardDoubleArrowRightOutlined fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
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
