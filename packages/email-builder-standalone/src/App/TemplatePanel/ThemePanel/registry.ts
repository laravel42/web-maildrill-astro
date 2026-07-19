/**
 * Phase 2c — Inspector Theme panel registry.
 *
 * Curated list of theme-overridable fields per block type. The runtime
 * resolution chain (`resolveBlockProp` / `resolveBlockData`) accepts any
 * key under `theme.blocks[type].{style|props}`, but exposing every
 * possible key in the UI would be overwhelming. This registry picks the
 * high-value fields that most templates want to standardize.
 *
 * To add a new field: append an entry under the relevant block type with
 * the right `kind`. The corresponding input is rendered by
 * `ThemeFieldRow.tsx`. Adding a new `kind` requires updating
 * `ThemeFieldRow.tsx` too.
 *
 * The labels reference i18n keys under `theme.fields.*` in
 * `inspector.json`. Keep keys camelCase to match the convention used by
 * existing inspector keys.
 */

import type { SvgIconComponent } from '@mui/icons-material';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import Crop32Outlined from '@mui/icons-material/Crop32Outlined';
import Groups2 from '@mui/icons-material/Groups2';
import HorizontalRuleOutlined from '@mui/icons-material/HorizontalRuleOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import LibraryAddOutlined from '@mui/icons-material/LibraryAddOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import SmartButtonOutlined from '@mui/icons-material/SmartButtonOutlined';
import ViewColumnOutlined from '@mui/icons-material/ViewColumnOutlined';

import type { ThemeSection } from '../../../documents/editor/EditorContext';
import { TextColorIcon } from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/style-inputs/SingleStylePropertyPanel';

export type ThemeFieldKind =
  'color' | 'padding' | 'fontSize' | 'fontFamily' | 'fontWeight' | 'textAlign' | 'number' | 'border';

export type ThemeField = {
  /** `style` or `props` — matches the runtime resolution chain. */
  section: ThemeSection;
  /** Key inside `theme.blocks[type][section]`. */
  key: string;
  /** UI input to render for this field. */
  kind: ThemeFieldKind;
  /** i18n key relative to the `theme` namespace (see `inspector.json`). */
  labelKey: string;
  /** Optional icon override (falls back to KIND_ICONS in ThemeFieldRow). */
  icon?: SvgIconComponent;
};

export type ThemeBlockSpec = {
  /** Translation key for the accordion title. */
  titleKey: string;
  /** MUI icon component for compact mode. */
  icon: SvgIconComponent;
  fields: ReadonlyArray<ThemeField>;
};

const PADDING_FIELD: ThemeField = {
  section: 'style',
  key: 'padding',
  kind: 'padding',
  labelKey: 'theme.fields.padding',
};

const BACKGROUND_COLOR_FIELD: ThemeField = {
  section: 'style',
  key: 'backgroundColor',
  kind: 'color',
  labelKey: 'theme.fields.backgroundColor',
};

// const FONT_FAMILY_FIELD: ThemeField = {
//   section: 'style',
//   key: 'fontFamily',
//   kind: 'fontFamily',
//   labelKey: 'theme.fields.fontFamily',
// };
// Disabled: fontFamily is edited globally on the Root accordion
// (`root.data.fontFamily`). Keeping a single global edit point.

const FONT_WEIGHT_FIELD: ThemeField = {
  section: 'style',
  key: 'fontWeight',
  kind: 'fontWeight',
  labelKey: 'theme.fields.fontWeight',
};

const TEXT_ALIGN_FIELD: ThemeField = {
  section: 'style',
  key: 'textAlign',
  kind: 'textAlign',
  labelKey: 'theme.fields.textAlign',
};

/**
 * Block types in the order they appear in the panel. The order is meant
 * to match the user's mental model: text-bearing blocks first, then
 * layout containers, then standalone primitives.
 */
export const THEME_BLOCK_ORDER = [
  'NotionText',
  'Button',
  'Image',
  'Divider',
  'Spacer',
  'SocialMedia',
  'Container',
  'ColumnsContainer',
] as const;

export type ThemeBlockType = (typeof THEME_BLOCK_ORDER)[number];

export const THEME_BLOCK_REGISTRY: Record<ThemeBlockType, ThemeBlockSpec> = {
  NotionText: {
    titleKey: 'theme.blocks.notionText.title',
    icon: ArticleOutlined,
    fields: [
      BACKGROUND_COLOR_FIELD,
      { section: 'style', key: 'fontSize', kind: 'fontSize', labelKey: 'theme.fields.fontSize' },
      // fontFamily intentionally omitted — edited globally on the Root
      // accordion. textAlign omitted — Tiptap manages alignment per
      // paragraph via inline styles. fontWeight (bold) and color are
      // managed per-span via Tiptap's bubble menu, so a per-block-type
      // override would duplicate existing edit points.
      PADDING_FIELD,
    ],
  },
  Button: {
    titleKey: 'theme.blocks.button.title',
    icon: SmartButtonOutlined,
    fields: [
      {
        section: 'style',
        key: 'buttonBackgroundColor',
        kind: 'color',
        labelKey: 'theme.fields.buttonBackgroundColor',
        icon: PaletteOutlined,
      },
      {
        section: 'style',
        key: 'buttonTextColor',
        kind: 'color',
        labelKey: 'theme.fields.buttonTextColor',
        icon: TextColorIcon,
      },
      // fontFamily intentionally omitted — edited globally on the Root accordion.
      { section: 'style', key: 'fontSize', kind: 'fontSize', labelKey: 'theme.fields.fontSize' },
      FONT_WEIGHT_FIELD,
      TEXT_ALIGN_FIELD,
      BACKGROUND_COLOR_FIELD,
      PADDING_FIELD,
    ],
  },
  Image: {
    titleKey: 'theme.blocks.image.title',
    icon: ImageOutlined,
    fields: [BACKGROUND_COLOR_FIELD, PADDING_FIELD],
  },
  Divider: {
    titleKey: 'theme.blocks.divider.title',
    icon: HorizontalRuleOutlined,
    fields: [
      { section: 'style', key: 'color', kind: 'color', labelKey: 'theme.fields.color', icon: PaletteOutlined },
      BACKGROUND_COLOR_FIELD,
      { section: 'style', key: 'width', kind: 'number', labelKey: 'theme.fields.width' },
      { section: 'style', key: 'height', kind: 'number', labelKey: 'theme.fields.height' },
      PADDING_FIELD,
    ],
  },
  Spacer: {
    titleKey: 'theme.blocks.spacer.title',
    icon: Crop32Outlined,
    fields: [
      BACKGROUND_COLOR_FIELD,
      { section: 'style', key: 'height', kind: 'number', labelKey: 'theme.fields.height' },
    ],
  },
  SocialMedia: {
    titleKey: 'theme.blocks.socialMedia.title',
    icon: Groups2,
    fields: [BACKGROUND_COLOR_FIELD, PADDING_FIELD],
  },
  Container: {
    titleKey: 'theme.blocks.container.title',
    icon: LibraryAddOutlined,
    fields: [
      BACKGROUND_COLOR_FIELD,
      { section: 'style', key: 'border', kind: 'border', labelKey: 'theme.fields.border' },
      PADDING_FIELD,
    ],
  },
  ColumnsContainer: {
    titleKey: 'theme.blocks.columnsContainer.title',
    icon: ViewColumnOutlined,
    fields: [BACKGROUND_COLOR_FIELD, PADDING_FIELD],
  },
};
