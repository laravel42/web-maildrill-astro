# Auditoría — Homologar altura de controles del Inspector (Email Builder ↔ Builder42)

Estado: **plan, pendiente de implementación**. Este documento se escribe
ANTES de tocar código, replicando el método usado en
`packages/builder42/docs/53-auditoria-altura-controles-inspector.md`
(auditoría equivalente ya ejecutada dentro de Builder42). §7 queda para
completarse cuando el plan se apruebe y se implemente.

**No se ha modificado ningún archivo de código en esta sesión.** Otro
agente está trabajando en paralelo sobre este mismo proyecto — este
documento es de solo lectura sobre el código existente.

## 1. Problema

El usuario reporta que, para homologar la UI/UX de la plataforma, los
inputs del **Email Builder** (`packages/email-builder-standalone`, stack
MUI) se ven más grandes que los del **Builder42** (`packages/builder42`,
CSS vanilla) y rompen la continuidad visual entre ambos editores del
mismo producto. Se pide tomar como referencia las medidas de Builder42 y
aplicarlas al Email Builder.

## 2. Método

Auditoría de solo lectura sobre dos paquetes:

- **Referencia**: `packages/builder42/src/styles/chrome/{tokens.css,
  inspector-controls.css, inspector-panel.css, color-picker.css}` — ya
  homologado internamente en `docs/53` a una única altura de control
  primario de **32px**, vía el token `--pb-chrome-panel-row-height`.
- **Objetivo del cambio**: `packages/email-builder-standalone/src/App/
  InspectorDrawer/ConfigurationPanel/**` — componentes de input del
  panel de propiedades (`helpers/inputs/*`), su hoja de estilos
  compartida (`helpers/inputs/components/inputStyles.ts`), el `<Select>`
  custom (`helpers/inputs/components/Select.tsx`), y los overrides
  globales de MUI (`src/theme.ts`, bloques `MuiInputBase`,
  `MuiOutlinedInput`, `MuiSelect`, `MuiSlider`, `MuiToggleButton`,
  `MuiIconButton`).

Se leyeron directamente (sin modificar):

- `packages/email-builder-standalone/src/App/InspectorDrawer/
  ConfigurationPanel/input-panels/helpers/inputs/components/
  inputStyles.ts` — constante `INPUT_HEIGHT = 36` y los `sx` que la
  consumen (`INPUT_TEXTFIELD_SX`, `INPUT_CONTAINER_SX`).
- `.../components/Select.tsx` — `StyledSelect`, reutiliza `INPUT_HEIGHT`.
- `.../components/FieldContainer.jsx` — wrapper vertical sin altura
  propia (no aporta ni resta).
- `.../inputs/TextInput.tsx`, `WidthInput.tsx`, `HeightInput.tsx`,
  `raw/RawSliderInput.tsx`, `InputSizeButton.tsx`, `InputSizeSelector.tsx`,
  `ColorInput/BaseColorInput.tsx`, `ColorInput/Picker.tsx` — para
  confirmar qué clase/constante de altura aplica cada uno, sin adivinar
  por nombre.
- `packages/email-builder-standalone/src/theme.ts` — bloques
  `MuiInputBase`, `MuiOutlinedInput`, `MuiSelect`, `MuiSlider`,
  `MuiToggleButtonGroup`/`MuiToggleButton`, `MuiIconButton` (tamaños,
  padding, sin `height` explícito salvo donde se indica).
- `packages/email-builder-standalone/src/constants.ts` —
  `RADIUS_INPUT = 6`, `RADIUS_DROPDOWN = 8` (radios, no alturas, pero
  relevantes para el mapeo 1:1 contra Builder42 en §5).
- `packages/builder42/docs/53-auditoria-altura-controles-inspector.md` —
  precedente directo: mismo tipo de problema (altura derivada de
  padding/line-height en vez de fijada), mismo criterio de resolución
  ("escalar hacia arriba", nunca reducir un hitbox existente), ya
  resuelto dentro de Builder42.
- `packages/builder42/src/styles/chrome/tokens.css` — confirmassociation
  de `--pb-chrome-panel-row-height: 32px`.

## 3. Altura de referencia

**32px**, tomado literal del token `--pb-chrome-panel-row-height` de
Builder42 (no se redefine un número nuevo — es la misma referencia ya
usada y documentada en `docs/53`, para que ambos editores compartan
literalmente el mismo valor de diseño en vez de mantener dos constantes
paralelas que puedan volver a divergir).

Confirmado: Builder42 nunca sube este token a un valor mayor a 32px — es
el techo de referencia. El Email Builder hoy está por ENCIMA de esa
referencia (36px vs 32px), así que este caso es el inverso de `docs/53`
(que subía controles más bajos hasta 32px): aquí se **reduce** el valor
existente. Se marca explícitamente porque reducir un hitbox interactivo
sí tiene implicación de accesibilidad (WCAG 2.5.8 Target Size Minimum AA
pide ≥24×24px) — 32px sigue muy por encima de ese piso, así que no hay
conflicto, pero es una consideración distinta a la de `docs/53` y se deja
anotada.

## 4. Inventario de alturas actuales — Email Builder (antes de tocar nada)

| Control / fuente | Componente(s) que lo usan | Altura actual | Cómo se fija | Delta vs 32px |
|---|---|---|---|---|
| `INPUT_HEIGHT` (constante) | `INPUT_TEXTFIELD_SX` (TextField de texto/número), `StyledSelect` (`components/Select.tsx`), `INPUT_CONTAINER_SX` | **36px** | `height: 36px` explícito, `inputStyles.ts:5` | **+4px** |
| `TextField` vía `INPUT_TEXTFIELD_SX` | `TextInput.tsx` (texto libre, multilinea excluida), y cualquier input numérico simple que reutilice el mismo `sx` | **36px** | Hereda `INPUT_HEIGHT` | **+4px** |
| `StyledSelect` (`components/Select.tsx`) | Cualquier `<Select>` del inspector (idénticas responsabilidades a `.pbx-nselect__trigger` de Builder42) | **36px** | `height`/`minHeight: 36px` explícito, línea 41 y 44-45 | **+4px** |
| `ColumnsContainerSidebarPanel.tsx` (líneas 148, 245) | Selectores de ancho de columnas | **36px** (`minHeight`) | Reutiliza `INPUT_HEIGHT` importado directo | **+4px** |
| `MuiInputBase`/`MuiOutlinedInput` (tema global, sin `INPUT_HEIGHT`) | Cualquier `TextField`/`Select` de MUI que NO pase por `INPUT_TEXTFIELD_SX`/`StyledSelect` (p. ej. diálogos fuera del Inspector: `SaveTemplateDialog`, `RenameSubtreeDialog`) | **~37–38px estimado** (padding `10px 12px` + `font-size: 13.5px`, sin `height` fijo — mismo patrón de cálculo por padding que tenía Builder42 antes de `docs/53`) | Sin `height`; `padding: 10px 12px` (`theme.ts`, bloque `MuiInputBase.styleOverrides.input`) | **+5/+6px estimado** — **fuera del Inspector, fuera de alcance de este documento** (ver §6, "Fuera de alcance"), se anota solo como hallazgo colateral |
| `RawSliderInput` (MUI `Slider`) | `WidthInput`, `HeightInput`, paddings responsivos (`ResponsiveSizeInput`), `SizeSelector`/`InputSizeSelector` | Track 6px + thumb 16×16px (`theme.ts`, bloque `MuiSlider`), fila completa ~24–32px con label superior aparte | Sin `height` de "control primario" fijo — es un slider, no una caja rectangular | **N/A** — no es comparable 1:1 contra una caja de altura fija; ver §6 "Fuera de alcance" |
| `ToggleButtonGroup`/`ToggleButton` (`RadioGroupInput`, `InputSizeSelector`, `ResponsiveSizeInput`) | Selectores segmentados (x-small/small/medium/custom, contain/cover/scale) | Sin `height` fijo: `theme.spacing(1)` (8px) padding vertical + line-height del texto (`button` typography, `lineHeight: 1.5`) ≈ **~34–36px estimado** | `MuiToggleButton.styleOverrides.root`, `theme.ts` — solo padding, no height | **~+2/+4px estimado** — análogo directo a `.pbx-segmented__btn` de Builder42 (que SÍ se homologó a 32px en `docs/53`, subiendo desde 26px) |
| `ColorInput`/`BaseColorInput` (swatch) | Selector de color del panel | Usa `RADIUS_INPUT` (6px, solo radio) pero **no** referencia `INPUT_HEIGHT` — altura no confirmada con certeza en esta pasada, requiere lectura adicional del render final (`Picker.tsx`, `Swatch.tsx`) antes de decidir | Pendiente de confirmar en la implementación | **Pendiente** |
| `IconButton` (lock de sides en `ResponsiveSizeInput`, otros) | Toggle de "vincular lados" y acciones puntuales del panel | `sizeSmall: padding 6px` (`theme.ts`, `MuiIconButton.styleOverrides.sizeSmall`) ≈ **24–26px con icono `fontSize="small"`** | Sin `height` fijo, deriva de padding + icono | Ya está cerca o por debajo de 32px — candidato a **fuera de alcance**, mismo criterio que `.pbx-icon-btn--sm/md` en Builder42 (botón de acción, no control primario editable de una fila) |

## 5. Mapeo 1:1 Email Builder ↔ Builder42

| Email Builder (MUI) | Builder42 (CSS vanilla) equivalente | Coinciden hoy? |
|---|---|---|
| `TextField` vía `INPUT_TEXTFIELD_SX` (texto/número) | `.pbx-control__input` / `.pbx-numeric-input` | No — 36px vs 32px |
| `StyledSelect` (`components/Select.tsx`) | `.pbx-nselect__trigger` | No — 36px vs 32px |
| `ToggleButtonGroup`/`ToggleButton` | `.pbx-segmented__btn` (`IconSegmented`/`PresetSegmented`) | No confirmado con precisión — estimado ~34-36px vs 32px, requiere medición exacta en implementación |
| `RawSliderInput` (MUI `Slider`) | Sliders/handles de `NumericField` (`.pbx-numeric-field__icon`, ya excluido en `docs/53`) | Fuera de alcance en ambos lados, por el mismo criterio |
| `IconButton` `sizeSmall` (lock, acciones) | `.pbx-icon-btn--sm`/`--md` | Ya cercano, mismo criterio de exclusión que Builder42 aplicó |
| `RADIUS_INPUT = 6px` | Radio de `.pbx-control__input`/`.pbx-nselect__trigger` (no auditado en este documento — **fuera de alcance**, el pedido es sobre ALTURA, no radio; se anota para no perder de vista si aparece como hallazgo colateral igual que pasó en `docs/53` con el `font-size` de los segmentados) | No auditado |

## 6. Alcance propuesto

### Dentro de alcance (controles primarios de fila del Inspector)

- `INPUT_HEIGHT` en `inputStyles.ts`: **36px → 32px**. Este único cambio
  de constante propaga a `INPUT_TEXTFIELD_SX`, `INPUT_CONTAINER_SX` y
  `StyledSelect` (ya que `Select.tsx` importa la misma constante) — a
  diferencia de Builder42 (que tuvo que tocar 3 archivos CSS distintos
  porque cada control fijaba su altura por separado), aquí el email
  builder YA tiene una única fuente numérica centralizada, así que el
  cambio de base es de una sola línea.
- `ColumnsContainerSidebarPanel.tsx` (líneas 148, 245): sin cambio de
  código — importa `INPUT_HEIGHT` desde `inputStyles.ts`, así que hereda
  el nuevo valor automáticamente.
- `ToggleButtonGroup`/`ToggleButton` (`MuiToggleButton.styleOverrides.root`
  en `theme.ts`): pendiente de decidir en la implementación si se fija un
  `height`/`minHeight: 32px` explícito (como Builder42 hizo con
  `.pbx-segmented__btn`) o si el padding actual ya resuelve suficientemente
  cerca — requiere medición exacta antes de tocar código, no estimación.

### Pendiente de confirmar antes de tocar código (no se asume)

- Altura real renderizada de `ColorInput`/`BaseColorInput` (swatch) — no
  se pudo confirmar con certeza en esta pasada de lectura: falta revisar
  el árbol de renderizado final entre `BaseColorInput.tsx`, `Picker.tsx`
  y `Swatch.tsx` con más detalle para saber si hereda `INPUT_HEIGHT` de
  algún ancestro o define su propio tamaño de swatch (equivalente a
  `.pbx-color-picker__swatch`, que en Builder42 sí se homologó a 32×32px
  cuadrado).

### Fuera de alcance (mismo criterio que `docs/53` en Builder42)

- `RawSliderInput` (MUI `Slider`) — no es una caja de altura fija
  comparable, es un track+thumb; Builder42 excluyó por el mismo motivo
  sus handles de scrubbing (`.pbx-numeric-field__icon`) de la
  homologación de "control primario", aunque sí igualó ESE caso
  puntual porque vivía dentro de la misma fila que un input de 32px — no
  aplica aquí porque el slider ocupa su propia fila completa, no
  comparte fila con otro control de referencia.
- `IconButton` `sizeSmall`/acciones puntuales (lock de lados, etc.) —
  análogo directo a `.pbx-icon-btn--sm`/`--md`, que Builder42 dejó
  explícitamente fuera por ser primitivo de acción compartido en todo el
  chrome, no control editable de una fila del Inspector.
- `MuiInputBase`/`MuiOutlinedInput` del tema global fuera del Inspector
  (diálogos como `SaveTemplateDialog`, `RenameSubtreeDialog`,
  `CommandPalette`) — mismo patrón de riesgo (altura sin `height`
  explícito, calculada por padding) pero está fuera del pedido explícito
  del usuario, que es sobre el Inspector del Email Builder. Se anota como
  hallazgo colateral (§4) por si se decide homologar en una fase
  posterior, no se toca en esta.
- Radio de borde (`RADIUS_INPUT`/`RADIUS_DROPDOWN`) — el pedido es sobre
  ALTURA, no sobre esquinas; no se toca salvo que la medición visual
  final revele una inconsistencia acoplada (como pasó con el `font-size`
  de los segmentados en el seguimiento de `docs/53`).

## 7. Verificación planeada (al implementar, no ejecutada aún)

- `pnpm --filter email-builder-standalone typecheck` (o el script
  equivalente del paquete — confirmar nombre exacto en su `package.json`
  antes de ejecutar) para confirmar que no hay regresión de tipos.
- `pnpm --filter email-builder-standalone test` si existen tests
  relevantes de estos componentes (a confirmar, no se asume que existan).
- `npx astro check` desde la raíz del repo (gate autoritativo de tipos
  del monorepo, igual que se hizo en `docs/53`).
- Verificación visual manual del usuario tras el cambio — ninguna captura
  de pantalla automatizada disponible en este entorno.

## 8. Resultado de la implementación

Ejecutado en un **git worktree aislado**
(`../web-maildrill-astro-email-inputs`, rama
`fix/email-builder-inspector-input-height`, creada desde
`feat/ui-polish-p1`) para no interferir con el trabajo en curso de otro
agente sobre el repositorio principal. `pnpm install` se corrió dentro
del worktree para poder ejecutar los gates de verificación.

### Cambios aplicados

- **`inputStyles.ts`**: `INPUT_HEIGHT` — `36` → `32`. Se propaga
  automáticamente a `INPUT_TEXTFIELD_SX`, `INPUT_CONTAINER_SX`,
  `StyledSelect` (`components/Select.tsx`, que importa la constante) y
  `ColumnsContainerSidebarPanel.tsx` (también la importa) — ningún otro
  archivo tocado para ese grupo, confirmando la ventaja anticipada en §6
  (una sola fuente numérica).
- **`ColorInput/BaseColorInput.tsx`**: el swatch principal (`ColorInput`
  no-compacto, `BUTTON_SX` variante no-`compact`) tenía un literal propio
  `height: 36` que NO heredaba `INPUT_HEIGHT` — hallazgo hecho durante la
  implementación, no visible desde el inventario inicial de §4 sin leer
  el árbol de render completo. Cambiado a `height: 32` con comentario que
  referencia este documento. El swatch `compact` (28px, usado en modo
  inline sin label) y `Swatch.tsx` (24px, tiles de paleta + candado) se
  dejan sin cambio — confirmado que no importan `INPUT_HEIGHT`, son casos
  ya por debajo de 32px y análogos a excepciones ya documentadas en
  Builder42 (`.pbx-color-picker__swatch` compacto / `.pbx-sides-grid__lock`).
- **`theme.ts`**, bloque `MuiToggleButtonGroup.styleOverrides.root` (clase
  `.MuiToggleButtonGroup-grouped`): no tenía `height` fijo, solo
  `paddingTop`/`paddingBottom: theme.spacing(1)` (8px cada uno) — la
  altura resultante dependía del `line-height` del texto interno, mismo
  patrón de causa raíz que motivó `docs/53` en Builder42. Medido con
  precisión antes de tocar: 16px de padding vertical + line-height del
  texto (`button` typography, 1.5) ≈ 37px, confirmando que excedía 32px
  y entraba en alcance. Se fijó `height: '32px'` + `boxSizing:
  'border-box'` + `display: flex; alignItems: center; justifyContent:
  center` (para mantener el texto centrado sin depender del padding
  vertical, que se puso a 0), análogo directo al fix de
  `.pbx-segmented__btn` en `docs/53`. Afecta a `RadioGroupInput`,
  `InputSizeSelector`, `ResponsiveSizeInput` (mismo componente base MUI).

### Verificación

- `npx astro check` (raíz del worktree): **0 errores, 0 warnings**, 3
  hints preexistentes no relacionados (`LandingPageBuilder.tsx`
  `returnValue` deprecado; `AutomationBuilder.tsx` `past`/`future` sin
  leer — mismos hints ya documentados como preexistentes en
  `docs/53` de Builder42, confirmando que no son nuevos).
- `npx tsc -p packages/builder42 --noEmit`: **0 errores** (Builder42 no
  se tocó en este cambio; se corre igual porque es parte del script
  `typecheck` oficial del repo).
- `npx tsc -p packages/wa-template-studio --noEmit`: **0 errores**.
- `npm run typecheck` (script oficial completo): el paso intermedio
  `node scripts/typecheck.mjs` falla con `spawnSync ENOENT` al resolver
  `node_modules/.bin/tsc` — **confirmado que es un problema de entorno
  preexistente en Windows, no causado por este cambio**: se reprodujo el
  mismo fallo ejecutando `node scripts/typecheck.mjs` directamente en el
  repositorio principal (`feat/ui-polish-p1`, sin ninguno de estos
  cambios). Se cubrió la misma verificación ejecutando sus 3 componentes
  por separado (`astro check`, `tsc -p wa-template-studio`, `tsc -p
  builder42`), los 3 con 0 errores.
- `npx vitest run` (raíz del worktree): **43/43 archivos de test, 303/303
  tests pasando**. Ninguno de los archivos modificados tiene test unitario
  dedicado (son estilos/constantes de MUI `sx`), consistente con lo
  anticipado en §7 — no se esperaba ni se encontró regresión.
- Sin lint aplicable a `packages/**` (excluido de ESLint en este repo,
  igual que en Builder42).
- **Verificación visual: pendiente del usuario.** Los 3 cambios son
  puramente de altura (`height`) en controles ya posicionados por sus
  contenedores flex/grid existentes — mismo tipo de cambio de bajo riesgo
  visual que `docs/53`, pero requiere confirmación humana en el editor
  real.

### Archivos tocados

`packages/email-builder-standalone/src/App/InspectorDrawer/
ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles.ts`,
`.../helpers/inputs/ColorInput/BaseColorInput.tsx`,
`packages/email-builder-standalone/src/theme.ts`. Ningún archivo de
Builder42 modificado — el cambio es unidireccional (bajar el Email
Builder a la referencia de Builder42), tal como se planteó en §3.

### Pendiente / fuera de esta sesión

- Commit de estos 3 archivos en la rama `fix/email-builder-inspector-input-height`
  — no realizado todavía; el usuario no ha pedido commitear, solo
  implementar. El worktree queda con los cambios sin commitear, listos
  para revisión.
- Confirmación visual del usuario en el editor real (Inspector del Email
  Builder), incluyendo el caso `ToggleButtonGroup` (`RadioGroupInput`)
  que no tiene equivalente pixel-perfect confirmado contra
  `.pbx-segmented__btn` más allá de la altura (radio, tipografía del
  texto interno no auditados en este documento — ver §6, "fuera de
  alcance", radio de borde).

