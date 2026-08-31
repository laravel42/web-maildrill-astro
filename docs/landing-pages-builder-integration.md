# Landing Pages Builder (Builder42) — contrato de datos e integración pendiente

> Estado actual: **demo funcional sin backend.** El editor (`packages/builder42/`,
> vendored desde `pb-static`) está montado y operativo en
> `/dashboard/landing-pages/demo`, pero persiste en `localStorage` del navegador
> y no tiene conectados IA / Unsplash / publicación. Este documento fija el
> contrato de datos tal como el editor ya lo espera, para que conectar un
> backend real en el futuro sea *cablear*, no *diseñar*.

No implementamos backend en esta fase. Este documento existe para que ese
trabajo, cuando se aborde, no tenga que releer `pb-static` desde cero.

---

## 1. Qué ya existe y qué falta

| Pieza | Estado | Dónde |
|---|---|---|
| Editor visual (UI, canvas, inspector, drag&drop) | ✅ Vendored y montado | `packages/builder42/` |
| Wrapper de host (carga client-only, shell, Save/Close) | ✅ | `src/components/react/LandingPageBuilder.tsx` |
| Ruta protegida por sesión | ✅ | `src/pages/dashboard/landing-pages/demo.astro` |
| Persistencia real (tabla `sites` + API) | ❌ | — (hoy: `localStorage`, `LandingPageBuilderPage.tsx`) |
| Adapter de IA (`generateFragment`) | ❌ | `adapters={{}}` vacío en `LandingPageBuilder.tsx` |
| Adapter de imágenes (`searchImages`/`downloadImage`) | ❌ | idem |
| Adapter de publicación (`publish`) | ❌ | idem |
| Adapter de salud (`fetchHealth`) | ❌ | idem |

El contrato de props del editor (`Builder42EditorProps`, en
`packages/builder42/src/Builder42Editor.tsx`) ya define exactamente estos 4
huecos vía `adapters?: ApiAdapters`. **No hay que tocar el editor vendored**
para conectar un backend — solo implementar las funciones y pasarlas por prop.

---

## 2. El documento: `BuilderSite` (la única fuente de verdad)

Todo lo que el editor produce es un único objeto JSON, `BuilderSite`
(`packages/builder42/src/builder/model/types.ts`). Es árbol normalizado,
serializable, sin referencias circulares — apto para columna `jsonb`.

```ts
interface BuilderSite {
  meta: SiteMeta;                    // nombre, breakpoints, tokens, temas, i18n, siteId de publicación
  pages: Record<PageId, BuilderPage>;
  pageOrder: PageId[];
  homePageId: PageId;
  assets?: Record<AssetId, Asset>;   // imágenes referenciadas, normalizadas por id
}
```

- `meta.siteId` es el identificador estable de publicación (se genera la
  primera vez que se publica, vía `slugifySiteId(meta.name)`) — **no** es el id
  de fila en una futura tabla `sites`; hay que decidir si son el mismo valor o
  se mapean 1:1.
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
type SearchImagesFn     = (query: string, page: number, perPage: number) => Promise<ImageSearchResponse>;
type DownloadImageFn    = (photoId: string) => Promise<Blob>;
type PublishFn          = (req: PublishRequest) => Promise<PublishResponse>;
type FetchHealthFn      = () => Promise<HealthResponse>;

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

**Dónde se conectan hoy (placeholder):**

```tsx
// src/components/react/LandingPageBuilder.tsx
<Builder
  ref={editorRef}
  site={initialSite}
  onSave={onSave}
  onClose={onClose}
  themeMode="host"
  adapters={{}}                 // ← aquí van los 4 adapters cuando existan
/>
```

Cuando se implementen, este es el único punto de cableado — el editor
vendored no cambia.

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

## 6. Persistencia: patrón a seguir (mirroring `email.astro`)

Hoy `LandingPageBuilderPage.tsx` persiste el `BuilderSite` completo en
`localStorage` bajo la clave fija `builder42:demo-site` — explícitamente
marcado como placeholder de demo, sin tabla ni API.

El patrón ya establecido en este repo para otros builders (templates de
email/SMS/WhatsApp/voice) es:

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

## 7. Checklist para la futura conexión de backend

- [ ] Tabla `sites`/`landing_pages` en `workers/` (jsonb del `BuilderSite`).
- [ ] Endpoints CRUD en `workers/`, tipados con `packages/builder42/shared/api.ts`
      donde aplique (publish) y con el propio `BuilderSite` para el resto.
- [ ] `loadLandingPageBuilder` (SSR loader, mirror de `loadTemplateBuilder`).
- [ ] Página real reemplazando `demo.astro` (con `?id=`, sin `localStorage`).
- [ ] Adapter `publish`: pipeline de publicación propio de Maildrill (dominios
      del tenant), no los providers de `pb-static`.
- [ ] Adapter `generateFragment`: conectar al pipeline de IA de Maildrill si
      existe uno reusable; si no, queda apagado (`fetchHealth` lo reporta y la
      UI oculta el botón — no bloquea el resto).
- [ ] Adapter `searchImages`/`downloadImage`: decidir si se usa Unsplash
      directo (como `pb-static`) o el gestor de medios propio de Maildrill
      (`/dashboard/media`) — son conceptualmente el mismo problema, evaluar
      unificar en vez de tener dos flujos de imágenes distintos en la app.
- [ ] Adapter `fetchHealth`: reportar qué adapters están realmente activos,
      para que la UI oculte lo que no esté conectado (no mostrar botones
      rotos).

---

## Referencias

- Contrato de props del editor: `packages/builder42/src/Builder42Editor.tsx`
- Registro de adapters: `packages/builder42/src/services/apiAdapters.ts`
- Tipos de API compartidos: `packages/builder42/shared/api.ts`
- Modelo del documento: `packages/builder42/src/builder/model/types.ts`
- Wrapper de host: `src/components/react/LandingPageBuilder.tsx`
- Página demo actual: `src/pages/dashboard/landing-pages/demo.astro`
- Decisión de no portar el backend de `pb-static`: `pb-static/docs/52-maildrill-visual-integration.md` (D8, D9)
- Patrón de persistencia de referencia: `src/lib/server/template-builder.ts`
