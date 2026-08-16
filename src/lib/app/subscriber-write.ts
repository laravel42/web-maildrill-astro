import { api } from './api';
import type { SubscriberStatus } from '@/types/app';
import type { ApiSubscriber } from './subscriber-map';
import type { SubscriberImportOutcome, SubscriberImportPayload } from './subscriber-import';

type CreateSubscriberInput = {
  email: string;
  phone: string;
  name: string;
  status: SubscriberStatus;
  listIds: string[];
  tags: string[];
};

/** Add and drop list memberships so the editor's multi-select is one save. */
export async function applyListMembership(
  subscriberId: string,
  currentListIds: string[],
  nextListIds: string[],
): Promise<void> {
  const next = new Set(nextListIds);
  const current = new Set(currentListIds);
  const toRemove = currentListIds.filter((id) => !next.has(id));
  const toAdd = nextListIds.filter((id) => !current.has(id));
  await Promise.allSettled([
    ...toRemove.map((id) => api.del(`lists/${id}/members/${subscriberId}`)),
    ...toAdd.map((id) => api.post(`lists/${id}/members`, { subscriberId })),
  ]);
}

/**
 * Create any new custom-field definitions, then POST the mapped rows.
 * An already-present field key is a benign conflict and is ignored.
 */
export async function importSubscribers(
  payload: SubscriberImportPayload,
): Promise<SubscriberImportOutcome> {
  for (const key of payload.newFields) {
    await api.post('custom-fields', { key, type: 'text' }).catch(() => undefined);
  }
  return api.post<SubscriberImportOutcome>('subscribers/import', {
    rows: payload.rows,
    ...(payload.listIds.length ? { listIds: payload.listIds } : {}),
  });
}

/** Create one subscriber and attach the chosen lists. */
export async function createSubscriber(values: CreateSubscriberInput): Promise<ApiSubscriber> {
  const created = await api.post<ApiSubscriber>('subscribers', {
    email: values.email,
    phone: values.phone || undefined,
    name: values.name || undefined,
    status: values.status,
    attributes: { tags: values.tags },
  });
  await applyListMembership(created.id, [], values.listIds);
  return api.get<ApiSubscriber>(`subscribers/${created.id}`);
}
