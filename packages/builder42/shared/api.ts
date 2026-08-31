/**
 * Contrato de la API compartido entre el editor (cliente) y el servidor.
 * Importado por `src/` (editor) y por `server/src/` (servidor) para que
 * los tipos estén sincronizados sin duplicación (docs/33 §3).
 */

// ─── IA (docs/33 §6.2) ───────────────────────────────────────────────────────

export interface AiGenerateSectionRequest {
  /** Descripción en lenguaje natural de la sección a generar. */
  prompt: string;
  context: {
    /** Locale activo del editor (ej. "es", "en"). */
    locale: string;
    /** ID del tema activo del sitio (opcional). */
    themeId?: string;
    /** Claves de tokens disponibles del sitio. */
    availableTokens?: string[];
    /** Tipo del componente padre donde se insertará el fragmento. */
    targetParentType?: string;
  };
}

export interface AiGenerateSectionResponse {
  /** Fragmento de árbol de nodos generado por la IA (JSON del builder). */
  fragment: {
    rootId: string;
    nodes: Record<string, unknown>;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Identificador del modelo que generó la respuesta. */
  model: string;
}

// ─── Banco de imágenes: Unsplash (docs/35 §2 Fase A) ─────────────────────────

export interface ImageSearchResult {
  /** ID de la foto en Unsplash. */
  id: string;
  description: string | null;
  urls: {
    /** 200px — para el grid del picker. */
    thumb: string;
    /** 400px. */
    small: string;
    /** 1080px — usada para la descarga/asset final. */
    regular: string;
  };
  author: {
    name: string;
    /** Link al perfil del fotógrafo en Unsplash. */
    url: string;
  };
  /** Link a la foto en Unsplash (para atribución). */
  unsplashUrl: string;
  width: number;
  height: number;
}

export interface ImageSearchResponse {
  results: ImageSearchResult[];
  total: number;
  totalPages: number;
}

// ─── Publicación (docs/33 §7, docs/36) ───────────────────────────────────────

/** Advertencia de export, ya usada por el ZIP local (`src/builder/export/warnings.ts`). */
export interface ExportWarning {
  nodeId: string;
  type: "missing-node" | "unknown-type";
  message: string;
  nodeType?: string;
}

export interface PublishRequest {
  /** JSON completo del sitio (BuilderSite serializado). */
  site: unknown;
  /**
   * Identificador estable del sitio dentro del tenant (p. ej. el id local del
   * proyecto en el editor). Se usa para republicar en el mismo destino en vez
   * de crear uno nuevo en cada llamada — el `local`/`self-hosted` `DeployProvider`
   * lo usa como parte de la ruta de salida (`local`) o para derivar el
   * subdominio por defecto (`self-hosted`, ver `slug.ts`).
   */
  siteId: string;
  /**
   * Subdominio explícito deseado (solo relevante para el provider
   * `self-hosted`; se ignora en `local`). Si se omite, se deriva de `siteId`
   * (`slugifySiteId`).
   */
  domain?: string;
  /** Versión del schema para migración/rechazo (docs/33 §7). */
  schemaVersion?: number;
}

export interface PublishResponse {
  /** URL pública del sitio publicado. */
  url: string;
  /** ID del deployment (para consultar estado). */
  deploymentId: string;
  /** Proveedor de deploy usado. */
  provider: string;
  /**
   * Advertencias del export (nodos huérfanos, tipos desconocidos — docs/36 B5).
   * `buildSiteFiles` ya las calcula (`ExportSiteResult.warnings`); antes de
   * este contrato la ruta las descartaba, dejando publicar menos informativo
   * que descargar el ZIP (`ExportWarningsBanner` en `SiteFileActions`).
   */
  warnings?: ExportWarning[];
}

/** Una publicación registrada, tal como la devuelve `GET /api/sites` (docs/36 B4). */
export interface PublishedSite {
  siteId: string;
  url: string;
  deploymentId: string;
  provider: string;
  /** Solo presente para providers con subdominio propio (`self-hosted`). */
  subdomain?: string;
  publishedAt: string;
}

export interface PublishedSitesResponse {
  sites: PublishedSite[];
}

// ─── Traducción (docs/51) ────────────────────────────────────────────────────

export interface TranslateRequest {
  /** Textos a traducir. Se devuelven en el MISMO orden. */
  texts: string[];
  /** Locale destino del SITIO (ej. "en"). El servidor lo mapea a código DeepL. */
  targetLocale: string;
  /** Locale origen del sitio. Si se omite, DeepL autodetecta. */
  sourceLocale?: string;
  /** `"text"` (default) o `"html"` → `tagHandling: 'html'`. Un lote es de un solo formato:
   *  el cliente agrupa los segmentos por `container` y manda como mucho 2 lotes por locale
   *  (uno de texto plano, otro de HTML si hay algún campo en el fallback `html-whole`). */
  format?: "text" | "html";
  /** Contexto no traducido y NO facturado (nombre del sitio, título de página). */
  context?: string;
}

export interface TranslateResponse {
  translations: Array<{ text: string; detectedSourceLang: string; billedCharacters: number }>;
  /** Suma de `billedCharacters` del lote. */
  billedCharacters: number;
  /** Caracteres restantes del presupuesto diario propio (no el de DeepL). */
  remainingDailyChars: number;
}

export interface TranslateUsageResponse {
  /** Uso del periodo de facturación de la CUENTA DeepL (`client.getUsage()`). */
  character?: { count: number; limit: number };
  /** Presupuesto diario propio por tenant, independiente del de DeepL. */
  daily: { used: number; limit: number };
}

// ─── Health (docs/33 §4) ─────────────────────────────────────────────────────

export interface HealthResponse {
  status: "ok";
  ai: {
    enabled: boolean;
    /** Nombre informativo del proveedor activo (omitir si se prefiere privado). */
    provider?: string;
  };
  publish: {
    enabled: boolean;
    /**
     * Nombre del `DeployProvider` activo (`local` | `cloudflare` | `vercel` |
     * `self-hosted`). Informativo — nunca credenciales (docs/36 §5).
     */
    provider: string;
    /** Dominio base para providers con subdominio propio (`self-hosted`). */
    baseDomain?: string;
    /**
     * Qué puede hacer el provider activo (docs/36 B2) — la UI se construye
     * leyendo esto, nunca conociendo el nombre del provider por switch.
     */
    capabilities: {
      /** El usuario puede elegir un subdominio (`self-hosted`). */
      customSubdomain: boolean;
      /** La URL devuelta es abrible desde el navegador (`false` para `local`, `file://`). */
      openableUrl: boolean;
      /** El provider soporta `GET /api/sites` (listar publicaciones). */
      list: boolean;
      /** El provider soporta `DELETE /api/sites/:siteId` (despublicar). */
      remove: boolean;
    };
  };
  unsplash: {
    enabled: boolean;
  };
  translate: {
    enabled: boolean;
    /** Informativo: "deepl" | "mock". Nunca credenciales. */
    provider?: string;
    /** Locales del sitio que DeepL admite como destino (deriva de shared/deeplLang.ts). */
    supportedTargets?: string[];
  };
}

// ─── Errores (docs/33 §6.1) ──────────────────────────────────────────────────

export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "budget_exceeded"
  | "ai_disabled"
  | "publish_disabled"
  | "unsplash_disabled"
  | "translate_disabled"
  | "invalid_fragment"
  | "provider_error"
  | "timeout"
  | "not_implemented"
  | "internal_error";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  /** Solo en `rate_limited`: segundos hasta que se puede reintentar. */
  retryAfter?: number;
  /** Solo en `invalid_fragment` / `invalid_request`: detalles de validación. */
  issues?: Array<{ path: string; message: string }>;
}

export interface ApiErrorResponse {
  error: ApiError;
}
