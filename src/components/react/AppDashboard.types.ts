import type { ChannelType } from '@/types/app';
import type { IconName } from '@/lib/icons';

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  up: boolean;
};

export type ActivityItem = {
  icon: IconName;
  bg: string;
  color: string;
  text: string;
  time: string;
};

export type ChannelPerf = {
  channel: ChannelType;
  sent: string;
  open: string;
  click: string;
  openW: number;
};

export type GetStartedStep = {
  label: string;
  bg: string;
  ring: string;
  fill: string;
  text: string;
};
