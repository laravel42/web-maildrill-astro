import type { DraftBrief } from './briefDefaults';

export interface CompileBriefResult {
  prompt: string;
  queries: string[];
  hints: {
    palette: string;
    density: 'concise' | 'standard' | 'rich';
    sections: string[];
  };
}

/**
 * Build a VisualBrief from the DraftBrief. Only high-signal fields the wizard
 * collects are sent; tone, vertical, palette, photo style and sections are left
 * empty/omitted so the backend lets the model decide them.
 */
function toWireBrief(draft: DraftBrief): object {
  return {
    email_strategy: {
      purpose: draft.email_strategy.purpose ?? 'custom',
      brandName: draft.email_strategy.brandName || undefined,
      audience: draft.email_strategy.audience || undefined,
      goal: draft.email_strategy.goal || undefined,
      rawIntent: draft.email_strategy.rawIntent,
    },
    tone_strategy: {
      // Not asked anymore — the model infers tone/vertical from purpose + brand.
      moods: draft.tone_strategy.moods,
      vertical: draft.tone_strategy.vertical,
    },
    visual_strategy: {
      // Palette / photo style are derived by the model; only brand colours are
      // collected (they steer the palette when present).
      palette: draft.visual_strategy.palette,
      photoStyle: draft.visual_strategy.photoStyle,
      brandColors: draft.visual_strategy.brandColors,
    },
    layout_strategy: {
      // Empty ⇒ the backend instructs the model to choose the most effective
      // section structure. The wizard no longer asks the user for sections.
      sections: draft.layout_strategy.sections,
    },
    image_queries: {
      // Subjects are no longer a wizard question; when the user typed a specific
      // scene, forward it as the single subject so it steers the image queries.
      subjects: draft.image_queries.specificScene.trim()
        ? [draft.image_queries.specificScene.trim()]
        : draft.image_queries.subjects,
    },
  };
}

export async function compileBriefClient(
  draft: DraftBrief,
  backendUrl: string,
  options?: { locale?: string; signal?: AbortSignal }
): Promise<CompileBriefResult> {
  const res = await fetch(`${backendUrl}/visual-brief/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brief: toWireBrief(draft),
      locale: options?.locale,
    }),
    signal: options?.signal,
  });
  if (!res.ok) {
    throw new Error(`visual-brief/compile: HTTP ${res.status}`);
  }
  return res.json() as Promise<CompileBriefResult>;
}
