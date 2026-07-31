import React, { memo } from 'react';

import { Button, ButtonPropsSchema } from '@eb/block-button';
import { Divider, DividerPropsSchema } from '@eb/block-divider';
import { Image, ImagePropsSchema } from '@eb/block-image';
import { NotionText, NotionTextPropsSchema } from '@eb/block-notion-text';
import { BlockSocialMedia, BlockSocialMediaPropsScheme } from '@eb/block-social-media';
import { Spacer, SpacerPropsSchema } from '@eb/block-spacer';
import {
  type BlockSchemaDefaults,
  buildBlockComponent,
  buildBlockConfigurationDictionary,
  EditorBlockSchema as CoreEditorBlockSchema,
  EditorConfigurationSchema as CoreEditorConfigurationSchema,
  getSchemaDefaults,
  type TEditorBlock as CoreTEditorBlock,
  type TEditorConfiguration as CoreTEditorConfiguration,
} from '@eb/document-core';

import ColumnsContainerEditor from '../blocks/ColumnsContainer/ColumnsContainerEditor';
import ColumnsContainerPropsSchema from '../blocks/ColumnsContainer/ColumnsContainerPropsSchema';
import ContainerEditor from '../blocks/Container/ContainerEditor';
import ContainerPropsSchema from '../blocks/Container/ContainerPropsSchema';
import EmailLayoutEditor from '../blocks/EmailLayout/EmailLayoutEditor';
import EmailLayoutPropsSchema from '../blocks/EmailLayout/EmailLayoutPropsSchema';
import EditorBlockWrapper from '../blocks/helpers/block-wrappers/EditorBlockWrapper';

import { useDisableEdition, useSelectedScreenSize } from './EditorContext';

// Memoizar todos los componentes de bloques para evitar re-renders innecesarios
const MemoizedBlockSocialMedia = memo(BlockSocialMedia);

/**
 * Thin connector around `BlockSocialMedia` that provides the editor-only
 * Zustand values (`selectedScreenSize`, `disableEdition`) via hooks. The
 * base component was decoupled from editor-sample in L42-211 so it can be
 * registered in the Reader dictionary without creating an import cycle; the
 * editor still needs the live hook values for responsive previews and the
 * canvas link-guard, which this wrapper supplies.
 */
const BlockSocialMediaEditor: typeof BlockSocialMedia = (props) => {
  const selectedScreenSize = useSelectedScreenSize();
  const disableEdition = useDisableEdition();
  return (
    <MemoizedBlockSocialMedia
      {...props}
      selectedScreenSize={selectedScreenSize}
      disableEdition={disableEdition}
    />
  );
};
const MemoizedButton = memo(Button);
const MemoizedContainerEditor = memo(ContainerEditor);
const MemoizedColumnsContainerEditor = memo(ColumnsContainerEditor);
const MemoizedImage = memo(Image);
const MemoizedNotionText = memo(NotionText);
const MemoizedSpacer = memo(Spacer);
const MemoizedDivider = memo(Divider);

const EDITOR_DICTIONARY = buildBlockConfigurationDictionary({
  SocialMedia: {
    schema: BlockSocialMediaPropsScheme,
    Component: (props) => (
      <EditorBlockWrapper isNotClient={props.isNotClient}>
        <BlockSocialMediaEditor {...props} />
      </EditorBlockWrapper>
    ),
  },
  Button: {
    schema: ButtonPropsSchema,
    Component: (props) => {
      return (
        <EditorBlockWrapper isNotClient={props.isNotClient}>
          <MemoizedButton {...props} />
        </EditorBlockWrapper>
      );
    },
  },
  Container: {
    schema: ContainerPropsSchema,
    Component: (props) => {
      return (
        <EditorBlockWrapper isNotClient={props.isNotClient}>
          <MemoizedContainerEditor {...(props as any)} />
        </EditorBlockWrapper>
      );
    },
  },
  ColumnsContainer: {
    schema: ColumnsContainerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper isNotClient={props.isNotClient}>
        <MemoizedColumnsContainerEditor {...(props as any)} />
      </EditorBlockWrapper>
    ),
  },
  Image: {
    schema: ImagePropsSchema,
    Component: (blockProps) => {
      const imageProps = {
        ...blockProps,
        props: {
          ...blockProps.props,
          url:
            blockProps.props?.url ?? 'https://placehold.co/600x400@2x/F8F8F8/CCC?text=Your%20image',
        },
      };
      return (
        <EditorBlockWrapper isNotClient={blockProps.isNotClient}>
          <MemoizedImage {...imageProps} />
        </EditorBlockWrapper>
      );
    },
  },
  NotionText: {
    schema: NotionTextPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper isNotClient={props.isNotClient}>
        <MemoizedNotionText blockId={props.blockId ?? ''} {...props} />
      </EditorBlockWrapper>
    ),
  },
  EmailLayout: {
    schema: EmailLayoutPropsSchema,
    Component: (p) => <EmailLayoutEditor {...p} />,
  },
  Spacer: {
    schema: SpacerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper isNotClient={props.isNotClient}>
        <MemoizedSpacer {...props} />
      </EditorBlockWrapper>
    ),
  },
  Divider: {
    schema: DividerPropsSchema,
    Component: (props) => (
      <EditorBlockWrapper isNotClient={props.isNotClient}>
        <MemoizedDivider {...props} />
      </EditorBlockWrapper>
    ),
  },
});

export const EditorBlock = buildBlockComponent(EDITOR_DICTIONARY);

/**
 * Per-block-type schema defaults derived from each block's Zod
 * `.default(...)` declarations. Pre-computed at module load so
 * `EditorBlock` (in `EditorBlock.tsx`) can pass them to
 * `resolveBlockData` as level 3 of the resolution chain — see
 * `skills/theme-system.md` for the chain documentation.
 *
 * Keyed by block type string, mirroring `EDITOR_DICTIONARY`. Block types
 * with no schema defaults map to an empty object.
 */
export const EDITOR_SCHEMA_DEFAULTS_BY_TYPE: Record<string, BlockSchemaDefaults> =
  Object.fromEntries(
    Object.entries(EDITOR_DICTIONARY).map(([type, entry]) => [
      type,
      (getSchemaDefaults(entry.schema) as BlockSchemaDefaults | undefined) ?? {},
    ]),
  );

// Canonical schemas re-exported from @eb/document-core (Node-safe, no browser deps).
export type TEditorBlock = CoreTEditorBlock;
export const EditorBlockSchema = CoreEditorBlockSchema;
export type TEditorConfiguration = CoreTEditorConfiguration;
export const EditorConfigurationSchema = CoreEditorConfigurationSchema;
