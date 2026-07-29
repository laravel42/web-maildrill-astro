/**
 * Uniform tag chip colours shared by every screen that renders tags
 * (subscribers, lists, filters). Keep this the single source of truth so tags
 * read identically anywhere — no per-name palette or hashed colours.
 */
export function tagStyle(_name?: string): { color: string; background: string } {
  return {
    color: 'var(--text3)',
    background: 'var(--surface2)',
  };
}
