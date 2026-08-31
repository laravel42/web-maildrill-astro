/**
 * Adapters inyectables del backend propio (docs/52 F7, D8).
 *
 * En modo standalone, `apiClient.ts` habla directo con `/api/*` (proxy de
 * Vite en dev, mismo origen en producción — I9 de docs/52). En modo embebido
 * (`<Builder42Editor adapters={…} />`) el host (`web-maildrill-astro`) no
 * tiene ese Express montado: sus propias rutas de IA/Unsplash/publicación
 * viven en su BFF/`workers/`. En vez de que cada componente (`AiSectionGenerator`,
 * `UnsplashPicker`, `PublishPanel`, …) reciba una prop de adapter — tocaría 6+
 * componentes y sus tests — `apiClient.ts` consulta este registro module-level
 * antes de caer al `fetch` relativo. `Builder42Editor` es el ÚNICO punto que
 * lo escribe (vía `setApiAdapters` en un `useEffect` de montaje/desmontaje);
 * el resto del editor sigue llamando a las mismas funciones de `apiClient.ts`
 * sin saber si hay un adapter detrás o no.
 *
 * Todo campo es opcional: un host puede inyectar solo `publish` y dejar que
 * IA/Unsplash sigan sin disponibilidad (`fetchHealth` ya las reporta
 * apagadas) si no las necesita.
 */

import type {
  AiGenerateSectionRequest,
  AiGenerateSectionResponse,
  HealthResponse,
  ImageSearchResponse,
  PublishRequest,
  PublishResponse,
} from "../../shared/api";

export type GenerateFragmentFn = (
  req: AiGenerateSectionRequest,
) => Promise<AiGenerateSectionResponse>;

export type SearchImagesFn = (
  query: string,
  page: number,
  perPage: number,
) => Promise<ImageSearchResponse>;

/** Descarga el binario de una foto ya elegida (registra el trigger de descarga por ToS). */
export type DownloadImageFn = (photoId: string) => Promise<Blob>;

export type PublishFn = (req: PublishRequest) => Promise<PublishResponse>;

/**
 * Reporta disponibilidad de IA/Unsplash al host embebido — equivalente al
 * `ai.enabled`/`unsplash.enabled` de `fetchHealth()` en standalone, para que
 * `AiSectionGenerator`/`UnsplashPicker`/`ImageSourceField` se oculten igual
 * cuando el host no configuró ese adapter.
 */
export type FetchHealthFn = () => Promise<HealthResponse>;

export interface ApiAdapters {
  generateFragment?: GenerateFragmentFn;
  searchImages?: SearchImagesFn;
  downloadImage?: DownloadImageFn;
  publish?: PublishFn;
  fetchHealth?: FetchHealthFn;
}

let activeAdapters: ApiAdapters = {};

/**
 * Fija los adapters activos. Llamado por `Builder42Editor` al montar (con los
 * `adapters` recibidos por prop) y con `{}` al desmontar, para no dejar
 * colgado el adapter de una instancia ya cerrada si se monta otra sin
 * adapters (p. ej. abrir el standalone en la misma pestaña durante tests).
 */
export function setApiAdapters(adapters: ApiAdapters): void {
  activeAdapters = adapters;
}

export function getApiAdapters(): ApiAdapters {
  return activeAdapters;
}
