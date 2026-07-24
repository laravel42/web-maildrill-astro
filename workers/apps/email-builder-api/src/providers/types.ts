/**
 * Common interface for LLM providers used by the AI backend.
 *
 * Each provider exposes a single `stream` method that returns a
 * `ReadableStream<string>` of plain text chunks. The route layer is
 * responsible for wrapping those chunks into the transport format
 * (e.g. SSE `data:` frames).
 */

export interface LLMStreamParams {
  /** System prompt (instructions + loaded context). */
  system: string;
  /** User prompt. */
  prompt: string;
  /** Optional model override. Providers fall back to their default when omitted. */
  model?: string;
  /** Optional cap on generated tokens. Providers fall back to their default when omitted. */
  maxTokens?: number;
}

export interface LLMProvider {
  stream(params: LLMStreamParams): ReadableStream<string>;
}
