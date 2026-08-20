import type { ChannelType } from '@/types/app';
import { routes } from '@/config/routes';
import { productClient } from './service';
import type { ApiTemplate } from '@/lib/app/template-map';

/** Result of loading a channel builder page: either render props or a redirect. */
export type TemplateBuilderLoad =
  | { redirect: string }
  | {
      template: ApiTemplate | null;
      live: boolean;
      /** Demo-mode prefills (fixture gallery has no saved row to fetch). */
      presetName: string | null;
      presetCategory: string | null;
    };

function toChannel(c?: string | null): ChannelType {
  return c === 'sms' || c === 'whatsapp' || c === 'voice' ? c : 'email';
}

/**
 * Shared SSR loader for the per-channel template builder pages.
 * `?id=<templateId>` fetches the saved row (redirecting home if it's gone, or
 * to the right channel's page if the id belongs to another channel). Without
 * an id — or without a connected workspace — the builder opens empty.
 */
export async function loadTemplateBuilder(
  session: App.Locals['session'],
  channel: ChannelType,
  url: URL,
): Promise<TemplateBuilderLoad> {
  const id = url.searchParams.get('id');
  if (!session?.user?.id || !session.activeTenantId) {
    return {
      template: null,
      live: false,
      presetName: url.searchParams.get('name'),
      presetCategory: url.searchParams.get('category'),
    };
  }
  if (!id) return { template: null, live: true, presetName: null, presetCategory: null };

  const client = productClient({
    userId: session.user.id,
    activeTenantId: session.activeTenantId,
    role: session.role,
  });
  try {
    const { data, error } = await client.GET('/v1/templates/{id}', {
      params: { path: { id } },
    });
    if (error || !data) return { redirect: routes.app.templates };
    const template = data as unknown as ApiTemplate;
    const actual = toChannel(template.channel);
    if (actual !== channel) {
      return { redirect: `${routes.app.templateBuilder(actual)}?id=${encodeURIComponent(id)}` };
    }
    return { template, live: true, presetName: null, presetCategory: null };
  } catch {
    return { redirect: routes.app.templates };
  }
}
