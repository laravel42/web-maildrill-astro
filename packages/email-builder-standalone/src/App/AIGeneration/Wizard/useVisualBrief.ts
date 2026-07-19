import { useCallback, useState } from 'react';

import { BRIEF_DEFAULTS, type DraftBrief } from './briefDefaults';

export type BriefPatch = Partial<{
  email_strategy: Partial<DraftBrief['email_strategy']>;
  tone_strategy: Partial<DraftBrief['tone_strategy']>;
  visual_strategy: Partial<DraftBrief['visual_strategy']>;
  theme_strategy: Partial<DraftBrief['theme_strategy']>;
  layout_strategy: Partial<DraftBrief['layout_strategy']>;
  image_queries: Partial<DraftBrief['image_queries']>;
}>;

function deepMerge(base: DraftBrief, patch: BriefPatch): DraftBrief {
  return {
    email_strategy: { ...base.email_strategy, ...(patch.email_strategy ?? {}) },
    tone_strategy: { ...base.tone_strategy, ...(patch.tone_strategy ?? {}) },
    visual_strategy: { ...base.visual_strategy, ...(patch.visual_strategy ?? {}) },
    theme_strategy: { ...base.theme_strategy, ...(patch.theme_strategy ?? {}) },
    layout_strategy: { ...base.layout_strategy, ...(patch.layout_strategy ?? {}) },
    image_queries: { ...base.image_queries, ...(patch.image_queries ?? {}) },
  };
}

export function useVisualBrief(initialRawIntent = '') {
  const initial = {
    ...BRIEF_DEFAULTS,
    email_strategy: { ...BRIEF_DEFAULTS.email_strategy, rawIntent: initialRawIntent },
  };
  const [brief, setBrief] = useState<DraftBrief>(initial);

  const patch = useCallback((updates: BriefPatch) => {
    setBrief((prev) => deepMerge(prev, updates));
  }, []);

  const reset = useCallback((rawIntent = '') => {
    setBrief({
      ...BRIEF_DEFAULTS,
      email_strategy: { ...BRIEF_DEFAULTS.email_strategy, rawIntent },
    });
  }, []);

  return { brief, patch, reset };
}
