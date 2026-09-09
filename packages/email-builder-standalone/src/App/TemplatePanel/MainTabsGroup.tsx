import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import './history.css';

import {
  setSelectedMainTab,
  setSelectedScreenSize,
  useDevMode,
  useSelectedMainTab,
  useSelectedScreenSize,
} from '../../documents/editor/EditorContext';

type MainTab = 'editor' | 'preview' | 'html' | 'json';

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
  const allowedTabs = useMemo(() => {
    const tabs: MainTab[] = [];
    if (enableEditorTab) tabs.push('editor');
    if (enablePreviewTab) tabs.push('preview');
    if (enableHtmlTab) tabs.push('html');
    if (enableJsonTab && developmentMode) tabs.push('json');
    return tabs;
  }, [enableEditorTab, enablePreviewTab, enableHtmlTab, enableJsonTab, developmentMode]);

  useEffect(() => {
    if (!allowedTabs.includes(selectedMainTab)) {
      setSelectedMainTab(allowedTabs[0] ?? 'editor');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTabs.join(','), selectedMainTab]);

  const selectTab = (v: MainTab) => {
    const lastSelectedScreenSize: 'desktop' | 'mobile' =
      (sessionStorage.getItem('lastSelectedScreenSize') as 'desktop' | 'mobile' | null) ||
      'desktop';
    if (v === 'html') {
      sessionStorage.setItem('lastSelectedScreenSize', selectedScreenSize || 'desktop');
      setSelectedScreenSize('desktop');
      setSelectedMainTab('html');
      return;
    }
    setSelectedScreenSize(lastSelectedScreenSize);
    setSelectedMainTab(v);
  };

  const items: { id: string; value: MainTab; label: string }[] = [];
  if (enableEditorTab) items.push({ id: 'tab-editor', value: 'editor', label: t('header.edit') });
  if (enablePreviewTab) items.push({ id: 'tab-preview', value: 'preview', label: t('header.preview') });
  if (enableHtmlTab) items.push({ id: 'tab-html', value: 'html', label: t('header.htmlOutput') });
  if (enableJsonTab && developmentMode) {
    items.push({ id: 'tab-json', value: 'json', label: t('header.jsonOutput') });
  }

  return (
    <div className="eb-view-tabs" role="group">
      {items.map((item) => (
        <button
          key={item.value}
          id={item.id}
          type="button"
          className={
            'eb-view-tabs__btn' +
            (selectedMainTab === item.value ? ' eb-view-tabs__btn--active' : '')
          }
          aria-pressed={selectedMainTab === item.value}
          onClick={() => selectTab(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
