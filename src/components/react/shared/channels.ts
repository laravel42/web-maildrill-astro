import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';

/**
 * Canonical channel presentation metadata, shared by every workspace screen and
 * editor. Previously copy-pasted into CampaignsBoard, AppSubscribers,
 * AppSettings, AppDashboard, AppTemplates and the two editors — now sourced
 * here so colour/icon/label stay in lockstep.
 */
export type ChannelMeta = {
  color: string;
  /** Resolved hex for props/APIs that cannot accept CSS variables. */
  hex: string;
  tint: string;
  icon: IconName;
  /** Display label, e.g. "Email", "SMS", "WhatsApp", "Voice". */
  label: string;
};

export const CHANNEL: Record<ChannelType, ChannelMeta> = {
  email: {
    color: 'var(--ch-email)',
    hex: '#4f46e5',
    tint: 'var(--ch-email-tint)',
    icon: 'mail',
    label: 'Email',
  },
  sms: {
    color: 'var(--ch-sms)',
    hex: '#0891b2',
    tint: 'var(--ch-sms-tint)',
    icon: 'sms',
    label: 'SMS',
  },
  whatsapp: {
    color: 'var(--ch-whatsapp)',
    hex: '#16a34a',
    tint: 'var(--ch-whatsapp-tint)',
    icon: 'whatsapp',
    label: 'WhatsApp',
  },
  voice: {
    color: 'var(--ch-voice)',
    hex: '#d97706',
    tint: 'var(--ch-voice-tint)',
    icon: 'voice',
    label: 'Voice',
  },
};

/** Stable channel ordering for tab bars, selectors and filters. */
export const CHANNEL_ORDER: ChannelType[] = ['email', 'sms', 'whatsapp', 'voice'];

/** Display label for a channel (`'email'` → `'Email'`). */
export const channelLabel = (channel: ChannelType): string => CHANNEL[channel].label;

/**
 * Presentation identity of a full-screen editor, decoupled from `ChannelType`.
 *
 * Every channel is an identity (its `ChannelMeta` is one, shape-compatible), but
 * not every editor is a channel: Landings is a first-class workspace surface
 * that is deliberately NOT a messaging channel, yet it uses the same shared
 * shell (`ChannelEditorShell`/`EditorHeader`) so it reads as one product. This
 * type is what those components consume; a channel resolves to one via
 * `resolveEditorIdentity`, so the four channel editors keep passing `channel`
 * unchanged.
 */
export type EditorIdentity = ChannelMeta;

/**
 * Landings' editor identity. Not a channel, so it has no channel accent: it uses
 * the workspace's plain interactive indigo (`--accent`, the same in-app primary
 * colour every non-channel action uses) and the shared `landing` icon. `hex` is
 * the resolved indigo for the few props/APIs (e.g. the shell spinner's
 * `--editor-channel-color`) that cannot take a CSS variable.
 */
export const LANDING_IDENTITY: EditorIdentity = {
  color: 'var(--accent)',
  hex: '#4f46e5',
  tint: 'var(--accent-tint, #eef0ff)',
  icon: 'landing',
  label: 'Landing',
};

/**
 * Resolves the identity a shared editor component should present. Pass an
 * explicit `identity` (e.g. Landings), or a `channel` to use that channel's
 * metadata. Exactly one is expected; `identity` wins if both are given.
 */
export function resolveEditorIdentity(args: {
  identity?: EditorIdentity;
  channel?: ChannelType;
}): EditorIdentity {
  if (args.identity) return args.identity;
  if (args.channel) return CHANNEL[args.channel];
  // Neither given: fall back to the neutral indigo identity rather than throw —
  // the shell still renders, just without a channel accent.
  return LANDING_IDENTITY;
}
