# Plan — dark mode del editor de email + pasos nuevos del tour

Continuación de [`docs/product-tour-driverjs-plan.md`](product-tour-driverjs-plan.md) (F1–F7, ya
implementado) con el feedback del uso real. Bitácora de orquestación: `.orquestacion/bitacora.md`
(decisiones D1–D24). Rama de trabajo: `feat/ui-polish-p1`.

**Alcance:** dos cosas independientes que se implementan por separado.

- **Parte A — dark mode.** El editor de email no sigue el tema del host, y por eso el popover del
  tour tampoco.
- **Parte B — pasos nuevos del tour de email.** Primitivos vs bloques compuestos, la galería de
  plantillas abierta, la paleta de comandos realmente abierta, y el sidebar de propiedades sobre un
  bloque de texto.

**Verificación:** los e2e (Playwright) **no** se corren en esta tanda, por decisión del usuario. Cada
tarea se cierra con las suites unitarias del paquete, `tsc` del paquete, `pnpm check`, `pnpm lint` y
la lectura del diff. La revisión visual la hace el usuario a mano.

---

## Estado: implementado en `feat/ui-polish-p1`

Las seis tareas de la serie (T1–T6) están hechas, un commit por tarea:

- **T1** (`8e4a79e`) — hook de host `useHostTheme` (`MutationObserver` sobre `data-theme`) +
  `darkMode` al `<Builder>` desde `VisualEmailBuilder.tsx`.
- **T2** (`11c3baf`) — la pestaña activa de la librería pasa al store (`componentsLibraryDrawerCategory`),
  con `resolveLibraryCategory` normalizando el valor leído.
- **T3** (`4953ce1`) — la pestaña Blocks se agrupa en *Básicos* / *Estructura*, cada grupo con su
  propia ancla; `groupBuiltInBlockIndices` devuelve índices sobre el `BUTTONS` original.
- **T4** (`1b24bcc`) + **T4b** (`3ebfea1`) — pasos y anclas de básicos/estructura/galería de
  plantillas, con la guarda compartida de restauración diferida de la librería; T4b corrigió
  títulos de paso que habían quedado en inglés en `es-419`/`it-IT`.
- **T5** (`c9e389a`) — el paso de la paleta de comandos abre y cierra la paleta de verdad, con
  guarda por `data-state` y `blur()` del input.
- **T6** (`a799e03`) — pasos y anclas nuevos `eb.canvas.textBlock` y `eb.inspector.tabs`, ambos
  omitidos vía `when()` cuando el documento no tiene un bloque `NotionText`.

Las cinco preguntas abiertas (§ "Decisiones que necesito de ti antes de implementar") se
resolvieron con los "asumo" del propio plan: **Q1** la galería es la pestaña Templates; **Q2** sí,
los tiles quedan agrupados en la UI (no solo explicados por copy); **Q3** los pasos que dependen
del documento se omiten con `when()`, nunca se siembra contenido; **Q4** el paso de texto señala la
superficie editable, no entra en modo edición en línea; **Q5** un solo paso de pestañas del
inspector, sin un tercer paso para *Styles*.

Durante la implementación se fijaron tres contratos que este plan no anticipaba:

- **D31** — un hook de host que necesita observar el DOM expone un núcleo sin DOM e inyectable
  (`normalizeHostTheme`, `readHostTheme`, `observeHostTheme` con una fábrica de observer
  inyectable), porque el entorno raíz de vitest es `node` (sin jsdom/happy-dom/`@testing-library`).
- **D32** — el agrupamiento de bloques (`groupBuiltInBlockIndices`) devuelve índices sobre el
  array `BUTTONS` original, nunca reindexa: el payload de drag (`buttonIndex`) y el
  click-to-insert resuelven contra ese array tal cual.
- **D33** — los cuatro pasos de la librería comparten una sola guarda de restauración diferida del
  drawer (`enterLibraryStep` / `leaveLibraryStep` / `flushLibraryStepRestore` en `tourSteps.ts`),
  en vez de que cada paso snapshot-ee y restaure por su cuenta.

**Lo que sigue sin verificar:** la suite e2e no se corrió en esta tanda, por decisión del usuario
(ver "Verificación" arriba) — sigue pendiente para cuando se retome esa suite. Tampoco nadie ha
mirado el editor en modo oscuro en un navegador real todavía: los riesgos de §A.3 (que el lienzo del
correo no se oscurezca, que el cambio de tema no pierda el documento en edición, el contraste real
del inspector) siguen pendientes de una revisión humana.

---

## Parte A — dark mode

### A.1 Causa raíz (medida, no supuesta)

El host y el editor no comparten canal de tema, y el editor nunca recibe el suyo:

| Hecho                                                                                             | Evidencia                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| El host marca el tema con `data-theme="light\|dark"` en `<html>` y lo persiste en `md-theme`       | `src/layouts/AppLayout.astro:47-53`, `src/layouts/BaseLayout.astro:21` |
| El toggle solo hace `setAttribute` + `localStorage.setItem`; **no** emite ningún evento            | `src/components/react/AppShell.tsx:189-196`                        |
| El editor de email se tematiza **solo** por la prop `darkMode` → `getTheme(...)` (MUI)             | `packages/email-builder-standalone/src/index.tsx:147, 304, 599`     |
| …y por la clase `.dark-email-builder` en su raíz (5 reglas en `global.css`: `pre`, `.preview-container`, `hljs-*`) | `packages/email-builder-standalone/src/App/index.tsx:340`           |
| El host **nunca pasa `darkMode`** al montar el editor                                             | `src/components/react/VisualEmailBuilder.tsx` (0 ocurrencias)       |
| El paquete del editor **nunca lee** `data-theme` ni `prefers-color-scheme`                        | `packages/email-builder-standalone/src` (0 ocurrencias)             |
| No existe **ningún** `MutationObserver` en `src/`: nadie observa cambios de tema en runtime        | `src/**` (0 ocurrencias)                                            |

Consecuencia para el popover del tour: en el editor de email las variables `--md-tour-*` se
estampan en runtime **desde el tema MUI activo**
(`buildEmailBuilderTourCssVars(theme)` en `packages/email-builder-standalone/src/tour/useEmailBuilderTour.ts`),
así que un tema MUI siempre claro produce un popover siempre claro. **No hay un segundo bug**: es el
mismo. En el editor de landings no ocurre porque ahí el mapeo es por CSS contra
`:root[data-theme="dark"]` (`packages/builder42/src/styles/chrome/{tour,dark}.css`).

### A.2 Diseño

1. **Un hook de host** que expone el tema actual y reacciona a los cambios:
   `src/components/react/hooks/useHostTheme.ts` (nombre a confirmar en implementación) —
   lee `document.documentElement.dataset.theme` en el primer render y observa ese atributo con un
   `MutationObserver` (`attributeFilter: ['data-theme']`). Se observa el atributo en vez de escuchar
   un evento propio para no tocar `AppShell` y para funcionar sea quien sea el que lo cambie (el
   script de pre-paint, el toggle, otra pestaña, o un futuro selector de tema).
2. **`VisualEmailBuilder.tsx` pasa `darkMode={theme === 'dark'}`** al `<Builder>`. Nada más cambia en
   el host.
3. **El popover del tour queda arreglado por consecuencia**: `useTourThemeVars(theme)` ya tiene el
   efecto con dependencia `[theme]` y repinta los popovers vivos cuando cambia el tema, además del
   `MutationObserver` que atrapa los popovers nuevos.

### A.3 Riesgos que la revisión manual debe mirar

- **El lienzo del correo no debe volverse oscuro.** El email es un documento claro por naturaleza;
  hoy existe una regla `.dark-email-builder .preview-container` en `global.css` cuyo efecto real no
  está verificado por nadie. Si el lienzo se oscurece, el arreglo es acotar esa regla — pero eso es
  una decisión visual, no técnica, y la toma el usuario mirándolo.
- **Cambiar de tema no debe perder el documento en edición.** El tema MUI está memoizado por
  `[primaryColor, secondaryColor, darkMode, portalContainer]`, así que cambia el tema sin remontar el
  editor. Hay que confirmarlo en el navegador (una edición sin guardar + toggle de tema).
- Contraste real de los controles del inspector en oscuro: es el tema MUI del paquete, no los tokens
  del host, así que puede no coincidir exactamente con la rampa cálida de Maildrill.

---

## Parte B — pasos nuevos del tour de email

### B.1 Lo que hay hoy (13 pasos, orden real)

`identity → save → status → views → screenSize → history → library.rail → library.tabs → canvas.root
→ inspector.panel → image.sources → commandPalette → header.actions`
(`packages/email-builder-standalone/src/tour/tourSteps.ts`).

Cada ancla vive en `tourAnchors.ts` (D2), cada paso necesita copy en **tres** locales
(`src/locales/{en-US,es-419,it-IT}/tour.json`) y hay tests que hacen cumplir la paridad
registro↔pasos↔copy (`tourSteps.flags.test.ts`, `tourSteps.i18n-parity.test.ts`,
`tourAnchors.render.test.tsx`) — la lección I2/D14 de la bitácora: **añadir un ancla obliga a añadir
su paso y su copy en los tres idiomas, en la misma tarea**.

### B.2 Los cuatro pedidos, uno por uno

#### (a) Separar primitivos de bloques compuestos

**Estado real:** la pestaña *Blocks* del drawer pinta los 8 bloques integrados en una rejilla plana
(Text, Social, Button, Image, Divider, Spacer, Columns, Container — `builtInBlocks.tsx` vía
`BlocksCategoryContent.tsx:145-152`), sin ninguna distinción entre primitivo y compuesto: mismo
componente de tile, sin envoltorio, clase ni `data-tour` que separe unos de otros. El catálogo
`primitivesCatalog.ts` (variantes ya estilizadas) **no se pinta en ninguna lista** hoy: sus únicos
consumidores son el drag-and-drop. Debajo, en la misma pestaña, va el listado de *Sections*
guardadas, separado solo por un `borderTop`.

**Por lo tanto un paso que "separe" ambos grupos exige que la UI muestre la separación.** Propuesta
(decisión **Q2** abajo): agrupar los 8 tiles bajo dos encabezados en la pestaña Blocks —
*Básicos* (Text, Image, Button, Divider, Spacer, Social) y *Estructura* (Columns, Container) — cada
grupo en su propio contenedor con su ancla. El listado de Sections ya tiene contenedor propio y puede
llevar una tercera ancla ("bloques compuestos guardados").

Resultado: **2 pasos nuevos** (básicos, estructura) y opcionalmente un 3.º (secciones guardadas).

#### (b) La galería abierta, mostrando esa tab, después de presentar los componentes

**Estado real:** el drawer tiene exactamente **dos** pestañas: `blocks` y `templates`
(`ComponentsLibraryDrawer.tsx:130-134`). Nada se llama "galería" en la UI; la pestaña *Templates* es
la rejilla de miniaturas de plantillas completas, que es lo que un usuario llamaría galería (ver
**Q1**). El ancla `eb.library.tabs` actual está en la **tira de pestañas**, no en el cuerpo.

**Bloqueo técnico:** la pestaña activa es un `useState` local del drawer
(`ComponentsLibraryDrawer.tsx:509`) — no hay forma de cambiarla desde fuera de React, que es lo que
un `before()` del tour necesita. Pero `EditorContext` **ya tiene** el campo y los setters para esto
(`componentsLibraryDrawerCategory`, `setComponentsLibraryDrawerCategory`,
`openComponentsLibraryDrawerOn`, líneas 116/200/933/958/967) y **están muertos**: el drawer no los
lee. El trabajo es conectar el `activeTab` del drawer a ese estado que ya existe (conservando el
comportamiento actual por defecto, y normalizando el valor por defecto `'sections'`, que ya no es una
pestaña válida).

Resultado: **1 paso nuevo** con ancla propia en el cuerpo de la pestaña Templates, cuyo `before()`
abre el drawer y cambia a `templates`, y cuyo `after()` restaura la pestaña anterior.

#### (c) La paleta de comandos abierta y señalada

**Estado real:** el ancla `eb.commandPalette` está sobre el propio diálogo de la paleta
(`CommandPalette/index.tsx:307`), y ese nodo lleva `hidden` mientras la paleta está cerrada (lo pone
el controlador de `@josecortez1/c42-core`). Es decir: **hoy el paso apunta a un elemento invisible**,
que es exactamente lo que el usuario reporta.

**Cómo se abre desde fuera de React** (leído en `@josecortez1/c42-core@0.1.0`, no supuesto):

- el controlador registra su hotkey en `document` **en fase de captura** y **no comprueba
  `isTrusted`** → un `KeyboardEvent('keydown', { key: 'k', ctrlKey: true })` despachado en `document`
  la abre igual que un usuario;
- `openPalette()` quita el `hidden`, pone `data-state="open"`, **enfoca el input** y activa un
  focus-trap que **solo intercepta `Tab`** (no `focusin`);
- la paleta **no** pone `role="dialog"` ni `aria-modal` (el input es `combobox`, la lista
  `listbox`);
- z-index de la paleta: `13000` (`CommandPalette/index.tsx:228`); el popover de driver.js:
  `1000000000` → **el popover queda por encima**, y `.driver-active *{pointer-events:none}` deja
  interactivos solo el elemento resaltado y el popover.

**Consecuencias que el diseño asume explícitamente:**

1. Con la paleta abierta el foco está en su input, así que las flechas del tour **no** navegan (D22:
   el motor no le roba las flechas a un campo de texto) y `Tab` queda atrapado en la paleta. Para que
   el paso siga siendo navegable por teclado, el `before()` **quita el foco del input** después de
   abrir (`blur()`): el trap solo actúa en los extremos del `Tab`, así que con el foco fuera el
   popover del tour vuelve a ser alcanzable.
2. Como la paleta no se anuncia como modal, la detección de "modal competidor" del motor (D11/D12)
   **no** la ve: con el tour activo, `Escape` cierra el tour y la paleta se queda abierta. Por eso el
   `after()` del paso la cierra, y por eso el cierre debe ser idempotente.
3. El toggle es un toggle: el `before()` lee `data-state` antes de despachar, para no cerrar una
   paleta que el usuario ya tenía abierta, y el `after()` la deja como la encontró.

Resultado: **el paso 12 existente cambia de comportamiento** (gana `before()`/`after()`), sin ancla
nueva.

#### (d) Sidebar de propiedades sobre un bloque de texto, edición en línea, content y style

**Estado real:**

- La edición en línea **existe** y es Tiptap (`packages/block-notion-text/src/index.tsx`): la
  superficie de lectura es `div.eb-notion-content[role="textbox"]` y al hacer clic entra en modo
  edición (`setNotionTextInlineEditingBlockId(blockId)`), pintando `.notion-text-inline-editor`.
- El inspector tiene pestañas reales *Content* / *Styles* (`InspectorDrawer/index.tsx:212-266`,
  valores `block-configuration` / `css` / `styles`), y `setSidebarTab(...)` es exportado y llamable
  desde fuera de React (`EditorContext.tsx:672`). `setSelectedBlockId(...)` ya elige la pestaña según
  el tipo de bloque.
- El ancla `eb.inspector.panel` está en el **contenedor completo** del inspector
  (`InspectorDrawer/index.tsx:184-186`), así que hoy no se puede señalar la tira de pestañas sola
  (esto es el mismo defecto de precisión que D16 arregló en el header).
- Para un bloque `NotionText`, el inspector **no** tiene campo de texto: el texto se edita en el
  lienzo. Sus paneles son tipografía y estilo.
- **El documento puede estar vacío** (`empty-email-message.ts:39-47`, `childrenIds: []`), y de hecho
  el paso `eb.inspector.panel` ya se salta con `when: () => !isDocumentEmpty()`.

Propuesta: **2 pasos nuevos** más el existente:

1. `eb.canvas.textBlock` — señala la superficie de texto del primer bloque `NotionText` del
   documento y explica que se edita en línea con un clic. **Sin** activar el modo edición (ver
   **Q4**): activarlo enfoca un `contenteditable`, y con eso el tour pierde las flechas (D22) y `Tab`
   se lo queda Tiptap.
2. `eb.inspector.tabs` — ancla nueva sobre la tira de pestañas del inspector; el `before()`
   selecciona el bloque de texto y deja el inspector en modo `full`; el copy explica Content vs
   Styles. (Opcional, **Q5**: un tercer paso que cambie a `css` y señale el cuerpo de estilos.)

Ambos pasos requieren que exista un bloque de texto: si no existe, se **omiten** (`when`) — el tour
no escribe en el documento del usuario (ver **Q3** y el contrato D27).

### B.3 Anclas nuevas (todas en `tourAnchors.ts`, D2)

| Clave                      | Dónde se estampa                                             | Paso |
| -------------------------- | ------------------------------------------------------------ | ---- |
| `eb.library.blocksBasics`  | grupo *Básicos* de la pestaña Blocks (nuevo contenedor)       | (a)  |
| `eb.library.blocksLayout`  | grupo *Estructura* de la pestaña Blocks (nuevo contenedor)    | (a)  |
| `eb.library.sections`      | listado de Sections guardadas (contenedor existente) — opcional | (a) |
| `eb.library.templates`     | cuerpo de la pestaña Templates (la galería)                   | (b)  |
| `eb.canvas.textBlock`      | `div.eb-notion-content` del bloque de texto seleccionado       | (d)  |
| `eb.inspector.tabs`        | tira de pestañas del inspector                                | (d)  |

Cada una: paso + copy en `en-US`, `es-419`, `it-IT`, y entrada en las listas de
`tourAnchors.render.test.tsx` (siempre presente vs. condicionada por interacción).

### B.4 Orden final propuesto (18 pasos)

```
 1 identity          10 blocks: estructura      (nuevo)
 2 save              11 templates / galería     (nuevo)
 3 status            12 canvas.root
 4 views             13 canvas.textBlock        (nuevo)
 5 screenSize        14 inspector.panel
 6 history           15 inspector.tabs          (nuevo)
 7 library.rail      16 image.sources
 8 library.tabs      17 commandPalette          (ahora abre la paleta)
 9 blocks: básicos   18 header.actions (Send test, siempre el último)
    (nuevo)
```

Criterio de orden: D17 — el orden sigue el ojo, no el registro. Los pasos de la librería van juntos
tras abrir el drawer; los del lienzo/inspector van juntos; "Send test" cierra.

**Nota:** 18 pasos es un tour largo. Si al verlo resulta pesado, el arreglo no es recortar copy sino
partirlo en dos tours ("lo básico" y "a fondo"), que es trabajo aparte y no está en este plan.

---

## Contratos nuevos (los fija el orquestador, no se delegan)

- **D25 — El tour nunca escribe en el documento del usuario.** Ningún `before()` inserta, borra ni
  modifica bloques. Los pasos que necesitan un bloque de texto se omiten con `when()` si no lo hay.
  Motivo: un tour que mete contenido de demo contamina la pila de undo y el autoguardado dispara un
  guardado que el usuario no pidió.
- **D26 — Todo `before()` que cambie estado de UI se revierte en `after()`, y ambos son
  idempotentes.** Ya es el patrón del drawer (`wasOpenBeforeStep`); se extiende a la pestaña de la
  librería, a la paleta de comandos y al inspector: se lee el estado previo, se aplica el cambio, y
  se restaura solo si lo cambiamos nosotros.
- **D27 — La paleta se abre despachando su propio hotkey, con guarda de estado, y se le quita el
  foco al input.** Se despacha `Ctrl+K` en `document` (el controlador escucha en captura y no valida
  `isTrusted`; verificado en `@josecortez1/c42-core@0.1.0`) solo si `[data-c42-command-palette]` no
  está ya en `data-state="open"`; después se hace `blur()` del input para que el tour conserve
  teclado. Alternativa descartada: forzar la re-creación del controlador cambiando `defaultOpen`
  — depende de un detalle no verificado del adaptador de React.
- **D28 — La pestaña activa de la librería pasa a vivir en `EditorContext`.** Se conecta el
  `activeTab` del drawer al campo `componentsLibraryDrawerCategory` que ya existe (hoy muerto), sin
  cambiar el comportamiento por defecto y normalizando valores que ya no correspondan a una pestaña
  visible. Motivo: es la única forma de que un `before()` cambie de pestaña, y reutiliza estado que
  ya está diseñado para esto en vez de añadir un campo nuevo.
- **D29 — Precisión de resaltado (D16 otra vez).** Ningún paso nuevo resalta un contenedor que
  incluya controles de los que no habla. Por eso `eb.inspector.tabs` es un ancla propia y no se
  reutiliza `eb.inspector.panel`.
- **D30 — El tema del editor lo decide el host, no el paquete.** El editor sigue recibiendo
  `darkMode` como prop (contrato actual del paquete, y lo que lo mantiene extraíble); es el host el
  que observa `data-theme`. El paquete no aprende a leer el DOM del host.

---

## Tareas (serie, un commit por tarea, gate del orquestador entre cada una)

| #  | Tarea                                                                                 | Scope                                                                                              |
| -- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| T1 | Dark mode: hook de tema en el host + `darkMode` al `<Builder>`                        | `src/components/react/hooks/useHostTheme.ts` (nuevo), `src/components/react/VisualEmailBuilder.tsx`, test nuevo en `tests/` |
| T2 | Pestaña de la librería gobernada por el store (D28)                                   | `packages/email-builder-standalone/src/App/ComponentsLibrary/ComponentsLibraryDrawer.tsx` + test    |
| T3 | Agrupar Básicos / Estructura en la pestaña Blocks + anclas de grupo (D29)              | `BlocksCategoryContent.tsx`, `tourAnchors.ts`, i18n `componentsLibrary.*` ×3, `tourAnchors.render.test.tsx` |
| T4 | Pasos + copy de (a) y (b): básicos, estructura, galería                               | `tour/tourSteps.ts`, `locales/*/tour.json` ×3, `tourSteps.flags.test.ts`                           |
| T5 | Paso de la paleta: abrir/cerrar con guarda + blur (D27)                                | `tour/tourSteps.ts` (+ helper propio del paquete), tests unitarios del helper                       |
| T6 | Pasos + anclas de (d): `eb.canvas.textBlock`, `eb.inspector.tabs`                      | `tourAnchors.ts`, `InspectorDrawer/index.tsx`, `packages/block-notion-text/src/index.tsx` (solo estampar el ancla), `tour/tourSteps.ts`, copy ×3, tests |
| T7 | Documentación + bitácora                                                              | `docs/AGENTS.md` (sección tours), este plan marcado como implementado, `.orquestacion/bitacora.md`  |

Orden por dependencia real: T1 es independiente (puede ir primera y la puedes revisar sola). T2 antes
de T4 (el paso de la galería necesita el setter). T3 antes de T4 (los pasos necesitan las anclas).
T5 y T6 son independientes entre sí.

**Gate por tarea** (sin e2e, por indicación del usuario): suite del paquete tocado
(`pnpm --filter <pkg> test`), `npx tsc -p packages/<pkg> --noEmit`, `pnpm check`, `pnpm lint` (los 3
errores preexistentes por nombre), lectura del diff completo y comprobación de mutación de los tests
nuevos. `pnpm build` una vez al final.

**Deuda que queda anotada, no ejecutada:** `tests/e2e/tour.spec.ts` camina el tour con un tope de 20
iteraciones y afirma títulos concretos; con 18 pasos sigue entrando, pero el spec habrá que revisarlo
cuando se vuelvan a correr los e2e (y B22 de la bitácora sigue pendiente: las flechas no tienen
cobertura de navegador).

---

## Decisiones que necesito de ti antes de implementar

- **Q1 — "la galería" = la pestaña *Templates* del drawer.** Es la única rejilla tipo galería con
  pestaña propia (la otra pestaña es Blocks). El selector de imágenes —galería del workspace /
  Unsplash / subida— ya tiene su paso (`eb.image.sources`, paso 16). Asumo Templates.
- **Q2 — Para separar primitivos de compuestos hay que agrupar los tiles en la UI** (dos encabezados
  en la pestaña Blocks). Es un cambio visual pequeño pero real, y sin él el paso apunta a una rejilla
  plana. ¿Lo hacemos? Alternativa sin tocar UI: un solo paso sobre toda la rejilla que explique la
  diferencia con palabras, y otro sobre el listado de Sections.
- **Q3 — Documento vacío.** Los pasos de texto/inspector se **omiten** si el documento no tiene
  bloques (D25: el tour no escribe en tu documento). La alternativa —insertar un bloque de demo y
  borrarlo— toca la pila de undo y el autoguardado. Asumo omitir.
- **Q4 — Edición en línea:** el paso **señala** la superficie de texto y explica que con un clic se
  edita, sin entrar en modo edición. Entrar de verdad enfoca el `contenteditable` y el tour pierde
  las flechas y el `Tab`. Asumo señalar.
- **Q5 — ¿Un tercer paso de inspector** que cambie a la pestaña *Styles* y señale su cuerpo, o basta
  con el paso de la tira de pestañas explicando ambas? Asumo un solo paso.

Si no dices lo contrario, implemento con los "asumo" de arriba, empezando por **T1 (dark mode)**, que
es la que puedes revisar de inmediato.
