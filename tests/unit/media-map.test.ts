import { describe, expect, it } from 'vitest';
import { toMediaFile } from '@/lib/app/media-map';

describe('toMediaFile preview', () => {
  it('prefers thumbUrl for image tiles', () => {
    const row = toMediaFile({
      id: 'a',
      name: 'hero',
      contentType: 'image/jpeg',
      url: 'https://cdn.example/full.jpg',
      thumbUrl: 'https://cdn.example/thumb.webp',
      width: 1920,
      height: 1080,
    });
    expect(row.preview).toBe('https://cdn.example/thumb.webp');
    expect(row.url).toBe('https://cdn.example/full.jpg');
  });

  it('falls back to full url when thumb is missing', () => {
    const row = toMediaFile({
      id: 'b',
      name: 'legacy',
      contentType: 'image/png',
      url: 'https://cdn.example/full.png',
      thumbUrl: null,
    });
    expect(row.preview).toBe('https://cdn.example/full.png');
  });
});
