import type { ReactNode } from 'react';
import type { IconName } from '@/lib/icons';

export type Props = {
  currentPath: string;
  title: string;
  children: ReactNode;
};

export type Cmd = { label: string; hint: 'Navigate' | 'Action'; href?: string; icon: IconName };
