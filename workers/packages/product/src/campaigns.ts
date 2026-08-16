import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { assertTrialAllowance, reserveCampaignCredits } from '@maildrill/billing';
import { campaigns, db, messages, subscribers, type Campaign } from '@maildrill/database';
import {
  ConflictError,
  estimateVoiceSeconds,
  NotFoundError,
  type Channel,
} from '@maildrill/domain';
import {
  assertDeliverabilityOk,
  assertListSendable,
  screenTrialAudience,
  submitMessage,
} from '@maildrill/services';
import { createLogger } from '@maildrill/observability';
import { addressForChannel, resolveAudience, type AudienceSelector } from './audience';
import { getTemplate, resolveMessageContent } from './templates';

const log = createLogger({ component: 'campaigns' });
const MAX_AUDIENCE = 5000;

/** Alias for the second reference to `messages` in a numbered-jump page. */
const ANCHOR = 'anchor';

/**
 * `messages`, or the `anchor` alias of it. The report's row expressions take
 * one of these so the keyset anchor can reuse them under a second alias in the
 * same statement instead of restating them — a restated CASE is how the jump
 * target and the page it opens would come to disagree.
 */
type MessagesTable = typeof messages | ReturnType<typeof alias<typeof messages, typeof ANCHOR>>;

export interface CampaignRecipientEvent {
  id: string;
  recipientId: string | null;
  /** Subscriber display name when the recipient still exists in the CRM. */
  name: string | null;
  /** The address the message was actually sent to (email or phone). */
  address: string;
  channel: Channel;
  status: string;
  /** Which report tab this row belongs to — see `CAMPAIGN_EVENT_KINDS`. */
  kind: CampaignEventKind;
  /** Engagement beyond message status, from provider events. */
  clicked: boolean;
  unsubscribed: boolean;
  /** Most meaningful moment for the row: delivered/failed/sent, else last update. */
  at: Date | null;
}

/**
 * The report's recipient-event tabs.
 *
 * Every message falls in exactly one — furthest stage wins — so the per-kind
 * counts partition the campaign instead of overlapping, and "All" is their sum.
 *
 * Two of the nine are channel-dependent names for the same underlying state: a
 * read receipt is "seen" on WhatsApp and "opened" everywhere else, and a hard
 * failure is a "bounce" on email and a "failure" on the rest. The slugs live
 * here, not only in the browser, because the server now both counts and filters
 * by them — `eventKind` in the report island renders the same nine.
 */
export const CAMPAIGN_EVENT_KINDS = [
  'delivered',
  'opened',
  'seen',
  'clicked',
  'unsubscribed',
  'sent',
  'bounced',
  'failed',
  'queued',
] as const;

export type CampaignEventKind = (typeof CAMPAIGN_EVENT_KINDS)[number];

/**
 * Whether this message carries an engagement event of `type`.
 *
 * Keyed on the denormalised `campaign_id` (plus tenant) rather than on
 * `message_id` alone, for two reasons: it is the shape
 * `message_events_tenant_campaign_type_idx` covers, and it is the same column
 * the campaign's own click/unsubscribe counters are rolled up from (see
 * `eventRollup` in campaign-crud). A tab and the KPI above it therefore cannot
 * disagree about who clicked.
 */
const hasEvent = (type: 'click' | 'unsubscribed', m: MessagesTable = messages) => sql`exists (
    select 1 from message_events e
    where e.tenant_id = ${m.tenantId}
      and e.campaign_id = ${m.campaignId}
      and e.message_id = ${m.id}
      and e.event_type = ${type}
  )`;

/**
 * A message's report tab, as SQL — the mirror of `eventKind` in the island.
 *
 * Spelled once and used by the page filter, the tab counts and the rate-card
 * series alike: the tabs disagreeing with the rows beneath them is the whole
 * failure this replaces, and two copies of this CASE would reintroduce it.
 *
 * `cancelled` sits with the hard failures rather than in the `else` because
 * that is where the Failed KPI already counts it (`messageCounters.failed` in
 * campaign-crud). Routed to Queued it would put one number in the card and a
 * different one in the tab beside it — the same disagreement this section
 * exists to remove, just waiting for the first cancelled send.
 *
 * `m` is a parameter so the keyset anchor below can reuse the definition
 * through a table alias: a second copy of the CASE for the anchor is how the
 * jump target and the page it opens would come to disagree.
 */
function eventKindExpr(channel: Channel, m: MessagesTable = messages) {
  const read = channel === 'whatsapp' ? 'seen' : 'opened';
  const hardFail = channel === 'email' ? 'bounced' : 'failed';
  return sql<CampaignEventKind>`case
    when ${hasEvent('unsubscribed', m)} then 'unsubscribed'
    when ${hasEvent('click', m)} then 'clicked'
    when ${m.status} = 'read' then ${read}::text
    when ${m.status} = 'delivered' then 'delivered'
    when ${m.status} in ('failed', 'expired', 'cancelled') then ${hardFail}::text
    when ${m.status} in ('sent', 'submitted') then 'sent'
    else 'queued'
  end`;
}

/**
 * The row's moment: delivered, else failed, else sent, else last touched.
 *
 * `updated_at` is NOT NULL, so this always resolves — which is what lets the
 * keyset predicate below be a plain row-value comparison, with no NULLS LAST
 * special case to get wrong on a page boundary.
 */
const messageAtOf = (m: MessagesTable = messages) =>
  sql`coalesce(${m.deliveredAt}, ${m.failedAt}, ${m.sentAt}, ${m.updatedAt})`;
const messageAt = messageAtOf(messages);

/**
 * The sort key rendered as microsecond-precision text.
 *
 * A JS Date holds milliseconds, so a cursor minted from the parsed value would
 * resume up to 999µs *before* the row it names and serve every row sharing that
 * millisecond twice. Round-tripping as text keeps the resume point exact, and
 * `::timestamptz` on the way back in keeps the predicate index-friendly. Same
 * reasoning as the subscriber roster's `cursorAt`.
 */
const messageCursorAt = sql<string>`to_char(${messageAt} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** Page cap plus one: callers over-fetch by one to learn if another page exists. */
const MAX_MESSAGE_ROWS = 101;

const clampRows = (n: number) => Math.min(Math.max(Math.floor(n), 1), MAX_MESSAGE_ROWS);

export interface CampaignMessagePageOptions {
  /**
   * Restrict to one event tab. Applied in SQL, not in the browser — a tab that
   * filters a page of ten can only ever describe those ten.
   */
  kind?: CampaignEventKind;
  limit?: number;
  /** Resume point: `at` is a `cursorAt` from the previous page, never a Date. */
  after?: { at: string; id: string };
  /**
   * Only for an explicit numbered jump to a page never walked to. Sequential
   * paging resumes from `after` and never needs it.
   */
  offset?: number;
}

/** A page row plus its resume key. */
export type CampaignRecipientEventRow = CampaignRecipientEvent & { cursorAt: string };

/** The campaign's channel, or null when this workspace does not own it. */
async function campaignChannel(tenantId: string, campaignId: string): Promise<Channel | null> {
  const [row] = await db
    .select({ channel: campaigns.channel })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  return row?.channel ?? null;
}

/** `recipient_id` is a soft `text` reference, so only cast what is really a uuid. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Attach subscriber display names to the page in hand.
 *
 * A second keyed read rather than a join, because `messages.recipient_id` is
 * `text` while `subscribers.id` is `uuid`: the join that used to sit inline
 * cast the uuid to text, which no index can serve, so labelling the rows
 * parallel-seq-scanned the whole million-row roster — 102ms and 47,793 buffers
 * per request. Ten primary-key lookups now.
 */
async function withRecipientNames(
  tenantId: string,
  rows: Array<Omit<CampaignRecipientEventRow, 'name'>>,
): Promise<CampaignRecipientEventRow[]> {
  const ids = [
    ...new Set(
      rows.map((r) => r.recipientId).filter((id): id is string => !!id && UUID_RE.test(id)),
    ),
  ];
  const named = ids.length
    ? await db
        .select({ id: subscribers.id, name: subscribers.name })
        .from(subscribers)
        .where(and(eq(subscribers.tenantId, tenantId), inArray(subscribers.id, ids)))
    : [];
  const byId = new Map(named.map((s) => [s.id, s.name]));
  return rows.map((r) => ({ ...r, name: (r.recipientId && byId.get(r.recipientId)) ?? null }));
}

/**
 * One keyset page of per-recipient message outcomes, newest first.
 *
 * Messages survive recipient deletion (`recipient_id` is a soft reference), so
 * the name may be null.
 *
 * No index on the sort expression, deliberately. There is none to be had
 * cheaply — the sort key is a four-column `coalesce` — and the scan it would
 * serve is already confined to one campaign by
 * `messages_tenant_campaign_status_idx`, so each page sorts that campaign's
 * rows and nothing else: 1,177 rows, 1,181 buffers, 4.0ms for the heaviest
 * campaign in the million-message workspace. That is O(campaign), not
 * O(page) — see the note on `offset` below for the ceiling it implies, which
 * `sendCampaign`'s MAX_AUDIENCE bounds for campaigns it creates but
 * `POST /v1/messages` (which takes an arbitrary `campaignId`) does not.
 */
export async function listCampaignMessagesPage(
  tenantId: string,
  campaignId: string,
  opts: CampaignMessagePageOptions = {},
): Promise<CampaignRecipientEventRow[]> {
  const channel = await campaignChannel(tenantId, campaignId);
  if (!channel) throw new NotFoundError('campaign not found');
  const kind = eventKindExpr(channel);
  const skip = Math.max(Math.floor(opts.offset ?? 0), 0);

  const conds = [eq(messages.tenantId, tenantId), eq(messages.campaignId, campaignId)];
  if (opts.kind) conds.push(sql`${kind} = ${opts.kind}`);
  if (opts.after) {
    // Row-value comparison, with the id breaking ties so a page boundary can
    // never repeat or skip a row.
    conds.push(
      sql`(${messageAt}, ${messages.id}) < (${opts.after.at}::timestamptz, ${opts.after.id}::uuid)`,
    );
  } else if (skip > 0) {
    /*
     * A numbered jump, expressed as the same keyset predicate rather than as
     * SQL OFFSET.
     *
     * OFFSET would make the database project every skipped row: the four
     * `exists` sub-selects in the select list below are evaluated *after* the
     * sort, so `offset 1100 limit 10` runs them 1,110 times instead of 10, and
     * unbounds the top-N heapsort into a full quicksort of everything skipped.
     * Measured on the 1,177-row campaign with a million `message_events`:
     * 6.4ms / 9,791 buffers with OFFSET, 1.4ms / 2,450 buffers this way.
     *
     * The anchor runs once as an InitPlan and selects only the sort key, so
     * the skipping happens over two columns and the expensive projection stays
     * bounded by `limit`. An anchor past the end yields NULL, which makes the
     * comparison NULL and returns an empty page — the right answer for a page
     * that does not exist.
     *
     * `skip - 1`, because the anchor is the last row of the *previous* page
     * and the predicate is strict: `offset skip` would name the first row the
     * caller asked for and then exclude it.
     */
    const a = alias(messages, ANCHOR);
    const anchorAt = messageAtOf(a);
    const anchorConds = [eq(a.tenantId, tenantId), eq(a.campaignId, campaignId)];
    if (opts.kind) anchorConds.push(sql`${eventKindExpr(channel, a)} = ${opts.kind}`);
    // The FROM clause names the real table beside the alias: interpolating the
    // aliased table renders the bare alias, which is what every *other*
    // reference to it wants and the only thing FROM cannot use.
    conds.push(sql`(${messageAt}, ${messages.id}) < (
      select ${anchorAt}, ${a.id}
      from ${messages} as ${sql.identifier(ANCHOR)}
      where ${and(...anchorConds)}
      order by ${anchorAt} desc, ${a.id} desc
      offset ${skip - 1} limit 1
    )`);
  }

  const rows = await db
    .select({
      id: messages.id,
      recipientId: messages.recipientId,
      address: messages.toAddress,
      channel: messages.channel,
      status: messages.status,
      kind,
      // Kept alongside `kind` rather than derived from it: an unsubscribed
      // recipient who also clicked has kind 'unsubscribed', and the table's
      // Clicked column still has to tick.
      clicked: sql<boolean>`${hasEvent('click')}`,
      unsubscribed: sql<boolean>`${hasEvent('unsubscribed')}`,
      at: sql<Date | null>`${messageAt}`,
      cursorAt: messageCursorAt,
    })
    .from(messages)
    .where(and(...conds))
    .orderBy(sql`${messageAt} desc`, sql`${messages.id} desc`)
    .limit(clampRows(opts.limit ?? 10));

  return withRecipientNames(tenantId, rows);
}

/** One point on a rate-card spark: cumulative counts through this bucket. */
export interface CampaignEventPoint {
  /** Last message moment in the bucket — the spark's hover label. */
  at: string;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
}

export interface CampaignMessageSummary {
  /** Messages in the campaign — the "All" tab. */
  total: number;
  /** Messages per report tab. Sums to `total`. */
  byKind: Record<CampaignEventKind, number>;
  /** The campaign's own progression, oldest first. */
  series: CampaignEventPoint[];
}

/**
 * Points on a rate-card spark. Twenty-four is more resolution than a 120px
 * sparkline can show and keeps the response a fixed size however many
 * recipients the campaign had.
 */
const SERIES_BUCKETS = 24;

interface SummaryRow extends Record<string, unknown> {
  bucket: number;
  kind: CampaignEventKind;
  n: number;
  at: string;
}

/**
 * Everything the report's event section needs that is not a row: the per-tab
 * counts and the rate-card series, from ONE grouped scan of the campaign's
 * messages.
 *
 * Both used to be computed in the browser from whatever slice of the campaign
 * had been fetched — 200 messages of 1,177 — so a funnel reading 1,177
 * delivered sat beside a Delivered tab reading 176. Counting server-side is
 * what makes the two describe the same set.
 *
 * One query, not two, because the kind and the time bucket are two groupings of
 * the same scan: `group by bucket, kind` answers both at once and returns at
 * most 24 x 9 aggregate rows. The running totals below are folded over those
 * aggregates, never over messages.
 *
 * `byKind` is a PARTITION of the campaign: `eventKindExpr` assigns each message
 * exactly one kind — the furthest stage it reached — so the nine buckets sum to
 * `total` and no message is counted twice. That is what makes the tab badges
 * add up, and it is also why a tab count is not a KPI count: the Delivered tab
 * on Perf campaign 12 reads 588 because the other 589 delivered messages were
 * also opened and are counted under Opened, while the KPI card above correctly
 * reads "Delivered 1,177". Both are right; neither names its denominator
 * (audit #28).
 *
 * The series re-widens that partition on the way out (a click implies an open
 * implies a delivery), so `series[].delivered` is the cumulative delivered
 * count as the send progressed — the same rollup the KPI cards apply to the
 * whole campaign.
 *
 * KNOWN DEFECT (audit #31): the re-widening below folds delivered/opened/seen/
 * clicked into `delivered` but NOT `unsubscribed`, while `messageCounters` in
 * campaign-crud — which feeds the card above the spark — counts an unsubscribed
 * message as delivered like any other. So a delivered message carrying an
 * unsubscribe event is in the card's numerator and not the spark's. It affects
 * 6 of 1,029 campaigns; the largest gap on screen is a card reading 89.36% over
 * a spark ending at 82.98%.
 */
export async function campaignMessageSummary(
  tenantId: string,
  campaignId: string,
): Promise<CampaignMessageSummary> {
  const channel = await campaignChannel(tenantId, campaignId);
  if (!channel) throw new NotFoundError('campaign not found');

  const { rows } = await db.execute<SummaryRow>(sql`
    with kinded as (
      select ${messageAt} as at, ${eventKindExpr(channel)} as kind
      from ${messages}
      where ${messages.tenantId} = ${tenantId}::uuid
        and ${messages.campaignId} = ${campaignId}::uuid
    ), bucketed as (
      select
        kind,
        at,
        width_bucket(
          extract(epoch from at),
          min(extract(epoch from at)) over (),
          -- Nudged past the last message so it lands in the final bucket
          -- rather than one beyond it, and so a campaign whose messages share
          -- a single instant is a legal one-bucket range instead of the
          -- "lower bound equals upper bound" error.
          max(extract(epoch from at)) over () + 1e-6,
          ${SERIES_BUCKETS}
        ) as bucket
      from kinded
    )
    select
      bucket,
      kind,
      count(*)::int as n,
      to_char(max(at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
    from bucketed
    group by bucket, kind
    order by bucket
  `);

  const byKind = Object.fromEntries(CAMPAIGN_EVENT_KINDS.map((k) => [k, 0])) as Record<
    CampaignEventKind,
    number
  >;
  // Per bucket, then cumulative — the spark plots a campaign's progress, so
  // every point counts everything up to it.
  const buckets = new Map<
    number,
    { at: string; delivered: number; opened: number; clicked: number; unsubscribed: number }
  >();
  for (const row of rows) {
    const n = Number(row.n);
    byKind[row.kind] = (byKind[row.kind] ?? 0) + n;
    const b = buckets.get(row.bucket) ?? {
      at: row.at,
      delivered: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0,
    };
    // Furthest stage wins in `kind`, so a click implies an open implies a
    // delivery — the same rollup the KPI cards apply to the whole campaign.
    if (
      row.kind === 'delivered' ||
      row.kind === 'opened' ||
      row.kind === 'seen' ||
      row.kind === 'clicked'
    ) {
      b.delivered += n;
    }
    if (row.kind === 'opened' || row.kind === 'seen' || row.kind === 'clicked') b.opened += n;
    if (row.kind === 'clicked') b.clicked += n;
    if (row.kind === 'unsubscribed') b.unsubscribed += n;
    if (row.at > b.at) b.at = row.at;
    buckets.set(row.bucket, b);
  }

  const series: CampaignEventPoint[] = [];
  const running = { delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 };
  for (const bucket of [...buckets.keys()].sort((a, b) => a - b)) {
    const b = buckets.get(bucket)!;
    running.delivered += b.delivered;
    running.opened += b.opened;
    running.clicked += b.clicked;
    running.unsubscribed += b.unsubscribed;
    series.push({ at: b.at, ...running });
  }

  const total = CAMPAIGN_EVENT_KINDS.reduce((sum, k) => sum + byKind[k], 0);
  return { total, byKind, series };
}

/**
 * Statuses a campaign may be sent from. "sending" and "sent" are absent by
 * design: claiming the row is what makes a double-click (or a retried request)
 * unable to send the same campaign twice.
 */
const SENDABLE_STATUSES = ['draft', 'scheduled', 'paused'] as const;

export interface SendCampaignInput {
  tenantId: string;
  /**
   * Send an existing draft in place. Without it a new campaign row is created,
   * which is what the fire-and-forget `/v1/campaigns/send` API does.
   */
  campaignId?: string;
  name?: string;
  channel: Channel;
  selector: AudienceSelector;
  templateId?: string;
  content?: Record<string, unknown>;
  scheduledAt?: Date | null;
}

export interface SendCampaignResult {
  campaignId: string;
  audience: number;
  queued: number;
  truncated: boolean;
}

/**
 * Move an existing campaign into "sending" — but only from a status it is
 * legal to send from. The status predicate lives in the UPDATE itself, so two
 * concurrent sends race on a single atomic write and exactly one wins; the
 * loser gets no row back and is rejected. Without this, double-clicking "Send"
 * would deliver the campaign to every recipient twice.
 */
async function claimForSending(
  tenantId: string,
  campaignId: string,
  startedAt: Date | null,
): Promise<Campaign> {
  const claimed = await db
    .update(campaigns)
    .set({ status: 'sending', startedAt, updatedAt: new Date() })
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.tenantId, tenantId),
        inArray(campaigns.status, [...SENDABLE_STATUSES]),
      ),
    )
    .returning();

  if (claimed[0]) return claimed[0];

  // Nothing claimed: separate "not yours / gone" from "already in flight".
  const existing = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  if (!existing[0]) throw new NotFoundError('campaign not found');
  throw new ConflictError(`campaign is already ${existing[0].status}`);
}

/**
 * Resolve an audience and submit one message per recipient through the messaging
 * service (transactional outbox → dispatch). Personalizes from a template when
 * `templateId` is given. This is the product → messaging hand-off.
 *
 * Pass `campaignId` to send an existing draft in place; otherwise a new campaign
 * row is created. Sending a draft claims it first, so a campaign can never be
 * sent twice.
 *
 * NOTE: v1 submits sequentially and caps the audience at MAX_AUDIENCE. Large
 * campaigns should fan out via a batched scheduler job — see the messaging
 * scheduler for the pattern.
 */
export async function sendCampaign(input: SendCampaignInput): Promise<SendCampaignResult> {
  const scheduled = input.scheduledAt != null && input.scheduledAt.getTime() > Date.now();
  const now = new Date();

  const template = input.templateId ? await getTemplate(input.tenantId, input.templateId) : null;

  // WhatsApp marketing broadcasts must send through a Meta-approved template.
  // Gate before claiming so a rejected send leaves the draft untouched (not
  // stranded in "sending").
  if (input.channel === 'whatsapp' && template && template.approvalStatus !== 'approved') {
    throw new ConflictError(
      'WhatsApp template must be approved by Meta before this campaign can send',
    );
  }

  // Claim before resolving the audience: an in-flight campaign must be rejected
  // even while a concurrent send is still building its recipient list.
  const camp = input.campaignId
    ? await claimForSending(input.tenantId, input.campaignId, scheduled ? null : now)
    : (
        await db
          .insert(campaigns)
          .values({
            tenantId: input.tenantId,
            name: input.name ?? 'campaign',
            status: scheduled ? 'scheduled' : 'sending',
            channel: input.channel,
            listId: input.selector.listId ?? null,
            segmentId: input.selector.segmentId ?? null,
            templateId: input.templateId ?? null,
            content: input.content ?? {},
            scheduledAt: input.scheduledAt ?? null,
            startedAt: scheduled ? null : now,
          })
          .returning()
      )[0]!;

  // A list whose membership has gone bad is refused before anything else —
  // there is no point resolving or pricing an audience we will not mail.
  if (input.selector.listId) {
    try {
      await assertListSendable(input.tenantId, input.selector.listId);
    } catch (err) {
      await db
        .update(campaigns)
        .set({ status: 'draft', startedAt: null, updatedAt: new Date() })
        .where(eq(campaigns.id, camp.id));
      throw err;
    }
  }

  let resolved = await resolveAudience(input.tenantId, input.selector, input.channel, {
    limit: MAX_AUDIENCE,
  });
  const truncated = resolved.length >= MAX_AUDIENCE;

  // Billing gate (no-op unless BILLING_ENFORCEMENT=1): hold the estimated
  // campaign cost before any message row exists. An empty wallet rejects the
  // whole send here and puts the draft back — nothing is half-sent.
  if (resolved.length > 0) {
    try {
      // Trial allowance is checked for scheduled sends too. The scheduler
      // activates due messages one at a time across every tenant, so gating
      // there would half-activate a campaign or leave rows stuck as
      // `scheduled` forever; refusing at schedule time gives the user an
      // actionable error instead. Usage only ever grows, so what does not fit
      // now will not fit later — the residual gap is a campaign scheduled
      // within budget whose budget is then spent by other sends before it
      // fires, which goes out over-allowance.
      //
      // Unlike the wallet reservation, this is not behind
      // BILLING_ENFORCEMENT: a workspace that never paid stays capped at what
      // /signup advertises even while the wallet is switched off.
      // Voice spends seconds, not calls: size the request from the script this
      // campaign will actually read (template text when one is attached,
      // otherwise the campaign's own content) times the audience.
      const requested =
        input.channel === 'voice'
          ? estimateVoiceSeconds({
              // The campaign's own content wins; a template supplies the
              // script when the campaign only references it.
              ...(template?.components ?? {}),
              ...(input.content ?? {}),
              text: (input.content?.text as string | undefined) ?? template?.text ?? undefined,
            }) * resolved.length
          : resolved.length;
      await assertTrialAllowance(input.tenantId, input.channel, requested);
      // Refuse to start a send from a workspace whose recent list quality is
      // bad enough to endanger the sending domain — for them and for every
      // other workspace on the shared account.
      await assertDeliverabilityOk(input.tenantId, input.channel);
      if (!scheduled) {
        await reserveCampaignCredits(input.tenantId, camp.id, input.channel, resolved.length);
      }
      // Last, and only for trials: put every surviving recipient to Infobip's
      // paid mailbox validation. Deliberately after the allowance and wallet
      // gates so an audience we would have refused is never paid to validate.
      const screen = await screenTrialAudience(input.tenantId, input.channel, resolved);
      resolved = screen.recipients;
    } catch (err) {
      await db
        .update(campaigns)
        .set({ status: 'draft', startedAt: null, updatedAt: new Date() })
        .where(eq(campaigns.id, camp.id));
      throw err;
    }
  }

  let queued = 0;
  for (const sub of resolved) {
    const to = addressForChannel(sub, input.channel);
    if (!to) continue;
    // The campaign id rides along so {{webview}} can name this send.
    const content = resolveMessageContent(template, sub, input.content, input.channel, {
      campaignId: camp.id,
    });
    await submitMessage({
      tenantId: input.tenantId,
      channel: input.channel,
      to,
      content,
      recipientId: sub.id,
      campaignId: camp.id,
      scheduledAt: input.scheduledAt ?? null,
    });
    queued += 1;
  }

  // Immediate sends stay `sending` until every message leaves the dispatch
  // queue. Empty audience has nothing to wait for.
  if (scheduled) {
    await db
      .update(campaigns)
      .set({ status: 'scheduled', completedAt: null, updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
  } else if (queued === 0) {
    await db
      .update(campaigns)
      .set({ status: 'sent', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
  } else {
    await db
      .update(campaigns)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
  }

  log.info(
    { campaignId: camp.id, channel: input.channel, audience: resolved.length, queued },
    'campaign submitted',
  );
  return { campaignId: camp.id, audience: resolved.length, queued, truncated };
}

/**
 * Send a saved draft using the audience, template, and schedule stored on it.
 * This is what the app's "Send now" button hits — the draft the user has been
 * editing becomes the campaign that sends, rather than a fresh copy of it.
 *
 * `overrideScheduledAt` lets the caller send a scheduled draft immediately
 * (pass null) without first rewriting the stored schedule.
 */
export async function sendCampaignDraft(
  tenantId: string,
  campaignId: string,
  overrideScheduledAt?: Date | null,
): Promise<SendCampaignResult> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  const draft = rows[0];
  if (!draft) throw new NotFoundError('campaign not found');

  const content = draft.content as Record<string, unknown>;
  if (!draft.templateId && Object.keys(content).length === 0) {
    throw new ConflictError('campaign has no template or content to send');
  }

  return sendCampaign({
    tenantId,
    campaignId: draft.id,
    name: draft.name,
    channel: draft.channel,
    selector: {
      listId: draft.listId ?? undefined,
      segmentId: draft.segmentId ?? undefined,
    },
    templateId: draft.templateId ?? undefined,
    content,
    scheduledAt: overrideScheduledAt !== undefined ? overrideScheduledAt : draft.scheduledAt,
  });
}
