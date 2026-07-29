/**
 * Dev seeder — emulates six months of real Maildrill usage for the
 * allowlisted login tenant.
 *
 * What it does, in order:
 *   1. Deletes every tenant except the target (cascades wipe everything they
 *      own) and prunes users left without a membership. The `dev-key` tenant
 *      is safe to drop: API-key auth recreates it on demand
 *      (authz ensureTenantByName).
 *   2. Clears the target tenant's product data.
 *   3. Seeds 26 weeks of history: 5–10 new subscribers per week across five
 *      lists, one campaign every week (email / SMS / WhatsApp / voice
 *      rotation), each with per-recipient messages AND provider event
 *      timelines (queued → sent → delivered → read/failed, plus clicks and
 *      unsubscribes) so reports, recipient events, and rates are live.
 *      Plus one sending, one scheduled, and one draft campaign.
 *   4. Mirrors every provider event into PostHog exactly as the production
 *      Infobip → PostHog Hog function would emit it (`message_delivery_report`
 *      / `message_seen_report` / `message_voice_report`, batched to
 *      /batch/ with historical_migration), so the HogQL-backed stats paths
 *      (`dailyActivityFromPostHog`, `byChannelFromPostHog`, the campaign
 *      delivery poller) see the same six months a real tenant would produce.
 *
 * Determinism: the RNG is seeded and the time anchor is the Monday 00:00 of
 * the current ISO week, and message/provider/event ids are content-hashes —
 * so a re-run in the same week emits byte-identical rows and PostHog events
 * (deduplicated by per-event `uuid`). Re-running in a LATER week shifts the
 * timeline; PostHog then keeps the old events too, but every stats query
 * counts DISTINCT message ids (which do not change), so aggregate numbers
 * stay correct.
 *
 * Run (workers/ or repo root; env comes from the root .env):
 *   pnpm db:seed    reset (steps 1-2) then seed fresh data — safe to re-run,
 *                   it can never duplicate in Postgres
 *   pnpm db:reset   steps 1-2 only: wipe to an empty workspace, seed nothing
 *   --no-posthog    skip the PostHog mirror (step 4)
 */
import { createHash } from 'node:crypto';
import { eq, inArray, ne } from 'drizzle-orm';
import {
  campaigns,
  customFieldDefs,
  db,
  listMembers,
  lists,
  magicLinkTokens,
  memberships,
  messageAttempts,
  messageEvents,
  messages,
  outboxEvents,
  segments,
  subscriberTags,
  subscribers,
  tags,
  templates,
  tenants,
  usageRecords,
  users,
  webhookEvents,
} from './index';

const TARGET_TENANT_NAME = 'hello@laravel42.com';
const WINDOW_WEEKS = 26;

/* --------------------------- tiny seeded RNG ---------------------------- */
let rngState = 42;
const rand = (): number => {
  rngState = (rngState * 1103515245 + 12345) % 2 ** 31;
  return rngState / 2 ** 31;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number): boolean => rand() < p;

/* Time anchor: Monday 00:00 of the current ISO week. Deriving everything
   from a week-stable anchor (not Date.now()) keeps re-runs within the same
   week byte-identical, which is what lets PostHog dedupe them. */
const anchorDate = new Date();
anchorDate.setHours(0, 0, 0, 0);
anchorDate.setDate(anchorDate.getDate() - ((anchorDate.getDay() + 6) % 7));
const NOW = anchorDate.getTime();
const days = (n: number) => new Date(NOW - n * 86_400_000);
const minutesAfter = (d: Date, min: number, jitter = 0) =>
  new Date(d.getTime() + (min + rand() * jitter) * 60_000);

/* Content-addressed ids: stable across runs so PostHog's DISTINCT
   message-id counts can never inflate when the seeder runs again. */
const detUuid = (key: string): string => {
  const h = createHash('sha256').update(key).digest();
  h[6] = (h[6]! & 0x0f) | 0x40;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const detId = (key: string): string => createHash('sha256').update(key).digest('hex').slice(0, 20);

/* ------------------------------ fixtures -------------------------------- */
const FIRST = [
  'Emma',
  'Noah',
  'Sophia',
  'Lucas',
  'Chloe',
  'Priya',
  'Sara',
  'Liam',
  'Mia',
  'Omar',
  'Ana',
  'Jonas',
  'Yuki',
  'Marco',
  'Lena',
  'Ravi',
  'Nora',
  'Felix',
  'Ines',
  'Tom',
  'Aisha',
  'Pablo',
  'Greta',
  'Ken',
  'Zoe',
  'Ali',
  'Maja',
  'Dan',
  'Rita',
  'Sven',
  'Amara',
  'Leo',
  'Julia',
  'Nico',
  'Faye',
  'Igor',
  'Carla',
  'Hugo',
  'Iris',
  'Max',
  'Tara',
  'Elio',
  'Vera',
  'Sam',
  'Lucia',
  'Otto',
  'Nadia',
  'Bruno',
];
const LAST = [
  'Bennett',
  'Tanaka',
  'Moreau',
  'Lindqvist',
  'Rossi',
  'Costa',
  'Okafor',
  'Kowalski',
  'Novak',
  'Haddad',
  'Silva',
  'Berg',
  'Sato',
  'Ricci',
  'Vogel',
  'Iyer',
  'Dahl',
  'Weber',
  'Costa',
  'Hale',
  'Khan',
  'Vega',
  'Lang',
  'Mori',
  'Petit',
  'Nasser',
  'Lund',
  'Reyes',
  'Klein',
  'Aas',
  'Diallo',
  'Marsh',
  'Bauer',
  'Greco',
  'Wynn',
  'Sokolov',
  'Bruni',
  'Faber',
  'Steen',
  'Holt',
  'Rao',
  'Conti',
  'Nilsen',
  'Pratt',
  'Serra',
  'Frank',
  'Karim',
  'Alves',
];
const DOMAINS = ['gmail.com', 'outlook.com', 'acme.io', 'novalabs.co', 'fastmail.com', 'proton.me'];
const COMPANIES = ['Acme Inc.', 'Nova Labs', 'Northwind', 'Helios', 'Brightside', 'Kite & Co'];
const CITIES = ['Berlin', 'Lisbon', 'Austin', 'Tokyo', 'Toronto', 'Milan', 'Oslo'];
const PLANS = ['free', 'starter', 'pro', 'pro', 'starter', 'free'];

/* -------------- PostHog mirror (Infobip → PostHog emulation) ------------- */
/* Events are shaped exactly like the production Hog webhook function output
   (docs/posthog-infobip.hog): same event names, same properties, same
   $insert_id scheme, tenancy via callbackData-derived tenant_id / channel /
   maildrill_message_id. Sent with historical_migration so six months of
   backdated timestamps ingest correctly. */
const PH_INGEST_URL = 'https://us.i.posthog.com/batch/';
const PH_BATCH_SIZE = 500;

type Channel = 'email' | 'sms' | 'whatsapp' | 'voice';
type PhEvent = {
  event: string;
  uuid: string;
  timestamp: string;
  distinct_id: string;
  properties: Record<string, unknown>;
};
const phEvents: PhEvent[] = [];

const PRICE: Record<Channel, number> = {
  email: 0.00052,
  sms: 0.0392,
  whatsapp: 0.0141,
  voice: 0.011,
};
const STATUS_NAME: Record<string, string> = {
  PENDING: 'PENDING_ACCEPTED',
  DELIVERED: 'DELIVERED_TO_HANDSET',
  UNDELIVERABLE: 'UNDELIVERABLE_REJECTED_OPERATOR',
};

function phReport(opts: {
  kind: 'delivery' | 'voice' | 'engagement';
  channel: Channel;
  tenantId: string;
  providerMessageId: string;
  maildrillMessageId: string;
  bulkId: string;
  to: string;
  at: Date;
  /** Infobip status.groupName; empty for engagement (seen/click) payloads. */
  statusGroup?: 'PENDING' | 'DELIVERED' | 'UNDELIVERABLE';
  raw?: Record<string, unknown>;
}): void {
  const eventName =
    opts.kind === 'voice'
      ? 'message_voice_report'
      : opts.kind === 'engagement'
        ? 'message_seen_report'
        : 'message_delivery_report';
  const statusGroup = opts.statusGroup ?? '';
  const statusName = STATUS_NAME[statusGroup] ?? '';
  const doneAt = opts.at.toISOString();
  const insertId = `infobip:${opts.providerMessageId}:${statusName}:${doneAt}`;
  const failed = statusGroup === 'UNDELIVERABLE';

  phEvents.push({
    event: eventName,
    uuid: detUuid(`ph:${insertId}`),
    timestamp: doneAt,
    distinct_id: opts.to || opts.providerMessageId,
    properties: {
      $insert_id: insertId,
      $lib: 'posthog-webhook',
      provider: 'infobip',
      kind: opts.kind,
      message_id: opts.providerMessageId,
      bulk_id: opts.bulkId,
      status_group: statusGroup,
      status_name: statusName,
      to: opts.to,
      tenant_id: opts.tenantId,
      channel: opts.channel,
      maildrill_message_id: opts.maildrillMessageId,
      error_id: failed ? 51 : 0,
      error_name: failed ? 'EC_DESTINATION_UNAVAILABLE' : 'NO_ERROR',
      error_group: failed ? 'PERMANENT' : 'OK',
      error_permanent: failed,
      price_per_message: PRICE[opts.channel],
      price_currency: 'EUR',
      raw: { messageId: opts.providerMessageId, to: opts.to, doneAt, ...opts.raw },
    },
  });
}

async function flushPostHog(): Promise<void> {
  /* Deliberately NOT PUBLIC_POSTHOG_PROJECT_TOKEN: that token belongs to the
     marketing-site analytics project, not the Maildrill project the workers
     query (POSTHOG_PROJECT_ID) — ingesting there would pollute web analytics
     and never surface in HogQL stats. Copy the Maildrill project's API key
     from PostHog → Settings → Project API key into POSTHOG_PROJECT_API_KEY. */
  const token = (process.env.POSTHOG_PROJECT_API_KEY ?? '').trim();
  if (process.argv.includes('--no-posthog')) {
    console.log('posthog: skipped (--no-posthog)');
    return;
  }
  if (!token.startsWith('phc_')) {
    console.log(
      'posthog: skipped — set POSTHOG_PROJECT_API_KEY to the Maildrill project API key ' +
        '(PostHog → project settings; must match POSTHOG_PROJECT_ID)',
    );
    return;
  }
  for (let i = 0; i < phEvents.length; i += PH_BATCH_SIZE) {
    const batch = phEvents.slice(i, i + PH_BATCH_SIZE);
    const res = await fetch(PH_INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: token, historical_migration: true, batch }),
    });
    if (!res.ok) {
      throw new Error(
        `posthog batch ${i / PH_BATCH_SIZE + 1} failed: ${res.status} ${await res.text()}`,
      );
    }
  }
  const batches = Math.ceil(phEvents.length / PH_BATCH_SIZE);
  console.log(
    `posthog: sent ${phEvents.length} events in ${batches} batches (historical_migration)`,
  );
}

async function main(): Promise<void> {
  /* ---- resolve target tenant ------------------------------------------- */
  const target = (
    await db.select().from(tenants).where(eq(tenants.name, TARGET_TENANT_NAME)).limit(1)
  )[0];
  if (!target) throw new Error(`target tenant "${TARGET_TENANT_NAME}" not found`);
  const tid = target.id;
  console.log(`target tenant: ${target.name} (${tid})`);

  /* ---- 1. drop every other tenant + orphaned users --------------------- */
  const all = await db.select().from(tenants);
  const junk = all.filter((t) => t.id !== tid);
  if (junk.length > 0) {
    await db.delete(tenants).where(
      inArray(
        tenants.id,
        junk.map((t) => t.id),
      ),
    );
    console.log(`deleted tenants: ${junk.map((t) => t.name).join(', ')}`);
  }
  const memberIds = await db.select({ id: memberships.userId }).from(memberships);
  const keep = new Set(memberIds.map((m) => m.id));
  const allUsers = await db.select().from(users);
  const orphanUsers = allUsers.filter((u) => !keep.has(u.id));
  if (orphanUsers.length > 0) {
    await db.delete(users).where(
      inArray(
        users.id,
        orphanUsers.map((u) => u.id),
      ),
    );
    console.log(`deleted orphaned users: ${orphanUsers.map((u) => u.email).join(', ')}`);
  }
  await db.delete(magicLinkTokens).where(ne(magicLinkTokens.email, TARGET_TENANT_NAME));

  /* ---- 2. clear the target tenant's product data ----------------------- */
  // Order respects FKs that don't cascade from these deletes.
  for (const table of [
    messageEvents,
    messageAttempts,
    outboxEvents,
    webhookEvents,
    usageRecords,
    messages,
    campaigns,
    subscriberTags,
    listMembers,
    segments,
    lists,
    tags,
    templates,
    customFieldDefs,
    subscribers,
  ] as const) {
    await db.delete(table).where(eq(table.tenantId, tid));
  }
  console.log('cleared target tenant data');

  if (process.argv.includes('--reset-only')) {
    console.log('reset only — seeding skipped');
    process.exit(0);
  }

  /* ---- 3a. custom fields, tags, subscribers ---------------------------- */
  await db.insert(customFieldDefs).values([
    { tenantId: tid, key: 'plan', label: 'Plan', type: 'text' },
    { tenantId: tid, key: 'company', label: 'Company', type: 'text' },
    { tenantId: tid, key: 'city', label: 'City', type: 'text' },
  ]);

  const tagRows = await db
    .insert(tags)
    .values([
      { tenantId: tid, name: 'VIP', color: '#7c3aed' },
      { tenantId: tid, name: 'Newsletter', color: '#4f46e5' },
      { tenantId: tid, name: 'Trial', color: '#0891b2' },
      { tenantId: tid, name: 'Churn risk', color: '#d97706' },
    ])
    .returning();

  /* A ~40-person base that signed up before the window (so week-one
     campaigns already have an audience), then 5-10 new sign-ups every week
     for 26 weeks — the growth rate the subscriber trend charts. */
  const cohortDays: number[] = [];
  for (let i = 0; i < 40; i += 1) {
    cohortDays.push(WINDOW_WEEKS * 7 + 3 + Math.floor(rand() * 110));
  }
  for (let week = WINDOW_WEEKS - 1; week >= 0; week -= 1) {
    const size = 5 + Math.floor(rand() * 6); // 5..10 per week
    for (let k = 0; k < size; k += 1) {
      cohortDays.push(Math.max(0, week * 7 - Math.floor(rand() * 7)));
    }
  }
  const subValues = cohortDays.map((ago, i) => {
    // Shift the surname cycle on every lap through FIRST so no full-name pair
    // ever repeats across the generated subscribers.
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 5 + Math.floor(i / FIRST.length)) % LAST.length]!;
    const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}${i}@${pick(DOMAINS)}`;
    return {
      tenantId: tid,
      email,
      name: `${first} ${last}`,
      phone: chance(0.85) ? `+1415555${String(1000 + i).padStart(4, '0')}` : null,
      status: (chance(0.025) ? 'bounced' : 'active') as 'active' | 'unsubscribed' | 'bounced',
      attributes: { plan: pick(PLANS), company: pick(COMPANIES), city: pick(CITIES) },
      createdAt: days(ago),
    };
  });
  const subRows = await db.insert(subscribers).values(subValues).returning();
  console.log(`seeded ${subRows.length} subscribers over ${WINDOW_WEEKS} weeks`);

  const tagValues: (typeof subscriberTags.$inferInsert)[] = [];
  for (const s of subRows) {
    if (chance(0.55)) {
      tagValues.push({ tagId: pick(tagRows).id, subscriberId: s.id, tenantId: tid });
    }
  }
  if (tagValues.length) await db.insert(subscriberTags).values(tagValues);

  /* ---- 3b. five lists + memberships ------------------------------------ */
  const listRows = await db
    .insert(lists)
    .values([
      {
        tenantId: tid,
        name: 'Newsletter',
        description: 'Everyone who opted into the monthly digest',
        color: '#4f46e5',
        tags: ['digest'],
        notes: 'Grown from the website footer form.',
      },
      {
        tenantId: tid,
        name: 'Customers',
        description: 'Paying workspaces, all plans',
        color: '#16a34a',
        tags: ['billing'],
        notes: null,
      },
      {
        tenantId: tid,
        name: 'Beta testers',
        description: 'Early access to new channels',
        color: '#d97706',
        tags: ['product'],
        notes: 'Recruited from the onboarding webinar.',
      },
      {
        tenantId: tid,
        name: 'VIP customers',
        description: 'Top accounts — hand-picked, high touch',
        color: '#7c3aed',
        tags: ['vip'],
        notes: null,
      },
      {
        tenantId: tid,
        name: 'Product updates',
        description: 'Opted into launch and changelog announcements',
        color: '#0891b2',
        tags: ['product', 'digest'],
        notes: null,
      },
    ])
    .returning();
  const [newsletter, customers, beta, vip, productUpdates] = listRows as [
    (typeof listRows)[0],
    (typeof listRows)[0],
    (typeof listRows)[0],
    (typeof listRows)[0],
    (typeof listRows)[0],
  ];

  type Sub = (typeof subRows)[0];
  const memberOf = new Map<string, { sub: Sub; addedAt: Date }[]>();
  const memberValues: (typeof listMembers.$inferInsert)[] = [];
  const join = (listId: string, sub: Sub, addedAt: Date) => {
    memberValues.push({ listId, subscriberId: sub.id, tenantId: tid, addedAt });
    const bucket = memberOf.get(listId) ?? [];
    bucket.push({ sub, addedAt });
    memberOf.set(listId, bucket);
  };
  for (const s of subRows) {
    if (chance(0.92)) join(newsletter.id, s, s.createdAt);
    const plan = (s.attributes as { plan?: string }).plan;
    if (plan === 'pro' || plan === 'starter') {
      join(customers.id, s, minutesAfter(s.createdAt, 60, 10000));
    }
    if (chance(0.22)) join(beta.id, s, minutesAfter(s.createdAt, 60, 20000));
    if (plan === 'pro' && chance(0.4)) join(vip.id, s, minutesAfter(s.createdAt, 120, 30000));
    if (chance(0.45)) join(productUpdates.id, s, minutesAfter(s.createdAt, 30, 15000));
  }
  for (let i = 0; i < memberValues.length; i += 200) {
    await db.insert(listMembers).values(memberValues.slice(i, i + 200));
  }
  console.log(`seeded ${memberValues.length} list memberships across ${listRows.length} lists`);

  await db.insert(segments).values([
    {
      tenantId: tid,
      name: 'Pro plan',
      description: 'Subscribers on the pro plan',
      matchType: 'all',
      rules: [{ field: 'attributes.plan', op: 'eq', value: 'pro' }],
    },
    {
      tenantId: tid,
      name: 'Has phone',
      description: 'Reachable on SMS/WhatsApp/voice',
      matchType: 'all',
      rules: [{ field: 'phone', op: 'exists' }],
    },
  ]);

  /* ---- 3c. templates ---------------------------------------------------- */
  const tplRows = await db
    .insert(templates)
    .values([
      {
        tenantId: tid,
        name: 'Monthly digest',
        channel: 'email',
        subject: '{{name}}, your monthly digest is here',
        preheader: 'Product news, tips, and what shipped this month.',
        html: '<h1>Hi {{name}} 👋</h1><p>Here is everything that shipped this month for {{attributes.company}}.</p>',
        text: 'Hi {{name}} — here is everything that shipped this month.',
        category: 'newsletter',
        favorite: true,
      },
      {
        tenantId: tid,
        name: 'Flash sale',
        channel: 'sms',
        text: '{{name}}, 24h flash sale: 20% off every plan. Reply STOP to opt out.',
        category: 'promo',
      },
      {
        tenantId: tid,
        name: 'order_update',
        channel: 'whatsapp',
        text: 'Hi {{1}}, your order is on its way. Track it any time.',
        language: 'en',
        approvalStatus: 'approved',
        providerTemplateId: 'order_update_en_1',
        components: {
          body: { text: 'Hi {{1}}, your order is on its way. Track it any time.' },
          placeholders: ['name'],
        },
      },
      {
        tenantId: tid,
        name: 'Renewal reminder call',
        channel: 'voice',
        text: 'Hello {{name}}. Your Maildrill plan renews tomorrow. No action is needed.',
        builderDoc: {
          voice: { name: 'Joanna', gender: 'female', sayLanguage: 'en' },
          speechRate: 1,
        },
        category: 'billing',
      },
    ])
    .returning();
  const [emailTpl, smsTpl, waTpl, voiceTpl] = tplRows as [
    (typeof tplRows)[0],
    (typeof tplRows)[0],
    (typeof tplRows)[0],
    (typeof tplRows)[0],
  ];

  /* ---- 3d. campaigns + messages + provider events ---------------------- */
  let eventCount = 0;
  type Outcome = 'delivered' | 'read' | 'failed' | 'sent' | 'queued';

  /** Subscribers who unsubscribed via a campaign; status flips after seeding. */
  const unsubbedSubIds = new Map<string, Date>();

  const seedCampaign = async (opts: {
    name: string;
    channel: Channel;
    listId: string;
    templateId: string;
    content: Record<string, unknown>;
    sentAt: Date;
    recipients: Sub[];
    outcome: (i: number) => Outcome;
    /** Share of opened messages that also click (email/WA only). */
    clickOfRead?: number;
    /** Share of delivered/read recipients that unsubscribe off this send. */
    unsubOfDelivered?: number;
    /** URLs clicks land on; recorded in the click event payload. */
    clickUrls?: string[];
    status?: string;
    scheduledAt?: Date | null;
  }) => {
    const started = opts.sentAt;
    const status = opts.status ?? 'sent';
    const bulkId = `blk-${detId(`bulk:${opts.name}`)}`;
    const camp = (
      await db
        .insert(campaigns)
        .values({
          tenantId: tid,
          name: opts.name,
          status,
          channel: opts.channel,
          listId: opts.listId,
          templateId: opts.templateId,
          content: opts.content,
          scheduledAt: opts.scheduledAt ?? null,
          startedAt: status === 'draft' || status === 'scheduled' ? null : started,
          completedAt: status === 'sent' ? minutesAfter(started, 30, 20) : null,
          createdAt: minutesAfter(started, -120, 0),
          updatedAt: minutesAfter(started, 30, 20),
        })
        .returning()
    )[0]!;

    type Meta = {
      outcome: Outcome;
      to: string;
      subId: string;
      sentAt: Date;
      deliveredAt: Date;
      readAt: Date;
      failedAt: Date;
      clickedAt: Date | null;
      clickUrl: string | null;
      unsubscribedAt: Date | null;
      messageId: string;
      providerMessageId: string;
    };
    const msgRows: (typeof messages.$inferInsert)[] = [];
    const metas: Meta[] = [];

    opts.recipients.forEach((sub, i) => {
      const to = opts.channel === 'email' ? sub.email : (sub.phone ?? sub.email);
      const outcome = opts.outcome(i);
      const queuedAt = minutesAfter(started, 0, 2);
      const sentAt = minutesAfter(queuedAt, 1, 3);
      const deliveredAt = minutesAfter(sentAt, 1, 8);
      const readAt = minutesAfter(deliveredAt, 10, 600);
      const failedAt = minutesAfter(sentAt, 1, 4);
      const clicked = outcome === 'read' && chance(opts.clickOfRead ?? 0);
      const clickedAt = clicked ? minutesAfter(readAt, 4, 240) : null;
      const unsubscribed =
        (outcome === 'read' || outcome === 'delivered') && chance(opts.unsubOfDelivered ?? 0);
      const unsubscribedAt = unsubscribed
        ? minutesAfter(outcome === 'read' ? readAt : deliveredAt, 8, 600)
        : null;
      const messageId = detUuid(`msg:${opts.name}:${sub.email}`);
      metas.push({
        outcome,
        to,
        subId: sub.id,
        sentAt,
        deliveredAt,
        readAt,
        failedAt,
        clickedAt,
        clickUrl: clicked ? pick(opts.clickUrls ?? ['https://maildrill.app']) : null,
        unsubscribedAt,
        messageId,
        providerMessageId: detId(`ib:${opts.name}:${sub.email}`),
      });

      const base = {
        id: messageId,
        tenantId: tid,
        campaignId: camp.id,
        recipientId: sub.id,
        toAddress: to,
        content: opts.content,
        channel: opts.channel,
        provider: 'infobip',
        providerMessageId: metas[metas.length - 1]!.providerMessageId,
        createdAt: queuedAt,
        queuedAt,
      };
      msgRows.push(
        outcome === 'queued'
          ? { ...base, status: 'queued', providerMessageId: null, updatedAt: queuedAt }
          : outcome === 'sent'
            ? { ...base, status: 'sent', submittedAt: sentAt, sentAt, updatedAt: sentAt }
            : outcome === 'failed'
              ? {
                  ...base,
                  status: 'failed',
                  submittedAt: sentAt,
                  sentAt,
                  failedAt,
                  lastErrorCode: 'EC_DESTINATION_UNAVAILABLE',
                  lastErrorMessage: 'Destination rejected the message',
                  updatedAt: failedAt,
                }
              : outcome === 'read'
                ? {
                    ...base,
                    status: 'read',
                    submittedAt: sentAt,
                    sentAt,
                    deliveredAt,
                    readAt,
                    updatedAt: readAt,
                  }
                : {
                    ...base,
                    status: 'delivered',
                    submittedAt: sentAt,
                    sentAt,
                    deliveredAt,
                    updatedAt: deliveredAt,
                  },
      );
    });

    // Batched: one INSERT for the messages, chunked INSERTs for their events.
    if (msgRows.length) await db.insert(messages).values(msgRows);
    const evRows: (typeof messageEvents.$inferInsert)[] = [];
    const pushEvent = (
      messageId: string,
      type: string,
      at: Date,
      to: string,
      extra: Record<string, unknown> = {},
    ) => {
      evRows.push({
        messageId,
        tenantId: tid,
        provider: 'infobip',
        providerEventId: `evt-${messageId.slice(0, 8)}-${type}`,
        eventFingerprint: `${messageId}:${type}`,
        eventType: type,
        providerStatus: type.toUpperCase(),
        occurredAt: at,
        receivedAt: minutesAfter(at, 0.2, 0.5),
        processedAt: minutesAfter(at, 0.4, 0.5),
        payload: { channel: opts.channel, to, ...extra },
      });
    };
    const phKind = opts.channel === 'voice' ? 'voice' : 'delivery';
    const mirror = (
      meta: Meta,
      at: Date,
      statusGroup: 'PENDING' | 'DELIVERED' | 'UNDELIVERABLE',
      raw: Record<string, unknown> = {},
    ) =>
      phReport({
        kind: phKind,
        channel: opts.channel,
        tenantId: tid,
        providerMessageId: meta.providerMessageId,
        maildrillMessageId: meta.messageId,
        bulkId,
        to: meta.to,
        at,
        statusGroup,
        raw,
      });
    for (const meta of metas) {
      if (meta.outcome !== 'queued') pushEvent(meta.messageId, 'sent', meta.sentAt, meta.to);
      if (meta.outcome === 'delivered' || meta.outcome === 'read') {
        pushEvent(meta.messageId, 'delivered', meta.deliveredAt, meta.to);
      }
      if (meta.outcome === 'read') pushEvent(meta.messageId, 'read', meta.readAt, meta.to);
      if (meta.outcome === 'failed') pushEvent(meta.messageId, 'failed', meta.failedAt, meta.to);
      if (meta.clickedAt) {
        pushEvent(meta.messageId, 'click', meta.clickedAt, meta.to, { url: meta.clickUrl });
      }
      if (meta.unsubscribedAt) {
        pushEvent(meta.messageId, 'unsubscribed', meta.unsubscribedAt, meta.to);
        unsubbedSubIds.set(meta.subId, meta.unsubscribedAt);
      }

      /* PostHog mirror — what Infobip's notify would have produced:
         a PENDING DLR on accept, a terminal DLR, seen reports for reads,
         and engagement events for clicks. Queued messages have no DLR yet;
         unsubscribes go through the product API, not Infobip. */
      if (meta.outcome !== 'queued') mirror(meta, meta.sentAt, 'PENDING');
      if (meta.outcome === 'delivered' || meta.outcome === 'read') {
        mirror(
          meta,
          meta.deliveredAt,
          'DELIVERED',
          opts.channel === 'voice' ? { voiceCall: { duration: 8 + Math.floor(rand() * 30) } } : {},
        );
      }
      if (meta.outcome === 'failed') mirror(meta, meta.failedAt, 'UNDELIVERABLE');
      if (meta.outcome === 'read') {
        phReport({
          kind: 'engagement',
          channel: opts.channel,
          tenantId: tid,
          providerMessageId: meta.providerMessageId,
          maildrillMessageId: meta.messageId,
          bulkId,
          to: meta.to,
          at: meta.readAt,
          raw: { seenAt: meta.readAt.toISOString() },
        });
      }
      if (meta.clickedAt) {
        phReport({
          kind: 'engagement',
          channel: opts.channel,
          tenantId: tid,
          providerMessageId: meta.providerMessageId,
          maildrillMessageId: meta.messageId,
          bulkId,
          to: meta.to,
          at: meta.clickedAt,
          raw: { type: 'CLICKED', url: meta.clickUrl },
        });
      }
    }
    for (let i = 0; i < evRows.length; i += 200) {
      await db.insert(messageEvents).values(evRows.slice(i, i + 200));
    }
    eventCount += evRows.length;
    console.log(`campaign "${opts.name}" (${opts.channel}, ${status}): ${msgRows.length} messages`);
  };

  /* Only subscribers who were on the list when a campaign went out receive
     it — recipient counts then grow with the base, its own visible trend. */
  const membersAt = (listId: string, at: Date, needPhone: boolean): Sub[] =>
    (memberOf.get(listId) ?? [])
      .filter(
        (m) =>
          m.addedAt <= at &&
          m.sub.createdAt <= at &&
          m.sub.status === 'active' &&
          (!needPhone || m.sub.phone),
      )
      .map((m) => m.sub);

  /* One campaign per week for 26 weeks on a six-slot rotation:
     digest email → SMS promo → product email → WhatsApp → VIP email → voice.
     Rates drift upward over the half year so trends and period-over-period
     deltas are real. */
  const monthName = (d: Date) => d.toLocaleString('en-US', { month: 'long' });
  const SMS_NAMES = [
    'Flash sale · 24h',
    'Cart winback',
    'Weekend promo',
    'VIP early access',
    'Restock alert',
  ];
  const PRODUCT_NAMES = [
    'Editor 2.0 launch',
    'Automations announcement',
    'Template studio beta',
    'Deliverability upgrade',
  ];
  const WA_NAMES = [
    'Order updates pilot',
    'Shipping notifications',
    'Order updates rollout',
    'Delivery day alerts',
  ];
  const VIP_NAMES = [
    'Founders note',
    'VIP roadmap preview',
    'Priority support launch',
    'Annual plan offer',
  ];
  const slotCounters: Record<number, number> = {};

  for (let w = WINDOW_WEEKS - 1; w >= 0; w -= 1) {
    const slot = w % 6;
    const nth = slotCounters[slot] ?? 0;
    slotCounters[slot] = nth + 1;
    /* Send mid-morning on a weekday that varies per week; the current week's
       campaign lands on the anchor Monday so it can never sit in the future. */
    const weekday = w === 0 ? 0 : [1, 3, 2, 4][w % 4]!;
    const sentAt = minutesAfter(days(w * 7 - weekday), 9 * 60, 150);
    const p = 1 - w / (WINDOW_WEEKS - 1); // 0 oldest → 1 newest

    if (slot === 0) {
      const open = 0.27 + 0.16 * p + rand() * 0.02;
      const fail = 0.07 - 0.045 * p;
      await seedCampaign({
        name: `${monthName(sentAt)} digest`,
        channel: 'email',
        listId: newsletter.id,
        templateId: emailTpl.id,
        content: {
          subject: `${monthName(sentAt)} digest — Maildrill`,
          from: 'Maildrill Team <hello@maildrill.app>',
        },
        sentAt,
        recipients: membersAt(newsletter.id, sentAt, false).filter(() => chance(0.72)),
        outcome: () => (chance(fail) ? 'failed' : chance(open) ? 'read' : 'delivered'),
        clickOfRead: 0.18 + 0.14 * p,
        unsubOfDelivered: 0.012,
        clickUrls: [
          'https://maildrill.app/blog/whats-new',
          'https://maildrill.app/pricing',
          'https://maildrill.app/guides/deliverability',
        ],
      });
    } else if (slot === 1) {
      const fail = 0.12 - 0.07 * p;
      await seedCampaign({
        name: SMS_NAMES[nth]!,
        channel: 'sms',
        listId: customers.id,
        templateId: smsTpl.id,
        content: { text: '20% off every plan for 24h. Reply STOP to opt out.' },
        sentAt,
        recipients: membersAt(customers.id, sentAt, true).filter(() => chance(0.6)),
        outcome: () => (chance(fail) ? 'failed' : 'delivered'),
        unsubOfDelivered: 0.02, // STOP replies
      });
    } else if (slot === 2) {
      const open = 0.31 + 0.13 * p + rand() * 0.02;
      await seedCampaign({
        name: PRODUCT_NAMES[nth]!,
        channel: 'email',
        listId: productUpdates.id,
        templateId: emailTpl.id,
        content: {
          subject: `${PRODUCT_NAMES[nth]} — Maildrill`,
          from: 'Maildrill Team <hello@maildrill.app>',
        },
        sentAt,
        recipients: membersAt(productUpdates.id, sentAt, false).filter(() => chance(0.75)),
        outcome: () => (chance(0.05 - 0.02 * p) ? 'failed' : chance(open) ? 'read' : 'delivered'),
        clickOfRead: 0.2 + 0.12 * p,
        unsubOfDelivered: 0.008,
        clickUrls: ['https://maildrill.app/blog/whats-new', 'https://maildrill.app/changelog'],
      });
    } else if (slot === 3) {
      const read = 0.5 + 0.2 * p;
      await seedCampaign({
        name: WA_NAMES[nth]!,
        channel: 'whatsapp',
        listId: beta.id,
        templateId: waTpl.id,
        content: { templateName: 'order_update', templateLanguage: 'en' },
        sentAt,
        recipients: membersAt(beta.id, sentAt, true).filter(() => chance(0.55)),
        outcome: () => (chance(0.05 - 0.02 * p) ? 'failed' : chance(read) ? 'read' : 'delivered'),
        clickOfRead: 0.14 + 0.1 * p,
        unsubOfDelivered: 0.008,
        clickUrls: ['https://maildrill.app/orders/track'],
      });
    } else if (slot === 4) {
      const open = 0.4 + 0.12 * p + rand() * 0.02;
      await seedCampaign({
        name: VIP_NAMES[nth]!,
        channel: 'email',
        listId: vip.id,
        templateId: emailTpl.id,
        content: {
          subject: `${VIP_NAMES[nth]} — Maildrill`,
          from: 'Maildrill Team <hello@maildrill.app>',
        },
        sentAt,
        recipients: membersAt(vip.id, sentAt, false).filter(() => chance(0.85)),
        outcome: () => (chance(0.03) ? 'failed' : chance(open) ? 'read' : 'delivered'),
        clickOfRead: 0.24 + 0.12 * p,
        unsubOfDelivered: 0.004,
        clickUrls: ['https://maildrill.app/pricing', 'https://maildrill.app/roadmap'],
      });
    } else {
      const fail = 0.2 - 0.09 * p;
      await seedCampaign({
        name: `Renewal reminders · ${monthName(sentAt)}`,
        channel: 'voice',
        listId: customers.id,
        templateId: voiceTpl.id,
        content: { language: 'en', voiceName: 'Joanna', voiceGender: 'female', speechRate: 1 },
        sentAt,
        recipients: membersAt(customers.id, sentAt, true).filter(() => chance(0.3)),
        outcome: () => (chance(fail) ? 'failed' : 'delivered'),
      });
    }
  }

  // One mid-send campaign for the progress bar (some queued, some out).
  await seedCampaign({
    name: 'Back-in-stock blast',
    channel: 'email',
    listId: newsletter.id,
    templateId: emailTpl.id,
    content: {
      subject: 'Back in stock — your saved items',
      from: 'Maildrill Team <hello@maildrill.app>',
    },
    sentAt: minutesAfter(days(0), 8 * 60, 30),
    recipients: membersAt(newsletter.id, days(0), false).slice(0, 18),
    outcome: (i) => (i < 7 ? 'delivered' : i < 12 ? 'sent' : 'queued'),
    status: 'sending',
  });

  // Scheduled + draft (no messages yet).
  await db.insert(campaigns).values([
    {
      tenantId: tid,
      name: 'Product webinar invite',
      status: 'scheduled',
      channel: 'email',
      listId: newsletter.id,
      templateId: emailTpl.id,
      content: {
        subject: 'Join our live product webinar',
        from: 'Maildrill Team <hello@maildrill.app>',
      },
      scheduledAt: days(-3),
    },
    {
      tenantId: tid,
      name: 'Churn-risk winback',
      status: 'draft',
      channel: 'sms',
      listId: customers.id,
      templateId: smsTpl.id,
      content: { text: 'We miss you — here is 30% off your next month.' },
    },
  ]);

  /* Flip the subscribers who unsubscribed via campaign events. */
  for (const [subId, at] of unsubbedSubIds) {
    await db
      .update(subscribers)
      .set({ status: 'unsubscribed', updatedAt: at })
      .where(eq(subscribers.id, subId));
  }
  console.log(`unsubscribed ${unsubbedSubIds.size} subscribers via campaign events`);
  console.log(`seeded ${eventCount} provider events`);

  await flushPostHog();

  console.log('done');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
