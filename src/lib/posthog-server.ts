import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const token = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (import.meta.env.DEV) {
      console.error(
        'PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, ' +
          'this causes events to be silently missed. ' +
          'This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      );
    }
    return null;
  }
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
