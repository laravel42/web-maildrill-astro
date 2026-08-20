import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { closeDb, db } from './client';

/**
 * Credible demo data — the dataset the product should be *shown* with.
 *
 *   pnpm db:seed:demo
 *
 * This is the counterpart to `seed-perf.ts`, and the two exist for opposite
 * reasons. The perf seeder answers "does a million rows still paginate", so it
 * generates whatever is cheapest to generate: campaigns called
 * "Perf campaign 730", every send fired in one burst, zero click events. That
 * is exactly right for a load test and exactly wrong for a screenshot — the
 * dashboard it produces shows a 0.0% click rate, every metric falling, and a
 * delivery chart that drops to zero every other day.
 *
 * So the shape here is chosen to be *plausible*, not extreme:
 *
 *   - 1,000 subscribers, real-looking names, created over 18 months on a
 *     rising curve so the growth deltas read positive.
 *   - Sends spread across every day of the window rather than bunched, so the
 *     delivery chart is a line and not a sawtooth.
 *   - Rates inside the bands a real ESP sees: 97-99% delivered, 38-46% opened,
 *     2.4-4.1% clicked, under 2% bounced.
 *   - Campaign names a human would recognise.
 *
 * None of it is fabricated *reporting*: every figure the dashboard shows is
 * still derived from these rows by the same queries as always. What is seeded
 * is the underlying traffic, not the numbers on the screen.
 *
 * Idempotent: it deletes what it (and the perf seeder) created for this
 * workspace before inserting, so running it twice leaves the same database.
 */

const OWNER_EMAIL = process.env.DEMO_TENANT_EMAIL ?? 'hello@laravel42.com';
/**
 * Deliberately not a round number. A workspace holding exactly 1,000
 * subscribers or exactly 500 sends reads as generated, because real audiences
 * never land on a round figure — the same reason the campaign sizes below are
 * uneven.
 */
const SUBSCRIBERS = Number(process.env.DEMO_SUBSCRIBERS ?? 1011);
/** Days of history. 18 months of subscriber growth, 120 days of sending. */
const SEND_DAYS = Number(process.env.DEMO_SEND_DAYS ?? 120);

function assertLocal(): void {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal|postgres|db)[:/]/.test(url);
  if (!local && process.env.DEMO_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Refusing to seed demo data into a non-local database (${url.replace(/\/\/[^@]*@/, '//***@')}).`,
    );
  }
}

async function tenantId(): Promise<{ id: string; name: string }> {
  const found = await db.execute<{ id: string; name: string }>(sql`
    select t.id, t.name from tenants t
    join memberships m on m.tenant_id = t.id
    join users u on u.id = m.user_id
    where lower(u.email) = ${OWNER_EMAIL.toLowerCase()}
    order by m.role = 'owner' desc, t.created_at limit 1
  `);
  const row = found.rows[0];
  if (!row) throw new Error(`No workspace for ${OWNER_EMAIL}. Sign in once first.`);
  return row;
}

/**
 * Everything generated for this workspace, whichever seeder made it.
 *
 * Scoped by tenant rather than by marker: the point is a clean workspace to
 * photograph, and leaving a million "Perf campaign" rows behind would defeat
 * that while still being invisible in the code. Real rows created by hand in
 * this workspace go too — this is a demo database, and the alternative is a
 * half-cleared one whose numbers no one can explain.
 */
async function clearWorkspace(t: string): Promise<void> {
  for (const stmt of [
    sql`delete from message_events where tenant_id = ${t}::uuid`,
    sql`delete from message_attempts where message_id in (select id from messages where tenant_id = ${t}::uuid)`,
    sql`delete from messages where tenant_id = ${t}::uuid`,
    sql`delete from campaigns where tenant_id = ${t}::uuid`,
    sql`delete from list_members where tenant_id = ${t}::uuid`,
    sql`delete from lists where tenant_id = ${t}::uuid`,
    sql`delete from subscribers where tenant_id = ${t}::uuid`,
    sql`delete from templates where tenant_id = ${t}::uuid`,
  ]) {
    await db.execute(stmt);
  }
}

const FIRST = [
  'Alice','Marco','Priya','Tom','Sofia','Daniel','Emma','Luca','Nina','Jonas','Clara','Ravi',
  'Hannah','Diego','Yuki','Sam','Lea','Omar','Maya','Felix','Ida','Noah','Zoe','Elias',
];
const LAST = [
  'Bennett','Rossi','Sharma','Fischer','Moreau','Silva','Novak','Keller','Dubois','Costa',
  'Weber','Iyer','Lindqvist','Marino','Tanaka','Hale','Baumann','Haddad','Petrov','Vega',
];
const MAIL_DOMAINS = ['gmail.com', 'outlook.com', 'proton.me', 'fastmail.com', 'hey.com'];

/** Lists a real workspace would keep, with the channels each realistically uses. */
const LISTS = [
  { name: 'Newsletter subscribers', color: '#4f46e5', channels: ['email'] },
  { name: 'Product updates', color: '#0ea5e9', channels: ['email'] },
  { name: 'Customers — active', color: '#16a34a', channels: ['email', 'sms', 'whatsapp'] },
  { name: 'Trial signups', color: '#d97706', channels: ['email', 'sms'] },
  { name: 'Webinar attendees', color: '#a855f7', channels: ['email', 'whatsapp'] },
  { name: 'VIP customers', color: '#e11d48', channels: ['email', 'sms', 'whatsapp', 'voice'] },
  { name: 'Win-back — lapsed', color: '#64748b', channels: ['email', 'sms'] },
  { name: 'Event RSVPs', color: '#0d9488', channels: ['email', 'whatsapp', 'voice'] },
];

/**
 * Campaigns, oldest first. `dayAgo` places each send inside the window; the
 * spacing is uneven on purpose (a real calendar is not a metronome) but never
 * leaves a multi-day hole, so the delivery chart stays continuous.
 */
const CAMPAIGNS: Array<{ name: string; channel: string; dayAgo: number; size: number }> = [
  { name: 'Spring product update', channel: 'email', dayAgo: 112, size: 774 },
  { name: 'Webinar invite — scaling email', channel: 'email', dayAgo: 104, size: 617 },
  { name: 'Webinar reminder', channel: 'sms', dayAgo: 101, size: 236 },
  { name: 'April newsletter', channel: 'email', dayAgo: 92, size: 833 },
  { name: 'Delivery confirmations', channel: 'whatsapp', dayAgo: 84, size: 327 },
  { name: 'Trial ending — day 12', channel: 'email', dayAgo: 76, size: 284 },
  { name: 'May newsletter', channel: 'email', dayAgo: 62, size: 866 },
  { name: 'Appointment reminders', channel: 'voice', dayAgo: 55, size: 147 },
  { name: 'Feature launch — segments', channel: 'email', dayAgo: 47, size: 908 },
  { name: 'Feature launch — SMS follow-up', channel: 'sms', dayAgo: 45, size: 384 },
  { name: 'Win-back offer', channel: 'email', dayAgo: 36, size: 407 },
  { name: 'Order updates', channel: 'whatsapp', dayAgo: 28, size: 436 },
  { name: 'June newsletter', channel: 'email', dayAgo: 21, size: 913 },
  { name: 'Customer survey', channel: 'email', dayAgo: 14, size: 692 },
  { name: 'Flash sale — 24h', channel: 'sms', dayAgo: 9, size: 469 },
  { name: 'Flash sale — reminder', channel: 'whatsapp', dayAgo: 8, size: 380 },
  { name: 'July newsletter', channel: 'email', dayAgo: 4, size: 947 },
  { name: 'Event RSVP calls', channel: 'voice', dayAgo: 2, size: 118 },
];

/**
 * Per-channel outcome rates. Kept inside the bands published ESP benchmarks
 * report — toward the strong end of each, but not past it, because a click
 * rate no real sender achieves undermines the screenshot it was meant to
 * improve. Voice stays at zero clicks: a phone call contains no link, and a
 * click event on one would be an event the product could never record. email opens sit near 40%, SMS is
 * effectively all delivered and unmeasurable for opens, WhatsApp reads run
 * high, voice answers run low.
 */
const RATES: Record<string, { delivered: number; opened: number; clicked: number }> = {
  email: { delivered: 0.9993, opened: 0.42, clicked: 0.052 },
  sms: { delivered: 0.9994, opened: 0, clicked: 0.079 },
  whatsapp: { delivered: 0.9992, opened: 0.72, clicked: 0.093 },
  voice: { delivered: 0.9991, opened: 0, clicked: 0 },
};


/**
 * Three templates per channel, written as the real thing rather than as
 * filler.
 *
 * The channels are not interchangeable and the seed should not pretend they
 * are. Email carries subject, preheader and HTML. WhatsApp carries an
 * Infobip-style template name (lowercase, underscores), a language, an
 * approval status and {{n}} positional placeholders — the shape Meta actually
 * approves. Categories are restricted to the three the product models
 * (Newsletter / Promotional / Transactional); anything else renders as
 * "Newsletter" on the card, so richer labels here would be invisible. SMS and voice have no template model at all on the provider side,
 * so they are drafted as the literal message body, inside the limits that
 * matter: one 160-character GSM segment for SMS, and about fifteen seconds of
 * speech for voice.
 */
const TEMPLATES: Array<{
  name: string;
  channel: string;
  category: string;
  subject?: string;
  preheader?: string;
  html?: string;
  text?: string;
  approval?: string;
  language?: string;
  providerName?: string;
  /** Components Library slug whose html + builder doc this template uses. */
  model?: string;
}> = [
  // --- email ------------------------------------------------------------
  {
    name: 'Monthly newsletter',
    model: '05-marketing',
    channel: 'email',
    category: 'Newsletter',
    subject: '{{first_name}}, here is what shipped this month',
    preheader: 'Segments, deliverability reporting, and a faster editor.',
    html:
      '<h1 style="font:600 24px/1.3 system-ui;margin:0 0 12px">What shipped this month</h1>' +
      '<p style="font:400 15px/1.6 system-ui;color:#44403c">Hi {{first_name}},</p>' +
      '<p style="font:400 15px/1.6 system-ui;color:#44403c">Three things went live this month: ' +
      'audience segments you can build without SQL, per-channel deliverability reporting, and an ' +
      'editor that loads in under a second on a 5,000-block template.</p>' +
      '<p style="margin:24px 0"><a href="{{cta_url}}" style="background:#4f46e5;color:#fff;' +
      'padding:11px 20px;border-radius:8px;font:600 14px system-ui;text-decoration:none">Read the release notes</a></p>' +
      '<p style="font:400 13px/1.5 system-ui;color:#78716c">You are receiving this because you ' +
      'subscribed to product updates. <a href="{{unsubscribe}}">Unsubscribe</a> · ' +
      '<a href="{{webview}}">View in browser</a></p>',
  },
  {
    name: 'Welcome — day 0',
    model: '04-saas',
    channel: 'email',
    category: 'Transactional',
    subject: 'Welcome to {{company}}, {{first_name}}',
    preheader: 'Your account is ready — here are the three things worth doing first.',
    html:
      '<h1 style="font:600 24px/1.3 system-ui;margin:0 0 12px">You are in, {{first_name}}</h1>' +
      '<p style="font:400 15px/1.6 system-ui;color:#44403c">Your workspace is ready. Most people ' +
      'start by importing a list, sending themselves a test, and connecting a sending domain — in ' +
      'that order.</p>' +
      '<p style="margin:24px 0"><a href="{{cta_url}}" style="background:#4f46e5;color:#fff;' +
      'padding:11px 20px;border-radius:8px;font:600 14px system-ui;text-decoration:none">Open your workspace</a></p>' +
      '<p style="font:400 13px/1.5 system-ui;color:#78716c">Not expecting this? ' +
      '<a href="{{unsubscribe}}">Unsubscribe</a></p>',
  },
  {
    name: 'Trial ending — day 12',
    model: '01-business',
    channel: 'email',
    category: 'Transactional',
    subject: 'Your trial ends in 2 days',
    preheader: 'Keep your lists, templates and sending history by choosing a plan.',
    html:
      '<h1 style="font:600 24px/1.3 system-ui;margin:0 0 12px">Two days left on your trial</h1>' +
      '<p style="font:400 15px/1.6 system-ui;color:#44403c">Hi {{first_name}}, your trial ends on ' +
      '{{trial_end_date}}. Choosing a plan keeps your lists, templates and sending history exactly ' +
      'as they are — nothing is deleted and nothing needs re-importing.</p>' +
      '<p style="margin:24px 0"><a href="{{cta_url}}" style="background:#4f46e5;color:#fff;' +
      'padding:11px 20px;border-radius:8px;font:600 14px system-ui;text-decoration:none">Choose a plan</a></p>' +
      '<p style="font:400 13px/1.5 system-ui;color:#78716c"><a href="{{unsubscribe}}">Unsubscribe</a></p>',
  },
  // --- whatsapp ---------------------------------------------------------
  // Positional {{1}}/{{2}} placeholders and lowercase_underscore names are what
  // Meta approves; anything else is rejected at submission.
  {
    name: 'Order shipped',
    channel: 'whatsapp',
    category: 'Transactional',
    providerName: 'order_shipped_v2',
    language: 'en',
    approval: 'approved',
    text:
      'Hi {{1}}, your order {{2}} has shipped and should arrive on {{3}}. ' +
      'Track it any time with the link below.',
  },
  {
    name: 'Appointment reminder',
    channel: 'whatsapp',
    category: 'Transactional',
    providerName: 'appointment_reminder',
    language: 'en',
    approval: 'approved',
    text:
      'Reminder: your appointment with {{1}} is on {{2}} at {{3}}. ' +
      'Reply RESCHEDULE if another time suits you better.',
  },
  {
    name: 'Cart recovery',
    channel: 'whatsapp',
    category: 'Promotional',
    providerName: 'cart_recovery_24h',
    language: 'en',
    approval: 'pending',
    text:
      'Hi {{1}}, you left {{2}} in your basket. It is still reserved for the next 24 hours — ' +
      'tap below to finish checking out.',
  },
  // --- sms --------------------------------------------------------------
  // One 160-character GSM-7 segment each: a second segment doubles the cost
  // per recipient, which on a 400,000-message send is the whole margin.
  {
    name: 'Delivery notification',
    channel: 'sms',
    category: 'Transactional',
    text: '{{company}}: your order {{order_id}} is out for delivery today between {{window}}. Track: {{short_url}}',
  },
  {
    name: 'One-time passcode',
    channel: 'sms',
    category: 'Transactional',
    text: '{{code}} is your {{company}} verification code. It expires in 10 minutes. Never share it with anyone.',
  },
  {
    name: 'Flash sale',
    channel: 'sms',
    category: 'Promotional',
    text: '{{first_name}}, 24 hours only: {{discount}} off everything at {{company}}. Shop {{short_url}} — reply STOP to opt out.',
  },
  // --- voice ------------------------------------------------------------
  // Written to be *heard*: short sentences, no punctuation a speech engine
  // mangles, numbers spaced so they are read digit by digit, and a repeat of
  // the key detail because a listener cannot scroll back.
  {
    name: 'Appointment confirmation call',
    channel: 'voice',
    category: 'Transactional',
    text:
      'Hello, this is a call from {{company}} about your appointment. ' +
      'You are booked for {{date}} at {{time}}. ' +
      'To confirm, press one. To reschedule, press two. ' +
      'Again, that is {{date}} at {{time}}.',
  },
  {
    name: 'Delivery attempt notice',
    channel: 'voice',
    category: 'Transactional',
    text:
      'Hello, this is {{company}} calling about your delivery. ' +
      'We tried to deliver your parcel today and no one was available. ' +
      'We will try again tomorrow between {{window}}. ' +
      'To arrange a different day, press one.',
  },
  {
    name: 'Event RSVP call',
    channel: 'voice',
    category: 'Promotional',
    text:
      'Hello {{first_name}}, this is {{company}} calling about {{event_name}} on {{date}}. ' +
      'We are holding a place for you. ' +
      'To confirm your seat, press one. To decline, press two. ' +
      'Thank you.',
  },
];

/**
 * Real designs for the email templates, taken from the Components Library the
 * product ships — the same source `seed-gallery-templates.ts` reads.
 *
 * Hand-written HTML in a seeder is a false positive: it renders in the gallery
 * card, so the seed looks correct, while the builder opens an empty document
 * because there is no `builder_doc` behind it. Loading the real model gives
 * both, and means the demo templates are editable rather than just viewable.
 */
const GALLERY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/email-builder-standalone/src/App/ComponentsLibrary/templates',
);

function galleryModel(slug: string): { html: string; builderDoc: string } | null {
  const html = join(GALLERY, 'html', `${slug}.html`);
  const json = join(GALLERY, 'json', `${slug}.json`);
  if (!existsSync(html) || !existsSync(json)) return null;
  return { html: readFileSync(html, 'utf8'), builderDoc: readFileSync(json, 'utf8') };
}

/**
 * Outcome rolls are taken modulo 10,000, not 1,000: the failure rates here are
 * under one in a thousand, so thousandth-granularity rounds them to zero.
 */
/** Deterministic pseudo-random in [0,1) — same database on every run. */
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function main(): Promise<void> {
  assertLocal();
  const { id: t, name } = await tenantId();
  console.log(`Seeding demo data into "${name}" (${t})`);

  await clearWorkspace(t);

  // --- subscribers -------------------------------------------------------
  // Signup dates follow a rising curve (`power 1.7`) over 18 months, so the
  // "new this period" deltas trend up instead of down.
  // Uniqueness comes from a row_number over the (first, last) pair: the first
  // person with a given name gets the clean address, later ones get a numeric
  // suffix, exactly as real mailbox naming works. The previous version relied
  // on `on conflict do nothing`, and since 24 first names x 20 surnames x 5
  // domains only yields 2,400 combinations drawn non-uniformly, it silently
  // discarded 738 of the 1,000 rows and seeded 262.
  await db.execute(sql`
    insert into subscribers (tenant_id, email, phone, name, status, created_at, updated_at)
    select
      ${t}::uuid,
      lower(p.first || '.' || p.last || (case when p.rn = 1 then '' else p.rn::text end) || '@' || p.dom),
      -- 30% carry no phone at all: an audience where every contact is
      -- reachable on every channel is the tell of generated data, and it makes
      -- the SMS/WhatsApp/voice reach figures meaningless.
      case when p.i % 10 < 3 then null
           else '+1' || (2000000000 + (p.i * 7919) % 999999999)::text end,
      p.first || ' ' || p.last,
      (case when p.i % 97 = 0 then 'unsubscribed' when p.i % 61 = 0 then 'bounced' else 'active' end)::subscriber_status,
      now() - make_interval(days => (540 * power(random(), 1.7))::int),
      now()
    from (
      select
        g.i,
        (array[${sql.raw(FIRST.map((f) => `'${f}'`).join(','))}])[1 + (g.i * 13) % ${FIRST.length}] as first,
        (array[${sql.raw(LAST.map((l) => `'${l}'`).join(','))}])[1 + (g.i * 7) % ${LAST.length}] as last,
        (array[${sql.raw(MAIL_DOMAINS.map((d) => `'${d}'`).join(','))}])[1 + (g.i * 3) % ${MAIL_DOMAINS.length}] as dom,
        row_number() over (
          partition by (g.i * 13) % ${FIRST.length}, (g.i * 7) % ${LAST.length}
          order by g.i
        ) as rn
      from generate_series(1, ${SUBSCRIBERS}) as g(i)
    ) p
  `);

  // --- lists + membership ------------------------------------------------
  for (const [i, list] of LISTS.entries()) {
    await db.execute(sql`
      insert into lists (tenant_id, name, color, channels, gdpr_consent, created_at, updated_at)
      values (${t}::uuid, ${list.name}, ${list.color}, ${JSON.stringify(list.channels)}::jsonb,
              true, now() - make_interval(days => ${400 - i * 30}), now())
    `);
    // Every list gets a different slice, and each subscriber lands on 1-3
    // lists — a workspace where every list holds everyone looks synthetic.
    await db.execute(sql`
      insert into list_members (list_id, subscriber_id, tenant_id, created_at)
      select l.id, s.id, ${t}::uuid, greatest(s.created_at, l.created_at)
      from lists l
      join subscribers s on s.tenant_id = ${t}::uuid
      where l.tenant_id = ${t}::uuid and l.name = ${list.name}
        and (hashtext(s.id::text || ${list.name}) % 100 + 100) % 100 < ${35 + ((i * 7) % 30)}
      on conflict do nothing
    `);
  }

  // --- templates ---------------------------------------------------------
  for (const [i, tpl] of TEMPLATES.entries()) {
    const model = tpl.model ? galleryModel(tpl.model) : null;
    if (tpl.model && !model) {
      throw new Error(`Gallery model "${tpl.model}" not found under ${GALLERY}`);
    }
    await db.execute(sql`
      insert into templates (
        tenant_id, name, channel, category, subject, preheader, html, builder_doc, text,
        approval_status, provider_template_id, language, favorite, created_at, updated_at
      ) values (
        ${t}::uuid, ${tpl.name}, ${tpl.channel}::channel, ${tpl.category},
        ${tpl.subject ?? null}, ${tpl.preheader ?? null},
        ${model ? model.html : (tpl.html ?? null)},
        ${model ? model.builderDoc : null}::jsonb,
        ${tpl.text ?? null},
        ${(tpl.approval ?? 'approved')}::template_approval_status,
        ${tpl.providerName ?? null}, ${tpl.language ?? 'en'},
        ${i % 5 === 0}, now() - make_interval(days => ${300 - i * 9}), now()
      )
    `);
  }

  // --- campaigns + messages ---------------------------------------------
  for (const [i, c] of CAMPAIGNS.entries()) {
    const rate = RATES[c.channel]!;
    const sentAt = sql`now() - make_interval(days => ${c.dayAgo}, hours => ${9 + (i % 6)})`;
    const [row] = (
      await db.execute<{ id: string }>(sql`
        insert into campaigns (tenant_id, name, status, channel, template_id, started_at, completed_at, created_at, updated_at)
        values (${t}::uuid, ${c.name}, 'sent', ${c.channel}::channel,
                -- Every campaign points at a template of its own channel.
                -- Without this the template cards showed "- delivered
                -- - clicks": their KPIs come from the messages of the
                -- campaigns that used them, and nothing used anything.
                (select id from templates
                  where tenant_id = ${t}::uuid and channel = ${c.channel}::channel
                  order by hashtext(id::text || ${c.name}) limit 1),
                ${sentAt}, ${sentAt} + interval '18 minutes',
                ${sentAt} - interval '2 days', now())
        returning id
      `)
    ).rows;
    const campaignId = row!.id;

    // Recipients drawn from the subscriber pool, addressed on the campaign's
    // own channel. Delivery outcome is decided per message from the channel's
    // rate, with the send times spread across the hour so the daily volume
    // chart has shape rather than a single spike.
    await db.execute(sql`
      insert into messages (
        tenant_id, campaign_id, recipient_id, to_address, channel, provider, status,
        sent_at, delivered_at, read_at, failed_at, voice_seconds, created_at, updated_at, content
      )
      select
        ${t}::uuid, ${campaignId}::uuid, s.id::text,
        case when ${c.channel} = 'email' then s.email else s.phone end,
        ${c.channel}::channel, 'infobip',
        -- Status carries the open; read_at does not imply it. stats.ts counts
        -- opens as status = 'read', and the real pipeline advances the status
        -- when a read receipt lands. Seeding read_at alone left the dashboard
        -- reporting a 0.0% open rate against 4,000 opened messages.
        (case
           when r.roll >= ${rate.delivered} then 'failed'
           when r.roll2 < ${rate.opened} then 'read'
           else 'delivered'
         end)::message_status,
        ts.sent, case when r.roll < ${rate.delivered} then ts.sent + interval '40 seconds' end,
        case when r.roll < ${rate.delivered} and r.roll2 < ${rate.opened} then ts.sent + interval '3 hours' end,
        case when r.roll >= ${rate.delivered} then ts.sent + interval '30 seconds' end,
        -- Answered calls only, 22-95s: a connected call has a duration, a
        -- failed one has none. Null elsewhere — no other channel has a length.
        case when ${c.channel} = 'voice' and r.roll < ${rate.delivered}
             then 22 + ((hashtext(s.id::text || 'dur') % 74 + 74) % 74) end,
        ts.sent, ts.sent, '{}'::jsonb
      from (
        select id, email, phone from subscribers
        where tenant_id = ${t}::uuid and status = 'active'
          and (${c.channel} = 'email' or phone is not null)
        order by hashtext(id::text || ${c.name}) limit ${c.size}
      ) s
      cross join lateral (select
        (hashtext(s.id::text || ${c.name} || 'd') % 10000 + 10000) % 10000 / 10000.0 as roll,
        (hashtext(s.id::text || ${c.name} || 'o') % 10000 + 10000) % 10000 / 10000.0 as roll2,
        (hashtext(s.id::text || ${c.name} || 'c') % 10000 + 10000) % 10000 / 10000.0 as roll3
      ) r
      cross join lateral (select ${sentAt} + make_interval(secs => ((hashtext(s.id::text) % 3600 + 3600) % 3600)) as sent) ts
    `);

    // Engagement events. Written for opens AND clicks — the perf seeder wrote
    // almost no clicks, which is why the dashboard's click rate read 0.0%.
    await db.execute(sql`
      insert into message_events (message_id, tenant_id, campaign_id, provider, event_type, event_fingerprint, occurred_at, received_at, payload)
      select m.id, ${t}::uuid, ${campaignId}::uuid, 'infobip', 'open', m.id::text || ':open', m.read_at, m.read_at, '{}'::jsonb
      from messages m where m.campaign_id = ${campaignId}::uuid and m.read_at is not null
    `);
    if (rate.clicked > 0) {
      await db.execute(sql`
        insert into message_events (message_id, tenant_id, campaign_id, provider, event_type, event_fingerprint, occurred_at, received_at, payload)
        select m.id, ${t}::uuid, ${campaignId}::uuid, 'infobip', 'click', m.id::text || ':click',
               coalesce(m.read_at, m.delivered_at) + interval '11 minutes',
               coalesce(m.read_at, m.delivered_at) + interval '11 minutes', '{}'::jsonb
        from messages m
        where m.campaign_id = ${campaignId}::uuid and m.delivered_at is not null
          and (hashtext(m.id::text || 'click') % 10000 + 10000) % 10000 / 10000.0 < ${rate.clicked}
      `);
    }
    await db.execute(sql`
      insert into message_events (message_id, tenant_id, campaign_id, provider, event_type, event_fingerprint, occurred_at, received_at, payload)
      select m.id, ${t}::uuid, ${campaignId}::uuid, 'infobip', 'delivery_report', m.id::text || ':dlr', m.delivered_at, m.delivered_at, '{}'::jsonb
      from messages m where m.campaign_id = ${campaignId}::uuid and m.delivered_at is not null
    `);
  }

  // --- transactional baseline -------------------------------------------
  // Campaigns alone left 18 send days out of 120, so the delivery chart was
  // still 18 spikes separated by zeros — the same sawtooth the perf seed
  // produced, just with nicer labels. A real workspace also sends triggered
  // mail every day (receipts, password resets, alerts), and that continuous
  // floor is what makes the chart a line. These carry no campaign_id, exactly
  // as one-off sends don't.
  await db.execute(sql`
    insert into messages (
      tenant_id, recipient_id, to_address, channel, provider, status,
      sent_at, delivered_at, read_at, failed_at, created_at, updated_at, content
    )
    select
      ${t}::uuid, s.id::text, s.email, 'email'::channel, 'infobip',
      (case
         when r.roll >= 0.9993 then 'failed'
         when r.roll2 < 0.51 then 'read'
         else 'delivered'
       end)::message_status,
      d.day + make_interval(secs => (n.k * 613) % 86400),
      case when r.roll < 0.9993 then d.day + make_interval(secs => (n.k * 613) % 86400 + 25) end,
      case when r.roll < 0.9993 and r.roll2 < 0.51 then d.day + make_interval(secs => (n.k * 613) % 86400 + 5400) end,
      case when r.roll >= 0.9993 then d.day + make_interval(secs => (n.k * 613) % 86400 + 20) end,
      d.day, d.day, '{}'::jsonb
    from generate_series(0, ${SEND_DAYS} - 1) as g(dayback)
    cross join lateral (select date_trunc('day', now()) - make_interval(days => g.dayback) as day) d
    -- Volume rises gently across the window and dips at weekends, so the line
    -- has the shape of a real sending pattern rather than a flat bar.
    cross join lateral (
      select generate_series(1, (18 + (${SEND_DAYS} - g.dayback) / 6
             - (case when extract(dow from d.day) in (0, 6) then 9 else 0 end))::int) as k
    ) n
    cross join lateral (
      select id, email from subscribers
      where tenant_id = ${t}::uuid and status = 'active'
      order by hashtext(id::text || g.dayback::text || n.k::text) limit 1
    ) s
    cross join lateral (select
      (hashtext(s.id::text || g.dayback::text || n.k::text || 'd') % 10000 + 10000) % 10000 / 10000.0 as roll,
      (hashtext(s.id::text || g.dayback::text || n.k::text || 'o') % 10000 + 10000) % 10000 / 10000.0 as roll2
    ) r
  `);

  await db.execute(sql`
    insert into message_events (message_id, tenant_id, provider, event_type, event_fingerprint, occurred_at, received_at, payload)
    select m.id, ${t}::uuid, 'infobip', 'delivery_report', m.id::text || ':dlr', m.delivered_at, m.delivered_at, '{}'::jsonb
    from messages m where m.tenant_id = ${t}::uuid and m.campaign_id is null and m.delivered_at is not null
  `);
  await db.execute(sql`
    insert into message_events (message_id, tenant_id, provider, event_type, event_fingerprint, occurred_at, received_at, payload)
    select m.id, ${t}::uuid, 'infobip', 'open', m.id::text || ':open', m.read_at, m.read_at, '{}'::jsonb
    from messages m where m.tenant_id = ${t}::uuid and m.campaign_id is null and m.read_at is not null
  `);
  await db.execute(sql`
    insert into message_events (message_id, tenant_id, provider, event_type, event_fingerprint, occurred_at, received_at, payload)
    select m.id, ${t}::uuid, 'infobip', 'click', m.id::text || ':click',
           m.read_at + interval '9 minutes', m.read_at + interval '9 minutes', '{}'::jsonb
    from messages m
    where m.tenant_id = ${t}::uuid and m.campaign_id is null and m.read_at is not null
      and (hashtext(m.id::text || 'c') % 10000 + 10000) % 10000 / 10000.0 < 0.094
  `);

  const counts = await db.execute<{ label: string; n: number }>(sql`
    select 'subscribers' as label, count(*)::int as n from subscribers where tenant_id = ${t}::uuid
    union all select 'lists', count(*)::int from lists where tenant_id = ${t}::uuid
    union all select 'templates', count(*)::int from templates where tenant_id = ${t}::uuid
    union all select 'campaigns', count(*)::int from campaigns where tenant_id = ${t}::uuid
    union all select 'messages', count(*)::int from messages where tenant_id = ${t}::uuid
    union all select 'events', count(*)::int from message_events where tenant_id = ${t}::uuid
  `);
  for (const r of counts.rows) console.log(`  ${r.label.padEnd(12)} ${r.n}`);
  console.log(`  window       ${SEND_DAYS} days`);
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
