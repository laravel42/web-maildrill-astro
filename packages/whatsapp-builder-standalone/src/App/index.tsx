import React, { useEffect } from 'react';

import { Box } from '@mui/material';

import {
  setBusinessName,
  setDarkMode,
  setDisableEdition,
  useSelectedMainTab,
} from '../documents/editor/EditorContext';
import BlocksPalette from './BlocksPalette';
import InspectorDrawer from './InspectorDrawer';
import TemplatePanel from './TemplatePanel';

export type AppProps = {
  darkMode?: boolean;
  businessName?: string;
  disableEdition?: boolean;
  height?: string;
};

/**
 * Three-zone layout mirroring the email builder's App: palette (left),
 * canvas (center), inspector (right). Props sync into the store via
 * one effect per prop, same pattern as the email builder.
 */
export default function App({ darkMode = false, businessName, disableEdition = false, height = '100%' }: AppProps) {
  const mainTab = useSelectedMainTab();

  useEffect(() => setDarkMode(darkMode), [darkMode]);
  useEffect(() => {
    if (businessName) setBusinessName(businessName);
  }, [businessName]);
  useEffect(() => setDisableEdition(disableEdition), [disableEdition]);

  return (
    <Box sx={{ display: 'flex', height, minHeight: 0, bgcolor: 'background.default' }}>
      {mainTab === 'editor' && !disableEdition && <BlocksPalette />}
      <TemplatePanel />
      {mainTab === 'editor' && !disableEdition && <InspectorDrawer />}
    </Box>
  );
}
