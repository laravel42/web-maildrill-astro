import type { SubscriberStatus } from '@/types/app';

export type SubscriberEditorValues = {
  email: string;
  phone: string;
  name: string;
  status: SubscriberStatus;
  list: string;
  tags: string[];
};
