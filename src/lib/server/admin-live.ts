/**
 * Server-only loader that maps the tenant-scoped product API and Astro content
 * collections into the admin console's view types. Imported exclusively from
 * `admin.astro` (SSR) — never from a React island, since it pulls in the
 * JWT-minting `productClient` (node:crypto).
 */
import { mintServiceToken, productClient, serviceBaseUrl, type ServiceCtx } from './service';
import {
  fmtCompact,
  fmtInt,
  type AdminCampaign,
  type BlogPost,
  type CampStatus,
  type Channel,
  type Guide,
  type Kpi,
  type LegalDoc,
  type PublishStatus,
  type Queue,
} from '@/lib/app/admin-data';
import { campaignSendProgress, type ApiCampaign } from '@/lib/app/campaign-map';
import type {
  CampaignsLive,
  DeliverLive,
  OverviewLive,
  QueuesLive,
} from '@/components/react/admin/live-types';

/* ------------------------------------------------------------- API shapes */

interface Summary {
  subscribers: { total: number; active: number };
  lists: number;
  campaigns: { total: number; sent: number };
  messages: { total: number; delivered: number; failed: number; sentToday: number };
  byChannel: { channel: string; sent: number; delivered: number; failed: number }[];
}
interface DailyPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}
interface Suppression {
  address: string;
  channel: string;
  reason?: string | null;
}
type JobCounts = Record<string, number>;

/* ------------------------------------------------------------- utilities */

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const pct1 = (part: number, whole: number) => `${pct(part, whole).toFixed(1)}%`;

function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 0) return 'scheduled';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

const CHANNEL_LABEL: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', voice: 'Voice' };

const toChannel = (c?: string | null): Channel =>
  c === 'sms' ? 'sms' : c === 'whatsapp' ? 'whatsapp' : 'email';

const toCampStatus = (s?: string | null): CampStatus =>
  s === 'sending' ? 'sending' : s === 'scheduled' ? 'scheduled' : s === 'sent' ? 'sent' : 'paused';

function delivColor(p: number): string {
  if (p >= 98) return '#16a34a';
  if (p >= 95) return '#d97706';
  return '#dc2626';
}

/* --------------------------------------------------------------- mappers */

export function overviewLive(summary: Summary, daily: DailyPoint[]): OverviewLive {
  const { subscribers, lists, campaigns, messages } = summary;
  const kpis: Kpi[] = [
    { icon: 'users', label: 'Subscribers', value: fmtCompact(subscribers.total), delta: `${fmtInt(subscribers.active)} active`, tone: 'flat' },
    { icon: 'layers', label: 'Lists', value: fmtInt(lists), delta: 'audiences', tone: 'flat' },
    { icon: 'campaigns', label: 'Campaigns sent', value: fmtInt(campaigns.sent), delta: `${fmtInt(campaigns.total)} total`, tone: 'flat' },
    { icon: 'send', label: 'Messages sent', value: fmtCompact(messages.total), delta: `${fmtInt(messages.sentToday)} today`, tone: 'up' },
    { icon: 'check-circle', label: 'Delivered', value: pct1(messages.delivered, messages.total), delta: `${fmtInt(messages.delivered)} messages`, tone: 'up' },
    { icon: 'x', label: 'Failed', value: fmtInt(messages.failed), delta: pct1(messages.failed, messages.total), tone: messages.failed > 0 ? 'down' : 'flat' },
  ];
  return { kpis, daily, byChannel: summary.byChannel ?? [] };
}

export function deliverLive(summary: Summary, suppressions: Suppression[]): DeliverLive {
  const { messages } = summary;
  const kpis: Kpi[] = [
    { icon: 'send', label: 'Delivered', value: pct1(messages.delivered, messages.total), delta: `${fmtInt(messages.delivered)} of ${fmtInt(messages.total)}`, tone: 'up' },
    { icon: 'x', label: 'Failed', value: pct1(messages.failed, messages.total), delta: `${fmtInt(messages.failed)} messages`, tone: messages.failed > 0 ? 'down' : 'flat' },
    { icon: 'layers', label: 'Total sent', value: fmtCompact(messages.total), delta: 'all channels', tone: 'flat' },
    { icon: 'shield', label: 'Suppressed', value: fmtInt(suppressions.length), delta: 'addresses', tone: 'flat' },
    { icon: 'clock', label: 'Sent today', value: fmtInt(messages.sentToday), delta: 'so far', tone: 'flat' },
  ];
  const channels = (summary.byChannel ?? []).map((c) => {
    const value = Number(pct(c.delivered, c.sent).toFixed(1));
    return { label: CHANNEL_LABEL[c.channel] ?? c.channel, value, color: delivColor(value) };
  });
  const supp = suppressions.slice(0, 12).map((s) => ({
    address: s.address,
    channel: CHANNEL_LABEL[s.channel] ?? s.channel,
    reason: s.reason ?? null,
  }));
  return { kpis, channels, suppressions: supp };
}

export function campaignsLive(rows: ApiCampaign[], workspace: string): CampaignsLive {
  const mapped: AdminCampaign[] = rows.map((c) => ({
    name: c.name,
    ws: workspace,
    channel: toChannel(c.channel),
    recipients: c.recipients ?? 0,
    progress: campaignSendProgress(c),
    openRate: 0,
    status: toCampStatus(c.status),
    when: relativeTime(c.updatedAt ?? c.createdAt),
  }));
  const inFlight = mapped.filter((c) => c.status === 'sending').length;
  const scheduled = mapped.filter((c) => c.status === 'scheduled').length;
  const sent = mapped.filter((c) => c.status === 'sent').length;
  const recipients = mapped.reduce((t, c) => t + c.recipients, 0);
  const kpis: Kpi[] = [
    { icon: 'campaigns', label: 'In flight', value: fmtInt(inFlight), delta: 'sending now', tone: 'flat' },
    { icon: 'send', label: 'Sent', value: fmtInt(sent), delta: `${fmtInt(mapped.length)} total`, tone: 'up' },
    { icon: 'clock', label: 'Scheduled', value: fmtInt(scheduled), delta: 'upcoming', tone: 'flat' },
    { icon: 'target', label: 'Recipients', value: fmtCompact(recipients), delta: 'across campaigns', tone: 'flat' },
  ];
  return { rows: mapped, kpis };
}

export function queuesLive(counts: Record<string, JobCounts>): QueuesLive {
  const rows: Queue[] = Object.entries(counts).map(([name, c]) => {
    const failed = c.failed ?? 0;
    const waiting = c.waiting ?? 0;
    const active = c.active ?? 0;
    const status: Queue['status'] = failed > 0 ? 'degraded' : waiting > 1000 ? 'busy' : 'healthy';
    return {
      name,
      active,
      waiting,
      completed: c.completed ?? 0,
      failed,
      rate: `${fmtInt(active)} active`,
      status,
    };
  });
  const sum = (k: keyof JobCounts) => rows.reduce((t, r) => t + (r[k as keyof Queue] as number), 0);
  const kpis: Kpi[] = [
    { icon: 'zap', label: 'Queues', value: fmtInt(rows.length), delta: 'BullMQ', tone: 'flat' },
    { icon: 'layers', label: 'Waiting', value: fmtInt(sum('waiting')), delta: 'backlog', tone: 'flat' },
    { icon: 'x', label: 'Failed', value: fmtInt(sum('failed')), delta: 'needs review', tone: sum('failed') > 0 ? 'down' : 'flat' },
    { icon: 'check-circle', label: 'Completed', value: fmtCompact(sum('completed')), delta: 'lifetime', tone: 'up' },
  ];
  return { rows, kpis };
}

/* ----------------------------------------------------- content collections */

interface BlogEntry {
  id: string;
  data: { title: string; author: string; pubDate: Date; updatedDate?: Date; tags: string[]; draft: boolean; featured: boolean };
}
interface GuideEntry {
  id: string;
  data: { title: string; category: string; pubDate: Date; updatedDate?: Date; draft: boolean; readingMinutes: number; series?: string };
}
interface LegalEntry {
  id: string;
  data: { title: string; updatedDate: Date; kicker: string; noun: string };
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtLongDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function tagColor(seed: string): string {
  const palette = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#ea580c'];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function publishStatus(draft: boolean, pubDate: Date): PublishStatus {
  if (draft) return 'draft';
  return pubDate.getTime() > Date.now() ? 'scheduled' : 'published';
}

export function blogLive(entries: BlogEntry[]): BlogPost[] {
  return entries
    .slice()
    .sort((a, b) => (b.data.updatedDate ?? b.data.pubDate).getTime() - (a.data.updatedDate ?? a.data.pubDate).getTime())
    .map((e) => {
      const tag = e.data.tags[0] ?? 'Post';
      const status = publishStatus(e.data.draft, e.data.pubDate);
      return {
        title: e.data.title,
        tag,
        tagColor: tagColor(tag),
        author: e.data.author,
        updated: fmtDate(e.data.updatedDate ?? e.data.pubDate),
        status,
        live: status === 'published',
        featured: e.data.featured,
      };
    });
}

export function guidesLive(entries: GuideEntry[]): Guide[] {
  return entries
    .slice()
    .sort((a, b) => (b.data.updatedDate ?? b.data.pubDate).getTime() - (a.data.updatedDate ?? a.data.pubDate).getTime())
    .map((e) => {
      const status = publishStatus(e.data.draft, e.data.pubDate);
      return {
        title: e.data.title,
        cat: e.data.category,
        catColor: tagColor(e.data.category),
        mins: e.data.readingMinutes,
        updated: fmtDate(e.data.updatedDate ?? e.data.pubDate),
        status,
        live: status === 'published',
        feat: Boolean(e.data.series),
      };
    });
}

export function legalLive(entries: LegalEntry[]): LegalDoc[] {
  return entries.map((e) => ({
    title: e.data.title,
    status: 'published' as PublishStatus,
    updated: fmtLongDate(e.data.updatedDate),
    sections: [e.data.noun],
    href: `/legal/${e.id}`,
  }));
}

/* ------------------------------------------------------------- API loader */

export interface AdminApiSlices {
  overview: OverviewLive | null;
  campaigns: CampaignsLive | null;
  deliver: DeliverLive | null;
  queues: QueuesLive | null;
}

/** Fetch and map the tenant-scoped API slices. Each slice is null on failure. */
export async function loadAdminApiData(ctx: ServiceCtx, workspace: string): Promise<AdminApiSlices> {
  const slices: AdminApiSlices = { overview: null, campaigns: null, deliver: null, queues: null };
  const client = productClient(ctx);

  try {
    const [summaryRes, activityRes, campaignsRes, suppRes] = await Promise.all([
      client.GET('/v1/stats/summary'),
      client.GET('/v1/stats/activity', { params: { query: { days: 30 } } }),
      client.GET('/v1/campaigns'),
      client.GET('/v1/suppressions'),
    ]);

    const summary = summaryRes.data as unknown as Summary | undefined;
    const daily = (activityRes.data as unknown as { data?: DailyPoint[] } | undefined)?.data ?? [];
    const campaigns = (campaignsRes.data as unknown as { data?: ApiCampaign[] } | undefined)?.data ?? [];
    const suppressions = (suppRes.data as unknown as { data?: Suppression[] } | undefined)?.data ?? [];

    if (summary) {
      slices.overview = overviewLive(summary, daily);
      slices.deliver = deliverLive(summary, suppressions);
    }
    slices.campaigns = campaignsLive(campaigns, workspace);
  } catch {
    /* leave slices null — screens fall back to preview data */
  }

  // Queue counts live on the messaging app's /admin routes, which the BFF does
  // not proxy; fetch directly with a service token. Absent outside dev.
  try {
    const res = await fetch(`${serviceBaseUrl()}/admin/queues`, {
      headers: { Authorization: `Bearer ${mintServiceToken(ctx)}` },
    });
    if (res.ok) {
      slices.queues = queuesLive((await res.json()) as Record<string, JobCounts>);
    }
  } catch {
    /* no queue data available */
  }

  return slices;
}
