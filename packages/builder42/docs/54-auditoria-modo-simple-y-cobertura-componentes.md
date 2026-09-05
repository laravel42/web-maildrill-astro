# 54 — Auditoría: modo simple del Inspector y cobertura del catálogo de componentes

Fecha: 2026-09-04 · Alcance: `packages/builder42` · Tipo: auditoría (no cambia código)

Pregunta que motiva el documento: *el builder parece listo, pero ¿el modo simple está
correcto, y los componentes que hay alcanzan — sobre todo los más complejos, que parecen
tener poca forma de editarse?*

Todo lo afirmado aquí se verificó leyendo el código de este repo. Cuando algo no se pudo
comprobar se dice explícitamente. Las citas son `archivo` o `archivo:línea`.

---

## 0. Veredicto en tres frases

El modo simple **funciona y su arquitectura es sana** (descriptor puro + gateo por `tier` +
sustitución de control por fila), pero tiene **un agujero de producto real**: 10 de 28 filas
desaparecen del DOM sin dejar rastro, y si esas propiedades ya tienen valor el usuario ve el
efecto en el canvas sin poder editarlo ni resetearlo — y el badge de "modificados" de la
sección **sí las cuenta**, así que el contador no cuadra con lo que se puede tocar.

El catálogo de componentes es **amplio (36 definiciones) y los dos composites reales
(`tabs`, `accordion`) sí tienen un gestor de items completo** — la percepción de "los
complejos no se pueden editar" no aplica a ellos; aplica a los componentes cuyo contenido
repetible **no** es slots ni `options-list`: `pricing-card` (features en un `<input>` de una
línea partido por `\n`), `logo-cloud` y `form` (contenido 100 % por hijos, `propsSchema`
vacío o casi).

El hueco más serio no es de UI sino de **modelo**: `StyleProperties` no tiene `opacity`,
`position`/`zIndex`, `transform`/`transition`, `objectFit`, `aspectRatio`,
`letterSpacing` ni `textTransform` — límites duros para landings modernas, invisibles
mientras no se intentan. Y la cobertura de test del paquete es **1 archivo**, con dos
tests citados en comentarios que **no existen**.

---

## 1. Cómo funciona el modo simple hoy

Fuente única: `hooks/useExperienceLevel.ts` (envuelve `useLocalConfig("experienceLevel")`,
default `"advanced"`). Consumidores con lógica real: **solo `panel/StylePanel.tsx`**.
`panel/sections.ts` es puro (declara `tier`, no gatea). El resto son UI del switch
(`app/layout/ExperienceLevelToggle.tsx`, `OnboardingExperienceModal.tsx`, `ProfileMenu.tsx`)
y un gateo de tabs de sitio hoy inerte (`SiteSettingsPanel.tsx`, `SIMPLE_HIDDEN_TABS` es un
`Set` vacío desde el revert de 2026-08-28).

### 1.1 Tabla fila → control por modo

`common` = visible en ambos modos. `advanced` = oculta en simple, salvo las 3 de
`ALWAYS_VISIBLE_ADVANCED_ROW_IDS` (`StylePanel.tsx`).

| Sección | `row.id` | tier | Avanzado | Simple |
|---|---|---|---|---|
| layout | `layout.display` | common | `IconSegmented` (6 opc.) | mismo, 3 opc. (`flex/grid/block`) |
| layout | `layout.direction` | common | `IconSegmented` (4) | mismo, 2 (`row/column`) |
| layout | `layout.justify` | common | `IconSegmented` (6) | mismo, 3 |
| layout | `layout.align` | common | `IconSegmented` (5) | **sin restringir** (inconsistencia menor) |
| layout | `layout.gap` | common | `PresetNumeric` | igual |
| layout | `layout.wrap` | advanced | `IconSegmented` | **oculta** |
| layout | `layout.overflow` | advanced | `PairGrid` 2 selects | **oculta** |
| layout | `layout.gridColumns` | advanced* | `ChipsTextField` | `GridColumnsSimple`, solo si `display:grid` |
| layout | `layout.cell` | advanced | `PairGrid` 2 inputs | **oculta** |
| spacing | `spacing.padding` | common | `SidesGrid` (4 números + candado + token) | `SidesAxisPresets` (2 selects X/Y) |
| spacing | `spacing.margin` | common | `SidesGrid` | `SidesAxisPresets` |
| size | `size.width` | common | `PresetNumeric` | igual (en `icon`: fila fusionada "Tamaño") |
| size | `size.height` | common | `PresetNumeric` | igual (en `icon`: omitida) |
| size | `size.minHeight` | advanced | `NumericField` | **oculta** |
| size | `size.maxWidth` | advanced | `NumericField` | **oculta** |
| typography | `typography.fontSize` | common | `PresetNumeric` | igual |
| typography | `typography.color` | common | `ColorField` + hex | `ColorField` sin hex |
| typography | `typography.align` | common | `IconSegmented` | igual |
| typography | `typography.weight` | common | `PresetNumeric` | igual |
| typography | `typography.family` | advanced | `PbxSelect` **sin opciones** (ver H2) | **oculta** |
| typography | `typography.lineHeight` | advanced | `NumericField` | **oculta** |
| typography | `typography.decoration` | advanced | `IconSegmented` | **oculta** |
| appearance | `appearance.background` | common | `ColorField` + hex | sin hex |
| appearance | `appearance.borderRadius` | common | `PresetNumeric` | igual |
| appearance | `appearance.border` | advanced* | `CommittableInput` (shorthand) | `BorderSimple` (grosor/tipo/color) |
| effects | `effects.boxShadow` | advanced* | `CommittableInput` | "Ninguna" + `PresetSegmented` S/M/L |
| effects | `effects.cursor` | advanced | `PbxSelect` | **oculta** |
| effects | `effects.outline` | advanced | `CommittableInput` | **oculta** |

Total: 28 filas / 30 campos. **10 filas desaparecen en simple**: `layout.wrap`,
`layout.overflow`, `layout.cell`, `size.minHeight`, `size.maxWidth`, `typography.family`,
`typography.lineHeight`, `typography.decoration`, `effects.cursor`, `effects.outline`.
Los 30 campos existen en `STYLE_FIELDS`, así que `rowIsRenderable` no filtra ninguna hoy.

---

## 2. Hallazgos del modo simple

### H1 — 🔴 Valor declarado en una fila oculta: invisible, no editable, no reseteable — y el badge lo cuenta

`StylePanel.tsx` (`StylePanelSection`): con `showAdvanced === false`, las filas `advanced`
que no están en `ALWAYS_VISIBLE_ADVANCED_ROW_IDS` no se renderizan (ni colapsadas, ni con
chevron). Pero `modifiedCountAt` (`sections.ts`) recorre `section.rows` **sin filtrar por
tier ni por modo**, así que una sección puede mostrar "2 modificados" con una sola fila
editable a la vista.

Consecuencia concreta: un nodo con `overflowX: "scroll"` o `lineHeight: 2.5` (puesto en modo
avanzado, heredado de un breakpoint, o venido del `defaultStyle` del componente) scrollea o
se ve espaciado en el canvas, y el usuario en simple no tiene ningún control ni pista para
tocarlo. El único caso resuelto correctamente es `layout.gridColumns`, que permanece visible
condicionalmente.

Propuestas (de menor a mayor esfuerzo):
1. Hacer que `modifiedCountAt` acepte el tier visible y no cuente lo oculto — quita la
   contradicción del badge, pero deja el valor igualmente inalcanzable.
2. **Recomendada:** revelar la fila `advanced` en modo simple **solo si tiene valor
   declarado o heredado** (misma consulta que ya hace `resolveValueOrigin`), marcada como
   "avanzada" y con su botón de reset. El panel sigue limpio para un nodo nuevo, y nunca hay
   un estilo activo sin control.
3. Alternativa mínima: un pie de sección "N ajustes avanzados activos — ver en modo
   avanzado" que al menos informe y ofrezca salida.

### H2 — 🔴 La fila "Fuente" es un `<select>` vacío en modo avanzado

`sections.ts` declara `typography.family` con `control: "select"`, pero el campo
`fontFamily` de `styleFields.ts` es `control: "text"` con `placeholder: "Inter,
sans-serif"` y **sin `options`**. `renderRowControl` (caso `"select"`) hace
`field?.options ?? []` → `PbxSelect` con lista vacía. No hay ningún caso especial para
`fontFamily` en todo `builder/inspector` (grep de `fontFamily|googleFont|FONT_` → 0
resultados).

Resultado: la tipografía solo se puede cambiar vinculando el campo a un token
(`typography.families.*`, vía `tokenGroupForField`), nunca eligiendo un valor libre — y en
modo simple la fila ni aparece. El paquete tiene un catálogo de Google Fonts generado
(`registry/catalogs/generated/googleFonts.names.ts`) que este control no usa.

Propuesta: poblar las opciones con las familias del sitio (`site.meta.tokens.typography.
families`) + `searchable-select` contra el catálogo generado, o degradar la fila a `"text"`
para que al menos sea editable. Y promover la fila a `common`: elegir tipografía es una
decisión de diseño básica, no avanzada.

### H3 — 🟠 Los controles `pair` no dicen qué es cada mitad

`StylePanel.tsx` (bloque `row.control === "pair"`) etiqueta las dos mitades como
`` `${label} A` `` y `` `${label} B` ``, y `PairGrid.tsx:36` solo envuelve cada celda en
`role="group" aria-label={field.ariaLabel}`. Afecta a las dos filas `pair` existentes:
`layout.overflow` (X/Y) y `layout.cell` (columna/fila). Un lector de pantalla anuncia
"Overflow A", no "Overflow horizontal"; visualmente no hay nada que distinga los dos
selects.

Propuesta: usar el `label` real de cada `StyleFieldDef` (ya existen: "Overflow X",
"Overflow Y", "Celda: columna", "Celda: fila") como `aria-label`, y añadir un mini-label
visible por mitad — el patrón ya resuelto en modo simple por `SidesAxisPresets` para
padding/margin. Es el mismo arreglo que se pidió recientemente para overflow.

### H4 — 🟠 Cinco mecanismos distintos de "simple vs avanzado" sin abstracción común

En `StylePanel.tsx` coexisten: (1) `SIMPLE_SEGMENTED_VALUES` (filtra opciones),
(2) `ALWAYS_VISIBLE_ADVANCED_ROW_IDS` (fuerza visibilidad), (3) caso `node.type === "icon"`
(fusiona dos filas con commit espejo), (4) caso `layout.gridColumns` (visibilidad
condicionada a otro campo + control alterno), (5) casos `effects.boxShadow` /
`appearance.border` / `row.control === "sides"` (solo sustituyen control, con el bloque
`PropertyField` + ternario repetido íntegro en cada uno).

El propio código justificó no generalizar con "sería especular… si aparece un segundo caso
real, ahí se justifica". Ya hay **dos** casos de visibilidad condicional y **tres** de
sustitución de control. La premisa caducó y no se revisó.

Propuesta: extender `RowDescriptor` con dos campos opcionales — `simpleControl` (id del
control alterno) y `visibleIf` (predicado declarativo, p. ej. `{ field: ["layout",
"display"], equals: "grid" }`) — y dejar `StylePanel` como un dispatcher sin `if (row.id
=== …)`. Beneficio secundario: los casos especiales pasan a ser testeables como datos puros.

### H5 — 🟡 Sección "Efectos" con una sola fila en modo simple

De sus 3 filas, `cursor` y `outline` son `advanced`: en simple queda solo la sombra. Una
sección con un único control es ruido de encabezado. Opciones: mover la sombra a
"Apariencia" en modo simple, o promover `cursor` a `common` (es semántica de interacción,
no CSS de bajo nivel).

### H6 — 🟡 `GridColumnsSimple` pierde datos sin avisar en el momento

Su propio docblock documenta que sobreescribe cualquier `gridTemplateColumns` avanzado no
compatible (`"200px 1fr 100px"` → `repeat(N, 1fr)`) y que "no se ofrece un mecanismo de
recuperación". Es una decisión de producto, pero el control no muestra ningún aviso in-situ
antes de destruir el valor. Propuesta: si `parseColumnCount` no reconoce el valor actual,
mostrar el valor original como hint y pedir confirmación explícita al primer cambio.

### H7 — 🟡 El "modo simple" solo simplifica Estilo, no el Inspector

`form/PropsSection.tsx`, `controls/propControls/registry.tsx`, `BehaviorsSection.tsx` y
`NodeClickActionSection.tsx` no consultan `useExperienceLevel` en ningún punto (grep: 0
referencias). Un usuario en modo simple no ve `line-height`, pero sí el editor completo de
behaviors (carousel, parallax, scroll-spy con sus `optionsSchema` técnicos) y de acciones de
click (targets por `NodeId`, params crudos). No hay ningún docblock que declare esto como
decisión deliberada — contrasta con lo minuciosamente documentado en `StylePanel.tsx`.

Propuesta: decidir y **escribirlo**. Si el alcance es solo estilos, renombrar el concepto en
la UI ("estilos simples/avanzados"); si es transversal, empezar por ocultar en simple los
behaviors de categoría técnica y los params de bajo nivel de las acciones.

---

## 3. Cobertura del panel frente al modelo (y del modelo frente a CSS)

### 3.1 Campos que el modelo tiene y el Inspector no puede editar

No están en `STYLE_FIELDS`, por tanto ninguna fila los referencia — inalcanzables en **ambos**
modos:

| Campo del modelo | Por qué importa |
|---|---|
| `appearance.borderColor` / `borderWidth` / `borderStyle` | Son **la** vía recomendada por `registry/components/AGENTS.md` §2.7 para un borde ligado a token (el shorthand `border` no acepta color-token). El modelo las tiene, el panel no las expone: la guía de componentes pide algo que el usuario no puede editar. |
| `layout.gridTemplateRows`, `gridAutoFlow`, `justifyItems`, `placeItems` | Grid queda a medias: se definen columnas pero no filas ni auto-flow. |
| `layout.appearance` (CSS `appearance`) | Usada por inputs/selects para quitar el estilo nativo; solo llega vía `defaultStyle`. |

### 3.2 Propiedades que el modelo entero no tiene

`StyleProperties` (`model/types.ts`) no declara: `opacity`, `position` / `top·left·right·
bottom` / `zIndex`, `transform`, `transition`, `objectFit`, `aspectRatio`, `letterSpacing`,
`textTransform`, `backgroundImage` / `backgroundSize` / `backgroundPosition` (el fondo es
solo color).

Impacto para landings reales: no hay superposición de elementos (hero con imagen detrás del
texto), ni recorte de imágenes (`object-fit: cover` es lo primero que se necesita al poner
una foto en una caja de proporción fija), ni transiciones propias, ni `letter-spacing` /
`text-transform` (dos recursos casi obligatorios en tipografía de landing), ni imagen de
fondo de sección. Varios se pueden emular con behaviors o con hijos, pero no con estilo.

Prioridad sugerida si se abre este frente: `objectFit` + `aspectRatio` (imágenes) →
`letterSpacing` + `textTransform` (tipografía) → `opacity` → `backgroundImage` →
`position`/`zIndex` (el más invasivo: toca canvas, DnD y serializador).

---

## 4. Componentes: qué se puede editar y qué no

36 definiciones (array `DEFINITIONS` de `componentRegistry.ts`) en 35 archivos de
`registry/components`: `Button.tsx` aporta dos, `buttonDefinition` y
`buttonSubmitDefinition`. El mecanismo de edición de contenido repetible **solo existe en
tres formas**:

- **Slots** (`def.slots` + `CompositeSlotsSection`): añadir, seleccionar, reordenar (flechas
  en touch, DnD en desktop) y borrar con guarda de mínimo. Solo lo usan `tabs`
  (`Tabs.tsx:171`) y `accordion` (`Accordion.tsx:96`), con sus items `tab`
  (`Tab.tsx:67`) y `accordion-item` (`AccordionItem.tsx:87`). **Este mecanismo está bien
  resuelto**: es la respuesta a "los componentes complejos no se pueden editar" para tabs y
  acordeón.
- **`options-list`** (`OptionsListControl`): `breadcrumb.items` (`Breadcrumb.tsx:123`),
  `select.options` (`Select.tsx:174`), `social-links.links` (`SocialLinks.tsx:228`).
- **`page-visibility-list`**: `navbar.hiddenPageIds` (`Navbar.tsx:251`) y
  `nav-menu.hiddenPageIds` (`NavMenu.tsx:105`) — los enlaces se derivan de las páginas del
  sitio, aquí solo se ocultan. Es diseño intencional, no un hueco.

### 4.1 Los casos que sí son un problema

| Componente | Contenido repetible | Cómo se edita hoy | Veredicto |
|---|---|---|---|
| `pricing-card` | Lista de features | `propsSchema` declara `features` con `control: "text"` → `CommittableInput`, un `<input>` de **una línea**; el render hace `featuresRaw.split("\n")` (`PricingCard.tsx:119-120`) | 🔴 **Roto en la práctica**: no se puede teclear un salto de línea en un input de una línea; solo funciona pegando texto multilínea. Arreglo directo: `control: "options-list"`, igual que `breadcrumb`/`social-links` |
| `logo-cloud` | N logos | `propsSchema: { fields: [] }`, `acceptsChildren: true`, sin `defaultChildren`. Nace vacío (con placeholder de drop, `LogoCloud.tsx:117,145`) y se llena arrastrando imágenes | 🟠 Funciona pero es artesanal: no hay "añadir logo", ni tamaño/columnas por props |
| `form` | N campos | `acceptsChildren`, 3 props (`action`, `method`, `noValidate`). Los campos son hijos `input`/`label`/`textarea`/`select` puestos a mano | 🟠 Aceptable como primitiva, pero sin plantilla ("formulario de contacto con 3 campos") el coste de armarlo es alto |
| `hero`, `card`, `section`, `container`, `footer`, `modal` | Hijos libres | Canvas + `LayersTree`, con placeholder de vacío | ✅ Correcto: son contenedores, no listas |

Mitigación importante que hay que tener en cuenta antes de invertir aquí: el paquete trae
**17 páginas y 11 secciones** preconstruidas (`registry/layouts/pages/*.ts`,
`layouts/sections/*.ts`) que ya contienen estos componentes armados. El flujo real de un
usuario es "insertar sección y editar", no "montar un logo-cloud desde cero" — lo que baja
la severidad de los dos casos 🟠, pero no la de `pricing-card`, que está roto también dentro
de una plantilla.

### 4.2 Huecos de catálogo

Priorizados por lo que una landing pide y hoy no se puede expresar:

1. 🔴 **`checkbox` / `radio`** — `input` solo ofrece `text`, `email`, `tel`, `number`,
   `password` (`Input.tsx`). Sin checkbox no hay casilla de consentimiento: cualquier
   formulario de captación de leads con aviso de privacidad es inexpresable.
2. 🟠 **Galería / grid de imágenes** — hoy es un `container` con `display:grid` y N `image`
   a mano; con `gridTemplateRows` ausente (§3.1) el control es parcial. Con `lightbox` ya en
   behaviors, el componente cerraría el caso.
3. 🟠 **Lista con bullets** — `text` es richtext (Tiptap), así que puede haber listas dentro
   de un párrafo, pero no hay un componente de lista con icono por item (patrón de "features"
   por excelencia).
4. 🟡 **Embed / iframe** — `video` cubre YouTube/Vimeo; no hay mapa, calendario ni
   formulario externo.
5. 🟡 **Tabla** — precios comparados, especificaciones.
6. 🟡 **`input type=file` / `date`** — formularios de reserva y candidaturas.

No propongo carrusel, marquesina, contador, reveal ni sticky: ya existen como **behaviors**
(`registry/behaviors/carousel.ts`, `marquee.ts`, `countUp.ts`, `revealOnScroll.ts`,
`sticky.ts`, `lightbox.ts`, …), aplicables a contenedores.

### 4.3 Componente sin uso

`nav-menu` no aparece en ninguna de las 17 páginas ni las 11 secciones (grep de
`"nav-menu"` sobre `registry/layouts` → 0 resultados). Está registrado, traducido y
mantenido, pero ninguna plantilla lo ejercita: o se usa en una plantilla nueva, o se
documenta como componente "solo a mano", o se retira.

---

## 5. Controles, i18n y accesibilidad

- **i18n de props: hueco grande.** Los `label` de todos los `propsSchema` son literales en
  español (`PricingCard.tsx` "Nombre del plan", `Form.tsx` "Action (URL)", `Input.tsx`
  "Tipo"/"Requerido", …), incluidas las etiquetas de las opciones de `select`. El chrome del
  editor sí está traducido a es/en/it. Un usuario en inglés ve el Inspector traducido y la
  tab Props entera en español. El patrón correcto ya existe en el paquete
  (`OptionsSchemaField` recibe el label ya traducido) pero nunca se extendió al catálogo.
  `registry/components/AGENTS.md` §3.3 lo dejó explícitamente "por decidir"; conviene
  decidirlo ya, porque cada componente nuevo agranda la deuda.
- **Label sin asociar (tab Props).** `PropField.tsx` pinta el label como
  `<span className="pbx-control__label">`, sin `htmlFor`/`id`/`aria-labelledby` hacia el
  control. El panel de Estilo sí lo hace bien (`PropertyRow.tsx` documenta y aplica
  `controlId` o el patrón `role="group" aria-labelledby`). Arreglar `PropField` es local y
  de bajo riesgo.
- **Segmentados de selección única con semántica de botones.** `IconSegmented.tsx:54,62`,
  `PresetSegmented.tsx:52,60` y `PresetNumeric.tsx:76,88` usan `role="group"` +
  `aria-pressed` en vez de `radiogroup`/`radio` + `aria-checked`. Funciona con teclado, pero
  un lector de pantalla no anuncia "1 de 3".
- **Ayuda contextual ausente donde más se necesita.** En modo avanzado, `border`,
  `box-shadow`, `grid-template-columns` y `outline` son texto libre con shorthand CSS y
  ninguno tiene `FieldHelp`. En modo simple están resueltos con presets; es decir, la ayuda
  falta exactamente en el modo donde el campo es crudo.

Nota: las recomendaciones de los cuatro documentos previos de `docs/` (altura de controles a
32 px, migración a `PbxSelect`, chrome de inputs nativos, presets de espaciado por eje) están
aplicadas en el código; no hay deuda funcional pendiente de ahí.

---

## 6. Tests: el riesgo transversal

El paquete tiene **un único archivo de test**: `tests/sides-axis-presets.test.ts` (glob
`**/*.{test,spec}.{ts,tsx}` sobre `packages/builder42` → 1 resultado). Cubre las funciones
puras de presets por eje de `SidesGrid`.

Dos tests citados en comentarios del código **no existen**:

- `sections.ts` afirma que el invariante "una propiedad de estilo vive en exactamente una
  fila de una sección" *"se verifica mecánicamente en `sections.test.ts`"*.
- `StylePanel.tsx` remite a `StylePanel.test.tsx` para el caso del valor guardado fuera del
  subconjunto simple.

Sin cobertura: `sectionsForNode` / `rowsFor` / `modifiedCountAt` / `rowIsRenderable`
(funciones puras, triviales de testear), `parseBorderShorthand` / `serializeBorderShorthand`
(`BorderSimple`), `parseColumnCount` / `columnCountToTemplate` (`GridColumnsSimple`, el de la
pérdida de datos de H6), `parseMeasure` / `stepValue` (`NumericField`), y cualquier montaje
de `StylePanel` con `isSimple` para verificar qué filas aparecen. Ninguno de los hallazgos
H1–H7 tiene test que lo detecte si se regresiona.

---

## 7. Plan sugerido

**P0 — correcciones de defecto (pequeñas, con test)** — ✅ implementado 2026-09-04

1. ✅ `pricing-card.features` → nuevo control `"string-list"` (`StringListControl.tsx`,
   registrado en `propControls/registry.tsx` y `registry/types.ts`). Mismo formato de dato
   (`"\n"`-joined) que ya consumía `PricingCard.tsx` — no cambia el modelo, solo la UI de
   edición (antes un `<input>` de una línea).
2. ✅ Fila "Fuente": `sections.ts` la declara ahora `control: "searchableSelect"`,
   `tier: "common"`. `StylePanel.tsx` la alimenta con `tokens.typography.families` (del
   sitio) + `GOOGLE_FONT_ENTRIES` (catálogo generado) vía `SearchableSelectControl` — el
   usuario también puede escribir un stack CSS libre.
3. ✅ Labels de los `pair`: `PairGrid.tsx` acepta `visibleLabel` (mini-label visible por
   celda); `StylePanel.tsx` usa el `StyleFieldDef.label` real de cada campo (p. ej.
   "Overflow X"/"Overflow Y") como `aria-label` y como mini-label, en vez de `"{label} A/B"`.
4. ✅ `modifiedCountAt` (`sections.ts`) acepta un 4º argumento `isSimple` (default `false`,
   retrocompatible): con `true`, no cuenta filas `advanced` ocultas en modo simple (salvo las
   de `ALWAYS_VISIBLE_ADVANCED_ROW_IDS`, movida de `StylePanel.tsx` a `sections.ts` para
   compartirla). `StylePanelSection` pasa `!showAdvanced`.
5. ✅ `PropField.tsx`: el label ahora es `<span id={labelId}>` y el contenedor lleva
   `role="group" aria-labelledby={labelId}` — mismo patrón WAI-ARIA que ya resolvía
   `PropertyRow.tsx` para controles sin un único `id` nativo.

Tests nuevos: `tests/sections.test.ts` (14 tests: `rowIsRenderable`, `sectionsForNode`,
`rowsFor`, `ALWAYS_VISIBLE_ADVANCED_ROW_IDS`, y el caso H1 de `modifiedCountAt` con
`isSimple`). Suite completa del paquete: 24/24 tests verdes (`npx vitest run`). Typecheck
(`tsc --noEmit -p packages/builder42/tsconfig.json`) sin errores.

No implementado en esta pasada (queda para una sesión aparte, según lo acotado del pedido):
H1 opción 2 completa (revelar CUALQUIER fila avanzada con valor declarado — aquí solo se
corrigió el badge, el agujero de "invisible/no editable" sigue abierto salvo para las 3 filas
de `ALWAYS_VISIBLE_ADVANCED_ROW_IDS`), y el resto de P1/P2.

**P1 — decisiones de producto del modo simple**

6. Revelar filas avanzadas con valor declarado, marcadas y con reset (H1, opción 2).
7. Declarar por escrito el alcance del modo simple y aplicarlo a Props/Interactividad o
   renombrar el concepto (H7).
8. `checkbox` / `radio` en `input` (§4.2.1) — desbloquea formularios con consentimiento.
9. Tests de las funciones puras y del invariante de `sections.ts` (§6).

**P2 — inversión estructural**

10. Generalizar los casos especiales a `RowDescriptor.simpleControl` + `visibleIf` (H4).
11. Ampliar el modelo: `objectFit`/`aspectRatio`, `letterSpacing`/`textTransform`,
    `opacity`, `backgroundImage`; exponer `borderColor`/`borderWidth`/`borderStyle`
    (§3.1–3.2).
12. i18n de los `propsSchema` de los 36 componentes (§5).
13. Componente de galería y de lista con iconos (§4.2).

---

## 8. Qué no se verificó en esta auditoría

- Comportamiento en runtime del navegador (no se ejecutó el editor): todos los hallazgos se
  derivan de lectura de código, no de reproducción manual. H1, H2 y el caso de
  `pricing-card` son deducciones directas del código y conviene confirmarlas en pantalla
  antes de cerrarlos.
- Export HTML/CSS y su fidelidad respecto al canvas.
- Rendimiento del panel con documentos grandes.
- Este paquete es una copia vendorizada dentro del repo de Astro; si el proyecto original de
  Builder42 tiene más tests, no están aquí y por tanto no protegen a este código.
