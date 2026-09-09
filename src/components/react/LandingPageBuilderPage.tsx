import { useCallback, useState } from 'react';
import type { BuilderSite } from 'builder42';
import LandingPageBuilder from './LandingPageBuilder';
import { landingsApi } from '@/lib/app/landings';
import { ApiError } from '@/lib/app/api';
import { routes } from '@/config/routes';

/**
 * Persistence for the landing-page editor route.
 *
 * The editor hands over the whole `BuilderSite` on save (its only outbound
 * action — everything else is an injected adapter), so this component owns the
 * decision of where it goes: `PATCH /api/v1/landings/:id` for a saved landing,
 * or `POST` on the first save of a new one, after which the URL is rewritten to
 * carry the new id so a reload reopens the row instead of starting over.
 *
 * `live: false` means there is no workspace session behind this page. Rather
 * than silently dropping the user's work, saving reports that it can't persist.
 */
type Props = {
  id: string | null;
  name: string | null;
  document: Record<string, unknown> | null;
  live: boolean;
};

export default function LandingPageBuilderPage({ id, name, document, live }: Props) {
  const [landingId, setLandingId] = useState(id);
  const [closed, setClosed] = useState(false);

  const handleSave = useCallback(
    async (site: BuilderSite) => {
      if (!live) {
        throw new Error(
          'This landing can’t be saved — the workspace session is missing. Sign in again.',
        );
      }
      const document_ = site as unknown as Record<string, unknown>;
      const siteName = site.meta?.name?.trim() || 'Untitled landing';
      try {
        if (landingId) {
          await landingsApi.update(landingId, { name: siteName, document: document_ });
        } else {
          const created = await landingsApi.create({ name: siteName, document: document_ });
          setLandingId(created.id);
          window.history.replaceState({}, '', routes.app.landingBuilder(created.id));
        }
      } catch (err) {
        throw err instanceof ApiError
          ? new Error(`Couldn’t save this landing: ${err.message}`)
          : new Error('Couldn’t save this landing.');
      }
    },
    [landingId, live],
  );

  const handleClose = useCallback(() => {
    setClosed(true);
    window.location.assign(routes.app.landings);
  }, []);

  if (closed) return null;

  return (
    <LandingPageBuilder
      initialSite={(document as unknown as BuilderSite) ?? undefined}
      siteName={name}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}
