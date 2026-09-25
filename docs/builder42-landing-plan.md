# Plan — Landing de Builder42 (copia de `web-inky`)

Objetivo: replicar lo que `web-inky` hace por el **email builder** (landing editorial
multi-idioma + editor embebido + directorio de plantillas + páginas SEO), pero para
**Builder42** (editor visual de landing pages/sitios), con identidad visual propia.

Repo actual de referencia: `C:\Users\eduvc\projects-container\projects\_laravel42\web-inky`
(landing de `emailbuilder.online`). Editor a promocionar:
`web-maildrill-astro/packages/builder42`.

---

## 0. Lo que hay hoy, verificado

### `web-inky` (el molde)

| Pieza | Estado |
|---|---|
| Framework | Astro `7.2.2`, salida **estática**, `build.format: 'file'`, `trailingSlash: 'never'` |
| React | `18.3.1` + `@astrojs/react@6.0.2` |
| Editor | **`email-builder-online@4.3.4` desde npm**, montado como `<EditorApp client:only="react" />` con `uiTheme="inky"` |
| Idiomas | en/es/it, **rutas prerenderizadas reales** (`/`, `/es`, `/it`); copy aplicado **en build** desde `src/lib/dictionaries.ts` (47 KB) |
| Páginas SEO | 5 guías de intención × 3 idiomas = 15 URLs, copy en `src/lib/seoPages.ts` (**109 KB**) |
| Directorio plantillas | `/templates` + 1 página por plantilla (~20), **solo inglés a propósito** (evitar "scaled content") |
| Plantillas (datos) | Generadas a `public/templates/` (`catalog.json`, `docs/<id>.json`, `previews/<id>.jpg`) por `scripts/dump-template-catalog.mjs` + `generate-template-previews.mjs` (Playwright sobre el HTML del email) |
| Guard de calidad | `scripts/audit-seo.mjs` (`pnpm audit:seo`): longitud/unicidad de title y description, un solo `h1`, hreflang recíproco, sin lenguaje "IA", sin prometer bloques inexistentes, sin enlaces internos roto |
| Fuentes | Self-hosted vía `fonts` de Astro (Newsreader / Space Grotesk / Space Mono) |
| Estilos | `tokens.css`, `landing.css` (33 KB), `pages.css` |
| Analítica / consent | PostHog + `CookieConsent.astro` |
| Deploy | Cloudflare Pages — `wrangler pages deploy dist --project-name=inky-astro` |
| Origen canónico | `SITE_ORIGIN` en `src/lib/seo.ts` + `site` en `astro.config.mjs` (los dos, siempre) |

### `packages/builder42` (lo que sustituye al email builder)

- **No está publicado en npm**: `private: true`, `version 0.0.0`, `main`/`exports` apuntan a
  `src/index.ts` — se consume **compilando la fuente**, no un `dist/`.
- **React 19** en `peerDependencies` (web-inky pinnea React 18) → hay bump obligatorio.
- Dos modos ya existentes:
  - **embebido**: `export { Builder42Editor }` + `./style.css` → `chrome-embedded.css`;
  - **standalone**: `main.tsx` monta `<App />` con `bootstrapDemoSite()` y `chrome.css` completo.
- **Plantillas = código TS**, no JSON: `src/builder/registry/layouts/pages/*.ts` (17 hoy:
  architectureStudio, autoRepair, barbershop, blogList, clothingStore, creativeAgency,
  dentalClinic, fitnessStudio, hotelBoutique, landingProduct, lawFirm, portfolio, realEstate,
  restaurant, signup, spaWellness, team). Entran por `import()` perezoso dentro de su `load()`;
  cada una trae `labelKey`/`descriptionKey` (namespace i18n `sidebar`) y un `LayoutTheme`
  propio (colores, tipografías, radios).
- **No existen imágenes de preview**: `TemplateCard.tsx` genera la miniatura **en el
  navegador** (`layoutPreviewMarkup`, `previewCache` en memoria, `PREVIEW_BASE_WIDTH = 1200`).
- **Sí existe pipeline de export a HTML estático**: `src/builder/export/` con `exportSite()`,
  `exportToHtml.ts`, `renderPage.ts`, `selfHostedFonts.ts` y — clave — `runtimeBundles.node.ts`,
  o sea que el export **ya corre fuera del navegador**.
- Features que dependen de backend (IA, Unsplash, publicación, media library, DeepL) están
  **gateadas por `fetchHealth()`**; en un host estático sin `/api/*` se apagan solas.
- i18n ya en **en/es/it** — los mismos tres idiomas que web-inky.
- El **product tour** (`src/app/tour/**`, sobre `@md/product-tour`) viaja tal cual.
- `packages/VENDOR.md` ya declara que builder42 **se extraerá a su propio repo** y nombra las
  **únicas dos costuras** a recablear: analítica (`onTourEvent`) y persistencia
  (`useLocalConfig`, claves `pb:` en `localStorage`).

---

## 1. Decisiones

D1 ya está cerrada (copia del proyecto). D2–D4 llevan recomendación; D5 es tuya.

### D1 — Cómo consume la landing a Builder42 — **DECIDIDO: copia del proyecto**

Nada de publicar a npm ni de extraer repos primero. Se **copia `web-inky` a un repo nuevo** y se
**copian los paquetes de Builder42 dentro**, como paquetes de workspace — el mismo patrón con el
que `packages/builder42` llegó a maildrill desde `pb-static`.

**Manifiesto exacto de la copia** (verificado: es autocontenido, no hay más costuras):

| Origen | Destino | Por qué |
|---|---|---|
| `web-inky/` (todo, salvo la tabla de descartes de §2) | raíz del repo nuevo | el molde de la landing |
| `web-maildrill-astro/packages/builder42/` **completo** | `packages/builder42/` | `src/` + `shared/` (4 archivos: `api`, `deeplLang`, `estimateBilledChars`, `slug`) + `package.json` + `tsconfig.json` + `vitest.config.ts`. Su `tsconfig` ya hace `include: ["src", "shared"]` |
| `web-maildrill-astro/packages/product-tour/` **completo** | `packages/product-tour/` | única dependencia de workspace de builder42 (`@md/product-tour": "workspace:*"`), y de ella depende el tour |

Comprobado que **no hay nada más que arrastrar**: los únicos imports que salen de `src/` son
`../../shared/*` (dentro del propio paquete) y `@md/product-tour`. Builder42 no importa nada del
`src/` de su host actual — solo lo mencionan comentarios.

Hace falta añadir `pnpm-workspace.yaml` con `packages/*` en el repo nuevo (hoy el de web-inky
solo lleva `allowBuilds`/`minimumReleaseAgeExclude`, no lista paquetes).

### D2 — Previews de plantillas

No hay JPGs y las miniaturas se generan en el navegador. Pero `exportSite()` + `runtimeBundles.node.ts`
permiten replicar el enfoque de web-inky: **aplicar el layout → `exportSite()` → HTML → screenshot
con Playwright**.

**Recomendación:** un `scripts/generate-template-previews.mjs` que importe el registry de
builder42, para cada plantilla construya un `BuilderSite` de una página, la exporte a HTML y la
capture. Así las previews son **reales** (igual que en inky) y se regeneran al añadir plantillas.
Alternativa peor: capturar el canvas del editor (arrastra chrome del editor a la imagen).

### D3 — Alcance SEO en el arranque

`seoPages.ts` (109 KB) + `dictionaries.ts` (47 KB) son copy **específico de email**. Traducir
"email" → "landing" con find-replace produce exactamente las doorway pages que el propio README
de inky señala como penalización.

**Recomendación:** arrancar con **3 landings (en/es/it) + `/templates` + páginas por plantilla**,
y dejar las guías de intención para una fase posterior, con intenciones nuevas y reales
(*free landing page builder*, *website builder sin código*, *constructor de páginas drag and drop*, …).
Cada guía debe ganarse su URL, como exige la regla que ya vive en inky.

### D4 — Reglas de veracidad, reancladas a builder42

La regla nº1 de inky ("toda afirmación se verifica contra el paquete instalado") hay que
reinstanciarla: la lista de bloques/componentes prometidos debe salir del
**registry real de builder42** (`componentRegistry` / `layoutRegistry`), no de suposiciones. Ojo
con lo contrario a inky: builder42 **sí** tiene generación por IA (`AiSectionGenerator`), pero
**solo si hay backend** — la landing estática no lo tendrá, así que no puede prometerlo sin
matizar. Igual con publicar, Unsplash, media library y traducción DeepL.

### D5 — Nombre, dominio, proyecto de Pages y PostHog

Hace falta: nombre del repo (sugerencia `web-builder42`), dominio (→ `SITE_ORIGIN` +
`site` en `astro.config.mjs`), `--project-name` de Cloudflare Pages, `name` en `wrangler.toml`
y token/proyecto de PostHog propios. **Esto lo defines tú.**

---

## 2. Qué se copia, qué se adapta, qué se descarta

| Se copia casi tal cual | Se reescribe | Se descarta |
|---|---|---|
| `astro.config.mjs` (estructura: format file, sitemap, inline CSS, dedupe React) | `src/lib/dictionaries.ts` — todo el copy | `tools/renderTemplate.tsx` (render de email) |
| `src/layouts/Base.astro`, `PageShell.astro` (estructura de `<head>`, hreflang, JSON-LD) | `src/lib/seoPages.ts` — intenciones nuevas | `scripts/dump-template-catalog.mjs` (lee el paquete de email) |
| `src/lib/seo.ts` (mecánica de rutas/canonicals) | `src/lib/templatePages.ts` — por plantilla de builder42 | `posthog-self-driving-report.md`, `docs/` de inky |
| `scripts/audit-seo.mjs` (adaptando aserciones) | `src/styles/*` — identidad visual propia (D-estilo) | `.claude/skills/replay-vision-*` (salvo que los quieras) |
| `CookieConsent.astro`, `posthog.astro`, `LangSwitch.astro` | `EditorApp.tsx` → monta `Builder42Editor` en vez de `EmailBuilder` | `infra/cloudfront-viewer-request.js` (si solo va a CF Pages) |
| `src/scripts/landing/*` (slider, reveal, i18n runtime) | `EditorMock.astro` — mock del hero con chrome de builder42 | `public/slider/images/*` (capturas de email) |
| Estructura de `templates.astro` / `templates/[slug].astro` | `src/lib/templateFacts.ts` — hechos leídos del layout TS | `public/templates/*` (plantillas de email) |

**Estilo propio (parte del pedido).** Inky es editorial: serif Newsreader + Space Grotesk/Mono.
Builder42 necesita su propia dirección visual, y tiene de dónde derivarla: sus tokens de chrome
(`--pb-chrome-*`, `TokensStyle.tsx`, `styles/chrome/*`). Recomendación: derivar la paleta y la
tipografía de la landing del **propio chrome del editor**, para que la landing y el producto se
vean como la misma marca — que es justo lo que inky logra con `uiTheme="inky"`.

---

## 3. Fases

Cada fase termina con criterios verificables. `F0` bloquea a todas.

**F0 — Copia + esqueleto.** Cerrar D2–D5. Copiar `web-inky` al repo nuevo, renombrar, fijar
dominio/origen, **quitar `email-builder-online`**, subir React a 19 (`react`, `react-dom`,
`@types/*`), copiar los dos paquetes de la tabla de D1, crear `pnpm-workspace.yaml` con
`packages/*` y declarar `builder42` como dependencia de la app (`workspace:*`).
*DONE WHEN:* `pnpm install` resuelve sin conflictos, `pnpm build` pasa con las 3 landings aún sin
copy nuevo, `pnpm check` limpio, y `SITE_ORIGIN`/`site`/`wrangler.toml` apuntan al dominio nuevo.

**F1 — Integrar el editor (`/editor`).** Reemplazar el island: `EditorApp.tsx` monta
`Builder42Editor` (embebido, con `builder42/style.css` → `chrome-embedded.css`) en vez de
`<EmailBuilder>`. Recablear las **dos únicas costuras** que nombra `VENDOR.md`: `onTourEvent` →
PostHog de este sitio, y confirmar que `useLocalConfig` (claves `pb:`) viaja tal cual. Arrastrar
los dos traps conocidos: `resolve.dedupe` de React y los `overrides` version-pinneados de
`@tiptap/starter-kit@3.27.2>@tiptap/core|@tiptap/pm`.
*DONE WHEN:* `/editor` monta, arrastra bloques, abre inspector, el tour arranca **y reanuda**;
IA/Unsplash/publicar aparecen **apagados** (sin backend) sin romper la UI; `pnpm why react` y
`pnpm why @tiptap/core` muestran una sola instancia de cada uno.

> Decisión pendiente dentro de F1: usar el modo **embebido** (`Builder42Editor`, recomendado —
> es la costura ya probada y la que documenta VENDOR.md) o el **standalone** (`main.tsx` +
> `bootstrapDemoSite()` + `chrome.css` completo). El embebido deja a la landing dueña del
> `<head>`, las fuentes y el consent; el standalone traería `@font-face` y reglas
> `html,body,#root` que no pertenecen a esta página.

**F2 — Catálogo y previews de plantillas.** Script que recorra `layoutRegistry`, exporte cada
plantilla con `exportSite()` y genere `catalog.json` + `previews/<id>.jpg` (D2). Incluir
`labelKey`/`descriptionKey` y el `LayoutTheme` en el catálogo.
*DONE WHEN:* `pnpm templates:catalog && pnpm templates:previews` produce 17 entradas con imagen
real; añadir una plantilla nueva al registry y re-correr la incluye sin tocar páginas.

**F3 — Landing (3 idiomas).** Copy nuevo en `dictionaries.ts`, hero con mock de builder42,
sección de plantillas prerenderizada desde el catálogo, slider con capturas nuevas del editor.
*DONE WHEN:* `/`, `/es`, `/it` sirven **HTML totalmente traducido** (sin swap en cliente), los
nombres de plantilla salen del catálogo, y todo se ve sin JS.

**F4 — Identidad visual.** `tokens.css`/`landing.css` propios derivados del chrome de builder42.
*DONE WHEN:* la landing no comparte paleta ni tipografía con inky y coincide con el editor;
contraste AA verificado.

**F5 — Directorio de plantillas.** `/templates` + `/templates/<slug>`, con `templateFacts`
generados del layout (nº de secciones, imágenes, si usa fotos remotas), no escritos a mano.
*DONE WHEN:* cada página dice algo concreto y correcto tras el último `templates:catalog`.

**F6 — Guard de calidad.** Adaptar `audit-seo.mjs`: aserciones de title/description, un `h1`,
hreflang recíproco, enlaces internos, y **la regla de veracidad de D4** (no prometer IA/publicar/
Unsplash si el host estático no los tiene).
*DONE WHEN:* `pnpm audit:seo` pasa en verde y falla de verdad si se introduce una promesa falsa.

**F7 — Páginas SEO de intención** (diferida por D3). Intenciones nuevas, 3 idiomas, slugs por
idioma con `id` estable para hreflang recíproco.
*DONE WHEN:* cada guía tiene intención propia demostrable y `audit:seo` sigue verde.

**F8 — Deploy.** Proyecto de Cloudflare Pages, dominio, `_headers`, robots/llms/sitemap con el
origen nuevo.
*DONE WHEN:* build desplegado, sitemap sin `/editor`, canonicals/hreflang/OG coherentes.

---

## 4. Riesgos conocidos (ya documentados en este repo)

1. **Peso del editor.** Builder42 es bastante más grande que el email builder (framer-motion,
   tiptap, atlaskit dnd, lucide, simple-icons, embla, zustand). Mantener `client:only`, respetar
   el `import()` perezoso de las plantillas y **no** dejar que el editor entre en el chunk de la
   landing. Medir antes de F8.
2. **Split de `@tiptap/*`.** Trap real y ya sufrido: los sub-paquetes de `@tiptap/starter-kit`
   declaran rangos `^3.x` y pnpm los flota. Copiar los `overrides` version-pinneados.
3. **Dos instancias de React.** `resolve.dedupe` es obligatorio (y builder42 pide React 19).
4. **`minimumReleaseAgeExclude`** de pnpm v11: si se pinnea un release reciente, hay que
   excluirlo explícitamente, como hace hoy `email-builder-online@4.3.4`.
5. **Copy traducido sin revisión nativa.** Inky arrastra esa deuda (documentada en
   `docs/plan-guias-es-it.md`). No repetirla a ciegas: es/it necesitan lectura nativa.
6. **Divergencia de la copia.** Al copiar builder42 pasa a haber **dos copias** del editor
   (maildrill y esta landing) sin re-sync. Es la consecuencia aceptada de D1. Mitigación mínima:
   dejar constancia en el repo nuevo de qué commit de maildrill se copió (un `VENDOR.md` propio
   con el SHA), para que una corrección futura se pueda replicar a mano sabiendo el punto de
   partida. Sin eso, en unos meses nadie sabrá qué lado está más adelantado.
7. **El tour recién arreglado.** La corrección de reanudación
   (`tourCompleted` independiente de `tourSeen`, commit `f1bf66d`) y el trabajo D50/D51
   (`181e5f0`) tienen que estar **dentro** de la copia. Copiar de un commit anterior reintroduce
   el bug ya cerrado.

---

## 5. Lo que necesito de ti para arrancar

1. **D5**: nombre del repo (sugerencia `web-builder42`), dominio, proyecto de Cloudflare Pages,
   proyecto/token de PostHog.
2. **D3**: ¿arrancamos con las 3 landings + `/templates`, o quieres las 15 guías SEO desde el
   día uno?
3. Dirección de estilo: ¿derivamos del chrome de builder42 (recomendado) o tienes una guía de
   marca aparte?
4. Dentro de F1: ¿editor **embebido** (recomendado) o **standalone**?

---

## 6. Estado — F0 CERRADA (2026-09-17)

Decisiones tomadas: repo **`builder42-landing`** (en `projects/_laravel42/builder42-landing`),
**3 landings + `/templates`** (guías diferidas a F7), tipografía **de builder42 pero centralizada
en constantes** (`src/config/brand.ts`), editor **embebido**, y `email-builder-online` fuera.
**Pendiente de D5:** dominio real, proyecto de Cloudflare Pages y PostHog propios — hoy
`SITE_ORIGIN` es el placeholder `https://builder42.example.com`.

Verificado en el repo nuevo: `pnpm install` limpio · `pnpm check` **0 errores** ·
`pnpm build` **6 páginas** en ~5 s · `pnpm audit:seo` **en verde** · una sola copia de
`react@19.3.0` y de `@tiptap/*@3.27.2` · CSS del editor 164 KB con 64 reglas `.pbx-*` y
**0 `@font-face`** · JS del editor **7.77 MB raw / 2.72 MB gzip**, sólo en `/editor`, con las 17
plantillas aún en chunks perezosos (riesgo 1, ya medido).

### Costuras que el plan no listaba y que resultaron obligatorias

1. **Plugin de Vite para los alias internos de builder42.** El paquete se importa a sí mismo con
   `@/*` (su propio `tsconfig`) y alcanza `../../shared/*` fuera de `src/`. Sin un `resolveId`
   con `enforce: 'pre'` que resuelva ambos **contra el paquete** (no contra el `src/` de la app),
   nada compila. Copiado de `web-maildrill-astro/astro.config.ts`, incluida la normalización a
   forward-slash (en Windows, un id con backslashes rompe el manifiesto de prerender).
2. **`pnpm --filter builder42 build:runtime` en `postinstall` y en `build`.** Sin él no existe
   `src/runtime/dist/`, el `import.meta.glob` devuelve `{}` y ningún behavior hidrata.
3. **El override de `@tiptap` de maildrill no basta.** Pinnear sólo `starter-kit>@tiptap/core` y
   `>pm` deja que las **subextensiones** floten a 3.31.3, y `@tiptap/extension-list@3.31.3`
   importa `getPreviousBlockSibling`, export que 3.27.2 no tiene → `MISSING_EXPORT` y build roto
   (reproducido). Aquí hace falta pinnear **todo** el árbol `@tiptap/*` a 3.27.2; funciona porque
   builder42 es su único consumidor en este repo.
4. **Las fuentes son una costura, no una preferencia.** `chrome-embedded.css` no declara
   `@font-face` a propósito: el host debe cargar Geist / Geist Mono y exponerlas como
   `--font-sans` / `--font-mono`, que es el fallback de `--pb-chrome-font(-mono)`.
5. **Alinear el toolchain completo, no sólo React.** El repo quedó en astro 7.3, TS 6.0.3,
   `@astrojs/check` 0.9.10, `@astrojs/react` 6.0.5 — los de maildrill, no los de inky (TS 5.7).
   `packages/` va excluido del `tsconfig` de la app y cada paquete se tipa con el suyo
   (`pnpm typecheck`).
6. **`catalog.json` vacío rompe los tipos.** Con `templates: []`, TS infiere `never[]` y cada
   `tpl.id` falla (64 errores). Resuelto con `src/lib/templateCatalogData.ts`, que importa el JSON
   una vez y lo tipa como `TemplateCatalog` — el desacople que un artefacto generado necesitaba
   desde el principio.
7. **Coste oculto del molde: 57 s de build en imágenes de email.** Las 20 previews de inky entraban
   por `import.meta.glob(..., { eager: true })` y sharp generaba **600 variantes / 22.8 MB** en cada
   build. Borradas (F2 las regenera): el build bajó de **65 s a 5 s**.

### Deuda consciente que queda dentro del repo nuevo

- `src/lib/dictionaries.ts` y los textos de `/templates` siguen siendo copy de **email** (F3/F5).
- `public/slider/images/*` son capturas del editor de **email** (F3).
- `--font-serif` está aliasado a `--font-sans` en `tokens.css` porque el CSS heredado aún pide una
  serif de display (F4).
- `scripts/audit-seo.mjs` pasa en verde, pero sus invariantes siguen describiendo al editor de
  email ("no hay IA", "no hay bloque HTML crudo"). F6 debe reanclarlas a builder42: la regla real
  es *no prometer una función que exige backend*, no *la función no existe*.

---

## 7. Estado — F1 y F2 CERRADAS (2026-09-17)

**F1 — editor embebido.** `/editor` monta `Builder42Editor` (modo embebido) con `themeMode="host"`,
`locale` del idioma de la URL, y las dos costuras de `VENDOR.md` recableadas: `onTourEvent` →
`window.posthog.capture`, `onSave` → `localStorage` (`b42:landing:site`). Se añadió un
**adapter estático de `fetchHealth`** que declara IA/Unsplash/media/publicar/DeepL apagados: sin
él, cada montaje pedía `/api/health` a un host estático y se comía un 404 más un error de consola
para acabar en el mismo sitio. El ancla `pbx.header.identity` del tour vive en el header del host
(`src/components/EditorHeader.tsx`) — en embebido el editor no monta header propio, así que el
primer paso del tour no tenía a qué apuntar.

Tests del paquete copiado: **builder42 169/169**, **@md/product-tour 106/106**. Tres fallaban al
principio y no eran del editor: `tests/tour-anchors-coverage.test.ts` escanea el HOST y traía
hardcodeada la ruta de Maildrill (`src/components/react/shared/EditorHeader.tsx`, con el gate
`!channel && identity` que aquí no aplica). Adaptada la ruta y esa aserción — **única divergencia**
respecto a la copia, anotada en `packages/VENDOR.md`.

**F2 — catálogo y previews reales.** `pnpm templates:catalog` carga el **registry real** de
builder42 por la vía SSR de Vite (mismo plugin de alias que el build, extraído a
`scripts/builder42-alias.mjs`), y por cada una de las 17 plantillas de página: reconstruye lo que
`applyPageLayout` escribiría en el sitio (fragmento + tema + familias tipográficas + `pageMeta` +
traducciones), corre el `exportSite()` de verdad (Node-safe vía `runtimeBundles.node.ts`), y emite
tres artefactos: el sitio estático en `.cache/templates/<id>/`, el `BuilderSite` serializado en
`public/templates/sites/<id>.json` (36–71 KB, 0.86 MB en total) y la entrada de catálogo. Todo
derivado: nombre y descripción **en los tres idiomas** leídos de los bundles i18n del editor, el
`archetype` del registry como única etiqueta, el tema, y los hechos contados sobre el árbol de
nodos. `pnpm templates:previews` fotografía esos exports con Playwright (1200×2400, 62–249 KB).

`/editor?template=<id>` ya funciona: descarga el catálogo, resuelve el sitio serializado y lo pasa
por la prop `site`. Es el mismo contrato que usaba inky con sus `doc`, pero un sitio completo — el
paquete exporta el editor, no su registry, así que serializar en build es lo que evita tocar el
paquete.

### Hallazgos de F2 que conviene no volver a descubrir

1. **`exportSite()` emite rutas absolutas** (`/assets/css/tokens.css`). Bajo `file://` resuelven
   contra la raíz del disco: la primera tanda de previews salieron **17 páginas sin estilos**. El
   script sirve el export por HTTP con un servidor de un solo uso y raíz conmutable.
2. **Hay que desactivar JavaScript para capturar.** `revealOnScroll` añade `.pb-reveal`
   (`opacity: 0`) por JS y solo la revierte al intersectar el viewport; en una captura de página
   completa la mayoría de secciones saldrían en blanco. Sin JS la clase nunca se añade.
3. **Las fotos remotas no están en `props.src`.** Los nodos de imagen usan
   `props.source = { kind: "url", url }`, y además hay fotografía en fondos CSS — la detección de
   *stock photos* mira ambas cosas.
4. **`catalog.json` vacío rompía el tipado** (`never[]` → 64 errores). El JSON se importa y se tipa
   una sola vez en `src/lib/templateCatalogData.ts`.
5. **Las previews cuestan build.** 17 imágenes de 1200×2400 generan ~20 variantes cada una; el
   build pasa de ~4 s (caché caliente) a ~75 s en frío. Si molesta, bajar `MAX_HEIGHT` en el script
   de previews o recortar las anchuras de `src/lib/images.ts`.

También se renombró la marca en el código (`Inky` → `Builder42`, 19 archivos) y se de-emailizó el
copy mecánico de `/templates` y `/templates/<slug>`; el copy de las tres landings sigue siendo el
de email hasta F3.
