import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import { toGalleryTemplate, templateEngagement, type ApiTemplate } from '@/lib/app/template-map';
import { CATEGORY_COLOR } from '@/lib/app/templates-data';
import type { ChannelSenders } from '@/lib/app/channel-senders';
import { channelSender } from '@/lib/app/channel-senders';
import Icon from './Icon';
import Modal from './shared/Modal';
import GalleryPreview, { FauxEmail, type GalleryPreviewData } from './shared/GalleryPreview';
import TemplatePreview from './shared/TemplatePreview';
import libStyles from './AppTemplates.module.css';
import { CHANNEL, CHANNEL_ORDER, channelLabel } from './shared/channels';
import { formatDuration, voiceSeconds } from './shared/messaging';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  audiencesLabelOf,
  buildReviewRows,
  buildStepDefs,
  emailSenderForDomain,
  getStepBlockedReason,
  isWizardStepBlocked,
  partitionAudienceIds,
  resolveEmailFrom,
  templateCard,
  templateKey,
  fixtureTemplateMessage,
  TEMPLATES,
  trackingCapabilities,
  type ReviewRow,
  type TrackingCapability,
} from './CampaignWizard.logic';
import { prepareAudiencesForChannel } from '@/lib/app/audience-map';
import { routes } from '@/config/routes';
import type { AudienceChoice, Props, Schedule, Step, Template } from './CampaignWizard.types';
import styles from './CampaignWizard.module.css';
import DatePicker from './shared/DatePicker';
import TimePicker from './shared/TimePicker';
import {
  combineScheduledParts,
  defaultScheduledParts,
  isScheduledInFuture,
  nextValidScheduleTime,
  partsFromScheduledAt,
  type ScheduleDate,
  type ScheduleTime,
} from '@/lib/app/schedule';

export type { Props };

/* ---------------------------------------------------------------------------
 * CampaignWizard — faithful React port of the campaign wizard modal.
 * The parent gates mounting (renders this only when open), so the modal shows
 * immediately. Logical step order is 1..5: Basics (template sidebar), Audience,
 * Tracking, Schedule, Review (matching `stepDefs`). Every campaign sends a
 * saved template, so the content it sends is settled on step 1 — there is no
 * separate compose step on any channel.
 * ------------------------------------------------------------------------- */

const INDIGO = '#4f46e5';

/** Shell/preview scale — modal frame, header, footer, and live preview are ~30% larger than the original 960×600 design. Step nav and form inputs stay at original sizes. */
const WZ = 1.3;
const wz = (n: number) => Math.round(n * WZ * 10) / 10;

/** Phone mock width cap — narrower shell (~78% of the prior 256px shell); height fills the preview column. */
const PREVIEW_PHONE_W = wz(200);

const DEFAULT_LIST_COLOR = '#4f46e5';

function initialAudienceSet(ids?: string[]): Set<string> {
  return new Set((ids ?? []).filter(Boolean));
}

function toGalleryPreviewData(t: Template): GalleryPreviewData {
  return {
    name: t.name,
    thumb: t.thumb,
    fg: t.fg,
    accent: t.accent,
    title: t.title,
    kicker: t.kicker,
    cta: t.cta,
  };
}

/* Compact multi-select card for Audience step 2 (3-column grid). */
function AudienceOption({
  id,
  selected,
  onToggle,
  title,
  sub,
  count,
}: {
  id: string;
  selected: boolean;
  onToggle: (id: string) => void;
  title: string;
  sub: string;
  count: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      className={`${styles.audRow}${selected ? ` ${styles.audRowOn}` : ''}`}
      onClick={() => onToggle(id)}
    >
      <span className={`${styles.audBadge} tnum`}>{count}</span>
      <span className={styles.audRowTop}>
        <span
          className={`${styles.audBox}${selected ? ` ${styles.audBoxOn}` : ''}`}
          aria-hidden="true"
        >
          {selected && <Icon name="check" size={12} stroke={3.5} />}
        </span>
        <span className={styles.audTitle}>{title}</span>
      </span>
      {sub ? <span className={styles.audSub}>{sub}</span> : null}
    </button>
  );
}

function AudienceSection({
  heading,
  items,
  emptyMessage,
  selectedIds,
  onToggle,
}: {
  heading: string;
  items: AudienceChoice[];
  emptyMessage: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className={styles.audSection}>
      <h4 className={styles.audSectionHeading}>{heading}</h4>
      {items.length === 0 ? (
        <p className={styles.audSectionEmpty}>{emptyMessage}</p>
      ) : (
        <div className={styles.audGrid} role="group" aria-label={heading}>
          {items.map((a) => (
            <AudienceOption
              key={a.id}
              id={a.id}
              selected={selectedIds.has(a.id)}
              onToggle={onToggle}
              title={a.name}
              sub={a.desc}
              count={a.count == null ? '—' : a.count.toLocaleString()}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One template card for the step-1 picker (slideshow + inline list). Reuses
 * the Templates library's own gallery-card markup and CSS
 * (`AppTemplates.module.css`) so a template looks the same here as it does
 * there: real content preview, category bar, and the same
 * delivery-rate/opens/clicks/failed + created-ago line (`templateEngagement`),
 * fetched once per card in `live` mode. Fixture mode (no backend) or a
 * template with no id yet falls back to the decorative preview with no stats.
 */
function TemplateGalleryCard({
  t,
  channel,
  live,
  selected,
  onSelect,
  previewFit,
}: {
  t: Template;
  channel: ChannelType;
  live: boolean;
  selected: boolean;
  onSelect: (t: Template) => void;
  /**
   * How the preview area is sized, overriding the library card's fixed
   * thumbnail height. `fill` (email slideshow) gives the preview every pixel
   * the card doesn't need, so a real email is read, not cropped to a
   * thumbnail; `compact` (SMS/WhatsApp/Voice list) shrinks to the message
   * body so more templates fit inline.
   */
  previewFit: 'fill' | 'compact';
}) {
  const [full, setFull] = useState<ApiTemplate | null>(null);

  useEffect(() => {
    if (!live || !t.id) return;
    let alive = true;
    void (async () => {
      try {
        const row = await api.get<ApiTemplate>(`templates/${t.id}`);
        if (alive) setFull(row);
      } catch {
        /* card still renders via TemplatePreview's own loading/error state */
      }
    })();
    return () => {
      alive = false;
    };
  }, [t.id, live]);

  const gallery = full ? toGalleryTemplate(full) : null;
  const category = gallery?.category ?? t.cat;
  const categoryColor = CATEGORY_COLOR[category as keyof typeof CATEGORY_COLOR] ?? 'var(--accent)';
  const metrics = gallery ? templateEngagement(gallery) : [];

  const previewFitClass =
    previewFit === 'fill' ? styles.tplPreviewFill : styles.tplPreviewCompact;

  const inner = (
    <>
      <div className={`${libStyles.preview} ${previewFitClass}`} data-preview-fit>
        {t.id && live ? (
          <TemplatePreview
            id={t.id}
            channel={channel}
            live={live}
            fallback={<GalleryPreview channel={channel} t={toGalleryPreviewData(t)} />}
          />
        ) : (
          <GalleryPreview channel={channel} t={toGalleryPreviewData(t)} />
        )}
      </div>
      <div
        className={libStyles.gcatbar}
        style={{
          color: `color-mix(in srgb, ${categoryColor} 55%, var(--text))`,
          background: `color-mix(in srgb, ${categoryColor} 12%, transparent)`,
        }}
      >
        {category}
      </div>
      <div className={`${libStyles.gmeta} ${styles.tplGalleryMeta}`}>
        <div className={libStyles.gname}>{t.name}</div>
        <div className={libStyles.gsub}>
          {metrics.map((m, i) => (
            <span
              key={m.key}
              className={`${libStyles.metric}${m.measured ? '' : ` ${libStyles.metricNone}`}`}
              title={m.hint}
            >
              {i > 0 ? '· ' : ''}
              <span className="tnum">{m.value}</span> {m.label}
            </span>
          ))}
          {gallery ? (
            <span className={libStyles.updated} title={`Created ${gallery.createdOn}`}>
              {gallery.updated}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <button
      type="button"
      className={`${libStyles.gcard} ${styles.tplGalleryCard}${selected ? ` ${styles.tplGalleryCardOn}` : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(t)}
    >
      {inner}
    </button>
  );
}

/**
 * Horizontal, one-at-a-time slideshow of the channel's real templates —
 * arrows/dots to page, scroll-snap for swipe/trackpad. Each slide is a
 * `TemplateGalleryCard` — the same card the inline list (SMS/WhatsApp/Voice)
 * and the Templates library use.
 */
function TemplateSlideshow({
  channel,
  templates,
  selectedKey,
  onSelect,
  live,
}: {
  channel: ChannelType;
  templates: Template[];
  selectedKey: string | null;
  onSelect: (t: Template) => void;
  live: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollToIndex = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(i, templates.length - 1));
    const slide = track.children[clamped] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setIndex(clamped);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const width = track.clientWidth || 1;
      setIndex(Math.max(0, Math.min(Math.round(track.scrollLeft / width), templates.length - 1)));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [templates.length]);

  return (
    <div className={styles.tplSlideshow}>
      <div className={styles.tplSlideshowTrack} ref={trackRef} role="group" aria-label="Templates">
        {templates.map((t) => (
          <div key={templateKey(t)} className={styles.tplSlide}>
            <TemplateGalleryCard
              t={t}
              channel={channel}
              live={live}
              selected={selectedKey === templateKey(t)}
              onSelect={onSelect}
              previewFit="fill"
            />
          </div>
        ))}
      </div>
      {templates.length > 1 ? (
        <div className={styles.tplSlideshowNav}>
          <button
            type="button"
            className={styles.tplSlideshowArrow}
            onClick={() => scrollToIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous template"
          >
            <Icon name="chevron-right" size={22} stroke={2.6} className={styles.iconFlip} />
          </button>
          <div className={styles.tplSlideshowDots}>
            {templates.map((t, i) => (
              <button
                key={templateKey(t)}
                type="button"
                className={`${styles.tplSlideshowDot}${i === index ? ` ${styles.tplSlideshowDotOn}` : ''}`}
                onClick={() => scrollToIndex(i)}
                aria-label={`Go to ${t.name}`}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.tplSlideshowArrow}
            onClick={() => scrollToIndex(index + 1)}
            disabled={index === templates.length - 1}
            aria-label="Next template"
          >
            <Icon name="chevron-right" size={22} stroke={2.6} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TemplateSidebar({
  channel,
  templates,
  selectedKey,
  onSelect,
  live,
}: {
  channel: ChannelType;
  templates: Template[];
  selectedKey: string | null;
  onSelect: (t: Template) => void;
  live: boolean;
}) {
  return (
    <div className={styles.tplSidebar}>
      <div className={styles.tplSidebarHead}>
        <h3 className={styles.tplSidebarTitle}>{channelLabel(channel)} templates</h3>
        <p className={styles.tplSidebarHint}>Pick the template this campaign will send.</p>
      </div>
      {templates.length === 0 ? (
        <p className={styles.tplSidebarEmpty}>
          {channel === 'whatsapp' ? (
            <>
              No approved WhatsApp templates yet. Create one under{' '}
              <a href={routes.app.templates} className="acrd__link">
                Templates
              </a>{' '}
              and submit it for approval before continuing.
            </>
          ) : (
            <>
              No saved {channelLabel(channel)} templates yet. Create one under{' '}
              <a href={routes.app.templates} className="acrd__link">
                Templates
              </a>{' '}
              before continuing.
            </>
          )}
        </p>
      ) : channel === 'email' ? (
        <TemplateSlideshow
          channel={channel}
          templates={templates}
          selectedKey={selectedKey}
          onSelect={onSelect}
          live={live}
        />
      ) : (
        <div
          className={styles.tplSidebarList}
          role="group"
          aria-label={`${channelLabel(channel)} templates`}
        >
          {templates.map((t) => {
            const sel = selectedKey === templateKey(t);
            return (
              <TemplateGalleryCard
                key={templateKey(t)}
                t={t}
                channel={channel}
                selected={sel}
                onSelect={onSelect}
                live={live}
                previewFit="compact"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Channel identity badge for the review step — matches step-1 picker styling. */
function ReviewChannelBadge({ channel }: { channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <span className={styles.reviewChannelBadge} data-channel={channel}>
      <Icon name={m.icon} size={14} stroke={2.2} />
      {m.label}
    </span>
  );
}

/** One list or segment badge for the review step audience row. */
function ReviewAudienceBadge({ audience }: { audience: AudienceChoice }) {
  if (audience.kind === 'list') {
    const c = audience.color || DEFAULT_LIST_COLOR;
    return (
      <span
        className={styles.reviewListBadge}
        style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
      >
        <span className={styles.reviewListDot} style={{ background: c }} />
        {audience.name}
      </span>
    );
  }
  return (
    <span className={styles.reviewSegmentBadge}>
      <Icon name="filter" size={11} stroke={2.2} />
      {audience.name}
    </span>
  );
}

function ReviewAudienceBadges({ audiences }: { audiences: AudienceChoice[] }) {
  if (audiences.length === 0) {
    return <span className={styles.reviewValue}>No audience selected</span>;
  }
  return (
    <div className={styles.reviewAudienceBadges}>
      {audiences.map((a) => (
        <ReviewAudienceBadge key={a.id} audience={a} />
      ))}
    </div>
  );
}

function ReviewRowValue({ row, live }: { row: ReviewRow; live: boolean }) {
  if (row.kind === 'channel') return <ReviewChannelBadge channel={row.channel} />;
  if (row.kind === 'audience') {
    if (!live) return <span className={styles.reviewValue}>Preview audience</span>;
    return <ReviewAudienceBadges audiences={row.audiences} />;
  }
  return <span className={styles.reviewValue}>{row.value}</span>;
}

/* One engagement-tracking option for step 3: mechanism, per-channel note, switch. */
function TrackCard({
  icon,
  title,
  cap,
  on,
  onToggle,
}: {
  icon: 'eye' | 'target';
  title: string;
  cap: TrackingCapability;
  on: boolean;
  onToggle: () => void;
}) {
  const active = cap.enabled && on;
  return (
    <div
      className={[
        styles.trackCard,
        active ? styles.trackCardOn : '',
        cap.enabled ? '' : styles.trackCardDisabled,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.trackCardIcon} aria-hidden="true">
        <Icon name={icon} size={16} stroke={2.1} />
      </span>
      <span className={styles.trackCardBody}>
        <span className={styles.trackCardTitle}>{title}</span>
        <span className={styles.trackCardNote}>{cap.note}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={title}
        disabled={!cap.enabled}
        className={`${styles.switch} ${active ? styles.isOn : ''}`}
        onClick={onToggle}
      >
        <span className={styles.switchKnob} />
      </button>
    </div>
  );
}

/* Selectable radio card used for Schedule (step 4). */
function RadioCard({
  selected,
  onSelect,
  title,
  sub,
  right,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub: string;
  right?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`${styles.radioCard}${selected ? ` ${styles.radioCardOn}` : ''}`}
      onClick={onSelect}
    >
      <span
        className={`${styles.radioDot}${selected ? ` ${styles.radioDotOn}` : ''}`}
        aria-hidden="true"
      >
        <span
          className={`${styles.radioDotInner}${selected ? ` ${styles.radioDotInnerOn}` : ''}`}
        />
      </span>
      <div className={styles.radioBody}>
        <div className={styles.radioTitle}>{title}</div>
        <div className={styles.radioSub}>{sub}</div>
      </div>
      {right}
    </button>
  );
}

/* Read-only phone status bar (signal + battery), shared by every phone mock. */
function PhoneStatusBar({ color }: { color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${wz(8)}px ${wz(18)}px ${wz(3)}px`,
        fontSize: wz(11),
        fontWeight: 600,
        color,
      }}
    >
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor" aria-hidden="true">
          <rect x="0" y="6" width="2" height="4" rx=".5" />
          <rect x="4" y="4" width="2" height="6" rx=".5" />
          <rect x="8" y="2" width="2" height="8" rx=".5" />
          <rect x="12" y="0" width="2" height="10" rx=".5" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" />
          <rect x="2" y="2" width="13" height="7" rx="1" fill="currentColor" />
          <rect x="19" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export default function CampaignWizard({
  mode,
  initialChannel = 'email',
  initialName = '',
  initialSubject = '',
  initialFrom = '',
  initialTrackOpens = false,
  initialTrackClicks = false,
  initialAudienceIds = [],
  initialTemplateId = null,
  initialMessage = '',
  initialSchedule = 'now',
  initialScheduledAt = null,
  audiences,
  templates: templateChoices,
  senders,
  verifiedDomains: verifiedDomainsProp,
  onClose,
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [channel, setChannel] = useState<ChannelType>(initialChannel);
  const [name, setName] = useState<string>(initialName);
  const [subject, setSubject] = useState<string>(initialSubject);
  const [fromEmail, setFromEmail] = useState<string>(() =>
    resolveEmailFrom(initialFrom, verifiedDomainsProp ?? []),
  );
  const [trackOpens, setTrackOpens] = useState<boolean>(initialTrackOpens);
  const [trackClicks, setTrackClicks] = useState<boolean>(initialTrackClicks);
  const [audienceIds, setAudienceIds] = useState<Set<string>>(() =>
    initialAudienceSet(initialAudienceIds),
  );
  const [message, setMessage] = useState<string>(initialMessage);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(() => {
    const match = templateChoices?.find((t) => t.id === initialTemplateId);
    return match ? templateKey({ id: match.id, name: match.name, thumb: '', cat: '' }) : null;
  });
  const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
  const initialParts =
    initialSchedule === 'later'
      ? (partsFromScheduledAt(initialScheduledAt) ?? defaultScheduledParts())
      : defaultScheduledParts();
  const [scheduledDate, setScheduledDate] = useState<ScheduleDate>(initialParts.date);
  const [scheduledTime, setScheduledTime] = useState<ScheduleTime>(initialParts.time);
  const [replyTo, setReplyTo] = useState<string>('');
  const [resolvedSenders, setResolvedSenders] = useState<ChannelSenders | undefined>(senders);

  useEffect(() => {
    setResolvedSenders(senders);
  }, [senders]);

  /* SSR may omit senders; fetch from the BFF when we're in a live workspace. */
  useEffect(() => {
    if (senders || audiences === undefined) return;
    let alive = true;
    void api
      .get<ChannelSenders>('channels/senders')
      .then((data) => {
        if (alive) setResolvedSenders(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [senders, audiences]);

  /* Domains are prefetched by the board — sync From when they arrive or change. */
  useEffect(() => {
    if (verifiedDomainsProp === undefined) return;
    setFromEmail((prev) => resolveEmailFrom(prev || initialFrom, verifiedDomainsProp));
  }, [verifiedDomainsProp, initialFrom]);

  const verifiedDomains = verifiedDomainsProp ?? [];
  const domainsLoaded = verifiedDomainsProp !== undefined;
  const activeSender = channelSender(channel, resolvedSenders);
  const emailSenderOptions = verifiedDomains.map(emailSenderForDomain);

  // Escape closes the modal.
  useEscapeClose(onClose);

  useEffect(() => {
    window.posthog?.capture('campaign_wizard_opened', { channel, mode });
  }, []);

  const isEmail = channel === 'email';

  /* Step 3 — what this channel can measure, and the effective (capability-
     gated) choice. A switch left on from another channel never leaks into a
     channel that can't honor it. */
  const trackingCaps = trackingCapabilities(channel);
  const trackingAvailable = trackingCaps.opens.enabled || trackingCaps.clicks.enabled;
  const effTrackOpens = trackingCaps.opens.enabled && trackOpens;
  const effTrackClicks = trackingCaps.clicks.enabled && trackClicks;
  const trackingStatusLine =
    effTrackOpens && effTrackClicks
      ? 'Opens and clicks will be recorded for this campaign.'
      : effTrackOpens
        ? 'Only opens will be recorded — links stay untouched.'
        : effTrackClicks
          ? 'Only clicks will be recorded — links route through the tracking domain.'
          : 'This campaign sends clean — no pixel, no rewritten links.';
  const channelMeta = CHANNEL[channel];

  /* Live workspace data when the caller supplied it, else the preview fixtures —
     the same fallback the campaigns board uses when it has no session. */
  const live = audiences !== undefined || templateChoices !== undefined;
  const audienceList = useMemo(
    () => (live ? prepareAudiencesForChannel(audiences ?? [], channel) : []),
    [audiences, channel, live],
  );
  const listAudiences = audienceList.filter((a) => a.kind === 'list');
  const segmentAudiences = audienceList.filter((a) => a.kind === 'segment');
  const selectedAudiences = audienceList.filter((a) => audienceIds.has(a.id));
  const audienceLabel = live ? audiencesLabelOf(selectedAudiences) : 'Preview audience';

  /* Drop selections that are hidden for this channel (e.g. zero phone reach). */
  useEffect(() => {
    if (!live) return;
    const visible = new Set(audienceList.map((a) => a.id));
    setAudienceIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [audienceList, live]);

  /* When editing a template-backed non-email campaign, hydrate the message body. */
  useEffect(() => {
    if (!live || channel === 'email' || !initialTemplateId || initialMessage.trim()) return;
    let alive = true;
    void (async () => {
      try {
        const full = await api.get<ApiTemplate>(`templates/${initialTemplateId}`);
        if (alive && full.text?.trim()) setMessage(full.text);
      } catch {
        /* preview fixtures / missing template — leave message as-is */
      }
    })();
    return () => {
      alive = false;
    };
  }, [live, channel, initialTemplateId, initialMessage]);

  const toggleAudience = (id: string) => {
    setAudienceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const templates: Template[] = live
    ? (templateChoices ?? [])
        .filter((t) => t.channel === channel)
        // WhatsApp campaigns can only send Meta-approved templates.
        .filter((t) => t.channel !== 'whatsapp' || t.approvalStatus === 'approved')
        .map(templateCard)
    : TEMPLATES[channel];
  const selTpl = templates.find((t) => templateKey(t) === selectedTemplateKey) ?? null;
  /** Email past the picker, with something to show: the preview takes the whole column. */
  const emailPreviewFlush = isEmail && step > 1 && selTpl !== null;

  // Phone-mock preview of the chosen template's body (text channels).
  const callDuration = formatDuration(voiceSeconds(message));
  const msgPreview = message || 'Pick a template to preview the message here…';

  // Phone mock chrome.
  const statusBg = channel === 'voice' ? '#26221d' : channel === 'whatsapp' ? '#075e54' : '#f6f6f7';
  const statusColor = channel === 'sms' ? '#0b0b0f' : '#fff';

  const stepDefs = buildStepDefs();

  const title = mode === 'edit' ? 'Edit campaign' : 'New campaign';
  const nextLabel =
    step === 5
      ? mode === 'edit'
        ? 'Save changes'
        : schedule === 'now'
          ? 'Send campaign'
          : 'Schedule campaign'
      : step === 4
        ? 'Continue to review →'
        : 'Continue →';

  /* The caller reports the outcome of an actual send, so this only covers the
     cases where nothing is dispatched. */
  const doneMsg =
    mode === 'edit'
      ? `Campaign "${name || 'Untitled'}" updated`
      : schedule === 'now'
        ? 'Campaign queued for delivery'
        : 'Campaign scheduled';

  /* Email: the template supplies html; subject is campaign metadata (step 1).
     Text channels persist the chosen template's resolved body. Both ride the
     campaign's `content`. Tracking flags are stored only where the channel can
     honor them, as explicit booleans — `false` is the meaningful opt-out the
     provider acts on (voice stores none). */
  const trackingContent: Record<string, boolean> = {
    ...(trackingCaps.opens.enabled ? { trackOpens } : {}),
    ...(trackingCaps.clicks.enabled ? { trackClicks } : {}),
  };
  const draftContent = isEmail
    ? {
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(fromEmail.trim() ? { from: fromEmail.trim() } : {}),
        ...trackingContent,
      }
    : {
        ...(message.trim() ? { text: message } : {}),
        ...trackingContent,
      };

  const selectSchedule = (next: Schedule) => {
    setSchedule(next);
    if (next === 'later') {
      const parts = defaultScheduledParts();
      setScheduledDate(parts.date);
      setScheduledTime(parts.time);
    }
  };

  /* When the selected date leaves the current time in the past, bump to the next valid slot. */
  useEffect(() => {
    if (schedule !== 'later') return;
    if (isScheduledInFuture(scheduledDate, scheduledTime)) return;
    const next = nextValidScheduleTime(scheduledDate);
    if (next && next !== scheduledTime) setScheduledTime(next);
  }, [schedule, scheduledDate, scheduledTime]);

  const scheduledAt =
    schedule === 'later' ? combineScheduledParts(scheduledDate, scheduledTime) : null;

  const stepBlockedReason = getStepBlockedReason({
    step,
    name,
    subject,
    fromEmail,
    verifiedDomains,
    domainsReady: !live || domainsLoaded,
    channel,
    audienceIds,
    audienceList,
    selTpl,
    live,
    mode,
    schedule,
    scheduledDate,
    scheduledTime,
  });
  const primaryDisabled = isWizardStepBlocked({
    step,
    name,
    subject,
    fromEmail,
    verifiedDomains,
    domainsReady: !live || domainsLoaded,
    channel,
    audienceIds,
    audienceList,
    selTpl,
    live,
    mode,
    schedule,
    scheduledDate,
    scheduledTime,
  });

  const handlePrimary = () => {
    if (primaryDisabled) return;
    if (step < 5) {
      const nextStep = (step + 1) as Step;
      window.posthog?.capture('campaign_wizard_step_advanced', {
        from_step: step,
        to_step: nextStep,
        channel,
        mode,
      });
      setStep(nextStep);
      return;
    }
    const { listIds, segmentIds } = partitionAudienceIds(audienceList, audienceIds);
    const audienceIdsArr = [...listIds, ...segmentIds];
    onDone(doneMsg, {
      name,
      channel,
      listIds,
      segmentIds,
      listId: listIds[0],
      segmentId: segmentIds[0],
      templateId: selTpl?.id,
      content: draftContent
        ? { ...draftContent, audienceIds: audienceIdsArr }
        : { audienceIds: audienceIdsArr },
      audienceLabel,
      schedule,
      scheduledAt,
    });
  };

  const handleBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const selectTemplate = (t: Template) => {
    setSelectedTemplateKey(templateKey(t));
    if (channel === 'email') return;

    if (live && t.id) {
      void (async () => {
        try {
          const full = await api.get<ApiTemplate>(`templates/${t.id}`);
          setMessage(full.text?.trim() ?? '');
        } catch {
          setMessage('');
        }
      })();
      return;
    }

    setMessage(fixtureTemplateMessage(t));
  };

  const changeChannel = (next: ChannelType) => {
    if (next === channel) return;
    setChannel(next);
    setSelectedTemplateKey(null);
    setMessage('');
  };

  const reviewRows = buildReviewRows(
    name,
    subject,
    channel,
    selectedAudiences,
    selTpl?.name ?? null,
    schedule,
    scheduledDate,
    scheduledTime,
    resolvedSenders,
    { trackOpens, trackClicks },
    isEmail ? fromEmail : undefined,
  );

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 6,
  };
  const h3Style: CSSProperties = {
    margin: '0 0 5px',
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: '-0.3px',
  };
  const pStyle: CSSProperties = { margin: '0 0 22px', fontSize: 13, color: 'var(--text4)' };

  return (
    <Modal open onClose={onClose} title={title} panelClassName={styles.dialog}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${wz(12)}px ${wz(25)}px`,
          borderBottom: '1px solid var(--divider)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: wz(15) }}>{title}</div>
        <button
          type="button"
          onClick={onClose}
          className="sbtn"
          aria-label="Close"
          style={{
            width: wz(28),
            height: wz(28),
            border: 'none',
            background: 'var(--surface2)',
            borderRadius: wz(8),
            cursor: 'pointer',
            color: 'var(--text4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="x" size={wz(15)} />
        </button>
      </div>

      {/* step index — read-only; use footer Back/Next to navigate */}
        <nav className={styles.stepNav} aria-label="Campaign steps">
          <ol className={styles.stepList}>
            {stepDefs.map(([sTitle, sSub], i) => {
              const n = (i + 1) as Step;
              const done = n < step;
              const active = n === step;
              const itemClass = [
                styles.stepItem,
                active ? styles.stepItemActive : '',
                done ? styles.stepItemDone : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={sTitle} className={itemClass} aria-current={active ? 'step' : undefined}>
                  <span className={styles.stepBadge} aria-hidden="true">
                    {done ? '✓' : String(n)}
                  </span>
                  <span className={styles.stepText}>
                    <span className={styles.stepTitle}>{sTitle}</span>
                    <span className={styles.stepSub}>{sSub}</span>
                  </span>
                  {i < stepDefs.length - 1 && (
                    <span className={styles.stepConnector} aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* body — form + preview */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `1fr ${wz(300)}px`,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* center step form */}
          <div
            style={{
              padding: '28px 30px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {step === 1 && (
              <>
                <h3 style={h3Style}>Let&rsquo;s start with the basics</h3>
                <p style={{ ...pStyle, margin: '0 0 24px' }}>
                  Choose a channel, name your campaign and set the sender. Pick a template in the
                  sidebar.
                </p>
                <label style={labelStyle}>Channel</label>
                <div className={styles.channelGrid} role="radiogroup" aria-label="Channel">
                  {CHANNEL_ORDER.map((c) => {
                    const on = channel === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-channel={c}
                        className={[styles.channelBtn, on ? styles.channelBtnOn : '']
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => changeChannel(c)}
                      >
                        <Icon name={CHANNEL[c].icon} size={15} stroke={2.2} />
                        {channelLabel(c)}
                      </button>
                    );
                  })}
                </div>
                <label style={labelStyle}>Campaign name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Summer Sale 2026"
                  style={{
                    width: '100%',
                    border: '1px solid var(--border2)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13.5,
                    marginBottom: 18,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
                {isEmail && (
                  <>
                    <label style={labelStyle}>Email subject</label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Your summer sale starts now ☀️"
                      style={{
                        width: '100%',
                        border: '1px solid var(--border2)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13.5,
                        marginBottom: 18,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                  </>
                )}
                <label style={labelStyle}>{activeSender.label}</label>
                {isEmail && live ? (
                  <>
                    <select
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      disabled={!domainsLoaded || emailSenderOptions.length === 0}
                      aria-label="Sender"
                      style={{
                        width: '100%',
                        border: '1px solid var(--border2)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13.5,
                        marginBottom: emailSenderOptions.length === 0 && domainsLoaded ? 8 : 18,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23999' d='M1.4 0L6 4.6 10.6 0 12 1.4 6 7.4 0 1.4z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: 32,
                      }}
                    >
                      {emailSenderOptions.length === 0 ? (
                        <option value="">No verified domains</option>
                      ) : (
                        emailSenderOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))
                      )}
                    </select>
                    {domainsLoaded && emailSenderOptions.length === 0 && (
                      <p
                        style={{
                          margin: '0 0 18px',
                          fontSize: 12.5,
                          color: 'var(--muted)',
                          lineHeight: 1.4,
                        }}
                      >
                        Verify a{' '}
                        <a
                          href={routes.app.settingsSection('domains')}
                          className="acrd__link"
                          style={{ fontSize: 'inherit' }}
                        >
                          sending domain
                        </a>{' '}
                        in Settings before you can send email.
                      </p>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      border: '1px solid var(--border2)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 13.5,
                      marginBottom: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: 'var(--text2)',
                    }}
                  >
                    {activeSender.value}
                    <span style={{ color: 'var(--muted)' }}>▾</span>
                  </div>
                )}
                {isEmail && (
                  <>
                    <label style={labelStyle}>
                      Reply-to{' '}
                      <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="hello@maildrill.net"
                      style={{
                        width: '100%',
                        border: '1px solid var(--border2)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13.5,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h3 style={h3Style}>Choose your audience</h3>
                <p style={pStyle}>Pick one or more lists or segments to send to.</p>
                {audienceList.length === 0 ? (
                  <p
                    style={{
                      ...pStyle,
                      padding: '14px 16px',
                      border: '1px dashed var(--border2)',
                      borderRadius: 12,
                      margin: 0,
                    }}
                  >
                    No lists or segments yet. Create one under Audience first — a campaign with no
                    list or segment reaches nobody.
                  </p>
                ) : (
                  <div className={styles.audList}>
                    <AudienceSection
                      heading="Lists"
                      items={listAudiences}
                      emptyMessage={`No lists for ${channelLabel(channel)} yet. Enable the channel on a list under Audience → Lists.`}
                      selectedIds={audienceIds}
                      onToggle={toggleAudience}
                    />
                    <AudienceSection
                      heading="Segments"
                      items={segmentAudiences}
                      emptyMessage={`No segments for ${channelLabel(channel)} yet. Enable the channel on a segment under Audience → Subscribers.`}
                      selectedIds={audienceIds}
                      onToggle={toggleAudience}
                    />
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h3 style={h3Style}>Measure engagement</h3>
                <p style={{ ...pStyle, margin: '0 0 18px' }}>
                  Choose what this {channelLabel(channel)} campaign records after it sends.
                </p>
                <div className={styles.trackList} role="group" aria-label="Engagement tracking">
                  <TrackCard
                    icon="eye"
                    title="Track opens"
                    cap={trackingCaps.opens}
                    on={trackOpens}
                    onToggle={() => setTrackOpens((v) => !v)}
                  />
                  <TrackCard
                    icon="target"
                    title="Track clicks"
                    cap={trackingCaps.clicks}
                    on={trackClicks}
                    onToggle={() => setTrackClicks((v) => !v)}
                  />
                </div>
                {trackingAvailable ? (
                  <>
                    <div className={styles.trackCallout}>
                      <span className={styles.trackCalloutIcon} aria-hidden="true">
                        <Icon name="shield" size={16} stroke={2.1} />
                      </span>
                      <span>
                        <strong className={styles.trackCalloutTitle}>
                          Tracking can affect deliverability.
                        </strong>{' '}
                        {isEmail
                          ? 'The open pixel and rewritten links point at a tracking domain, and mailbox providers weigh those signals — on a new sending domain they can tip a campaign into spam. Keep tracking off while a domain warms up.'
                          : 'Rewritten links route through a tracking domain with no history of its own, and carrier spam filters weigh link reputation. Keep tracking off until the domain has warmed up.'}
                      </span>
                    </div>
                    <p
                      className={`${styles.trackStatus} ${
                        effTrackOpens || effTrackClicks
                          ? styles.trackStatusOn
                          : styles.trackStatusClean
                      }`}
                      role="status"
                    >
                      <span className={styles.trackStatusIcon} aria-hidden="true">
                        <Icon
                          name={effTrackOpens || effTrackClicks ? 'analytics' : 'check'}
                          size={15}
                          stroke={2.4}
                        />
                      </span>
                      {trackingStatusLine}
                    </p>
                  </>
                ) : (
                  <div className={styles.trackEmpty}>
                    Voice campaigns have nothing to instrument — engagement comes from call outcomes
                    in the campaign report. Continue to scheduling.
                  </div>
                )}
              </>
            )}

            {step === 4 && (
              <div className={styles.scheduleStep}>
                <h3 style={h3Style}>When should this send?</h3>
                <p className={styles.scheduleIntro} style={pStyle}>
                  Send immediately or schedule for later.
                </p>
                <div role="radiogroup" aria-label="Delivery schedule">
                  <RadioCard
                    selected={schedule === 'now'}
                    onSelect={() => selectSchedule('now')}
                    title="Send now"
                    sub="Delivery starts immediately"
                  />
                  <RadioCard
                    selected={schedule === 'later'}
                    onSelect={() => selectSchedule('later')}
                    title="Schedule for later"
                    sub="Pick a date and time"
                  />
                </div>
                {schedule === 'later' && (
                  <div className={styles.scheduleGrid}>
                    <DatePicker
                      id="campaign-schedule-date"
                      label="Date"
                      value={scheduledDate}
                      onChange={setScheduledDate}
                      inline
                    />
                    <TimePicker
                      id="campaign-schedule-time"
                      label="Time"
                      value={scheduledTime}
                      onChange={setScheduledTime}
                      referenceDate={scheduledDate}
                      inline
                    />
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <>
                <h3 style={h3Style}>Review your campaign</h3>
                <p style={pStyle}>Double-check everything before you send.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {reviewRows.map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '13px 0',
                        borderBottom: '1px solid var(--surface2)',
                        gap: 16,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{row.label}</span>
                      <ReviewRowValue row={row} live={live} />
                    </div>
                  ))}
                </div>
                {!stepBlockedReason && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      marginTop: 18,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: '#e7f6ec',
                      color: '#15803d',
                      fontSize: 12.5,
                      fontWeight: 500,
                    }}
                  >
                    <Icon name="check" size={16} stroke={2.2} />
                    All checks passed. Ready to schedule.
                  </div>
                )}
              </>
            )}
          </div>

          {/* right: template sidebar on step 1, live preview after */}
          <div
            className={styles.previewCol}
            style={{
              /* Past the picker, an email preview is the column: full bleed,
                 so the message is judged at the size it will be read at. The
                 phone-mock channels keep the inset, which is what makes the
                 handset read as a device sitting on the tinted surface. */
              padding: emailPreviewFlush ? 0 : wz(22),
              background: `color-mix(in srgb, ${channelMeta.tint} 38%, var(--surface))`,
              borderLeft: `1px solid color-mix(in srgb, ${channelMeta.color} 28%, var(--divider))`,
            }}
          >
            {step === 1 ? (
              <TemplateSidebar
                channel={channel}
                templates={templates}
                selectedKey={selectedTemplateKey}
                onSelect={selectTemplate}
                live={live}
              />
            ) : (
              <div className={styles.previewFit} data-preview-fit>
                {isEmail ? (
                  selTpl ? (
                    <div className={styles.previewEmailLive}>
                      {selTpl.id && live ? (
                        <TemplatePreview
                          id={selTpl.id}
                          channel="email"
                          live={live}
                          fallback={<FauxEmail t={toGalleryPreviewData(selTpl)} variant="drawer" />}
                        />
                      ) : (
                        <FauxEmail t={toGalleryPreviewData(selTpl)} variant="drawer" />
                      )}
                    </div>
                  ) : (
                    <div className={styles.previewEmpty}>
                      <Icon name="mail" size={wz(28)} stroke={1.6} />
                      <span>Select a template to preview</span>
                    </div>
                  )
                ) : (
                  /* Phone mock preview for SMS / WhatsApp / Voice. */
                  <div
                    className={styles.previewPhoneShell}
                    style={{
                      width: '100%',
                      maxWidth: PREVIEW_PHONE_W,
                      background: '#0b0b0f',
                      borderRadius: wz(34),
                      padding: wz(10),
                      boxShadow: '0 10px 30px rgba(28,25,23,.22)',
                    }}
                  >
                    <div
                      className={styles.previewPhoneScreen}
                      style={{
                        background: statusBg,
                        borderRadius: wz(26),
                      }}
                    >
                      <div
                        style={{
                          width: wz(72),
                          height: wz(18),
                          background: '#000',
                          borderRadius: `0 0 ${wz(10)}px ${wz(10)}px`,
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 2,
                        }}
                      />
                      <PhoneStatusBar color={statusColor} />

                      {channel === 'voice' && (
                        <div
                          className={styles.previewChannelBody}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: `${wz(14)}px ${wz(16)}px ${wz(18)}px`,
                            background: 'linear-gradient(180deg,#26221d,#0b0b0f)',
                            color: '#fff',
                          }}
                        >
                          <div style={{ textAlign: 'center', marginTop: wz(12) }}>
                            <div
                              style={{
                                fontSize: wz(10.5),
                                color: 'rgba(255,255,255,.5)',
                                fontWeight: 600,
                                letterSpacing: '0.4px',
                                marginBottom: wz(9),
                              }}
                            >
                              INCOMING CALL
                            </div>
                            <div
                              style={{
                                width: wz(70),
                                height: wz(70),
                                borderRadius: '50%',
                                background: 'var(--ch-voice)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: wz(24),
                                fontWeight: 700,
                                margin: '0 auto',
                              }}
                            >
                              M
                            </div>
                            <div style={{ fontSize: wz(16), fontWeight: 600, marginTop: wz(13) }}>
                              Maildrill
                            </div>
                            <div
                              className="tnum"
                              style={{
                                fontSize: wz(11.5),
                                color: 'rgba(255,255,255,.55)',
                                marginTop: wz(4),
                              }}
                            >
                              {activeSender.value}
                            </div>
                            <div
                              className="tnum"
                              style={{
                                fontSize: wz(10),
                                color: 'rgba(255,255,255,.4)',
                                marginTop: wz(2),
                              }}
                            >
                              {callDuration} · calling…
                            </div>
                          </div>
                          <div style={{ width: '100%' }}>
                            <div
                              className={styles.previewBubble}
                              style={{
                                maxWidth: wz(180),
                                margin: `0 auto ${wz(12)}px`,
                                background: 'rgba(255,255,255,.08)',
                                borderRadius: wz(12),
                                padding: `${wz(8)}px ${wz(10)}px`,
                                fontSize: wz(11),
                                lineHeight: 1.45,
                                color: 'rgba(255,255,255,.85)',
                              }}
                            >
                              {msgPreview}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: wz(18),
                                flexShrink: 0,
                              }}
                            >
                              <div
                                className={styles.voiceCallAction}
                                style={{
                                  width: wz(42),
                                  height: wz(42),
                                  minWidth: wz(42),
                                  minHeight: wz(42),
                                  background: 'rgba(255,255,255,.12)',
                                  color: '#fff',
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0" />
                                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                                  <line x1="3" y1="3" x2="21" y2="21" />
                                </svg>
                              </div>
                              <div
                                className={styles.voiceCallAction}
                                style={{
                                  width: wz(50),
                                  height: wz(50),
                                  minWidth: wz(50),
                                  minHeight: wz(50),
                                  background: '#e11d48',
                                  transform: 'rotate(135deg)',
                                }}
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="#fff"
                                  aria-hidden="true"
                                >
                                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1z" />
                                </svg>
                              </div>
                              <div
                                className={styles.voiceCallAction}
                                style={{
                                  width: wz(42),
                                  height: wz(42),
                                  minWidth: wz(42),
                                  minHeight: wz(42),
                                  background: 'rgba(255,255,255,.12)',
                                  color: '#fff',
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <circle cx="6" cy="6" r="1.6" />
                                  <circle cx="12" cy="6" r="1.6" />
                                  <circle cx="18" cy="6" r="1.6" />
                                  <circle cx="6" cy="12" r="1.6" />
                                  <circle cx="12" cy="12" r="1.6" />
                                  <circle cx="18" cy="12" r="1.6" />
                                  <circle cx="6" cy="18" r="1.6" />
                                  <circle cx="12" cy="18" r="1.6" />
                                  <circle cx="18" cy="18" r="1.6" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {channel === 'sms' && (
                        <div
                          className={styles.previewChannelBody}
                          style={{
                            background: '#e9eaec',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <div
                            style={{
                              padding: `${wz(10)}px ${wz(14)}px ${wz(9)}px`,
                              textAlign: 'center',
                              background: '#f6f6f7',
                              borderBottom: '1px solid rgba(0,0,0,.06)',
                            }}
                          >
                            <div
                              style={{
                                width: wz(32),
                                height: wz(32),
                                borderRadius: '50%',
                                background: '#c7c9cc',
                                margin: `0 auto ${wz(4)}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: wz(12),
                                fontWeight: 700,
                                color: '#fff',
                              }}
                            >
                              M
                            </div>
                            <div style={{ fontSize: wz(11), fontWeight: 600, color: '#0b0b0f' }}>
                              Maildrill
                            </div>
                          </div>
                          <div
                            style={{
                              flex: 1,
                              minHeight: 0,
                              overflow: 'hidden',
                              padding: `${wz(14)}px ${wz(12)}px`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: wz(3),
                              justifyContent: 'flex-end',
                            }}
                          >
                            <div
                              className={styles.previewBubble}
                              style={{
                                alignSelf: 'flex-start',
                                maxWidth: '82%',
                                background: '#fff',
                                borderRadius: `${wz(16)}px ${wz(16)}px ${wz(16)}px ${wz(4)}px`,
                                padding: `${wz(9)}px ${wz(13)}px`,
                                fontSize: wz(11.5),
                                lineHeight: 1.45,
                                color: '#0b0b0f',
                                boxShadow: '0 1px 1px rgba(0,0,0,.05)',
                              }}
                            >
                              {msgPreview}
                            </div>
                            <div
                              style={{
                                alignSelf: 'flex-start',
                                fontSize: wz(9),
                                color: '#9a9a9e',
                                margin: `${wz(2)}px ${wz(6)}px 0`,
                                flex: 'none',
                              }}
                            >
                              Delivered
                            </div>
                          </div>
                        </div>
                      )}

                      {channel === 'whatsapp' && (
                        <div
                          className={styles.previewChannelBody}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#e5ddd0',
                            backgroundImage:
                              'radial-gradient(rgba(0,0,0,.04) 1px, transparent 1px)',
                            backgroundSize: `${wz(13)}px ${wz(13)}px`,
                          }}
                        >
                          <div
                            style={{
                              background: '#075e54',
                              color: '#fff',
                              padding: `${wz(10)}px ${wz(13)}px`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: wz(9),
                            }}
                          >
                            <svg
                              width={wz(15)}
                              height={wz(15)}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#fff"
                              strokeWidth="2.4"
                              aria-hidden="true"
                            >
                              <path d="M15 6l-6 6 6 6" />
                            </svg>
                            <div
                              style={{
                                width: wz(25),
                                height: wz(25),
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,.22)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: wz(11),
                                fontWeight: 700,
                              }}
                            >
                              M
                            </div>
                            <div style={{ lineHeight: 1.15 }}>
                              <div style={{ fontSize: wz(11.5), fontWeight: 700 }}>Maildrill</div>
                              <div className="tnum" style={{ fontSize: wz(9), opacity: 0.8 }}>
                                {activeSender.value}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              flex: 1,
                              minHeight: 0,
                              overflow: 'hidden',
                              padding: `${wz(14)}px ${wz(11)}px`,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <div
                              className={styles.previewBubble}
                              style={{
                                alignSelf: 'flex-start',
                                maxWidth: '82%',
                                background: '#fff',
                                borderRadius: `${wz(2)}px ${wz(12)}px ${wz(12)}px ${wz(12)}px`,
                                padding: `${wz(9)}px ${wz(12)}px ${wz(15)}px`,
                                fontSize: wz(11.5),
                                lineHeight: 1.45,
                                color: '#111',
                                boxShadow: '0 1px 1px rgba(0,0,0,.1)',
                                position: 'relative',
                              }}
                            >
                              {msgPreview}
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: wz(5),
                                  right: wz(10),
                                  fontSize: wz(9),
                                  color: '#8a8a8e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: wz(2),
                                }}
                              >
                                9:41
                                <svg
                                  width={wz(13)}
                                  height={wz(9)}
                                  viewBox="0 0 16 11"
                                  fill="none"
                                  stroke="#53bdeb"
                                  strokeWidth="1.6"
                                  aria-hidden="true"
                                >
                                  <path d="M1 6l3.5 3.5L11 2" />
                                  <path d="M6 6l3.5 3.5L16 2" />
                                </svg>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${wz(12)}px ${wz(25)}px`,
            borderTop: '1px solid var(--divider)',
            background: 'var(--surface)',
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            className="sbtn"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              padding: `${wz(8)}px ${wz(18)}px`,
              borderRadius: wz(9),
              fontWeight: 600,
              fontSize: wz(12.5),
              color: 'var(--text2)',
              cursor: 'pointer',
              visibility: step === 1 ? 'hidden' : 'visible',
            }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            className="pbtn"
            disabled={primaryDisabled}
            aria-disabled={primaryDisabled}
            style={{
              background: INDIGO,
              color: '#fff',
              border: 'none',
              padding: `${wz(8)}px ${wz(20)}px`,
              borderRadius: wz(9),
              fontWeight: 600,
              fontSize: wz(12.5),
              cursor: primaryDisabled ? 'not-allowed' : 'pointer',
              opacity: primaryDisabled ? 0.5 : 1,
              boxShadow: '0 1px 2px rgba(79,70,229,.35), inset 0 1px 0 rgba(255,255,255,.16)',
            }}
          >
            {nextLabel}
          </button>
        </div>
    </Modal>
  );
}
