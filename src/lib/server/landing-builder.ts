import { routes } from '@/config/routes';
import { productClient } from './service';

/**
 * SSR loader for the landing-page editor route — the landings counterpart of
 * `loadTemplateBuilder`.
 *
 * `?id=<landingId>` fetches the stored site document (redirecting to the list if
 * the row is gone or belongs to another workspace, which the tenant-scoped token
 * makes indistinguishable, as it should be). Without an id the editor opens on a
 * fresh site that the first save turns into a row.
 */
export type LandingBuilderLoad =
  | { redirect: string }
  | {
      id: string | null;
      name: string | null;
      /** The `BuilderSite` JSON, or null for a new landing. */
      document: Record<string, unknown> | null;
      /** False when there is no workspace session — the editor opens unsaved. */
      live: boolean;
    };

interface LandingApiRow {
  id: string;
  name: string;
  document: Record<string, unknown> | null;
}

export async function loadLandingBuilder(
  session: App.Locals['session'],
  url: URL,
): Promise<LandingBuilderLoad> {
  const id = url.searchParams.get('id');
  if (!session?.user?.id || !session.activeTenantId) {
    return { id: null, name: null, document: null, live: false };
  }
  if (!id) return { id: null, name: null, document: null, live: true };

  const client = productClient({
    userId: session.user.id,
    activeTenantId: session.activeTenantId,
    role: session.role,
  });
  try {
    const { data, error } = await client.GET(
      '/v1/landings/{id}' as never,
      {
        params: { path: { id } },
      } as never,
    );
    if (error || !data) return { redirect: routes.app.landings };
    const row = data as unknown as LandingApiRow;
    return { id: row.id, name: row.name, document: row.document ?? null, live: true };
  } catch {
    return { redirect: routes.app.landings };
  }
}
