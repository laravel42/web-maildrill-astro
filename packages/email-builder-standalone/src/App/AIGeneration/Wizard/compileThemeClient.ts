import type { ThemeBundlePayload } from '@eb/document-core';

import type { DraftBrief } from './briefDefaults';

/**
 * Result returned by `POST /api/generate-theme`. `globals` + `blocks`
 * map 1:1 onto `ThemeBundlePayload` so the summary step can hand the
 * payload straight to `applyThemePreset()` / `saveTheme()`. `name` and
 * `accessibility` are presentation metadata.
 */
export interface GeneratedThemeResult {
  name: string;
  globals: NonNullable<ThemeBundlePayload['globals']>;
  blocks: ThemeBundlePayload['blocks'];
  accessibility: {
    minContrastRatio: number;
    passesAA: boolean;
    notes: string[];
  };
}

/**
 * Map a DraftBrief onto the generate-theme request body. Only the
 * fields the theme generator cares about are forwarded.
 */
function toThemeRequest(draft: DraftBrief, locale?: string): object {
  const brandColors = draft.visual_strategy.brandColors;
  // Drop empty-string colours so the backend hex validator doesn't reject them.
  const cleanedColors = brandColors
    ? Object.fromEntries(Object.entries(brandColors).filter(([, v]) => typeof v === 'string' && v.trim().length > 0))
    : undefined;

  return {
    brandColors: cleanedColors && Object.keys(cleanedColors).length > 0 ? cleanedColors : undefined,
    brandName: draft.email_strategy.brandName || undefined,
    moods: draft.tone_strategy.moods.length > 0 ? draft.tone_strategy.moods : undefined,
    vertical: draft.tone_strategy.vertical || undefined,
    palette: draft.visual_strategy.palette || undefined,
    fontFamily: draft.theme_strategy.fontBody || undefined,
    fontHeadings: draft.theme_strategy.fontHeadings || undefined,
    borderRadius: typeof draft.theme_strategy.borderRadius === 'number' ? draft.theme_strategy.borderRadius : undefined,
    brief: draft.email_strategy.rawIntent || draft.email_strategy.goal || undefined,
    locale,
  };
}

export async function generateThemeClient(
  draft: DraftBrief,
  backendUrl: string,
  locale?: string,
  signal?: AbortSignal
): Promise<GeneratedThemeResult> {
  const res = await fetch(`${backendUrl}/api/generate-theme`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toThemeRequest(draft, locale)),
    signal,
  });
  if (!res.ok) {
    throw new Error(`generate-theme: HTTP ${res.status}`);
  }
  return res.json() as Promise<GeneratedThemeResult>;
}

/** Extract the bare `ThemeBundlePayload` from a generated theme result. */
export function toThemeBundlePayload(theme: GeneratedThemeResult): ThemeBundlePayload {
  return { globals: theme.globals, blocks: theme.blocks };
}
