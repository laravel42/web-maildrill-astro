import type { ChannelType } from '@/types/app';
import type { SortKey } from './AppTemplates.types';

export const CHANNEL_TABS: (ChannelType | 'all')[] = ['all', 'email', 'sms', 'whatsapp', 'voice'];

export const VIEWS = [
  { key: 'gallery', label: 'Gallery' },
  { key: 'list', label: 'List' },
] as const;

export const ASC_FIRST = new Set<SortKey>(['name', 'channel', 'cat']);
export const PAGE_SIZE = 15;
