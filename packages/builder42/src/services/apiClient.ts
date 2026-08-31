/**
 * Cliente HTTP tipado para la API del servidor (docs/33 §6.5, docs/35 §2 Fase B).
 * ÚNICO punto del editor que hace red saliente, y solo a NUESTRO backend.
 * Usa rutas relativas (/api/*) para que el proxy de Vite lo resuelva en dev
 * y el mismo origen funcione en producción (D6).
 *
 * Nombrado `apiClient` (no `aiClient`): agrupa todos los endpoints del
 * servidor propio (IA, banco de imágenes, salud), no solo IA.
 *
 * Modo embebido (docs/52 F7, D8): `generateSection`, `searchImages`,
 * `downloadImage` y `publishSite` consultan primero `getApiAdapters()` — si
 * `Builder42Editor` recibió un adapter para esa operación, se usa en vez del
 * `fetch` relativo (el host embebido no tiene este Express montado). Sin
 * adapters (modo standalone, el caso de hoy) el comportamiento es idéntico al
 * anterior a esta fase.
 */

import type {
  AiGenerateSectionRequest,
  AiGenerateSectionResponse,
  ApiErrorResponse,
  HealthResponse,
  ImageSearchResponse,
  PublishRequest,
  PublishResponse,
  PublishedSitesResponse,
  TranslateRequest,
  TranslateResponse,
  TranslateUsageResponse,
} from "../../shared/api";
import { getApiAdapters } from "./apiAdapters";

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    /** Solo presente en `rate_limited`: segundos hasta poder reintentar. */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await res.json() as ApiErrorResponse;
    } catch {
      throw new ApiError(res.status, "unknown_error", res.statusText);
    }
    throw new ApiError(res.status, errorBody.error.code, errorBody.error.message, errorBody.error.retryAfter);
  }

  return res.json() as Promise<T>;
}

/** Comprueba el estado del servidor y si la IA/Unsplash están disponibles. */
export async function fetchHealth(): Promise<HealthResponse> {
  const adapter = getApiAdapters().fetchHealth;
  if (adapter) return adapter();
  return apiFetch<HealthResponse>("/api/health");
}

/**
 * Genera una sección de página con IA.
 * Lanza `ApiError` si el servidor devuelve un error.
 */
export async function generateSection(
  req: AiGenerateSectionRequest,
): Promise<AiGenerateSectionResponse> {
  const adapter = getApiAdapters().generateFragment;
  if (adapter) return adapter(req);
  return apiFetch<AiGenerateSectionResponse>("/api/ai/generate-section", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Busca fotos en el banco de imágenes (Unsplash, vía proxy del servidor).
 * Lanza `ApiError` si el servidor devuelve un error (ej. `unsplash_disabled`).
 */
export async function searchImages(
  query: string,
  page = 1,
  perPage = 20,
): Promise<ImageSearchResponse> {
  const adapter = getApiAdapters().searchImages;
  if (adapter) return adapter(query, page, perPage);
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    per_page: String(perPage),
  });
  return apiFetch<ImageSearchResponse>(`/api/images/search?${params.toString()}`);
}

/**
 * Descarga el binario de una foto de Unsplash (registra la descarga en el
 * servidor, obligatorio por ToS) y lo devuelve como `Blob` para convertir a
 * data URL en el llamador.
 */
export async function downloadImage(photoId: string): Promise<Blob> {
  const adapter = getApiAdapters().downloadImage;
  if (adapter) return adapter(photoId);
  const res = await fetch(`/api/images/download/${encodeURIComponent(photoId)}`);
  if (!res.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await res.json() as ApiErrorResponse;
    } catch {
      throw new ApiError(res.status, "unknown_error", res.statusText);
    }
    throw new ApiError(res.status, errorBody.error.code, errorBody.error.message, errorBody.error.retryAfter);
  }
  return res.blob();
}

// ─── Publicación (docs/33 §7, docs/36) ───────────────────────────────────────

/**
 * Publica el sitio (docs/36 F3). Lanza `ApiError` si el servidor devuelve un
 * error (`publish_disabled`, `rate_limited`, `invalid_request`/`invalid_fragment`,
 * `not_implemented` para providers stub).
 */
export async function publishSite(req: PublishRequest): Promise<PublishResponse> {
  const adapter = getApiAdapters().publish;
  if (adapter) return adapter(req);
  return apiFetch<PublishResponse>("/api/publish", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** Lista las publicaciones del tenant activo (docs/36 F3, gestión de sitios publicados). */
export async function listPublishedSites(): Promise<PublishedSitesResponse> {
  return apiFetch<PublishedSitesResponse>("/api/sites");
}

/**
 * Despublica un sitio. `DELETE /api/sites/:siteId` devuelve 204 sin body en
 * éxito — no hay nada que parsear como JSON, a diferencia de `apiFetch<T>`.
 * Lanza `ApiError` si el servidor devuelve un error (`not_found`,
 * `not_implemented` si el provider activo no soporta despublicar).
 */
export async function unpublishSite(siteId: string): Promise<void> {
  const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, { method: "DELETE" });
  if (!res.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await res.json() as ApiErrorResponse;
    } catch {
      throw new ApiError(res.status, "unknown_error", res.statusText);
    }
    throw new ApiError(res.status, errorBody.error.code, errorBody.error.message, errorBody.error.retryAfter);
  }
}

/**
 * Umbral de preflight de tamaño (docs/36 B6/F3): el límite real del servidor
 * es `express.json({ limit: "10mb" })` (`app.ts`) — se avisa un poco ANTES
 * (9mb) para dejar margen a la sobrecarga de la codificación JSON/HTTP y
 * evitar un 413 por unos bytes de diferencia.
 */
export const PUBLISH_SIZE_WARNING_BYTES = 9 * 1024 * 1024;

/**
 * Mide el tamaño en bytes de un sitio ya serializado a JSON (`serializeSite`,
 * UTF-8) y devuelve si excede el umbral de aviso — función PURA, sin red, para
 * que `PublishPanel` pueda avisar ANTES de mandar la request en vez de esperar
 * al 413 del servidor (docs/36 B6). Un sitio con imágenes de Unsplash
 * embebidas en el JSON pasa el límite con facilidad.
 */
export function checkPublishSize(serializedSite: string): { bytes: number; tooLarge: boolean } {
  const bytes = new TextEncoder().encode(serializedSite).length;
  return { bytes, tooLarge: bytes > PUBLISH_SIZE_WARNING_BYTES };
}

export { ApiError };

// ─── Traducción automática: DeepL (docs/51 §3/§4 F3) ─────────────────────────

/**
 * Traduce un lote de textos vía el proveedor configurado en el servidor
 * (DeepL o mock). Lanza `ApiError` si el servidor devuelve un error
 * (`translate_disabled`, `rate_limited`, `budget_exceeded`, `invalid_request`,
 * `provider_error`, `timeout`).
 */
export async function translateTexts(req: TranslateRequest): Promise<TranslateResponse> {
  return apiFetch<TranslateResponse>("/api/translate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Consulta el uso de traducción: caracteres de la cuenta DeepL (si el
 * proveedor lo reporta) y el presupuesto diario propio del tenant.
 */
export async function fetchTranslateUsage(): Promise<TranslateUsageResponse> {
  return apiFetch<TranslateUsageResponse>("/api/translate/usage");
}
