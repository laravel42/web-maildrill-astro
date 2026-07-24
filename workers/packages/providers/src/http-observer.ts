/**
 * Optional observer for outbound provider HTTP calls (e.g. Infobip), consumed by
 * debugging tools such as Node Telescope. It is a no-op until a sink is installed
 * via `setProviderHttpSink`, so production and every other consumer are unaffected.
 */

export interface ProviderHttpEvent {
  provider: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  /** Raw request body as sent (JSON string), if any. */
  requestBody?: string;
  status: number;
  responseHeaders: Record<string, string>;
  /** Raw response body text, if any. */
  responseBody?: string;
  durationMs: number;
  /** Set instead of a status when the request failed at the network layer. */
  error?: string;
}

let sink: ((event: ProviderHttpEvent) => void) | null = null;

export function setProviderHttpSink(fn: ((event: ProviderHttpEvent) => void) | null): void {
  sink = fn;
}

export function emitProviderHttp(event: ProviderHttpEvent): void {
  if (!sink) return;
  try {
    sink(event);
  } catch {
    /* observation must never break a send */
  }
}

/** Mask credential headers (Infobip's `Authorization: App <key>`) before observation. */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] =
      k.toLowerCase() === "authorization" ? `${v.split(" ")[0] ?? "App"} ***` : v;
  }
  return out;
}
