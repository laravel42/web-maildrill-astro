import { describe, expect, it } from 'vitest';
import { deviceLabel, parseUserAgent } from './ua';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const EDGE_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';

describe('user-agent classification', () => {
  it('classifies the common desktop browsers', () => {
    expect(parseUserAgent(CHROME_MAC)).toEqual({
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'desktop',
    });
    expect(parseUserAgent(EDGE_WIN)).toEqual({
      browser: 'Edge',
      os: 'Windows',
      deviceType: 'desktop',
    });
    expect(parseUserAgent(FIREFOX_LINUX)).toEqual({
      browser: 'Firefox',
      os: 'Linux',
      deviceType: 'desktop',
    });
  });

  it('classifies mobile Safari', () => {
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
      browser: 'Safari',
      os: 'iOS',
      deviceType: 'mobile',
    });
  });

  it('degrades gracefully', () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null, deviceType: 'desktop' });
    expect(deviceLabel('')).toBe('Unknown device');
    expect(deviceLabel(CHROME_MAC)).toBe('Chrome on macOS');
  });
});
