import { describe, expect, it } from 'vitest';
import { channelReportConfig } from '@/lib/app/campaign-report';

describe('channelReportConfig', () => {
  it('email tracks opens with device breakdowns', () => {
    const c = channelReportConfig('email');
    expect(c.openLabel).toBe('Opened');
    expect(c.funnel).toEqual(['recipients', 'delivered', 'opened', 'clicked']);
    expect(c.panels).toContain('devices');
    expect(c.kpis).toContain('bounced');
  });

  it('whatsapp reads opens as seen and has no device panel', () => {
    const c = channelReportConfig('whatsapp');
    expect(c.openLabel).toBe('Seen');
    expect(c.funnel).toContain('seen');
    expect(c.funnel).not.toContain('opened');
    expect(c.panels).not.toContain('devices');
  });

  it('sms cannot report opens at all', () => {
    const c = channelReportConfig('sms');
    expect(c.funnel).toEqual(['recipients', 'delivered', 'clicked']);
    expect(c.rateCards).not.toContain('open');
    expect(c.rateCards).not.toContain('seen');
  });

  it('voice is delivery-only', () => {
    const c = channelReportConfig('voice');
    expect(c.funnel).toEqual(['recipients', 'delivered']);
    expect(c.panels).toEqual(['details']);
    expect(c.eventTabs).not.toContain('clicked');
  });
});
