/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_POSTHOG_KEY?: string;
  readonly PUBLIC_POSTHOG_HOST?: string;
  readonly PUBLIC_POSTHOG_PROJECT_TOKEN?: string;
  readonly AUTH_SECRET?: string;
  readonly API_BASE_URL?: string;
  readonly JWT_SECRET?: string;
}

interface Window {
  posthog?: import('posthog-js').PostHog;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    session: {
      user?: { id?: string; email?: string | null; name?: string | null };
      activeTenantId?: string | null;
      role?: string | null;
      workspaces?: Array<{ tenantId: string; role: string; workspaceName: string }>;
    } | null;
  }
}
