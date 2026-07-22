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
 * Build a minimal valid VisualBrief from the DraftBrief, filling required
 * fields with defaults so the backend schema always passes.
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
      moods: draft.tone_strategy.moods.length > 0 ? draft.tone_strategy.moods : ['friendly'],
      vertical: draft.tone_strategy.vertical ?? 'other',
    },
    visual_strategy: {
      palette: draft.visual_strategy.palette ?? 'neutral',
      photoStyle: draft.visual_strategy.photoStyle ?? 'photographic',
      brandColors: draft.visual_strategy.brandColors,
    },
    layout_strategy: {
      sections: draft.layout_strategy.sections.length > 0 ? draft.layout_strategy.sections : ['hero', 'cta'],
    },
    image_queries: {
      subjects: draft.image_queries.subjects,
    },
  };
}

export async function compileBriefClient(
  draft: DraftBrief,
  backendUrl: string,
  signal?: AbortSignal
): Promise<CompileBriefResult> {
  const res = await fetch(`${backendUrl}/visual-brief/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief: toWireBrief(draft) }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`visual-brief/compile: HTTP ${res.status}`);
  }
  return res.json() as Promise<CompileBriefResult>;
}
