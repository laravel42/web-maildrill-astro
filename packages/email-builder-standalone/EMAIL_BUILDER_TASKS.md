# Email Builder — puntos de trabajo (UI/UX)

> Documento de referencia para centrar los cambios pedidos sobre
> `email-builder-standalone`. Trabajo aislado en la rama
> `work/email-builder-isolated` — **no se commitea** hasta indicación
> explícita. Cada punto lista el objetivo, los archivos candidatos
> (ubicados por exploración del código, a confirmar al implementar) y
> el estado.

Rama: `work/email-builder-isolated`
Bypass de auth activo en local vía `SKIP_AUTH_FOR_BUILDER_WORK=true` (`.env`, no versionado).

---

## 1. Quitar el input numérico de tamaño → solo `span` con el valor en px

**Objetivo:** los controles de tamaño (width/height/padding/etc. en px) dejan de ser un
`<input type="number">` editable; se muestra el valor actual como texto (`span`) de solo lectura.

**Candidatos:**

- `src/App/InspectorDrawer/ConfigurationPanel/input-panels/helpers/` (helpers de inputs numéricos compartidos)
- `src/App/InspectorDrawer/ConfigurationPanel/input-panels/*SidebarPanel.tsx` (todos los paneles con controles de tamaño: Container, ColumnsContainer, Image, Spacer, EmailLayout)

**Estado:** pendiente — falta confirmar si existe un único componente reutilizable de "slider + input numérico" o si cada panel repite el patrón.

---

## 2. Espaciado label ↔ input y entre propiedades

**Objetivo:**

- Separación label → su input: **4–6px**.
- Separación entre una propiedad y la siguiente (grupos label+input): **mínimo 1rem**.

**Candidatos:**

- Mismos `*SidebarPanel.tsx` del punto 1.
- Posible estilo compartido en `src/App/ComponentsLibrary/styles.ts` o clases MUI `sx` inline por panel (no hay un CSS module centralizado detectado aún para estos paneles — a confirmar).

**Estado:** pendiente — requiere revisar si conviene un helper de layout compartido (`PropertyRow` o similar) en vez de tocar cada panel por separado.

---

## 3. Eliminar título redundante de cada componente en el sidebar + su margin-top

**Objetivo:** cada panel de propiedades (`*SidebarPanel.tsx`) actualmente muestra un título
(nombre del bloque) que es redundante con el tab header. Eliminar el título y el `margin-top`
que lo separaba del header de tabs, para pegar el contenido al header.

**Candidatos:**

- `src/App/InspectorDrawer/index.tsx` (probable contenedor que renderiza el título antes del panel)
- `src/App/InspectorDrawer/ConfigurationPanel/index.tsx`

**Estado:** pendiente — ubicar el punto exacto donde se imprime el título (¿en `ConfigurationPanel/index.tsx` o en cada `*SidebarPanel.tsx`?).

---

## 4. Quitar el "dot" de edición en Global Configuration (Theme)

**Objetivo:** al editar un valor dentro del panel de tema global, se muestra un punto/dot
indicando "modificado". Ya no es necesario — eliminar ese indicador.

**Candidatos:**

- `src/App/TemplatePanel/ThemePanel/ThemeFieldRow.tsx` (fila de campo del theme — candidato principal)
- `src/App/TemplatePanel/ThemePanel/BlockTypeAccordion.tsx`
- `src/App/TemplatePanel/ThemePanel/registry.ts`

**Estado:** pendiente — confirmar en `ThemeFieldRow.tsx` el elemento visual exacto del dot.

---

## 5. Modo compacto de la librería de bloques: replicar estilo del modo abierto

**Objetivo:**

- Los botones de bloque en modo **compact** deben visualmente heredar el estilo que tienen en
  modo **open** (misma library, dos presentaciones).
- Ancho del sidebar en modo compact: **164px** fijo.
- Los botones en compact pasan de tile cuadrado (`aspectRatio: '1/1'`) a **rectangulares**, para
  evitar overflow vertical.

**Candidatos:**

- `src/App/ComponentsLibrary/CompactBlocksList.tsx` (ya confirmado: hoy usa `aspectRatio: '1 / 1'` — línea a cambiar)
- `src/App/ComponentsLibrary/dragTileShell.ts` (shell de estilos de los tiles, compartido con modo open vía `BlocksCategoryContent.tsx`)
- `src/App/ComponentsLibrary/ComponentsLibraryDrawer.tsx` (donde probablemente se fija el ancho del drawer compact)

**Estado:** confirmado el archivo/línea del aspect-ratio; falta ubicar dónde se define el ancho actual del compact rail.

---

## 6. Eliminar los elementos Text, Button y Social del tab Blocks (librería)

**Objetivo:** quitar esos tres bloques base de la lista de bloques disponibles en el tab Blocks
(no aportan valor adicional al catálogo).

**Candidatos:**

- `src/App/ComponentsLibrary/builtInBlocks.tsx` (lista `BUTTONS` — fuente de verdad de qué bloques base se listan, usada tanto en compact como en open)

**Estado:** pendiente — verificar las keys/labels exactas (`text`, `button`, `social`) dentro de `BUTTONS` antes de remover, y confirmar que no rompe drag-and-drop existente en documentos ya creados con esos bloques.

---

## 7. Tab Sections: mover los elementos de acordeón a la parte baja del tab Blocks

**Objetivo:** el tab "Sections" ocupa mucho espacio como tab independiente; sus elementos
(acordeones de secciones) se integran al final del tab **Blocks**, en vez de tener su propio tab.

**Candidatos:**

- `src/App/ComponentsLibrary/BlocksCategoryContent.tsx` (contenido del tab Blocks — destino)
- `src/App/ComponentsLibrary/CategoryAccordion.tsx` (el acordeón de secciones a mover)
- `src/App/ComponentsLibrary/ComponentsLibraryDrawer.tsx` (definición de tabs — quitar/fusionar el tab Sections)

**Estado:** pendiente — implica remover un tab completo del `ComponentsLibraryDrawer` y reubicar su contenido; revisar impacto en `LibrarySearchToolbar.tsx` / `ChipsFilterRow.tsx` si filtran por tab activo.

---

## 8. Tab Templates: duplicar la altura de la preview

**Objetivo:** las tarjetas de preview de templates en su tab se ven muy pequeñas; duplicar su
altura.

**Candidatos:**

- `src/App/ComponentsLibrary/thumbnail/LibraryCardThumbnail.tsx`
- `src/App/ComponentsLibrary/ThemesList.tsx` (si comparte grid con Templates) — a confirmar si Templates tiene su propio listado o reusa este.

**Estado:** pendiente — falta ubicar el componente específico de grid/list para el tab Templates (no confirmado en la exploración inicial; posiblemente dentro de `ComponentsLibraryDrawer.tsx` o un archivo no listado aún bajo `ComponentsLibrary/`).

---

## 9. Deseleccionar el theme por defecto (NO eliminar funcionalidad)

**Aclaración del alcance (correxión sobre la redacción inicial):** el guardado, la aplicación y
el resto de la funcionalidad de theme **se mantienen intactos** — igual que todo lo demás en el
builder, que ya está oculto/colapsado por defecto y no se elimina. El único cambio es que el
builder **no debe arrancar con ningún theme preseleccionado/aplicado**; el usuario elige un theme
explícitamente si quiere uno. No se toca `SaveThemeDialog`, `ApplyThemeConfirmDialog`, ni el
listado de themes guardados.

**Objetivo:**

- Al cargar el builder, ningún theme queda marcado como "seleccionado" ni aplicado por defecto.
- Todo el flujo de guardar/aplicar/listar themes sigue funcionando exactamente igual, solo que
  parte de un estado inicial "sin theme activo" en vez de un preset por defecto.

**Candidatos:**

- `src/App/TemplatePanel/ThemePresets/ThemePresetsButton.tsx` / `ThemePresetPreview.tsx` (candidato para dónde se marca el preset activo por defecto)
- Estado inicial del documento/tema en `documents/editor/EditorContext.tsx` o `getConfiguration/index.tsx` (probable origen de qué theme se carga al inicializar)
- `src/App/TemplatePanel/ThemePanel/index.tsx` (posible bandera de "selected theme id" a inicializar en `null`/`undefined`)

**Estado:** pendiente — falta ubicar exactamente dónde se setea el theme inicial/default (constante o dato de configuración) para cambiarlo a "ninguno" sin tocar el resto del flujo.

---

## Orden de trabajo sugerido

1. Puntos 1–4 (Inspector/propiedades) — cambios acotados, mismo área de archivos.
2. Puntos 5–8 (Librería de componentes) — mismo módulo `ComponentsLibrary/`.
3. Punto 9 (Theme) — cambio acotado al estado inicial de selección; no toca guardado/aplicación.

## Hallazgo pendiente — lentitud real de apertura del editor (no es bundle size)

**Estado: PAUSADO — retomar en la próxima sesión.**

Ya resuelto (no es esto): el peso de 2MB en dev era exclusivo del dev server de
Vite (HMR sirve todo el CSS del grafo de módulos aunque esté detrás de
`lazy()`); confirmado con `npm run build && npm run preview` que en producción
real el bundle inicial de `/app/templates` es ~33KB HTML + ~59KB CSS, sin el
JS del email-builder (2.4MB) hasta que se abre el editor.

**Lo que sí es un problema real, incluso en preview/producción:** abrir el
editor tarda cerca de 2 minutos por una causa distinta — generación de
thumbnails de la Components Library.

Evidencia (consola del navegador, `npm run preview`):

```
captureThumbnail.BtyNo9RM.js:519 [captureSubtreeThumbnail] timeout after 6000 ms
```

Se repite muchas veces en serie (uno por bloque/sección/template de la
librería), cada uno agotando el timeout completo de 6000ms antes de seguir
con el siguiente — de ahí los ~2 minutos.

Causa probable: cada captura usa un `<iframe>` (`about:srcdoc`) en modo
`sandbox` para renderizar el bloque aislado y tomarle una "foto"
(`html-to-image` es dependencia del paquete). El log también muestra:

```
Blocked script execution in 'about:srcdoc' because the document's frame is
sandboxed and the 'allow-scripts' permission is not set.
```

Sin `allow-scripts` en el sandbox del iframe, el contenido nunca termina de
montar/pintar dentro de él, así que cada captura falla por timeout en vez de
resolver rápido — comportamiento consistente con "casi siempre tarda el
timeout completo", no con una carga que varía según tamaño.

**Archivos involucrados (a revisar cuando se retome):**

- `src/App/ComponentsLibrary/thumbnail/captureThumbnail.ts` (línea ~519, el timeout de 6000ms y el iframe sandbox)
- `src/App/ComponentsLibrary/lazyThumbnailGenerator.ts` (quién dispara las capturas, en qué orden/concurrencia)
- `src/App/ComponentsLibrary/devSeedSections.ts` / `devSeedThemes.ts` / `devSeedTemplates.ts` / `devSeedLayouts.ts` / `devSeedPrimitives.ts` (posible origen de cuántos ítems se intentan capturar al inicio — el nombre "devSeed" sugiere que esto podría ser solo para desarrollo/seed local, no necesario en producción real con backend)

**Preguntas a resolver antes de tocar código:**

1. ¿Este flujo de captura de thumbnails corre siempre al abrir el editor, o solo la primera vez / solo en modo dev-seed? Si es dev-only, quizás no afecta usuarios reales con backend real.
2. ¿Por qué el iframe no tiene `allow-scripts`? ¿Falta agregarlo, o es intencional por seguridad y hay que resolver la captura de otra forma (ej. renderizar sin iframe, o con un sandbox distinto)?
3. ¿Se puede paralelizar las capturas en vez de serializarlas, y/o bajar el timeout, y/o cachear thumbnails ya generados para no repetir el trabajo en cada apertura?

## Pendiente — mejorar el loader del editor mientras carga

El spinner + mensajes progresivos por tiempo (agregados en
`VisualEmailBuilder.tsx`) ayudan, pero con la apertura tardando ~2 minutos por
el problema de thumbnails arriba, se pidió algo con más sensación de avance
real (tipo progreso/loader animado) en vez de solo cambiar texto en un
spinner estático — para que no se perciba como que "nunca va a terminar".
Retomar junto con el fix de thumbnails: si se resuelve la causa raíz (timeout
de 6s por captura), la carga debería bajar de minutos a segundos y puede que
ni se necesite un loader más elaborado.

## Reglas de esta sesión de trabajo

- No commitear ningún cambio de este documento ni del código del builder hasta indicación explícita.
- Rama de trabajo: `work/email-builder-isolated`.
- `main` no se toca.
