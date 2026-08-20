import type { ChannelType, TemplateApprovalStatus } from '@/types/app';
import type { GalleryTemplate, TplCategory } from '@/lib/app/templates-data';
import { channelReportConfig } from '@/lib/app/campaign-report';

/** Channel name as it reads mid-sentence in a tooltip. */
const CHANNEL_NAME: Record<ChannelType, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  voice: 'Voice',
};

const APPROVAL_STATUSES: TemplateApprovalStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'paused',
  'disabled',
];

/** Coerce the service's approval_status into our union, or null (non-WhatsApp). */
export function toApprovalStatus(s?: string | null): TemplateApprovalStatus | null {
  return APPROVAL_STATUSES.includes(s as TemplateApprovalStatus)
    ? (s as TemplateApprovalStatus)
    : null;
}

/** Shape of a template as returned by workers /v1/templates. */
export interface ApiTemplate {
  id: string;
  name: string;
  channel?: string | null;
  subject?: string | null;
  preheader?: string | null;
  html?: string | null;
  text?: string | null;
  builderDoc?: Record<string, unknown> | null;
  category?: string | null;
  favorite?: boolean | null;
  /** WhatsApp template approval fields (null/absent on other channels). */
  approvalStatus?: string | null;
  rejectionReason?: string | null;
  language?: string | null;
  components?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Engagement across campaigns that sent this template (absent pre-rollout). */
  trackedDelivered?: number | null;
  sent?: number | null;
  delivered?: number | null;
  failed?: number | null;
  opened?: number | null;
  clicked?: number | null;
}

const CATEGORIES: TplCategory[] = ['Newsletter', 'Promotional', 'Transactional'];

/** Deterministic thumbnail palette [band background, foreground, CTA accent]. */
export const TEMPLATE_THUMBS: Array<[string, string, string]> = [
  ['linear-gradient(135deg,#6366f1,#4f46e5)', '#fff', '#4f46e5'],
  ['linear-gradient(135deg,#f59e0b,#d97706)', '#fff', '#d97706'],
  ['linear-gradient(135deg,#10b981,#059669)', '#fff', '#059669'],
  ['linear-gradient(135deg,#ec4899,#db2777)', '#fff', '#db2777'],
  ['linear-gradient(135deg,#0ea5e9,#0284c7)', '#fff', '#0284c7'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function hashTemplateId(id: string): number {
  return hash(id);
}

function toChannel(c?: string | null): ChannelType {
  return c === 'sms' || c === 'whatsapp' || c === 'voice' ? c : 'email';
}

/**
 * Stored category → one of the three the gallery filter offers.
 *
 * KNOWN DEFECT (audit #32): the fallback silently REWRITES rather than passing
 * through. `CATEGORIES` holds only the email editor's three, so a template
 * stored as `promo`, `billing`, `Marketing` or `Customer Service` — values the
 * SMS and voice editors themselves write — all render as "Newsletter". Four
 * templates on the seeded tenant are mislabelled this way, and no filter option
 * exists that would reveal them.
 */
function toCategory(c?: string | null): TplCategory {
  if (c === 'Announcement') return 'Newsletter';
  return CATEGORIES.includes(c as TplCategory) ? (c as TplCategory) : 'Newsletter';
}

function fmtAgo(iso?: string | null): { updated: string; updatedMin: number } {
  if (!iso) return { updated: '—', updatedMin: Number.MAX_SAFE_INTEGER };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { updated: '—', updatedMin: Number.MAX_SAFE_INTEGER };
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  const updated =
    min < 1
      ? 'just now'
      : min < 60
        ? `${min}m ago`
        : min < 1440
          ? `${Math.round(min / 60)}h ago`
          : `${Math.round(min / 1440)}d ago`;
  return { updated, updatedMin: min };
}

/** "Jul 12, 2026" from an ISO timestamp; em-dash when absent/invalid. */
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Whole-percent rate against TRACKED deliveries, or `null` when nothing was
 * measured.
 *
 * `null` is the whole point: it used to return the NUMBER 0 for a zero
 * denominator, and the gallery rendered that as a confident "0% opens · 0%
 * clicks". 148 of the seeded tenant's 229 templates carried that literal zero,
 * which reads as "nobody engaged" where the truth is either "never sent" or
 * "this channel measures nothing". `null` is what makes every surface able to
 * say "—" instead — see `templateEngagement` below, which is the only thing
 * that should be reading these numbers.
 */
function rate(numerator?: number | null, tracked?: number | null): number | null {
  if (!tracked || tracked <= 0) return null;
  return Math.round(((numerator ?? 0) / tracked) * 100);
}

/** True when the template has body content worth submitting or previewing. */
export function templateHasContent(t: Pick<ApiTemplate, 'html' | 'text' | 'components'>): boolean {
  if (typeof t.html === 'string' && t.html.trim()) return true;
  if (typeof t.text === 'string' && t.text.trim()) return true;
  const c = t.components;
  if (!c || typeof c !== 'object') return false;
  const body = c.body;
  if (
    body &&
    typeof body === 'object' &&
    typeof (body as { text?: unknown }).text === 'string' &&
    (body as { text: string }).text.trim()
  ) {
    return true;
  }
  const header = c.header;
  if (header && typeof header === 'object') {
    const h = header as { text?: unknown; format?: unknown };
    if (typeof h.text === 'string' && h.text.trim()) return true;
    const format = String(h.format ?? '').toUpperCase();
    if (format && format !== 'TEXT') return true;
  }
  const footer = c.footer;
  if (
    footer &&
    typeof footer === 'object' &&
    typeof (footer as { text?: unknown }).text === 'string' &&
    (footer as { text: string }).text.trim()
  ) {
    return true;
  }
  return Array.isArray(c.buttons) && c.buttons.length > 0;
}

/**
 * What a template can honestly report, in one place, for every surface.
 *
 * The gallery card, the list's Opens/Clicks columns and the drawer's KPI tiles
 * all render this. They used to decide independently, and disagreed: the drawer
 * asked `channelReportConfig(channel)` whether the channel measures opens at
 * all and printed "—" when it does not, while the card and the columns printed
 * whatever `avgOpen` held. So an SMS template read "0% opens · 0% clicks" on
 * its card and "Avg. delivered 90% / Failed 588" in its own drawer.
 *
 * Two questions, in order:
 *
 *   `measures` — does this template's channel report reads and clicks at all?
 *     Read from `channelReportConfig`, the same config the campaign report and
 *     the subscriber drawer use, so the three screens cannot disagree about
 *     what a channel measures. Email reports opens + clicks, WhatsApp seen +
 *     clicks, SMS and voice neither.
 *   `measured` — did anything actually happen to measure? `trackedDelivered`
 *     is deliveries on the template's OWN channel (workers templates.ts), so it
 *     is 0 for a template never sent and 0 for one whose campaigns went out on
 *     some other channel. Both mean "not measured", and both render "—".
 *
 * A channel that measures nothing gets its send outcomes instead — delivery and
 * failures, which every channel produces — rather than a pair of dashes.
 */
export type TemplateMetric = {
  key: 'open' | 'click' | 'delivery' | 'failed';
  /** Card/tile label, e.g. "opens", "seen", "clicks", "delivered", "failed". */
  label: string;
  /** Rendered value, or "—" when nothing was measured. */
  value: string;
  /** False when `value` is "—", so a caller can style or title it. */
  measured: boolean;
  /** One line saying why, for a `title`/tooltip. Always populated. */
  hint: string;
};

export function templateEngagement(t: GalleryTemplate): TemplateMetric[] {
  const cfg = channelReportConfig(t.channel);
  const chName = CHANNEL_NAME[t.channel] ?? t.channel;
  const hasOpen = cfg.rateCards.some((r) => r === 'open' || r === 'seen');
  const hasClick = cfg.rateCards.includes('click');
  const tracked = t.trackedDelivered ?? 0;
  const sent = t.sent ?? 0;

  if (hasOpen || hasClick) {
    const openLabel = cfg.openLabel === 'Seen' ? 'seen' : 'opens';
    const hint =
      tracked > 0
        ? `${tracked.toLocaleString('en-US')} ${chName} deliveries measured`
        : sent > 0
          ? `Not measured — this template's campaigns did not go out on ${chName}`
          : 'Not measured — this template has never been sent';
    const out: TemplateMetric[] = [
      {
        key: 'open',
        label: openLabel,
        value: t.avgOpen == null ? '—' : `${t.avgOpen}%`,
        measured: t.avgOpen != null,
        hint,
      },
    ];
    if (hasClick) {
      out.push({
        key: 'click',
        label: 'clicks',
        value: t.avgClick == null ? '—' : `${t.avgClick}%`,
        measured: t.avgClick != null,
        hint,
      });
    }
    return out;
  }

  // Delivery-only channels: report the send outcomes they do produce, rather
  // than an open rate no provider on this channel has ever reported.
  const delivered = t.delivered ?? 0;
  const failed = t.failed ?? 0;
  const hint =
    sent > 0
      ? `${chName} reports no opens or clicks — ${sent.toLocaleString('en-US')} sent`
      : `${chName} reports no opens or clicks, and this template has never been sent`;
  return [
    {
      key: 'delivery',
      label: 'delivered',
      value: sent > 0 ? `${Math.round((delivered / sent) * 100)}%` : '—',
      measured: sent > 0,
      hint,
    },
    {
      key: 'failed',
      label: 'failed',
      value: sent > 0 ? failed.toLocaleString('en-US') : '—',
      measured: sent > 0,
      hint,
    },
  ];
}

/** The open metric alone, for the list view's fixed "Opens" column. */
export function templateOpenMetric(t: GalleryTemplate): TemplateMetric {
  const m = templateEngagement(t);
  return (
    m.find((x) => x.key === 'open') ?? {
      key: 'open',
      label: 'opens',
      value: '—',
      measured: false,
      hint: m[0]?.hint ?? 'Not measured',
    }
  );
}

/** The click metric alone, for the list view's fixed "Clicks" column. */
export function templateClickMetric(t: GalleryTemplate): TemplateMetric {
  const m = templateEngagement(t);
  return (
    m.find((x) => x.key === 'click') ?? {
      key: 'click',
      label: 'clicks',
      value: '—',
      measured: false,
      hint: m[0]?.hint ?? 'Not measured',
    }
  );
}

/**
 * Map a live API template into the gallery card shape. Name/category/channel are
 * real; the thumbnail styling is deterministic from the id, and open/click rates
 * come from real message outcomes of campaigns that sent this template on its
 * own channel — `null`, never 0, when there is nothing to measure.
 */
export function toGalleryTemplate(t: ApiTemplate): GalleryTemplate {
  const [thumb, fg, accent] = TEMPLATE_THUMBS[hash(t.id) % TEMPLATE_THUMBS.length];
  const { updated, updatedMin } = fmtAgo(t.updatedAt ?? t.createdAt);
  const category = toCategory(t.category);
  return {
    id: t.id,
    name: t.name,
    title: t.name,
    kicker: category.toUpperCase(),
    cta: 'View',
    category,
    channel: toChannel(t.channel),
    updated,
    updatedMin,
    createdOn: fmtDate(t.createdAt),
    thumb,
    fg,
    accent,
    favorite: !!t.favorite,
    avgOpen: rate(t.opened, t.trackedDelivered),
    avgClick: rate(t.clicked, t.trackedDelivered),
    trackedDelivered: t.trackedDelivered ?? 0,
    sent: t.sent ?? 0,
    delivered: t.delivered ?? 0,
    failed: t.failed ?? 0,
    approvalStatus: toApprovalStatus(t.approvalStatus),
    rejectionReason: t.rejectionReason ?? null,
    hasContent: templateHasContent(t),
  };
}

export function toGalleryTemplates(rows: ApiTemplate[]): GalleryTemplate[] {
  return rows.map(toGalleryTemplate);
}
