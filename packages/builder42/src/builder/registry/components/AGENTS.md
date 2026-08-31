# AGENTS-COMPONENTS.md

Lineamientos para crear **componentes nuevos** del page builder. Todo componente se
registra como un `ComponentDefinition` — el core no conoce los tipos (P4). Este documento
define las reglas, convenciones y checklist que aplican a CUALQUIER componente futuro.

Léelo antes de crear un componente nuevo. Las reglas generales del proyecto siguen viviendo
en [`AGENTS.md`](../../../../AGENTS.md). El plan de implementación de los próximos
componentes (`select`, `language-nav`) y los controles de Inspector que necesitan viven en
[`docs/14-form-components.md`](../../../../docs/14-form-components.md).

---

## 1. Categorías

Todo componente declara una `category` en su definición:

```ts
type ComponentCategory = "layout" | "content" | "form" | "navigation";
```

| Categoría | Qué incluye | Ejemplos |
|-----------|-------------|----------|
| `layout` | Estructurales, aceptan hijos, definen el flujo | `container` |
| `content` | Muestran contenido estático (texto, imágenes, CTAs) | `text`, `image`, `button` |
| `form` | Elementos de formulario interactivos (inputs, selects) | `select`, (futuro: `input`, `textarea`, `checkbox`) |
| `navigation` | Navegación del sitio (menús, breadcrumbs, idioma) | `language-nav`, (futuro: `nav-menu`, `breadcrumb`) |

**Reglas:**
- La categoría es **obligatoria** en componentes nuevos (los 4 existentes la declaran
  retroactivamente al implementar esta feature).
- Si un componente no encaja en ninguna, se agrega una categoría nueva — documentar aquí.
- El sidebar del editor agrupa los componentes por categoría con un header visual.

---

## 2. Tokens por defecto — vinculación obligatoria

**Principio:** todo componente —**actual o nuevo**— DEBE vincular sus estilos de
presentación relevantes para la **coherencia visual** (fondos, color de texto, bordes) a
tokens semánticos del sitio en su `defaultStyle`. No hace falta ligar TODAS las
propiedades (un `padding` o un `gap` puntual puede ser un valor fijo), pero **fondo, texto
y borde sí**: son lo que un tema remapea para dar identidad visual. Así, cambiar un token
—o aplicar un tema— propaga el cambio a todo el sitio sin tocar cada nodo.

> **Estado (Fase 9):** los componentes existentes ya fueron auditados y ligados —
> `container` (fondo `colors.surface.alt`, radio `radii.md`), `text` (color `colors.text`),
> `button` (fondo `colors.primary.default`, texto `colors.primary.on`, radio `radii.md`),
> `select` y `language-nav` (fondo/texto/bordes/tipografía). Un componente nuevo que
> hardcodee un color de fondo/texto/borde se considera **incompleto**.

### 2.1 Tokens semánticos base — garantizados por el sistema

Los tokens base están definidos en `model/tokens.ts` (`BASE_TOKENS`) y son **garantía del
sistema**: todo sitio nuevo los incluye automáticamente (`createSiteFromDocument`,
`migrateDocToSite`), y el store **impide que el usuario los borre** (las acciones
`removeToken`/`removeTypographyToken`/`removeFontFamily` son no-op para tokens base). El
usuario PUEDE editar su valor (cambiar `#ffffff` por `#f8f9fa`), pero la CLAVE siempre
existe.

**Consecuencia para componentes:** al referenciar un token base en `defaultStyle`, el
componente tiene la **certeza** de que ese token existe en cualquier sitio. Nunca verá el
badge "token ✗ (roto)" para un token base — a diferencia de tokens custom que el usuario
podría no haber creado.

| Token path | Grupo | Valor por defecto | Uso típico en componentes |
|------------|-------|-------------------|---------------------------|
| `colors.surface.default` | colors | `#ffffff` | Fondo de inputs, cards, superficie base / página |
| `colors.surface.alt` | colors | `#f9fafb` | Superficie SECUNDARIA, distinta de la base (contenedores/secciones que deben destacar sobre la página) |
| `colors.text` | colors | `#1a1a1a` | Texto principal |
| `colors.border` | colors | `#e2e8f0` | Bordes de inputs, separadores |
| `colors.primary.default` | colors | `#2563eb` | Acento, enlaces, estados activos |
| `colors.primary.on` | colors | `#ffffff` | Texto/icono SOBRE `colors.primary.default` (label de botón) |
| `colors.muted` | colors | `#6b7280` | Texto secundario, placeholders |
| `spacing.xs` | spacing | `4px` | Gaps mínimos |
| `spacing.sm` | spacing | `8px` | Padding interno, gaps |
| `spacing.md` | spacing | `16px` | Padding de secciones |
| `spacing.lg` | spacing | `24px` | Márgenes entre secciones |
| `radii.sm` | radii | `4px` | Bordes redondeados sutiles |
| `radii.md` | radii | `8px` | Bordes redondeados medios |
| `shadows.sm` | shadows | `0 1px 2px rgba(0,0,0,0.05)` | Sombra sutil de cards |
| `sizes.container` | sizes | `1200px` | Ancho máximo de contenido |
| `typography.families.sans` | typography | `Inter, system-ui, sans-serif` | Tipografía base |
| `typography.sizes.sm` | typography | `14px` | Texto pequeño (labels) |
| `typography.sizes.base` | typography | `16px` | Tamaño de texto base |
| `typography.sizes.lg` | typography | `20px` | Texto grande (subtítulos) |
| `typography.weights.regular` | typography | `400` | Peso normal |
| `typography.weights.bold` | typography | `700` | Peso negrita |
| `typography.lineHeights.tight` | typography | `1.25` | Interlineado compacto |
| `typography.lineHeights.normal` | typography | `1.5` | Interlineado normal |

### 2.2 Cómo vincular en `defaultStyle`

Los tokens se **definen** como objetos anidados en `BASE_TOKENS` (`colors: { surface: {
default, alt }, primary: { default, on }, … }`) y se **referencian** por su ruta con puntos
(`{ token: "colors.surface.default" }`). `flattenTokens` aplana el árbol a esas rutas; una
clave con puntos y valor string es equivalente (retrocompat).

Usa la sintaxis `{ token: "ruta.del.token" }` en cualquier campo de estilo:

```ts
defaultStyle: {
  base: {
    appearance: {
      background: { token: "colors.surface.default" },
      color: { token: "colors.text" },
      borderRadius: { token: "radii.sm" },
    },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
    },
    spacing: {
      padding: { token: "spacing.sm" },
    },
  },
}
```

**En el canvas:** se resuelve a `var(--colors-surface-default)` vía `styleValueToCss`. El
`TokensStyle` inyecta las definiciones **scopeadas al frame del canvas**
(`.pb-canvas__frame`, NO a `:root`), de modo que el tema/tokens afectan solo a la página que
se construye y **nunca al chrome del editor** (aislamiento, docs/11 §6). El navegador resuelve
la variable dentro del frame.

**En el export:** el CSS de clase emite `var(--colors-surface)`, y `tokens.css`/`themes.css`
definen las custom properties en `:root`/`[data-theme]` (ahí `:root` ES la página). Cambiar
el valor del token —o el tema activo— actualiza TODO sin tocar los archivos de las páginas.

### 2.3 Qué tokens usar para cada tipo de estilo

| Propiedad CSS | Token recomendado | Notas |
|---------------|-------------------|-------|
| `background` (superficies) | `colors.surface.default` | Para inputs, cards, modales, fondo de página |
| `background` (superficie destacada) | `colors.surface.alt` | Contenedores/secciones que deben distinguirse del fondo (ver §2.7) |
| `background` (acento) | `colors.primary.default` | Botones primarios, highlights |
| `color` (texto) | `colors.text` | Texto principal |
| `color` (sobre acento) | `colors.primary.on` | Label de botón sobre `colors.primary.default` |
| `color` (secundario) | `colors.muted` | Placeholders, hints |
| `border-color` | `colors.border` | Bordes de inputs y separadores. **Usa `borderColor` (+`borderWidth`/`borderStyle`), NO el shorthand `border`** — el shorthand no acepta color-token (ver §2.7) |
| `padding` (interno) | `spacing.sm` | Inputs, pills |
| `padding` (secciones) | `spacing.md` | Contenedores, panels |
| `gap` | `spacing.sm` o `spacing.xs` | Entre elementos hermanos |
| `border-radius` | `radii.sm` o `radii.md` | Esquinas redondeadas |
| `font-family` | `typography.families.sans` | Tipografía base |
| `font-size` (body) | `typography.sizes.base` | Texto normal |
| `font-size` (small) | `typography.sizes.sm` | Labels, captions |
| `font-weight` (normal) | `typography.weights.regular` | Texto normal |
| `font-weight` (énfasis) | `typography.weights.bold` | Títulos, énfasis |
| `line-height` | `typography.lineHeights.normal` | Flujo de texto |
| `max-width` (contenido) | `sizes.container` | Wrapper de página |

### 2.4 El usuario siempre puede desvincular

El toggle "valor libre ↔ token" del Inspector (ya implementado, docs/08 §5) permite que
el usuario desconecte un campo de su token y ponga un valor fijo. Esto es por-nodo, no
afecta a los demás. Vincular por defecto garantiza coherencia out-of-the-box; el usuario
personaliza cuando lo necesita.

### 2.5 El usuario puede agregar tokens custom

El usuario puede crear tokens adicionales (ej: `colors.accent`, `spacing.xxl`,
`typography.families.mono`) desde el `TokensEditor` sin restricción. Los componentes
pueden referenciarlos si el diseño lo requiere, pero NO deben usarlos en `defaultStyle`
(no se garantizan en todos los sitios — solo los tokens base lo están).

**Regla:** `defaultStyle` SOLO referencia tokens de `BASE_TOKENS`. Tokens custom van
como sugerencia en la documentación del componente, no como default.

### 2.6 Theme system (Fase 9, implementado)

Los tokens semánticos son la capa que un **tema** remapea (`site.meta.themes`, docs/11). El
componente no cambia: referencia `colors.primary`/`colors.onPrimary`/`colors.surface`… y el
tema decide qué valor concreto tienen en esa página. La vinculación por defecto hace que el
theming (incluida la **galería de presets** claro/oscuro/sepia/… y el `prefers-color-scheme`
automático) funcione **gratis** para todo componente que siga esta convención.

- **Preview en el editor:** el tema activo (`activeThemeId`) se aplica con `data-theme` en el
  frame del canvas; `TokensStyle` emite los bloques `.pb-canvas__frame[data-theme="…"]`.
  Por eso el tema **no** debe filtrarse al chrome (§2.2): un componente que hardcodee colores
  no reaccionará al tema y romperá la coherencia.
- **Chequeo de contraste:** el editor avisa (WCAG AA) sobre el par texto/superficie del tema.
  Si tu componente introduce un par nuevo relevante (p. ej. `onPrimary`/`primary`), procura
  que los presets lo mantengan legible.

### 2.7 Antipatrones de coherencia visual (aprende de errores reales)

Errores detectados en componentes existentes y ya corregidos — todo componente nuevo debe
evitarlos:

- **Color hardcodeado en `defaultStyle`.** Nunca pongas un hex fijo para fondo, texto o
  borde (`background: "#f9fafb"`, `color: "#111827"`, `border: "1px solid #e2e8f0"`). No
  reacciona a los tokens ni a los temas → rompe la coherencia. Bug real: `container`, `text`
  y `button` nacieron con colores fijos; `select` con un borde fijo. Liga siempre a tokens.

- **Superficie sobre superficie invisible.** Si tu componente pinta un fondo que puede
  coincidir con el de su contenedor/página (ambos `colors.surface`), quedará **invisible**.
  Bug real: `container` con `colors.surface` sobre una página `colors.surface` desaparecía.
  Solución: usa **`colors.surfaceAlt`** para superficies que deben destacar sobre el fondo
  (contenedores, secciones, cards), o dale un **borde ligado a `colors.border`** para
  definirlo. Regla: un fondo "de superficie destacada" → `surfaceAlt`; un input/control que
  se distingue por borde → `surface` + `borderColor: {token:"colors.border"}`.

- **Borde con el shorthand `border`.** El shorthand (`border: "1px solid …"`) NO puede
  llevar un color-token: `{ token }` resolvería a `border: var(--…)` (sin ancho ni estilo).
  Para un borde token-coherente usa las sub-propiedades `borderWidth` + `borderStyle` +
  `borderColor: { token: "colors.border" }` (docs: `AppearanceStyle`). Bug real: el borde
  fijo del `select` no seguía al tema (borde claro en tema oscuro).

- **Par de contraste ilegible.** Si introduces un par fondo/texto nuevo (p. ej. un botón con
  `primary`/`onPrimary`), asegúrate de que los presets (`model/themePresets.ts`) lo mantengan
  legible — hay un test que verifica contraste WCAG AA por preset.

---

## 3. Checklist para crear un componente nuevo

Antes de empezar a codear, verifica estos puntos:

### 3.1 Diseño

- [ ] Definir `type`, `category`, `label`, `acceptsChildren`.
- [ ] Definir `defaultProps` con valores razonables.
- [ ] Definir `defaultStyle` vinculado a tokens base (§2), evitando los antipatrones de
      §2.7 (color hardcodeado, superficie sobre superficie invisible, borde con shorthand).
- [ ] Definir `propsSchema` con los controles del Inspector.
- [ ] Si necesita un control nuevo en el Inspector, diseñarlo primero y documentar en
      `docs/14-form-components.md` (no en este archivo).
- [ ] Si necesita datos del sitio (como `language-nav` necesita `i18n`), definir qué
      campo de `RenderContext` lo provee — documentar en `docs/14`.

### 3.2 Implementación

- [ ] Crear `registry/components/<Type>.tsx` con la `ComponentDefinition`.
- [ ] Registrar en `componentRegistry.ts` (importar + agregar al array `DEFINITIONS`).
- [ ] Un solo `render()` — canvas y export usan el mismo código (P3).
- [ ] `rootRef` + `rootProps` en el elemento raíz, sin wrapper (docs/02 §10.3).
- [ ] `style` inline solo en `!exportMode`; en `exportMode` es `undefined` (el CSS de
      clase lo pone el serializer). **Nunca** valores fijos en `style` del render
      (`AGENTS.md §5`, bug real del Button).
- [ ] Todo estilo de presentación "propio del tag" va en `defaultStyle.base`, nunca
      hardcodeado en el render.
- [ ] Si `acceptsChildren`, manejar el caso vacío (drop zone, estado placeholder).

### 3.3 i18n

- [ ] Agregar `common.components.<type>` a los 3 JSONs de traducción (es/en/it).
- [ ] Los labels de `propsSchema` van como claves de i18n si son visibles al usuario
      (hoy se usa el string directo del schema — decidir si migrar a i18n es tarea
      aparte; por ahora en español, igual que los existentes).
- [ ] Si el componente tiene props traducibles (contenido de texto), marcar
      `translatable: true` en los `FieldSchema` correspondientes.

### 3.4 Tests

- [ ] Test unitario del `render` (canvas mode + export mode).
- [ ] Test de integración con `exportToHtml` / `exportSite` si el componente tiene
      lógica especial de export (como `language-nav` que necesita `localeInfo`).
- [ ] Verificar que el export sin el componente sigue idéntico (no regresiones).

### 3.5 Verificación

- [ ] `pnpm typecheck` — limpio.
- [ ] `pnpm test` — verde.
- [ ] El componente aparece en el sidebar (categoría correcta).
- [ ] Se puede arrastrar al canvas, editar sus props, y el export produce HTML válido.
- [ ] Los tokens vinculados se reflejan en canvas y en export (`var(--…)`).

---

## 4. Estructura de archivos

```
src/builder/registry/components/
  Container.tsx       # layout
  Text.stub.tsx       # content
  Image.tsx           # content
  Button.tsx          # content
  Select.tsx          # form (próximo)
  LanguageNav.tsx     # navigation (próximo)
```

Un archivo por componente. Tests al lado (`<Type>.test.tsx`).

---

## 5. Principios transversales (recordatorio)

Estos principios de `AGENTS.md` aplican especialmente a componentes nuevos:

| # | Principio | Aplicación a componentes |
|---|-----------|--------------------------|
| P3 | Un solo `render()` | Canvas y export usan la misma función — **sin** branches `if (mode === "canvas")` para lógica de presentación (solo para `style` inline vs className). |
| P4 | El core no conoce tipos | Registrar la definición; no tocar `NodeRenderer`, `exportToHtml`, ni `dnd/`. |
| P6 | Estilo ≠ props | `props` = qué hace/contiene. `style` = cómo se ve. Los tokens van en `style`, no en `props`. |
| P8 | Export sin runtime | El HTML exportado no importa nada del builder ni de React. |
| P9 | Todo string visible se traduce | Labels, placeholders, texto de UI — i18n. |

---

## 6. Roadmap de componentes nuevos

El plan detallado de implementación (controles de Inspector, `RenderContext`, etc.) vive
en [`docs/14-form-components.md`](../../../../docs/14-form-components.md).

| Prioridad | Componente | Categoría | Notas |
|-----------|-----------|-----------|-------|
| 🔴 Alta | `select` | form | Base reutilizable. Necesita control `options-list` (docs/14 §1). |
| 🔴 Alta | `language-nav` | navigation | Vinculado a `site.meta.i18n`. Cierra la Fase 7b (docs/14 §2). |
| 🟡 Media | `input` | form | Text/email/number. Similar al select en tokens. |
| 🟡 Media | `textarea` | form | Multiline. |
| 🟡 Media | `nav-menu` | navigation | Árbol de enlaces a páginas internas. |
| 🟢 Baja | `video` | content | Embed de YouTube/Vimeo. |
| 🟢 Baja | `divider` | layout | `<hr>` con tokens. |
| 🟢 Baja | `spacer` | layout | Altura configurable. |
