import { describe, it, expect } from 'vitest';
import { InfobipProvider } from './infobip';
import { MockProvider } from './mock';
import type { ProviderWebhookInput } from './core';

const wh = (body: unknown): ProviderWebhookInput => ({
  headers: {},
  rawBody: '',
  kind: 'template',
  body,
});

describe('InfobipProvider.normalizeTemplateWebhook', () => {
  const p = new InfobipProvider();

  it('maps an APPROVED status update', () => {
    const ev = p.normalizeTemplateWebhook(
      wh({
        messageTemplateId: 111,
        messageTemplateName: 'welcome',
        change: { type: 'TEMPLATE_STATUS_UPDATE', newStatus: 'APPROVED', reason: 'NONE' },
      }),
    );
    expect(ev).toEqual({
      providerTemplateId: '111',
      name: 'welcome',
      status: 'approved',
      rejectionReason: undefined,
    });
  });

  it('maps REJECTED and keeps a real rejection reason', () => {
    const ev = p.normalizeTemplateWebhook(
      wh({ messageTemplateId: 222, change: { newStatus: 'REJECTED', reason: 'INVALID_FORMAT' } }),
    );
    expect(ev?.status).toBe('rejected');
    expect(ev?.rejectionReason).toBe('INVALID_FORMAT');
  });

  it("collapses paused/flagged states to 'paused'", () => {
    for (const s of ['FLAGGED', 'FIRST_PAUSED', 'SECOND_PAUSED']) {
      expect(
        p.normalizeTemplateWebhook(wh({ messageTemplateId: 5, change: { newStatus: s } }))?.status,
      ).toBe('paused');
    }
  });

  it("collapses deleted/disabled states to 'disabled'", () => {
    for (const s of ['DISABLED', 'DELETED', 'PENDING_DELETION']) {
      expect(
        p.normalizeTemplateWebhook(wh({ messageTemplateId: 6, change: { newStatus: s } }))?.status,
      ).toBe('disabled');
    }
  });

  it('returns null without a template id or status', () => {
    expect(p.normalizeTemplateWebhook(wh({}))).toBeNull();
    expect(p.normalizeTemplateWebhook(wh({ messageTemplateId: 1 }))).toBeNull();
  });
});

describe('MockProvider template register', () => {
  const p = new MockProvider();

  it('returns pending with a deterministic id', async () => {
    const r = await p.registerWhatsAppTemplate({
      sender: '17578356612',
      name: 'welcome',
      language: 'en',
      category: 'MARKETING',
      structure: { body: { text: 'hi {{1}}' } },
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe('pending');
    expect(r.providerTemplateId).toMatch(/^mock-tpl-/);

    const again = await p.registerWhatsAppTemplate({
      sender: '17578356612',
      name: 'welcome',
      language: 'en',
      category: 'MARKETING',
      structure: { body: { text: 'hi {{1}}' } },
    });
    expect(again.providerTemplateId).toBe(r.providerTemplateId);
  });

  it("rejects a template whose name contains 'reject'", async () => {
    const r = await p.registerWhatsAppTemplate({
      sender: '1',
      name: 'reject_me',
      language: 'en',
      category: 'MARKETING',
      structure: { body: { text: 'x' } },
    });
    expect(r.status).toBe('rejected');
  });
});
