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
      user?: {
        id?: string;
        email?: string | null;
        name?: string | null;
        phone?: string | null;
      };
      activeTenantId?: string | null;
      role?: string | null;
      authTime?: number | null;
      /** Server-side session row id (auth_sessions) carried in the JWT. */
      sid?: string | null;
      /** Auth methods used at login (code, totp, recovery, webauthn…). */
      amr?: string[] | null;
      workspaces?: Array<{ tenantId: string; role: string; workspaceName: string }>;
    } | null;
  }
}
