import { useCallback, useState } from 'react';
import type { BuilderSite } from 'builder42';
import LandingPageBuilder from './LandingPageBuilder';

/**
 * docs/52 F8 — demo-only persistence for `/dashboard/landing-pages/demo`.
 *
 * This host has no landing-page backend yet (no `sites` table, no API) — a
 * real integration would mirror `loadTemplateBuilder`/`email.astro` (load
 * server-side, save via a workspace-scoped endpoint). Until that's asked
 * for, this persists to `localStorage` under a fixed demo key, purely so the
 * vendored editor (`packages/builder42/`) can be exercised end to end inside
 * this app (load → edit → save → reload) as evidence that the embedding
 * works, without shipping a half-built product feature.
 */
const DEMO_STORAGE_KEY = 'builder42:demo-site';

function loadDemoSite(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(DEMO_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function LandingPageBuilderPage() {
  const [initialSite] = useState(loadDemoSite);
  const [closed, setClosed] = useState(false);

  const handleSave = useCallback(async (site: BuilderSite) => {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(site));
    } catch {
      // best-effort demo persistence — no user-facing consequence to surface
    }
  }, []);

  const handleClose = useCallback(() => {
    setClosed(true);
    window.location.assign('/dashboard');
  }, []);

  if (closed) return null;

  return <LandingPageBuilder initialSite={initialSite} onSave={handleSave} onClose={handleClose} />;
}
