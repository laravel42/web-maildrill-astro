import React from 'react';

import {
  DisableEditionProvider,
  ImageAutoWidthProvider,
  ImageUploadingProvider,
  RootDataProvider,
  ViewportProvider,
} from '@eb/email-builder';

import {
  editorStateStore,
  updateBlockProps,
  useDisableEdition,
  useImageUploading,
  useRoot,
  useSelectedScreenSize,
} from './EditorContext';

/**
 * Bridges the editor's Zustand store into the store-free render contexts
 * consumed by block components (which moved to `@eb/email-builder` for
 * Node-safety). The editor canvas renders blocks via `EditorBlock`
 * (not `Reader`), so without this bridge the blocks would read the
 * context defaults (desktop / no upload / edition enabled) instead of
 * the live store values.
 *
 * `Reader` (Preview tab, AI preview, HTML export) provides its own
 * `RootDataProvider` from the document and pins viewport itself, so it
 * does not need this bridge — but a `ViewportProvider` here also lets the
 * Preview tab follow the live toggle when `Reader` is rendered without an
 * explicit `viewport` prop.
 */
export default function EditorRenderContextBridge({ children }: { children: React.ReactNode }) {
  const viewport = useSelectedScreenSize();
  const disableEdition = useDisableEdition();
  const imageUploading = useImageUploading();
  const root = useRoot() as Record<string, unknown> | undefined;

  return (
    <ViewportProvider value={viewport}>
      <RootDataProvider value={root ?? null}>
        <DisableEditionProvider value={disableEdition}>
          <ImageUploadingProvider value={imageUploading}>
            <ImageAutoWidthProvider value={reportImageAutoWidth}>{children}</ImageAutoWidthProvider>
          </ImageUploadingProvider>
        </DisableEditionProvider>
      </RootDataProvider>
    </ViewportProvider>
  );
}

/**
 * Persist the natural width an Image block discovers on `onLoad` back
 * into the document — preserves the editor's previous `updateBlockProps`
 * write-back now that the block no longer imports the store directly.
 */
function reportImageAutoWidth(blockId: string, width: number) {
  const block = editorStateStore.getState().document[blockId];
  const currentProps = (block?.data as { props?: Record<string, unknown> } | undefined)?.props ?? {};
  updateBlockProps(blockId, { ...currentProps, width });
}
