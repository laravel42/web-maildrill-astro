# Auditoría — estilos nativos del navegador filtrándose en controles del builder

Contexto: se detectó que `input[type="search"]` en el Inspector mostraba un
borde negro sólido (chrome nativo del navegador) por encima del `border`
tokenizado, porque le faltaba `appearance: none` / `-webkit-appearance: none`.
Ya corregido en `.pbx-triggers__search` y `.pbx-node-target-picker__search`
(`packages/builder42/src/styles/chrome/canvas-nodes.css`).

Este documento rastrea el resto de controles del builder (y paquetes
hermanos: email-builder-standalone, wa-template-studio, merge-tag-menu) que
usan tipos de `<input>`/`<select>` propensos al mismo problema: `search`,
`color`, `file`, `range`, `date*`, y `<select>` nativo sin `appearance: none`.

Estado: `[ ]` pendiente · `[x]` corregido · `[-]` revisado, no aplica.

## Resumen ejecutivo

- **4 bugs reales encontrados y corregidos**:
  1. `input[type="search"]` sin `appearance: none` en `.pbx-triggers__search`
     y `.pbx-node-target-picker__search` (`builder42`) → borde negro nativo
     del navegador (fix original que originó esta auditoría).
  2. `<select>` nativo sin `appearance: none` en `.pbx-control__input--select`
     (`builder42`, clase compartida por ~18 componentes del Inspector) →
     flecha/contorno nativo del SO por encima del tema.
  3. `TextField` outlined de MUI sin `borderColor` en el slot correcto
     (`email-builder-standalone`) → el campo "Name" de `SaveTemplateDialog`
     y `RenameSubtreeDialog` (guardar/renombrar template) mostraba el borde
     negro por defecto de MUI (`rgba(0,0,0,0.23)`). Corregido en
     `MuiOutlinedInput.styleOverrides.notchedOutline` (`src/theme.ts`).
  4. **`<input>` de título "Untitled landing" sin ningún reset** —
     `src/components/react/LandingPageBuilder.module.css`, clase `.title`
     (usada por el `<input>` de nombre de la landing en la barra del host
     Astro, NO dentro de `builder42`). No tenía `border`/`background`/
     `outline` propios en absoluto, así que el navegador pintaba su borde
     inset por defecto (gris oscuro/negro). Corregido con reset completo
     (`border: none`, `background: transparent`, hover/focus tokenizados)
     — mismo patrón ya usado correctamente en `EditorHeader.module.css`
     (`.name` dentro de `.nameField`, campaña/plantilla de mensajería), que
     SÍ tenía `border: none` explícito y no tiene este bug.
- **email-builder-standalone (resto), wa-template-studio, merge-tag-menu**:
  auditados por completo (subagentes independientes) — sin más bugs. Todos
  los `type="file"`/`type="color"` están correctamente ocultos tras
  controles custom; todos los "selects" visibles son componentes ya
  estilizados de terceros (MUI `Select`, Radix `Select`), no `<select>`
  nativo; ningún `type="search"` real fuera de builder42. Solo queda deuda
  menor documentada (hex literales `#e4e2da` en vez de `var(--border2)`,
  intencional por self-containment cross-stack).
- **Pendiente de confirmación visual del usuario** tras los fixes #3 y #4.
- **Patrón general confirmado por esta auditoría**: el bug nunca vive en
  `builder42`/`email-builder-standalone` únicamente — también aparece en los
  wrappers del HOST Astro (`src/components/react/*`) que envuelven a los
  editores vendorizados con su propia barra/chrome (`LandingPageBuilder.tsx`,
  y por extensión cualquier otro `*Builder*.tsx`/`*Editor*.tsx` con un
  `<input>` de título propio). Revisar también:
  - [-] `src/components/react/WaTemplateStudioEditor.tsx` — confirmado: usa
        el mismo `EditorHeader` compartido (`name={title}` /
        `onNameChange`), ya auditado como correcto arriba (`.name` dentro de
        `.nameField`, `border: none` explícito). No aplica el bug — no tiene
        input de título propio.
  - [ ] `src/components/react/CampaignsBoard.tsx` / `AppLandings.tsx` /
        `AppLists.tsx` / `AppSubscribers.tsx` / `AutomationBuilder.tsx` —
        todos usan placeholders "Untitled X" en algún input; confirmar caso
        por caso si el input tiene reset de `border` propio o hereda del
        default del navegador.

## builder42 (Inspector / canvas)

- [x] `.pbx-triggers__search` — `ModalTriggersSection.tsx` (input search)
      Fix aplicado: `appearance: none` + reset de pseudo-elementos
      `::-webkit-search-*` en `canvas-nodes.css`.
- [x] `.pbx-node-target-picker__search` — `NodeTargetPicker.tsx` (input search)
      Mismo fix que el anterior, en `canvas-nodes.css`.
- [-] `ImageSourceField.tsx:150` — `<input type="file" hidden ... />`. El
      input real está oculto (`hidden`) y se dispara desde un botón custom
      (`pbx-code__btn`) vía `fileRef.current?.click()`. No aplica el bug —
      el navegador nunca pinta su chrome nativo porque el elemento no es
      visible.
- [x] `<select>` nativos en builder42 — **causa raíz encontrada y corregida**:
      `.pbx-control__input--select` no tenía regla base propia (solo un
      override de `max-width` dentro de `.pbx-control--row`), así que
      heredaba `.pbx-control__input` sin ningún `appearance: none`. Se
      añadió una regla base en `inspector-controls.css` (después de
      `.pbx-control__input:focus-visible`) con `appearance: none` +
      `-webkit-appearance: none` + `-moz-appearance: none` + flecha SVG
      custom vía `background-image` (reemplaza la flecha nativa del SO).
      Aplica automáticamente a TODOS los archivos que usan la clase, sin
      tocarlos uno por uno:
      - `NodeClickActionSection.tsx`, `BorderSimple.tsx`, `StylePanel.tsx`,
        `ThemesEditor.tsx`, `LinkField.tsx`, `NodeTargetPicker.tsx`,
        `OptionsSchemaField.tsx`, `StateStyleField.tsx`, `StyleField.tsx`,
        `PairGrid.tsx`, `TranslationModal.tsx`, `LocaleQuickAccess.tsx`,
        `propControls/registry.tsx`, `StateSelector.tsx`, `PageManager.tsx`,
        `PropertyField.tsx`, `PropertyRow.tsx`, `ContentLocaleSelect.tsx`,
        `LanguageSelect.tsx`.
      - `Select.tsx` (registry/components): es un componente de OUTPUT
        (contenido renderizado por el usuario final del sitio publicado,
        no chrome del editor) — fuera de alcance de esta auditoría, no
        se tocó.
- [x] `.pbx-pages__select` (`header.css`) — CSS **huérfano**: no hay ningún
      componente `.tsx` que use esta clase (0 matches al buscar en `src/`).
      No aplica el bug porque nunca se renderiza. No se tocó (podría
      limpiarse en un pase de deuda CSS aparte, fuera de esta auditoría).
- [-] `.pbx-slots__select`, `.pbx-page-manager__select`, `.pbx-themes__select`
      — pese al nombre, son `<button>` de trigger de un dropdown custom
      (`border: 0`, `cursor: pointer`), NO `<select>` nativos. No aplica el
      bug de chrome nativo.

## email-builder-standalone — AUDITADO (subagente, sin cambios de código)

- [-] `EJEMPLO_USO_GRANULAR.tsx` — **código muerto confirmado**: sin
      imports/referencias en ningún otro archivo de `src/`. No aplica.
- [-] `ColorInput/EyeDropperButton.tsx:66` — `type="color"` con
      `position:absolute; width:0; height:0; opacity:0; pointerEvents:none`.
      Invisible; el control real es un `<Button>` MUI con ícono `Colorize`.
      Fallback disparado por `inputRef.current?.click()`. No aplica.
- [-] `BackgroundImageInput.tsx:656` e `ImageInput.tsx:456` — ambos
      `type="file"` con `display:none`, envueltos en un `<label>` clicable
      estilizado con MUI `Typography`. No aplica.
- [-] `SocialMediaInput.tsx` (×3), `ImageSidebarPanel.tsx` (×2),
      `FontFamily.tsx`, `LineHeightInput.tsx` — todos usan el mismo wrapper
      compartido `helpers/inputs/components/Select.tsx`
      (`styled(Select)` de **MUI**, no `<select>` HTML nativo). MUI ya
      reemplaza el ícono nativo (`IconComponent={ChevronIcon}` propio) y el
      menú (`MenuProps.slotProps.paper` custom). `appearance: none` es
      irrelevante — no hay elemento nativo expuesto. No aplica.
- [-] `positionIcons.tsx` — no contiene ningún `<select>` propio; solo
      exporta iconos SVG de posición consumidos por los componentes de
      arriba. No aplica.
- [-] `global.css:763` — `.react-colorful__saturation { border-bottom: 1px
      solid black !important; }`. Pertenece a la librería de terceros
      `react-colorful` (color picker), es un separador visual cosmético
      dentro del propio widget, sin relación con las variables de tema
      claro/oscuro del resto del archivo (`.light-email-builder` /
      `.dark-email-builder`). Intencional, no es theming roto. No aplica.

## wa-template-studio — AUDITADO (subagente, sin cambios de código)

- [-] `header-media.tsx:86` e `image-picker.tsx:378` — ambos `type="file"`
      con `className="hidden"` (`display:none`), precedidos por un
      `<button>`/dropzone visible que dispara `ref.current?.click()`. No
      aplica.
- [-] `buttons/advanced.tsx` — **no hay `<select>` nativo** (0 matches de
      `<select` en el archivo). Los 2 controles son `<Select>` de **Radix
      UI** (`src/ui/select.tsx`), que renderiza un `<button>`/
      `SelectPrimitive.Trigger` con flecha SVG manual
      (`ChevronDownIcon`) — no un elemento nativo del navegador.
      `appearance: none` no aplica porque no hay chrome nativo que suprimir.
- [-] `studio.css:202,262` (y una 3ª ocurrencia análoga en línea ~629, fuera
      del alcance original) — hex literal `#e4e2da` en `.wts-select`
      (trigger de Radix) y `.wts-select-menu` (panel portado a
      `document.body`, fuera del scope `.wa-studio`). **Deuda menor
      documentada**: el propio código comenta que es intencional — el
      studio corre standalone (dev harness) sin los tokens `:root` de la
      app host, y el menú portado no tiene acceso a `var()` scopeados a
      `.wa-studio`. No es un bug visual, es ausencia deliberada de
      dependencia a tokens externos.

## merge-tag-menu — AUDITADO (subagente, sin cambios de código)

- [-] `.md-tag-menu-search` (línea 25, `border-bottom`) — es el contenedor
      `<div>` que envuelve el buscador, no el `<input>` mismo. No aplica el
      bug de appearance (no es un control de formulario).
- [-] `.md-tag-menu-input` (línea 46, `border: 1px solid #e4e2da`) — el
      `<input>` real del buscador, pero es `type="text"` (no `search`),
      confirmado en `MergeTagMenuPanel.tsx`. Los inputs `type="text"` no
      generan chrome nativo relevante (sin spinner, sin botón de limpiar
      nativo de WebKit). No aplica el bug — el escenario de riesgo
      (`type="search"` sin appearance) no se materializa aquí.
- [-] Hex literal `#e4e2da` vs `var(--border2)` — **deuda menor, pero
      intencional y documentada**: el comentario de cabecera del archivo
      explica que el panel usa colores explícitos porque se porta fuera
      del scope de MUI/Radix/CSS-modules del host y no puede depender de
      que el host defina esos custom properties. Migrar a `var(--border2)`
      rompería esa garantía salvo que se use `var(--border2, #e4e2da)` con
      fallback — no se aplicó, fuera del alcance de "bug de borde negro".

## Notas de método

- El bug raíz es siempre el mismo patrón: un `<input>`/`<select>` con
  `border` tokenizado en CSS propio, pero sin `appearance: none` /
  `-webkit-appearance: none`, permitiendo que el navegador dibuje su chrome
  nativo (borde/contorno del SO) por encima o además del estilo custom.
- Tipos de input de mayor riesgo, en orden: `search` (confirmado, 2 casos
  corregidos) > `select` nativo > `color` > `file` > `date`/`time`/`range`.
- Para `type="file"` normalmente el input real está `visually-hidden` /
  `opacity: 0` detrás de un botón custom — en esos casos no aplica el fix de
  appearance (no hay bug), solo confirmar visualmente.
- Para `type="color"` igual: si hay un swatch/preview custom que tapa el
  input nativo, no aplica.
