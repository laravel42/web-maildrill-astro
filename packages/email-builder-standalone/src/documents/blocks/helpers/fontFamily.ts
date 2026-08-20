import { z } from 'zod';

import {
  DEFAULT_FONT,
  FONT_FAMILIES,
  FONT_FAMILY_NAMES,
  FONT_FAMILY_SCHEMA,
  getFontFamily as getFontFamilyPure,
} from '@eb/email-builder';

import { getRootSnapshot } from '../../editor/EditorContext';
import type { EmailLayoutProps } from '../EmailLayout/EmailLayoutPropsSchema';

export { FONT_FAMILY_SCHEMA, FONT_FAMILY_NAMES, FONT_FAMILIES, DEFAULT_FONT };

/**
 * Editor-side `getFontFamily`: same resolution as the pure helper in
 * `@eb/email-builder`, but the root-font fallback is read from the live
 * Zustand store snapshot so existing editor call sites keep working
 * without threading the root font explicitly.
 *
 * New render-path code should prefer `useFontFamily` from
 * `@eb/email-builder`, which reads the root font from React context and
 * is Node-safe.
 */
export function getFontFamily(fontFamily: z.infer<typeof FONT_FAMILY_SCHEMA>) {
  const root = getRootSnapshot() as EmailLayoutProps | undefined;
  return getFontFamilyPure(
    fontFamily as string | null | undefined,
    (root?.fontFamily as any) ?? null,
  );
}
