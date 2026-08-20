import type { Channel } from './channels';

/**
 * What the free trial includes, per channel.
 *
 * Mirrors the marketing promise on `/signup` (`src/config/pricing.ts` →
 * `TRIAL_ALLOWANCES`), the same way `seed-billing.ts` mirrors the rate card:
 * the site and the gate must never disagree about what was sold.
 *
 * Units are **messages** for email/SMS/WhatsApp and **minutes** for voice.
 * Providers never report a call's real duration back to us, so the voice gate
 * spends the budget in estimated seconds — see `estimateVoiceSeconds`.
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

/** The voice budget in seconds, which is what the gate actually spends. */
export const TRIAL_VOICE_SECONDS = TRIAL_ALLOWANCES.voice * 60;

/**
 * What one channel's allowance is counted in. Voice is the odd one out: the
 * budget is time, so it is spent in seconds rather than per message.
 */
export const TRIAL_ALLOWANCE_UNIT_KIND: Readonly<Record<Channel, 'messages' | 'seconds'>> =
  Object.freeze({
    email: 'messages',
    sms: 'messages',
    whatsapp: 'messages',
    voice: 'seconds',
  });

/**
 * Speaking pace of a TTS voice, in words per minute. 150 is the neutral rate
 * Infobip's engines (and Polly, which backs several of them) read at; the
 * `speechRate` on the message scales it.
 */
const VOICE_WORDS_PER_MINUTE = 150;

/**
 * Ring, answer, and the pause before the script starts. Charged time begins at
 * answer, so this is the floor any connected call costs.
 */
const VOICE_CONNECT_SECONDS = 5;

/**
 * A call that plays a recording instead of reading text has no measurable
 * length here — we never fetch the audio. Assume a short prompt so an
 * unmeasurable call still spends budget rather than being free.
 */
const VOICE_AUDIO_FALLBACK_SECONDS = 30;

/** Voice message content, as far as duration estimation is concerned. */
export interface VoiceContentShape {
  text?: unknown;
  audioFileUrl?: unknown;
  speechRate?: unknown;
}

/**
 * Estimate how long one voice call will run, in seconds.
 *
 * Deliberately an estimate: no provider reports actual duration back to
 * Maildrill, so the trial budget is spent against the script we are about to
 * read rather than against a measurement. Reading the text at
 * `VOICE_WORDS_PER_MINUTE`, adjusted by `speechRate`, plus connect overhead.
 *
 * Rounds up — a partially spoken second is a spent second, and rounding down
 * would let a long tail of short calls drift over the allowance.
 */
export function estimateVoiceSeconds(content: VoiceContentShape | null | undefined): number {
  const text = typeof content?.text === 'string' ? content.text.trim() : '';
  if (!text) {
    const audio = typeof content?.audioFileUrl === 'string' ? content.audioFileUrl.trim() : '';
    return audio ? VOICE_AUDIO_FALLBACK_SECONDS : VOICE_CONNECT_SECONDS;
  }

  const rateRaw =
    typeof content?.speechRate === 'number' ? content.speechRate : Number(content?.speechRate);
  // Infobip accepts roughly 0.5–2.0; anything outside that (or unset/NaN)
  // falls back to the neutral pace rather than distorting the estimate.
  const rate = Number.isFinite(rateRaw) && rateRaw >= 0.5 && rateRaw <= 2 ? rateRaw : 1;

  const words = text.split(/\s+/).filter(Boolean).length;
  const spoken = (words / VOICE_WORDS_PER_MINUTE) * 60;
  return Math.ceil(VOICE_CONNECT_SECONDS + spoken / rate);
}
