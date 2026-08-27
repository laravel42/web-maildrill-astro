import { defineAction, definePiece, Property } from '@maildrill/activepieces-core';
import { ValidationError } from '@maildrill/domain';
import { AutomationStepError } from '../domain/retry';
import type { MaildrillPieceContext } from './context';
import { performHttpRequest } from './http-client';

/** Data pieces: shape values and talk to an external HTTP API. */

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new ValidationError(`${what} must be a JSON object`);
    }
  }
  throw new ValidationError(`${what} must be a JSON object`);
}

export const dataPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/data',
  displayName: 'Data',
  description: 'Call external APIs.',
  version: '1.0.0',
  accent: '--text3',
  triggers: [],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'http_request',
      displayName: 'HTTP request',
      description: 'Call an external HTTP API.',
      category: 'Data',
      accent: '--text3',
      props: {
        method: Property.StaticDropdown({
          displayName: 'Method',
          required: true,
          defaultValue: 'GET',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PUT', value: 'PUT' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'DELETE', value: 'DELETE' },
          ],
        }),
        url: Property.ShortText({
          displayName: 'URL',
          required: true,
          placeholder: 'https://api.example.com/v1/orders',
        }),
        headers: Property.Json({ displayName: 'Headers' }),
        body: Property.Json({ displayName: 'Body' }),
      },
      sampleOutput: { status: 200, headers: {}, body: {}, truncated: false },
      async run({ propsValue, ctx }) {
        const method = String(propsValue.method ?? 'GET').toUpperCase();
        const url = String(propsValue.url ?? '').trim();
        if (!url) throw new ValidationError('URL is required');

        const headerObject = asObject(propsValue.headers, 'headers');
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(headerObject)) {
          headers[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }

        // A connection supplies credentials without them ever appearing in the flow JSON.
        const connection = await ctx.connection();
        if (connection) {
          if (typeof connection.apiKey === 'string') {
            const header =
              typeof connection.header === 'string' ? connection.header : 'Authorization';
            const prefix = typeof connection.prefix === 'string' ? connection.prefix : 'Bearer ';
            headers[header] = `${prefix}${connection.apiKey}`;
          }
          const extra = connection.headers;
          if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
            for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
              headers[key] = String(value);
            }
          }
        }

        const hasBody = method !== 'GET' && method !== 'DELETE';
        const bodyValue = propsValue.body;
        const body =
          hasBody && bodyValue !== undefined && bodyValue !== null && bodyValue !== ''
            ? typeof bodyValue === 'string'
              ? bodyValue
              : JSON.stringify(bodyValue)
            : undefined;

        if (ctx.dryRun) {
          return { dryRun: true, wouldRequest: { method, url } };
        }

        const response = await performHttpRequest({ url, method, headers, body }, ctx.limits);
        // A 4xx is a permanent answer; a 5xx or 429 is worth retrying. Surfacing this as
        // an error (rather than a status field) is what lets the retry classifier see it.
        if (response.status >= 500 || response.status === 429) {
          throw new AutomationStepError(
            `HTTP ${response.status} from ${url}`,
            response.status === 429 ? 'rate_limit' : 'temporary',
            { status: response.status },
          );
        }
        if (response.status >= 400) {
          throw new AutomationStepError(`HTTP ${response.status} from ${url}`, 'permanent', {
            status: response.status,
            body: response.body,
          });
        }
        return response;
      },
    }),
  ],
});
