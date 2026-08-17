import { describe, expect, it } from 'vitest';
import { rateBucket } from '@/lib/app/templates-data';
import {
  hashTemplateId,
  templateClickMetric,
  templateEngagement,
  templateHasContent,
  templateOpenMetric,
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
  it('maps live rows, and reports null — not zero — when nothing was measured', () => {
    const g = toGalleryTemplate(base);
    expect(g.name).toBe('Welcome');
    expect(g.channel).toBe('email');
    expect(g.category).toBe('Newsletter'); // default
    // A template never sent has no rate. It used to map to the NUMBER 0, which
    // the gallery rendered as a confident "0% opens" on 148 of 229 templates.
    expect(g.avgOpen).toBeNull();
    expect(g.avgClick).toBeNull();
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

describe('templateEngagement', () => {
  const g = (over: Partial<ApiTemplate>) => toGalleryTemplate({ ...base, ...over });

  it('reports opens and clicks for email, from its own tracked deliveries', () => {
    const m = templateEngagement(g({ trackedDelivered: 50, opened: 25, clicked: 5, sent: 60 }));
    expect(m.map((x) => [x.label, x.value])).toEqual([
      ['opens', '50%'],
      ['clicks', '10%'],
    ]);
    expect(m.every((x) => x.measured)).toBe(true);
  });

  it('calls a WhatsApp open a "seen"', () => {
    const m = templateEngagement(
      g({ channel: 'whatsapp', trackedDelivered: 100, opened: 33, sent: 120 }),
    );
    expect(m[0]!.label).toBe('seen');
    expect(m[0]!.value).toBe('33%');
  });

  it('gives SMS and voice the outcomes they DO produce, never an open rate', () => {
    // "Perf template 113" — badged SMS — rendered "33% opens" off 5,294 EMAIL
    // deliveries, because the aggregate charged it with a run on another
    // channel and the card printed whatever it held. SMS reports delivery and
    // failures, so that is what it shows.
    const m = templateEngagement(g({ channel: 'sms', sent: 5883, delivered: 5294, failed: 589 }));
    expect(m.map((x) => [x.label, x.value])).toEqual([
      ['delivered', '90%'],
      ['failed', '589'],
    ]);
    expect(m[0]!.hint).toContain('SMS reports no opens or clicks');
  });

  it('renders "—" for a template that has never been sent', () => {
    const never = templateEngagement(g({}));
    expect(never.map((x) => x.value)).toEqual(['—', '—']);
    expect(never.every((x) => x.measured)).toBe(false);
    expect(never[0]!.hint).toContain('never been sent');

    const neverSms = templateEngagement(g({ channel: 'sms' }));
    expect(neverSms.map((x) => x.value)).toEqual(['—', '—']);
  });

  it('says WHY an email template with sends still has no rate', () => {
    // Sent, but its campaigns went out on another channel, so nothing on this
    // template's own channel was ever delivered.
    const m = templateEngagement(g({ sent: 5882, delivered: 5293, failed: 589 }));
    expect(m.map((x) => x.value)).toEqual(['—', '—']);
    expect(m[0]!.hint).toBe("Not measured — this template's campaigns did not go out on Email");
  });

  it('gives the fixed list columns a value for every channel', () => {
    // The Opens/Clicks columns are fixed, so a delivery-only channel has to
    // resolve to "—" rather than to the delivery metric under an "Opens" head.
    const sms = g({ channel: 'sms', sent: 10, delivered: 9, failed: 1 });
    expect(templateOpenMetric(sms).value).toBe('—');
    expect(templateClickMetric(sms).value).toBe('—');
    expect(templateOpenMetric(sms).hint).toContain('SMS reports no opens');

    const email = g({ trackedDelivered: 50, opened: 25, clicked: 5 });
    expect(templateOpenMetric(email).value).toBe('50%');
    expect(templateClickMetric(email).value).toBe('10%');
  });
});

describe('rateBucket', () => {
  it('keeps "not measured" out of "None"', () => {
    // Both used to land in "None", so filtering for templates nobody opened
    // returned 148 of 229 — almost all of them SMS and voice templates that
    // never reported an open in the first place.
    expect(rateBucket(null)).toBe('Not measured');
    expect(rateBucket(undefined)).toBe('Not measured');
    expect(rateBucket(0)).toBe('None');
    expect(rateBucket(19)).toBe('Under 20%');
    expect(rateBucket(20)).toBe('20 – 40%');
    expect(rateBucket(40)).toBe('40%+');
  });
});
