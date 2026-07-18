/**
 * Mock application services.
 * Swap implementations here when wiring a real API — UI should import from this module only.
 */
import {
  analyticsSeries,
  campaigns,
  currentUser,
  lists,
  mediaAssets,
  subscribers,
  templates,
} from './mock-data';
import type {
  AnalyticsPoint,
  Campaign,
  CampaignStatus,
  ChannelType,
  ListSummary,
  MediaAsset,
  Subscriber,
  TemplateItem,
  AppUser,
} from '@/types/app';

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getCurrentUser(): Promise<AppUser> {
  await delay();
  return currentUser;
}

export async function listCampaigns(filters?: {
  status?: CampaignStatus | 'all';
  channel?: ChannelType | 'all';
  query?: string;
}): Promise<Campaign[]> {
  await delay();
  return campaigns.filter((campaign) => {
    if (filters?.status && filters.status !== 'all' && campaign.status !== filters.status) {
      return false;
    }
    if (filters?.channel && filters.channel !== 'all' && campaign.channel !== filters.channel) {
      return false;
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase();
      return campaign.name.toLowerCase().includes(q) || campaign.audience.toLowerCase().includes(q);
    }
    return true;
  });
}

export async function listSubscribers(): Promise<Subscriber[]> {
  await delay();
  return subscribers;
}

export async function listTemplates(): Promise<TemplateItem[]> {
  await delay();
  return templates;
}

export async function listMedia(): Promise<MediaAsset[]> {
  await delay();
  return mediaAssets;
}

export async function listLists(): Promise<ListSummary[]> {
  await delay();
  return lists;
}

export async function getAnalytics(): Promise<AnalyticsPoint[]> {
  await delay();
  return analyticsSeries;
}

/** Placeholder auth — replace with real session exchange. */
export async function mockSignIn(_email: string, _password: string): Promise<{ ok: true }> {
  await delay(400);
  return { ok: true };
}

export async function mockSignUp(_input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  await delay(500);
  return { ok: true };
}

export async function mockResetPassword(_email: string): Promise<{ ok: true }> {
  await delay(400);
  return { ok: true };
}

export async function mockContactSubmit(_input: {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  message: string;
}): Promise<{ ok: true }> {
  await delay(500);
  return { ok: true };
}
