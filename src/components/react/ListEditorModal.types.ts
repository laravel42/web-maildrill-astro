import type { ChannelType } from '@/types/app';

export type ListEditorValues = {
  name: string;
  notes: string;
  color: string;
  /** Marks the list as requiring / recording GDPR consent. */
  gdprConsent: boolean;
  /** Channels this list is for. Never empty — the editor will not save without one. */
  channels: ChannelType[];
};
