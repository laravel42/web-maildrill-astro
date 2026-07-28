import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';

export type Props = {
  channel: ChannelType;
  name?: string | null;
  kind?: 'template' | 'campaign';
  initialCategory?: string;
  initialLanguage?: string | null;
  /** Saved body when reopening an existing template, so edits replace it. */
  initialMessage?: string;
  /**
   * Saved builderDoc when reopening. Voice templates keep their TTS selection
   * here: `{ voice: { label, name, gender, sayLanguage }, speed, speechRate }`.
   */
  initialBuilderDoc?: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (payload: {
    channel: ChannelType;
    name: string;
    message: string;
    category: string;
    language: string;
    /** Present for voice templates: the persisted TTS selection. */
    builderDoc?: Record<string, unknown>;
  }) => void | Promise<void>;
};

/** A draggable item in the email builder's structure/blocks palette. */
export type BlockDef = { label: string; icon: IconName };
