import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../src/content');

function listMarkdown(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(dir, file));
}

describe('content collections on disk', () => {
  it('keeps blog/guides/legal content without draft:true in published files', () => {
    const files = [
      ...listMarkdown(path.join(root, 'blog')),
      ...listMarkdown(path.join(root, 'guides')),
      ...listMarkdown(path.join(root, 'legal')),
    ];
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      expect(raw).not.toMatch(/draft:\s*true/);
      expect(raw).toMatch(/^---[\s\S]+?---/);
    }
  });
});
