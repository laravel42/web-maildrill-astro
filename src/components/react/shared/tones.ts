/**
 * Badge/pill tone palette shared across workspace screens (settings roster,
 * status chips, table badges).
 */
export type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'violet';

export const TONE: Record<Tone, { background: string; color: string }> = {
  success: { background: 'var(--success-bg)', color: 'var(--success-strong)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  accent: { background: 'var(--accent-tint)', color: 'var(--accent)' },
  neutral: { background: 'var(--surface2)', color: 'var(--muted)' },
  violet: { background: 'rgba(124,58,237,.14)', color: '#7c3aed' },
};
