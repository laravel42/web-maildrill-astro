/**
 * List detail page — types + helpers that turn API payloads into the shape the
 * AppListDetail island renders. Mirrors subscriber-detail.ts: everything the
 * backend records is bound; everything it doesn't renders "—" in the island.
 */
import type { ApiList } from '@/lib/app/list-map';
import type { ApiCampaign } from '@/lib/app/campaign-map';

export type RosterFilter = 'all' | 'active' | 'unconfirmed' | 'unsubscribed' | 'bounced';

/** Member row from /v1/lists/{id}/members — subscriber columns + joinedAt. */
export type ApiListMember = {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  status: string;
  attributes?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** list_members.addedAt — when they joined this list. */
  joinedAt?: string | null;
};

/** Custom field definition from /v1/custom-fields. */
export type ApiCustomFieldDef = {
  id: string;
  key: string;
  label: string;
  type: string;
};

/** Segment row from /v1/segments (rules are the jsonb rule array). */
export type ApiSegment = {
  id: string;
  name: string;
  rules?: Array<{ field: string; op: string; value?: unknown }> | null;
};

export type HealthSegment = {
  key: 'active' | 'unconfirmed' | 'unsubscribed' | 'bounced' | 'complained';
  label: string;
  color: string;
  value: number;
  /** Share of the roster, 0–100 with one decimal. */
  pct: number;
};

export type RosterRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avBg: string;
  avInk: string;
  status: RosterFilter | 'complained';
  statusLabel: string;
  statusColor: string;
  joinedLabel: string;
  search: string;
};

export type WeeklyJoins = { label: string; joins: number; left: number };

export type ListCampaignRow = {
  id: string;
  name: string;
  sub: string;
  sent: string;
  delivered: string;
  opens: string;
  clicks: string;
  unsubs: string;
};

export type ListFieldRow = {
  id: string;
  label: string;
  key: string;
  typeLabel: string;
  fillPct: number;
  fillColor: string;
};

export type ListDetailView = {
  total: number;
  /** True when the roster sample is capped below the real member count. */
  sampled: boolean;
  growthLabel: string;
  growthUp: boolean;
  deliverableLabel: string;
  health: HealthSegment[];
  weeks: WeeklyJoins[];
  roster: RosterRow[];
  rosterCounts: Record<RosterFilter, number>;
  campaigns: ListCampaignRow[];
  fields: ListFieldRow[];
  segments: string[];
  createdLabel: string;
  createdLine: string;
  lastCampaignLabel: string;
  bounceRate: string;
  complaintRate: string;
  unsubRate: string;
  embedSnippet: string;
};

/** Comp avatar palette (bg / ink), assigned per member id like subscriber-map. */
const AV: Array<[string, string]> = [
  ['#eef0ff', '#4f46e5'],
  ['#e8f6ee', '#127a45'],
  ['#fdf3e3', '#c2740a'],
  ['#f3f0ff', '#6d28d9'],
  ['#e6f6fa', '#0e7490'],
];

function pickAv(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length] ?? AV[0];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#16a34a' },
  unsubscribed: { label: 'Unsubscribed', color: '#8f8d84' },
  bounced: { label: 'Bounced', color: '#dc2626' },
  complained: { label: 'Complained', color: '#9f1239' },
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDayMonth(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** ISO week number (1–53) for the bar-chart labels. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** Start (Monday 00:00 local) of the ISO week containing `d`. */
function weekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDay() || 7;
  out.setDate(out.getDate() - (day - 1));
  return out;
}

function pctLabel(n: number, denom: number): string {
  if (denom <= 0) return '—';
  return `${((n / denom) * 100).toFixed(1)}%`;
}

/** Build the list-detail view model from the list row + roster + related data. */
export function buildListDetailView(
  list: ApiList,
  members: ApiListMember[],
  campaigns: ApiCampaign[],
  fields: ApiCustomFieldDef[],
  segments: ApiSegment[],
): ListDetailView {
  const loaded = members.length;
  const total = Math.max(list.memberCount ?? loaded, loaded);
  const sampled = total > loaded;

  // Status buckets from the loaded roster. "Unconfirmed" exists in the comp
  // but the backend has no such subscriber status — it stays 0.
  const bucket = { active: 0, unconfirmed: 0, unsubscribed: 0, bounced: 0, complained: 0 };
  for (const m of members) {
    if (m.status === 'active') bucket.active += 1;
    else if (m.status === 'unsubscribed') bucket.unsubscribed += 1;
    else if (m.status === 'bounced') bucket.bounced += 1;
    else if (m.status === 'complained') bucket.complained += 1;
  }

  // When the roster is capped at 1000, shares come from the loaded sample and
  // the legend counts scale those shares up to the real member count.
  const share = (n: number) => (loaded > 0 ? n / loaded : 0);
  const value = (n: number) => (sampled ? Math.round(total * share(n)) : n);
  const seg = (
    key: HealthSegment['key'],
    label: string,
    color: string,
    count: number,
  ): HealthSegment => ({
    key,
    label,
    color,
    value: value(count),
    pct: Math.round(share(count) * 1000) / 10,
  });
  const health: HealthSegment[] = [
    seg('active', 'Active', '#4f46e5', bucket.active),
    seg('unconfirmed', 'Unconfirmed', '#c2740a', bucket.unconfirmed),
    seg('unsubscribed', 'Unsubscribed', '#a5a39a', bucket.unsubscribed),
    seg('bounced', 'Bounced', '#dc2626', bucket.bounced),
    seg('complained', 'Complaints', '#9f1239', bucket.complained),
  ];

  const last7 = list.addedLast7 ?? 0;
  const prev7 = list.addedPrev7 ?? 0;
  const growthPct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;
  const growthUp = growthPct >= 0;
  const growthLabel = `${growthUp ? '+' : '−'}${Math.abs(growthPct).toFixed(1)}% this week`;

  // Joins per ISO week, trailing 12 weeks. "Left" has no data source — zero.
  const now = new Date();
  const thisWeek = weekStart(now).getTime();
  const WEEK = 7 * 86400000;
  const weeks: WeeklyJoins[] = Array.from({ length: 12 }, (_, i) => {
    const start = thisWeek - (11 - i) * WEEK;
    const end = start + WEEK;
    const joins = members.filter((m) => {
      const t = m.joinedAt ? new Date(m.joinedAt).getTime() : NaN;
      return !Number.isNaN(t) && t >= start && t < end;
    }).length;
    return { label: `W${isoWeek(new Date(start))}`, joins, left: 0 };
  });

  const roster: RosterRow[] = members.map((m) => {
    const meta = STATUS_META[m.status] ?? STATUS_META.active;
    const name = m.name || m.email;
    const [avBg, avInk] = pickAv(m.id);
    return {
      id: m.id,
      name,
      email: m.email,
      initials: initialsOf(name),
      avBg,
      avInk,
      status: (m.status in STATUS_META ? m.status : 'active') as RosterRow['status'],
      statusLabel: meta.label,
      statusColor: meta.color,
      joinedLabel: fmtDate(m.joinedAt ?? m.createdAt),
      search: `${name} ${m.email}`.toLowerCase(),
    };
  });
  const rosterCounts: Record<RosterFilter, number> = {
    all: roster.length,
    active: bucket.active,
    unconfirmed: bucket.unconfirmed,
    unsubscribed: bucket.unsubscribed,
    bounced: bucket.bounced,
  };

  const campaignRows: ListCampaignRow[] = campaigns.map((c) => {
    const channel = c.channel ? c.channel[0]!.toUpperCase() + c.channel.slice(1) : 'Email';
    const when = c.startedAt
      ? fmtDayMonth(c.startedAt)
      : ((c.status ?? 'draft') as string).toLowerCase();
    const recipients = c.recipients ?? 0;
    const delivered = c.delivered ?? 0;
    return {
      id: c.id,
      name: c.name,
      sub: `${channel} · ${when}`,
      sent: recipients > 0 ? recipients.toLocaleString('en-US') : '—',
      delivered: recipients > 0 && delivered > 0 ? pctLabel(delivered, recipients) : '—',
      opens: delivered > 0 ? pctLabel(c.opened ?? 0, delivered) : '—',
      clicks: delivered > 0 ? pctLabel(c.clicked ?? 0, delivered) : '—',
      unsubs: '—',
    };
  });

  const fieldRows: ListFieldRow[] = fields.map((f) => {
    const filled =
      loaded > 0
        ? members.filter((m) => {
            const v = (m.attributes ?? {})[f.key];
            return v != null && v !== '';
          }).length
        : 0;
    const fillPct = loaded > 0 ? Math.round((filled / loaded) * 100) : 0;
    return {
      id: f.id,
      label: f.label,
      key: f.key,
      typeLabel: f.type ? f.type[0]!.toUpperCase() + f.type.slice(1) : 'Text',
      fillPct,
      fillColor: fillPct >= 80 ? '#16a34a' : fillPct >= 40 ? '#4f46e5' : '#c2740a',
    };
  });

  // Segments that reference this list via a membership rule (field "list").
  const segmentNames = segments
    .filter((s) =>
      (s.rules ?? []).some((r) => r.field === 'list' && String(r.value ?? '') === list.id),
    )
    .map((s) => s.name);

  const sent = campaigns
    .filter((c) => c.status === 'sent' && c.startedAt)
    .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());
  const lastCampaign = sent[0] ?? null;
  const createdLabel = fmtDate(list.createdAt);
  const createdLine = lastCampaign
    ? `Created ${createdLabel} · last campaign ${fmtDate(lastCampaign.startedAt)}`
    : `Created ${createdLabel}`;
  const lastCampaignLabel = lastCampaign ? fmtDate(lastCampaign.startedAt) : '—';

  return {
    total,
    sampled,
    growthLabel,
    growthUp,
    deliverableLabel: loaded > 0 ? `${(share(bucket.active) * 100).toFixed(1)}%` : '—',
    health,
    weeks,
    roster,
    rosterCounts,
    campaigns: campaignRows,
    fields: fieldRows,
    segments: segmentNames,
    createdLabel,
    createdLine,
    lastCampaignLabel,
    bounceRate: loaded > 0 ? `${(share(bucket.bounced) * 100).toFixed(2)}%` : '—',
    complaintRate: loaded > 0 ? `${(share(bucket.complained) * 100).toFixed(2)}%` : '—',
    unsubRate: loaded > 0 ? `${(share(bucket.unsubscribed) * 100).toFixed(2)}%` : '—',
    embedSnippet: `<script src="https://js.maildrill.com/embed.js" data-list="${list.id}"></script>`,
  };
}
