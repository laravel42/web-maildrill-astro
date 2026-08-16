import type { ChannelType } from '@/types/app';
import Icon from '../Icon';
import { CHANNEL } from './channels';

/* Small campaign badges shared by the campaigns board, its detail drawer,
   and the campaign report page. */

export function ChannelPill({ channel }: { channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <span className="apill" style={{ background: m.tint, color: m.color }}>
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}

const DEFAULT_LIST_COLOR = '#4f46e5';

/** A list identifier badge tinted with the list's own colour. */
export function ListPill({ name, color }: { name: string; color?: string | null }) {
  const c = color || DEFAULT_LIST_COLOR;
  return (
    <span
      className="apill"
      // The list colour is user-chosen and never theme-aware; carried straight
      // as text it drops to ~2.7:1 on the dark surface. Mixing it toward the
      // theme's text colour keeps the identity while staying readable on both.
      style={{
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        color: `color-mix(in srgb, ${c} 60%, var(--text))`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flex: 'none' }} />
      {name}
    </span>
  );
}
