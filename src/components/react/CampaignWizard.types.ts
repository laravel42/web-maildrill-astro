import type { ChannelType } from '@/types/app';

export type Step = 1 | 2 | 3 | 4 | 5;
export type Schedule = 'now' | 'later';

/**
 * A real, sendable audience: one of the workspace's lists or segments. There is
 * deliberately no "everyone" option — the service resolves an empty selector to
 * zero recipients, so a blanket send has to be an explicit list or segment.
 */
export type AudienceChoice = {
  id: string;
  kind: 'list' | 'segment';
  name: string;
  desc: string;
  count: number | null;
  /** List colour (hex), for the list badge. Only set for `kind: 'list'`. */
  color?: string | null;
};

/** A saved template the campaign can send, narrowed to the chosen channel. */
export type TemplateChoice = {
  id: string;
  name: string;
  category: string | null;
  channel: ChannelType;
};

export type Template = {
  /** Set when the card came from a saved template; absent for preview fixtures. */
  id?: string;
  name: string;
  thumb: string;
  cat: string;
  title?: string;
  kicker?: string;
  cta?: string;
  fg?: string;
};

/** What the wizard collected, handed to the caller so it can be persisted. */
export type CampaignDraft = {
  name: string;
  channel: ChannelType;
  /** Exactly one of these is set when a real audience was picked. */
  listId?: string;
  segmentId?: string;
  /** Set when the campaign sends a saved template rather than ad-hoc content. */
  templateId?: string;
  /** Ad-hoc message body, used by SMS/WhatsApp/Voice instead of a template. */
  content?: Record<string, unknown>;
  /** Human label for the chosen audience, for toasts and the review step. */
  audienceLabel: string;
  schedule: Schedule;
};

export type Props = {
  mode: 'create' | 'edit';
  initialChannel?: ChannelType; // default 'email'
  initialName?: string; // default '' (create) or the campaign name (edit)
  /** Saved audience of the campaign being edited (list or segment id). */
  initialAudienceId?: string | null;
  /** Saved template of the campaign being edited. */
  initialTemplateId?: string | null;
  /** Saved body of the campaign being edited (SMS/WhatsApp/Voice). */
  initialMessage?: string;
  initialSchedule?: Schedule;
  /** Real lists/segments. Empty or omitted → the audience step explains why. */
  audiences?: AudienceChoice[];
  /** Real saved templates, filtered to the active channel by the wizard. */
  templates?: TemplateChoice[];
  onClose: () => void; // X / overlay click / Escape
  onDone: (msg: string, draft: CampaignDraft) => void; // final "Schedule campaign" / "Save changes"
  onOpenBuilder?: (channel: ChannelType, name: string) => void; // step-3 "Open in builder →" (email only)
};
