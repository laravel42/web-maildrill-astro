import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';
import type { SortKey } from './AppTemplates.types';

export const CHANNEL_TABS: (ChannelType | 'all')[] = ['all', 'email', 'sms', 'whatsapp', 'voice'];

export const VIEWS = [
  { key: 'gallery', label: 'Gallery', icon: 'templates' as IconName },
  { key: 'list', label: 'List', icon: 'lists' as IconName },
  { key: 'compact', label: 'Compact', icon: 'dashboard' as IconName },
] as const;

export const ASC_FIRST = new Set<SortKey>(['name', 'cat']);
export const PAGE_SIZE = 10;
