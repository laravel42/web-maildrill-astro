# Plan de migración — `<select>` nativos → dropdown estilizado (Maildrill/c42)

**Estado: ✅ MIGRACIÓN COMPLETADA** (ejecutada en la sesión siguiente a este
análisis). Los 25 `<select>` nativos catalogados abajo fueron reemplazados.
Ver §8 para el resumen de la implementación real.

## 1. Problema

La mayoría de los controles de "selección" del chrome del builder
(`packages/builder42`) son `<select>` HTML nativos. Visualmente no coinciden
con el resto de la interfaz de Maildrill, que usa un dropdown custom
(trigger + panel flotante con opciones), ni con el resto del propio chrome
del builder, donde una minoría de selectores **ya fue migrada** al mismo
patrón custom.

## 2. Patrón objetivo (ya existe en producción, no hay que diseñarlo)

Componente `Select` de `@josecortez1/c42-react`, usado hoy en 4 archivos de
`builder42`:

- `src/components/LanguageSelect.tsx`
- `src/components/ContentLocaleSelect.tsx`
- `src/builder/inspector/controls/LocaleQuickAccess.tsx`
- `src/app/layout/PageBreadcrumb.tsx` (×2 usos)

Markup de referencia (extracto real de `LanguageSelect.tsx`):

```tsx
import { Select } from "@josecortez1/c42-react";

<Select defaultValue={current} onChange={handleChange} className="pbx-lang">
  <button data-c42-select-trigger className="pbx-lang__trigger" aria-label={...}>
    {/* label + ChevronDown */}
  </button>
  {/* data-c42-select-listbox + data-c42-select-option por cada opción,
      ver el archivo completo para el resto del markup */}
</Select>
```

Atributos clave: `data-c42-select-trigger`, `data-c42-select-listbox`,
`data-c42-select-option`, `aria-selected="true"` en la opción activa. El CSS
de este patrón vive tokenizado (`pbx-*`, variables `--pb-chrome-*`) y ya
resuelve accesibilidad (roles ARIA, teclado) vía la librería.

**Decisión de la migración:** replicar literalmente este patrón para los
`<select>` nativos restantes, no diseñar un componente nuevo. Para listas
largas (>15 opciones), evaluar si conviene además el patrón de
`SearchableSelectControl.tsx` (ya existe en `builder42/src/builder/inspector/
controls/SearchableSelectControl.tsx`, combobox con filtro en vivo — usado
hoy solo por el campo "Icono") en vez del `Select` simple.

Referencia externa del lado del host Astro (mismo espíritu, otra librería):
`src/components/react/shared/SearchableSelect.tsx` — combobox con
`role="listbox"`, trigger + input de búsqueda + `<ul>` de opciones,
usado por ejemplo para timezones/monedas. No es el componente a usar dentro
de `builder42` (ese usa c42-react), pero confirma que Maildrill nunca usa
`<select>` nativo visible en su propia UI de app.

## 3. Inventario — `<select>` nativos a migrar (`packages/builder42`)

26 `<select>` nativos encontrados fuera de los 4 ya migrados. Todos usan la
clase base `.pbx-control__input`, pero solo ~13 de 26 llevan además el
modificador `--select` (el único que tiene el fix de `appearance: none` +
flecha custom aplicado en la auditoría anterior, ver
`native-input-chrome-audit.md`). Es decir: incluso antes de migrar al
dropdown custom, hay ya una inconsistencia visual *entre selects nativos
entre sí* (con/sin flecha custom, con/sin appearance reset).

| # | Archivo | Línea | Descripción | # opciones aprox | Clase CSS actual | Contexto |
|---|---|---|---|---|---|---|
| 1 | `NodeClickActionSection.tsx` | 171 | Tipo de acción de click del nodo | 5-15 | `pbx-control__input pbx-control__input--select` | Panel props, tab Interactividad |
| 2 | `NodeClickActionSection.tsx` | 186 | Elegir modal objetivo | <5 | `pbx-control__input pbx-control__input--select` | Panel props, tab Interactividad |
| 3 | `panel/controls/BorderSimple.tsx` | 139 | Grosor de borde (0/1/2/4px) | 4 | `pbx-control__input pbx-border-simple__width` | Panel de estilo, fila border simple |
| 4 | `panel/controls/BorderSimple.tsx` | 151 | Tipo de trazo (solid/dashed/dotted) | 3 | `pbx-control__input pbx-border-simple__style` | Panel de estilo, fila border simple |
| 5 | `panel/StylePanel.tsx` | 795 | Token picker inline | moderadas | `pbx-control__input pbx-control__input--token-pick` | Panel de estilo |
| 6 | `panel/StylePanel.tsx` | 894 | Control genérico `case "select"` (overflow, position, cursor…) | variable | `pbx-panel-field pbx-control__input` (**sin** `--select`) | Panel de estilo, filas dinámicas |
| 7 | `panel/StylePanel.tsx` | ~936 (`renderLeafControl`) | Select para mitades de fila `pair` | variable | `pbx-control__input` (**sin** `--select`) | Panel de estilo, filas pair |
| 8 | `ThemesEditor.tsx` | 292 | Preview: tema activo | 5-15 | `pbx-control__input` (**sin** `--select`) | Config de sitio (Temas) |
| 9 | `ThemesEditor.tsx` | 373 | Tema del que "extiende" | 5-15 | `pbx-control__input` (**sin** `--select`) | Config de sitio (Temas) |
| 10 | `ThemesEditor.tsx` | 391 | Color scheme (auto/light/dark) | 3 | `pbx-control__input` (**sin** `--select`) | Config de sitio (Temas) |
| 11 | `controls/LinkField.tsx` | 59 | Tipo de enlace (interno/externo/ancla) | 3 | `pbx-control__input` | Panel props, campo link |
| 12 | `controls/LinkField.tsx` | 72 | Página interna objetivo | moderadas | `pbx-control__input` | Panel props, campo link |
| 13 | `controls/NodeTargetPicker.tsx` | 87 | Nodo objetivo (scroll-to + preset) | puede ser >15 | `pbx-control__input pbx-control__input--select` | Panel props, dentro de NodeClickActionSection |
| 14 | `controls/OptionsSchemaField.tsx` | 74 | Selector de tema (`theme-select`) | pocas | `pbx-control__input pbx-control__input--select` | Motor de campos compartido |
| 15 | `controls/OptionsSchemaField.tsx` | 90 | Select genérico de `optionsSchema` | variable | `pbx-control__input pbx-control__input--select` | Motor de campos compartido |
| 16 | `controls/StateStyleField.tsx` | 105 | Token picker inline (eje estado) | moderadas | `pbx-control__input pbx-control__input--token-pick` | Panel de estilo, eje estado |
| 17 | `controls/StateStyleField.tsx` | 148 | Select genérico por estado | variable | `pbx-control__input` (**sin** `--select`) | Panel de estilo, eje estado |
| 18 | `controls/StyleField.tsx` | 153 | Token picker inline (legacy) | moderadas | `pbx-control__input pbx-control__input--token-pick` | `form/StyleSection.tsx` legacy |
| 19 | `controls/StyleField.tsx` | 200 | Select genérico (legacy) | variable | `pbx-control__input` (**sin** `--select`) | `form/StyleSection.tsx` legacy |
| 20 | `TranslationModal.tsx` | 411 | Página a traducir | moderadas | `pbx-control__input pbx-translation-table__locale-select` | Modal traducción |
| 21 | `TranslationModal.tsx` | 427 | Locale a traducir | pocas | `pbx-control__input pbx-translation-table__locale-select` | Modal traducción |
| 22 | `controls/propControls/registry.tsx` | 57 | Renderer genérico select de props de componente | variable | `pbx-control__input pbx-control__input--select` | Panel de propiedades |
| 23 | `form/StateSelector.tsx` | 26 | "Estado: Normal / Seleccionado…" | <5 | `pbx-control__input pbx-control__input--select` | Panel de estilo legacy |
| 24 | `PageManager.tsx` | 186 | Tema por página | 5-15 | `pbx-control__input` (**sin** `--select`) | Config de sitio (gestor páginas) |
| 25 | `panel/PropertyField.tsx` | ~257 | Token picker inline (versión unificada) | moderadas | `pbx-panel-field pbx-control__input` | Panel de propiedades unificado |

Nota de verificación pendiente: al iniciar la migración, releer
`NodeTargetPicker.tsx` para confirmar cuántos `<select>` reales tiene (el
inventario detectó 1 en línea 87 — no confundir con el `<input
type="search">` del mismo archivo, ya corregido en la auditoría de chrome
nativo, `native-input-chrome-audit.md`).

Archivos de la lista original que **NO tienen `<select>` propio** (falsos
positivos del grep inicial, confirmados por lectura):
- `PairGrid.tsx` — primitiva pura de layout, sin `<select>`.
- `PropertyRow.tsx` — primitiva pura, los matches eran solo comentarios.

## 4. Ya migrados — usar como referencia, no tocar

- `LocaleQuickAccess.tsx`
- `ContentLocaleSelect.tsx`
- `LanguageSelect.tsx`
- `PageBreadcrumb.tsx` (×2)

## 5. Fuera de alcance (confirmado, no son `<select>` nativos del chrome)

- `builder/registry/components/Select.tsx` — componente de **render de
  canvas/output** (usa `RenderContext`, `uiRuntime:"select"`): es el `<select>`
  que ve el visitante final del sitio publicado por el usuario, no chrome del
  editor. No debe migrarse a c42 — su estilo lo define el propio
  usuario/tema del sitio.
- Todos los `<Select>` de `email-builder-standalone` (`SocialMediaInput.tsx`,
  `BackgroundImageInput.tsx`, `ImageSidebarPanel.tsx`, `FontFamily.tsx`,
  `LineHeightInput.tsx`) — son el wrapper `./components/Select` sobre
  **MUI** `Select`, ya completamente estilizado (ícono propio, menú custom).
  No aplica.
- Todos los `<Select>`/`<SelectTrigger>` de `wa-template-studio`
  (`buttons/advanced.tsx`) — son **Radix UI** `Select`, ya custom-estilizado.
  No aplica.
- `merge-tag-menu` — no tiene ningún `<select>`.
- `email-builder-standalone/src/documents/editor/EJEMPLO_USO_GRANULAR.tsx`
  (líneas 112, 152, 267: 1 `<select>` + 2 `<input type="checkbox">`) —
  código huérfano, 0 imports en el paquete, no se renderiza nunca. No
  requiere migración, pero si se usa como plantilla en el futuro, no
  replicar sus controles sin estilizar.

## 6. Otros controles de "estilo totalmente diferente" detectados

Fuera de los `<select>`, se buscó cualquier otro control que dependa 100%
del estilo nativo del navegador o que rompa el patrón `pbx-*`/tokens del
design system:

- **`<input type="radio">`**: ninguno en `builder42` ni en los otros 3
  paquetes auditados. No aplica.
- **`<input type="range">`**: ninguno en ningún paquete. No aplica.
- **`<input type="checkbox">` en `builder42`**: una sola instancia real, en
  `components/Toggle.tsx` — ya envuelta como switch custom
  (`pbx-switch__track`/`__thumb`, tokens `--pb-chrome-*`). Es el wrapper
  oficial del design system, no una inconsistencia.
- **`<input type="checkbox">` en `email-builder-standalone`**: 2 instancias,
  ambas dentro de `EJEMPLO_USO_GRANULAR.tsx` (código huérfano, ver §5).
- **`wa-template-studio`**: los `checkbox`/`radio` que existen son
  `DropdownMenuCheckboxItem`/`DropdownMenuRadioItem` de Radix — ya
  custom-estilizados, no aplican.
- **Colores hex hardcodeados a negro/gris muy oscuro fuera de contexto**:
  - `email-builder-standalone/src/global.css:763` —
    `.react-colorful__saturation { border-bottom: 1px solid black !important; }`.
    Ya evaluado en la auditoría anterior: es un ajuste cosmético intencional
    de la librería de terceros `react-colorful`, no un bug de tema. Deuda
    menor, no requiere acción.
  - `email-builder-standalone/src/theme.ts` — usa `#000`/`#111` extensamente
    (~29 veces) pero siempre como `contrastText` de paleta MUI o dentro de
    `alpha(..., 0.1–0.6)` para `boxShadow`/elevación — es theming Material
    Design estándar, no un `border`/`outline` suelto sin token. No aplica.
  - `wa-template-studio/src/styles/studio.css` líneas 202/262/629 — hex
    `#e4e2da` ya documentado en `native-input-chrome-audit.md` como deuda
    menor intencional (self-containment del dev harness standalone). Sin
    hallazgos *nuevos* de hex oscuro en este paquete.
  - `merge-tag-menu/src/merge-tag-menu.css` — usa `#1f1e1b` como `color`
    (líneas 20, 97): es el token de marca `--text` replicado inline por el
    mismo motivo de self-containment del paquete, no negro genérico de
    borde/outline. No aplica al criterio de esta migración.
- **`components/ColorPicker.tsx`** (`builder42`) — usa `react-colorful` en
  vez del patrón c42, pero es una excepción ya documentada explícitamente en
  el propio comentario de cabecera del archivo (ver AGENTS.md del paquete).
  No es un hallazgo nuevo de esta auditoría; anotado aquí solo para que quede
  registrado junto con el resto de "estilo diferente al resto", por si se
  decide revisitar en el futuro.
- Los ~35 archivos con hex en `builder/registry/components/*` son
  definiciones de **render de canvas/export** (la salida final del sitio del
  usuario) — fuera de alcance, igual que el `Select.tsx` de output en §5.

## 8. Resultado de la implementación

Ejecutado por completo. Resumen de lo realmente hecho (difiere ligeramente
del plan original en 2 decisiones, documentadas abajo):

### Componente nuevo
- `src/components/PbxSelect.tsx` — wrapper genérico sobre `Select` de
  `@josecortez1/c42-react`, API `{ value, options: {value,label,disabled}[],
  onChange, placeholder?, ariaLabel?, id?, className?, disabled? }`. Usa
  `key={value}` en el `<Select>` interno para forzar remount cuando el valor
  cambia por una causa externa (el wrapper de c42-react solo acepta
  `defaultValue`, no un `value` controlado — confirmado leyendo
  `select.types.d.ts`/`Select.d.ts` de `@josecortez1/c42-core`/`c42-react`).
  Exportado desde `src/components/index.ts`.
- CSS namespace `.pbx-nselect*` en `styles/chrome/inspector-controls.css`,
  con los mismos tokens que `.pbx-control__input` (`--pb-chrome-border-strong`,
  `--pb-chrome-surface-raised`, `--pb-chrome-accent`) — visualmente
  consistente con el resto del Inspector (a diferencia de `.pbx-lang`/
  `.pbx-content-locale`, que usan los tokens oscuros del header).

### Decisión 1 — `NodeTargetPicker.tsx` no usa `PbxSelect`
El único `<select>` de este archivo estaba acoplado a un `<input
type="search">` con filtro en vivo y era 100% controlado por `value` externo
(cambia sin remount al seleccionar otro nodo). `Select` de c42-react no
soporta bien ese caso (solo `defaultValue`). Se consolidaron AMBOS controles
(`input search` + `select`) en un único `SearchableSelectControl` (ya
existente en el propio paquete, 100% controlado por React, con filtro
integrado) — mejora neta: 2 controles → 1, y ya no depende de remounts.

### Decisión 2 — token-pickers migrados también
El plan original sugería "dejar los token-pickers si son inputs distintos".
En la implementación se migraron igual (`StateStyleField.tsx`,
`StyleField.tsx`, `PropertyField.tsx`) porque seguían siendo `<select>`
nativos con la misma inconsistencia visual — coherente con el pedido de
migrar "la mayoría de selects nativos". Efecto secundario: se perdió el
`autoFocus` que tenían al abrirse (la librería c42 no expone esa prop
directamente); el usuario sigue pudiendo abrir el dropdown con clic normal,
impacto menor.

### Inventario final migrado (25 `<select>` → `PbxSelect`, salvo 1 caso)
Todos los archivos de §3 quedaron migrados 1:1, confirmado con
`grep '<select\b'` sobre todo `packages/builder42/src` — el único `<select>`
real que queda es `builder/registry/components/Select.tsx` (§5, fuera de
alcance, es el output del sitio publicado, no chrome).

### Verificación
- `npx tsc --noEmit -p tsconfig.json` (desde `packages/builder42`): **0
  errores**.
- `npx astro check` (desde la raíz del repo): **0 errores**, 0 warnings, 2
  hints preexistentes no relacionados con esta migración.
- `npx tsc -p packages/builder42 --noEmit` (desde la raíz, mismo comando que
  usa `npm run typecheck`): **0 errores**.
- El script completo `npm run typecheck` falla en este entorno por un
  problema de resolución de `node_modules/.bin/tsc` vía `npm.ps1` en
  PowerShell — no relacionado con el código; se verificó el comando
  equivalente con `npx` como evidencia alternativa (arriba).
- Se requirió `pnpm install --filter builder42` (61 paquetes, incluía `vite`
  y sus tipos, ausentes en el entorno) para poder ejecutar el typecheck real.

### Archivos tocados
`PbxSelect.tsx` (nuevo), `components/index.ts`, `inspector-controls.css`,
`inspector-panel.css`, `BorderSimple.tsx`, `StylePanel.tsx`,
`StateStyleField.tsx`, `StyleField.tsx`, `PropertyField.tsx`,
`NodeClickActionSection.tsx`, `LinkField.tsx`, `NodeTargetPicker.tsx`,
`OptionsSchemaField.tsx`, `propControls/registry.tsx`, `ThemesEditor.tsx`,
`PageManager.tsx`, `TranslationModal.tsx`, `StateSelector.tsx`.

### Deuda menor dejada para después (no bloquea esta migración)
- La clase `.pbx-node-target-picker__search` (CSS del `<input type="search">`
  que existía en `NodeTargetPicker.tsx`) quedó huérfana tras la Decisión 1 —
  candidata a limpieza en un futuro pase de CSS.
- `.pbx-control__input--select` (el fix de `appearance:none` de la auditoría
  anterior) queda sin ningún consumidor real tras esta migración, salvo que
  algún código externo al Inspector lo use — no se eliminó por precaución,
  queda como CSS muerto candidato a limpieza.

