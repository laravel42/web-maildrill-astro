/**
 * fetchTheme — client-side helpers for the `/dev/save-theme` and
 * `/dev/themes/*` backend endpoints introduced by L42-306.
 *
 * Mirrors the structure of `fetchSavedComponent.ts` so the Components
 * Library drawer can use both kinds of library entries through similar
 * interfaces. All requests surface backend errors verbatim — the UI
 * layer renders them in toasts / inline alerts.
 */

import type { ThemeBundle, ThemeBundlePayload } from '@eb/document-core';

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import { getComponentsStorageMode } from '../../documents/editor/EditorContext';

import {
  localDeleteTheme,
  localGetTheme,
  localListThemes,
  localSaveTheme,
  localUpdateTheme,
} from './localLibraryStore';

/** Listing item — what `GET /dev/themes` returns for the gallery. */
export type ThemeListing = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  /**
   * Inlined design-token bundle for the swatch card render. Optional
   * because pre-existing themes saved without these fields still
   * surface in the listing — the swatch falls back to neutral colours.
   */
  globals?: {
    bodyBackgroundColor?: string;
    canvasBackgroundColor?: string;
    canvasColor?: string;
    backdropColor?: string;
    fontFamily?: string;
    fontFamilySerif?: string;
    fontFamilyMonospace?: string;
    textColor?: string;
    headingTextColor?: string;
    primaryColor?: string;
    secondaryColor?: string;
    [key: string]: unknown;
  };
  blocks?: Record<string, Record<string, unknown>>;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string; hint?: string }) | null;
  if (!response.ok) {
    if (response.status === 403 && body?.hint) throw new Error(body.hint);
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return body as T;
}

export async function listThemes(): Promise<ThemeListing[]> {
  if (getComponentsStorageMode() === 'local') return localListThemes();
  const response = await fetch(`${resolveBackendUrl()}/dev/themes`);
  const result = await readJson<{ themes: ThemeListing[] }>(response);
  return result.themes;
}

export async function fetchTheme(id: string): Promise<ThemeBundle> {
  if (getComponentsStorageMode() === 'local') return localGetTheme(id);
  const response = await fetch(`${resolveBackendUrl()}/dev/themes/${encodeURIComponent(id)}`);
  return readJson<ThemeBundle>(response);
}

/**
 * Save the current theme bundle. The server mints the UUID and the
 * ISO timestamps; the client only provides metadata + payload.
 */
export async function saveTheme(input: { name: string; description?: string; bundle: ThemeBundlePayload }): Promise<{
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  saved: string;
}> {
  if (getComponentsStorageMode() === 'local') return localSaveTheme(input);
  const response = await fetch(`${resolveBackendUrl()}/dev/save-theme`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readJson(response);
}

/**
 * Partial update — at least one of `name`, `description`, `bundle` is
 * required. Empty `description` clears the field.
 */
export async function updateTheme(
  id: string,
  input: {
    name?: string;
    description?: string;
    bundle?: ThemeBundlePayload;
  }
): Promise<{
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}> {
  if (getComponentsStorageMode() === 'local') return localUpdateTheme(id, input);
  const response = await fetch(`${resolveBackendUrl()}/dev/themes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readJson(response);
}

export async function deleteTheme(id: string): Promise<{ id: string; deleted: string }> {
  if (getComponentsStorageMode() === 'local') return localDeleteTheme(id);
  const response = await fetch(`${resolveBackendUrl()}/dev/themes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJson(response);
}
