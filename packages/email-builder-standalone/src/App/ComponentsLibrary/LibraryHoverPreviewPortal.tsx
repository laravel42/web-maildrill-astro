/**
 * LibraryHoverPreviewPortal — singleton component that powers every
 * Components Library card's hover preview through ONE iframe and ONE
 * React portal. Mounted once at the drawer level; cards just dispatch
 * to `hoverPreviewStore` (see `requestHoverEnter` / `requestHoverLeave`).
 *
 * Why a singleton:
 *
 *   The previous implementation rendered a `<LibraryCardHoverPreview>`
 *   per card. Each one called `renderToStaticMarkup` (from
 *   `react-dom/server`) SYNCHRONOUSLY on the subtree to produce HTML
 *   for the iframe's `srcDoc`. With templates (full documents) the
 *   serialization froze the main thread and crashed the tab with an
 *   "Aw, Snap" — confirmed reproducer.
 *
 *   By keeping a single iframe alive across hovers and portaling a
 *   live `<Reader>` into it, we:
 *     - Skip `renderToStaticMarkup` entirely → no main-thread block.
 *     - Hold one DOM tree at a time → memory is O(1), not O(N cards).
 *     - Reuse the same render engine the Preview tab already uses.
 *
 * Lifecycle:
 *
 *   1. Iframe mounts once with an empty `srcDoc` skeleton.
 *   2. `onLoad` captures `iframe.contentDocument.body` and injects the
 *      Google Fonts `<link>` + `globalsStyles` `<style>` into `<head>`.
 *   3. The portal target (the body element) is held in state.
 *   4. As the active descriptor changes, the component computes a new
 *      `TReaderDocument` for the preview and React reconciles inside
 *      the iframe — no remount, no re-fetch (subtree cache).
 *   5. When the popper closes, MUI hides it via `display:none` (we use
 *      `keepMounted`), so the iframe and the portal stay alive.
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  ALL_GOOGLE_FONTS_HREF,
  applyThemeBundle as applyThemeBundlePure,
  type ThemeJson,
} from '@eb/document-core';
import { Reader, type TReaderDocument } from '@eb/email-builder';
import DesktopWindowsOutlined from '@mui/icons-material/DesktopWindowsOutlined';
import PhoneIphoneOutlined from '@mui/icons-material/PhoneIphoneOutlined';
import ZoomInMapOutlined from '@mui/icons-material/ZoomInMapOutlined';
import ZoomOutMapOutlined from '@mui/icons-material/ZoomOutMapOutlined';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Popper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';

import type { TEditorBlock } from '../../documents/editor/core';
import { editorStateStore } from '../../documents/editor/EditorContext';
import { globalsStyles } from '../TemplatePanel/helper/globalsStyles';

import { fetchSavedSubtree, fetchSavedTemplate } from './fetchSavedSubtree';
import {
  cancelHoverClose,
  type HoverPreviewDescriptor,
  requestHoverLeave,
  useActiveHoverPreview,
} from './hoverPreviewStore';
import { injectPlaceholders } from './thumbnail/buildThumbnailHtml';

/** Emulated email widths (desktop matches MAX_WIDTH_DESKTOP). */
const DESKTOP_WIDTH = 600;
const MOBILE_WIDTH = 375;
/**
 * Display box width. Templates render a bit larger than components /
 * layouts / primitives so full-page designs are easier to read.
 */
const PREVIEW_W = 360;
const PREVIEW_W_TEMPLATE = 420;
/**
 * Height CAPS (not fixed heights). The box collapses to the scaled
 * content height in fit-mode so short components don't leave empty
 * space; these values only bound how tall the box may grow. Templates
 * use a dynamic cap of 100dvh - 20% (see `maxPreviewH`) so they preview
 * nearly as tall as the screen.
 */
const PREVIEW_H_MAX = 560;
/** Minimum box height so tiny blocks (spacer/divider) aren't a sliver. */
const PREVIEW_H_MIN = 72;
/** Templates cap their height at 100dvh - 20% → 80% of the viewport. */
const TEMPLATE_VIEWPORT_RATIO = 0.8;

/** Fallback colours when the user has no current document loaded. */
const FALLBACK_BACKDROP = '#f4f4f4';
const FALLBACK_CANVAS = '#ffffff';

/**
 * Module-level cache for fetched subtrees. Hovering the same card a
 * second time (or returning to the drawer) hits the cache instead of
 * the network. Keyed by `${category}|${axis}|${id}`.
 *
 * Cleared automatically by `ComponentsLibraryDrawer` when the user
 * triggers a refresh — the cache lives only as long as the listings
 * it mirrors.
 */
const subtreeCache = new Map<string, { blocks: Array<{ id: string; block: unknown }> }>();

/**
 * Imperative hook for the drawer to invalidate the cache when the user
 * presses the refresh button. Exported here so the cache stays
 * private to this module.
 */
export function clearHoverPreviewCache(): void {
  subtreeCache.clear();
}

/**
 * Build the doc that `<Reader>` should render for an active hover.
 *
 * Sections / Layouts / Primitives don't ship an `EmailLayout` root in
 * their saved bytes (their root is a Container, ColumnsContainer, or
 * single primitive), so we wrap them in a synthetic EmailLayout that
 * inherits the user's current backdrop / canvas colours. Templates
 * already root at EmailLayout.
 *
 * Themes apply the bundle to a clone of the user's current document so
 * the preview reflects how the theme would actually transform their
 * email.
 *
 * Throws on unrecoverable shape errors (caller handles).
 */
async function buildReaderDoc(
  descriptor: HoverPreviewDescriptor,
): Promise<{ doc: TReaderDocument; rootBlockId: string }> {
  const currentDocument = editorStateStore.getState().document;
  const currentRoot = currentDocument['root'];
  const rootData = (currentRoot?.data ?? {}) as Record<string, unknown> & {
    backdropColor?: string;
    canvasColor?: string;
    theme?: ThemeJson;
  };
  const backdrop = rootData.backdropColor ?? FALLBACK_BACKDROP;
  const canvas = rootData.canvasColor ?? FALLBACK_CANVAS;
  // As-created preview: the synthetic root carries ONLY the stage
  // backdrop/canvas — NOT the project theme or globals (textColor,
  // fontFamily, linkGlobal). Library sections/layouts/primitives
  // therefore render with their own saved colours, exactly like their
  // card thumbnail; the active document's theme no longer bleeds into
  // library previews. (The `theme` card category below still previews a
  // theme being applied — that's a different, intentional flow.)
  const syntheticRootData = (childrenIds: string[]): Record<string, unknown> => ({
    backdropColor: backdrop,
    canvasColor: canvas,
    childrenIds,
  });

  if (descriptor.category === 'theme') {
    if (!currentRoot) {
      throw new Error('No active document — cannot preview theme.');
    }
    const newRootData = applyThemeBundlePure(currentRoot.data, {
      globals: descriptor.themeBundle?.globals as Parameters<
        typeof applyThemeBundlePure
      >[1]['globals'],
      blocks: descriptor.themeBundle?.blocks,
    });
    const cloned: Record<string, unknown> = {
      ...currentDocument,
      root: { ...currentRoot, data: newRootData },
    };
    return { doc: cloned as TReaderDocument, rootBlockId: 'root' };
  }

  if (descriptor.category === 'primitive' && descriptor.primitiveBlock !== undefined) {
    const doc: Record<string, unknown> = {
      [descriptor.id]: descriptor.primitiveBlock as TEditorBlock,
      root: { type: 'EmailLayout', data: syntheticRootData([descriptor.id]) },
    };
    return { doc: doc as TReaderDocument, rootBlockId: 'root' };
  }

  // section / layout / template — fetch (with cache).
  const cacheKey = `${descriptor.category}|${descriptor.axis}|${descriptor.id}`;
  let cached = subtreeCache.get(cacheKey);
  if (!cached) {
    const result =
      descriptor.category === 'template'
        ? await fetchSavedTemplate(descriptor.id)
        : await fetchSavedSubtree(descriptor.category, descriptor.axis, descriptor.id);
    cached = { blocks: result.blocks };
    subtreeCache.set(cacheKey, cached);
  }

  if (descriptor.category === 'template') {
    // The backend renumbers the template root to `component-{shortId}-1`
    // (see `renumberBlocks`), so the saved doc has NO `root` key. Map the
    // first entry (always the EmailLayout root) to `root` — childrenIds
    // already point at the other ids, so nothing else needs rewriting.
    const doc: Record<string, unknown> = {};
    cached.blocks.forEach((entry, i) => {
      doc[i === 0 ? 'root' : entry.id] = entry.block;
    });
    return { doc: doc as TReaderDocument, rootBlockId: 'root' };
  }

  // section / layout — wrap subtree in synthetic EmailLayout.
  const subtreeRoot = cached.blocks[0]?.id;
  if (subtreeRoot === undefined) {
    throw new Error('Saved subtree is empty.');
  }
  const doc: Record<string, unknown> = {};
  for (const entry of cached.blocks) {
    doc[entry.id] = entry.block as TEditorBlock;
  }
  doc.root = { type: 'EmailLayout', data: syntheticRootData([subtreeRoot]) };
  return { doc: injectPlaceholders(doc as TReaderDocument), rootBlockId: 'root' };
}

/**
 * Initial HTML for the iframe — empty document with the right
 * lang / charset and a body styled to fill its viewport. The body's
 * background is overridden per-active document inside the portal.
 */
const IFRAME_INITIAL_SRCDOC = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}body{font-family:Helvetica,Arial,sans-serif;}</style>
</head>
<body></body>
</html>`;

/** Fonts <link> the editor's HTML export uses — same set so previews look identical. */
const GOOGLE_FONTS_HREF = ALL_GOOGLE_FONTS_HREF;

/**
 * One-time DOM setup inside the iframe — fonts, globals stylesheet,
 * body background hooked to the current backdrop. Idempotent (safe to
 * call repeatedly; we look up by data attribute).
 */
function ensureIframeChrome(doc: Document, backdrop: string): void {
  const head = doc.head;
  if (head.querySelector('link[data-eb-fonts]') === null) {
    const link = doc.createElement('link');
    link.setAttribute('data-eb-fonts', '1');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    head.appendChild(link);
  }
  if (head.querySelector('style[data-eb-globals]') === null) {
    const style = doc.createElement('style');
    style.setAttribute('data-eb-globals', '1');
    style.textContent = globalsStyles;
    head.appendChild(style);
  }
  // The iframe is a pure display surface — the outer box owns scrolling
  // (zoom-mode). Forbid the iframe's own scrollbar so it never shows a
  // non-functional bar (the iframe has pointerEvents:none) or reflows
  // text when a native scrollbar would steal width.
  doc.documentElement.style.overflow = 'hidden';
  doc.body.style.overflow = 'hidden';
  doc.body.style.backgroundColor = backdrop;
}

export default function LibraryHoverPreviewPortal(): React.ReactElement {
  const muiTheme = useTheme();
  const { t } = useTranslation('inspector');
  const active = useActiveHoverPreview();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [iframeBody, setIframeBody] = useState<HTMLElement | null>(null);
  const [doc, setDoc] = useState<TReaderDocument | null>(null);
  const [rootBlockId, setRootBlockId] = useState<string>('root');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  // Track the dynamic viewport height so template previews can cap at
  // 100dvh - 20%. Reactive to window resizes.
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );

  // Tracks the in-flight resolve target so an out-of-date result
  // (user moved on to another card) doesn't overwrite a fresher one.
  const inFlightKeyRef = useRef<string | null>(null);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const contentDocument = iframe.contentDocument;
    if (contentDocument === null) return;
    const currentRoot = editorStateStore.getState().document['root'];
    const backdrop =
      ((currentRoot?.data ?? {}) as { backdropColor?: string }).backdropColor ?? FALLBACK_BACKDROP;
    ensureIframeChrome(contentDocument, backdrop);
    setIframeBody(contentDocument.body);
  }, []);

  // Keep the template height cap in sync with the dynamic viewport.
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Resolve the doc whenever the active descriptor changes.
  //
  // `buildReaderDoc` is async by signature, but its body is synchronous
  // for theme / primitive / cached-subtree paths (the common case after
  // a card has been hovered once). We defer flipping `loading` to true
  // through `Promise.resolve().then(...)` — if the resolve handler ran
  // first (sync paths queue their continuation before the deferred
  // loading flag), `resolved` is already true and we skip the spinner.
  // Network paths see `resolved=false` when the deferred check runs,
  // turn loading on, then turn it off when the fetch completes.
  useEffect(() => {
    if (active === null) {
      // Don't unset the doc on close — keep the last value so the next
      // hover is instant. The popper is hidden via Popper visibility.
      return;
    }
    const key = `${active.category}|${active.axis}|${active.id}`;
    inFlightKeyRef.current = key;
    setError(null);
    setZoomed(false);
    setPreviewViewport('desktop');
    let resolved = false;

    buildReaderDoc(active)
      .then((result) => {
        if (inFlightKeyRef.current !== key) return;
        resolved = true;
        // The portaled `<Reader>` renders the FULL document (theme =
        // clone of the live doc; template = whole saved doc). Marking
        // the state update as a transition keeps that synchronous tree
        // build interruptible so hovering between cards never freezes
        // the main thread.
        startTransition(() => {
          setDoc(result.doc);
          setRootBlockId(result.rootBlockId);
        });
        setLoading(false);
      })
      .catch((err) => {
        if (inFlightKeyRef.current !== key) return;
        resolved = true;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    Promise.resolve().then(() => {
      if (!resolved && inFlightKeyRef.current === key) {
        setLoading(true);
      }
    });
  }, [active]);

  // When the active descriptor changes the backdrop colour for
  // sections/layouts/primitives can change too — keep iframe body
  // background in sync.
  useEffect(() => {
    if (iframeBody === null) return;
    if (active === null) return;
    const currentRoot = editorStateStore.getState().document['root'];
    const backdrop =
      ((currentRoot?.data ?? {}) as { backdropColor?: string }).backdropColor ?? FALLBACK_BACKDROP;
    iframeBody.style.backgroundColor = backdrop;
  }, [iframeBody, active]);

  // Measure the rendered content height so fit-mode can scale the whole
  // template into the box. We measure the portaled content element
  // directly (the EmailLayout root div) — NOT the iframe's
  // documentElement, whose scrollHeight is clamped up to the iframe
  // viewport height and, since the iframe height tracks this measurement,
  // would pin short content to the box height (feedback loop). With the
  // iframe overflow forced hidden the measurement is stable (no scrollbar
  // reflow). ResizeObserver catches late reflows (images, font swaps).
  useEffect(() => {
    if (iframeBody === null) return;
    const measure = () => {
      const contentEl = iframeBody.firstElementChild as HTMLElement | null;
      const measured =
        contentEl !== null && contentEl.offsetHeight > 0
          ? contentEl.offsetHeight
          : iframeBody.scrollHeight;
      setContentHeight(measured);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(iframeBody);
    return () => ro.disconnect();
  }, [iframeBody, doc]);

  // Fit-mode scales the emulated email down so the full height fits the
  // box without scrolling; zoom-mode fills the box width and scrolls
  // vertically. In BOTH modes the box height now collapses to the scaled
  // content height (clamped to the category caps) so short components
  // don't leave empty space — templates get a larger box.
  const isTemplate = active?.category === 'template';
  const previewW = isTemplate ? PREVIEW_W_TEMPLATE : PREVIEW_W;
  // Templates cap at 100dvh - 20% (80% of the viewport) so they preview
  // nearly as tall as the screen; everything else uses the compact cap.
  const maxPreviewH = isTemplate ? Math.round(viewportH * TEMPLATE_VIEWPORT_RATIO) : PREVIEW_H_MAX;
  const emuWidth = previewViewport === 'mobile' ? MOBILE_WIDTH : DESKTOP_WIDTH;
  const measuredHeight = contentHeight ?? maxPreviewH;
  const widthScale = previewW / emuWidth;
  const scale = zoomed ? widthScale : Math.min(widthScale, maxPreviewH / measuredHeight);
  const scaledWidth = emuWidth * scale;
  const scaledHeight = measuredHeight * scale;
  // Box height follows the content: capped at maxPreviewH (zoom-mode
  // scrolls past it), floored at PREVIEW_H_MIN so tiny blocks still read.
  const boxHeight = Math.max(PREVIEW_H_MIN, Math.min(scaledHeight, maxPreviewH));

  // Reset scroll when the mode/viewport/template changes so toggling
  // back from a scrolled zoom view doesn't leave a blank gap.
  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [zoomed, previewViewport, active]);

  // Memoize the rendered tree so unrelated re-renders (loading flag,
  // popper open/close, MUI theme) don't rebuild the full document.
  // Only a new `doc` / `rootBlockId` triggers reconciliation.
  const readerElement = useMemo(
    () =>
      doc === null ? null : (
        <Reader document={doc} rootBlockId={rootBlockId} viewport={previewViewport} />
      ),
    [doc, rootBlockId, previewViewport],
  );

  return (
    <Popper
      open={active !== null}
      anchorEl={active?.anchor ?? null}
      placement="right-start"
      keepMounted
      modifiers={[
        { name: 'offset', options: { offset: [0, 8] } },
        // Always open to the RIGHT. Flipping to top/bottom looked broken,
        // and the drawer is docked left so the right side always has room.
        { name: 'flip', enabled: false },
        // Only shift along the cross (vertical) axis to stay on screen —
        // never change side.
        { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8, altAxis: true } },
      ]}
      sx={{
        zIndex: muiTheme.zIndex.tooltip + 1,
        pointerEvents: active !== null ? 'auto' : 'none',
        // Hide the popper body when no active hover. `keepMounted`
        // would otherwise leave the chrome visible at (0,0).
        visibility: active !== null ? 'visible' : 'hidden',
      }}
    >
      <Paper
        elevation={6}
        onMouseEnter={cancelHoverClose}
        onMouseLeave={requestHoverLeave}
        sx={{
          width: previewW + 24,
          padding: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backgroundColor: muiTheme.palette.background.paper,
          border: `1px solid ${muiTheme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {active?.name ?? ''}
          </Typography>
          <Tooltip
            title={
              previewViewport === 'mobile'
                ? t('componentsLibrary.preview.desktop', 'Desktop view')
                : t('componentsLibrary.preview.mobile', 'Mobile view')
            }
          >
            <IconButton
              size="small"
              onClick={() => setPreviewViewport((v) => (v === 'mobile' ? 'desktop' : 'mobile'))}
              sx={{ flexShrink: 0 }}
            >
              {previewViewport === 'mobile' ? (
                <DesktopWindowsOutlined fontSize="small" />
              ) : (
                <PhoneIphoneOutlined fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              zoomed
                ? t('componentsLibrary.preview.fit', 'Fit to view')
                : t('componentsLibrary.preview.zoom', 'Zoom in')
            }
          >
            <IconButton size="small" onClick={() => setZoomed((z) => !z)} sx={{ flexShrink: 0 }}>
              {zoomed ? (
                <ZoomInMapOutlined fontSize="small" />
              ) : (
                <ZoomOutMapOutlined fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          ref={viewportRef}
          sx={{
            position: 'relative',
            width: previewW,
            height: boxHeight,
            mx: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            backgroundColor: muiTheme.palette.action.hover,
            borderRadius: 0,
            overflowY: zoomed ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        >
          {/* Inner scaler takes the SCALED size as its layout box so the
              transformed (out-of-flow) iframe never overflows in x. */}
          <Box
            sx={{ position: 'relative', width: scaledWidth, height: scaledHeight, flexShrink: 0 }}
          >
            {/* The iframe is mounted ONCE for the entire session — its
                srcDoc is the empty skeleton, content arrives via the
                React portal below. */}
            <iframe
              ref={iframeRef}
              srcDoc={IFRAME_INITIAL_SRCDOC}
              title={t('componentsLibrary.preview.iframeTitle', 'Live preview')}
              /* VENDOR PATCH — dropped `allow-scripts`. Combined with
                 `allow-same-origin` the browser warns the frame can escape its
                 sandbox, and nothing here needs it: the skeleton srcDoc carries
                 no <script>, and all content is injected from the parent
                 document (ensureIframeChrome + the React portal below). */
              sandbox="allow-same-origin"
              onLoad={handleIframeLoad}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: emuWidth,
                height: measuredHeight,
                border: 0,
                display: 'block',
                backgroundColor: 'transparent',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                pointerEvents: 'none',
              }}
            />
          </Box>
          {iframeBody !== null &&
            readerElement !== null &&
            error === null &&
            createPortal(readerElement, iframeBody)}
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.6)',
              }}
            >
              <CircularProgress size={24} />
            </Box>
          )}
          {error !== null && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                backgroundColor: muiTheme.palette.background.paper,
              }}
            >
              <Typography variant="body2" color="error" sx={{ textAlign: 'center' }}>
                {error}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Popper>
  );
}
