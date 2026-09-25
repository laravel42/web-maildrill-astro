import React, {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Reader, TReaderDocument } from '@eb/email-builder';
import { ContentCopyOutlined, HelpOutlineOutlined } from '@mui/icons-material';
import { Redo2, Undo2 } from 'lucide-react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Snackbar,
  Stack,
  SvgIcon,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { COMPACT_PANEL_WIDTH } from '../../constants';
import { TEditorConfiguration } from '../../documents/editor/core';
import EditorBlock from '../../documents/editor/EditorBlock';
import {
  appendBuiltInBlockToParent,
  editorStateStore,
  lateralPanel,
  redoChange,
  requestTourRestart,
  setComponentsLibraryDrawerOpen,
  setDocument,
  setInspectorDrawerMode,
  setSelectedBlockId,
  setSelectedScreenSize,
  undoChange,
  useCanRedo,
  useCanUndo,
  useComponentsLibraryDrawerOpen,
  useComponentsLibraryEnabled,
  useComponentTreeOpen,
  useContainerGrow,
  useDisableEdition,
  useInspectorDrawerMode,
  useInspectorDrawerOpen,
  useSelectedMainTab,
} from '../../documents/editor/EditorContext';
import EditorRenderContextBridge from '../../documents/editor/EditorRenderContextBridge';
import { useBlockChildrenGranular } from '../../documents/editor/granular';
import { migrateDocument } from '../../documents/editor/migrateDocument';
import AIGeneration from '../AIGeneration';
import ShortcutKeys from '../CommandPalette/ShortcutKeys';
import { BUTTONS } from '../ComponentsLibrary/builtInBlocks';
import {
  COMPACT_LIBRARY_DRAWER_WIDTH,
  COMPONENTS_LIBRARY_DRAWER_WIDTH,
} from '../ComponentsLibrary/ComponentsLibraryDrawer';
import ComponentTreePanel from '../ComponentTree/ComponentTreePanel';
import ToggleComponentTreeButton from '../ComponentTree/ToggleComponentTreeButton';
import StickyWrapper from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/containers/StickyWrapper';
import ScreenSizeSelector from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/SelectScreen';

// CustomReader was deleted in L42-312 Phase 5; the Preview tab now
// renders `Reader` from `@eb/email-builder` directly. Phase 6 finishes
// the cleanup by removing the now-unused folder.
import DownloadJson from './DownloadJson';
import cleanDocument from './helper/cleanDocument';
import HtmlPanel from './HtmlPanel';
import JsonPanel from './JsonPanel';
import MainTabsGroup from './MainTabsGroup';
import renderToStaticMarkup from './renderToStaticMarkup';
import { dataTourAttr, EMAIL_BUILDER_TOUR_ANCHORS } from '../../tour/tourAnchors';
import './history.css';

const CSS_HEADER_CHAR_LIMIT = 16350;

const RenderWatcher: React.FC<{ onRendered?: () => void; children: React.ReactNode }> = ({
  onRendered,
  children,
}) => {
  useEffect(() => {
    if (typeof onRendered === 'function') {
      const id = requestAnimationFrame(() => onRendered());
      return () => cancelAnimationFrame(id);
    }
  });
  return <>{children}</>;
};

const WarningIcon = () => (
  <SvgIcon viewBox="0 0 18 18" fontSize="small">
    <path
      d="M9.00015 6.75V8.25M9.00015 11.25H9.00765M3.804 14.25H14.1963C15.351 14.25 16.0727 13 15.4953 12L10.2992 3C9.72184 2 8.27846 2 7.70111 3L2.50496 12C1.92761 13 2.6493 14.25 3.804 14.25Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </SvgIcon>
);

// OPTIMIZACIÓN: Componente memoizado que solo se re-renderiza cuando el documento cambia
// Esto evita que las imágenes se recarguen en cada cambio.
//
// Post-L42-312 (Phase 5): renders the canonical `Reader` from
// `@eb/email-builder` instead of the legacy hand-rolled `CustomReader`.
// `Reader` calls `resolveBlockData` per block (via `ReaderBlock`) so
// schema defaults (level 3) and theme overrides (level 2) actually
// apply — fixing the "Container without explicit padding shows zero"
// bug. The two responsibilities `CustomReader` carried beyond
// rendering are split out into pure wrappers:
//   - `RenderWatcher` raises the `onRendered` callback after commit.
//   - `<div style={{ pointerEvents: 'none' }}>` swallows clicks while
//     the canvas is hidden behind the preview.
const PreviewReader = memo(function PreviewReader({ onRendered }: { onRendered?: () => void }) {
  // Suscripción directa al documento solo para este componente
  // Comparación estricta de referencia para evitar re-renders innecesarios
  const document = editorStateStore((state) => state.document);

  return (
    <RenderWatcher onRendered={onRendered}>
      <div style={{ pointerEvents: 'none' }}>
        <EditorRenderContextBridge>
          <Reader document={document as TReaderDocument} rootBlockId="root" />
        </EditorRenderContextBridge>
      </div>
    </RenderWatcher>
  );
});

type TemplatePanelProps = {
  sticky?: boolean;
  heightContent?: string;
  enableEditorTab?: boolean;
  enablePreviewTab?: boolean;
  enableHtmlTab?: boolean;
  enableJsonTab?: boolean;
  enableComponentTree?: boolean;
};

export default function TemplatePanel({
  sticky,
  heightContent,
  enableEditorTab = true,
  enablePreviewTab = true,
  enableHtmlTab = false,
  enableJsonTab = true,
  enableComponentTree = true,
}: TemplatePanelProps) {
  // OPTIMIZACIÓN: No usar useDocument() aquí - causa re-render completo
  // En su lugar, obtener el documento solo cuando se necesita (en callbacks)
  const selectedMainTab = useSelectedMainTab();
  const componentTreeOpen = useComponentTreeOpen();
  const disableEdition = useDisableEdition();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const previewContainer = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [copySuccess, setCopySuccess] = useState(false);
  const containerGrow = useContainerGrow();
  const { t } = useTranslation('inspector');
  const { t: tCommon } = useTranslation('common');
  const libraryOpen = useComponentsLibraryDrawerOpen();
  const libraryEnabled = useComponentsLibraryEnabled();
  const rootChildren = useBlockChildrenGranular('root');
  const isCanvasEmpty = rootChildren.length === 0;
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';
  // Left offset for the header content. The Components Library only
  // exists in the editor view; in preview / html / json it never
  // renders, so it occupies no space there. When enabled it always
  // shows at least the compact base-blocks rail (closed), expanding to
  // the full drawer when open.
  const libraryOffset =
    libraryEnabled && selectedMainTab === 'editor'
      ? libraryOpen
        ? COMPONENTS_LIBRARY_DRAWER_WIDTH + 36
        : COMPACT_LIBRARY_DRAWER_WIDTH + 12
      : 0;
  const inspectorOpen = useInspectorDrawerOpen();
  const inspectorMode = useInspectorDrawerMode();
  const inspectorWidth = inspectorOpen
    ? inspectorMode === 'compact'
      ? COMPACT_PANEL_WIDTH
      : lateralPanel
    : 0;

  // The compact footprint of each side panel is now reserved as real layout
  // space by the flex spacers in App/index.tsx (so the canvas/preview never
  // sits behind a compact rail). The canvas Box that contains this header is
  // therefore already inset by those compact widths. Subtract them from the
  // header's own padding so the toolbar controls keep dodging the FULL panel
  // width exactly as before — only the EXTRA overflow beyond the compact rail
  // (i.e. the expanded portion that floats over the canvas) is padded here.
  const leftReserved =
    libraryEnabled && selectedMainTab === 'editor' ? COMPACT_LIBRARY_DRAWER_WIDTH : 0;
  const rightReserved = inspectorOpen ? COMPACT_PANEL_WIDTH : 0;
  const headerPaddingLeft = Math.max(0, libraryOffset - leftReserved);
  const headerPaddingRight = Math.max(0, inspectorWidth + 8 - rightReserved);

  // Estado para controlar el loading del preview
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SAFETY_LOADING_TIMEOUT_MS = 4000;
  // Estado para controlar el loading del editor
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const editorLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Eliminado: no mostramos loader al cambiar de pestañas para hacer el cambio inmediato.
  // El loader solo aparece cuando realmente hay un render pesado (update de documento).

  const renderMainPanel = useCallback(() => {
    let result = null;
    switch (selectedMainTab) {
      case 'html':
        result = enableHtmlTab ? <HtmlPanel /> : null;
        break;
      case 'json':
        result = enableJsonTab ? <JsonPanel /> : null;
        break;
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- disableEdition is intentionally listed for clarity even though eslint deems it unnecessary
  }, [disableEdition, selectedMainTab, enableHtmlTab, enableJsonTab]);

  useEffect(() => {
    const handleTemplateUpdate = (event: Event) => {
      const { detail } = event as CustomEvent<TEditorConfiguration>;

      // Migrar bloques CustomEditor y Wysiwyg a NotionText
      const migratedDocument = migrateDocument(detail);

      // Usar startTransition para actualizaciones no urgentes (mejora INP)
      // Esto permite que la UI responda mientras se procesa la actualización
      startTransition(() => {
        setDocument(migratedDocument, false);
      });

      // Mostrar loader en ambos (solo se verá en el activo)
      // Usar requestAnimationFrame para que el loader no bloquee
      requestAnimationFrame(() => {
        setIsPreviewLoading(true);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = setTimeout(() => {
          setIsPreviewLoading(false);
        }, SAFETY_LOADING_TIMEOUT_MS);

        setIsEditorLoading(true);
        if (editorLoadingTimeoutRef.current) {
          clearTimeout(editorLoadingTimeoutRef.current);
        }
        editorLoadingTimeoutRef.current = setTimeout(() => {
          setIsEditorLoading(false);
        }, SAFETY_LOADING_TIMEOUT_MS);
      });
    };

    window.addEventListener('email-builder-update-template', handleTemplateUpdate);

    return () => {
      window.removeEventListener('email-builder-update-template', handleTemplateUpdate);
    };
  }, [selectedMainTab]);

  // Keyboard shortcuts listener
  // OPTIMIZACIÓN: Calcular CSS info solo cuando cambia el documento
  // Usar selector específico para evitar re-renders innecesarios
  const cssHeaderInfo = editorStateStore(
    useShallow((state) => {
      try {
        const { css } = cleanDocument(state.document as unknown as TReaderDocument);
        return {
          length: css.length,
          threshold: CSS_HEADER_CHAR_LIMIT,
          exceeded: css.length > CSS_HEADER_CHAR_LIMIT,
        };
      } catch (_e) {
        return { length: 0, threshold: CSS_HEADER_CHAR_LIMIT, exceeded: false };
      }
    }),
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlPressed = event.ctrlKey || event.metaKey;

      // Skip when typing in an input/textarea/contenteditable
      const tag = (event.target as HTMLElement)?.tagName;
      const isEditable = (event.target as HTMLElement)?.isContentEditable;
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && event.key !== 'z' && event.key !== 'y') return;

      if (isCtrlPressed) {
        // Ctrl+Z — undo
        if (event.key === 'z' && !event.shiftKey && canUndo) {
          event.preventDefault();
          undoChange();
        }
        // Ctrl+Y / Ctrl+Shift+Z — redo
        else if ((event.key === 'y' || (event.key === 'z' && event.shiftKey)) && canRedo) {
          event.preventDefault();
          redoChange();
        }
        // Ctrl+B — toggle library open/closed
        else if (event.key === 'b' && !event.shiftKey && !isEditable) {
          event.preventDefault();
          setComponentsLibraryDrawerOpen(!editorStateStore.getState().componentsLibraryDrawerOpen);
        }
        // Ctrl+I — toggle inspector full/compact mode
        else if (event.key === 'i' && !event.shiftKey && !isEditable) {
          event.preventDefault();
          const current = editorStateStore.getState().inspectorDrawerMode ?? 'full';
          setInspectorDrawerMode(current === 'compact' ? 'full' : 'compact');
        }
        // Ctrl+M — toggle mobile/desktop preview
        else if (event.key === 'm' && !event.shiftKey && !isEditable) {
          event.preventDefault();
          setSelectedScreenSize(
            editorStateStore.getState().selectedScreenSize === 'mobile' ? 'desktop' : 'mobile',
          );
        }
        // Ctrl+1-8 — insert built-in block by index
        else if (!event.shiftKey && !isEditable && /^[1-8]$/.test(event.key)) {
          event.preventDefault();
          const idx = Number(event.key) - 1;
          const newId = appendBuiltInBlockToParent('root', BUTTONS[idx].block());
          if (newId) setSelectedBlockId(newId);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  const getData = () => {
    const config = editorStateStore.getState().document as any;
    const html = renderToStaticMarkup(config, { rootBlockId: 'root' });

    console.log('Get data: ', config, html);
    const customEvent = new CustomEvent<{ json: object; html: string }>('save-template', {
      detail: {
        json: config,
        html: html.props.children,
      },
    });

    window.dispatchEvent(customEvent);
  };

  // Memoizar callbacks para evitar re-renders de PreviewReader
  const undo = useCallback(() => {
    undoChange();
  }, []);

  const redo = useCallback(() => {
    redoChange();
  }, []);

  // OPTIMIZACIÓN: Calcular HTML/JSON solo cuando se necesita (en la tab activa)
  // Obtener documento directamente del store en lugar de suscribirse
  const templateHTML = useMemo(() => {
    if (selectedMainTab === 'html') {
      const doc = editorStateStore.getState().document;
      return renderToStaticMarkup(doc as TReaderDocument, { rootBlockId: 'root' });
    }
    return null;
  }, [selectedMainTab]);

  const json = useMemo(() => {
    if (selectedMainTab === 'json') {
      const doc = editorStateStore.getState().document;
      return JSON.stringify(doc);
    }
    return '';
  }, [selectedMainTab]);

  const rightButtonsHeader = useCallback(() => {
    switch (selectedMainTab) {
      case 'preview':
        return null;
      case 'html':
        return (
          <Tooltip
            title={t('header.copy_html')}
            placement="left-start"
            sx={{ color: 'text.primary' }}
          >
            <IconButton onClick={() => handleCopy(templateHTML?.props.children || '')}>
              <ContentCopyOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      case 'json':
        return (
          <>
            <DownloadJson />
            <Tooltip
              title={t('header.copy_json')}
              placement="left-start"
              sx={{ color: 'text.primary' }}
            >
              <IconButton onClick={() => handleCopy(json)}>
                <ContentCopyOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        );
      case 'editor':
      default:
        return (
          <>
            <div
              className="pbx-history"
              role="group"
              aria-label={t('header.history')}
              {...dataTourAttr(EMAIL_BUILDER_TOUR_ANCHORS.toolbarHistory)}
            >
              <button
                type="button"
                className="pbx-history__btn"
                title={t('header.undo')}
                aria-label={t('header.undo')}
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pbx-history__btn"
                title={t('header.redo')}
                aria-label={t('header.redo')}
                disabled={!canRedo}
                onClick={redo}
              >
                <Redo2 size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="pbx-history__btn"
              title={t('header.helpTour')}
              aria-label={t('header.helpTour')}
              onClick={() => requestTourRestart()}
            >
              <HelpOutlineOutlined fontSize="small" aria-hidden="true" />
            </button>
            {enableComponentTree && <ToggleComponentTreeButton />}
          </>
        );
    }
  }, [
    selectedMainTab,
    templateHTML,
    json,
    canUndo,
    canRedo,
    t,
    tCommon,
    undo,
    redo,
    enableComponentTree,
  ]);

  const handleCopy = async (text: string) => {
    try {
      if (!navigator.clipboard) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopySuccess(true);
    } catch (err) {
      console.error('Error copying text:', err);
    }
  };

  const hasFixedHeight = Boolean(heightContent);

  return (
    <Container
      maxWidth={false}
      sx={{
        flex: '1 1 auto',
        minWidth: '410px',
        height: '100%',
        padding: '0!important',
        position: 'relative',

        ...(hasFixedHeight && {
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }),
      }}
    >
      <button id="saveData" style={{ display: 'none' }} onClick={getData}>
        Save
      </button>
      <Box sx={hasFixedHeight ? { flexShrink: 0 } : undefined}>
        <StickyWrapper
          threshold={'.preview-container-end'}
          disabled={!sticky}
          topOffset={0}
          style={{ width: '100%' }}
        >
          <div id="ee-editor-header" style={{ width: '100%' }}>
            <div
              style={{
                position: 'relative',
                height: 50,
                width: '100%',
                borderBottom: 1,
                borderColor: 'divider',
                backgroundColor: theme.palette.background.paper,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                marginTop: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  pl: headerPaddingLeft ? `${headerPaddingLeft}px` : 2,
                  pr: `${headerPaddingRight}px`,
                  transition: 'padding 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: 50,
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <AIGeneration />
                </Stack>
                {/* `gap` rather than Stack's `spacing`: since the MUI 9 upgrade
                    spacing renders no margin at all here (every child comes out
                    with margin-left: 0), leaving undo/redo flush against each other. */}
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  {rightButtonsHeader()}
                </Stack>
              </Stack>
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '& > *': { pointerEvents: 'auto' },
                }}
              >
                <MainTabsGroup
                  enableEditorTab={enableEditorTab}
                  enablePreviewTab={enablePreviewTab}
                  enableHtmlTab={enableHtmlTab}
                  enableJsonTab={enableJsonTab}
                />
                <ScreenSizeSelector />
              </Box>
            </div>
            {cssHeaderInfo &&
              (cssHeaderInfo.length / cssHeaderInfo.threshold >= 0.9 || cssHeaderInfo.exceeded) && (
                <Alert
                  severity={cssHeaderInfo?.exceeded ? 'error' : 'warning'}
                  icon={<WarningIcon />}
                  sx={{
                    borderRadius: 0,
                    m: 0,
                    '& .MuiAlert-message': {
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 2,
                    },
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 700 }}>Attention!</span>{' '}
                    {cssHeaderInfo?.exceeded
                      ? 'You have exceeded the style limit (≈16,000 characters). Some clients will ignore responsive design.'
                      : 'The email is close to the style limit (≈16,000 characters). If you exceed it, some clients may ignore responsive design.'}
                  </span>
                  <Tooltip
                    title={`CSS in header: ${cssHeaderInfo?.length.toLocaleString()} / ${cssHeaderInfo?.threshold.toLocaleString()} characters`}
                    placement="bottom"
                  >
                    <Chip
                      size="small"
                      label={`CSS: ${cssHeaderInfo?.length.toLocaleString()} / ${cssHeaderInfo?.threshold.toLocaleString()}`}
                      color={cssHeaderInfo?.exceeded ? 'error' : 'warning'}
                      variant={'filled'}
                    />
                  </Tooltip>
                </Alert>
              )}
          </div>
        </StickyWrapper>
      </Box>
      <Box
        className="preview-container eb-canvas"
        ref={previewContainer}
        {...dataTourAttr(EMAIL_BUILDER_TOUR_ANCHORS.canvasRoot)}
        onClick={(e: React.MouseEvent) => {
          if (selectedMainTab === 'editor') {
            // No deseleccionar si el click viene de un portal MUI o del toolbar de NotionText
            const target = e.target as Element;
            const muiPortal = target?.closest?.(
              '.MuiPopover-root, .MuiModal-root, .MuiMenu-root, .MuiBackdrop-root, [role="presentation"]',
            );
            const emojiPicker = target?.closest?.('em-emoji-picker');
            const toolbar = target?.closest?.('[data-notion-text-toolbar]');
            const hasShadowRoot = target?.shadowRoot;

            if (muiPortal || emojiPicker || toolbar || hasShadowRoot) {
              return;
            }
            setSelectedBlockId(null);
          }
        }}
        sx={{
          minWidth: 370,
          width: '100%',
          zIndex: 0,
          marginTop: '0px!important',
          borderLeft: '1px solid primary',
          borderBottom: '1px solid primary',
          padding: '0 ',
          paddingBottom: '47px',
          backgroundColor: theme.palette.background.canvas,
          // Con altura fija: canvas es el único scroll (flex + minHeight 0 + overflowY auto)
          ...(hasFixedHeight
            ? {
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
              }
            : {
                minHeight: '100dvh',
                maxHeight: undefined,
                overflowY: selectedMainTab === 'editor' && containerGrow ? 'visible' : 'auto',
                overflowX: 'hidden',
                height: '100%',
              }),
          position: 'relative',
          pt: selectedMainTab === 'editor' ? '28px' : 0,
        }}
      >
        {/* Editor y Preview pre-montados para cambio instantáneo */}
        {/* Floating empty-canvas hint — visible only in editor tab with no blocks */}
        {selectedMainTab === 'editor' && isCanvasEmpty && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              overflow: 'hidden',
            }}
          >
            <Stack
              sx={{
                alignItems: 'center',
                py: 2.5,
                borderRadius: 2,
                maxWidth: 260,
                maxHeight: '100%',
                overflowY: 'auto',
                pointerEvents: 'auto',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                {tCommon(
                  'editor.emptyCanvasPaletteHint',
                  'Press {{key}} to open the command palette',
                  {
                    key: `${modKey}+K`,
                  },
                )}
              </Typography>
              <Stack sx={{ width: '100%', gap: '8px' }}>
                {(
                  [
                    {
                      keys: [modKey, 'K'],
                      label: tCommon('commandPalette.title', 'Command palette'),
                    },
                    {
                      keys: [modKey, 'B'],
                      label: tCommon('editor.emptyCanvasShortcuts.openLibrary'),
                    },
                    {
                      keys: [modKey, 'I'],
                      label: tCommon('commandPalette.action.toggleInspector'),
                    },
                    { keys: [modKey, 'Z'], label: tCommon('editor.emptyCanvasShortcuts.undo') },
                    { keys: [modKey, 'Y'], label: tCommon('editor.emptyCanvasShortcuts.redo') },
                    { keys: [modKey, 'M'], label: tCommon('editor.emptyCanvasShortcuts.mobile') },
                    {
                      keys: [modKey, '1'],
                      label: tCommon('editor.emptyCanvasShortcuts.insertText', 'Insert text block'),
                    },
                  ] as { keys: string[]; label: string }[]
                ).map(({ keys, label }) => (
                  <Stack
                    key={keys.join('+')}
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
                      {label}
                    </Typography>
                    <ShortcutKeys keys={keys} />
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Box>
        )}
        <Box sx={{ display: selectedMainTab === 'editor' ? 'block' : 'none', height: '100%' }}>
          <Box sx={{ opacity: isEditorLoading ? 0 : 1, transition: 'opacity 120ms ease-out' }}>
            <RenderWatcher
              onRendered={() => {
                setIsEditorLoading(false);
                if (editorLoadingTimeoutRef.current) {
                  clearTimeout(editorLoadingTimeoutRef.current);
                  editorLoadingTimeoutRef.current = null;
                }
              }}
            >
              <EditorRenderContextBridge>
                <EditorBlock id="root" />
              </EditorRenderContextBridge>
            </RenderWatcher>
          </Box>
        </Box>

        <Box sx={{ display: selectedMainTab === 'preview' ? 'block' : 'none', height: '100%' }}>
          <Box sx={{ opacity: isPreviewLoading ? 0 : 1, transition: 'opacity 120ms ease-out' }}>
            <PreviewReader
              onRendered={() => {
                setIsPreviewLoading(false);
                if (loadingTimeoutRef.current) {
                  clearTimeout(loadingTimeoutRef.current);
                  loadingTimeoutRef.current = null;
                }
              }}
            />
          </Box>
        </Box>

        {/* Paneles pesados solo cuando se seleccionan */}
        {renderMainPanel()}

        {((selectedMainTab === 'preview' && isPreviewLoading) ||
          (selectedMainTab === 'editor' && isEditorLoading)) && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.palette.background.default,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              gap: 2,
            }}
          >
            <CircularProgress size={48} />
            <Typography variant="body1" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        )}
      </Box>
      <div className="preview-container-end" style={{ width: '100%' }}></div>
      {/* Panel flotante de árbol de bloques – fuera del scroll del canvas */}
      {enableComponentTree && componentTreeOpen && selectedMainTab === 'editor' && (
        <ComponentTreePanel />
      )}
      {/* Toast for copy success */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message="Your text has been copied"
      />
    </Container>
  );
}
