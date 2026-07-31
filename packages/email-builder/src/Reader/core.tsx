import React, { createContext, useContext, useMemo } from 'react';
import { z } from 'zod';

import { Button, ButtonPropsSchema } from '@eb/block-button';
import { Divider, DividerPropsSchema } from '@eb/block-divider';
import { Image, ImagePropsSchema } from '@eb/block-image';
import { NotionTextPropsSchema, NotionTextReader } from '@eb/block-notion-text';
import { BlockSocialMedia, BlockSocialMediaPropsScheme } from '@eb/block-social-media';
import { Spacer, SpacerPropsSchema } from '@eb/block-spacer';
import {
  type BlockConfiguration,
  type BlockSchemaDefaults,
  getSchemaDefaults,
  resolveBlockData,
  type ThemeJson,
} from '@eb/document-core';

import {
  buildBlockComponent,
  buildBlockConfigurationDictionary,
  buildBlockConfigurationSchema,
} from '../../../document-core/src';
import ColumnsContainerPropsSchema from '../blocks/ColumnsContainer/ColumnsContainerPropsSchema';
import ColumnsContainerReader from '../blocks/ColumnsContainer/ColumnsContainerReader';
import { ContainerPropsSchema } from '../blocks/Container/ContainerPropsSchema';
import ContainerReader from '../blocks/Container/ContainerReader';
import { EmailLayoutPropsSchema } from '../blocks/EmailLayout/EmailLayoutPropsSchema';
import EmailLayoutReader from '../blocks/EmailLayout/EmailLayoutReader';

import { migrateReaderDocument } from './migrateDocument';
import { RootDataProvider } from './renderContext';
import { useViewport, ViewportProvider } from './viewport';

const ReaderContext = createContext<TReaderDocument>({});

function useReaderDocument() {
  return useContext(ReaderContext);
}

const READER_DICTIONARY = buildBlockConfigurationDictionary({
  ColumnsContainer: {
    schema: ColumnsContainerPropsSchema,
    Component: ColumnsContainerReader,
  },
  Container: {
    schema: ContainerPropsSchema,
    Component: ContainerReader,
  },
  EmailLayout: {
    schema: EmailLayoutPropsSchema,
    Component: EmailLayoutReader,
  },
  Button: {
    schema: ButtonPropsSchema,
    Component: Button,
  },
  Divider: {
    schema: DividerPropsSchema,
    Component: Divider,
  },
  Image: {
    schema: ImagePropsSchema,
    Component: Image,
  },
  Spacer: {
    schema: SpacerPropsSchema,
    Component: Spacer,
  },
  SocialMedia: {
    schema: BlockSocialMediaPropsScheme,
    Component: BlockSocialMedia,
  },
  NotionText: {
    schema: NotionTextPropsSchema,
    Component: (props) => <NotionTextReader {...props} />,
  },
});

type ReaderSchemaDictionary = {
  [K in keyof typeof READER_DICTIONARY]: (typeof READER_DICTIONARY)[K]['schema'];
};

/**
 * Per-block-type schema defaults derived from each block's Zod
 * `.default(...)` declarations. Pre-computed at module load so
 * `ReaderBlock` can pass them to `resolveBlockData` as level 3 of the
 * resolution chain — see `skills/theme-system.md`.
 *
 * Exported because `cleanDocument` (in the standalone editor) also
 * needs to resolve blocks before emitting CSS rules with `!important`,
 * otherwise its rules drift from the inline styles emitted by Reader
 * and the !important rules win, hiding the resolved values. See
 * L42-312.
 */
export const READER_SCHEMA_DEFAULTS_BY_TYPE: Record<string, BlockSchemaDefaults> =
  Object.fromEntries(
    Object.entries(READER_DICTIONARY).map(([type, entry]) => [
      type,
      (getSchemaDefaults(entry.schema) as BlockSchemaDefaults | undefined) ?? {},
    ]),
  );

const ReaderBlockSchemaInternal: z.ZodType<BlockConfiguration<ReaderSchemaDictionary>> =
  buildBlockConfigurationSchema(READER_DICTIONARY);
export type TReaderBlock = z.infer<typeof ReaderBlockSchemaInternal>;
export const ReaderBlockSchema: z.ZodType<TReaderBlock> = ReaderBlockSchemaInternal;
export type TReaderDocument = Record<string, TReaderBlock>;
export const ReaderDocumentSchema: z.ZodType<TReaderDocument> = z.record(
  z.string(),
  ReaderBlockSchema,
);

const BaseReaderBlock = buildBlockComponent(READER_DICTIONARY);

export type TReaderBlockProps = { id: string };
export function ReaderBlock({ id }: TReaderBlockProps) {
  const document = useReaderDocument();
  const viewport = useViewport();
  const block = document[id];

  // Phase 2b — pre-merge theme overrides into block.data so block
  // components can keep reading `style?.<key>` / `props?.<key>` without
  // any awareness of the theme. The root document carries the theme on
  // `root.data.theme`; legacy documents without one short-circuit
  // through the helper's fast path and the original `block` reference
  // is returned unchanged.
  //
  // Schema defaults are pre-computed per block type at module load and
  // passed as level 3 of the chain. See `skills/theme-system.md`.
  const rootBlock = document.root as { data?: { theme?: ThemeJson } } | undefined;
  const theme = rootBlock?.data?.theme;
  const resolved = useMemo(
    () =>
      block
        ? resolveBlockData(block, theme, viewport, READER_SCHEMA_DEFAULTS_BY_TYPE[block.type])
        : undefined,
    [block, theme, viewport],
  );

  if (!resolved) return null;
  return <BaseReaderBlock {...resolved} blockId={id} isNotClient />;
}

export type TReaderProps = {
  document: Record<string, TReaderBlock>;
  rootBlockId: string;
  /**
   * Pin the rendering viewport for this subtree, regardless of what the
   * editor's `selectedScreenSize` is. The HTML export (`renderToStaticMarkup`)
   * passes `'desktop'` so its inline styles always work in email clients
   * that strip `<style>` blocks (Outlook desktop) — the `@media` rules
   * emitted by `cleanDocument` keep handling mobile. Omit to follow the
   * editor toggle (Preview tab, AI streaming preview).
   */
  viewport?: 'desktop' | 'mobile';
};
export default function Reader({ document, rootBlockId, viewport }: TReaderProps) {
  // Migrar bloques CustomEditor / Wysiwyg / Html / Heading a NotionText.
  const migratedDocument = migrateReaderDocument(document);

  // Provide the document root's data (fontFamily, textColor, linkGlobal, …)
  // through context so block renderers resolve inheritance fallbacks
  // without touching any store — this is what makes the render tree
  // Node-safe. The editor still wraps its canvas in its own providers
  // for the live editing experience.
  const rootData =
    (migratedDocument.root as { data?: Record<string, unknown> } | undefined)?.data ?? null;

  const tree = (
    <RootDataProvider value={rootData}>
      <ReaderContext.Provider value={migratedDocument}>
        <ReaderBlock id={rootBlockId} />
      </ReaderContext.Provider>
    </RootDataProvider>
  );

  // When `viewport` is provided, pin it for this subtree (HTML export
  // forces 'desktop'). When omitted, follow the ambient ViewportContext
  // so the editor's live viewport toggle (Preview tab, AI preview) keeps
  // driving the render.
  return viewport ? <ViewportProvider value={viewport}>{tree}</ViewportProvider> : tree;
}
