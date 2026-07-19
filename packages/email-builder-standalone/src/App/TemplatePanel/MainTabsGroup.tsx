import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Tab, Tabs, Tooltip } from '@mui/material';

import {
  setSelectedMainTab,
  setSelectedScreenSize,
  useDevMode,
  useSelectedMainTab,
  useSelectedScreenSize,
} from '../../documents/editor/EditorContext';

type MainTabsGroupProps = {
  enableEditorTab?: boolean;
  enablePreviewTab?: boolean;
  enableHtmlTab?: boolean;
  enableJsonTab?: boolean;
};

export default function MainTabsGroup({
  enableEditorTab = true,
  enablePreviewTab = true,
  enableHtmlTab = true,
  enableJsonTab = true,
}: MainTabsGroupProps) {
  const selectedMainTab = useSelectedMainTab();
  const developmentMode = useDevMode();
  const selectedScreenSize = useSelectedScreenSize();
  const { t } = useTranslation('inspector');
  // Compute allowed tabs based on props and existing validations
  const allowedTabs = useMemo(() => {
    const tabs: Array<'editor' | 'preview' | 'html' | 'json'> = [];
    if (enableEditorTab) tabs.push('editor');
    if (enablePreviewTab) tabs.push('preview');
    if (enableHtmlTab) tabs.push('html');
    if (enableJsonTab && developmentMode) tabs.push('json');
    return tabs;
  }, [enableEditorTab, enablePreviewTab, enableHtmlTab, enableJsonTab, developmentMode]);

  // Keep selection valid if current tab becomes unavailable
  useEffect(() => {
    if (!allowedTabs.includes(selectedMainTab)) {
      setSelectedMainTab(allowedTabs[0] ?? 'editor');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTabs.join(','), selectedMainTab]);
  const handleChange = (_: unknown, v: unknown) => {
    const lastSelectedScreenSize: 'desktop' | 'mobile' =
      (sessionStorage.getItem('lastSelectedScreenSize') as 'desktop' | 'mobile' | null) || 'desktop';
    switch (v) {
      case 'html':
        setSelectedMainTab('html');
        sessionStorage.setItem('lastSelectedScreenSize', selectedScreenSize || 'desktop');
        setSelectedScreenSize('desktop');
        break;
      case 'preview':
      case 'json':
      case 'editor':
        setSelectedScreenSize(lastSelectedScreenSize);
        setSelectedMainTab(v);
        return;
      default:
        setSelectedMainTab('editor');
    }
  };

  return (
    <Tabs
      value={selectedMainTab}
      onChange={handleChange}
      slotProps={{
        indicator: {
          sx: {
            height: '3px',
            borderRadius: '4px',
          },
        },
      }}
    >
      {enableEditorTab && (
        <Tab
          id="tab-editor"
          value="editor"
          label={
            <Tooltip title={t('header.edit')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12.6935 4.36019L15.6398 7.30647M13.9435 3.11019C14.7571 2.2966 16.0762 2.2966 16.8898 3.11019C17.7034 3.92379 17.7034 5.24288 16.8898 6.05647L5.41667 17.5296H2.5V14.5537L13.9435 3.11019Z"
                  stroke="inherit"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Tooltip>
          }
        />
      )}
      {enablePreviewTab && (
        <Tab
          id="tab-preview"
          value="preview"
          label={
            <Tooltip title={t('header.preview')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12.5003 9.99984C12.5003 11.3805 11.381 12.4998 10.0003 12.4998C8.61957 12.4998 7.50029 11.3805 7.50029 9.99984C7.50029 8.61913 8.61957 7.49984 10.0003 7.49984C11.381 7.49984 12.5003 8.61913 12.5003 9.99984Z"
                  stroke="inherit"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2.04883 9.99981C3.11072 6.6189 6.26929 4.1665 10.0007 4.1665C13.732 4.1665 16.8906 6.61893 17.9525 9.99987C16.8906 13.3808 13.732 15.8332 10.0007 15.8332C6.26929 15.8332 3.11071 13.3807 2.04883 9.99981Z"
                  stroke="inherit"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Tooltip>
          }
        />
      )}
      {enableHtmlTab && (
        <Tab
          id="tab-html"
          key="html"
          value="html"
          label={
            <Tooltip title={t('header.htmlOutput')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8.33268 16.6668L11.666 3.3335M14.9993 6.66683L18.3327 10.0002L14.9993 13.3335M4.99935 13.3335L1.66602 10.0002L4.99935 6.66683"
                  stroke="inherit"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Tooltip>
          }
        />
      )}
      {enableJsonTab && developmentMode && (
        <Tab
          id="tab-json"
          key="json"
          value="json"
          label={
            <Tooltip title={t('header.jsonOutput')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7.49935 10L12.4993 10M7.49935 13.3333L12.4993 13.3333M14.166 17.5H5.83268C4.91221 17.5 4.16602 16.7538 4.16602 15.8333L4.16602 4.16667C4.16602 3.24619 4.91221 2.5 5.83268 2.5L10.4875 2.5C10.7085 2.5 10.9205 2.5878 11.0768 2.74408L15.5886 7.25592C15.7449 7.4122 15.8327 7.62416 15.8327 7.84518L15.8327 15.8333C15.8327 16.7538 15.0865 17.5 14.166 17.5Z"
                  stroke="inherit"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Tooltip>
          }
        />
      )}
    </Tabs>
  );
}
