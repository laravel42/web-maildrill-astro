# Plan — Iconos 2D outline para componentes complejos (Email Builder)

> **Estado actual (sesión 4): 98/146 iconos implementados (`sections`
> 85/85 + `layouts` 13/13). El trabajo activo NO es diseñar tandas
> nuevas, sino la mejora de legibilidad del set existente — ver §19,
> que incluye la auditoría medida y las decisiones pendientes.**

Estado: **Tanda 1 implementada en código y ajustada visualmente
(sesión 2) — pendiente de aprobación final del usuario antes de
Tanda 2**.
Alcance de esta fase: **solo `packages/email-builder-standalone`**. La
réplica del mismo enfoque en Builder42 es una fase futura separada, no
incluida aquí (confirmado por el usuario).

## ⏸️ AL RETOMAR LA SESIÓN — leer esto primero

**Sesión 2 (esta)**: la Tanda 1 se implementó en código (no solo
diseño en el plan) y se ajustó visualmente en varias iteraciones con
feedback directo del usuario viendo el resultado real en el editor.
Ver §8b para el detalle completo de lo implementado y corregido.

Quedan **2 preguntas abiertas de §6** que el usuario dijo que quiere
revisar apenas empiece la siguiente sesión, antes de seguir con la
tanda 2:

1. **`primitives` (28 items)** — ¿mismo tratamiento que
   `sections`/`layouts` (icono outline por estructura), o un criterio
   distinto (p. ej. icono más simple, al ser bloques atómicos y no
   composiciones)?
2. **`templates` (20 items, raíz `EmailLayout`)** — ¿el icono debe
   sugerir "documento completo" (franjas horizontales esquemáticas, sin
   detalle interno) para distinguirse de una `section` individual en el
   listado, o se aplica el mismo criterio de detalle que a una section
   pero con más elementos?

La tercera pregunta de §6 (picker de icono al guardar un componente
NUEVO tras la migración) **no bloquea** el trabajo de tandas — solo
bloquea cerrar §5 (fase de implementación) más adelante.

Ver §8 para el diseño original de la Tanda 1 (10/10 iconos propuestos,
con micro-variaciones ya aplicadas en los 4 pares estructuralmente
idénticos) y §8b para el estado real de implementación tras los
ajustes de la sesión 2, antes de pasar a la Tanda 2: roles `cta` +
`faq`.

## 1. Qué se reemplaza y por qué

`LibraryCardThumbnail.tsx` renderiza hoy una captura PNG (280×400 @1.5x
DPR, `captureThumbnail.ts`) por cada item guardado en las categorías
**Sections / Layouts / Templates / Primitives** de la Components Library.
El usuario pide sustituir esa miniatura por un **icono 2D outline,
diseñado a mano por componente individual** (no genérico por rol/categoría),
en el mismo lenguaje visual que ya usa la aplicación.

Confirmado con el usuario:
- Es análisis + diseño manual, uno por uno — no hay pipeline de
  generación automática de iconos.
- El catálogo es finito y ya existe — no se crea ningún sistema nuevo de
  autoría de iconos, solo se produce el set necesario para lo que ya está
  guardado.
- Se trabaja **por tandas de ~10 componentes**: por cada tanda, se
  presenta el análisis + propuesta de icono, el usuario da el visto bueno
  o pide ajustes, y solo entonces se avanza a la siguiente tanda.
- Verificación visual: el usuario confirmó que existe un MCP de Chrome
  para inspeccionar visualmente, pero **no está configurado en este
  entorno/agente** (verificado: no hay `mcp.json` en
  `~/.kiro/settings/`, `.kiro/settings/`, ni `mcpServers` en ningún
  archivo dentro de `~/.kiro/agents/` o `.kiro/agents/` — ambas carpetas
  existen pero están vacías). Mientras no esté disponible, la
  verificación visual de cada icono renderizado se hace vía capturas que
  el usuario comparte (`/paste` o archivo de imagen), que se analizan con
  el tool de lectura de imágenes. Si el MCP se agrega después a
  `.kiro/settings/mcp.json` (workspace) o a un archivo de agente, el
  hot-reload lo detecta solo y se incorpora al flujo sin replantear el plan.

## 2. Inventario del catálogo (reconocimiento ya realizado)

Fuente de verdad usada: `packages/email-builder-standalone/src/App/
ComponentsLibrary/localPresets.data.json` — el catálogo curado y
empaquetado que se embebe en el paquete para `componentsStorage='local'`
(deployments sin backend, p. ej. landing pages). Se eligió como fuente
en vez del backend de desarrollo (`workers/apps/email-builder-api`)
porque es estático, versionado en el repo, y no depende de qué haya sido
guardado ad-hoc en una sesión de dev — es el catálogo real que ve un
usuario final en modo local.

| Categoría | Items | ¿Tiene preview visual hoy? |
|---|---|---|
| `sections` | **85** | Sí — thumbnail PNG |
| `layouts` | **13** | Sí — thumbnail PNG |
| `templates` | **20** | Sí — thumbnail PNG |
| `primitives` | **28** | Sí — thumbnail PNG (confirmar en tanda 1 si aplica igual que sections) |
| `themes` | 39 | No — usa swatch de color (`LibraryCardThemeSwatch.tsx`), **fuera de alcance**, no es una miniatura estructural |

**Total a diseñar: 146 iconos** (85 + 13 + 20 + 28), en **~15 tandas de
~10**.

Cada item del catálogo trae, sin necesitar renderizado previo:
- `name` (nombre visible en la tarjeta),
- `role`/`axis` (rol semántico: `hero`, `cta`, `banner`, `footer`, etc.
  — no determina el icono por sí solo, pero es contexto),
- `tags`,
- `blocks`: el árbol completo de nodos (`type` + anidación real vía
  `childrenIds`/`columns`), que es la base del análisis estructural.

Vocabulario de tipos de bloque usado en todo el catálogo (9 tipos, ya
contados): `NotionText` (902), `Container` (374), `ColumnsContainer`
(172), `Image` (121), `Button` (71), `Divider` (40), `Spacer` (25),
`EmailLayout` (20), `SocialMedia` (4). Un vocabulario pequeño y cerrado —
manejable para un análisis manual consistente componente por componente
(la forma de cada icono deriva de cómo se combinan estos 9 tipos, no de
un vocabulario abierto).

## 3. Lenguaje visual del icono (a confirmar en la tanda 1)

- **Estilo**: outline (trazo, no relleno), consistente con
  `@mui/icons-material` *Outlined* variant, que ya es el lenguaje
  establecido en el resto del email builder (`ArticleOutlined`,
  `ImageOutlined`, `SmartButtonOutlined`, etc. en `builtInBlocks.tsx`).
  No se usa `lucide-react` aquí — ese es el lenguaje de Builder42, fuera
  de esta fase.
- **Formato**: SVG propio por componente (no un icono de MUI existente
  reutilizado 1:1 salvo que la estructura del componente sea
  literalmente un solo bloque simple) — cada icono debe sugerir el
  layout real del componente (dónde va el texto, la imagen, el botón,
  las columnas), similar al lenguaje de iconos de "layout" que usan
  Figma/Notion para plantillas.
- **Tamaño de referencia**: a confirmar contra el contenedor real de
  `LibraryCardThumbnail` (`height = 120` por defecto, ancho 100% de la
  tarjeta) — el icono probablemente se centra en esa misma caja en vez
  de ocupar el ancho completo como hace hoy el `<img>` con `object-fit:
  cover`.
- **Color/tema**: usar tokens del tema MUI del editor (`theme.palette.
  text.secondary`/`divider`, mismo criterio que el placeholder actual
  `ImageNotSupportedOutlinedIcon`), no colores fijos — para que
  respete dark mode automáticamente.

## 4. Flujo de trabajo por tanda

Para cada tanda de ~10 componentes:

1. **Selección de la tanda** — orden propuesto: por categoría, empezando
   por `sections` (la más numerosa y con roles más variados), agrupando
   dentro de la categoría por `role`/`axis` cuando sea posible (para que
   una tanda no salte entre conceptos muy distintos y sea más fácil dar
   el visto bueno de forma consistente).
2. **Análisis estructural** — por cada componente de la tanda, leo su
   árbol `blocks` (tipos + anidación) y describo en texto qué representa
   visualmente (ej.: "Container > ColumnsContainer[2] > (Image, NotionText
   + Button)" → layout de 2 columnas con imagen a la izquierda, texto y
   CTA a la derecha).
3. **Propuesta de icono** — a partir del análisis, propongo el diseño del
   SVG outline (descripción + el propio código SVG) que representa esa
   estructura.
4. **Verificación visual** — el usuario renderiza/revisa el SVG
   propuesto (vía captura compartida, ya que el MCP de Chrome no está
   disponible en este entorno) y confirma si coincide con el componente
   real guardado, o pide ajuste.
5. **Visto bueno** — el usuario aprueba la tanda completa (o cada item
   dentro de ella) antes de continuar a la siguiente. No se avanza a
   diseñar la tanda N+1 sin ese visto bueno.

Ningún cambio de código (reemplazo real del `<img>` por el icono en
`LibraryCardThumbnail.tsx`, esquema de datos, etc.) se aplica durante el
reconocimiento/diseño — eso es una fase de implementación posterior,
una vez el set completo de 146 iconos esté diseñado y aprobado, o
opcionalmente aplicado incrementalmente tanda por tanda si el usuario
prefiere ver el resultado en vivo antes de terminar el catálogo completo
(a decidir explícitamente antes de la tanda 1, no asumido aquí).

## 5. Alcance del reemplazo total (confirmado por el usuario)

El icono **reemplaza por completo** el thumbnail PNG — no coexisten. Esto
confirma y cierra la primera decisión abierta de la versión anterior de
este documento. Alcance verificado en código (front + backend) antes de
tocar nada:

### Frontend (`packages/email-builder-standalone`)

- **`LibraryCardThumbnail.tsx`** — deja de aceptar `src`/`loading` (PNG) y
  pasa a renderizar el SVG del icono correspondiente al `id` del item.
  El estado "No preview" (`ImageNotSupportedOutlinedIcon`) desaparece:
  todo item con icono diseñado lo muestra; los que aún no tengan icono
  diseñado (mientras dura el trabajo por tandas) usan un placeholder
  temporal explícito, no el genérico actual.
- **`captureThumbnail.ts`**, **`buildThumbnailHtml.ts`**,
  **`thumbnailStatus.ts`**, **`lazyThumbnailGenerator.ts`**,
  **`thumbnailUrl.ts`** — pipeline completo de captura/estado-de-carga de
  PNG, queda sin uso una vez migrado. Se elimina (no se deja código
  muerto), en una fase de limpieza posterior al reemplazo visual, para no
  mezclar el trabajo de diseño con una eliminación masiva de archivos.
- **`SaveSubtreeDialog.tsx`**, **`SaveTemplateDialog.tsx`** — hoy llaman a
  `captureSubtreeThumbnail`/envían el blob por multipart al guardar. Para
  componentes NUEVOS guardados después de esta migración, el flujo de
  guardado necesita decidir de dónde sale el icono — ver §7 (decisión
  abierta, no resuelta todavía: no hay "análisis automático" en tiempo
  real de guardado, así que hace falta un picker o un estado
  "pendiente de icono" explícito).
- **`localLibraryStore.ts`** (modo `local`, sin backend) — hoy guarda
  data-URLs de thumbnail bajo `eb:lib:thumbnails`; pasa a guardar una
  referencia al icono (id de icono del set diseñado) en su lugar.
- **`localPresets.data.json`** — el catálogo empaquetado (146 items,
  §2) es exactamente el que se está diseñando por tandas; al terminar,
  cada item de este JSON necesita su nuevo campo de icono poblado.

### Backend (`workers/apps/email-builder-api`)

- **`dev-save-section.ts`**, **`dev-save-template.ts`**,
  **`dev-save-layout.ts`**, **`dev-save-primitive.ts`** — cada uno tiene
  su propio `Save*Schema` (Zod) y su propio manejo de `hasThumbnail`/
  `ThumbnailMetadata`. El campo `thumbnail` se retira del schema de
  guardado; se añade un campo de icono (nombre exacto a definir, p. ej.
  `iconId: z.string()`), y el listado deja de exponer `hasThumbnail`.
- **`dev-library-thumbnails.js`** (o `.ts`), **`dev-library-multipart.ts`**
  — infraestructura de almacenamiento en disco del PNG (`writeThumbnailFile`,
  `readThumbnailFile`, `statThumbnailFile`, `deleteThumbnailFile`,
  `MAX_THUMBNAIL_BYTES`, `ThumbnailTooLargeError`) y el parseo multipart
  que solo existe para adjuntar el blob de imagen — quedan sin uso, se
  eliminan en la misma fase de limpieza que el frontend.
- **Migración de datos existentes**: cualquier NDJSON ya guardado en disco
  por el backend de desarrollo (fuera del catálogo empaquetado del
  frontend) que tenga `thumbnail` pero no icono queda con el placeholder
  temporal hasta que se le asigne un icono — no se intenta migrar
  automáticamente.

Este alcance (front + backend + limpieza) es una **fase de
implementación posterior**, no se ejecuta durante el reconocimiento/
diseño por tandas de este documento. Se deja registrado aquí para que el
diseño de cada icono (tandas) ya tenga en mente el campo de datos real
que lo va a persistir.

## 6. Decisiones abiertas — SOLO quedan las siguientes dos

- ¿Los `primitives` (28 items) entran en el mismo alcance que
  `sections`/`layouts`/`templates`, o tienen su propio tratamiento?
- ¿Los ~20 `templates` (documentos completos, `EmailLayout` como raíz)
  necesitan un lenguaje de icono distinto al de una `section` individual,
  o el mismo criterio aplica con más elementos sugeridos dentro del
  mismo icono?
- **Nueva, derivada de §5**: para componentes guardados DESPUÉS de esta
  migración (flujo de `SaveSubtreeDialog.tsx` hacia adelante, no el
  catálogo ya diseñado), ¿quién elige el icono en el momento de guardar?
  No hay "análisis automático" — las opciones son (a) un picker manual de
  un set fijo de iconos por rol/forma general en el diálogo de guardado,
  o (b) el item queda con un placeholder "pendiente de icono" hasta que
  alguien lo diseñe a mano después, igual que se está haciendo ahora con
  el catálogo existente. Esto no bloquea el trabajo de las tandas (que
  cubre el catálogo YA EXISTENTE), pero sí bloquea poder cerrar
  completamente la fase de implementación de §5.

## 7. Verificación planeada (cuando se llegue a la fase de código)

- `astro check` / `tsc -p packages/email-builder-standalone` (vía los
  scripts documentados en `package.json` raíz) tras cualquier cambio de
  código en `LibraryCardThumbnail.tsx` o el modelo de datos.
- `vitest run` para confirmar que no hay regresión en los tests
  existentes de Components Library, si los hay.
- Ningún cambio de código se produce durante la fase de reconocimiento
  descrita en este documento — esta sección aplica a la fase de
  implementación posterior, fuera del alcance inmediato.


## 8. Progreso por tandas

Orden elegido dentro de `sections`: alfabético por `role` (17 roles ×
5 items exactos = 85, confirmado en el JSON real). Cada tanda cubre 2
roles completos (10 items) para no partir un role a la mitad.

### Tanda 1 — `sections`, roles `banner` + `comparison` (10/85)

**Estado: iconos propuestos con micro-variaciones, pendiente visto
bueno final del usuario.**

Fuente: `localPresets.data.json`, categoría `sections`.

| # | id | Nombre | Role | Estructura (`blocks`) |
|---|---|---|---|---|
| 1 | `0398040b-0b75-46f2-80cf-f3317d7cad8b` | Announcement mobile-tight | banner | `Container > NotionText` (franja angosta, poco margen) |
| 2 | `82a88271-0ed0-46f9-93d6-26ca2e0448de` | Announcement bar | banner | `Container > NotionText` (bloque con margen visible) |
| 3 | `4ce2d759-a608-4d6c-b3cc-d42fb2f3428f` | Cornered sale card | banner | `Container > Container(badge esquina, título, texto, Button)` |
| 4 | `769366f5-1d1a-413d-9603-887ca1750651` | Promo CTA | banner | `Container > Container(badge centrado pill, título, texto, Button)` |
| 5 | `639a5360-f271-4409-acc6-13cd8de70872` | Sale banner | banner | `Container > ColumnsContainer[texto col0+1, Button col1]` |
| 6 | `266e4e0f-d92e-4351-992e-6d7fff8f6823` | Option A vs B | comparison | `Container > ColumnsContainer[2 col simétricas: título+lista+Button]` |
| 7 | `6add8418-aa6c-4ddc-9e42-f98da7314299` | Mobile-reflow A vs B | comparison | idéntica a #6 + indicador de breakpoint responsive |
| 8 | `4512a455-9b75-43d5-9db6-2d96e85b804d` | Before / After | comparison | `Container > ColumnsContainer[2 col: Image + texto]` |
| 9 | `782eba2d-959e-4f1e-9a16-3375531ef934` | Feature matrix | comparison | `Container > título + ColumnsContainer[3] header + 3×(Divider + ColumnsContainer[3] fila)` — tabla 3×4 |
| 10 | `8a9ec9f9-46d1-4d3d-a7b8-c9cb8c3b1b04` | Top-accent matrix | comparison | misma tabla 3×4 que #9, con acento grueso en el borde superior (el `Container` extra envolviendo el header) |

Pares estructuralmente idénticos en el árbol `blocks` (#1/#2, #3/#4,
#6/#7, #9/#10): el usuario pidió que aun así cada icono tenga una
**micro-variación** para ser distinguible en el listado, no un icono
duplicado. Ver criterio de cada par en la tabla arriba.

Iconos finales (SVG outline, `viewBox="0 0 24 24"`, `fill="none"`,
`stroke="currentColor"` — hereda `theme.palette.text.secondary`,
compatible con dark mode automático):

```svg
<!-- #1 Announcement mobile-tight -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="1.5" y="9.5" width="21" height="5" rx="0.8"/>
  <line x1="4" y1="12" x2="20" y2="12"/>
</svg>

<!-- #2 Announcement bar -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3.5" y="8.5" width="17" height="7" rx="1.2"/>
  <line x1="6" y1="12" x2="18" y2="12"/>
</svg>

<!-- #3 Cornered sale card -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="18" height="18" rx="1.5"/>
  <path d="M3 3h5v2.5a1 1 0 0 1-1 1H3z" stroke-width="1.2"/>
  <line x1="5.5" y1="11.5" x2="16" y2="11.5"/>
  <line x1="5.5" y1="14" x2="14" y2="14"/>
  <rect x="5.5" y="16.8" width="7" height="2.8" rx="1"/>
</svg>

<!-- #4 Promo CTA -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="18" height="18" rx="1.5"/>
  <rect x="8.5" y="5.5" width="7" height="2.5" rx="1.2"/>
  <line x1="5.5" y1="11.5" x2="18.5" y2="11.5"/>
  <line x1="5.5" y1="14" x2="15.5" y2="14"/>
  <rect x="8.5" y="16.8" width="7" height="2.8" rx="1"/>
</svg>

<!-- #5 Sale banner -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2" y="8" width="20" height="8" rx="1"/>
  <line x1="4.5" y1="11" x2="11" y2="11"/>
  <line x1="4.5" y1="13.5" x2="9" y2="13.5"/>
  <rect x="14.5" y="10.5" width="5.5" height="3" rx="0.8"/>
</svg>

<!-- #6 Option A vs B -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2.5" y="3.5" width="8.5" height="17" rx="1"/>
  <rect x="13" y="3.5" width="8.5" height="17" rx="1"/>
  <line x1="4.5" y1="7" x2="9" y2="7"/>
  <line x1="15" y1="7" x2="19.5" y2="7"/>
  <rect x="4.5" y="16" width="4.5" height="2.5" rx="0.6"/>
  <rect x="15" y="16" width="4.5" height="2.5" rx="0.6"/>
</svg>

<!-- #7 Mobile-reflow A vs B -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2.5" y="3.5" width="8.5" height="17" rx="1"/>
  <rect x="13" y="3.5" width="8.5" height="17" rx="1"/>
  <line x1="4.5" y1="7" x2="9" y2="7"/>
  <line x1="15" y1="7" x2="19.5" y2="7"/>
  <rect x="4.5" y="16" width="4.5" height="2.5" rx="0.6"/>
  <rect x="15" y="16" width="4.5" height="2.5" rx="0.6"/>
  <path d="M11 2v20" stroke-width="1" stroke-dasharray="1.5 1.5"/>
</svg>

<!-- #8 Before / After -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2.5" y="3.5" width="8.5" height="17" rx="1"/>
  <rect x="13" y="3.5" width="8.5" height="17" rx="1"/>
  <rect x="4" y="5" width="5.5" height="6" rx="0.6"/>
  <path d="M4.8 9.2l1.5-2 1.2 1.5 1.4-1.8" stroke-width="1.2"/>
  <rect x="14.5" y="5" width="5.5" height="6" rx="0.6"/>
  <path d="M15.3 9.2l1.5-2 1.2 1.5 1.4-1.8" stroke-width="1.2"/>
  <line x1="4.5" y1="14.5" x2="9" y2="14.5"/>
  <line x1="15" y1="14.5" x2="19.5" y2="14.5"/>
</svg>

<!-- #9 Feature matrix -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="3" y1="4.5" x2="12" y2="4.5"/>
  <rect x="2.5" y="7.5" width="19" height="13" rx="1"/>
  <line x1="9.5" y1="7.5" x2="9.5" y2="20.5"/>
  <line x1="15.5" y1="7.5" x2="15.5" y2="20.5"/>
  <line x1="2.5" y1="11.5" x2="21.5" y2="11.5"/>
  <line x1="2.5" y1="14.5" x2="21.5" y2="14.5"/>
  <line x1="2.5" y1="17.5" x2="21.5" y2="17.5"/>
</svg>

<!-- #10 Top-accent matrix -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2.5" y="7.5" width="19" height="13" rx="1"/>
  <line x1="2.5" y1="8.3" x2="21.5" y2="8.3" stroke-width="4"/>
  <line x1="9.5" y1="10.5" x2="9.5" y2="20.5"/>
  <line x1="15.5" y1="10.5" x2="15.5" y2="20.5"/>
  <line x1="2.5" y1="13.5" x2="21.5" y2="13.5"/>
  <line x1="2.5" y1="16.5" x2="21.5" y2="16.5"/>
  <line x1="2.5" y1="19" x2="21.5" y2="19"/>
</svg>
```

**Siguiente paso al retomar:** resolver las 2 preguntas de §6 marcadas
arriba en "AL RETOMAR LA SESIÓN", confirmar el visto bueno de esta
tanda (o ajustes puntuales), y solo entonces avanzar a la **Tanda 2**
(roles `cta` + `faq`, siguiente en orden alfabético dentro de
`sections`).

## 8b. Implementación real y ajustes (sesión 2)

A diferencia de §8 (diseño en el plan, sin tocar código), en esta
sesión la Tanda 1 se implementó y ajustó visualmente en el editor real,
con feedback directo del usuario tras cada cambio. Trabajado en un
**worktree aislado** (`../web-maildrill-astro-email-inputs`, rama
`fix/email-builder-inspector-input-height`) mientras otro agente
trabajaba en paralelo sobre el repo principal (`feat/ui-polish-p1`);
una vez ese trabajo terminó y se commiteó, los cambios se portaron al
repo principal vía `git cherry-pick` (commits `e6a9b58`, `c8a9988`,
`aa84f2a`, luego iterados directamente ahí).

### Archivos nuevos/tocados

- **`thumbnail/sectionIcons.tsx`** (nuevo) — mapa `id -> SVG` de los 10
  iconos de la Tanda 1. `getSectionIcon(id)` hace el lookup.
- **`thumbnail/LibraryCardThumbnail.tsx`** — nueva prop `iconId`: si el
  id tiene icono diseñado, se renderiza con prioridad sobre el
  PNG/placeholder existente (coexistencia temporal para revisión, no
  el reemplazo total de §5 todavía).
- **`ComponentsLibraryDrawer.tsx`** — pasa `iconId={item.id}` a
  `LibraryCardThumbnail`; además, varios ajustes de layout que
  terminaron siendo parte de este trabajo (ver "Ajustes de layout"
  abajo).
- **`BlocksCategoryContent.tsx` / `CompactBlocksList.tsx`** — los
  tiles de bloques base (Text/Image/Button/...) se ajustaron al mismo
  tiempo porque comparten el mismo criterio visual (ver abajo).
- **`theme.ts`** — overrides de `MuiAccordionSummary`/
  `MuiAccordionDetails` (fondo transparente).
- **`documents/editor/EditorContext.tsx`** — `lateralPanel` (ancho del
  inspector).

> **⚠️ Corrección post-sesión (ver sesión 3 más abajo)**: el commit
> `e6a9b58` (altura de inputs/chips, primero de la cadena de 3 en
> `fix/email-builder-inspector-input-height`) **no se había
> cherry-pickeado** a `feat/ui-polish-p1` a pesar de estar documentado
> como portado — solo `c8a9988` y `aa84f2a` habían llegado. Ver §10.

### Iteraciones de ajuste visual (todas verificadas contra el código
fuente real de Builder42, no contra memoria/estimación)

1. **Tamaño del icono**: 32px → 56px → **28px** (valor final,
   homologado a `.pbx-palette__icon` de `sidebar.css`, comentado ahí
   como "grande, protagonista de la card"). Se descartó una cifra de
   27px que el usuario recordaba de memoria al no encontrar sustento en
   el código de Builder42.
2. **Mecanismo de sizing en `BlockTile`/`CompactBlockTile`** (iconos
   `@mui/icons-material`, NO los SVG de `sectionIcons.tsx`): 3 intentos
   hasta dar con uno determinista —
   `sx={{ '& svg': {...} }}` en el Box padre (resultado inconsistente
   entre pruebas) → `cloneElement(icon, { sx })` (sin efecto,
   problema conocido de MUI: `mui/material-ui#34056`) →
   **`cloneElement(icon, { style })`** (atributo HTML inline, máxima
   especificidad, funcionó).
3. **Anchos de side panels**: sidebar 380px→**312px** (expandido),
   164px→**168px** (compacto); inspector 320px→**326px** — valores
   reales de `.pbx-body { grid-template-columns: 312px 1fr 326px }`
   (`shell.css`).
4. **Estructura del tile de bloque**: eliminado el `Box` wrapper con
   `bgcolor`/`borderRadius` alrededor del icono — `.pbx-palette__item`/
   `.pbx-palette__icon` NO llevan fondo propio en el icono, va directo
   con `color` sobre la card. Ajustado a `min-height: 76px`,
   `padding: 10px 6px`, `gap: 8px` (valores reales de
   `.pbx-palette__item`).
5. **Grid de secciones**: `columns={2}` → **`columns={3}`**, igual a
   `.pbx-palette { grid-template-columns: repeat(3, 1fr) }`.
6. **Border de todas las cards**: `dashed` (con `divider`) →
   **`solid`** con `theme.palette.grey[200]` (mapeado 1:1 a
   `--pb-chrome-border`/`--border` del host) — Builder42 nunca usa
   border punteado en estas cards.
7. **`LibraryCard` (sections/layouts/templates)**: eliminado el `Box`
   wrapper extra que envolvía el `DragIndicatorIcon` + nombre (y el
   propio `DragIndicatorIcon`, con su import) — Builder42 no tiene un
   grip de arrastre en línea con el texto, solo un overlay absoluto al
   hover (`.pbx-palette__grip`), no replicado por no ser parte del
   pedido explícito. Contenedor del icono en `LibraryCardThumbnail`
   también perdió su `border: dashed` + `backgroundColor` propios (doble
   caja redundante con la card exterior).
8. **Altura de card completa**: el `height` del thumbnail interno NO es
   igual al `min-height: 76px` de `.pbx-palette__item` — ese 76px es el
   alto TOTAL del tile (icono + label + padding + gap). Ajustado el
   `height` del thumbnail a 28px (no 76px) para que la card completa,
   sumando padding (`10px 6px`) + gap (`8px`) + label, totalice ~76px.
9. **Color del trazo**: `#57554e`/`#A1A1AA` (`--pb-chrome-text-muted`/
   `--text3`, token incorrecto) → **`#a5a39a`/`#8a8371`**
   (`--pb-chrome-text-faint`/`--muted`, el token real que usa
   `.pbx-palette__icon`).
10. **Stroke-width**: `1.25` (estimado, sin verificar) → **`2`**
    (confirmado en `ComponentTypeIcon.tsx`: no pasa `strokeWidth`
    explícito a sus iconos Lucide, usa el default real de la librería).
    El acento del icono #10 (línea superior gruesa) se reescaló de `3`
    a `4` para mantener la misma proporción relativa (2× la base) tras
    subir la base de 1.5 a 2.
11. **Fondo de accordion**: agregado override de
    `MuiAccordionSummary`/`MuiAccordionDetails` a `transparent`
    (incluyendo `.Mui-expanded`) — MUI aplica por defecto un tinte
    sutil al header expandido que `.pbx-palette__accordion-*` no tiene
    (ese CSS solo controla `overflow`, nunca `background`).

### Pendiente al retomar

- **Confirmación visual final del usuario** sobre el estado actual
  (color, stroke, tamaño, alturas, grid de 3 columnas) antes de dar
  por cerrada la Tanda 1.
- Las 2 preguntas abiertas de §6 (`primitives`, `templates`).
- **Verificación de tipos/build**: `astro check` → **0 errores, 0
  warnings, 3 hints** (mismos hints preexistentes documentados en
  `INSPECTOR_INPUT_HEIGHT_AUDIT.md`, no relacionados). `vitest run` →
  **43/43 archivos, 303/303 tests pasando**. Ambas corridas al cierre
  de esta sesión, tras todos los cambios de §8b.

### Tandas pendientes (orden planeado, sections)

3. `features` + `footer`
4. `gallery` + `header`
5. `hero` + `logo`
6. `nav` + `pricing`
7. `social_proof` + `stats`
8. `steps` + `team`
9. `testimonial` (5) + inicio de `layouts` (5 de 13)
10. resto de `layouts` (8 de 13)
11-13. `templates` (20, en tandas de ~7, según respuesta a la pregunta 2)
14-16. `primitives` (28, en tandas de ~10, según respuesta a la pregunta 1)

Este orden es tentativo y puede reajustarse según las respuestas a las
preguntas abiertas.

## 9. Tanda 2 — `sections`, roles `cta` + `faq` (10/85, 20/146 acumulado)

**Estado: iconos implementados en código en `sectionIcons.tsx`
(`SECTION_ICONS`), pendiente visto bueno visual del usuario en el
editor real** — mismo flujo que la Tanda 1 (§8b): análisis
estructural desde `localPresets.data.json`, propuesta SVG, aplicado
directamente al mapa existente (no hace falta tocar
`LibraryCardThumbnail.tsx`/`ComponentsLibraryDrawer.tsx`, el wiring de
`iconId` ya quedó conectado en la Tanda 1).

| # | id | Nombre | Role | Estructura (`blocks`) |
|---|---|---|---|---|
| 1 | `2bfc7466-90a7-43fc-bcd1-a65a9fbe3589` | Centered band | cta | `Container(dark bg) > título + texto + Button` — bloque único centrado |
| 2 | `6c4e2918-c5c6-4598-94e5-807550ad2944` | Two-column mobile stack | cta | `Container > ColumnsContainer[2: (título+texto) col0, Button col1]` |
| 3 | `6eae46e2-6b5f-4a3f-8f14-b48d5ddda2fd` | Newsletter | cta | `Container > título + texto + Button + texto legal` — igual a #1 con línea extra abajo |
| 4 | `71da79ee-59c5-4492-ab8d-09076a6afe94` | BG image promo card | cta | `Container > Container(bg image, rounded) > badge + título + texto + Button` |
| 5 | `78b538c5-54d0-4de2-a407-d5b8004f262d` | Card | cta | `Container > Container(bordered card) > título + texto + Button + texto legal` |
| 6 | `2f03b3cf-34be-4d04-b08e-9a1b9a244146` | FAQ + contact CTA | faq | `Container > título FAQ + 2×(pregunta+respuesta, Divider) + Spacer + Container(card: título+texto+Button)` |
| 7 | `6344fb2f-fc29-4ef5-b441-acf01fa649c8` | Pill question rows | faq | `Container > título + 3×(Container pill[pregunta] + respuesta)` |
| 8 | `c404de6f-0227-4e69-8971-f37f74fe7b0f` | FAQ with categories | faq | `Container > (título categoría + pregunta+respuesta) + Divider+Spacer + (título categoría + pregunta+respuesta)` |
| 9 | `cebd6caa-c867-4e45-b778-3cdb06636df2` | FAQ list | faq | `Container > título + 3×(pregunta+respuesta) con Divider entre cada uno` |
| 10 | `cec0c438-d335-46e6-9ad9-1f65dfd45aae` | Mobile reflow 2 columns | faq | `Container > título + ColumnsContainer[2 col simétricas: cada una con 2×(pregunta+respuesta)+Spacer]` |

Micro-variaciones aplicadas (mismo criterio que la Tanda 1):
- **#1/#3** (Centered band / Newsletter): banda única centrada; #3
  añade la línea de texto legal bajo el botón.
- **#4/#5** (BG image promo card / Card): card anidada
  `Container>Container`; #4 con badge arriba (sin borde propio, fondo
  de imagen tratado como bloque sólido), #5 con borde fino y texto
  legal abajo (sin badge).
- **#6/#7/#8/#9/#10** (los 5 `faq`): átomo repetido pregunta
  (línea gruesa) + respuesta (línea fina), variando el contenedor:
  lista plana con dividers (#9), lista + card de contacto final (#6),
  filas en pill (#7), agrupado por categoría con encabezado en negrita
  (#8), o en 2 columnas (#10).

`SECTION_ICONS` actualizado con las 10 entradas nuevas (type
`SectionIconEntry.role` extendido a `'banner' | 'comparison' | 'cta' |
'faq'`). Verificación tras el cambio: `astro check` → **0 errores, 0
warnings, 3 hints** (mismos hints preexistentes, no relacionados);
`vitest run` → **43/43 archivos, 303/303 tests pasando** — sin
regresión frente al estado post-Tanda 1.

**Siguiente paso al retomar:** visto bueno visual del usuario sobre
estos 10 iconos en el editor real; luego avanzar a la **Tanda 3**
(roles `features` + `footer`, siguiente en el orden planeado).

## 10. Sesión 3 — corrección: commit de alturas de inputs/chips faltante

El usuario reportó que los inputs del inspector y los chips de
selección de breakpoint/configuración por bloque **no tenían la
altura homologada con Builder42**, a pesar de que §8b documenta ese
trabajo como ya portado a `feat/ui-polish-p1` vía cherry-pick de 3
commits (`e6a9b58`, `c8a9988`, `aa84f2a`).

**Causa raíz confirmada** (`git merge-base --is-ancestor e6a9b58 HEAD`
→ falso; `git cherry e6a9b58~1 fix/email-builder-inspector-input-height`
marcó los 3 commits como no aplicados): solo `c8a9988` (borrador Tanda
1 de iconos) y `aa84f2a` (ajuste de tamaño/color de esos iconos) habían
llegado a `feat/ui-polish-p1`. **`e6a9b58` — el commit que de verdad
homologa alturas (`INPUT_HEIGHT` 36→32 en `inputStyles.ts`,
`MuiToggleButtonGroup` en `theme.ts`, pills de `ThemePanel`/
`ChipsFilterRow`) — nunca se había cherry-pickeado**, pese a estar
listado en la nota de §8b. El working tree en `feat/ui-polish-p1`
confirmaba `INPUT_HEIGHT = 36` sin el comentario de homologación, y
`git log e6a9b58..HEAD` para ese archivo no mostraba ningún commit
posterior — es decir, el cambio simplemente nunca entró, no fue
revertido.

**Corrección aplicada**: `git cherry-pick e6a9b58` sobre
`feat/ui-polish-p1` (auto-merge limpio en `theme.ts`, sin conflictos;
nuevo commit `6cf99de`). Trae:
- `INPUT_HEIGHT` (`inputStyles.ts`): 36px → 32px, con el comentario de
  homologación (`--pb-chrome-panel-row-height` de Builder42).
- `ColorInput`/`BaseColorInput` swatch principal: 36px → 32px.
- `MuiToggleButtonGroup` (`theme.ts`): altura fija 32px.
- `ThemePanel` pill selector + `ChipsFilterRow`: radio 999px → 8px,
  estado activo con fondo tenue (`#eef0ff`) + texto intenso
  (`#4f46e5`) en vez del pill sólido por defecto de MUI Chip.
- Nuevo archivo `INSPECTOR_INPUT_HEIGHT_AUDIT.md` (auditoría previa
  referenciada por el commit).

Verificado tras el cherry-pick: `astro check` → 0 errores, 0 warnings,
3 hints (mismos hints preexistentes). `vitest run` → 43/43 archivos,
303/303 tests.

**Lección**: la nota de §8b sobre "cambios portados vía cherry-pick"
no se verificó contra `git log`/`git merge-base` en su momento — quedó
como una afirmación no comprobada. A futuro, cualquier traspaso de
cambios entre worktrees debe confirmarse con
`git merge-base --is-ancestor <commit> HEAD` antes de documentarlo
como completado.

## 11. Tanda 3 — `sections`, roles `features` + `footer` (10/85, 30/146 acumulado)

**Estado: iconos implementados en código en `sectionIcons.tsx`
(`SECTION_ICONS`), pendiente visto bueno visual del usuario.**

| # | id | Nombre | Role | Estructura (`blocks`) |
|---|---|---|---|---|
| 1 | `445b8b55-10bc-4171-8800-b4d48c425b50` | 3 columns with icons | features | `Container > eyebrow+título + ColumnsContainer[3: emoji+título+texto]` |
| 2 | `525f66f6-293d-434f-9f39-6b608a1ef320` | Image-backed showcase rows | features | `Container > ColumnsContainer[2: imagen col0, texto col1] + Spacer + ColumnsContainer[2: texto col0, imagen col1]` — filas alternadas |
| 3 | `70add1ca-9009-43d3-9386-bac9479f2bfb` | Gradient cards | features | igual a #1, cada columna es card con borde+degradado |
| 4 | `ad7f3a04-80a7-4e24-8793-7250d55387fb` | 4-up grid | features | `Container > título + ColumnsContainer[2] fila1 + Spacer + ColumnsContainer[2] fila2` — grid 2×2 |
| 5 | `cff4cce6-7006-429c-8fda-993c17fed9f8` | Checklist | features | `Container > título + ColumnsContainer[2: lista checks col0, lista checks col1]` |
| 6 | `1a254a1d-4d36-4a4f-9ab4-0197c3adb4bf` | Dark BG with pattern | footer | `Container(dark bg imagen) > logo + ColumnsContainer[3 grupos links] + Divider + dirección + unsubscribe` |
| 7 | `1a97c98f-a4d4-4610-b416-1a73be62e899` | Pill social row | footer | `Container > título + ColumnsContainer[3 Button pill social] + Divider + ColumnsContainer[2 grupos links] + copyright` |
| 8 | `5d9a93e2-d086-478e-946c-c1c34ad70904` | Full | footer | igual a #6, fondo claro plano (sin imagen) |
| 9 | `6fc20489-3492-49aa-9b58-322f70bc442e` | Social + links | footer | `Container > social lineal + ColumnsContainer[2 grupos links] + Divider + copyright` |
| 10 | `a42a309f-9d55-49db-a891-1899d04095af` | Minimal | footer | `Container > nombre marca + unsubscribe/copyright` — 2 líneas, sin columnas |

Micro-variaciones: **#1/#3** mismo grid 3-col, #3 con marco de card;
**#6/#8** misma estructura logo+3 grupos+divider+dirección, #6 con
fondo tintado (`fillOpacity`) para distinguir el dark-bg de #8 (fondo
claro); **#7/#9** ambos social+links+copyright, #7 con pills de redes
+3 grupos, #9 con social lineal+2 grupos (más compacto).

`SECTION_ICONS` extendido con las 10 entradas; `role` del tipo
`SectionIconEntry` ampliado a incluir `'features' | 'footer'`.
Verificación: `astro check` → 0 errores, 0 warnings, 3 hints
(preexistentes); `vitest run` → 43/43 archivos, 303/303 tests.

**Siguiente paso al retomar:** visto bueno visual del usuario; luego
Tanda 4 (roles `gallery` + `header`).

## 12. Tanda 4 — `sections`, roles `gallery` + `header` (10/85, 40/146 acumulado)

**Estado: iconos implementados en código en `sectionIcons.tsx`
(`SECTION_ICONS`), pendiente visto bueno visual del usuario.**

| # | id | Nombre | Role | Estructura (`blocks`) |
|---|---|---|---|---|
| 1 | `127b953d-476a-4714-bd26-ee909bd10eac` | 3 product cards | gallery | `Container > ColumnsContainer[3: card(imagen+título+precio+Button)]` |
| 2 | `4bc7b5e2-d31a-47e7-a23d-89903c1b180e` | Hero + thumbnails | gallery | `Container > imagen grande + Spacer + ColumnsContainer[3 imágenes pequeñas]` |
| 3 | `5228ffb8-1cc6-4f35-afd4-8b670da9614b` | Cornered product cards | gallery | igual a #1, esquinas asimétricas + Button pill |
| 4 | `7dd4acee-36dd-4b01-bd7d-99f7da123919` | BG image lookbook hero | gallery | `Container > Container(bg imagen) título+texto+Button + Spacer + ColumnsContainer[3 imágenes]` |
| 5 | `a17f162d-07ae-4830-8491-6eb2fb60ff07` | Mobile-stack 2 featured | gallery | `Container > ColumnsContainer[2: imagen+título+link]` |
| 6 | `20751f09-4ff1-4c57-b60d-78b314ba6797` | Mobile-tight logo | header | `Container(borde inferior mobile) > logo + tagline` — apilado centrado |
| 7 | `35742add-9d96-4f7e-8985-e8f8141ad927` | Logo + CTA | header | `Container > ColumnsContainer[2: logo col0, Button col1]` |
| 8 | `8a46ec83-0f12-46c1-85b1-1134324c7a22` | Logo + nav | header | `Container > ColumnsContainer[2: logo col0, links inline col1]` |
| 9 | `bd457ce3-75f4-4161-9e3e-6937c9594ae5` | Preheader + logo | header | `Container > texto preheader + logo` — apilado vertical |
| 10 | `c08045a7-4237-43a3-8f12-e3abfa8b09f6` | Pill nav buttons | header | `Container > ColumnsContainer[2: logo col0, Container(5 Button pill) col1]` |

Micro-variaciones: **#1/#3** mismo grid 3-card imagen+título+precio+
botón, #3 con esquinas más redondeadas (aproximación de la asimetría
real, ya que SVG `rect` no soporta radio por esquina individual en
este set) y botón pill vs. rectangular; **#7/#8/#10** los 3 son
"logo izquierda + elemento derecha", variando ese elemento (botón
sólido, links de texto, o varios botones pill).

`SECTION_ICONS` extendido con las 10 entradas; `role` del tipo
`SectionIconEntry` ampliado a incluir `'gallery' | 'header'`.
Verificación: `astro check` → 0 errores, 0 warnings, 3 hints
(preexistentes); `vitest run` → 43/43 archivos, 303/303 tests.

**Siguiente paso al retomar:** visto bueno visual del usuario; luego
Tanda 5 (roles `hero` + `logo`).

## 13. Tanda 5 — `sections`, roles `hero` + `logo` (10/85, 50/146 acumulado)

**Estado: implementado en código, pendiente visto bueno visual.**

| # | id | Nombre | Role | Estructura (`blocks`) |
|---|---|---|---|---|
| 1 | `04033fa8-61be-4f01-b046-eae103b4ea5e` | Centered | hero | `Container > eyebrow+h1+texto+Button+link` — bloque único centrado |
| 2 | `37898f65-478b-4026-a10e-f98931e292c5` | Image card with pill CTA | hero | `Container > Container(bg imagen, rounded) > h1+texto+Button pill` |
| 3 | `3881fe2f-2a14-453a-8993-bc96d5c2f8ca` | Split mobile reflow | hero | `Container > ColumnsContainer[2: h1+texto+Button col0, Image col1]` |
| 4 | `4fae03fe-d95d-405c-890d-08a6d8edbb9c` | "Footer" (catálogo dice role=hero, mal-etiquetado) | hero | `Container(bg color) > SocialMedia+texto+Divider+ColumnsContainer[links, imagen]` — diseñado según estructura real (footer), no el rol nominal |
| 5 | `bf07aee7-3472-40fc-a289-e98e9acddbaf` | Logo + headline | hero | `Container > Image(logo)+h1+texto+Button` — apilado vertical |
| 6 | `2d705565-c805-4571-b446-977543111c5a` | Wordmark | logo | `Container > NotionText(h2 "ACME")` — texto puro |
| 7 | `3cf56fed-981a-4c87-862d-cea340dfd16d` | Logo + tagline | logo | `Container > Image(logo)+texto tagline` |
| 8 | `4f9491aa-be6c-4c95-ba75-e077fb9763d0` | Left aligned | logo | `Container > Image(logo, izquierda)` — un solo bloque |
| 9 | `624b4835-df2d-46cb-af3a-a666a8af6585` | On BG image | logo | `Container(bg imagen) > Image(logo)` |
| 10 | `71b06d77-9da6-4fe3-be3a-ad3b6785af0c` | Cornered card | logo | `Container > Container(esquinas superiores redondeadas) > Image(logo)+texto tagline` |

Nota sobre #4: catalogado como `role: "hero"` en `localPresets.data.json`
pero su árbol de `blocks` es estructuralmente un footer (SocialMedia +
Divider + 2 columnas links/imagen). Se diseñó el icono según la
estructura real, consistente con el criterio de todo el plan (analizar
`blocks`, no asumir el `role` como verdad absoluta).

Micro-variaciones: **#6/#7** logo simple centrado, #6 sin imagen (solo
texto), #7 con imagen+tagline; **#8/#9** logo solo, #8 sin fondo
(izquierda), #9 con fondo tintado (imagen de fondo, centrado).

`SECTION_ICONS` extendido con las 10 entradas; `role` ampliado a
incluir `'hero' | 'logo'`. Verificación: `astro check` sin errores
nuevos, `vitest run` → 43/43 archivos, 303/303 tests.

**Siguiente paso:** Tanda 6 (roles `nav` + `pricing`).

## 14. Tanda 6 — `sections`, roles `nav` + `pricing` (10/85, 60/146 acumulado)

**Estado: implementado en código, pendiente visto bueno visual.**

| # | id | Nombre | Role | Estructura |
|---|---|---|---|---|
| 1 | `037c8276-fc0c-43d7-bae6-e7239e395358` | Pill links | nav | `Container > NotionText(3 links pill inline)` |
| 2 | `241630b5-f1c7-4e5d-bbfe-c54db0ae984d` | BG image band | nav | `Container(bg imagen dark) > NotionText(5 links inline blancos)` |
| 3 | `2af2bf4e-90d1-42a1-ba8a-369955157b4f` | Logo + links | nav | `Container > ColumnsContainer[2: logo, links]` |
| 4 | `645106fd-44c0-4d9d-ba9a-9519f5b0802e` | Mobile-stack categories | nav | `Container > ColumnsContainer[3: grupo título+links]` |
| 5 | `91915ee2-5d62-46c3-89b3-654cac1670ef` | Categories | nav | idéntico a #4 sin `stackColumnsOnMobile` |
| 6 | `36ea3e52-d5a2-41b8-86b7-3dea022fa658` | Monthly / Annual | pricing | `Container > título + ColumnsContainer[2 cards, 1 destacada borde grueso]` |
| 7 | `42e75ffc-b7ef-4486-b25b-e57eda80b179` | Cornered cards row | pricing | `Container > título + ColumnsContainer[3 cards esquina asimétrica, 1 destacada]` |
| 8 | `7fcd1b9a-a856-4375-b6f9-a095d97288b7` | Single feature card | pricing | `Container > Container(1 card, borde superior grueso) > título+precio+2 listas+Button+legal` |
| 9 | `ac3e7550-d9c2-4757-b470-c3d8001811b9` | Mobile-stacked plans | pricing | igual a #6, degradado + badge "Save 20%" |
| 10 | `adcd51b6-b598-49e6-a228-1b21d1e25155` | 3 tiers with highlight | pricing | `Container > eyebrow+título+texto + ColumnsContainer[3 cards, 1 con badge "Most popular"]` |

Micro-variaciones: **#4/#5** estructuralmente idénticos (solo difieren
en el flag `stackColumnsOnMobile`, sin análogo visual estático) — #5
usa el mismo grid con una línea punteada adicional bajo el grupo para
diferenciarlo mínimamente en el listado. **#6/#9** mismo layout de 2
planes, #9 con relleno degradado (`fillOpacity`) y badge sobre la card
destacada. **#7/#10** 3 cards de planes, #7 con esquina redondeada más
pronunciada (aprox. de la asimetría real) sin intro, #10 con
eyebrow+texto y badge "Most popular" centrado en la card del medio.

`SECTION_ICONS` extendido con las 10 entradas; `role` ampliado a
incluir `'nav' | 'pricing'`. Verificación: `vitest run` → 43/43
archivos, 303/303 tests; sin diagnósticos LSP nuevos.

**Siguiente paso:** Tanda 7 (roles `social_proof` + `stats`).

## 15. Tanda 7 — `sections`, roles `social_proof` + `stats` (10/85, 70/146 acumulado)

**Estado: implementado en código, pendiente visto bueno visual.**

| # | id | Nombre | Role | Estructura |
|---|---|---|---|---|
| 1 | `164d7f04-5b3e-492e-937d-46dc1a98207d` | BG image quote band | social_proof | `Container(bg imagen) > estrellas+quote(h2)+avatar(pill)+nombre+cargo` |
| 2 | `419a3823-cfd6-4cfd-b07f-c37ac71d736f` | Pill rating card | social_proof | `Container > Container(pill) > estrellas+rating texto` |
| 3 | `43ef55b1-6f84-4e6e-a6e9-494c604b62bf` | Stat + logos | social_proof | `Container > número+texto + ColumnsContainer[3 logos]` |
| 4 | `56f3d4cd-3506-48ac-9222-9fe9d6f2b261` | Press quotes | social_proof | `Container > ColumnsContainer[3: quote+fuente]` |
| 5 | `9e322371-a8b4-4856-bb6c-931ec1e43938` | Logos mobile stack | social_proof | `Container > eyebrow + ColumnsContainer[3 logos]` |
| 6 | `403ab92c-2906-40f9-8e9e-b86519788bab` | Mobile-stack with icons | stats | `Container > ColumnsContainer[3: emoji+número+label]` |
| 7 | `487d3679-619d-4e38-ba82-daf16e6a985d` | 4 metrics grid | stats | `Container > título + ColumnsContainer[2] fila1 + Spacer + ColumnsContainer[2] fila2` — 4 stats, grid 2×2 plano |
| 8 | `5ba31193-4e40-4e7e-a15d-674735bc7509` | Highlight + context | stats | `Container > ColumnsContainer[2: número grande col0, texto+Button col1]` |
| 9 | `a2ccde5c-4903-4962-804f-77978c5f8463` | Stats with icons | stats | igual a #6, sin mobile-stack |
| 10 | `c174aa06-7d33-4247-a551-26f61c4868e5` | Cornered cards 4-up | stats | `Container > título + 2×ColumnsContainer[2] con cards esquina asimétrica` — 4 stats en cards |

Micro-variaciones: **#6/#9** mismo grid 3-col icono+número+label,
distinguidos con línea punteada bajo el grupo en #6 (mismo criterio
usado en `nav` #4/#5). **#7/#10** ambos grid 2×2 de stats, #7 plano
sin marco, #10 cada stat en card con esquina asimétrica.

`SECTION_ICONS` extendido; `role` ampliado a incluir
`'social_proof' | 'stats'`. Verificación: `vitest run` → 43/43
archivos, 303/303 tests; sin diagnósticos LSP nuevos.

**Siguiente paso:** Tanda 8 (roles `steps` + `team`).

## 16. Tanda 8 — `sections`, roles `steps` + `team` (10/85, 80/146 acumulado)

**Estado: implementado en código, pendiente visto bueno visual.**

| # | id | Nombre | Role | Estructura |
|---|---|---|---|---|
| 1 | `02621ec6-b152-4fa6-8bce-390c31ea3986` | Mobile vertical timeline | steps | `Container > 3×(ColumnsContainer[num+título+texto], Divider)` — timeline vertical |
| 2 | `4d7a6968-7d71-4de8-9a7a-457927c5f70e` | How it works | steps | `Container > eyebrow+título + ColumnsContainer[3: num+título+texto]` |
| 3 | `88d32150-af31-482b-b77f-19afdeea27cc` | Pill numbered cards | steps | `Container > título + ColumnsContainer[3: pill "STEP N"+Spacer+card borde superior]` |
| 4 | `94205636-ff4c-4095-aa97-3bf4c78f3c17` | BG image hero + numbered cards | steps | `Container > Container(bg imagen) eyebrow+título + Spacer + ColumnsContainer[3 cards]` |
| 5 | `a7d991de-6787-40da-944e-858abe0fa977` | Process with images | steps | `Container > ColumnsContainer[3: num+imagen+título+texto]` |
| 6 | `038aeb83-d141-4f04-927f-ed02a0995a72` | Cornered member cards | team | `Container > ColumnsContainer[3: card avatar+nombre+cargo+Button social]` |
| 7 | `353542c8-6e6f-4eff-911f-d5d26e087ddb` | BG image team band | team | `Container > Container(bg imagen) eyebrow+título+texto + Spacer + ColumnsContainer[3: avatar+nombre+cargo+links]` |
| 8 | `741f0e71-8b8e-4884-9828-06eff2bc6f71` | Mobile-stacked grid | team | `Container > ColumnsContainer[3: avatar+nombre+cargo+bio+links]` — sin card ni Button |
| 9 | `9c62ea3b-1248-475d-8686-3409f7ea6233` | 2 founders | team | `Container > ColumnsContainer[2: avatar+nombre+cargo+bio+links]` |
| 10 | `cd3b47fc-4701-4547-b634-0935b674c827` | 3 member cards | team | `Container > ColumnsContainer[3: avatar+nombre+cargo]` — sin bio ni links |

`SECTION_ICONS` extendido; `role` ampliado a incluir
`'steps' | 'team'`. Verificación: `vitest run` → 43/43 archivos,
303/303 tests; sin diagnósticos LSP nuevos.

Con esta tanda se completan 80/85 `sections` — solo queda el role
`testimonial` (5 items), agrupado con el inicio de `layouts` en la
Tanda 9 según el orden planeado en §8b.

**Siguiente paso:** Tanda 9 (`testimonial` + inicio de `layouts`).

## 17. Tanda 9 — `sections` role `testimonial` (5/85, completa sections) + `layouts` (5/13) — 90/146 acumulado

**Estado: implementado en código, pendiente visto bueno visual.**

Con esta tanda se completan los 85/85 items de la categoría `sections`.
Los 5 restantes son `layouts` — un tipo de item distinto: esquemas de
composición **vacíos** (`childrenIds: []`, sin `role`, identificados
por `shape`), no secciones con contenido real. El tipo
`SectionIconEntry.role` se extendió con un valor propio `'layout'`
(no reutiliza ningún role de `sections`) para reflejar esa diferencia
de naturaleza.

| # | id | Nombre | Categoría | Estructura |
|---|---|---|---|---|
| 1 | `57f8146b-cf8c-43de-bf76-3b33c808910f` | Quote with author | testimonial | `Container > ColumnsContainer[2: avatar col0, quote+estrellas+autor col1]` |
| 2 | `af63d2e0-f52b-4382-ac69-1751852c2403` | Pill avatar cards | testimonial | `Container > ColumnsContainer[3: card(esquinas sup.) estrellas+quote+avatar+nombre+cargo+Button]` |
| 3 | `cede2521-b110-48f6-8d58-11b419f9ad10` | Mobile-stack 3 quotes | testimonial | `Container > ColumnsContainer[3: card estrellas+quote+Divider+avatar+nombre+cargo]` |
| 4 | `d292fda6-dabd-4963-89b8-7fc28ee428e2` | BG image featured quote | testimonial | `Container(bg imagen) > estrellas+quote(h2)+avatar+nombre+cargo` |
| 5 | `df94d9e8-1e31-4339-a036-5ea5e99233a8` | 3 testimonial cards | testimonial | igual a #2 sin el Button final |
| 6 | `53f33c42-9871-46cd-b000-5d1327215e10` | Media + text | layout (columns-2, 45/55) | `ColumnsContainer`: card bg-imagen + card blanca — sin contenido real |
| 7 | `98cdcd2a-8db3-428f-894e-835a7414861a` | Hero split | layout (columns-2, 60/40) | inverso de #6 (orden y proporción) |
| 8 | `a8fabafc-6419-4827-82ad-7fe9e0789a88` | Sidebar shell | layout (columns-2, 32/68) | sidebar + 2 cards apiladas en columna principal |
| 9 | `c4f900a4-071c-45e6-89b2-9a164f6cd905` | Magazine | layout (columns-2, 66/34) | `ColumnsContainer` anidado 2-up en col principal + aside |
| 10 | `10bf9ad2-303c-474e-a247-a28b25ed4a97` | Bento grid | layout (columns-3) | 3 cards de acabado mixto (degradado · imagen · glass) |

Micro-variaciones: **#2/#5** mismo grid 3-card con estrellas+quote+
avatar+nombre+cargo, #2 añade Button "Read more". **#6/#7** mismo
split de 2 cards, invertido. Los iconos de `layouts` (#6-10) usan
`fillOpacity`/`strokeDasharray` para distinguir "card con imagen de
fondo" (relleno sólido) de "card vacía" (borde punteado), sin sugerir
contenido de texto que no existe en el dato real.

`SECTION_ICONS` extendido con las 10 entradas; `role` ampliado con
`'testimonial' | 'layout'`. Verificación: `vitest run` → 43/43
archivos, 303/303 tests; sin diagnósticos LSP nuevos.

**Siguiente paso:** Tanda 10 (resto de `layouts`, 8/13 restantes).

## 18. Tanda 10 — resto de `layouts` (8/13, completa layouts 13/13) — 98/146 acumulado

**Estado: implementado en código, pendiente visto bueno visual.**

Con esta tanda se completan `layouts` (13/13) y, junto con la Tanda 9,
también `sections` (85/85) — el catálogo completo de esas dos
categorías queda diseñado.

| # | id | Nombre | Shape | Estructura |
|---|---|---|---|---|
| 1 | `6dfb5ae2-a92f-4b3b-92ac-6146d851da7f` | Feature trio | columns-3 | 3 cards con acento superior grueso, esquinas inferiores redondeadas |
| 2 | `7b429d27-b6bd-43f6-9bdc-f3917dc3b2d9` | Pricing trio | columns-3 | 2 cards acento superior + 1 card degradado destacada en medio |
| 3 | `cb2adfc1-4a36-437b-a18f-84708b76f684` | Gallery grid | columns-3 | 3 cards con imagen de fondo, iguales |
| 4 | `0218f056-aebf-4d19-b742-508e467cad8e` | Spotlight (image overlay) | container | 1 card blanca centrada dentro de banda con imagen de fondo |
| 5 | `46b33349-e766-4bef-a443-a500da282912` | Gradient hero band | container | 1 card blanca centrada dentro de banda con degradado |
| 6 | `e928d346-3cbe-4ceb-aa54-0eb15a8e80d1` | Feature grid 2×2 | container | 2 filas de 2 cards (anidado) dentro de sección con fondo suave |
| 7 | `f60bfba6-d3c7-4327-8c5c-34642cf44546` | Stacked sections | container | 3 cards apiladas verticalmente |
| 8 | `f6c65ea8-78ca-4ef1-9a70-0c6f652b6954` | Split callout | container | banda tintada con 2 cards en split 60/40 |

Micro-variaciones: **#1/#2** ambos 3 cards con acento superior grueso,
#2 sustituye la card del medio por una destacada con relleno degradado
(sin acento). **#4/#5** mismo patrón "banda + card centrada", #4 con
relleno sólido (imagen), #5 con línea diagonal punteada simulando la
dirección del degradado.

`SECTION_ICONS` no necesitó extender el tipo `role` — todos usan
`'layout'` (ya agregado en la Tanda 9). Verificación: `vitest run` →
43/43 archivos, 303/303 tests; sin diagnósticos LSP nuevos.

**Siguiente paso:** Tandas 11-13, `templates` (20 items, raíz
`EmailLayout`) — pendiente resolver antes la pregunta abierta de §6
sobre si necesitan un lenguaje de icono distinto (documento completo
vs. section individual).

## 19. Sesión 4 — Auditoría de legibilidad y plan de mejora del set existente

**Estado: plan, sin cambios de código todavía.** Pedido del usuario:
mejorar los iconos de los componentes **no primitivos** de la
Components Library; se autoriza **bajar el trazo hasta 1px** para que
el detalle se lea mejor.

### 19.1 Alcance exacto (verificado en código)

| Categoría | Preview actual | Entra en esta mejora |
|---|---|---|
| `sections` (85) | icono de `SECTION_ICONS` | **sí** |
| `layouts` (13) | icono de `SECTION_ICONS` | **sí** |
| `templates` (20) | PNG en `.eb-template-card` (240px) | no todavía — sin icono diseñado (§6 P2 abierta) |
| `primitives` (28) | `LibraryCardPrimitiveRender` (mini-iframe vivo) | no — no usa iconos |

"No primitivos" = los **98 iconos ya implementados** (`sections` +
`layouts`). Detalle encontrado al revisar: `LibraryCard` retorna antes
por la rama `category === 'template'` (`.eb-template-card`), así que
el `height={category === 'template' ? 240 : 28}` que se le pasa a
`LibraryCardThumbnail` es **rama muerta** — la caja del icono es
siempre 28px.

### 19.2 Cómo se renderiza hoy (medido, no estimado)

- `LibraryCardThumbnail`: `'& svg': { width: 28, height: 28 }` sobre
  `viewBox="0 0 24 24"` → escala 28/24 = **1.1667 → 1 unidad = 1.17px**.
- Grosores efectivos: base `strokeWidth: 2` → **2.33px**; detalle `1` →
  1.17px; acentos 2.4-4 → 2.8-4.7px.
- Card: `p: 10px 6px` + `gap: 8px` + border 1px + label ~18px + icono
  28px ≈ **76px de alto** (homologado con `.pbx-palette__item`).
- Ancho: drawer 312px, grid de 3 columnas, `gap: 0.5` (4px) → card
  ≈93px, **contenido ≈79px**. Es decir: **sobra ancho; el único
  presupuesto ajustado es la altura**.

### 19.3 Evidencia de la auditoría

Medición hecha con un script ad-hoc sobre `sectionIcons.tsx` (parsea
las 98 entradas y calcula la separación mínima entre trazos paralelos
en X e Y, contando bordes de `rect`, `line` horizontales/verticales y
extremos de `circle`):

| Separación mínima entre trazos | Iconos | Efecto real |
|---|---|---|
| < 1 u (< 1.17px) | **19** | los trazos se solapan incluso con trazo de 1px |
| 1–2 u (1.17–2.33px) | **31** | con trazo 2 (2.33px) se fusionan; con ~1px se separan |
| ≥ 2 u | 48 | se arreglan solo bajando el trazo |

Complejidad: **27 iconos con ≥8 formas**, 12 con **≥10 formas** en
24×24 → a 28px cada forma mide 2-4px. Y hay **11 valores distintos de
`strokeWidth`** en el set (1, 1.2, 1.6, 1.8, 2, 2.4, 2.5, 2.6, 3, 3.2,
4): jerarquía ad-hoc, no un sistema.

Los 19 peores casos (`gap` en unidades de viewBox):

| gap | Icono |
|---|---|
| 0.10 | features · 4-up grid · pricing · Mobile-stacked plans |
| 0.20 | pricing · 3 tiers with highlight · layout · Magazine |
| 0.35 | gallery · BG image lookbook hero |
| 0.50 | banner · Sale banner · cta · Two-column mobile stack · header · Pill nav buttons · hero · Footer · hero · Logo + headline · steps · Mobile vertical timeline · steps · BG image hero + numbered cards · testimonial · Quote with author / Pill avatar cards / Mobile-stack 3 quotes / 3 testimonial cards |
| 0.80 | layout · Feature trio · layout · Pricing trio · comparison · Top-accent matrix |

⚠️ De esa lista, los tres de `gap 0.80` (Feature trio, Pricing trio,
Top-accent matrix) son **solapamientos intencionales** (línea de acento
dibujada encima del borde superior de la card) — se excluyen del
rework, no son defectos.

**Diagnóstico raíz**: el set está autorado como *diagrama de layout*
(8-12 formas, 3 niveles de jerarquía de trazo) pero dimensionado como
*glifo* (28px, trazo 2 — el tamaño/grosor de `.pbx-palette__icon` de
Builder42, que dibuja glifos Lucide de 3-5 trazos). No es solo el
grosor: es **grosor + densidad + tamaño de caja** a la vez. Bajar el
trazo resuelve 48+31 iconos; los 16 restantes (19 CRIT − 3
intencionales) necesitan además rework geométrico.

Contexto que justifica simplificar en vez de detallar: el hover ya
muestra el **render real** del componente en un popper de 640px
(`LibraryHoverPreviewPortal`). El icono no tiene que ser un plano a
escala; tiene que ser una **silueta reconocible**.

### 19.4 Fase A — sistema de trazo (mecánico, los 98 iconos)

Jerarquía reducida a **2 niveles** (hoy hay 11 valores):

- `HAIRLINE` = **1px efectivo** — todo el dibujo.
- `ACCENT` = **2px efectivo** — solo el acento real del componente
  (borde superior grueso, número destacado), **máximo uno por icono**.
- El énfasis que hoy hacen los grosores intermedios pasa a **geometría
  + `fillOpacity`** (recurso ya usado en el set para "fondo con
  imagen").

Dos implementaciones posibles del "1px":

- **A1** — `strokeWidth: 0.86` en unidades (0.86 × 1.1667 = 1.0px).
  Correcto solo a 28px; se rompe si el icono se reusa a otro tamaño.
- **A2 (recomendada)** — `strokeWidth: 1` + `vectorEffect="non-scaling-stroke"`:
  el grosor pasa a ser **1px de pantalla exacto a cualquier tamaño de
  caja**, y el acento a `2`. Desacopla grosor de escala, así que sirve
  igual si mañana la caja crece (Fase B) o si el icono se usa en un
  preview grande.

### 19.5 Fase B — nitidez / rejilla de píxel (decisión abierta)

A 28px con `viewBox 24`, **ninguna** coordenada cae en borde de píxel
(0.5 u = 0.583px), así que todo trazo queda antialiaseado repartido
entre dos filas de píxeles: se ve como *dos grises tenues* en vez de
una línea limpia. Adelgazar a 1px hace esto **más** visible, no menos.
Opciones:

- **B1 (mínimo cambio)** — quedarse en 28px con A2. Se gana grosor real
  de 1px y se separan 31 iconos; el AA de posición sigue ahí.
- **B2 (recomendada para evaluar)** — caja del icono a **48px** (2× la
  unidad): 1 u = 2px y 0.5 u = 1px, así que **toda la geometría
  existente cae en borde de píxel entero** → nitidez real, y cada
  detalle mide el doble en absoluto. Coste: la card sube de ~76px a
  ~96px (el ancho ya sobra: 79px). Rompe la homologación de 76px con
  Builder42 — pero ese 76px se fijó para **glifos de tipo de bloque**,
  no para diagramas de composición; son contenidos distintos con
  presupuestos distintos. Ojo: escalar **no** separa trazos, la
  separación es relativa y solo la arregla adelgazar el trazo (Fase A) o
  mover geometría (Fase C).
- **B3 (descartable)** — reautorar todo a `viewBox 28` (×7/6 + redondeo
  a rejilla 0.5). Nitidez a 28px sin tocar la card, pero implica
  reescalar y revisar 98 iconos y los gaps siguen siendo diminutos.

Propuesta: implementar A2 + B1 en la primera pasada y **medir B2 en el
harness (§19.8) para decidir viéndolo**, no en abstracto.

### 19.6 Fase C — rework geométrico (16 CRIT + 31 MED)

Reglas de autoría a aplicar (y a documentar en `sectionIcons.tsx` como
contrato del set):

1. Separación mínima **2 u** entre trazos paralelos.
2. Gutter mínimo **2 u** entre columnas (hoy los grids de 3 columnas
   usan 1 u: `x = 2 / 9 / 16` con `width 6` → los bordes se tocan).
3. Máximo **6-8 formas** por icono.
4. Eliminar el tercer nivel de detalle (líneas de "texto secundario")
   cuando el icono ya comunica con 3 columnas.
5. Los pares estructuralmente idénticos se distinguen por **un** rasgo,
   no por tres.

Orden: primero los **16 CRIT** (excluyendo los 3 solapamientos
intencionales), luego los **31 MED** — en tandas de ~10 con visto bueno
visual, igual que el resto del plan. Si se aprueba **B2**, los 31 MED
se revisan pero probablemente no necesiten cambio.

### 19.7 Fase D — contraste (acoplada a la Fase A)

El trazo actual es `#a5a39a` (light) / `#8a8371` (dark),
`--pb-chrome-text-faint`. Sobre `#fff` eso da **≈2.5:1**, por debajo
del mínimo de 3:1 que WCAG pide para gráficos no textuales — pasaba
inadvertido con 2.33px de grosor, pero **a 1px una línea de ese tono
casi desaparece**. Adelgazar sin subir contraste empeora la
legibilidad neta, así que la Fase A debe ir con una decisión explícita
de tono (p. ej. `--pb-chrome-text-muted` `#57554e`, o un punto
intermedio) — se elige viéndolo en el harness, en light y dark.

### 19.8 Fase E — harness de revisión visual

Vista dev-only (mismo patrón que `devSeed*` / `devRecapture*`, montada
bajo flag) que renderice **los 98 iconos en grid** con nombre + role, a
28px y 48px, en light y dark, con toggle de grosor. Permite aprobar una
tanda con **una captura** en vez de recorrer el drawer icono por icono
— hoy la verificación visual es el paso más lento del flujo (§1: no hay
MCP de Chrome en este entorno).

### 19.9 Fase F — enforcement (test)

Convertir el script de auditoría de §19.3 en un test de vitest que
falle si: (a) aparece un `strokeWidth` fuera del set de tokens, (b) un
icono supera el máximo de formas, o (c) dos trazos paralelos quedan a
menos de 2 u (con una lista explícita de excepciones intencionales).
Evita que las tandas 11-16 (`templates`, `primitives`) vuelvan a meter
la misma deuda.

### 19.10 Verificación

`astro check` (0 errores) + `vitest run` (línea base actual: 43/43
archivos, 303/303 tests) tras cada fase, más el visto bueno visual del
usuario por tanda vía el harness.

### 19.11 Decisiones que hay que tomar antes de codificar

1. **B1 vs B2**: ¿se acepta subir la card de sections/layouts de ~76px
   a ~96px (caja de icono 48px) a cambio de nitidez real y el doble de
   espacio? Es la decisión de mayor impacto de todo el plan.
2. **Fase D**: ¿se sube el contraste del trazo junto con el
   adelgazamiento?
3. **Fase C**: ¿rework solo de los 47 detectados, o pasada completa por
   los 98 con las reglas nuevas?
4. Sigue abierta §6 P2 (`templates`): sin icono, hoy en PNG a 240px,
   donde este problema de legibilidad no aplica.

**Orden de ejecución propuesto**: A2 (+D) primero — es mecánico y ya
arregla 79 de los 98 iconos —, luego el harness (E), luego decidir B1/B2
viéndolo, y solo después C por tandas y F como cierre.

## 20. Sesión 4 (implementación) — 2 columnas + caja 48px + trazo de 2 pesos

**Estado: implementado, pendiente visto bueno visual del usuario.**
Decisión del usuario: **lista de secciones a 2 columnas** (resuelve la
pregunta 1 de §19.11 a favor de B2, con más margen del previsto).

Antes de empezar se verificó que `main` estaba incorporado:
`origin/main` (`0867398`) es ancestro de `feat/ui-polish-p1` — `git
rev-list --left-right --count origin/main...HEAD` → `0 133`. No había
nada que traer.

### 20.1 Hallazgo de alcance

El drawer solo tiene **dos tabs** (`CATEGORIES` = blocks + templates,
tras el "Point 7" de `EMAIL_BUILDER_TASKS.md`). La lista de secciones
se renderiza al final del tab **Blocks** (`SectionsCategoryContent`), y
**`layouts` / `primitives` no tienen componente de listado en esta UI**.
Consecuencia práctica: de los 98 iconos diseñados, los **13 de
`layouts` no son visibles hoy** en el editor; lo que el usuario ve son
los **85 de `sections`**.

### 20.2 Cambios aplicados

- **`ComponentsLibraryDrawer.tsx`**
  - `SectionsCategoryContent`: `columns={3}` → **`columns={2}`**. Con
    `px: 1.5` en el contenedor (312 − 24 = 288px) y `gap: 0.5` (4px),
    la card pasa de ~93px a **~142px** (contenido ~79px → **~128px**).
    Queda alineado con el grid de bloques base, que ya era de 2
    columnas (`BlocksCategoryContent.tsx`).
  - `height` del preview: 28 → **48** para sections/layouts. Se
    documentó que la rama `template ? 240` es **inalcanzable**
    (`LibraryCard` retorna antes con `.eb-template-card`).
  - `LibrarySkeletonGrid`: `thumbnailHeight` 120 → **48** para
    no-templates; el 120 era herencia del PNG y provocaba salto de
    layout skeleton → card.
- **`thumbnail/LibraryCardThumbnail.tsx`** — `'& svg'` 28×28 →
  **48×48**, con la justificación de la rejilla de píxel en el
  comentario.
- **`thumbnail/sectionIcons.tsx`** — sistema de trazo de **2 pesos**
  exportado como tokens: `SW_HAIRLINE = 1` (2px reales a 48px) y
  `SW_ACCENT = 2` (4px). Base del `strokeProps` 2 → 1. De los 227
  overrides existentes: **193 eliminados** (1 / 1.2 / 1.6 / 1.8, ahora
  iguales al hairline por defecto) y **34 mapeados a `SW_ACCENT`**
  (2.4 / 2.5 / 2.6 / 3 / 3.2 / 4). No queda ningún `strokeWidth`
  numérico suelto en el archivo.

Efecto medible: el trazo base pasa de **2.33px a 2px** en absoluto pero
de **8.3% a 4.2% del lado del icono** en relativo — es decir, la mitad
de peso relativo, que es lo que separa los trazos —, y cada detalle
mide el doble en píxeles (una franja de 4 u pasa de 4.7px a 8px).

### 20.3 Lo que este cambio NO arregla

La separación entre trazos es **relativa**, así que escalar no la
mejora: los iconos con gap < 2 u siguen necesitando rework geométrico
(Fase C, §19.6). Con el trazo a 1 u el umbral de colisión baja de 2 u a
1 u, así que:

- **31 iconos** con gap 1–2 u pasan de "fusionados" a **"trazos que se
  tocan sin blanco entre medio"** — mejor, no resuelto.
- **16 iconos** con gap < 1 u (los 19 CRIT menos los 3 solapamientos
  intencionales) siguen solapando.

### 20.4 Verificación

- `npm run check` (astro check, 339 archivos) → **0 errores, 0
  warnings, 3 hints** (los mismos preexistentes de
  `AutomationBuilder.tsx`).
- `npx vitest run` → **44/44 archivos, 314/314 tests** (la línea base
  documentada de 43/303 creció por trabajo ajeno a este cambio).
- `prettier --check` limpio en los 3 archivos tocados. `eslint` los
  ignora por estar bajo `packages/` (vendored).
- Sin verificación visual: no hay MCP de Chrome en este entorno (§1).
  **Falta la captura del usuario.**

### 20.5 Siguiente paso

1. **Captura del usuario** del tab Blocks con las secciones a 2
   columnas. Dos cosas a juzgar ahí: si el peso de trazo ya se lee, y
   si el tono `--pb-chrome-text-faint` (#a5a39a, ≈2.5:1 sobre blanco)
   aguanta con el trazo más fino o hay que subirlo (§19.7, Fase D — es
   un cambio de una línea).
2. Con eso aprobado, Fase C por tandas: primero los 16 CRIT.
3. Fase E (harness) y F (test de constraints) siguen pendientes.

## 21. Fase C · tanda `banner` (5 iconos) — rework geométrico

**Estado: implementado, pendiente visto bueno visual del usuario.**
Primera tanda de la Fase C (§19.6), ejecutada con subagentes
(análisis → rediseño → auditoría). Ver §21.3: la auditoría automática
descarriló y hubo que reconstruir trabajo ya aprobado.

### 21.1 Datos reales del catálogo (verificados en `localPresets.data.json`)

Lo que el árbol de bloques dice de estos 5 items, y que el set anterior
no representaba:

| Icono | Dato real relevante |
|---|---|
| Announcement mobile-tight | `Container > NotionText`, `backgroundColor: #111827` |
| Announcement bar | idéntico al anterior; en el dato solo difiere `mobilePadding` |
| Cornered sale card | `shape: {topLeft: 24, topRight: 0, bottomLeft: 0, bottomRight: 24}` + `Button.fullWidth: true` |
| Promo CTA | `shape` uniforme (16 en las 4 esquinas) + `Button.fullWidth: false` |
| Sale banner | único `banner` con `ColumnsContainer` (`fixedWidths: [60, 40]`) + `fullWidth: true` |

**Los 5 tienen fondo oscuro `#111827`**, así que el relleno tenue
(`fill="currentColor" fillOpacity={0.08}`) que antes solo se usaba para
"fondo con imagen" aquí es fiel al dato, no decoración.

### 21.2 Qué cambió en cada icono

- **#1 / #2 (Announcement)** — estructuralmente idénticos en el dato, así
  que el par se distingue por **un** rasgo: #1 franja a sangre sin radio
  (1.5 → 22.5), #2 card con margen lateral y `rx` (4 → 20). Ambos con el
  relleno del fondo oscuro. 2 formas cada uno.
- **#3 Cornered sale card** — el icono anterior dibujaba un `rect` de
  radio uniforme con un recorte en la esquina, que no era la forma real.
  Ahora es un `path` con arcos **solo en top-left y bottom-right** (el
  `shape` real), badge en esquina y botón a todo el ancho útil.
- **#4 Promo CTA** — mismo footprint que #3 a propósito (21×21), radio
  uniforme y pill centrado más angosto: las **únicas** diferencias con
  #3 son las esquinas y el ancho del botón, que es exactamente lo que
  los diferencia en el dato.
- **#5 Sale banner** — pasa de "texto apilado + chip" a representar el
  split de 2 columnas real: dos líneas de texto a la izquierda y el chip
  de precio/CTA a la derecha, alineado con la primera línea.

Se descartó una flecha/chevron que un subagente había añadido a #1/#2:
esos bloques no tienen `Button` ni link en el árbol, y el rasgo
diferenciador del par ya era el margen.

Medición final (script propio, ejecutado y borrado):

| Icono | formas | gap X | gap Y | fuera de rejilla 0.5 |
|---|---|---|---|---|
| Announcement mobile-tight | 2 | 21 | 2.5 | 0 |
| Announcement bar | 2 | 16 | 3.5 | 0 |
| Cornered sale card | 4 | 5 | 2.0 | 0 |
| Promo CTA | 4 | 7 | 2.5 | 0 |
| Sale banner | 4 | 2.0 | 3.5 | 0 |

Todos cumplen el contrato: ≥2u de separación en ambos ejes, ≤8 formas,
coordenadas en múltiplos de 0.5, geometría dentro de [1.5, 22.5] y cero
`strokeWidth` numéricos en el archivo completo.

Nota de contrato añadida al docstring de `SW_ACCENT`: **no usarlo en
formas de menos de ~3u de grosor** — un trazo de 2u dentro de un rect de
2u lo rellena por completo. Por eso los botones de #3/#4 van en hairline
y se distinguen por ancho, no por peso.

### 21.3 Incidente del pipeline de subagentes (para no repetirlo)

El auditor automático no tenía el contexto de que §20 (caja 48px, grid
de 2 columnas, normalización global del trazo) **ya estaba implementado
y aprobado** en el working tree, lo interpretó como fuga de alcance de
la tanda `banner`, y el implementador **revirtió** esos cambios:
`ComponentsLibraryDrawer.tsx` y `LibraryCardThumbnail.tsx` volvieron a
HEAD y `sectionIcons.tsx` quedó con `SW_HAIRLINE = 2` / `SW_ACCENT = 4`
y los 93 iconos restantes con sus 11 pesos ad-hoc otra vez.

Reconstruido a mano después: constantes a 1/2, renormalización (192
overrides eliminados + 34 a `SW_ACCENT`), caja 48px, 2 columnas y
skeleton a 48. El trabajo geométrico de los 5 banner sí se conservó.

**Lección**: al delegar una tanda, el brief del auditor tiene que
declarar explícitamente qué cambios NO commiteados del working tree son
trabajo aprobado previo, o el auditor los leerá como fuga de alcance. Y
ningún subagente debe revertir archivos que no creó sin confirmarlo.

### 21.4 Verificación

- Diagnósticos LSP de `sectionIcons.tsx`: **0**.
- `prettier --check` limpio en los 3 archivos tocados.
- Script propio de constraints: los 5 banner PASS (tabla de §21.2).
- Sin `vitest` / `astro check` en esta tanda por pedido explícito del
  usuario (tardan demasiado para el ciclo de revisión por tanda); la
  corrida completa se hará al cerrar varias tandas.
- Falta la **captura del usuario**: no hay MCP de Chrome en este entorno
  (§1).
