import React, { useEffect } from 'react';

import { Box, Container, useTheme } from '@mui/material';

import { COMPACT_PANEL_WIDTH } from '../constants';
import {
  DEFAULT_IMAGE_PLACEHOLDER,
  flushUndoRedo,
  getComponentsStorageMode,
  lateralPanel,
  setBackgroundUploadInput,
  setBackgroundUrlInput,
  setColor,
  setComponentsStorageMode,
  setContainerGrow,
  setDarkMode,
  setDevMode,
  setGalleryImages,
  setHeightContent,
  setImagePlaceholder,
  setImageUploadInput,
  setImageUrlInput,
  setInspectorDrawerModeAuto,
  setShowVersion,
  setStickyHeader,
  setTemplateSaving,
  setThemeSaving,
  useInspectorDrawerMode,
  useInspectorDrawerOpen,
} from '../documents/editor/EditorContext';
import { EmailBuilderWindow } from '../global';

import CommandPalette from './CommandPalette';
import { ComponentsLibraryDrawer, ComponentsLibraryHandle } from './ComponentsLibrary';
import InspectorDrawer from './InspectorDrawer';
import StickyWrapper from './InspectorDrawer/ConfigurationPanel/input-panels/helpers/containers/StickyWrapper';
import InspectorHandle from './InspectorDrawer/InspectorHandle';
import TemplatePanel from './TemplatePanel';

export type AppProps = {
  galleryImages?: boolean;
  darkMode?: boolean;
  tour?: boolean;
  stickyHeader?: boolean;
  heightContent?: string;
  containerGrow?: boolean;
  sticky?: boolean;
  htmlTab?: boolean;
  jsonTab?: boolean;
  imagePlaceholder?: string;
  imageUrlInput?: boolean;
  imageUploadInput?: boolean;
  backgroundUrlInput?: boolean;
  backgroundUploadInput?: boolean;
  componentTree?: boolean;
  showVersion?: boolean;
  /** Storage backend for Components Library Templates + Themes. */
  componentsStorage?: 'backend' | 'local';
  /** When false, hides template saving UI. Defaults to true. */
  templateSaving?: boolean;
  /** When true, shows the "Save as theme" button in the root inspector panel. Defaults to false. */
  themeSaving?: boolean;
};
export default function App({
  galleryImages = true,
  darkMode = false,
  stickyHeader = true,
  heightContent = null,
  containerGrow = true,
  sticky = false,
  htmlTab = false,
  jsonTab = false,
  imagePlaceholder = DEFAULT_IMAGE_PLACEHOLDER,
  imageUrlInput = true,
  imageUploadInput = true,
  backgroundUrlInput = true,
  backgroundUploadInput = true,
  componentTree = true,
  showVersion = false,
  componentsStorage = 'backend',
  templateSaving,
  themeSaving,
}: AppProps) {
  const inspectorDrawerOpen = useInspectorDrawerOpen();
  const inspectorDrawerMode = useInspectorDrawerMode();
  const theme = useTheme();
  const inspectorWidth = inspectorDrawerOpen
    ? inspectorDrawerMode === 'compact'
      ? COMPACT_PANEL_WIDTH
      : lateralPanel
    : 0;

  // Efecto inicial para configuración de devMode (solo una vez)
  useEffect(() => {
    const emailBuilderWindow = window as unknown as EmailBuilderWindow;
    const devMode = emailBuilderWindow.emailBuilder?.emailBuilderDevMode ?? true;
    setDevMode(devMode);
  }, []);

  // Auto-compact sidebar on narrow viewports (tablet / small windows).
  // Uses the auto setter so it never clobbers a hand-set inspector mode.
  useEffect(() => {
    const COMPACT_BREAKPOINT = 1024;
    const handleResize = () => {
      if (window.innerWidth < COMPACT_BREAKPOINT) {
        setInspectorDrawerModeAuto('compact');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Components Library storage backend ('backend' = dev `/dev/*` HTTP API,
  // 'local' = browser localStorage for Templates + Themes).
  //
  // Sync the prop into the store from an effect — NEVER during render. The
  // host may remount this whole tree by changing its `key` (e.g. the
  // playground bumps a mount key when the backend toggles). During a keyed
  // remount the PREVIOUS tree is still mounted and subscribed to
  // editorStateStore; calling setComponentsStorageMode during the new tree's
  // render would notify those live `useSyncExternalStore` subscribers
  // mid-render, re-enter React's work loop, and desync the hooks dispatcher
  // → "change in order of Hooks" crash. `setComponentsStorageMode` bumps the
  // library refresh nonce, so the drawer refetches its listings with the new
  // mode right after this effect runs.
  useEffect(() => {
    const mode = componentsStorage === 'local' ? 'local' : 'backend';
    if (getComponentsStorageMode() !== mode) {
      setComponentsStorageMode(mode);
    }
  }, [componentsStorage]);

  useEffect(() => {
    setTemplateSaving(templateSaving ?? true);
  }, [templateSaving]);

  useEffect(() => {
    setThemeSaving(themeSaving ?? false);
  }, [themeSaving]);

  // Local storage mode: seed the bundled preset catalog on first run
  // (version-gated), then lazily generate any missing preview
  // thumbnails. No-op outside local mode. Dynamic imports keep the
  // ~500 KB presets + capture code out of the main bundle.
  useEffect(() => {
    if (componentsStorage !== 'local') return;
    let cancelled = false;
    void (async () => {
      try {
        const { seedLocalLibrary } = await import('./ComponentsLibrary/seedLocalLibrary');
        await seedLocalLibrary();
        if (cancelled) return;
        const { generateMissingThumbnails } = await import('./ComponentsLibrary/lazyThumbnailGenerator');
        void generateMissingThumbnails();
      } catch (err) {
        console.warn('[EmailBuilder] local library seeding failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [componentsStorage]);

  // Dev-only: expose the one-off template importer as window.__seedTemplates.
  // Dynamic import + import.meta.env.DEV guard keep it out of prod builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import('./ComponentsLibrary/devSeedTemplates').then((m) => {
      (window as unknown as { __seedTemplates?: typeof m.seedTemplatesFromJson }).__seedTemplates =
        m.seedTemplatesFromJson;
    });
    void import('./ComponentsLibrary/devSeedSections').then((m) => {
      (window as unknown as { __seedSections?: typeof m.seedSections }).__seedSections = m.seedSections;
    });
    void import('./ComponentsLibrary/devRecaptureSectionThumbnails').then((m) => {
      (
        window as unknown as { __recaptureSectionThumbnails?: typeof m.recaptureSectionThumbnails }
      ).__recaptureSectionThumbnails = m.recaptureSectionThumbnails;
    });
    void import('./ComponentsLibrary/devRecaptureTemplateThumbnails').then((m) => {
      (
        window as unknown as { __recaptureTemplateThumbnails?: typeof m.recaptureTemplateThumbnails }
      ).__recaptureTemplateThumbnails = m.recaptureTemplateThumbnails;
    });
    void import('./ComponentsLibrary/devSeedThemes').then((m) => {
      (window as unknown as { __seedThemes?: typeof m.seedThemes }).__seedThemes = m.seedThemes;
    });
    void import('./ComponentsLibrary/devSeedPrimitives').then((m) => {
      (window as unknown as { __seedPrimitives?: typeof m.seedPrimitives }).__seedPrimitives = m.seedPrimitives;
    });
    void import('./ComponentsLibrary/devSeedLayouts').then((m) => {
      (window as unknown as { __seedLayouts?: typeof m.seedLayouts }).__seedLayouts = m.seedLayouts;
    });
  }, []);

  // Efectos separados para evitar re-renders innecesarios
  useEffect(() => {
    setGalleryImages(galleryImages);
  }, [galleryImages]);
  useEffect(() => {
    setDarkMode(darkMode);
  }, [darkMode]);
  useEffect(() => {
    setHeightContent(heightContent);
  }, [heightContent]);
  useEffect(() => {
    setContainerGrow(containerGrow);
  }, [containerGrow]);
  useEffect(() => {
    setImagePlaceholder(imagePlaceholder);
  }, [imagePlaceholder]);
  useEffect(() => {
    setImageUrlInput(imageUrlInput);
  }, [imageUrlInput]);
  useEffect(() => {
    setImageUploadInput(imageUploadInput);
  }, [imageUploadInput]);
  useEffect(() => {
    setBackgroundUrlInput(backgroundUrlInput);
  }, [backgroundUrlInput]);
  useEffect(() => {
    setBackgroundUploadInput(backgroundUploadInput);
  }, [backgroundUploadInput]);
  useEffect(() => {
    setStickyHeader(stickyHeader);
  }, [stickyHeader]);
  useEffect(() => {
    setShowVersion(showVersion);
  }, [showVersion]);

  // Efecto para colores del tema (separado porque el theme puede cambiar)
  useEffect(() => {
    setColor({
      primary: theme.palette.primary.main,
      secondary: theme.palette.secondary.main,
    });
  }, [theme.palette.primary.main, theme.palette.secondary.main]);

  // Listener para forzar guardado antes de salir de la página
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushUndoRedo();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // También hacer flush al desmontar el componente
      flushUndoRedo();
    };
  }, []);

  const hasFixedHeight = Boolean(heightContent);

  return (
    <Container
      className={`${darkMode ? 'dark-email-builder' : 'light-email-builder'}`}
      maxWidth={false}
      sx={(t) => {
        // Con altura fija: sin scroll en el contenedor raíz; canvas y side panel tienen scroll propio
        const noRootScroll = hasFixedHeight;

        return {
          margin: '0',
          position: 'relative',
          width: '100%',
          height: noRootScroll ? heightContent! : '100%',
          maxHeight: noRootScroll ? heightContent! : undefined,
          display: 'flex',
          overflowX: 'hidden',
          overflowY: noRootScroll ? 'hidden' : 'auto',
          padding: '0!important',
          border: `1px solid ${t.palette.divider}`,
          borderRadius: 2,
        };
      }}
    >
      {/* Left floating panel */}
      <ComponentsLibraryDrawer />
      <ComponentsLibraryHandle />

      {/* Global command palette (Cmd/Ctrl+K) */}
      <CommandPalette />

      {/* Canvas takes full width; panels float over it */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: hasFixedHeight ? 0 : undefined,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <TemplatePanel
          enableHtmlTab={htmlTab}
          enableJsonTab={jsonTab}
          sticky={sticky}
          heightContent={heightContent}
          enableComponentTree={componentTree}
        />
      </Box>

      {/* Right floating panel */}
      <Box
        sx={(t) => ({
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: `${t.palette.background.paper} !important`,
          display: 'flex',
          alignItems: 'stretch',
          borderTopRightRadius: 12,
          borderLeft: inspectorDrawerOpen ? `1px solid ${t.palette.divider}` : 'none',
          overflow: 'visible',
          pointerEvents: inspectorDrawerOpen ? 'auto' : 'none',
        })}
      >
        <InspectorHandle />
        <StickyWrapper
          disabled={!sticky}
          threshold={'.preview-container-end'}
          topOffset={0}
          style={{
            width: `${inspectorWidth}px`,
            flexBasis: `${inspectorWidth}px`,
            minWidth: 0,
            transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), flex-basis 220ms cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderBottomRightRadius: 12,
            }}
          >
            <InspectorDrawer sticky={sticky} heightContent={heightContent} />
          </Box>
        </StickyWrapper>
      </Box>
    </Container>
  );
}
