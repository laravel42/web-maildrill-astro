# Plan — Presets de tamaño (sm/md/lg) para padding/margin en modo simple

Estado: **implementado** (modo simple). Fix ya aplicado por separado en esta
misma sesión: la opción de grosor de borde "Sin borde"/"No border" en
`BorderSimple.tsx` se renombró a `"0"` en los 3 locales (`en`/`es`/`it`,
clave `panel.border.widthNone`) porque el texto se cortaba en el trigger del
select migrado (`PbxSelect`, ver `native-select-migration-plan.md`).

## 0. Resumen de la implementación (este commit)

Las decisiones que estaban abiertas en §6 se resolvieron así:

1. **Escala sm/md/lg** (§5/§6.1): se reusa la escala YA tokenizada del sitio,
   `BASE_TOKENS.spacing` (`model/tokens.ts`): `sm = "8px"`, `md = "16px"`,
   `lg = "24px"`. No se inventaron valores nuevos — exportados como
   `AXIS_PRESET_PX` en `SidesGrid.tsx`.
2. **Agrupación** (§4/§6.3): **por EJE** (2 selects: X = left+right, Y =
   top+bottom), no por lado y sin toggle de agrupación adicional. Es la
   variante que coincide literalmente con "dos selects" del pedido original
   y cubre el caso más común (espaciados simétricos) sin agregar un tercer
   control nuevo al candado existente.
3. **Control visual** (§6.5): `PbxSelect` (dropdown), no un segmented de
   botones — como sugería el pedido original ("dos selects").
4. **Modo avanzado** (§6.4): sin cambios — sigue siendo `SidesGrid` con
   `NumericField` libre por lado, candado incluido. Solo el modo simple usa
   el control nuevo.
5. **Patrón de cableado**: se siguió EXACTAMENTE el precedente ya establecido
   por `layout.gridColumns` (fase 4) / `effects.boxShadow` (fase 5) /
   `appearance.border` (fase 6) en `StylePanel.tsx` — `RowDescriptor.control`
   en `sections.ts` NO cambia (sigue siendo `"sides"` para
   `spacing.padding`/`spacing.margin`); `StylePanel.tsx` decide, vía
   `isSimple`, si renderiza `SidesAxisPresets` (simple) o `SidesGrid`
   (avanzado) dentro del mismo bloque `if (row.control === "sides")`.

### Archivos tocados

- `panel/controls/SidesGrid.tsx` — añadidas funciones puras nuevas
  (`applyAxisPreset`, `axisPresetValue`, `AXIS_PRESET_PX`,
  `AXIS_PRESET_SIZES`, tipos `SpacingAxis`/`AxisPresetSize`), sin tocar
  `parseSides`/`serializeSides`/`SidesGrid` (componente) existentes.
- `panel/controls/SidesAxisPresets.tsx` (nuevo) — 2 `PbxSelect` (eje X/Y),
  sin candado ni `tokenAction` propios (no aplican a este control).
- `panel/StylePanel.tsx` — bloque `row.control === "sides"`: `isSimple ?
  <SidesAxisPresets/> : <SidesGrid/>`.
- `i18n/locales/{en,es,it}/inspector.json` — clave `panel.sidesAxisPresets`
  (`x`, `y`, `sizes.sm/md/lg`).
- `styles/chrome/inspector-panel.css` — `.pbx-sides-axis-presets` (grid de 2
  columnas iguales, label corto + select por eje).
- `packages/builder42/vitest.config.ts` + `package.json` (`scripts.test`,
  `devDependencies.vitest`) — el paquete no tenía runner de test propio;
  se añadió siguiendo el mismo patrón que `packages/wa-template-studio`
  (alias `@` → `src/`, `include: ["tests/**/*.test.ts"]`).
- `packages/builder42/tests/sides-axis-presets.test.ts` (nuevo) — 10 tests
  unitarios de `applyAxisPreset`/`axisPresetValue`/`AXIS_PRESET_PX`, sin
  React/DOM.

### Verificación

- `pnpm --filter builder42 test` → 10/10 tests verdes.
- `npx tsc -p packages/builder42 --noEmit` → sin errores.
- `astro check` (parte de `npm run typecheck`) → 0 errores, 0 warnings
  (2 hints preexistentes no relacionados).
- `packages/**` está excluido de ESLint en este repo (`eslint.config.js`,
  `ignores: ["packages/**"]") — no hay lint que correr para este paquete.

### Decisiones NO tomadas (fuera de alcance de este commit)

- No se agregó un toggle para elegir entre agrupación "por eje" y "por
  lado" en modo simple — si en el futuro se necesita el detalle por lado
  sin salir del modo simple, se puede evaluar entonces; hoy ese caso cae en
  el modo avanzado (`SidesGrid` completo).
- No se promovió la escala `sm/md/lg` de `AXIS_PRESET_PX` a una constante
  compartida fuera de `SidesGrid.tsx` — se referencia `BASE_TOKENS.spacing`
  solo en el comentario, no en código (evita un acoplamiento nuevo entre
  `SidesGrid.tsx` y `model/tokens.ts` para 3 valores literales que ya están
  documentados como iguales).

---

## 1. Problema (contexto original, previo a la implementación)


`spacing.padding` y `spacing.margin` (modo simple del panel de estilo) usan
hoy `SidesGrid` (`panel/controls/SidesGrid.tsx`): una rejilla 2×2 de 4
`NumericField` (uno por lado: top/right/bottom/left) + un candado para
vincular los 4 a un solo valor. Es potente pero pesado para el caso más
común en modo simple — el usuario casi siempre quiere "un espaciado chico/
mediano/grande", no escribir píxeles a mano lado por lado.

Pedido: en modo simple, reemplazar los inputs numéricos libres por
**selects de preset de tamaño** (`sm`/`md`/`lg`, a definir escala exacta),
organizados o bien **por lado** (top/right/bottom/left) o bien **por eje**
(X = left+right, Y = top+bottom) — a decidir en diseño (ver §4).

## 2. Patrón ya existente a reutilizar — `PresetNumeric`

`panel/controls/PresetNumeric.tsx` ya resuelve el mismo problema para
`typography.fontSize` (S/M/L) y `size.width` (Completo/Auto/Custom): un
segmented de presets + botón "Custom" que revela un `NumericField` cuando el
valor no coincide con ningún preset o el usuario pide edición libre. Reset
del panel (`commit("")`) siempre vuelve al modo presets.

**Decisión de diseño preliminar:** no reinventar el mecanismo de presets —
extender `SidesGrid` para que, en modo simple, cada celda (o cada par de
celdas si se agrupa por eje) use el mismo mecanismo preset/custom de
`PresetNumeric` en vez de un `NumericField` puro. La lógica de
parseo/serialización de shorthand (`parseSides`/`serializeSides`, ya
PURAS y testeadas) no cambia — solo cambia qué control edita cada
`SideValue` individual.

## 3. Alcance de "modo simple" vs "modo avanzado"

- El toggle simple/avanzado ya existe (`useExperienceLevel()`,
  `StylePanel.tsx`). Hoy `spacing.padding`/`spacing.margin` tienen
  `tier: "common"` — se muestran en AMBOS modos, siempre con `SidesGrid`
  completo (numérico libre).
- Este plan solo cambia el control en modo **simple**. En modo avanzado se
  mantiene `SidesGrid` con `NumericField` (edición numérica libre completa,
  necesaria para casos de precisión).
- Precedente de este patrón dual ya existe: `PresetNumeric` en
  `fontSize`/`width` no depende de `isSimple` (siempre presets con opción
  Custom) — a decidir si `padding`/`margin` siguen el mismo criterio
  (presets+Custom siempre) o si el modo avanzado directamente salta a
  `SidesGrid` clásico sin pasar por presets. Pendiente de decisión de
  producto, no solo técnica (ver §6).

## 4. Decisión pendiente — agrupación por LADO vs por EJE

Dos variantes posibles, a decidir antes de implementar:

**A. Por lado (4 selects)** — top/right/bottom/left, cada uno con su propio
preset sm/md/lg. Más control, mismo layout 2×2 que `SidesGrid` ya usa (misma
grid `grid-template-columns: 1fr 1fr`, mismos iconos de lado ya existentes
en `icons: Record<SideKey, ReactNode>`).

**B. Por eje (2 selects, X e Y)** — un preset para left+right (X) y otro para
top+bottom (Y). Menos control pero más rápido de usar para el caso común
(la mayoría de espaciados son simétricos por eje). Requiere una función
nueva de composición: `applyAxisPreset(axis: "x"|"y", preset, sides):
FourSides` — pura, análoga a `parseSides`/`serializeSides`.

Pedido del usuario menciona **ambas** ("lados y superior e inferior o X y
Y") — sugiere que quizás la decisión final sea ofrecer un selector de modo
de agrupación (candado ya cumple un rol parecido: candado activo = 1 preset
para los 4; candado inactivo = ¿4 selects o 2 por eje?). Sugerencia a
validar con el usuario al iniciar la implementación: reusar el candado
existente para colapsar de "por lado" a "1 solo valor" (todos vinculados),
y agregar un icono/toggle adicional para alternar entre "por lado" (4) y
"por eje" (2) cuando el candado está desvinculado — evita agregar un tercer
control nuevo y aprovecha el slot `pbx-sides-grid__actions` que ya existe.

## 5. Escala de tamaños — a definir

El pedido dice "sm, md, lg" pero no da valores en px/rem. Antes de
implementar, definir la escala (ver si el sitio ya tiene una escala de
espaciado en `DesignTokens`/tokens del sitio — revisar
`src/builder/model/tokens.ts` y `themePresets.ts` en la próxima sesión para
saber si hay una escala de `spacing` ya tokenizada que deba reusarse en vez
de hardcodear valores nuevos). Candidatos típicos (Tailwind-like, a
confirmar): `sm = 8px`, `md = 16px`, `lg = 24px` — o los valores que ya use
`themePresets.ts` si existen.

## 6. Preguntas abiertas para la próxima sesión

**Resueltas — ver §0 para la decisión final y su justificación.** El
razonamiento original de cada pregunta se conserva abajo sin editar, como
contexto de por qué se decidió lo que dice §0.

1. ¿La escala sm/md/lg reusa tokens de espaciado ya existentes en el sitio,
   o son 3 valores fijos hardcodeados en el propio componente (como
   `BORDER_SIMPLE_WIDTHS` en `BorderSimple.tsx`)?
2. ¿Se ofrecen 3 presets (sm/md/lg) o más (siguiendo el patrón de
   `fontSize` que usa S/M/L, ¿son los mismos 3 valores o una escala propia
   de espaciado?)?
3. ¿Agrupación por lado (4 selects), por eje (2 selects), o ambas con un
   toggle (ver §4)? Definir antes de tocar código.
4. ¿El modo avanzado conserva el `SidesGrid` numérico actual sin cambios,
   o también pasa a presets con opción "Custom" (como ya hace
   `PresetNumeric` para `fontSize`/`width`, sin diferenciar simple/avanzado)?
5. Reusar `PbxSelect` (recién migrado en `native-select-migration-plan.md`)
   para los selects de preset, en vez de un nuevo `pbx-segmented` tipo
   `PresetNumeric` — a decidir cuál de los dos patrones visuales calza mejor
   aquí (segmented de botones vs. dropdown). El pedido dice literalmente
   "dos selects" — sugiere dropdown (`PbxSelect`), no segmented de botones.

## 7. Archivos que muy probablemente se van a tocar (estimado, no definitivo)

- `packages/builder42/src/builder/inspector/panel/controls/SidesGrid.tsx` —
  añadir el modo preset (posiblemente una nueva prop `simple: boolean` o un
  componente hermano `SidesGridSimple.tsx`).
- `packages/builder42/src/builder/inspector/panel/StylePanel.tsx` — pasar
  `isSimple` a `SidesGrid`/al nuevo componente.
- `packages/builder42/src/builder/inspector/panel/sections.ts` — si la
  agrupación por eje requiere metadata nueva en `RowDescriptor`.
- i18n: nuevas claves para labels de preset (`panel.spacing.presetSm/Md/Lg`
  o similar) en `en`/`es`/`it`.
- Posible archivo nuevo de funciones puras si se elige agrupación por eje
  (`applyAxisPreset`, tests unitarios análogos a los de `parseSides`).
