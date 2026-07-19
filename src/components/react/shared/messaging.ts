/**
 * Message-composition maths shared by the campaign wizard and the builder's
 * non-email editors.
 */

/** Number of 160-char SMS segments a message occupies (min 1). */
export function smsSegments(len: number): number {
  return Math.max(1, Math.ceil((len || 1) / 160));
}

/** Word count of a message (whitespace-separated, empty → 0). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Estimated spoken duration in seconds for a voice script (~2.5 words/sec). */
export function voiceSeconds(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 2.5));
}

/** `mm:ss` formatting for a duration in seconds. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
