import {
  AutoAwesome,
  EmojiEmotions,
  FormatListBulleted,
  FormatListNumbered,
  HorizontalRule,
  LocalOffer,
} from '@mui/icons-material';
import type { Editor, Range } from '@tiptap/core';

import { aiFeatures } from './ai-features-config';
import { getMergeTags, type MergeTag } from './merge-tags-config';

export interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command?: ({ editor, range }: { editor: Editor; range: Range }) => void;
  keywords?: string[];
  submenu?: SlashSubmenuItem[];
  requiresAI?: boolean; // Solo visible si enableAI está activo
}

export interface SlashSubmenuItem {
  title: string;
  icon?: React.ReactNode;
  value: string;
  type?: 'divider';
}

export const slashMenuItems: SlashMenuItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>H1</span>,
    keywords: ['h1', 'heading', 'title'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>H2</span>,
    keywords: ['h2', 'heading', 'subtitle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <span style={{ fontWeight: 'bold' }}>H3</span>,
    keywords: ['h3', 'heading'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a bulleted list',
    icon: <FormatListBulleted fontSize="small" />,
    keywords: ['ul', 'list', 'bullet'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: <FormatListNumbered fontSize="small" />,
    keywords: ['ol', 'list', 'ordered', 'number'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },

  {
    title: 'Divider',
    description: 'Add a horizontal divider',
    icon: <HorizontalRule fontSize="small" />,
    keywords: ['hr', 'line', 'separator', 'divider'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Merge Tag',
    description: 'Insert a merge tag variable',
    icon: <LocalOffer fontSize="small" />,
    keywords: ['merge', 'tag', 'variable', 'dynamic', 'placeholder'],
    submenu: (() => {
      const mergeTags = getMergeTags();
      return mergeTags.children.map((tag: MergeTag) => ({
        title: tag.label || '',
        icon: tag.icon,
        value: tag.value || '',
        type: tag.type,
      }));
    })(),
  },
  {
    title: 'Emoji',
    description: 'Insert an emoji',
    icon: <EmojiEmotions fontSize="small" />,
    keywords: ['emoji', 'emoticon', 'smiley', 'face'],
    // Este item abrirá un emoji picker especial
    command: ({ editor, range }) => {
      // Este comando será manejado de forma especial en el SlashMenu
      editor.chain().focus().deleteRange(range).run();
    },
  },
  {
    title: 'AI Features',
    description: 'Use AI to improve your text',
    icon: <AutoAwesome fontSize="small" />,
    keywords: ['ai', 'artificial', 'intelligence', 'improve', 'rewrite', 'grammar'],
    requiresAI: true, // Solo visible si enableAI está activo
    submenu: (() => {
      return aiFeatures.children.map((feature) => ({
        title: feature.label,
        icon: feature.icon,
        value: feature.value,
      }));
    })(),
  },
];

/**
 * Filtra los items del slash menu según el estado de enableAI.
 */
export function getFilteredSlashMenuItems(enableAI: boolean): SlashMenuItem[] {
  return slashMenuItems.filter((item) => {
    // Si el item requiere AI y no está habilitado, no mostrarlo
    if (item.requiresAI && !enableAI) {
      return false;
    }

    return true;
  });
}
