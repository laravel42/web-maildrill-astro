import { describe, expect, it } from 'vitest';
import {
  hashTemplateId,
  templateHasContent,
  toApprovalStatus,
  toGalleryTemplate,
  type ApiTemplate,
} from '@/lib/app/template-map';

const base: ApiTemplate = { id: 'tpl-1', name: 'Welcome', channel: 'email' };

describe('toApprovalStatus', () => {
  it('accepts known statuses and rejects everything else', () => {
    expect(toApprovalStatus('approved')).toBe('approved');
    expect(toApprovalStatus('pending')).toBe('pending');
    expect(toApprovalStatus('sideways')).toBeNull();
    expect(toApprovalStatus(null)).toBeNull();
  });
});

describe('hashTemplateId', () => {
  it('is deterministic and non-negative', () => {
    expect(hashTemplateId('abc')).toBe(hashTemplateId('abc'));
    expect(hashTemplateId('abc')).toBeGreaterThanOrEqual(0);
    expect(hashTemplateId('abc')).not.toBe(hashTemplateId('abd'));
  });
});

describe('templateHasContent', () => {
  it('accepts html or text bodies', () => {
    expect(templateHasContent({ html: '<p>hi</p>' })).toBe(true);
    expect(templateHasContent({ text: 'hi' })).toBe(true);
    expect(templateHasContent({ html: '   ', text: '' })).toBe(false);
  });

  it('inspects WhatsApp component blobs', () => {
    expect(templateHasContent({ components: { body: { text: 'hello' } } })).toBe(true);
    expect(templateHasContent({ components: { header: { format: 'IMAGE' } } })).toBe(true);
    expect(templateHasContent({ components: { header: { format: 'TEXT', text: '' } } })).toBe(
      false,
    );
    expect(templateHasContent({ components: { footer: { text: 'bye' } } })).toBe(true);
    expect(templateHasContent({ components: { buttons: [{ text: 'Go' }] } })).toBe(true);
    expect(templateHasContent({ components: {} })).toBe(false);
    expect(templateHasContent({})).toBe(false);
  });
});

describe('toGalleryTemplate', () => {
  it('maps live rows with real fields and honest zero rates', () => {
    const g = toGalleryTemplate(base);
    expect(g.name).toBe('Welcome');
    expect(g.channel).toBe('email');
    expect(g.category).toBe('Newsletter'); // default
    expect(g.avgOpen).toBe(0);
    expect(g.avgClick).toBe(0);
  });

  it('normalizes unknown channels and legacy categories', () => {
    const g = toGalleryTemplate({ ...base, channel: 'fax', category: 'Announcement' });
    expect(g.channel).toBe('email');
    expect(g.category).toBe('Newsletter');
  });

  it('computes rates from tracked deliveries', () => {
    const g = toGalleryTemplate({ ...base, trackedDelivered: 50, opened: 25, clicked: 5 });
    expect(g.avgOpen).toBe(50);
    expect(g.avgClick).toBe(10);
  });
});
