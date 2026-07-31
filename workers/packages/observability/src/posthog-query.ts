import { config } from '@maildrill/config';
import { pino } from 'pino';

// Standalone child logger — avoid importing ./index (circular with re-exports).
const log = pino({ level: config.log.level }).child({ component: 'posthog-query' });

/** Only allow values safe to interpolate into HogQL string literals. */
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function hogqlLiteral(value: string): string | null {
  if (!SAFE_ID.test(value)) return null;
  return `'${value}'`;
}

export function hogqlLiteralList(values: string[]): string[] | null {
  const out: string[] = [];
  for (const v of values) {
    const lit = hogqlLiteral(v);
    if (!lit) return null;
    out.push(lit);
  }
  return out;
}

export interface HogQLResult {
  columns: string[];
  /** Row values aligned with `columns`. */
  results: unknown[][];
}

interface HogQLQueryResponse {
  columns?: string[];
  results?: unknown[][];
  error?: string;
}

/**
 * Run a HogQL query against the configured PostHog project.
 * Returns null when stats are disabled, the query is refused, or the API errors.
 */
export async function runHogQL(
  query: string,
  name = 'maildrill-stats',
): Promise<HogQLResult | null> {
  if (!config.posthog.statsEnabled) return null;

  const { personalApiKey, projectId, appHost } = config.posthog;
  const url = `${appHost}/api/projects/${encodeURIComponent(projectId)}/query/`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        query: { kind: 'HogQLQuery', query },
      }),
      // Hard deadline: a hung request (e.g. a socket killed by laptop sleep)
      // must error out, not freeze the caller — the delivery poller awaits
      // this in its tick loop, and an unresolved await stalls it forever.
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.warn(
        { status: res.status, body: body.slice(0, 400), name },
        'posthog hogql query failed',
      );
      return null;
    }

    const data = (await res.json()) as HogQLQueryResponse;
    if (data.error) {
      log.warn({ error: data.error, name }, 'posthog hogql query error field');
      return null;
    }

    const columns = Array.isArray(data.columns) ? data.columns.map(String) : [];
    const results = Array.isArray(data.results) ? data.results : [];
    if (!Array.isArray(results) || results.some((r) => !Array.isArray(r))) {
      log.warn({ name }, 'posthog hogql unexpected result shape');
      return null;
    }

    return { columns, results: results as unknown[][] };
  } catch (err) {
    log.warn({ err, name }, 'posthog hogql request threw');
    return null;
  }
}

export function columnIndex(columns: string[], name: string): number {
  return columns.indexOf(name);
}

export function cellNumber(row: unknown[], idx: number): number {
  if (idx < 0 || idx >= row.length) return 0;
  const v = row[idx];
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function cellString(row: unknown[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  const v = row[idx];
  return v == null ? '' : String(v);
}
