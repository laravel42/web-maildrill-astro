import { describe, expect, it } from 'vitest';
import {
  allPieces,
  getAction,
  getTrigger,
  pieceCatalog,
  subscribedEventTypes,
  triggersForEvent,
} from './registry';

describe('piece registry', () => {
  it('exposes the v1 trigger and action set', () => {
    const actionNames = allPieces().flatMap((p) => p.actions.map((a) => `${p.name}.${a.name}`));
    for (const required of [
      '@maildrill/email.send_email',
      '@maildrill/sms.send_sms',
      '@maildrill/whatsapp.send_whatsapp',
      '@maildrill/subscribers.find_subscriber',
      '@maildrill/subscribers.update_subscriber',
      '@maildrill/subscribers.add_to_list',
      '@maildrill/subscribers.remove_from_list',
      '@maildrill/subscribers.add_tag',
      '@maildrill/subscribers.remove_tag',
      '@maildrill/data.http_request',
      '@maildrill/data.set_variables',
      '@maildrill/logic.delay',
      '@maildrill/logic.filter',
    ]) {
      expect(actionNames, required).toContain(required);
    }

    const triggerNames = allPieces().flatMap((p) => p.triggers.map((t) => `${p.name}.${t.name}`));
    for (const required of [
      '@maildrill/subscribers.subscriber_created',
      '@maildrill/subscribers.subscriber_added_to_list',
      '@maildrill/subscribers.subscriber_enters_segment',
      '@maildrill/campaigns.campaign_delivered',
      '@maildrill/campaigns.campaign_opened',
      '@maildrill/campaigns.campaign_clicked',
      '@maildrill/webhook.catch_webhook',
      '@maildrill/manual.manual_trigger',
    ]) {
      expect(triggerNames, required).toContain(required);
    }
  });

  it('indexes triggers by the domain events they listen for', () => {
    expect(subscribedEventTypes()).toContain('subscriber.created');
    const bindings = triggersForEvent('campaign.delivered');
    expect(bindings.map((b) => b.trigger.name)).toEqual(['campaign_delivered']);
    // Entry points are not event-driven, so nothing routes to them.
    expect(triggersForEvent('nothing.listens.to.this')).toHaveLength(0);
  });

  it('lets a trigger narrow itself to one list', () => {
    const trigger = getTrigger('@maildrill/subscribers', 'subscriber_added_to_list');
    expect(trigger?.matches).toBeDefined();
    const payload = { listId: 'list-a' };
    // Unset means "any list".
    expect(trigger?.matches?.({ propsValue: {}, payload })).toBe(true);
    expect(trigger?.matches?.({ propsValue: { listId: 'list-a' }, payload })).toBe(true);
    expect(trigger?.matches?.({ propsValue: { listId: 'list-b' }, payload })).toBe(false);
  });

  it('serializes a catalog with no executable code in it', () => {
    const catalog = pieceCatalog();
    expect(catalog.length).toBe(allPieces().length);
    // Whatever the composer receives must be JSON — a `run` function leaking into the
    // response would be silently dropped and make the catalog lie about itself.
    expect(() => JSON.stringify(catalog)).not.toThrow();
    expect(JSON.stringify(catalog)).not.toContain('function');
  });

  it('returns undefined for an action that no longer exists', () => {
    expect(getAction('@maildrill/email', 'send_carrier_pigeon')).toBeUndefined();
    expect(getAction('@nope/nope', 'send_email')).toBeUndefined();
  });
});
