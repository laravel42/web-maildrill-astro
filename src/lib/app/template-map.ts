import type { ChannelType, TemplateApprovalStatus } from '@/types/app';
import type { GalleryTemplate, TplCategory } from '@/lib/app/templates-data';

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
 * Whole-percent rate against TRACKED deliveries (email + WhatsApp only, counted
 * in SQL over every campaign that sent this template). SMS and voice deliveries
 * are excluded from the denominator because no provider on those channels
 * reports an open, so counting them would only drag the rate toward zero.
 *
 * KNOWN DEFECT (audit #13): the zero-denominator branch returns the NUMBER 0,
 * which the gallery card renders as a confident "0% opens · 0% clicks". For an
 * SMS or voice template `tracked` is 0 by construction, so that reads as "nobody
 * engaged" where the truth is "this channel measures nothing". 148 of the seeded
 * tenant's 229 templates render that literal zero — 92 of them with real reads
 * behind it. The drawer's `templateKpis` in AppTemplates.tsx gets this right and
 * returns "—"; this helper is the one missing the branch.
 *
 * Second half of the same defect: `opened` upstream counts reads on every
 * channel while `trackedDelivered` counts two, so 32 sms/voice templates render
 * a NON-ZERO opens % under a badge for a channel the product says reports none.
 */
function rate(numerator?: number | null, tracked?: number | null): number {
  if (!tracked || tracked <= 0) return 0;
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
 * Map a live API template into the gallery card shape. Name/category/channel are
 * real; the thumbnail styling is deterministic from the id, and open/click rates
 * come from real message outcomes of campaigns that sent this template
 * (0 until sends report back — never fabricated).
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
