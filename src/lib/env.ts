import { z } from 'zod';

const publicEnvSchema = z.object({
  PUBLIC_SITE_URL: z.string().url().optional(),
  PUBLIC_POSTHOG_KEY: z.string().optional(),
  PUBLIC_POSTHOG_HOST: z.string().url().optional(),
});

const serverEnvSchema = z.object({
  AUTH_SECRET: z.string().optional(),
  API_BASE_URL: z.string().url().optional(),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL,
    PUBLIC_POSTHOG_KEY: import.meta.env.PUBLIC_POSTHOG_KEY,
    PUBLIC_POSTHOG_HOST: import.meta.env.PUBLIC_POSTHOG_HOST,
  });
}

export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('Server env must not be accessed on the client');
  }
  return serverEnvSchema.parse({
    AUTH_SECRET: import.meta.env.AUTH_SECRET,
    API_BASE_URL: import.meta.env.API_BASE_URL,
  });
}
