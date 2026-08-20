import React, { useEffect, useMemo, useState } from 'react';

import { Box, Tab, Tabs } from '@mui/material';

/**
 * Canonical keys for the image-source tabs.
 * - `gallery`     — built-in Unsplash picker (controlled by `unsplashEnabled`).
 * - `yourGallery` — host-provided `customImageProvider` slot.
 * - `upload`      — default URL input + drag-and-drop file uploader.
 */
export type ImageSourceTabKey = 'gallery' | 'yourGallery' | 'upload';

export interface ImageSourceTabDefinition {
  key: ImageSourceTabKey;
  label: string;
  /** Tabs with `visible: false` are omitted from the strip entirely. */
  visible: boolean;
  /** Rendered only while the tab is active. */
  render: () => React.ReactNode;
}

export interface ImageSourceTabsProps {
  tabs: ImageSourceTabDefinition[];
  /** Preferred default tab key; falls back to the first visible tab. */
  defaultTab?: ImageSourceTabKey;
}

/**
 * Lightweight tab switcher used by `ImageInput` and `BackgroundImageInput`.
 *
 * When only one tab is visible (e.g. no `customImageProvider`, no Unsplash),
 * the strip disappears and we render the single tab's content inline — so
 * existing single-source setups keep the exact same UX.
 */
const ImageSourceTabs: React.FC<ImageSourceTabsProps> = ({ tabs, defaultTab }) => {
  const visible = useMemo(() => tabs.filter((t) => t.visible), [tabs]);
  const [active, setActive] = useState<ImageSourceTabKey | null>(null);

  // Keep `active` in sync with the visible set. If the currently-active tab
  // is hidden (e.g. host toggles Unsplash off), fall back to the first
  // visible one so we never render nothing while a strip is still shown.
  useEffect(() => {
    if (active && visible.some((t) => t.key === active)) return;
    const next =
      defaultTab && visible.some((t) => t.key === defaultTab)
        ? defaultTab
        : (visible[0]?.key ?? null);
    setActive(next);
  }, [visible, defaultTab, active]);

  if (visible.length === 0) return null;
  if (visible.length === 1) {
    // Single-source: skip the tab strip — no point in showing a strip of one.
    return <Box>{visible[0].render()}</Box>;
  }

  const activeTab = visible.find((t) => t.key === active) ?? visible[0];

  return (
    <Box>
      <Tabs
        value={activeTab.key}
        onChange={(_, v) => setActive(v as ImageSourceTabKey)}
        variant="fullWidth"
        sx={{
          minHeight: 34,
          mb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTabs-flexContainer': { gap: 0 },
          '& .MuiTab-root': {
            minHeight: 34,
            minWidth: 0,
            flex: 1,
            px: 1.25,
            py: 0.5,
            fontSize: '0.72rem',
            fontWeight: 500,
            textTransform: 'none',
            color: 'text.secondary',
            '&.Mui-selected': { color: 'primary.main' },
          },
        }}
      >
        {visible.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} disableRipple />
        ))}
      </Tabs>
      <Box>{activeTab.render()}</Box>
    </Box>
  );
};

export default ImageSourceTabs;
