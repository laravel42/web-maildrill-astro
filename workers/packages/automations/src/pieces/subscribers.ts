import { defineAction, definePiece, defineTrigger, Property } from '@maildrill/activepieces-core';
import { NotFoundError, ValidationError } from '@maildrill/domain';
import {
  addToList,
  assignTag,
  createTag,
  getList,
  getSubscriber,
  listTags,
  removeFromList,
  unassignTag,
} from '@maildrill/product';
import type { MaildrillPieceContext } from './context';

const SAMPLE_SUBSCRIBER = {
  id: '5e1f1f2c-0b3a-4a2b-9b6e-1f2a3b4c5d6e',
  email: 'ada@example.com',
  phone: '+15551234567',
  name: 'Ada Lovelace',
  status: 'active',
  attributes: { plan: 'pro', city: 'London' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Trigger payloads all share this envelope, so `{{trigger.subscriber.email}}` is stable. */
const subscriberSample = (extra: Record<string, unknown> = {}) => ({
  subscriber: SAMPLE_SUBSCRIBER,
  ...extra,
});

/** Only fire for the configured list/segment/tag; an empty prop means "any". */
function matchesId(key: string) {
  return ({ propsValue, payload }: { propsValue: Record<string, unknown>; payload: unknown }) => {
    const wanted = propsValue[key];
    if (typeof wanted !== 'string' || wanted.length === 0) return true;
    const actual = (payload as Record<string, unknown> | null)?.[key];
    return actual === wanted;
  };
}

async function requireSubscriber(tenantId: string, subscriberId: unknown) {
  if (typeof subscriberId !== 'string' || subscriberId.length === 0) {
    throw new ValidationError('subscriber is required');
  }
  const found = await getSubscriber(tenantId, subscriberId);
  if (!found) throw new NotFoundError('subscriber not found in this workspace');
  return found;
}

export const subscribersPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/subscribers',
  displayName: 'Subscribers',
  description: 'Contacts, lists and tags in this workspace.',
  version: '1.0.0',
  accent: '--accent',
  triggers: [
    defineTrigger({
      name: 'subscriber_created',
      displayName: 'Subscriber created',
      description: 'A new subscriber was added to the workspace.',
      category: 'Subscribers',
      accent: '--accent',
      props: {},
      eventTypes: ['subscriber.created'],
      samplePayload: subscriberSample(),
    }),
    defineTrigger({
      name: 'subscriber_updated',
      displayName: 'Subscriber updated',
      description: "A subscriber's details or status changed.",
      category: 'Subscribers',
      accent: '--accent',
      props: {},
      eventTypes: ['subscriber.updated'],
      samplePayload: subscriberSample(),
    }),
    defineTrigger({
      name: 'subscriber_unsubscribed',
      displayName: 'Subscriber unsubscribed',
      description: 'A subscriber opted out.',
      category: 'Subscribers',
      accent: '--warning',
      props: {},
      eventTypes: ['subscriber.unsubscribed'],
      samplePayload: subscriberSample(),
    }),
    defineTrigger({
      name: 'subscriber_added_to_list',
      displayName: 'Subscriber added to list',
      description: 'A subscriber joined a list.',
      category: 'Subscribers',
      accent: '--accent',
      props: {
        listId: Property.DynamicDropdown({
          displayName: 'List',
          description: 'Leave empty to fire for every list.',
          source: 'lists',
        }),
      },
      eventTypes: ['subscriber.list.added'],
      samplePayload: subscriberSample({ listId: SAMPLE_SUBSCRIBER.id, listName: 'Trial users' }),
      matches: matchesId('listId'),
    }),
    defineTrigger({
      name: 'subscriber_removed_from_list',
      displayName: 'Subscriber removed from list',
      description: 'A subscriber left a list.',
      category: 'Subscribers',
      accent: '--warning',
      props: {
        listId: Property.DynamicDropdown({
          displayName: 'List',
          description: 'Leave empty to fire for every list.',
          source: 'lists',
        }),
      },
      eventTypes: ['subscriber.list.removed'],
      samplePayload: subscriberSample({ listId: SAMPLE_SUBSCRIBER.id, listName: 'Trial users' }),
      matches: matchesId('listId'),
    }),
    defineTrigger({
      name: 'subscriber_enters_segment',
      displayName: 'Subscriber enters segment',
      description: 'A subscriber started matching a segment.',
      category: 'Subscribers',
      accent: '--accent',
      props: {
        segmentId: Property.DynamicDropdown({
          displayName: 'Segment',
          description: 'Membership is re-evaluated on a schedule, so this is near-real-time.',
          source: 'segments',
          required: true,
        }),
      },
      eventTypes: ['subscriber.segment.entered'],
      samplePayload: subscriberSample({
        segmentId: SAMPLE_SUBSCRIBER.id,
        segmentName: 'Trial users',
      }),
      matches: matchesId('segmentId'),
    }),
    defineTrigger({
      name: 'subscriber_exits_segment',
      displayName: 'Subscriber exits segment',
      description: 'A subscriber stopped matching a segment.',
      category: 'Subscribers',
      accent: '--warning',
      props: {
        segmentId: Property.DynamicDropdown({
          displayName: 'Segment',
          source: 'segments',
          required: true,
        }),
      },
      eventTypes: ['subscriber.segment.exited'],
      samplePayload: subscriberSample({
        segmentId: SAMPLE_SUBSCRIBER.id,
        segmentName: 'Trial users',
      }),
      matches: matchesId('segmentId'),
    }),
    defineTrigger({
      name: 'subscriber_tag_added',
      displayName: 'Tag added to subscriber',
      description: 'A tag was applied to a subscriber.',
      category: 'Subscribers',
      accent: '--accent',
      props: {
        tagName: Property.ShortText({
          displayName: 'Tag name',
          description: 'Leave empty to fire for every tag.',
        }),
      },
      eventTypes: ['subscriber.tag.added'],
      samplePayload: subscriberSample({ tagName: 'engaged' }),
      matches: ({ propsValue, payload }) => {
        const wanted = propsValue.tagName;
        if (typeof wanted !== 'string' || wanted.trim().length === 0) return true;
        const actual = (payload as Record<string, unknown> | null)?.tagName;
        return typeof actual === 'string' && actual.toLowerCase() === wanted.trim().toLowerCase();
      },
    }),
    defineTrigger({
      name: 'subscriber_tag_removed',
      displayName: 'Tag removed from subscriber',
      description: 'A tag was removed from a subscriber.',
      category: 'Subscribers',
      accent: '--warning',
      props: {
        tagName: Property.ShortText({ displayName: 'Tag name' }),
      },
      eventTypes: ['subscriber.tag.removed'],
      samplePayload: subscriberSample({ tagName: 'engaged' }),
    }),
  ],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'add_tag',
      displayName: 'Add tag',
      description: 'Tag a subscriber, creating the tag if it does not exist.',
      category: 'Subscribers',
      accent: '--accent',
      props: {
        subscriberId: Property.ShortText({
          displayName: 'Subscriber ID',
          required: true,
          placeholder: '{{trigger.subscriber.id}}',
        }),
        tagName: Property.ShortText({ displayName: 'Tag', required: true }),
      },
      sampleOutput: { tagged: true, tagId: SAMPLE_SUBSCRIBER.id },
      async run({ propsValue, ctx }) {
        const sub = await requireSubscriber(ctx.tenantId, propsValue.subscriberId);
        const wanted = String(propsValue.tagName ?? '').trim();
        if (!wanted) throw new ValidationError('tag is required');
        if (ctx.dryRun) return { dryRun: true, wouldTag: wanted };
        const existing = (await listTags(ctx.tenantId)).find(
          (t) => t.name.toLowerCase() === wanted.toLowerCase(),
        );
        const tag = existing ?? (await createTag(ctx.tenantId, wanted));
        await assignTag(ctx.tenantId, tag.id, sub.id);
        return { tagged: true, tagId: tag.id, tagName: tag.name };
      },
    }),
    defineAction<MaildrillPieceContext>({
      name: 'remove_tag',
      displayName: 'Remove tag',
      description: 'Remove a tag from a subscriber.',
      category: 'Subscribers',
      accent: '--warning',
      props: {
        subscriberId: Property.ShortText({ displayName: 'Subscriber ID', required: true }),
        tagName: Property.ShortText({ displayName: 'Tag', required: true }),
      },
      sampleOutput: { removed: true },
      async run({ propsValue, ctx }) {
        const sub = await requireSubscriber(ctx.tenantId, propsValue.subscriberId);
        const wanted = String(propsValue.tagName ?? '')
          .trim()
          .toLowerCase();
        const tag = (await listTags(ctx.tenantId)).find((t) => t.name.toLowerCase() === wanted);
        if (!tag) return { removed: false, reason: 'tag not found' };
        if (ctx.dryRun) return { dryRun: true, wouldRemove: tag.name };
        await unassignTag(tag.id, sub.id);
        return { removed: true, tagId: tag.id };
      },
    }),
    defineAction<MaildrillPieceContext>({
      name: 'add_to_list',
      displayName: 'Add to list',
      description: 'Add a subscriber to a list.',
      category: 'Subscribers',
      accent: '--accent',
      props: {
        subscriberId: Property.ShortText({ displayName: 'Subscriber ID', required: true }),
        listId: Property.DynamicDropdown({
          displayName: 'List',
          source: 'lists',
          required: true,
        }),
      },
      sampleOutput: { added: true },
      async run({ propsValue, ctx }) {
        const sub = await requireSubscriber(ctx.tenantId, propsValue.subscriberId);
        const listId = String(propsValue.listId ?? '');
        // Scoped read: a list id from another workspace resolves to nothing here.
        const list = await getList(ctx.tenantId, listId);
        if (!list) throw new NotFoundError('list not found in this workspace');
        if (ctx.dryRun) return { dryRun: true, wouldAddTo: list.name };
        await addToList(ctx.tenantId, list.id, sub.id);
        return { added: true, listId: list.id, listName: list.name };
      },
    }),
    defineAction<MaildrillPieceContext>({
      name: 'remove_from_list',
      displayName: 'Remove from list',
      description: 'Remove a subscriber from a list.',
      category: 'Subscribers',
      accent: '--warning',
      props: {
        subscriberId: Property.ShortText({ displayName: 'Subscriber ID', required: true }),
        listId: Property.DynamicDropdown({
          displayName: 'List',
          source: 'lists',
          required: true,
        }),
      },
      sampleOutput: { removed: true },
      async run({ propsValue, ctx }) {
        const sub = await requireSubscriber(ctx.tenantId, propsValue.subscriberId);
        const list = await getList(ctx.tenantId, String(propsValue.listId ?? ''));
        if (!list) throw new NotFoundError('list not found in this workspace');
        if (ctx.dryRun) return { dryRun: true, wouldRemoveFrom: list.name };
        await removeFromList(list.id, sub.id);
        return { removed: true, listId: list.id };
      },
    }),
  ],
});
