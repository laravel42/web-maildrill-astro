# Landing Pages Builder (Builder42) — estado de la integración

> Estado actual: **integrado en el workspace con persistencia real y galería de
> media propia.** El editor (`packages/builder42/`, vendored desde `pb-static`)
> está montado en `/dashboard/landings/editor` (`?id=` reabre una landing
> guardada), la pestaña **Landings** lista, crea, renombra, duplica y borra
> sitios contra la tabla `landings` de `workers/`, y el picker de imágenes
> ofrece la media library del tenant como segunda fuente. **Pendiente:**
> publicación, IA, Unsplash — los tres adapters siguen apagados y
> `fetchHealth` lo reporta para que la UI oculte lo que no está conectado.

Una landing = **un `BuilderSite` completo** (multipágina), no una página. Una
fila = un sitio.

---

## 1. Qué ya existe y qué falta

| Pieza                                                                 | Estado                | Dónde                                                                                                                                 |
| --------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Editor visual (UI, canvas, inspector, drag&drop)                      | ✅ Vendored y montado | `packages/builder42/`                                                                                                                 |
| Wrapper de host (carga client-only, shell, Save/Close, `locale="en"`) | ✅                    | `src/components/react/LandingPageBuilder.tsx`                                                                                         |
| Pestaña Landings (listado, filtros, paginación, verbos)               | ✅                    | `src/components/react/AppLandings.tsx`, `src/pages/dashboard/landings/index.astro`                                                    |
| Ruta del editor protegida por sesión + loader SSR                     | ✅                    | `src/pages/dashboard/landings/editor.astro`, `src/lib/server/landing-builder.ts`                                                      |
| Persistencia real (tabla `landings` + CRUD)                           | ✅                    | `workers/migrations/0032_landings.sql`, `workers/packages/product/src/landings.ts`, `workers/apps/product-api/src/routes/landings.ts` |
| Cliente de navegador                                                  | ✅                    | `src/lib/app/landings.ts`                                                                                                             |
| Adapter de salud (`fetchHealth`, todo apagado)                        | ✅                    | `src/lib/app/builder42-adapters.ts`                                                                                                   |
| Galería de media del tenant como 2ª fuente de imágenes                | ❌                    | requiere `listMedia` en el editor (ver §4b)                                                                                           |
| Adapter de publicación (`publish`)                                    | ❌                    | endpoints reservados: `501 not_implemented`                                                                                           |
| Adapter de IA (`generateFragment`)                                    | ❌                    | —                                                                                                                                     |
| Adapter de imágenes Unsplash (`searchImages`/`downloadImage`)         | ❌                    | —                                                                                                                                     |

El contrato de props del editor (`Builder42EditorProps`, en
`packages/builder42/src/Builder42Editor.tsx`) define esos huecos vía
`adapters?: ApiAdapters`, y el único punto de cableado es
`src/lib/app/builder42-adapters.ts`.

### Por qué `fetchHealth` no es opcional

`packages/builder42/src/services/apiClient.ts` cae a rutas relativas `/api/*`
cuando no hay adapter, y este host no tiene ese backend: un adapter ausente no
es "función apagada", es un 404 por cada montaje. Peor, `listPublishedSites`,
`unpublishSite`, `translateTexts` y `fetchTranslateUsage` **no tienen hook de
adapter** — siempre pegan a `/api/*`. Lo que realmente apaga esas superficies es
reportar capacidades: `ImageSourceField`, `AiSectionGenerator`,
`TranslationModal`, `SeoSettings`, `PublishPanel` y `PublishedSitesList` (que
mira `publish.capabilities.list` antes de llamar al endpoint sin adapter) se
esconden solos.

Excepción conocida, sin arreglar: `SeoSettings` llama `fetchTranslateUsage()`
sin gate, así que deja un 404 capturado por montaje. Silenciarlo pide un adapter
más en el editor; es ruido inocuo, no un fallo.

---

## 2. El documento: `BuilderSite` (la única fuente de verdad)

Todo lo que el editor produce es un único objeto JSON, `BuilderSite`
(`packages/builder42/src/builder/model/types.ts`). Es árbol normalizado,
serializable, sin referencias circulares — apto para columna `jsonb`.

```ts
interface BuilderSite {
  meta: SiteMeta; // nombre, breakpoints, tokens, temas, i18n, siteId de publicación
  pages: Record<PageId, BuilderPage>;
  pageOrder: PageId[];
  homePageId: PageId;
  assets?: Record<AssetId, Asset>; // imágenes referenciadas, normalizadas por id
}
```

- `meta.siteId` es el identificador estable de **publicación** (se genera la
  primera vez que se publica, vía `slugifySiteId(meta.name)`) — deliberadamente
  **no** es el `id` de la fila: acaba siendo una etiqueta de hostname pública, así
  que debe ser legible, única entre tenants y estable una vez existen enlaces,
  mientras que el `id` es un uuid opaco e interno. La tabla lo espeja en la
  columna `site_id` (nullable, índice único parcial), y `updateLanding` la
  sincroniza desde `document.meta.siteId` en cada guardado, porque el editor lo
  escribe dentro del JSON.
- `meta.version` existe para migraciones de schema — cualquier tabla que
  guarde este JSON debe versionarlo también (columna `schema_version`, o leer
  este campo del propio JSON).
- El estilo es mobile-first y responsive desde el modelo (`NodeStyle = { base,
overrides }`), no en el HTML exportado — esto no afecta al backend salvo que
  se quiera renderizar el sitio del lado servidor (fuera de alcance aquí).

**No hay necesidad de definir un schema propio para el contenido**: es el
mismo `BuilderSite` que ya usa `pb-static`, solo hay que decidir cómo se
guarda una fila que lo contiene (ver §4).

---

## 3. El contrato de API: `packages/builder42/shared/api.ts`

Los tipos de request/response que el editor ya conoce y usará en cuanto se
inyecte un adapter real — vendored, no hay que reinventarlos:

```ts
// IA — generar una sección desde un prompt
AiGenerateSectionRequest  { prompt: string; context: { locale, themeId?, availableTokens?, targetParentType? } }
AiGenerateSectionResponse { fragment: { rootId: string; nodes: Record<string, unknown> }; usage?: {...}; model: string }

// Banco de imágenes (Unsplash)
ImageSearchResult    { id, description, urls: { thumb, small, regular }, author: { name, url }, unsplashUrl, width, height }
ImageSearchResponse  { results: ImageSearchResult[]; total; totalPages }

// Publicación
PublishRequest  { site: unknown; siteId: string; domain?: string; schemaVersion?: number }
PublishResponse { url: string; deploymentId: string; provider: string; warnings?: ExportWarning[] }
PublishedSite         { siteId, url, deploymentId, provider, subdomain?, publishedAt }
PublishedSitesResponse { sites: PublishedSite[] }

// Salud / capacidades (qué está encendido, para que la UI se adapte)
HealthResponse { status: "ok"; ai: {...}; publish: {...; capabilities: {...}}; unsplash: {...}; translate: {...} }

// Errores — código de error uniforme para todos los adapters
ApiErrorCode = "invalid_request" | "unauthorized" | "forbidden" | "not_found"
             | "rate_limited" | "budget_exceeded" | "ai_disabled" | "publish_disabled"
             | "unsplash_disabled" | "translate_disabled" | "invalid_fragment"
             | "provider_error" | "timeout" | "not_implemented" | "internal_error"
ApiErrorResponse { error: { code: ApiErrorCode; message: string; retryAfter?; issues? } }
```

Estos tipos ya viven en el árbol vendored (`packages/builder42/shared/api.ts`)
y no forman parte del `tsconfig`/eslint de este repo (ver `packages/VENDOR.md`
§Scope) — se pueden importar directo desde ahí para tipar los futuros
endpoints del BFF/`workers/`, sin duplicarlos.

---

## 4. Los 4 adapters a implementar (forma exacta, `packages/builder42/src/services/apiAdapters.ts`)

```ts
type GenerateFragmentFn = (req: AiGenerateSectionRequest) => Promise<AiGenerateSectionResponse>;
type SearchImagesFn = (
  query: string,
  page: number,
  perPage: number,
) => Promise<ImageSearchResponse>;
type DownloadImageFn = (photoId: string) => Promise<Blob>;
type PublishFn = (req: PublishRequest) => Promise<PublishResponse>;
type FetchHealthFn = () => Promise<HealthResponse>;

interface ApiAdapters {
  generateFragment?: GenerateFragmentFn;
  searchImages?: SearchImagesFn;
  downloadImage?: DownloadImageFn;
  publish?: PublishFn;
  fetchHealth?: FetchHealthFn;
}
```

Todos son opcionales de forma independiente: se puede conectar solo
`publish` y dejar IA/Unsplash apagados (`fetchHealth` ya se encarga de
reportarlo para que la UI oculte esas funciones, ver docs/52 F7 en `pb-static`).

**Dónde se conectan hoy:**

```tsx
// src/components/react/LandingPageBuilder.tsx
<Builder
  ref={editorRef}
  site={initialSite}
  onSave={onSave}
  onClose={onClose}
  themeMode="host"
  locale="en" // Maildrill es monolingüe
  adapters={landingBuilderAdapters} // src/lib/app/builder42-adapters.ts
/>
```

`landingBuilderAdapters` es el único punto de cableado; hoy solo lleva
`fetchHealth` (todo apagado). Añadir un adapter = añadir un campo ahí y
encender su flag en el health.

---

## 4b. La segunda galería: la media library del tenant (Plan A)

Decidido: Unsplash y la media library de Maildrill son **complementarias**, no
alternativas — el picker debe ofrecer las dos. Eso **no** se puede hacer solo
con adapters: `ApiAdapters` no tiene `listMedia`, y el picker
(`ImageSourceField.tsx`, tres modos: URL / subir archivo / Unsplash) vive en el
paquete vendorizado. El trabajo va en `packages/builder42/` y, por
`packages/VENDOR.md`, **debe quedar registrado ahí como "Code patches"** para
que un re-sync desde `pb-static` no lo borre en silencio.

Especificación:

1. `shared/api.ts`: tipo `MediaAsset { id, url, thumbUrl, fileName, mimeType, width?, height?, bytes? }`,
   su respuesta paginada, y `media: { enabled: boolean }` en `HealthResponse`.
2. `services/apiAdapters.ts`: `listMedia?: (query, page, perPage) => Promise<MediaListResponse>`.
3. `services/apiClient.ts`: `listMedia()` consultando el adapter, con fallback
   relativo para el modo standalone.
4. `inspector/controls/ImageSourceField.tsx`: tercer botón "Media library"
   gated por `health.media.enabled`, abriendo un `MediaPicker` hermano de
   `UnsplashPicker`.
5. i18n `en`/`es`/`it`.

Detalle que importa: al elegir de la media library hay que hacer
`setProp(node.id, fieldKey, { kind: 'url', url })`, **no** `addAsset`. El modelo
ya soporta `kind: "url"`, y `addAsset` incrustaría la imagen como data URL
dentro del documento — que es exactamente lo que hace que una landing pese
megabytes y falle al publicar (ver la columna "Size" del listado). Subir un
archivo y Unsplash sí inlinan; esta fuente no debe.

En el host: el adapter apunta a `/api/v1/media`, que ya existe (`media-map.ts`,
`/dashboard/media`, proxy BFF).

---

## 5. Qué NO traer de `pb-static`

Decisión ya tomada y documentada (`pb-static/docs/52-maildrill-visual-integration.md`,
decisión D8, cerrada 2026-08-27): **no portar el servidor Express de
`pb-static/server/`.** Ese servidor (rutas `/api/ai`, `/api/images`,
`/api/translate`, `/api/publish`, `/api/sites`) es un backend standalone
completo con su propia auth, rate limiting y providers de deploy
(`local`/`self-hosted`/`cloudflare`/`vercel`) — pensado para cuando
Builder42 corre solo, sin un host.

Dentro de Maildrill, la implementación real de estos 4 adapters debe:

- Vivir en el BFF (`src/pages/api/`) + `workers/`, **no** como un segundo
  Express paralelo.
- Reusar lo que `workers/` ya resuelve para el resto de la app: IA (si existe
  un pipeline de IA para otros builders), el proxy de imágenes que se decida
  usar, y el pipeline de publicación propio de Maildrill (dominios,
  hosting) — no el de `pb-static` (`self-hosted`/`cloudflare`/`vercel` locales
  al standalone).
- Autenticar con la sesión/tenant ya establecidos por `src/middleware.ts`
  (mismo patrón JWT que `productClient`/`mintServiceToken`), no con el
  `middleware/auth.ts` de `pb-static/server/`.

---

## 6. Persistencia (implementada)

Sigue el patrón de los builders de templates: loader SSR → props → guardado por
el BFF.

- **Tabla** `landings` (`workers/migrations/0032_landings.sql`,
  `packages/database/src/schema.ts`): `id`, `tenant_id`, `name`,
  `document jsonb`, `schema_version`, `site_id` (único parcial),
  `published_url`, `published_at`, `page_count`, `document_bytes`, timestamps.
- **Data layer** `workers/packages/product/src/landings.ts`. Dos invariantes:
  1. `document` **nunca** aparece en una consulta de listado — lleva imágenes
     inline, así que una fila puede pesar megabytes. `page_count` y
     `document_bytes` se recalculan en cada escritura precisamente para que el
     listado pueda contestar "¿cuánto pesa y va a publicar?" sin leerlo.
  2. El estado es **derivado**: `draft` (sin publicar), `published`
     (`updated_at <= published_at`), `stale` (editada después de publicar). Una
     columna almacenada habría que reescribirla en cada guardado y se
     desincronizaría la primera vez que no se hiciera.
- **Rutas** `workers/apps/product-api/src/routes/landings.ts`:
  `GET /v1/landings` (con `q`, `status`, `sort`, `dir`, `limit`, `offset` →
  `{ items, total }`), `GET/PATCH/DELETE /v1/landings/:id`, `POST /v1/landings`,
  `POST /v1/landings/:id/duplicate`, y `POST`/`DELETE /v1/landings/:id/publish`
  reservados con `501 not_implemented`.
  `bodyLimit` propio de 12 MB en create/patch: el límite global de la app es 2 MB
  y un documento con imágenes lo pasa enseguida; 12 MB deja que el aviso de
  tamaño del propio editor (9 MB) sea lo que avise, no un 413.
- **Loader SSR** `src/lib/server/landing-builder.ts` (`loadLandingBuilder`) +
  `src/pages/dashboard/landings/editor.astro`.
- **Guardado**: `LandingPageBuilderPage.tsx` → `PATCH` si hay id, `POST` en el
  primer guardado (y `history.replaceState` a `?id=` para que un reload reabra la
  fila). Duplicar nunca clona `site_id`/`published_url`/`published_at`: esa
  identidad pertenece a la URL viva del original.

### Nota de entorno

`pnpm --dir workers db:migrate` falló en el entorno local con
`permission denied for schema drizzle` (el rol `maildrill` no tiene privilegios
sobre el esquema de bookkeeping de drizzle en el Postgres que escucha en :5432).
El SQL de la migración sí aplica: verificado ejecutándolo en una transacción con
`ROLLBACK`. Para aplicarla: correr las migraciones con el rol dueño del esquema,
o `GRANT USAGE, CREATE ON SCHEMA drizzle TO maildrill`.

---

## 6b. Patrón de referencia (templates)

Para futuras piezas, el patrón que se siguió:

- **SSR loader** (`src/lib/server/template-builder.ts` → `loadTemplateBuilder`):
  lee `?id=` de la URL, resuelve sesión + tenant, pide la fila al backend vía
  `productClient` (cliente OpenAPI tipado sobre `workers/`), y redirige si no
  existe o pertenece a otro canal/tenant.
- **Página Astro** (`src/pages/dashboard/templates/email.astro`): llama al
  loader server-side, pasa el resultado como props al componente React
  (`client:only="react"`).
- **Guardado**: el componente React llama a un endpoint del BFF (no
  `localStorage`) que persiste vía `workers/`.

Trasladado a landing pages, esto implicaría (cuando se implemente, fuera de
alcance de este documento):

1. Tabla `sites` (o `landing_pages`) en `workers/packages/database` —
   columnas mínimas: `id`, `tenant_id`, `name`, `document jsonb` (el
   `BuilderSite` completo), `schema_version`, `published_url`, timestamps.
2. Endpoints en `workers/` (`GET/POST/PUT /v1/landing-pages/:id`, mismo shape
   que `/v1/templates/{id}`).
3. Un `loadLandingPageBuilder` análogo a `loadTemplateBuilder` en
   `src/lib/server/`.
4. Reemplazar `demo.astro` + `LandingPageBuilderPage.tsx` por una página real
   con `?id=`, y el `onSave` llamando al BFF en vez de `localStorage`.

---

## 7. Checklist

Hecho:

- [x] Tabla `landings` en `workers/` (jsonb del `BuilderSite`) + migración `0032`.
- [x] CRUD en `workers/` con filtros, orden, paginación y duplicado; verbos de
      publicación reservados (`501`).
- [x] `loadLandingBuilder` (SSR loader, mirror de `loadTemplateBuilder`).
- [x] Ruta real `/dashboard/landings/editor?id=` (el demo de `localStorage` ya
      no existe).
- [x] Pestaña **Landings** con listado orientado a publicación: estado, URL
      pública, nº de páginas, peso del documento, última edición; renombrar,
      duplicar, borrar.
- [x] Adapter `fetchHealth` reportando todo apagado, para que la UI oculte lo que
      no está conectado en vez de mostrar botones rotos.
- [x] Idioma del editor fijado a inglés (`locale="en"`); auto-traducción oculta,
      no eliminada.
- [x] Segunda galería: media library del tenant en el picker de imágenes (§4b).
      `listMedia` cablea `ImageSourceField`/`MediaPicker.tsx` a `/v1/media` vía
      `src/lib/app/builder42-adapters.ts`; `health.media.enabled = true`.
      Seleccionar un asset usa `{ kind: "url", url }`, no `addAsset` — no se
      incrusta como data URL. Registrado en `packages/VENDOR.md`.

Pendiente:

- [ ] Adapter `publish`: pipeline de publicación propio de Maildrill (dominios
      del tenant), no los providers de `pb-static`. Al llegar, rellena
      `site_id`/`published_url`/`published_at` y cambia el `501` por la
      implementación real; la UI ya tiene el botón (deshabilitado) y las
      columnas.
- [ ] Adapter `searchImages`/`downloadImage` (Unsplash), complementario a la
      media library — no sustitutivo.
- [ ] Adapter `generateFragment`: conectar al pipeline de IA de Maildrill si
      existe uno reusable; si no, queda apagado.
- [ ] Regenerar los tipos OpenAPI (`pnpm gen:api`) para quitar los `as never` de
      `landings/index.astro` y `landing-builder.ts` (mismo atajo que usa
      `automations.astro` hoy).
- [ ] Aplicar la migración en el entorno local (ver nota de entorno en §6).

---

## Referencias

- Contrato de props del editor: `packages/builder42/src/Builder42Editor.tsx`
- Registro de adapters: `packages/builder42/src/services/apiAdapters.ts`
- Tipos de API compartidos: `packages/builder42/shared/api.ts`
- Modelo del documento: `packages/builder42/src/builder/model/types.ts`
- Wrapper de host: `src/components/react/LandingPageBuilder.tsx`
- Adapters del host: `src/lib/app/builder42-adapters.ts`
- Cliente de navegador: `src/lib/app/landings.ts`
- Decisión de no portar el backend de `pb-static`: `pb-static/docs/52-maildrill-visual-integration.md` (D8, D9)
- Patrón de persistencia de referencia: `src/lib/server/template-builder.ts`
