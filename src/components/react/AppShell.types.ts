import type { ReactNode } from 'react';
import type { IconName } from '@/lib/icons';

export type AppShellCrumb = {
  label: string;
  href?: string;
};

export type Props = {
  currentPath: string;
  title: string;
  /** Optional trail after the workspace name. Falls back to `title` when omitted. */
  crumbs?: AppShellCrumb[];
  children: ReactNode;
  userEmail?: string | null;
  userName?: string | null;
};

export type Cmd = { label: string; hint: 'Navigate' | 'Action'; href?: string; icon: IconName };
