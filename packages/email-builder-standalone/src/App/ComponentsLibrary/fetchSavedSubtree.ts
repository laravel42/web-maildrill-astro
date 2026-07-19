/**
 * fetchSavedSubtree — generic helper used by Components Library drop
 * targets (`EditorBlockWrapper`, `EditorChildrenIds`) and the Templates
 * apply flow.
 *
 * For Sections / Primitives / Layouts the response shape is the same:
 * `{ id, name, description?, blocks: TSavedComponentBlock[] }`. Templates
 * use the same shape (the entire document is encoded as the `blocks`
 * array, anchored at an `EmailLayout` root after the backend's
 * renumbering).
 *
 * Errors are forwarded as a rejected promise so callers can surface a
 * toast or log without us silently swallowing the failure.
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import { getComponentsStorageMode, type TSavedComponentBlock } from '../../documents/editor/EditorContext';

import type { FetchableLibraryCategory } from './dnd';
import { localGetSavedComponent, localGetTemplate } from './localLibraryStore';

export type FetchSavedSubtreeResult = {
  id: string;
  name: string;
  description?: string;
  blocks: TSavedComponentBlock[];
};

/**
 * Build the URL for a category + axis + id triple. Templates pass `''`
 * as `axis` (no sub-directory in the storage layout).
 */
function urlFor(category: FetchableLibraryCategory, axis: string, id: string): string {
  const base = resolveBackendUrl();
  switch (category) {
    case 'section':
      return `${base}/dev/sections/${encodeURIComponent(axis)}/${encodeURIComponent(id)}`;
    case 'primitive':
      return `${base}/dev/primitives/${encodeURIComponent(axis)}/${encodeURIComponent(id)}`;
    case 'layout':
      return `${base}/dev/layouts/${encodeURIComponent(axis)}/${encodeURIComponent(id)}`;
    case 'template':
      return `${base}/dev/templates/${encodeURIComponent(id)}`;
  }
}

export async function fetchSavedSubtree(
  category: FetchableLibraryCategory,
  axis: string,
  id: string
): Promise<FetchSavedSubtreeResult> {
  // Local storage mode: resolve the saved subtree from localStorage.
  // Templates persist under their own key; sections / primitives / layouts
  // share the generic saved-component store.
  if (getComponentsStorageMode() === 'local') {
    const local = category === 'template' ? localGetTemplate(id) : localGetSavedComponent(category, id);
    return {
      id: local.id,
      name: local.name,
      description: local.description,
      blocks: local.blocks as TSavedComponentBlock[],
    };
  }
  const url = urlFor(category, axis, id);
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; hint?: string } | null;
    if (response.status === 403) {
      throw new Error(body?.hint ?? 'Endpoint disabled in this environment.');
    }
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  const result = (await response.json()) as {
    id: string;
    name: string;
    description?: string;
    blocks: Array<{ id: string; block: unknown }>;
  };
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    blocks: result.blocks as TSavedComponentBlock[],
  };
}

/** Convenience alias for templates (no axis). */
export function fetchSavedTemplate(id: string): Promise<FetchSavedSubtreeResult> {
  return fetchSavedSubtree('template', '', id);
}
