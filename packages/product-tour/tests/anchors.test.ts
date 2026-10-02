import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAnchor, waitForAnchor, isSupportedRoot } from '@/anchors';

describe('anchors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves an existing data-tour anchor', () => {
    document.body.innerHTML = '<button data-tour="my.anchor">Click</button>';
    const el = resolveAnchor(document, 'my.anchor');
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe('BUTTON');
  });

  it('returns null for a missing anchor instead of throwing', () => {
    const el = resolveAnchor(document, 'does.not.exist');
    expect(el).toBeNull();
  });

  it('waitForAnchor resolves immediately if the element already exists', async () => {
    document.body.innerHTML = '<div data-tour="present"></div>';
    const el = await waitForAnchor(document, 'present', { timeoutMs: 100, intervalMs: 10 });
    expect(el).not.toBeNull();
  });

  it('waitForAnchor resolves to null after the timeout when the anchor never appears', async () => {
    const el = await waitForAnchor(document, 'never.appears', { timeoutMs: 60, intervalMs: 10 });
    expect(el).toBeNull();
  });

  it('waitForAnchor resolves once the element is inserted asynchronously', async () => {
    const promise = waitForAnchor(document, 'later', { timeoutMs: 500, intervalMs: 10 });
    setTimeout(() => {
      const div = document.createElement('div');
      div.setAttribute('data-tour', 'later');
      document.body.appendChild(div);
    }, 30);
    const el = await promise;
    expect(el).not.toBeNull();
  });

  it('isSupportedRoot is true for Document', () => {
    expect(isSupportedRoot(document)).toBe(true);
  });

  it('isSupportedRoot is false for a ShadowRoot', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    expect(isSupportedRoot(shadow)).toBe(false);
  });
});
