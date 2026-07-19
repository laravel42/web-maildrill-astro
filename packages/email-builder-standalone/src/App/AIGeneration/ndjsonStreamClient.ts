import type { TEditorBlock } from '../../documents/editor/core';

/**
 * Events emitted by {@link parseNDJSONStream}.
 *
 * - `block` — one `{"id":"...","block":{...}}` payload arrived. `id` is the
 *   block id, `block` is a runtime `TEditorBlock` (not yet validated by Zod —
 *   that's L42-191's scope). `raw` carries the original SSE frame so the
 *   preview panel can show bytes on the wire.
 * - `done` — the terminator `data: [DONE]` arrived. No more events follow.
 * - `error` — the stream carried an `event: error\ndata: {...}` frame. The
 *   parser surfaces it but keeps reading; callers decide whether to stop.
 * - `warning` — the backend reported a non-fatal condition (e.g. a dropped
 *   duplicate id). Surfaced to the caller without interrupting the stream.
 * - `info` — backend metadata frame (e.g. `image_pool` status). Carries no
 *   block content; the parser exposes it so the UI can react if needed,
 *   otherwise it is silently consumed.
 * - `malformed` — a `data: ` payload could not be parsed as JSON. The parser
 *   logs it and keeps going.
 */
export type NDJSONEvent =
  | { kind: 'block'; id: string; block: TEditorBlock; raw: string; bytes: number }
  | { kind: 'done'; raw: string; bytes: number }
  | { kind: 'error'; payload: unknown; raw: string; bytes: number }
  | { kind: 'warning'; payload: unknown; raw: string; bytes: number }
  | { kind: 'info'; payload: unknown; raw: string; bytes: number }
  | { kind: 'malformed'; raw: string; reason: string; bytes: number };

/** Input shapes accepted by {@link parseNDJSONStream}. */
export type NDJSONSource = ReadableStream<string> | ReadableStream<Uint8Array> | AsyncIterable<string>;

/**
 * Normalises any supported source into an `AsyncIterable<string>`. Uses
 * `getReader()` explicitly because async iteration on `ReadableStream` is not
 * universally supported (older Safari in particular).
 */
function toAsyncIterable(source: NDJSONSource): AsyncIterable<string> {
  // A ReadableStream is also an object; check for it first.
  if (typeof ReadableStream !== 'undefined' && source instanceof ReadableStream) {
    return (async function* () {
      const reader = (source as ReadableStream<string | Uint8Array>).getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            const tail = decoder.decode();
            if (tail) yield tail;
            return;
          }
          if (value === undefined) continue;
          if (typeof value === 'string') yield value;
          else yield decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }
  // Already an AsyncIterable<string>.
  return source as AsyncIterable<string>;
}

/**
 * Parse one complete SSE frame (text between two `\n\n` separators, without
 * the trailing blank line). Yields one event per meaningful `data:` payload.
 * Ignores empty frames and unknown SSE fields (`id:`, `retry:`, comments).
 */
function* parseFrame(frame: string): Generator<NDJSONEvent, void, void> {
  const lines = frame.split('\n');
  let eventType: string | null = null;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    // SSE comments start with ':' — ignore.
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trimStart();
      continue;
    }
    if (line.startsWith('data:')) {
      // Per SSE spec, a single leading space after `data:` is stripped.
      const rest = line.slice('data:'.length);
      dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest);
      continue;
    }
    // Ignore `id:`, `retry:`, malformed lines — stay lenient.
  }

  const data = dataLines.join('\n');
  if (data.length === 0) return;

  const bytes = frame.length;

  if (data === '[DONE]') {
    yield { kind: 'done', raw: frame, bytes };
    return;
  }

  if (eventType === 'error') {
    let payload: unknown = data;
    try {
      payload = JSON.parse(data);
    } catch {
      // Keep raw text payload.
    }
    yield { kind: 'error', payload, raw: frame, bytes };
    return;
  }

  if (eventType === 'warning') {
    let payload: unknown = data;
    try {
      payload = JSON.parse(data);
    } catch {
      // Keep raw text payload.
    }
    yield { kind: 'warning', payload, raw: frame, bytes };
    return;
  }

  if (eventType === 'info') {
    // Metadata frame (e.g. `image_pool`). Surface as a parsed payload so
    // the UI can react, but never gate the stream on it.
    let payload: unknown = data;
    try {
      payload = JSON.parse(data);
    } catch {
      // Keep raw text payload.
    }
    yield { kind: 'info', payload, raw: frame, bytes };
    return;
  }

  // Default / `event: message` → expect { id, block } NDJSON per the @eb/backend contract.
  try {
    const parsed = JSON.parse(data) as { id?: unknown; block?: unknown };
    if (typeof parsed.id !== 'string' || typeof parsed.block !== 'object' || parsed.block === null) {
      yield { kind: 'malformed', raw: frame, reason: 'Missing or invalid {id, block} payload', bytes };
      return;
    }
    yield {
      kind: 'block',
      id: parsed.id,
      block: parsed.block as TEditorBlock,
      raw: frame,
      bytes,
    };
  } catch (err) {
    yield {
      kind: 'malformed',
      raw: frame,
      reason: err instanceof Error ? err.message : 'Invalid JSON',
      bytes,
    };
  }
}

/**
 * Parse an SSE/NDJSON stream into a flow of {@link NDJSONEvent}s.
 *
 * The stream must follow the `@eb/backend` contract:
 *
 * ```text
 * data: {"id":"root","block":{...EmailLayout...}}\n\n
 * data: {"id":"block-1","block":{...TEditorBlock...}}\n\n
 * ...
 * data: [DONE]\n\n
 * ```
 *
 * Behaviour:
 *
 * - Chunk boundaries are handled by buffering; a frame split across
 *   multiple reads is emitted only once fully received.
 * - A trailing frame without a final `\n\n` is flushed when the source ends.
 * - Malformed frames yield a `malformed` event but do NOT stop the stream.
 * - The `[DONE]` terminator yields a `done` event; callers must stop
 *   reading after it (subsequent frames would be undefined per the contract).
 */
export async function* parseNDJSONStream(source: NDJSONSource): AsyncGenerator<NDJSONEvent, void, void> {
  const iterable = toAsyncIterable(source);
  let buffer = '';
  for await (const chunk of iterable) {
    buffer += chunk;
    // SSE frames are terminated by a blank line, which is `\n\n` in LF streams
    // or `\r\n\r\n` in CRLF streams. Normalise CRLF to LF so the split below
    // works uniformly (the backend emits LF per the contract).
    buffer = buffer.replace(/\r\n/g, '\n');
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      yield* parseFrame(frame);
    }
  }
  // Flush trailing frame without final blank line.
  const tail = buffer.trim();
  if (tail.length > 0) {
    yield* parseFrame(tail);
  }
}
