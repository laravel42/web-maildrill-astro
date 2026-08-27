import type { ChannelSenders } from '@/lib/app/channel-senders';
import type { ChannelType, TemplateApprovalStatus } from '@/types/app';

export type Step = 1 | 2 | 3 | 4 | 5 | 6;
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
  /** Total members (email channel and list totals). */
  count: number | null;
  /** Members with a non-null phone — used for SMS / WhatsApp / Voice reach. */
  phoneCount?: number | null;
  /** List colour (hex), for the list badge. Only set for `kind: 'list'`. */
  color?: string | null;
  /**
   * Channels the list or segment is declared for.
   * Defaults to email when the API omits it.
   */
  channels?: ChannelType[];
};

/** A saved template the campaign can send, narrowed to the chosen channel. */
export type TemplateChoice = {
  id: string;
  name: string;
  category: string | null;
  channel: ChannelType;
  /** WhatsApp approval state; the wizard only offers approved WhatsApp templates. */
  approvalStatus?: TemplateApprovalStatus | null;
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
  accent?: string;
};

/** What the wizard collected, handed to the caller so it can be persisted. */
export type CampaignDraft = {
  name: string;
  channel: ChannelType;
  /** Selected lists — may be several; API still uses `listId` for the primary. */
  listIds?: string[];
  /** Selected segments — may be several; API still uses `segmentId` for the primary. */
  segmentIds?: string[];
  /** Primary list for APIs that accept a single selector. */
  listId?: string;
  /** Primary segment for APIs that accept a single selector. */
  segmentId?: string;
  /** Set when the campaign sends a saved template rather than ad-hoc content. */
  templateId?: string;
  /** Ad-hoc message body, used by SMS/WhatsApp/Voice instead of a template. */
  content?: Record<string, unknown>;
  /** Human label for the chosen audience, for toasts and the review step. */
  audienceLabel: string;
  schedule: Schedule;
  /** ISO timestamp when `schedule === 'later'`. */
  scheduledAt?: string | null;
};

export type Props = {
  mode: 'create' | 'edit';
  initialChannel?: ChannelType; // default 'email'
  initialName?: string; // default '' (create) or the campaign name (edit)
  /** Saved email subject of the campaign being edited (email channel only). */
  initialSubject?: string;
  /** Saved From address of the campaign being edited (email channel only). */
  initialFrom?: string;
  /** Saved email open/click tracking flags (email channel only; default on). */
  initialTrackOpens?: boolean;
  initialTrackClicks?: boolean;
  /** Saved audiences of the campaign being edited (list and/or segment ids). */
  initialAudienceIds?: string[];
  /** Saved template of the campaign being edited. */
  initialTemplateId?: string | null;
  /** Saved body of the campaign being edited (SMS/WhatsApp/Voice). */
  initialMessage?: string;
  initialSchedule?: Schedule;
  /** Saved scheduled send time (edit mode). */
  initialScheduledAt?: string | null;
  /** Real lists/segments. Empty or omitted → the audience step explains why. */
  audiences?: AudienceChoice[];
  /** Real saved templates, filtered to the active channel by the wizard. */
  templates?: TemplateChoice[];
  /** Live outbound sender labels from the service (Infobip config). */
  senders?: ChannelSenders;
  /**
   * Verified workspace domain names for the email From select.
   * `undefined` = still loading (board prefetches); a list (possibly empty) =
   * ready — the wizard does not fetch domains itself.
   */
  verifiedDomains?: string[];
  onClose: () => void; // X / overlay click / Escape
  onDone: (msg: string, draft: CampaignDraft) => void; // final "Schedule campaign" / "Save changes"
};
