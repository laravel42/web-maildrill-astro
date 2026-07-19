import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';

export type Props = {
  channel: ChannelType;
  name?: string | null;
  kind?: 'template' | 'campaign';
  initialCategory?: string;
  /** Saved body when reopening an existing template, so edits replace it. */
  initialMessage?: string;
  onClose: () => void;
  onSave: (payload: {
    channel: ChannelType;
    name: string;
    message: string;
    category: string;
  }) => void | Promise<void>;
};

/** A draggable item in the email builder's structure/blocks palette. */
export type BlockDef = { label: string; icon: IconName };
