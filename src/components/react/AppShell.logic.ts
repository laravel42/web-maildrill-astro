import { appNav, appSettingsNav } from '@/config/navigation';
import type { Cmd } from './AppShell.types';

export const COMMANDS: Cmd[] = [
  ...appNav.map((n) => ({
    label: `Go to ${n.label}`,
    hint: 'Navigate' as const,
    href: n.href,
    icon: n.icon,
  })),
  { label: 'Go to Settings', hint: 'Navigate', href: appSettingsNav.href, icon: 'settings' },
  { label: 'New campaign', hint: 'Action', href: '/dashboard/campaigns', icon: 'plus' },
  { label: 'New template', hint: 'Action', href: '/dashboard/templates', icon: 'templates' },
  { label: 'Import contacts', hint: 'Action', href: '/dashboard/subscribers', icon: 'upload' },
];
