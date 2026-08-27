/**
 * Browser-side Automations client and view models.
 *
 * Every call goes through the same-origin BFF (`/api/v1/*`), which mints the tenant-scoped
 * token — the browser never names a workspace. See `src/lib/app/api.ts`.
 */
import { api } from './api';
import type { FlowDefinition } from './automation-flow';

export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived';
export type RunStatus = 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled';

export interface AutomationSummary {
  id: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  triggerLabel: string | null;
  version: number;
  publishedVersion: number | null;
  hasUnpublishedChanges: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationVersionRow {
  id: string;
  version: number;
  state: 'draft' | 'published' | 'archived';
  trigger: unknown;
  valid: boolean;
  validationErrors: ValidationIssue[];
  publishedAt: string | null;
}

export interface ValidationIssue {
  stepName: string | null;
  message: string;
}

export interface AutomationDetail extends AutomationSummary {
  draft: AutomationVersionRow;
  published: AutomationVersionRow | null;
  webhook: { url: string; prefix: string } | null;
}

export interface StepRunRow {
  id: string;
  seq: number;
  stepName: string;
  displayName: string;
  stepType: string;
  pieceName: string | null;
  status: 'running' | 'succeeded' | 'failed' | 'paused' | 'skipped';
  input: unknown;
  output: unknown;
  errorMessage: string | null;
  errorCategory: string | null;
  attempt: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface RunRow {
  id: string;
  automationId: string;
  automationVersionId: string;
  status: RunStatus;
  source: string;
  triggerPayload: Record<string, unknown>;
  error: { stepName?: string | null; message?: string; category?: string } | null;
  resumeAt: string | null;
  resumeStepName: string | null;
  stepsExecuted: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// --- piece catalog ------------------------------------------------------------------

export interface PropMeta {
  type: string;
  displayName: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: { label: string; value: string | number | boolean }[];
  source?: string;
}

export interface ActionMeta {
  name: string;
  displayName: string;
  description: string;
  category: string;
  accent: string | null;
  props: Record<string, PropMeta>;
  sampleOutput: unknown;
}

export interface TriggerMeta extends Omit<ActionMeta, 'sampleOutput'> {
  samplePayload: unknown;
  eventTypes: string[];
}

/**
 * A stored credential, as the API returns it: name and shape only. The secret is
 * write-only by design and has no representation here at all.
 */
export interface ConnectionSummary {
  id: string;
  name: string;
  pieceName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PieceMeta {
  name: string;
  displayName: string;
  description: string;
  version: string;
  accent: string | null;
  actions: ActionMeta[];
  triggers: TriggerMeta[];
}

export const automationsApi = {
  list: (params: { q?: string; status?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ items: AutomationSummary[]; total: number }>(`automations${suffix}`);
  },
  create: (body: { name: string; description?: string | null; definition?: unknown }) =>
    api.post<AutomationDetail>('automations', body),
  get: (id: string) => api.get<AutomationDetail>(`automations/${id}`),
  rename: (id: string, body: { name?: string; description?: string | null }) =>
    api.patch<AutomationDetail>(`automations/${id}`, body),
  saveDraft: (id: string, definition: FlowDefinition) =>
    api.put<{ automation: AutomationDetail; errors: ValidationIssue[] }>(
      `automations/${id}/draft`,
      { definition },
    ),
  publish: (id: string) =>
    api.post<{ automation: AutomationDetail; errors: ValidationIssue[] }>(
      `automations/${id}/publish`,
    ),
  pause: (id: string) => api.post<AutomationDetail>(`automations/${id}/pause`),
  activate: (id: string) => api.post<AutomationDetail>(`automations/${id}/activate`),
  archive: (id: string) => api.post<AutomationDetail>(`automations/${id}/archive`),
  duplicate: (id: string) => api.post<AutomationDetail>(`automations/${id}/duplicate`),
  remove: (id: string) => api.del(`automations/${id}`),
  test: (id: string, payload: Record<string, unknown>, dryRun = true) =>
    api.post<{ runId: string }>(`automations/${id}/test`, { payload, dryRun }),
  mintWebhook: (id: string) =>
    api.post<{ url: string; prefix: string }>(`automations/${id}/webhook`),
  lastWebhookPayload: (id: string) =>
    api.get<{ payload: Record<string, unknown> | null }>(`automations/${id}/webhook/last-payload`),
  runs: (id: string, params: { status?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ items: RunRow[]; total: number }>(`automations/${id}/runs${suffix}`);
  },
  run: (runId: string) => api.get<{ run: RunRow; steps: StepRunRow[] }>(`automation-runs/${runId}`),
  cancelRun: (runId: string) => api.post(`automation-runs/${runId}/cancel`),
  pieces: () => api.get<{ data: PieceMeta[] }>('automation-pieces'),
  connections: () => api.get<{ data: ConnectionSummary[] }>('automation-connections'),
  createConnection: (body: {
    name: string;
    pieceName: string;
    secret: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) => api.post<ConnectionSummary>('automation-connections', body),
  deleteConnection: (id: string) => api.del(`automation-connections/${id}`),
  options: (source: string) =>
    api.get<{ data: { value: string; label: string }[] }>(`automation-options/${source}`),
};

// --- presentation helpers ------------------------------------------------------------

export const STATUS_LABEL: Record<AutomationStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
};

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting: 'Waiting',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Maps onto the workspace's shared `.astatus--*` chips so nothing new is invented. */
export function statusChipClass(status: AutomationStatus): string {
  switch (status) {
    case 'active':
      return 'astatus--active';
    case 'paused':
      return 'astatus--paused';
    case 'archived':
      return 'astatus--unsubscribed';
    default:
      return 'astatus--draft';
  }
}

export function runStatusChipClass(status: RunStatus): string {
  switch (status) {
    case 'succeeded':
      return 'astatus--sent';
    case 'failed':
      return 'astatus--bounced';
    case 'running':
    case 'queued':
      return 'astatus--sending';
    case 'waiting':
      return 'astatus--scheduled';
    default:
      return 'astatus--paused';
  }
}

/** `1,204 ms` / `2.4 s` / `1 m 04 s` — the run inspector's timing column. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes} m ${String(seconds).padStart(2, '0')} s`;
}

/** Terminal runs stop polling; everything else keeps the test panel live. */
export function isRunSettled(status: RunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
