export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
export type ChannelType = 'email' | 'sms' | 'whatsapp' | 'voice';

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: ChannelType;
  audience: string;
  scheduledAt: string | null;
  openRate: number | null;
  clickRate: number | null;
  updatedAt: string;
  recipients: number;
  delivered: number;
  unsubscribed: number;
};

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';

export type Subscriber = {
  id: string;
  email: string;
  /** SMS/WhatsApp/Voice addressing field; empty string when none is on file. */
  phone: string;
  name: string;
  status: SubscriberStatus;
  lists: string[];
  tags: string[];
  updatedAt: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  category: string;
  channel: ChannelType;
  updatedAt: string;
  favorite: boolean;
};

export type MediaAsset = {
  id: string;
  name: string;
  type: 'image' | 'file';
  sizeKb: number;
  folder: string;
  updatedAt: string;
};

export type ListSummary = {
  id: string;
  name: string;
  subscribers: number;
  growthPct: number;
  updatedAt: string;
};

export type AnalyticsPoint = {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  workspace: string;
};
