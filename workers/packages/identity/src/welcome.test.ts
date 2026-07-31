import { describe, expect, it } from 'vitest';
import { welcomeEmailHtml } from './welcome';

describe('welcomeEmailHtml', () => {
  it('greets by first name when provided', () => {
    expect(welcomeEmailHtml('Ada')).toContain('Hi Ada,');
  });

  it('falls back to a neutral greeting without a name', () => {
    expect(welcomeEmailHtml()).toContain('Hi there,');
    expect(welcomeEmailHtml('   ')).toContain('Hi there,');
  });

  it("escapes HTML in the name so it can't inject markup", () => {
    const html = welcomeEmailHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Hi &lt;script&gt;alert(1)&lt;/script&gt;,');
  });

  it('carries the welcome content and trial quotas', () => {
    const html = welcomeEmailHtml('Ada');
    expect(html).toContain('Welcome to <span style="color:#ff441f;">Maildrill</span>');
    expect(html).toContain('Within 7 days');
    expect(html).toContain('100');
    expect(html).toContain('WhatsApp messages');
  });
});
