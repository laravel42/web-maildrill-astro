import type { ChannelType } from '@/types/app';

export type Step = 1 | 2 | 3 | 4 | 5;
export type Audience = 'newsletter' | 'vip' | 'all';
export type Schedule = 'now' | 'later';

export type Template = {
  name: string;
  thumb: string;
  cat: string;
  title?: string;
  kicker?: string;
  cta?: string;
  fg?: string;
};

export type AudienceOption = {
  key: Audience;
  name: string;
  desc: string;
  count: string;
};

/** What the wizard collected, handed to the caller so it can be persisted. */
export type CampaignDraft = {
  name: string;
  channel: ChannelType;
  audience: Audience;
  schedule: Schedule;
};

export type Props = {
  mode: 'create' | 'edit';
  initialChannel?: ChannelType; // default 'email'
  initialName?: string; // default '' (create) or the campaign name (edit)
  onClose: () => void; // X / overlay click / Escape
  onDone: (msg: string, draft: CampaignDraft) => void; // final "Schedule campaign" / "Save changes"
  onOpenBuilder?: (channel: ChannelType, name: string) => void; // step-3 "Open in builder →" (email only)
};
