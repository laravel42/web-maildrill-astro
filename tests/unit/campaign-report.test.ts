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

  it('sms is delivery-only — no open, seen or click', () => {
    // Infobip can track clicks on a shortened SMS link, but nothing in the
    // product uses that and no click has ever been recorded, so a Click rate
    // tile sat at 0.0% forever — implying nobody clicked rather than that
    // nothing was measured. Analytics treats SMS the same way.
    const c = channelReportConfig('sms');
    expect(c.funnel).toEqual(['recipients', 'delivered']);
    expect(c.rateCards).not.toContain('open');
    expect(c.rateCards).not.toContain('seen');
    expect(c.rateCards).not.toContain('click');
    expect(c.kpis).not.toContain('clicked');
    expect(c.drawerKpis).not.toContain('click');
    expect(c.eventTabs).not.toContain('clicked');
  });

  it('voice is delivery-only', () => {
    const c = channelReportConfig('voice');
    expect(c.funnel).toEqual(['recipients', 'delivered']);
    expect(c.panels).toEqual(['details']);
    expect(c.eventTabs).not.toContain('clicked');
  });
});
