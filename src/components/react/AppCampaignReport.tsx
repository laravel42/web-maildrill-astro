import { useEffect, useState, type ReactNode } from 'react';
import type { Campaign } from '@/types/app';
import { api } from '@/lib/app/api';
import { campaigns as mockCampaigns } from '@/lib/app/mock-data';
import { toCampaign, type ApiCampaign } from '@/lib/app/campaign-map';
import {
  channelReportConfig,
  type ReportEventTab,
  type ReportFunnelKey,
  type ReportKpiKey,
} from '@/lib/app/campaign-report';
import { routes } from '@/config/routes';
import Icon from './Icon';
import StatusBadge from './shared/StatusBadge';
import Sparkline, { type SparkPoint } from './shared/Sparkline';
import { CHANNEL } from './shared/channels';
import { ChannelPill, ListPill } from './shared/CampaignPills';
import {
  eventRateSeries,
  EVENT_META,
  EVENT_TAB_LABEL,
  historySparkPoints,
  pickSpark,
  sameChannelHistory,
  type CampaignEventSummary,
  type RecipientEvent,
} from './shared/campaign-events';
import TimeAgo from './shared/TimeAgo';
import { PAGE_SIZE, visiblePageNumbers } from './shared/pagination';
import { pct } from './CampaignsBoard.logic';
import { buildCsv, downloadCsv, exportFilename } from '@/lib/app/subscriber-export';
import styles from './AppCampaignReport.module.css';

/**
 * CSV export window. `EXPORT_PAGE` is the cursor endpoint's own ceiling
 * (httpkit PAGE.max), so asking for more just gets clamped; `EXPORT_MAX` caps
 * a single download — every page after the first costs what the first did.
 */
const EXPORT_PAGE = 100;
const EXPORT_MAX = 10_000;

type Props = {
  /** Campaign id from the URL — used for the demo-mode fixture lookup. */
  id: string;
  /** SSR-fetched campaign; null = demo mode (fixture campaigns). */
  initial: Campaign | null;
  /** All workspace campaigns, for same-channel history sparks; null in demo. */
  campaigns: Campaign[] | null;
  /** Colour of the campaign's target list, when it targets a list. */
  listColor?: string | null;
  live: boolean;
};

/**
 * Campaign report page (/dashboard/campaigns/<id>/report) — the "View report"
 * destination (see App.dc.html § campaignDetail): breadcrumb, header with
 * actions, KPI cards, an engagement-funnel card beside a campaign-details card,
 * then the per-recipient event table fed by real message outcomes. Opens come
 * from provider seen/read receipts; clicks/unsubs from message_events. The
 * campaigns board only links here — all report logic lives on this page.
 */
export default function AppCampaignReport({ id, initial, campaigns, listColor, live }: Props) {
  /* LATENT DEFECT (fixture leakage): same shape as AppLists — on an SSR failure
     this falls back to the mock campaign set, so a live report page can render
     an entire campaign's figures from fixture data with nothing on screen
     saying so. Reached only when the API errors for this request. */
  const resolved = initial ?? mockCampaigns.find((c) => c.id === id) ?? null;
  if (!resolved) {
    return (
      <div className="screen" style={{ animation: 'fade .3s ease' }}>
        <div className="atable__empty">
          This campaign doesn’t exist. <a href={routes.app.campaigns}>Back to campaigns</a>
        </div>
      </div>
    );
  }
  return (
    <CampaignReport
      campaign={resolved}
      allCampaigns={campaigns ?? mockCampaigns}
      listColor={listColor ?? undefined}
      live={live}
    />
  );
}

function CampaignReport({
  campaign: campaignProp,
  allCampaigns,
  listColor,
  live,
}: {
  campaign: Campaign;
  allCampaigns: Campaign[];
  listColor?: string;
  live: boolean;
}) {
  const [campaign, setCampaign] = useState(campaignProp);

  // Fresh counters + lastErrorMessage — the SSR snapshot can be stale after DLRs/opens.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api
      .get<ApiCampaign>(`campaigns/${campaignProp.id}`)
      .then((full) => {
        if (!cancelled) setCampaign(toCampaign(full));
      })
      .catch(() => {
        /* keep the SSR snapshot */
      });
    return () => {
      cancelled = true;
    };
  }, [live, campaignProp.id]);

  const onBack = () => window.location.assign(routes.app.campaigns);

  /** Same-channel sent campaigns, chronological, ending with this one. */
  const history = sameChannelHistory(allCampaigns, campaign);

  /* Every figure below divides server-side counters from
     `messageRollup`/`eventRollup`, computed in SQL over the campaign's whole
     message set. `recipients` (count(*), failures included) is the denominator
     for delivery and unsub; `delivered` is the denominator for open and click.

     KNOWN DEFECT (audit #34): `cto` is guarded with truthiness, so a MEASURED
     zero click rate takes the null branch and renders "—" — indistinguishable
     from "not measured". Confirmed live on Perf campaign 12, whose click rate
     is a real 0.0%. The label is additionally "Click-to-open" on WhatsApp,
     where every other word on the page says "Seen". */
  const reportCfg = channelReportConfig(campaign.channel);
  const base = campaign.recipients || 1;
  const deliveredPct = (campaign.delivered / base) * 100;
  const cto =
    campaign.openRate && campaign.clickRate ? (campaign.clickRate / campaign.openRate) * 100 : null;
  // openRate/clickRate are fractions (0–1) — pct() multiplies by 100.
  const opened =
    campaign.openRate != null ? Math.round(campaign.openRate * campaign.delivered) : null;
  const clicked =
    campaign.clickRate != null ? Math.round(campaign.clickRate * campaign.delivered) : null;
  /* KNOWN DEFECT (audit #34): the `updatedAt` fallback turns "when was this
     sent" into "when was this row last touched", and the detail row above still
     labels it "Sent". A draft with all three send timestamps NULL renders
     "Sent Aug 16". A send that never happened should read "—". */
  const sentAt =
    campaign.completedAt ?? campaign.startedAt ?? campaign.scheduledAt ?? campaign.updatedAt;
  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  const ofRecipients = (n: number): string | null =>
    campaign.recipients > 0 ? `${((n / campaign.recipients) * 100).toFixed(1)}%` : null;
  const ofDelivered = (n: number): string | null =>
    campaign.delivered > 0 ? `${((n / campaign.delivered) * 100).toFixed(1)}%` : null;

  const kpiValue = (
    key: ReportKpiKey,
  ): { label: string; value: string; pct: string | null; cls?: string; hint?: string } => {
    switch (key) {
      case 'delivered':
        return {
          label: 'Delivered',
          value: campaign.delivered.toLocaleString('en-US'),
          pct: ofRecipients(campaign.delivered),
        };
      case 'opened':
      case 'seen':
        return {
          label: reportCfg.openLabel,
          value: opened != null ? opened.toLocaleString('en-US') : '—',
          pct: opened != null ? ofDelivered(opened) : null,
          cls: styles.kOpened,
          hint:
            opened == null
              ? 'No deliveries yet'
              : campaign.channel === 'whatsapp'
                ? 'Maildrill seen receipts'
                : 'Maildrill open tracking',
        };
      case 'clicked':
        return {
          label: 'Clicked',
          value: clicked != null ? clicked.toLocaleString('en-US') : '—',
          pct: clicked != null ? ofDelivered(clicked) : null,
          cls: styles.kClicked,
          hint: clicked == null ? 'No deliveries yet' : 'Maildrill tracked link clicks',
        };
      case 'bounced':
      case 'failed':
        return {
          label: key === 'bounced' ? 'Bounced' : 'Failed',
          value: campaign.failed.toLocaleString('en-US'),
          pct: ofRecipients(campaign.failed),
          cls: styles.kBounced,
          hint: campaign.lastErrorMessage?.trim() || undefined,
        };
      case 'unsubscribed':
        return {
          label: 'Unsubscribed',
          value: campaign.unsubscribed.toLocaleString('en-US'),
          pct: ofDelivered(campaign.unsubscribed),
          cls: styles.kDanger,
        };
      case 'complaints':
        return {
          label: 'Complaints',
          value: (campaign.complaints ?? 0).toLocaleString('en-US'),
          pct: ofDelivered(campaign.complaints ?? 0),
          cls: styles.kDanger,
          hint: 'Infobip spam complaint notifications',
        };
    }
  };
  const kpis = reportCfg.kpis.map(kpiValue);

  const funnelCount = (key: ReportFunnelKey): number | null => {
    switch (key) {
      case 'recipients':
        return campaign.recipients;
      case 'delivered':
        return campaign.delivered;
      case 'opened':
      case 'seen':
        return opened;
      case 'clicked':
        return clicked;
    }
  };
  const funnelColor: Record<ReportFunnelKey, string> = {
    recipients: 'var(--text3)',
    delivered: 'var(--accent)',
    opened: 'var(--success-strong)',
    seen: 'var(--success-strong)',
    clicked: 'var(--warning-strong)',
  };
  const funnelLabel = (key: ReportFunnelKey): string =>
    key === 'opened' || key === 'seen' ? reportCfg.openLabel : key[0]!.toUpperCase() + key.slice(1);
  const funnel = reportCfg.funnel.map((key) => {
    const count = funnelCount(key);
    return {
      label: funnelLabel(key),
      count,
      /* Recipients is the funnel's base, so its bar is 100% by definition — a
         literal, not a measurement. KNOWN DEFECT (audit #34): on a campaign
         with 0 recipients that literal still renders, giving "Recipients 0 ·
         100.0%". A zero base has no share. */
      barPct: key === 'recipients' ? 100 : count != null ? (count / base) * 100 : null,
      color: funnelColor[key],
      empty: '—',
    };
  });

  const audienceDetail: [string, ReactNode] = campaign.listId
    ? ['List', <ListPill name={campaign.audience} color={listColor} />]
    : campaign.segmentId
      ? ['Segment', campaign.audience]
      : ['Audience', campaign.audience];
  const countOrDash = (n: number) => (n === 0 ? '—' : n.toLocaleString('en-US'));
  const details: [string, ReactNode][] = [
    ['Channel', <ChannelPill channel={campaign.channel} />],
    audienceDetail,
    ['Recipients', countOrDash(campaign.recipients)],
    ...(reportCfg.kpis.includes('unsubscribed')
      ? ([['Unsubscribed', countOrDash(campaign.unsubscribed)]] as [string, ReactNode][])
      : []),
    ...(reportCfg.funnel.includes('opened') || reportCfg.funnel.includes('seen')
      ? ([['Click-to-open', cto == null ? '—' : `${cto.toFixed(1)}%`]] as [string, ReactNode][])
      : []),
    ['Sent', sentAt ? <span className={styles.reportSentBadge}>{sentLabel}</span> : sentLabel],
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /*
   * The recipient-event section. `events` is ONE page — never the campaign.
   * Everything that describes the whole of it (the tab counts, the footer
   * total, the rate-card sparks) comes from `summary`, because ten rows cannot
   * answer questions about 1,177 messages. They used to try: the island
   * fetched a 200-row sample and counted it, so every tab on a campaign over
   * 200 recipients reported 200 while the funnel beside it reported 1,177.
   */
  const [events, setEvents] = useState<RecipientEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [summary, setSummary] = useState<CampaignEventSummary | null>(null);
  const [eventTab, setEventTab] = useState<ReportEventTab>('all');
  const [exporting, setExporting] = useState(false);
  const [devices, setDevices] = useState<Array<{ device: string; count: number }>>([]);
  const [links, setLinks] = useState<Array<{ url: string; total: number; unique: number }>>([]);

  /*
   * One string naming the query a page number and a cursor belong to. Derived
   * during render rather than reset from an effect: an effect that calls
   * setEventPage(1) has not run by the time the fetch effect fires in the same
   * commit, so switching tab would issue one request carrying the previous
   * tab's cursor — refused (cursor_shape_mismatch) and wasted. Keying the state
   * makes the reset simultaneous.
   */
  const eventKey = `${campaign.id}|${eventTab}`;
  const [eventPageState, setEventPageState] = useState<{ key: string; page: number }>({
    key: '',
    page: 1,
  });
  const eventPage = eventPageState.key === eventKey ? eventPageState.page : 1;
  const setEventPage = (next: number | ((p: number) => number)) =>
    setEventPageState({
      key: eventKey,
      page: typeof next === 'function' ? next(eventPage) : next,
    });
  const [cursors, setCursors] = useState<{ key: string; byPage: Record<number, string> }>({
    key: '',
    byPage: {},
  });
  const cursorFor = cursors.key === eventKey ? cursors.byPage : {};

  // A different channel offers a different set of tabs, so the selected one
  // may no longer exist. The page and cursors reset with it, via `eventKey`.
  useEffect(() => {
    setEventTab('all');
  }, [campaign.channel, campaign.id]);

  /* One page of rows, filtered and ordered server-side. The tab is a `?kind=`
     the database applies, not a predicate the browser runs over what it
     happens to hold — that is what keeps these rows and the counts above them
     describing the same set. */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    setEventsLoading(true);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (eventTab !== 'all') qs.set('kind', eventTab);
    const cursor = cursorFor[eventPage];
    if (cursor) qs.set('cursor', cursor);
    else if (eventPage > 1) qs.set('page', String(eventPage));
    api
      .get<{ items: RecipientEvent[]; next_cursor: string | null }>(
        `campaigns/${campaign.id}/messages?${qs}`,
      )
      .then((res) => {
        if (cancelled) return;
        setEvents(res.items ?? []);
        // Remember the doorway to the following page so Next stays keyset.
        if (res.next_cursor) {
          const token = res.next_cursor;
          setCursors((c) => ({
            key: eventKey,
            byPage: { ...(c.key === eventKey ? c.byPage : {}), [eventPage + 1]: token },
          }));
        }
      })
      .catch(() => {
        /* keep the empty state on failure */
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `cursorFor` is read but deliberately not depended on: this effect fills
    // it, so listing it would re-run the fetch on its own result.
  }, [live, campaign.id, eventTab, eventPage]);

  /* Tab counts and the rate-card series describe the whole campaign, so they
     are fetched once per campaign — never per page. One grouped scan. */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api
      .get<CampaignEventSummary>(`campaigns/${campaign.id}/messages/counts`)
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        /* leave the tabs at zero rather than at a page-sized lie */
      });
    api
      .get<{
        devices: Array<{ device: string; count: number }>;
        links: Array<{ url: string; total?: number; unique?: number; count?: number }>;
      }>(`campaigns/${campaign.id}/engagement`)
      .then((res) => {
        if (cancelled) return;
        setDevices(res.devices ?? []);
        setLinks(
          (res.links ?? []).map((l) => ({
            url: l.url,
            total: l.total ?? l.count ?? 0,
            unique: l.unique ?? l.count ?? 0,
          })),
        );
      })
      .catch(() => {
        /* leave empty breakdowns */
      });
    return () => {
      cancelled = true;
    };
  }, [live, campaign.id]);

  /* Rate-card sparks: prefer this campaign's event timeline (delivery/unsub
     of recipients; open/click of delivered); fall back to same-channel
     campaign history; always pad so every card has a real spark. */
  const unsubPct =
    campaign.recipients > 0 ? (campaign.unsubscribed / campaign.recipients) * 100 : 0;
  const eventSeries = eventRateSeries(summary?.series ?? [], campaign.recipients);
  const historySeries = {
    delivery: historySparkPoints(history, (c) =>
      c.recipients > 0 ? (c.delivered / c.recipients) * 100 : null,
    ),
    open: historySparkPoints(history, (c) => (c.openRate != null ? c.openRate * 100 : null)),
    click: historySparkPoints(history, (c) => (c.clickRate != null ? c.clickRate * 100 : null)),
    unsub: historySparkPoints(history, (c) =>
      c.recipients > 0 ? (c.unsubscribed / c.recipients) * 100 : null,
    ),
  };
  const deltaOf = (series: SparkPoint[]): number | null =>
    series.length >= 2 ? series[series.length - 1]!.value - series[series.length - 2]!.value : null;
  const asDelta = (
    d: number | null,
    goodWhenUp = true,
  ): { text: string; good: boolean } | undefined =>
    d == null || Math.abs(d) < 0.05
      ? undefined
      : {
          text: `${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}%`,
          good: goodWhenUp ? d > 0 : d < 0,
        };

  const openPct = campaign.openRate != null ? campaign.openRate * 100 : 0;
  const clickPct = campaign.clickRate != null ? campaign.clickRate * 100 : 0;
  const nowLabel = sentLabel !== '—' ? sentLabel : 'Now';

  const rateCardDefs: Record<
    'delivery' | 'open' | 'seen' | 'click' | 'unsub',
    {
      label: string;
      value: string;
      color: string;
      series: SparkPoint[];
      delta?: { text: string; good: boolean };
      hint?: string;
    }
  > = {
    delivery: {
      label: 'Delivery rate',
      value: `${deliveredPct.toFixed(1)}%`,
      color: 'var(--success-strong)',
      series: pickSpark(eventSeries.delivery, historySeries.delivery, deliveredPct, nowLabel),
      delta: asDelta(deltaOf(historySeries.delivery)),
    },
    open: {
      label: 'Open rate',
      value: pct(campaign.openRate),
      color: 'var(--accent)',
      series: pickSpark(eventSeries.open, historySeries.open, openPct, nowLabel),
      delta: asDelta(deltaOf(historySeries.open)),
      hint: campaign.openRate == null ? 'No deliveries yet' : undefined,
    },
    seen: {
      label: 'Seen rate',
      value: pct(campaign.openRate),
      color: 'var(--accent)',
      series: pickSpark(eventSeries.open, historySeries.open, openPct, nowLabel),
      delta: asDelta(deltaOf(historySeries.open)),
      hint: campaign.openRate == null ? 'No deliveries yet' : 'Maildrill WhatsApp seen receipts',
    },
    click: {
      label: 'Click rate',
      value: pct(campaign.clickRate),
      color: '#8b5cf6',
      series: pickSpark(eventSeries.click, historySeries.click, clickPct, nowLabel),
      delta: asDelta(deltaOf(historySeries.click)),
      hint: campaign.clickRate == null ? 'No deliveries yet' : undefined,
    },
    unsub: {
      label: 'Unsub rate',
      value: `${unsubPct.toFixed(1)}%`,
      color: 'var(--ch-voice)',
      series: pickSpark(eventSeries.unsub, historySeries.unsub, unsubPct, nowLabel),
      delta: asDelta(deltaOf(historySeries.unsub), false),
    },
  };
  const rateCards = reportCfg.rateCards.map((key) => rateCardDefs[key]);

  /* Every number in this section is the server's, counted over the whole
     campaign: the tab badges, the "x–y of N" footer and the page count alike.
     `events` only ever supplies the rows. */
  const eventCounts: Record<string, number> = summary
    ? { all: summary.total, ...summary.byKind }
    : {};
  const eventTotal = eventTab === 'all' ? (summary?.total ?? 0) : (eventCounts[eventTab] ?? 0);
  const eventPages = Math.max(1, Math.ceil(eventTotal / PAGE_SIZE));
  const safeEventPage = Math.min(eventPage, eventPages);
  const eventPagerPages = visiblePageNumbers(safeEventPage, eventPages);
  const eventStart = eventTotal === 0 ? 0 : (safeEventPage - 1) * PAGE_SIZE + 1;
  const eventEnd = Math.min(safeEventPage * PAGE_SIZE, eventTotal);

  const openColLabel = campaign.channel === 'whatsapp' ? 'Seen' : 'Opened';

  /* Export the tab, not the page. The table holds ten rows, so the download
     re-walks the same server-side filter a cursor at a time — the last page
     costs what the first did. */
  const exportEvents = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all: RecipientEvent[] = [];
      let cursor: string | null = null;
      for (let fetched = 0; fetched < EXPORT_MAX; fetched += EXPORT_PAGE) {
        const qs = new URLSearchParams({ limit: String(EXPORT_PAGE) });
        if (eventTab !== 'all') qs.set('kind', eventTab);
        if (cursor) qs.set('cursor', cursor);
        const res: { items?: RecipientEvent[]; next_cursor: string | null } = await api.get(
          `campaigns/${campaign.id}/messages?${qs}`,
        );
        all.push(...(res.items ?? []));
        cursor = res.next_cursor;
        if (!cursor) break;
      }
      const csv = buildCsv(
        ['recipient', 'address', 'event', openColLabel.toLowerCase(), 'clicked', 'at'],
        all.map((e) => [
          e.name ?? '',
          e.address,
          EVENT_META[e.kind].label,
          e.status === 'read' || e.clicked ? 'yes' : 'no',
          e.clicked ? 'yes' : 'no',
          e.at ?? '',
        ]),
      );
      const slug = campaign.name.replaceAll(/\s+/g, '-').toLowerCase();
      downloadCsv(exportFilename(`maildrill-${slug}-events`), csv);
    } catch {
      /* leave the table as it is rather than blanking it for a failed download */
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      <button type="button" className={styles.reportBack} onClick={onBack}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Campaigns
      </button>

      <div className={styles.reportHead}>
        <div className={styles.reportHeadMain}>
          <h1 className={styles.reportName}>
            {campaign.name}
            <StatusBadge status={campaign.status} />
          </h1>
        </div>
      </div>

      <div className={styles.rateRow}>
        {rateCards.map((r) => (
          <div key={r.label} className={styles.reportKpi} title={r.hint}>
            <div className={styles.rateTop}>
              <span className={styles.reportKpiLbl}>{r.label}</span>
              <span className={styles.rateValWrap}>
                <span className={`tnum ${styles.rateVal}`}>{r.value}</span>
                {r.delta && (
                  <span
                    className={`tnum ${styles.rateDelta} ${
                      r.delta.good ? styles.deltaGood : styles.deltaBad
                    }`}
                  >
                    {r.delta.text}
                  </span>
                )}
              </span>
            </div>
            <Sparkline series={r.series} color={r.color} format="percent" />
          </div>
        ))}
      </div>

      <div className={styles.reportRow}>
        <div className={styles.reportCard}>
          <div className={styles.reportCardTitle}>Engagement funnel</div>
          {funnel.map((f) => (
            <div key={f.label} className={styles.funnelRow}>
              <div className={styles.funnelTop}>
                <span className={styles.funnelLbl}>{f.label}</span>
                <span className={`tnum ${styles.funnelVal}`}>
                  {f.count == null
                    ? f.empty
                    : `${f.count.toLocaleString('en-US')}${
                        f.barPct != null ? ` · ${f.barPct.toFixed(1)}%` : ''
                      }`}
                </span>
              </div>
              <div className={styles.funnelTrack}>
                {f.barPct != null && f.barPct > 0 && (
                  <div
                    className={styles.funnelBar}
                    style={{ width: `${Math.max(f.barPct, 1.5)}%`, background: f.color }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.reportCard}>
          <div className={styles.reportCardTitle}>Campaign details</div>
          {details.map(([k, v]) => (
            <div key={k} className={styles.reportDetail}>
              <span className={styles.reportDetailK}>{k}</span>
              <span className={styles.reportDetailV}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {(reportCfg.panels.includes('devices') && devices.length > 0) ||
      (reportCfg.panels.includes('links') && links.length > 0) ? (
        <div
          className={`${styles.reportRow} ${styles.reportRow2}${
            !(
              reportCfg.panels.includes('devices') &&
              devices.length > 0 &&
              reportCfg.panels.includes('links') &&
              links.length > 0
            )
              ? ` ${styles.reportRowSolo}`
              : ''
          }`}
        >
          {reportCfg.panels.includes('devices') && devices.length > 0 && (
            <div className={styles.reportCard}>
              <div className={styles.reportCardTitle}>Top devices</div>
              {devices.map((d) => (
                <div key={d.device} className={styles.reportDetail}>
                  <span className={styles.reportDetailK}>{d.device}</span>
                  <span className={`tnum ${styles.reportDetailV}`}>
                    {d.count.toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {reportCfg.panels.includes('links') && links.length > 0 && (
            <div className={styles.reportCard}>
              <div className={styles.reportCardTitle}>Top links clicked</div>
              <table className={styles.linksTable}>
                <thead>
                  <tr>
                    <th scope="col">Link</th>
                    <th scope="col" className={styles.linksNum}>
                      Total clicks
                    </th>
                    <th scope="col" className={styles.linksNum}>
                      Unique clicks
                    </th>
                    <th scope="col" className={styles.linksNum}>
                      % recipients
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => {
                    const short = l.url.replace(/^https?:\/\//, '');
                    const recipPct =
                      campaign.recipients > 0
                        ? `${((l.unique / campaign.recipients) * 100).toFixed(1)}%`
                        : '—';
                    return (
                      <tr key={l.url}>
                        <td>
                          <a
                            className={styles.linkUrl}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={l.url}
                          >
                            {short.slice(0, 64)}
                            {short.length > 64 ? '…' : ''}
                          </a>
                        </td>
                        <td className={`tnum ${styles.linksNum}`}>
                          {l.total.toLocaleString('en-US')}
                        </td>
                        <td className={`tnum ${styles.linksNum}`}>
                          {l.unique.toLocaleString('en-US')}
                        </td>
                        <td className={`tnum ${styles.linksNum}`}>{recipPct}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className={styles.reportKpis}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.reportKpi} title={k.hint}>
            <div className={styles.reportKpiLbl}>{k.label}</div>
            <div className={styles.reportKpiValRow}>
              <div className={`tnum ${styles.reportKpiVal}${k.cls ? ` ${k.cls}` : ''}`}>
                {k.value}
              </div>
              {k.pct != null && (
                <>
                  <span className={styles.reportKpiSep} aria-hidden="true">
                    /
                  </span>
                  <div className={`tnum ${styles.reportKpiPct}${k.cls ? ` ${k.cls}` : ''}`}>
                    {k.pct}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* per-recipient events */}
      <section className={`atable ${styles.revCard}`} aria-label="Recipient events">
        <div className={styles.revHead}>
          <div>
            <h2 className="acrd__title">Recipient events</h2>
            <p className={styles.revSub}>Individual delivery activity, per recipient.</p>
          </div>
          <button
            type="button"
            className={`sbtn ${styles.exportBtn}`}
            onClick={() => void exportEvents()}
            disabled={eventTotal === 0 || exporting}
          >
            <Icon name="download" size={12} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>

        <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Event type">
          {reportCfg.eventTabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={eventTab === t}
              className={`atab${eventTab === t ? ' is-active' : ''}`}
              onClick={() => {
                setEventTab(t);
                setEventPage(1);
              }}
            >
              {EVENT_TAB_LABEL[t]}
              <span className="atab__count tnum">{eventCounts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className={`athead ${styles.revGrid}`}>
          <div>Recipient</div>
          <div>Event</div>
          <div className={styles.revFlagHead}>{openColLabel}</div>
          <div className={styles.revFlagHead}>Clicked</div>
          <div className={styles.revWhenHead}>When</div>
        </div>

        {events.map((e) => {
          const kind = EVENT_META[e.kind];
          const meta = CHANNEL[e.channel] ?? CHANNEL.email;
          const display = e.name?.trim() || e.address;
          const opened = e.status === 'read' || Boolean(e.clicked);
          return (
            <div key={e.id} className={`atrow ${styles.revGrid} ${styles.revRow}`}>
              <div className={styles.revCell}>
                <span
                  className={styles.revAv}
                  style={{ background: meta.tint, color: meta.color }}
                  aria-hidden="true"
                >
                  {display.charAt(0).toUpperCase()}
                </span>
                <div className={styles.revWho}>
                  {e.recipientId ? (
                    <a className={styles.revName} href={routes.app.subscriber(e.recipientId)}>
                      {display}
                    </a>
                  ) : (
                    <div className={styles.revName}>{display}</div>
                  )}
                  <div className={`${styles.revAddr} tnum`}>{e.address}</div>
                </div>
              </div>
              <div>
                <span className={`astatus ${kind.cls}`}>{kind.label}</span>
              </div>
              <div
                className={`${styles.revFlag} ${opened ? styles.revFlagOn : styles.revFlagOff}`}
                aria-label={opened ? openColLabel : `Not ${openColLabel.toLowerCase()}`}
              >
                {opened ? (
                  <Icon name="check" size={15} stroke={2.6} />
                ) : (
                  <Icon name="minus" size={14} stroke={2.2} />
                )}
              </div>
              <div
                className={`${styles.revFlag} ${e.clicked ? styles.revFlagOn : styles.revFlagOff}`}
                aria-label={e.clicked ? 'Clicked' : 'Not clicked'}
              >
                {e.clicked ? (
                  <Icon name="check" size={15} stroke={2.6} />
                ) : (
                  <Icon name="minus" size={14} stroke={2.2} />
                )}
              </div>
              <TimeAgo className={`${styles.revWhen} tnum`} at={e.at} />
            </div>
          );
        })}

        {!live && (
          <div className="atable__empty">
            Recipient events load from the delivery service once the workspace is connected.
          </div>
        )}
        {live && !eventsLoading && events.length === 0 && (
          <div className="atable__empty">No recipient events for this campaign yet.</div>
        )}
        {live && eventsLoading && events.length === 0 && (
          <div className="atable__empty">Loading recipient events…</div>
        )}

        <div className="atable__foot">
          <span className={eventTotal === 0 ? undefined : 'tnum'}>
            {eventTotal === 0
              ? 'No recipient events match this filter yet'
              : `${eventStart}–${eventEnd} of ${eventTotal.toLocaleString('en-US')} events`}
          </span>
          {eventPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pg}
                disabled={safeEventPage === 1}
                onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <Icon name="chevron-right" size={15} className={styles.pgflip} />
              </button>
              {eventPagerPages.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.pgn} tnum${n === safeEventPage ? ' is-on' : ''}`}
                  aria-current={n === safeEventPage ? 'page' : undefined}
                  onClick={() => setEventPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={styles.pg}
                disabled={safeEventPage === eventPages}
                onClick={() => setEventPage((p) => Math.min(eventPages, p + 1))}
                aria-label="Next page"
              >
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
