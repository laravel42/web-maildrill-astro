import { describe, expect, it } from 'vitest';
import { unsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';

const claims = { tenantId: 'a3f1c2d4-0000-4000-8000-000000000001', subscriberId: 'b7e2d1c0-0000-4000-8000-000000000002' };

describe('unsubscribe token', () => {
  it('round-trips its claims', () => {
    expect(verifyUnsubscribeToken(unsubscribeToken(claims))).toEqual(claims);
  });

  it('rejects a tampered payload — you cannot unsubscribe someone else', () => {
    const [, sig] = unsubscribeToken(claims).split('.');
    const forged = Buffer.from(`${claims.tenantId}:ffffffff-0000-4000-8000-00000000ffff`).toString('base64url');
    expect(verifyUnsubscribeToken(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects a tampered signature and malformed input', () => {
    const [payload] = unsubscribeToken(claims).split('.');
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`)).toBeNull();
    expect(verifyUnsubscribeToken('nonsense')).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
  });
});

import { webviewToken, verifyWebviewToken } from './webview';

describe('webview token', () => {
  it('round-trips with and without a campaign', () => {
    const withCamp = { ...claims, campaignId: 'c0ffee00-0000-4000-8000-000000000003' };
    expect(verifyWebviewToken(webviewToken(withCamp))).toEqual(withCamp);
    expect(verifyWebviewToken(webviewToken(claims))).toEqual(claims);
  });

  it('is not interchangeable with an unsubscribe token', () => {
    // Distinct derived keys: a webview link must never unsubscribe anyone.
    expect(verifyUnsubscribeToken(webviewToken(claims))).toBeNull();
    expect(verifyWebviewToken(unsubscribeToken(claims))).toBeNull();
  });

  it('rejects tampering', () => {
    const [payload] = webviewToken(claims).split('.');
    expect(verifyWebviewToken(`${payload}.deadbeef`)).toBeNull();
  });
});
