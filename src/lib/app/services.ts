/**
 * Client-side service functions. Marketing-form stand-ins (sign-up, password
 * reset, contact) plus the EmailBuilder.js backend calls, which go through the
 * same-origin `/api/eb/*` BFF proxy to @eb/backend (provider keys stay server
 * side). The workspace data services were removed — the app reads/writes the
 * real API via the /api/v1 BFF proxy (see lib/app/api.ts and lib/server).
 */
import type {
  AIFeatureRequest,
  AIGenerateTemplateRequest,
  AIGenerateTemplateResponse,
} from 'email-builder-standalone';

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

/** Base path of the email-builder AI/image backend proxy. */
const EB_BASE = '/api/eb';

/**
 * Stream an AI-generated email template for the visual builder. Returns the
 * decoded SSE token stream so the editor can render the template progressively.
 * Forwards the caller's AbortSignal so "Cancel" aborts the upstream request.
 */
export async function builderGenerateTemplate(
  request: AIGenerateTemplateRequest,
  { signal }: { signal: AbortSignal },
): Promise<AIGenerateTemplateResponse> {
  const res = await fetch(`${EB_BASE}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt,
      currentDocument: request.currentDocument,
      locale: request.locale,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`AI template generation failed (${res.status})`);
  }
  return res.body.pipeThrough(new TextDecoderStream());
}

/**
 * Inline text AI (rewrite / shorten / fix grammar / expand …) for a selected
 * block. Maps the editor's AIFeatureRequest onto @eb/backend's text-process
 * endpoint and returns the processed HTML string.
 */
export async function builderTextAction(request: AIFeatureRequest): Promise<string> {
  const res = await fetch(`${EB_BASE}/ai/text-process`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: request.content || request.text, action: request.action }),
  });
  if (!res.ok) throw new Error(`AI text action failed (${res.status})`);
  const data = (await res.json()) as { processedContent?: string };
  // The backend sometimes wraps the result in a markdown code fence
  // (```html … ```). Strip it so the editor inserts clean HTML, not literal
  // backticks.
  return (data.processedContent ?? '')
    .replace(/^\s*```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export async function mockSignUp(_input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  await delay(500);
  return { ok: true };
}

export async function mockResetPassword(_email: string): Promise<{ ok: true }> {
  await delay(400);
  return { ok: true };
}

export async function mockContactSubmit(_input: {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  message: string;
}): Promise<{ ok: true }> {
  await delay(500);
  return { ok: true };
}
