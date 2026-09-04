# 53 — Auditoría y homologación de altura de controles del Inspector

Estado: **plan, pendiente de implementación** (este documento se escribe
ANTES de tocar código; §6 se completa al terminar).

## 1. Problema

`inspector-panel.css` ya fija una única fuente de altura de FILA
(`.pbx-row { height: var(--pb-chrome-panel-row-height) }` = **32px**,
`tokens.css:242`), con 3 excepciones cerradas y documentadas
(`.pbx-row--tall`: sides grid, slider+valor, color picker expandido). Esa
parte del sistema está bien y **no se toca**.

El problema está un nivel más abajo: **dentro** de una fila de 32px, el
control interactivo primario (input, select, swatch, botón segmentado) NO
tiene una altura consistente entre sí. Unos declaran `height` explícito,
otros solo `padding` (y la altura resultante depende de `border-box` +
`font-size`/line-height), y los valores explícitos que sí existen no
coinciden entre componentes. Resultado visual: en una misma fila o entre
filas contiguas, el control se ve más alto o más bajo que su vecino aunque
la fila que los contiene mida siempre 32px — el control no está centrado
verticalmente contra un límite consistente, solo contra el alto variable de
su propio padding.

## 2. Método

Auditoría 100% dentro de `packages/builder42` (Inspector/canvas del
builder, no se tocan `email-builder-standalone`/`wa-template-studio`/otros
paquetes hermanos). Se leyeron directamente:

- `src/styles/chrome/inspector-controls.css` (clases base: `.pbx-control__input`,
  `.pbx-nselect__trigger`, `.pbx-numeric-input`, `.pbx-searchable-select__input`)
- `src/styles/chrome/inspector-panel.css` (overrides por componente dentro
  del panel unificado: `.pbx-color-field`, `.pbx-panel-token-picker`,
  `.pbx-segmented__btn`, `.pbx-border-simple__*`, `.pbx-sides-grid__lock`,
  `.pbx-numeric-field__icon`)
- `src/styles/chrome/color-picker.css` (`.pbx-color-picker__swatch`)
- `src/styles/chrome/tokens.css` (`--pb-chrome-panel-row-height: 32px`)
- Componentes: `NumericField.tsx`, `PairGrid.tsx`, `SidesGrid.tsx`,
  `PresetSegmented.tsx`, `IconSegmented.tsx`, `ColorField.tsx`,
  `BorderSimple.tsx`, `GridColumnsSimple.tsx`, `SidesAxisPresets.tsx`,
  `PresetNumeric.tsx`, `ChipsTextField.tsx`, `StyleField.tsx`,
  `PropertyField.tsx`, `PropertyRow.tsx` (para confirmar qué clase CSS
  aplica cada uno, sin adivinar por nombre).

Confirmado en `reset.css:21`: `box-sizing: border-box` es global — la
altura efectiva de un control SIN `height` explícito es
`padding-top + padding-bottom + border×2 + line-height del contenido`, no
solo el `padding`.

## 3. Altura de referencia elegida

Petición explícita del usuario: usar como referencia el input numérico o el
select, "porque es más fácil escalar hacia arriba" (evitar reducir
controles que ya tienen padding/hitbox cómodos; subir los que quedaron más
bajos).

- **`.pbx-numeric-input`** (`NumericUnitInput`, usado por `NumericField`) ya
  declara `height: 32px` explícito — coincide exactamente con
  `--pb-chrome-panel-row-height`. Es la referencia más sólida porque ya es
  una variable de diseño existente, no un cálculo derivado de padding.
- **`.pbx-nselect__trigger`** (`PbxSelect`, el reemplazo custom del
  `<select>` nativo, ver `native-select-migration-plan.md`) NO declara
  `height` — con `padding: 6px 9px`, `border: 1px` y `font-size: 13px`
  (line-height normal del navegador, ~15–16px), su altura renderizada cae
  en **~29px**, 3px por debajo del numeric input.

**Decisión: 32px, fijado explícitamente vía `height` en cada clase de
control primario** (no solo en `.pbx-numeric-input`). Se usa el token ya
existente `var(--pb-chrome-panel-row-height)` en vez de repetir el literal
`32px`, para que quede una sola fuente numérica en todo el archivo si en el
futuro cambia.

## 4. Inventario de alturas actuales (antes de tocar nada)

| Control / clase CSS | Componente(s) que la usan | Altura actual | Cómo se fija | Delta vs 32px |
|---|---|---|---|---|
| `.pbx-numeric-input` | `NumericField` (vía `NumericUnitInput`), `TokensEditor`, `ThemesEditor`, `StyleField` legacy | **32px** | `height: 32px` explícito | referencia (0) |
| `.pbx-nselect__trigger` (base, sin override) | `PbxSelect` genérico — `NodeClickActionSection`, `LinkField`, `OptionsSchemaField`, `propControls/registry.tsx`, `ThemesEditor` (selects no-width/style), `PageManager`, `TranslationModal`, `StateSelector`, `StateStyleField`, `PropertyField` (token picker inline) | **~29px** | Sin `height`; `padding: 6px 9px` + `border: 1px` + line-height del `font-size:13px` | **-3px** |
| `.pbx-control__input` (base, sin modificador) | `GridColumnsSimple`, inputs de texto libre varios | **~29px** | Sin `height`; mismo cálculo que arriba | **-3px** |
| `.pbx-searchable-select__input` | `SearchableSelectControl` (campo "Icono") | **~29px** | Comparte `.pbx-control__input` base, sin `height` propio | **-3px** |
| `.pbx-color-field .pbx-control__input` | `ColorField` (hex input) | **28px** | `height: 28px` explícito (override local) | **-4px** |
| `.pbx-panel-token-picker .pbx-control__input` | Token picker inline unificado (`PropertyField`) | **28px** | `height: 28px` explícito (override local) | **-4px** |
| `.pbx-border-simple__width .pbx-nselect__trigger`, `.pbx-border-simple__style .pbx-nselect__trigger` | `BorderSimple` (grosor/tipo de borde) | **28px** | `height: 28px` explícito (override local, ya achica el trigger base) | **-4px** |
| `.pbx-color-picker__swatch` | `ColorField` (swatch), `ThemesEditor`, `TokensEditor`, `BorderSimple` color | **28px** | `width/height: 28px` explícito | **-4px** |
| `.pbx-segmented__btn` | `IconSegmented`, `PresetSegmented` (vía `.pbx-segmented`), `PresetNumeric` | **26px** | `width/height: 26px` explícito | **-6px** |
| `.pbx-color-field__opacity .pbx-control__input` | `ColorField` (input de opacidad) | **~29px** (ancho 32px, alto no fijado) | Solo `width: 32px`; hereda altura del base | **-3px** |
| `.pbx-sides-grid__lock` | `SidesGrid` (candado de ejes vinculados) | **24px** | `width/height: 24px` explícito | **-8px** |
| `.pbx-numeric-field__icon` | `NumericField` (handle de scrubbing / icono de lado) | **24px** | `width/height: 24px` explícito | **-8px** |
| `.pbx-panel-token-chip` | Chip de token vinculado (reemplaza el control cuando hay token activo) | **28px** | `height: 28px` explícito | **-4px** |

Controles SIN altura propia de "control primario" (correctos, fuera de
alcance de esta homologación porque no son la caja interactiva principal de
la fila):

- `.pbx-pair-grid__cell` (`PairGrid`) — es un contenedor de grid, no un
  control; cada celda aloja su propio `NumericField`/`PbxSelect`, que ya
  está en la tabla de arriba.
- `.pbx-chips-text` (`ChipsTextField`) — el input real que usa es
  `.pbx-control__input` (ya cubierto arriba); el wrapper solo posiciona el
  popover de chips.
- `.pbx-sides-axis-presets__field .pbx-nselect` — usa `.pbx-nselect__trigger`
  base, ya cubierto arriba (mismo -3px que cualquier `PbxSelect`).
- `.pbx-preset-numeric__preset` (botón de preset de texto en `PresetNumeric`)
  — reutiliza `.pbx-segmented__btn`, ya cubierto arriba.

## 5. Hallazgo

5 alturas distintas convivendo como "control primario de una fila de 32px":
**32 / ~29 / 28 / 26 / 24px**. Ningún control excede 32px (todos son
iguales o más bajos), así que "escalar hacia arriba" (subir el resto a 32px)
no reduce ningún hitbox existente — coincide con la restricción del usuario.

Los -6px (`.pbx-segmented__btn`, 26px) y -8px (`.pbx-sides-grid__lock`,
`.pbx-numeric-field__icon`, 24px) son casos particulares: esos 3 ya están
en o cerca del piso de WCAG 2.5.8 (Target Size Minimum AA, 24×24px) y su
comentario de cabecera lo dice explícitamente. Subirlos a 32px es seguro
(sigue siendo ≥24px) pero cambia más su proporción visual — se homologan
igual porque el pedido es "misma altura para todos", pero se documenta como
el cambio de mayor impacto visual relativo.

## 6. Plan de homologación

Fijar `height: var(--pb-chrome-panel-row-height)` (32px vía token, no
literal) en las clases de control primario que hoy no lo tienen o lo tienen
distinto, sin tocar `.pbx-row`/`.pbx-row--tall` (ya correctos) ni el ancho/
padding horizontal de ningún control (solo se homologa ALTURA vertical).

### Grupo A — Inputs de texto/número base y select

Archivo: `src/styles/chrome/inspector-controls.css`

- `.pbx-control__input` → añadir `height: var(--pb-chrome-panel-row-height)`
  (sube de ~29px a 32px). Afecta: `GridColumnsSimple`, inputs de texto
  libre, y es la clase base que heredan `.pbx-color-field`/
  `.pbx-panel-token-picker` (que la overridean después a 28px — ver Grupo B,
  esos overrides se eliminan para que hereden el 32px del base).
- `.pbx-nselect__trigger` → añadir `height: var(--pb-chrome-panel-row-height)`
  (sube de ~29px a 32px). Afecta a TODOS los `PbxSelect` del inspector que
  no tengan un override local más específico (ver Grupo B para los que sí).
- `.pbx-searchable-select__input` → mismo alto (hereda `.pbx-control__input`
  ya corregido arriba; solo confirmar que ningún override local de este
  selector fije un `height`/`padding` vertical distinto — no lo hace, según
  auditoría §4).

### Grupo B — Overrides locales de 28px (eliminar el override, heredar 32px)

Archivo: `src/styles/chrome/inspector-panel.css`

- `.pbx-color-field .pbx-control__input { height: 28px; }` → quitar la
  línea `height: 28px` (hereda 32px del Grupo A). Revisar que
  `.pbx-color-field` (el flex contenedor) siga centrando verticalmente
  (`align-items: center`, ya presente) — no requiere cambio de layout.
- `.pbx-panel-token-picker .pbx-control__input { height: 28px; }` → misma
  acción, quitar el override.
- `.pbx-border-simple__width .pbx-nselect__trigger`,
  `.pbx-border-simple__style .pbx-nselect__trigger { height: 28px; padding: 0 6px; }`
  → quitar `height: 28px` (hereda 32px del `.pbx-nselect__trigger` base ya
  corregido). El `padding: 0 6px` horizontal SÍ se conserva (no es altura,
  es el ancho compacto para que quepan 3 sub-controles en la fila de
  `BorderSimple`) — verificar con `padding: 0 6px` + `height` heredado que
  el contenido siga centrado.
- `.pbx-panel-token-chip { height: 28px; }` → sube a 32px vía token (mismo
  criterio, es un slot que reemplaza al control cuando hay token vinculado,
  debe verse igual de alto que el control que reemplaza).
- `.pbx-color-field__opacity .pbx-control__input` → sin cambio de código
  (hereda el 32px corregido del Grupo A automáticamente); solo confirmar
  visualmente que el input de opacidad (ancho 32px) no se ve desproporcionado
  al subir de alto — es un caso ya angosto por diseño, aceptado.

### Grupo C — Swatch de color

Archivo: `src/styles/chrome/color-picker.css`

- `.pbx-color-picker__swatch { width: 28px; height: 28px; }` → subir a
  `height: var(--pb-chrome-panel-row-height)` Y `width` al mismo valor (32px,
  mantiene proporción cuadrada — no hay razón de diseño para que deje de
  ser un cuadrado). Revisar el selector derivado
  `.pbx-color-field--swatch-only .pbx-color-picker__swatch { width: 130px; }`
  (`inspector-panel.css`) — ese ancho especial NO se toca (sigue siendo
  130px de ancho), solo el alto sube con el base.

### Grupo D — Segmentados (IconSegmented / PresetSegmented / PresetNumeric)

Archivo: `src/styles/chrome/inspector-panel.css`

- `.pbx-segmented__btn { width: 26px; height: 26px; }` → subir ambos a
  `var(--pb-chrome-panel-row-height)` (32px, cuadrado, mismo criterio que el
  swatch). Verificar que el ícono interno (`size={16}` en `IconSegmented.tsx`/
  `PresetSegmented.tsx`) no quede descentrado — es `display:flex;
  align-items:center; justify-content:center`, ya centra automáticamente
  con cualquier tamaño de caja.
- `.pbx-preset-numeric__preset { min-width: 28px; padding: 0 8px; }` — este
  botón hereda `.pbx-segmented__btn` (altura ya corregida arriba); el
  `min-width`/`padding` son horizontales, no se tocan.

### Grupo E — Candado de ejes y handle de scrubbing (24px → 32px)

Archivo: `src/styles/chrome/inspector-panel.css`

- `.pbx-sides-grid__lock { width: 24px; height: 24px; }` → subir a
  `var(--pb-chrome-panel-row-height)`. Es el cambio de mayor impacto visual
  relativo (§5) pero el pedido es altura uniforme; se aplica igual. Revisar
  `.pbx-sides-grid__actions` (columna que apila token+candado) — usa
  `gap: 4px`, sin altura fija propia, así que crecer el candado no rompe el
  layout, solo aumenta el alto total de esa columna (dentro de una fila
  `pbx-row--tall`, que ya es `height: auto` — no hay conflicto).
- `.pbx-numeric-field__icon { width: 24px; height: 24px; }` → mismo cambio.
  Es el ícono de lado / handle de scrubbing dentro de `NumericField` — vive
  DENTRO de una fila `.pbx-numeric-field` que a su vez está dentro de una
  fila de 32px; subir el ícono a 32px lo iguala a la altura de su propio
  hermano `.pbx-numeric-input` (32px) en la misma fila — mejora la
  consistencia interna del propio `NumericField`, no solo entre filas.

### Fuera de alcance (no se tocan)

- `.pbx-row` / `.pbx-row--tall` (ya correctos, única fuente de altura de
  FILA — no de control).
- `.pbx-icon-btn--sm` (24px) / `.pbx-icon-btn--md` (26px) — primitivo
  compartido de botones-icono de ACCIÓN (reset, unlink, historial…), no de
  "control primario editable" de una fila de propiedades; ya está anclado
  al piso de WCAG 2.5.8 con su propia justificación documentada
  (`inspector-controls.css`). Homologarlo con 32px está fuera del pedido
  (que es sobre inputs/selects del Inspector, no sobre botones de acción
  genéricos usados en todo el chrome, header incluido).
- `.pbx-visibility-strip` (36px) — ya es una excepción de altura documentada
  y distinta (`VisibilityStrip`, docs/41 §5.2), no vive dentro de una fila
  de 32px.
- `.pbx-switch__track`/`__thumb` — toggle boolean, su tamaño (32×18px) es
  proporción de switch estándar, no un control de "altura de fila".

## 7. Verificación planeada

- `pnpm --filter builder42 test` (si existen tests relevantes — no se
  esperan tests unitarios de CSS puro; confirmar que no se rompe
  `sides-axis-presets.test.ts`, que es lógica pura sin CSS).
- `npx tsc -p packages/builder42 --noEmit` — ningún cambio de este plan
  toca `.tsx`/`.ts`, solo `.css`, así que no debería alterar el resultado,
  pero se corre para confirmar que no hay regresión accidental.
- `astro check` desde la raíz del repo (gate autoritativo de tipos del
  monorepo).
- Sin lint (`packages/**` está excluido de ESLint en este repo).
- Verificación VISUAL manual pendiente del usuario tras el cambio (no hay
  captura de pantalla automatizada en este entorno) — se deja explícito en
  §8 como pendiente, no se marca como "confirmado" sin evidencia.

## 8. Resultado de la implementación

Ejecutado por completo, implementación con 3 subagentes en paralelo
(uno por archivo CSS, para evitar ediciones concurrentes sobre el mismo
archivo — Grupos B+D+E comparten `inspector-panel.css` así que fueron un
solo subagente).

### Cambios aplicados

- **`src/styles/chrome/inspector-controls.css`** (Grupo A): añadido
  `height: var(--pb-chrome-panel-row-height);` en `.pbx-control__input`
  (línea 150) y en `.pbx-nselect__trigger` (línea 219). Ninguna otra
  propiedad tocada.
- **`src/styles/chrome/inspector-panel.css`** (Grupos B + D + E):
  - `.pbx-color-field .pbx-control__input` — eliminado `height: 28px`
    (hereda 32px del Grupo A).
  - `.pbx-panel-token-picker .pbx-control__input` — eliminado `height: 28px`.
  - `.pbx-border-simple__width .pbx-nselect__trigger`,
    `.pbx-border-simple__style .pbx-nselect__trigger` — eliminado
    `height: 28px`, conservado `padding: 0 6px`.
  - `.pbx-panel-token-chip` — `height: 28px` → `height: var(--pb-chrome-panel-row-height)`.
  - `.pbx-segmented__btn` — `width`/`height: 26px` → `var(--pb-chrome-panel-row-height)`.
  - `.pbx-sides-grid__lock` — `width`/`height: 24px` → `var(--pb-chrome-panel-row-height)`.
  - `.pbx-numeric-field__icon` — `width`/`height: 24px` → `var(--pb-chrome-panel-row-height)`.
- **`src/styles/chrome/color-picker.css`** (Grupo C):
  `.pbx-color-picker__swatch` — `width`/`height: 28px` →
  `var(--pb-chrome-panel-row-height)`.

Confirmado con `grep` posterior a los 3 subagentes: los únicos `height:
28px`/`26px`/`24px` que quedan en `inspector-controls.css`/
`inspector-panel.css` pertenecen a clases explícitamente fuera de alcance
(`.pbx-visibility-strip__eye` 28px, `.pbx-icon-btn--sm` 24px,
`.pbx-icon-btn--md` 26px, `.pbx-layers__row` 26px — panel de capas, no
Inspector), tal como define §6 "Fuera de alcance". No se tocó ningún otro
archivo.

### Verificación

- `npx tsc --noEmit -p tsconfig.json` (desde `packages/builder42`): **0
  errores**.
- `npx astro check` (desde la raíz del repo): **0 errores, 0 warnings**, 2
  hints preexistentes no relacionados (`AutomationBuilder.tsx`, variables
  `past`/`future` sin leer — ya existían antes de este cambio).
- `npx vitest run` (desde `packages/builder42`): **10/10 tests verdes**
  (`sides-axis-presets.test.ts`, lógica pura sin CSS, sin regresión
  esperada ni encontrada).
- Sin lint aplicable (`packages/**` excluido de ESLint en este repo).
- **Verificación visual: pendiente del usuario.** Este entorno no tiene
  captura de pantalla/inspección visual automatizada — los cambios son
  puramente de CSS (`height`/`width` de controles ya posicionados por sus
  contenedores flex/grid existentes, que ya centran con `align-items:
  center`), pero la confirmación final de que se ve homogéneo en el
  Inspector real requiere revisión visual humana.

### Archivos tocados

`inspector-controls.css`, `inspector-panel.css`, `color-picker.css`. Ningún
`.tsx`/`.ts` modificado — el hallazgo de §5 no requería cambios de
componente, solo de CSS (todas las clases ya existían y ya estaban
aplicadas correctamente por los componentes; solo su valor de altura
cambió).

### Seguimiento — fila `effects.boxShadow` (modo simple) desalineada

Reportado por el usuario tras revisión visual: en la fila `effects.boxShadow`
(modo simple), el botón "Ninguna" se veía más chico que los presets S/M/L
contiguos. Causa: ese botón es un `IconButton size="md"` genérico
(`.pbx-icon-btn--md`, 26px), primitivo de acción correctamente dejado FUERA
de alcance en §6 (se usa como botón de reset/unlink/historial en todo el
chrome, no como control primario del Inspector) — pero el comentario
original de `StylePanel.tsx` (`pbx-boxshadow-simple`) documentaba que se
eligió `size="md"` precisamente para IGUALAR el alto de 26px que
`.pbx-segmented__btn` (`PresetSegmented`) tenía ANTES de esta homologación.
Al subir `.pbx-segmented__btn` a 32px (Grupo D) sin revisar este acoplamiento
implícito, la fila quedó desalineada (32px vs 26px).

Fix aplicado, `inspector-panel.css`, override LOCAL y aislado (no se toca
`.pbx-icon-btn--md` global, que sigue en 26px en el resto del chrome):

```css
.pbx-boxshadow-simple > .pbx-icon-btn--md {
  width: var(--pb-chrome-panel-row-height);
  height: var(--pb-chrome-panel-row-height);
}
```

Confirmado (grep en `StylePanel.tsx`) que ningún otro punto del panel
combina `IconButton` + `PresetSegmented`/`IconSegmented` en la misma fila —
caso aislado a `boxShadow`, no hay más filas con el mismo acoplamiento
oculto.

Verificación tras el fix: `npx tsc --noEmit -p tsconfig.json` → 0 errores;
`npx vitest run` → 10/10 tests verdes.

### Seguimiento 2 — letras S/M/L de `effects.boxShadow` más grandes que en otros switchers

Reportado por el usuario tras revisión visual (aclaración del reporte
anterior: no eran los botones, era el tamaño de las LETRAS). Causa:
`.pbx-segmented__btn` (compartida por `IconSegmented` y `PresetSegmented`)
nunca tuvo `font-size` propio — heredaba 13px del ancestro. El OTRO
switcher de presets de letra corta del panel, `.pbx-preset-numeric__preset`
(usado por `PresetNumeric`, p. ej. en filas de spacing/font-size), sí fija
`font-size: 11px` + `font-weight: var(--pb-chrome-font-weight-medium)`
explícitos. Esa diferencia (13px sin peso vs 11px con peso medio) es la
inconsistencia real que el usuario señaló — preexistente a docs/53, del
mismo dominio (controles switcher del panel).

Fix aplicado, `inspector-panel.css`, en `.pbx-segmented__btn` (regla base,
no un override local): se añadió `font-size: 11px;` y
`font-weight: var(--pb-chrome-font-weight-medium);`, igualando el criterio
de `.pbx-preset-numeric__preset`. No afecta a `IconSegmented` (el glifo es
un `<svg>` con `size={16}` propio, ajeno a `font-size` del botón
contenedor) — solo cambia el texto de `PresetSegmented` (única fila que usa
letras dentro de `.pbx-segmented__btn`: `effects.boxShadow`).

Verificación: `npx tsc --noEmit -p tsconfig.json` → 0 errores; `npx vitest
run` → 10/10 tests verdes.

### Seguimiento 3 — `size.width` no aceptaba `fit-content` en modo Custom (fuera del alcance original de docs/53, reportado en la misma sesión)

No es un problema de ALTURA de controles (el foco de este documento) sino
de VALOR aceptado — se documenta aquí solo porque el usuario lo reportó en
el mismo hilo de revisión visual de estos controles. Dos causas
independientes:

1. **Faltaba el preset**: `sections.ts`, fila `size.width`, solo ofrecía
   `Full` (100%) y `Auto` — sin `fit-content`, pese a ser un valor común de
   `width`. Se añadió `{ labelKey: "panel.width.fitContent", value:
   "fit-content" }` como 3er preset, con etiqueta `"Fit"` en los 3 locales
   (`en`/`es`/`it` — acortado a petición del usuario, un solo botón de 32px
   de ancho no tiene espacio cómodo para una palabra más larga como "Fit
   content"/"Ajustar"; "Fit" es corto y se entiende igual en los 3
   idiomas).
2. **Bug real al escribirlo a mano en modo Custom**: `NumericUnitInput.tsx`
   (`parse()`) solo reconocía `"auto"`/`"none"` como palabras clave no
   numéricas — cualquier otro texto (incluido `fit-content`) tecleado
   mientras el campo YA estaba en modo numérico (valor previo tipo "300px")
   nunca llegaba a commitear: `commitNum` hacía `parseFloat("fit-content")`
   → `NaN` → revertía el draft con el shake de "inválido", sin posibilidad
   real de escribirlo (el modo Pill/SimpleTextPill se decide por el
   `value` EXTERNO, no por lo que el usuario teclea, así que nunca
   transicionaba). Fix: `NON_NUMERIC_KEYWORDS` (nuevo `Set`, incluye
   `auto`/`none`/`fit-content`/`max-content`/`min-content`) reemplaza las 2
   comparaciones sueltas en `parse()`, y `commitNum` ahora commitea el
   string tal cual (sin `serialize`) cuando el draft coincide exactamente
   con una keyword reconocida — el `value` externo cambia y el componente
   remonta como texto libre en el siguiente render, igual que ya pasaba con
   "auto" llegado por otra vía (p. ej. un preset).

Archivos tocados: `sections.ts`, `NumericUnitInput.tsx`,
`i18n/locales/{en,es,it}/inspector.json`. Cambio de tipo: el `onCommit` de
`NumericPill` pasó de `(num: number, unit: string) => void` a `(num:
number | string, unit: string) => void` — el padre detecta `typeof n ===
"string"` para saltarse `serialize` en ese caso, sin casts inseguros.

Verificación: `npx tsc --noEmit -p tsconfig.json` (builder42) → 0 errores;
`npx vitest run` → 10/10 tests verdes; `npx astro check` (raíz del repo) →
0 errores, 0 warnings, 2 hints preexistentes no relacionados.
