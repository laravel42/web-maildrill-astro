import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from './http-client';

/**
 * SSRF blocklist.
 *
 * The HTTP action dereferences a URL the workflow author supplies, so without these the
 * feature is a proxy into the private network — and 169.254.169.254 in particular is the
 * cloud metadata endpoint that hands out instance credentials.
 */
describe('isBlockedAddress', () => {
  it('blocks loopback, private, link-local, CGNAT and multicast IPv4', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '198.18.0.1',
    ]) {
      expect(isBlockedAddress(address, 4), address).toBe(true);
    }
  });

  it('allows ordinary public IPv4', () => {
    for (const address of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.32.0.1', '100.63.255.255']) {
      expect(isBlockedAddress(address, 4), address).toBe(false);
    }
  });

  it('blocks loopback, unique-local, link-local and multicast IPv6', () => {
    for (const address of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      expect(isBlockedAddress(address, 6), address).toBe(true);
    }
  });

  it('sees through IPv4-mapped IPv6, which is the usual bypass', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8', 6)).toBe(false);
  });

  it('allows public IPv6', () => {
    expect(isBlockedAddress('2606:4700:4700::1111', 6)).toBe(false);
  });

  it('refuses anything it cannot parse as IPv4', () => {
    expect(isBlockedAddress('not-an-address', 4)).toBe(true);
    expect(isBlockedAddress('1.2.3', 4)).toBe(true);
    expect(isBlockedAddress('999.1.1.1', 4)).toBe(true);
  });
});
