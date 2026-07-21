import type { SubscriberStatus } from '@/types/app';

export type SubscriberEditorValues = {
  email: string;
  phone: string;
  name: string;
  status: SubscriberStatus;
  /** Lists to associate the subscriber with, in one save. */
  listIds: string[];
  tags: string[];
};
