import React from 'react';

import {
  ArticleOutlined,
  Crop32Outlined,
  Groups2,
  HorizontalRuleOutlined,
  ImageOutlined,
  LibraryAddOutlined,
  SmartButtonOutlined,
  ViewColumnOutlined,
} from '@mui/icons-material';

import { TEditorBlock } from '../../documents/editor/core';
import {
  DEFAULT_IMAGE_PLACEHOLDER,
  getImagePlaceholder,
} from '../../documents/editor/EditorContext';
import { generateUUID } from '../TemplatePanel/helper/extraFunctions';

export type TButtonProps = {
  label: string;
  /** i18n key (in the `inspector` namespace) for the localized block name. */
  labelKey: string;
  icon: React.ReactElement;
  block: () => TEditorBlock;
};

/**
 * Block factories for the Components Library "Blocks" tab (built-in
 * basics — Text, Social, Button, Image, Divider, Spacer, Columns,
 * Container). This is the single source of truth for fresh block
 * instances inserted via drag or click from `BlocksCategoryContent`.
 *
 * IMPORTANT: these factories must NOT seed `style` or `props` values
 * that the block schema already declares as `.default(...)`. Anything
 * stored in `block.data.style.<key>` or `block.data.props.<key>` is
 * level 1 of the resolver chain (see `skills/theme-system.md`) and
 * silently shadows per-block theme overrides at level 2 — even if the
 * seeded value happens to equal the schema default, it freezes that
 * value into the document and prevents `theme.blocks[type]` from ever
 * winning for fresh blocks.
 *
 * What stays here is therefore:
 *   - block content (text, html, image url, social media items),
 *   - structural choices that the block schema does NOT yet declare a
 *     default for (e.g. Button `props.size` / `style.shape`,
 *     ColumnsContainer column structure, Image `size` / `contentAlignment`
 *     / `touched`).
 *
 * Defaults flow from the block schema (level 3) and are overridable via
 * `theme.blocks[type]` (level 2). The seed-shadowing guardrail spec
 * (`builtInBlocks.spec.tsx` next to this file) enforces that nothing else
 * sneaks back in.
 */
export const BUTTONS: TButtonProps[] = [
  {
    label: 'Text',
    labelKey: 'theme.blocks.notionText.title',
    icon: <ArticleOutlined />,
    block: () => ({
      type: 'NotionText',
      data: {
        // Empty html so freshly added text blocks land on a blank
        // canvas instead of the schema's placeholder ("Double click to
        // edit..."). This is content, not styling, so it correctly
        // lives in the seed.
        props: { html: '' },
      },
    }),
  },
  {
    label: 'Social',
    labelKey: 'theme.blocks.socialMedia.title',
    icon: <Groups2 />,
    block: () => ({
      type: 'SocialMedia',
      data: {
        items: [
          {
            id: generateUUID(),
            key: 'facebook',
            label: 'Facebook',
            iconName: 'Facebook',
            theme: 'positive',
            size: 'small',
            sizePx: '24px',
            url: 'https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/Facebook_Positive_24px.png',
            href: '',
          },
        ],
        gap: 1,
      },
    }),
  },
  {
    label: 'Button',
    labelKey: 'theme.blocks.button.title',
    icon: <SmartButtonOutlined />,
    block: () => ({
      type: 'Button',
      data: {
        // `size` and `shape` have no schema `.default(...)` yet, so
        // seeding them here is the only way to give fresh buttons a
        // sensible starting layout. If/when those move to the schema,
        // delete them from this seed too.
        props: {
          text: 'Button',
          size: 'medium',
        },
        style: {
          shape: 'rectangle',
        },
      },
    }),
  },
  {
    label: 'Image',
    labelKey: 'theme.blocks.image.title',
    icon: <ImageOutlined />,
    block: () => {
      const placeholder = getImagePlaceholder() || DEFAULT_IMAGE_PLACEHOLDER;
      return {
        type: 'Image',
        data: {
          // `url` is the placeholder content; `size`, `contentAlignment`
          // and `touched` have no schema default and gate render
          // behaviour (auto-resize, alignment) so they have to ship in
          // the seed. Padding / textAlign fall through to the schema.
          props: {
            url: placeholder,
            contentAlignment: 'middle',
            size: 'fill',
            touched: false,
          },
        },
      };
    },
  },
  {
    label: 'Divider',
    labelKey: 'theme.blocks.divider.title',
    icon: <HorizontalRuleOutlined />,
    block: () => ({
      type: 'Divider',
      // padding / height / color / width / textAlign all have schema
      // defaults; theme overrides win.
      data: {},
    }),
  },
  {
    label: 'Spacer',
    labelKey: 'theme.blocks.spacer.title',
    icon: <Crop32Outlined />,
    block: () => ({
      type: 'Spacer',
      data: {},
    }),
  },
  {
    label: 'Columns',
    labelKey: 'theme.blocks.columnsContainer.title',
    icon: <ViewColumnOutlined />,
    block: () => ({
      type: 'ColumnsContainer',
      data: {
        // Structural-only seed: column count, layout choice and child
        // slots. `style.padding` falls through to schema/theme.
        props: {
          columnsCount: 3,
          columns: [{ childrenIds: [] }, { childrenIds: [] }, { childrenIds: [] }],
          fixedWidths: [33, 34, 33],
          layout: 'layout-33-34-33',
        },
      },
    }),
  },
  {
    label: 'Container',
    labelKey: 'theme.blocks.container.title',
    icon: <LibraryAddOutlined />,
    block: () => ({
      type: 'Container',
      data: {},
    }),
  },
];
