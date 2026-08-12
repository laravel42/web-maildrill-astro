import type { Channel } from './channels';

/**
 * What the free trial includes, per channel.
 *
 * Mirrors the marketing promise on `/signup` (`src/config/pricing.ts` →
 * `TRIAL_ALLOWANCES`), the same way `seed-billing.ts` mirrors the rate card:
 * the site and the gate must never disagree about what was sold.
 *
 * Units are **messages** for email/SMS/WhatsApp. Voice is advertised as
 * "60 min of voice calls", but call duration is not recorded anywhere — no
 * message or event row carries it — so the gate counts **calls** and treats
 * one call as one minute. That matches Infobip's per-minute billing with its
 * one-minute minimum for short calls, and under-counts a long one. Once a
 * duration lands on the message row, switch `voice` to summing real minutes;
 * this constant is the only place that assumption lives.
 */
export const TRIAL_ALLOWANCES: Readonly<Record<Channel, number>> = Object.freeze({
  email: 100,
  sms: 15,
  whatsapp: 100,
  voice: 60,
});

/** Unit each allowance is denominated in — for user-facing copy and errors. */
export const TRIAL_ALLOWANCE_UNITS: Readonly<Record<Channel, string>> = Object.freeze({
  email: 'emails',
  sms: 'SMS messages',
  whatsapp: 'WhatsApp messages',
  voice: 'minutes of voice calls',
});
