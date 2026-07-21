/**
 * Deterministic tag colouring shared by every screen that renders tags
 * (subscribers, lists). A small map fixes the colours of well-known tags; any
 * other tag is hashed onto a fixed palette so the same name always looks the
 * same. Keep this the single source of truth so tags read identically anywhere.
 */
const TAG_MAP: Record<string, [string, string]> = {
  vip: ['var(--accent)', 'var(--accent-tint)'],
  customer: ['#15803d', '#e7f6ec'],
  lead: ['#b45309', '#fef3c7'],
  trial: ['#78756c', '#f1f0eb'],
  'churn risk': ['#b45309', '#fef3c7'],
  bounced: ['#dc2626', '#fee2e2'],
};
const TAG_PALETTE: [string, string][] = [
  ['#4f46e5', 'var(--accent-tint)'],
  ['#0d9488', '#d5f2ee'],
  ['#7c3aed', '#efe7fd'],
  ['#b45309', '#fef3c7'],
  ['#2563eb', '#e0ecff'],
];

export function tagStyle(name: string): { color: string; background: string } {
  const known = TAG_MAP[name.toLowerCase()];
  if (known) return { color: known[0], background: known[1] };
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [color, background] = TAG_PALETTE[h % TAG_PALETTE.length];
  return { color, background };
}
