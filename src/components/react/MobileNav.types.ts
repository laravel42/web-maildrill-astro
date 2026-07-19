import type { NavGroup } from '@/config/navigation';

export type Cta = { label: string; href: string };

export type Props = {
  items: NavGroup[];
  primaryCta: Cta;
  secondaryCta: Cta;
};
