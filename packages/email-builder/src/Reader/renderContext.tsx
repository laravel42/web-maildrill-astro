import React, { createContext, useContext } from 'react';

/**
 * Store-free render contexts shared by block renderers.
 *
 * Block components historically read the editor's Zustand store directly
 * (`useRoot`, `useDisableEdition`). To render in a Node process (the
 * Node-safe HTML renderer) the blocks instead read these contexts, which
 * `Reader` (and the editor canvas) provide. No store is touched here.
 */

/**
 * The document root block's `data` (EmailLayout props: `textColor`,
 * `fontFamily`, `backdropColor`, …). Blocks read it for inheritance
 * fallbacks. `null` outside a provider.
 */
export const RootDataContext = createContext<Record<string, unknown> | null>(null);

export const RootDataProvider: React.FC<{
  value: Record<string, unknown> | null;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <RootDataContext.Provider value={value}>{children}</RootDataContext.Provider>
);

export function useRootData<T = Record<string, unknown>>(): T | undefined {
  return (useContext(RootDataContext) as T | null) ?? undefined;
}

/**
 * Whether interactive editing affordances on the canvas are disabled.
 * Only the editor canvas sets this `true`; in the Reader / HTML export
 * path it is always `false` (real links must navigate), which is the
 * default outside a provider.
 */
export const DisableEditionContext = createContext<boolean>(false);

export const DisableEditionProvider: React.FC<{
  value: boolean;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <DisableEditionContext.Provider value={value}>{children}</DisableEditionContext.Provider>
);

export function useDisableEdition(): boolean {
  return useContext(DisableEditionContext);
}

/**
 * Image-upload progress surfaced by the editor canvas (loader overlay on
 * Image / Container / ColumnsContainer). In the Reader / HTML export
 * path nothing is uploading, which is the default outside a provider.
 */
export type ImageUploadingState = { uploading: boolean; id: string | null };

const IMAGE_UPLOADING_DEFAULT: ImageUploadingState = { uploading: false, id: null };

export const ImageUploadingContext = createContext<ImageUploadingState>(IMAGE_UPLOADING_DEFAULT);

export const ImageUploadingProvider: React.FC<{
  value: ImageUploadingState;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <ImageUploadingContext.Provider value={value}>{children}</ImageUploadingContext.Provider>
);

export function useImageUploading(): ImageUploadingState {
  return useContext(ImageUploadingContext);
}

/**
 * Callback the Image block invokes from its browser `onLoad` to persist
 * the natural width back into the document. Only the editor canvas wires
 * a real implementation; in the Reader / HTML export path `onLoad` never
 * fires and the default no-op is never called.
 */
export type ImageAutoWidthFn = (blockId: string, width: number) => void;

const IMAGE_AUTO_WIDTH_DEFAULT: ImageAutoWidthFn = () => {};

export const ImageAutoWidthContext = createContext<ImageAutoWidthFn>(IMAGE_AUTO_WIDTH_DEFAULT);

export const ImageAutoWidthProvider: React.FC<{
  value: ImageAutoWidthFn;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <ImageAutoWidthContext.Provider value={value}>{children}</ImageAutoWidthContext.Provider>
);

export function useImageAutoWidth(): ImageAutoWidthFn {
  return useContext(ImageAutoWidthContext);
}
