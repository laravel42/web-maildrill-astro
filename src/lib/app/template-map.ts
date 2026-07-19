import type { ChannelType } from '@/types/app';
import type { GalleryTemplate, TplCategory } from '@/lib/app/templates-data';

/** Shape of a template as returned by maildrill-service /v1/templates. */
export interface ApiTemplate {
  id: string;
  name: string;
  channel?: string | null;
  subject?: string | null;
  preheader?: string | null;
  html?: string | null;
  text?: string | null;
  category?: string | null;
  favorite?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const CATEGORIES: TplCategory[] = ['Promotional', 'Newsletter', 'Transactional', 'Announcement'];

/** Deterministic thumbnail palette [band background, foreground, CTA accent]. */
const THUMBS: Array<[string, string, string]> = [
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

function toChannel(c?: string | null): ChannelType {
  return c === 'sms' || c === 'whatsapp' || c === 'voice' ? c : 'email';
}

function toCategory(c?: string | null): TplCategory {
  return CATEGORIES.includes(c as TplCategory) ? (c as TplCategory) : 'Newsletter';
}

function fmtAgo(iso?: string | null): { updated: string; updatedMin: number } {
  if (!iso) return { updated: '—', updatedMin: Number.MAX_SAFE_INTEGER };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { updated: '—', updatedMin: Number.MAX_SAFE_INTEGER };
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  const updated =
    min < 1 ? 'just now' : min < 60 ? `${min}m ago` : min < 1440 ? `${Math.round(min / 60)}h ago` : `${Math.round(min / 1440)}d ago`;
  return { updated, updatedMin: min };
}

/**
 * Map a live API template into the gallery card shape. Identity/subject/category
 * are real; the thumbnail styling is deterministic from the id, and open/click
 * rates start at 0 (no fabricated analytics) until sends report back.
 */
export function toGalleryTemplate(t: ApiTemplate): GalleryTemplate {
  const [thumb, fg, accent] = THUMBS[hash(t.id) % THUMBS.length];
  const { updated, updatedMin } = fmtAgo(t.updatedAt ?? t.createdAt);
  const category = toCategory(t.category);
  return {
    id: t.id,
    name: t.name,
    title: t.subject || t.name,
    kicker: category.toUpperCase(),
    cta: 'View',
    category,
    channel: toChannel(t.channel),
    updated,
    updatedMin,
    thumb,
    fg,
    accent,
    favorite: !!t.favorite,
    avgOpen: 0,
    avgClick: 0,
  };
}

export function toGalleryTemplates(rows: ApiTemplate[]): GalleryTemplate[] {
  return rows.map(toGalleryTemplate);
}
