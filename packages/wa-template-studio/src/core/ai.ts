/** Inline text AI for the body editor — same actions as the email editor's
 * bubble-menu AI dropdown, served by the same backend. */
export type WaAiAction =
  | 'rewrite'
  | 'grammar_check'
  | 'continue_writing'
  | 'shorter'
  | 'descriptive'
  | 'detailed'
  | 'friendly'
  | 'professional';

/**
 * Process body text through the host's AI backend (`/api/eb/ai/text-process`,
 * the same-origin BFF proxy the email builder uses — see
 * `useSubscriberFields` for the host-fetch pattern). `format: 'plain'` asks
 * for WhatsApp-safe plain text instead of the email editor's HTML.
 */
export async function processWaText(text: string, action: WaAiAction): Promise<string> {
  const res = await fetch('/api/eb/ai/text-process', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, action, format: 'plain' }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as { processedContent?: string };
  // Models occasionally fence the whole reply (```text … ```) despite the
  // prompt; unwrap only language-tagged fences so intentional WhatsApp
  // ```monospace``` in the result survives.
  const out = (data.processedContent ?? '')
    .replace(/^\s*```[a-z]+\s*\n/i, '')
    .replace(/\n```\s*$/, '')
    .trim();
  if (!out) throw new Error('AI returned an empty result');
  return out;
}
