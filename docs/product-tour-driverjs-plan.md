# Product tours con Driver.js — EmailBuilder + Builder42

Plan de implementación de recorridos guiados ([driver.js](https://driverjs.com/)) en los dos
editores visuales vendorizados: `packages/email-builder-standalone` (editor de email,
`/dashboard/templates/email`) y `packages/builder42` (editor de landings,
`/dashboard/landings/editor`).

Estado (2026-09-14): **F1–F7 implementados y commiteados** en la rama `feat/ui-polish-p1`. El
e2e de F6 destapó tres defectos reales, los tres arreglados en la misma cadena: el tour arrancaba
**dos veces** en ambos editores (B7), `Escape` no lo cerraba (B8), y el embed de landings no tenía
entrada alcanzable para relanzarlo (B9/B9b/B9c). La misma cadena produjo además varios
follow-ups: la entrada de la paleta de comandos del editor de email dejó de relanzar el tour tras
el fix de B7/B8 (B10, cerrado junto con B11 — el nonce de relanzamiento quedaba silenciado); y el
guard de Escape necesitó dos rondas más (B12: cede el Escape a un modal del host abierto por
encima del tour; B14: ese chequeo de "modal competidor" debía ignorar modales presentes en el DOM
pero ocultos, o el guard cedía siempre y el tour quedaba sin forma de cerrarse por teclado). El
estado vivo de la orquestación — baseline, gates, decisiones de contrato, incidencias y hallazgos
numerados — vive en [`.orquestacion/bitacora.md`](../.orquestacion/bitacora.md); **léela antes de
retomar**.

Las fases están empaquetadas para ejecutarse con subagentes (dependencias y criterios de
aceptación explícitos por fase). **Ninguna fase ya implementada debe revertirse: si un agente la
percibe como fuera de alcance, lo reporta, no la borra.**

## 0. Restricción de exportabilidad (Builder42 saldrá de este repo)

**Decisión confirmada (2026-09-11):** una vez implementado este plan, `packages/builder42`
se extraerá como proyecto independiente para una landing de Maildrill (demo del producto). El
tour de Builder42 debe poder viajar con esa extracción **sin editar su lógica**, solo
recableando el punto de entrada al analytics/persistencia del nuevo host.

`packages/builder42` ya cumple este boundary hoy para todo lo demás: persiste su config en
`localStorage` bajo `pb:*` vía `useLocalConfig.ts` (`ConfigMap`) sin importar nada del host, y
la analítica (`window.posthog?.capture(...)`) vive **solo** en `src/` (el host Astro) — grep
confirma cero usos de PostHog dentro de `packages/builder42/src`. El tour tiene que respetar
exactamente ese mismo boundary, no inventar uno nuevo:

1. **Cero imports de `src/` (host Astro) desde `packages/builder42` o `@md/product-tour`.**
   Ni de tipos. El sentido de la dependencia es siempre paquete → host, nunca al revés.
2. **`@md/product-tour` no conoce PostHog, Maildrill, ni "email"/"landing".** Su única salida
   al mundo es un callback (`onEvent?: (event: TourAnalyticsEvent) => void`) que el *consumidor*
   define y conecta. El paquete no importa `posthog-js` ni ningún SDK de analítica.
3. **`@md/product-tour` no conoce el dominio de Maildrill.** No debe saber qué es "email" vs
   "landing"; solo consume `TourStep[]` con anclas y copy ya resueltos. Los registros de pasos
   (`tourSteps.ts` de F3a/F3b) y su i18n viven en cada editor, no en el paquete compartido.
4. **La persistencia por defecto vive en el paquete y es agnóstica del host.** F1 implementa
   `persistence.ts` sobre `localStorage` con un prefijo **parametrizable** (no hardcodeado a
   `eb:`/`pb:`): cada editor pasa su propio prefijo al crear el tour. Así Builder42 standalone
   (fuera de este repo) sigue funcionando con `pb:tour:*` sin ningún cambio de código, y el
   futuro host de la landing puede pasar otro prefijo si lo necesita.
5. **`packages/builder42/src/app/**` solo importa `@md/product-tour` como dependencia de
   paquete (`workspace:*` hoy → versión publicada/relativa el día de la extracción), nunca
   rutas relativas hacia fuera de `packages/builder42`.** Cuando el paquete salga del monorepo,
   la única línea que cambia en su `package.json` es la resolución de `@md/product-tour` (de
   `workspace:*` a una versión de npm o a un submódulo/paquete vendorizado); ningún import en
   `.tsx` cambia.
6. **Ningún `data-tour`, string de copy, ni paso del tour de Builder42 asume que existe
   `/dashboard/*`, sesión de Maildrill, ni el resto del workspace.** El tour describe **solo el
   editor en sí** (§3.2) — que es exactamente lo que la demo de la landing necesita mostrar. Se
   valida por revisión: si un paso menciona "tu cuenta", "tus campañas" o cualquier superficie
   fuera del editor, es un bug de scope.
7. **`props opcionales del host` (F4) es la única costura permitida.** `VisualEmailBuilder.tsx`
   y `LandingPageBuilder.tsx` (ambos en `src/`, es decir del lado del host, no del paquete)
   inyectan el callback de analítica y las flags de arranque. El día de la extracción, el nuevo
   host de la landing escribe su propio wrapper equivalente a `LandingPageBuilder.tsx` — no
   toca `packages/builder42`.

Esta sección no añade fases nuevas: es una restricción transversal a F1, F2b, F3b y F4 que se
verifica en cada PR de esas fases (grep de imports cruzados + revisión de copy), y queda
recogida como criterio de aceptación explícito en cada una.

---

## 1. Análisis: instalación

### 1.1 Qué hay hoy (verificado)

| Hecho                                                                                               | Evidencia                                                                                     |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `driver.js@^1.8.0` ya está **declarado** en el editor de email y **instalado** en su node_modules   | `packages/email-builder-standalone/package.json`; `.../node_modules/driver.js` = 1.8.0        |
| …pero **no se importa en ninguna parte** del código (dependencia fantasma heredada del upstream)    | grep `driver` en `packages/**/*.{ts,tsx}` → solo `package.json` y JSON de datos               |
| `builder42` **no** declara driver.js                                                                | `packages/builder42/package.json`                                                             |
| Existe ya un flag `tour: boolean` (default `false`) en el store del editor de email, sin consumidor | `email-builder-standalone/src/documents/editor/EditorContext.tsx:157,221`; `App/index.tsx:50` |
| pnpm workspaces sin hoisting global: cada paquete debe declarar lo que importa                      | `pnpm-workspace.yaml` (`packages/*`, `workers`, …)                                            |

Consecuencia: no hay nada que "reutilizar"; hay que instalar de verdad, y hay que decidir
**dónde** vive el código común para no duplicar tema, persistencia y utilidades en dos paquetes.

### 1.2 Decisión: un paquete de workspace compartido

Crear `packages/product-tour` (nombre npm `@md/product-tour`, siguiendo `@md/emoji-picker`).

```
packages/product-tour/
  package.json          # dependencies: driver.js 1.8.0 (pin exacto); peer: react ^19
  src/
    index.ts            # API pública
    createTour.ts       # factory sobre driver.js (carga diferida)
    anchors.ts          # tipos + resolver de anclas (data-tour), waitFor, root-aware
    steps.ts            # tipo TourStep con gating (`when`, `before`, `after`)
    persistence.ts      # "visto/completado" por tour + versión de tour
    analytics.ts        # callback opcional (el host enchufa PostHog)
    theme.css           # estilos .md-tour sobre variables --md-tour-*
  tests/                # vitest (jsdom)
```

Por qué un paquete y no código duplicado en cada editor:

- **Una sola estética.** El popover se estiliza una vez (`.md-tour`) y cada editor solo
  **mapea** sus tokens a `--md-tour-*`. Es el único modo de que ambos tours se vean idénticos
  sin copiar CSS.
- Los dos editores son paquetes **vendorizados** (`packages/VENDOR.md`): el código propio debe
  quedar aislado y ser fácil de identificar frente al upstream.
- El host Astro (`src/`) podrá consumir el mismo paquete más adelante (onboarding de
  `/dashboard`) sin refactor.

Instalación (una sola vez, desde la raíz):

```bash
pnpm --filter @md/product-tour add driver.js@1.8.0      # pin exacto, sin rango
pnpm --filter email-builder-standalone add @md/product-tour@workspace:*
pnpm --filter builder42 add @md/product-tour@workspace:*
pnpm --filter email-builder-standalone remove driver.js  # dep fantasma: fuera
pnpm install
```

`driver.js` **no** se añade al `package.json` raíz: el host no lo importa directamente, lo
recibe transitivamente vía los editores. Si más adelante el shell de la app quiere su propio
tour, añade `@md/product-tour`, nunca `driver.js`.

### 1.3 Carga diferida obligatoria

El bundle del editor de email ya es enorme (MUI + tiptap + dnd + presets). `createTour` hace
`await import('driver.js')` **al arrancar el tour**, no en el módulo. Igual con `driver.css`:
se importa desde `theme.css` del paquete, que a su vez solo se carga con el chunk del tour.

### 1.4 Restricciones técnicas verificadas (esto es lo que rompe si se ignora)

1. **Shadow DOM.** El host monta `EmailBuilder` desde `email-builder-standalone` (entrada
   `src/index.tsx`), **no** el wrapper `EmailBuilderStandalone` (`./standalone`, r2wc con
   `shadow`). Es decir: en Maildrill el DOM es normal y `document.querySelector` funciona. En
   modo standalone/web-component **no** funcionaría (driver.js no atraviesa shadow roots y su
   overlay se inyecta en `document.body`, fuera del ámbito de estilos del shadow). El resolver
   de anclas debe aceptar un `root: Document | ShadowRoot` y el tour debe declararse
   **no soportado** (no-op silencioso) cuando el root es un `ShadowRoot`.
2. **Iframes.** El modo `preview` de builder42 renderiza un **iframe** (`PreviewFrame`,
   `app/layout/Canvas.tsx`) y las miniaturas del editor de email se capturan en iframes
   sandbox. driver.js no puede resaltar dentro de un iframe → el tour debe forzar
   `setView('edit')` antes de arrancar y ningún paso puede apuntar al interior del preview.
3. **Escape.** `VisualEmailBuilder` cierra el editor con un listener `keydown` en `window`
   (`src/components/react/VisualEmailBuilder.tsx`). driver.js también cierra con Escape → sin
   protección, salir del tour **cierra el editor**. Solución: mientras `driver.isActive()`,
   interceptar Escape en fase de captura y `stopPropagation()` (mismo patrón que ya usan
   `Modal.tsx` / `useEscapeClose.ts`).
4. **`pointer-events: none` global.** `driver.css` aplica `.driver-active * { pointer-events: none }`
   y solo libera `.driver-active-element`. Cualquier paso que pida "arrastra un bloque" debe o
   usar `disableActiveInteraction: false` sobre el contenedor correcto, o ser puramente
   descriptivo. No prometer interacción que el overlay bloquea.
5. **Paneles animados y estado transitorio.** El drawer de la librería y el inspector del
   editor de email son `position: absolute` con transición de 220 ms
   (`email-builder-standalone/src/App/index.tsx`); el inspector solo muestra configuración si
   hay un bloque **seleccionado**; el sidebar de builder42 no tiene tabs en modo `compact`
   (`app/layout/Sidebar.tsx`). Los pasos dependientes de estado necesitan `before()` (abrir el
   panel / seleccionar nodo) + `waitForElement` de driver.js 1.8 y `skipMissingElement` como
   red de seguridad.
6. **Flags del host.** El editor de email se monta con `htmlTab={false}`, `jsonTab={false}`,
   `componentTree={false}`, `templateSaving={false}`, `themeSaving={false}`, `templateLibrary`,
   `galleryImages`, `unsplashEnabled`, `enableAI`. Builder42 embebido fuerza
   `experienceLevel = "simple"` (oculta Tokens, Code, zip) y **cada capability (IA, Unsplash,
   publicar, traducir) está gateada por el adapter `fetchHealth`**. Los pasos se construyen
   filtrando por esos flags: un tour que apunta a un botón oculto es un bug visible.
7. **El runtime exportado de builder42 no debe tocarse.** `pnpm --filter builder42 build:runtime`
   compila el runtime que viaja en las landings publicadas. El tour vive **solo** en
   `src/app/**` (chrome). Ni un import desde `src/builder/runtime/**` ni desde rutas de export.
8. **z-index / stacking.** driver.js usa `z-index: 1000000000`, por encima de MUI (1300) y de
   los modales `pbx-*`: no hay conflicto de capas. Sí hay riesgo con **ancestros
   transformados/`overflow:hidden`** (rieles compactos, canvas con `transform`): el recorte del
   "stage" puede quedar desalineado. Verificar visualmente cada ancla en ambos temas.
9. **API disponible en 1.8.0** (confirmado en los `.d.ts` instalados): `waitForElement`,
   `skipMissingElement`, `overlayClickBehavior`, `allowKeyboardControl`, `popoverClass`,
   `stagePadding`, `stageRadius`, `showProgress`/`progressText`, `element` como
   `() => Element`, hooks `onHighlightStarted/onHighlighted/onNextClick/onDestroyStarted`, y un
   módulo aparte `driver.js/hints` (puntos de ayuda persistentes) que queda para una fase
   opcional.

---

## 2. Análisis: estética (que se vea Maildrill, no driver.js)

`driver.css` expone **solo dos** variables (`--driver-popover-font-family`,
`--driver-animation-duration`); todo lo demás son clases. Por tanto el tema se hace por
**override de clases** con `popoverClass: 'md-tour'`, más variables propias:

```
.driver-popover.md-tour           → superficie, radio, sombra, borde, tipografía
  .driver-popover-title           → Geist 600
  .driver-popover-description      → texto secundario
  .driver-popover-progress-text    → contador de pasos (acento identidad)
  .driver-popover-footer-btn       → botón "Siguiente" (acción primaria)
  .driver-popover-close-btn        → cerrar
  .driver-popover-arrow            → flecha, hereda la superficie
```

Todas las reglas leen `--md-tour-surface | -text | -text-muted | -border | -radius | -shadow |
-accent | -accent-text | -font | -overlay`. Cada editor aporta el mapeo:

| Editor           | Cómo se mapea                                                                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **builder42**    | Nuevo `src/styles/chrome/tour.css` que asigna `--md-tour-*` desde `--pb-chrome-*` (bg, border, accent, focus-ring, font, radios) + override en `chrome/dark.css`. Debe añadirse a **los dos** barrels (`chrome.css` y `chrome-embedded.css`, misma posición relativa) — regla explícita de ese paquete.                     |
| **EmailBuilder** | El popover se portaliza a `document.body`, **fuera** de `.dark-email-builder` y del ámbito de emotion → el mapeo por clase no sirve. Se asignan las variables **en runtime** sobre `popover.wrapper` en `onPopoverRender`, leyendo el `theme` de MUI (`useTheme()`), que ya recibe `primaryColor` = indigo del canal email. |

Reglas de marca que aplican (ver `docs/AGENTS.md`): superficie cream/`--surface`, texto
`--ink`; **indigo `--accent`** para el botón primario "Siguiente" y el anillo de foco;
**naranja `--brand`** solo como acento de identidad (contador de progreso / barra), nunca
como fondo de botón. Overlay: `--ink-band` con opacidad, no negro puro.

Movimiento y accesibilidad:

- `animate: !prefersReducedMotion` y `--driver-animation-duration` a `0s` bajo
  `@media (prefers-reduced-motion: reduce)`. builder42 ya corre con
  `MotionConfig reducedMotion="user"`.
- Foco: al abrir un paso, foco al popover; al cerrar, devolverlo al elemento que lanzó el tour.
- `allowKeyboardControl: true` (flechas/Enter) + Escape contenido (§1.4.3).
- Contraste del botón primario y del texto sobre superficie: pasar `scripts/apca-audit.mjs`.

---

## 3. Análisis: qué secciones marcar

Criterio: un tour corto (**8–12 pasos**), un concepto por paso, solo superficies **visibles en
el embed de Maildrill**, y ningún paso que dependa de datos que puedan no existir. Las claves
`data-tour` son un **contrato estable** (no clases CSS, que cambian con cada restyle).

### 3.1 EmailBuilder — tour "Editor de email"

| #   | Ancla (`data-tour`)      | Superficie / archivo                                                                                   | Mensaje                                                   | Precondición                                                |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `eb.header.identity`     | Host: `shared/EditorHeader.tsx` (nombre, categoría, idioma, autoguardado)                              | Cómo se identifica y se guarda la plantilla               | —                                                           |
| 2   | `eb.toolbar.views`       | `TemplatePanel/MainTabsGroup.tsx` (ids ya existentes `#tab-editor/#tab-preview`) + tamaño de pantalla  | Editar vs. previsualizar, desktop/móvil                   | —                                                           |
| 3   | `eb.toolbar.history`     | `TemplatePanel/index.tsx` (`#ee-editor-header`, undo/redo)                                             | Deshacer sin miedo                                        | —                                                           |
| 4   | `eb.library.rail`        | `ComponentsLibrary/ComponentsLibraryHandle.tsx` + `CompactBlocksList.tsx`                              | Bloques base siempre a un clic                            | —                                                           |
| 5   | `eb.library.tabs`        | `ComponentsLibraryDrawer.tsx` (categorías reales: `blocks`, `templates`; Secciones al final de Blocks) | Bloques, secciones y plantillas                           | `before`: abrir drawer + `waitForElement`                   |
| 6   | `eb.canvas.root`         | `TemplatePanel` (contenedor `.preview-container`)                                                      | El lienzo: clic para seleccionar, arrastrar para insertar | —                                                           |
| 7   | `eb.inspector.panel`     | `InspectorDrawer/index.tsx` (+ `InspectorHandle`), tabs `styles`/`block-configuration`                 | Editar el bloque seleccionado                             | `before`: seleccionar bloque; si el doc está vacío → `skip` |
| 8   | `eb.inspector.mergeTags` | `@md/merge-tag-menu` en campos de texto                                                                | Personalización con datos del suscriptor                  | Requiere bloque de texto → paso condicional                 |
| 9   | `eb.image.sources`       | `components/ImageSourceTabs.tsx` (galería / Unsplash / subida)                                         | Imágenes desde la biblioteca del workspace                | Solo si `galleryImages`/`unsplashEnabled`                   |
| 10  | `eb.ai.generate`         | `AIGeneration/AIGenerationDialog.tsx` (botón de entrada)                                               | Generar y refinar con IA                                  | Solo si `enableAI`                                          |
| 11  | `eb.theme.presets`       | `TemplatePanel/ThemePresets/ThemePresetsButton.tsx`                                                    | Tema global de la plantilla                               | `themeSaving` está en `false`: solo aplicar, no guardar     |
| 12  | `eb.commandPalette`      | `App/CommandPalette/index.tsx` (pista ⌘K)                                                              | Todo por teclado                                          | —                                                           |
| 13  | `eb.header.actions`      | Host: enviar prueba + guardar (`EditorHeader`)                                                         | Probar y guardar                                          | `onSendTest` presente                                       |

**Excluidos a propósito** (apagados en el embed): pestañas HTML/JSON, árbol de componentes,
"Guardar como plantilla", guardado de temas.

**Excluidos en F2a por falta de punto de montaje alcanzable** (verificado por grep + test de
render, sin call-site real en el árbol activo del chrome; el registro `tourAnchors.ts` conserva
la clave y el comentario documental, pero ningún elemento del DOM lleva hoy el atributo):

- `eb.ai.generate` — `App/AIGeneration/index.tsx` es un entry point deshabilitado a propósito
  (devuelve `null`, ver comentario "Hidden for now" en el propio archivo); `AIGenerationDialog.tsx`
  y `TemplateScoreDialog.tsx` no se renderizan desde ningún punto alcanzable. Reactivarlo para
  anclar el paso habría exigido reintroducir UI muerta, fuera del alcance de "cero cambios de
  comportamiento" de F2a/F2b.
- `eb.theme.presets` — el atributo está aplicado en `ThemePresets/ThemePresetsButton.tsx`, pero
  ese componente no está importado/montado por `TemplatePanel`/`App` en el snapshot actual
  (confirmado por grep de call-sites): el atributo queda listo para el día en que se monte, sin
  cobertura de test de render hasta entonces.
- `eb.inspector.mergeTags` — vive en `@eb/block-notion-text` (`bubble-menu/MergeTagsDropdown.tsx`),
  un paquete **distinto** de `email-builder-standalone` con dependencia en la dirección opuesta
  (`email-builder-standalone` → `@eb/block-notion-text`, nunca al revés). Importar el registro de
  `email-builder-standalone` desde `block-notion-text` crearía un ciclo de workspace; el paquete
  tampoco expone ningún prop para inyectar el atributo desde fuera sin cambiar su API pública. Se
  deja sin implementar en F2a; si se retoma, la ruta correcta es extraer las claves de ancla a un
  paquete hoja sin dependencias (p. ej. dentro de `@eb/document-core`, ya raíz de ambos) en una
  fase explícita, no como parche de F2a.

Estas tres quedan fuera de la cobertura de `tourAnchors.render.test.tsx` (que documenta
explícitamente su ausencia con `toHaveLength(0)`) y del e2e de F6 hasta que exista un punto de
montaje real.

### 3.2 Builder42 — tour "Editor de landings"

| #   | Ancla (`data-tour`)         | Superficie / archivo                                                                     | Mensaje                                        | Precondición                                      |
| --- | --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| 1   | `pbx.header.identity`       | Host: `EditorHeader` (nombre + autoguardado)                                             | Nombre y guardado de la landing                | —                                                 |
| 2   | `pbx.toolbar.views`         | `app/layout/HostToolbar.tsx` (`#md-landing-editor-views` ya existe) + `ViewportDropdown` | Editar/Previsualizar y breakpoints             | Forzar `view === 'edit'` al arrancar              |
| 3   | `pbx.toolbar.history`       | `HostToolbar.tsx` (`#md-landing-editor-history`)                                         | Deshacer/rehacer                               | —                                                 |
| 4   | `pbx.sidebar.tabs`          | `app/layout/Sidebar.tsx` (`components`, `templates`; `tokens` oculto en simple)          | Componentes vs. plantillas                     | `before`: `sidebarMode = "open"`                  |
| 5   | `pbx.sidebar.palette`       | `Sidebar.tsx` → `CategoryAccordion` / `SectionTemplateCard`                              | Arrastrar secciones y elementos                | —                                                 |
| 6   | `pbx.canvas.frame`          | `app/layout/Canvas.tsx` (`.pbx-canvas__frame`, `CanvasEmptyStart` si vacío)              | El lienzo y su ancho por dispositivo           | —                                                 |
| 7   | `pbx.canvas.nodeActions`    | `builder/dnd/NodeActionsRail.tsx` + `SelectionHandle`                                    | Duplicar, mover, borrar el bloque seleccionado | `before`: seleccionar nodo raíz o primer hijo     |
| 8   | `pbx.inspector.tabs`        | `builder/inspector/InspectorForm.tsx` (`props`/`style`/`behaviors` reales)               | Contenido, estilo, interactividad              | `before`: inspector expandido + nodo seleccionado |
| 9   | `pbx.inspector.breakpoints` | `InspectorForm.tsx` (segmented de breakpoints)                                           | Estilos por breakpoint                         | —                                                 |
| 10  | `pbx.pages.breadcrumb`      | `app/layout/PageBreadcrumb.tsx`                                                          | **Una landing es un sitio multipágina**        | —                                                 |
| 11  | `pbx.publish`               | `builder/inspector/PublishPanel.tsx`                                                     | Publicar y subdominio                          | Solo si el adapter de publicación está disponible |
| 12  | `pbx.profileMenu`           | `app/layout/ProfileMenu.tsx` (tema, idioma, nivel simple/avanzado, controles de reorden) | Preferencias del editor                        | —                                                 |

**Excluidos** en el embed simple: pestaña Tokens, `TokensEditor`, vista Código, export zip,
vista JSON. Si en el futuro se habilita `experienceLevel = "advanced"`, esos pasos entran como
**variante avanzada** del mismo tour (mismo registro, filtrado por `when`).

Encadenado con lo que ya existe: `OnboardingExperienceModal` (simple/avanzado, una sola vez)
debe **resolverse antes** de que arranque el tour. Nunca se solapan.

---

## 4. Fases (empaquetadas para subagentes)

Convenciones para todas las fases: rama `work/product-tour` (nunca `main`), commits
`feat(tour): …`, gates `pnpm check` (0 errores) + `pnpm build` + `pnpm lint` + `pnpm test`, y
la regla de `docs/AGENTS.md` sobre `tsc --noEmit` (los ~460 errores preexistentes de los
paquetes vendorizados no se "arreglan"; solo se comprueba no añadir nuevos).

### F1 — Paquete `@md/product-tour` (base)

- **Depende de:** nada.
- **Entrega:** paquete nuevo (§1.2) con `createTour`, resolver de anclas (`data-tour`,
  `root`-aware, `waitFor`), tipo `TourStep` con `when/before/after`, persistencia
  (`seen`/`completed` + versión de tour) con **prefijo de `localStorage` parametrizable** por
  el consumidor (§0.4 — el paquete no hardcodea `eb:`/`pb:`), callback de analítica genérico
  (`onEvent?`, sin conocer PostHog ni el dominio — §0.2/§0.3), `theme.css` con `.md-tour` sobre
  `--md-tour-*`, contención de Escape, `prefers-reduced-motion`, carga diferida de `driver.js`.
- **Aceptación:** tests vitest (jsdom) que cubren: ancla ausente → paso omitido; `before`
  asíncrono resuelto antes de resaltar; Escape no propaga a `window`; `ShadowRoot` → no-op;
  persistencia de versión con prefijo inyectado (no default fijo). Ningún consumidor
  modificado. **Cero imports de `src/` (host Astro), cero imports de `posthog-js` o SDKs de
  analítica, cero referencias a "email"/"landing"/Maildrill en el código del paquete (§0)**.
  `pnpm check` verde.

### F2a — Anclas en EmailBuilder ‖ F2b — Anclas en Builder42 (paralelas)

- **Dependen de:** F1 (solo del tipo del registro de anclas).
- **Entrega:** atributos `data-tour="…"` en los elementos de §3.1 / §3.2 + un registro
  `tourAnchors.ts` por paquete (única fuente de las claves) + test que verifica que cada clave
  del registro aparece exactamente una vez en el árbol renderizado.
- **Aceptación:** **cero cambios de comportamiento y de estilos** (solo atributos), `pnpm check`
  y `pnpm build` verdes, sin regresiones jsx-a11y.
- **Nota para builder42:** las anclas van en `src/app/**` y `src/builder/inspector|dnd/**`
  (chrome). Nada en `src/builder/runtime/**` ni en rutas de export (§1.4.7). **Cero imports de
  `src/` del host Astro (§0.1)** — el registro y las anclas viven enteramente dentro de
  `packages/builder42`.

### F3a — Pasos + copy EmailBuilder ‖ F3b — Pasos + copy Builder42 (paralelas)

- **Dependen de:** F2a / F2b respectivamente.
- **Entrega:** `tourSteps.ts` por editor construido desde el registro de anclas y **filtrado
  por flags** (§1.4.6), con `before/after` para paneles y selección; nuevo namespace i18n
  `tour` en los tres idiomas de cada paquete (EmailBuilder: `en-US`, `es-419`, `it-IT`;
  Builder42: `en`, `es`, `it`), incluyendo los textos de botones (`nextBtnText`, `prevBtnText`,
  `doneBtnText`, `progressText`).
- **Aceptación:** test de paridad i18n (todas las claves en los 3 idiomas — builder42 ya tiene
  `i18n-chrome-coverage.test.ts` como precedente) + test de que ningún paso referencia un flag
  apagado en la configuración del embed. **Builder42: revisión manual de que ningún string de
  copy asume `/dashboard/*`, sesión de Maildrill, u otra superficie fuera del propio editor
  (§0.6) — la demo de la landing reusará este copy literalmente.**

### F4 — Entradas de usuario, persistencia y props del host

- **Depende de:** F3a + F3b.
- **Entrega:**
  - EmailBuilder: consumir el flag `tour` ya existente en `EditorContext`; entrada en
    `CommandPalette` ("Ver el recorrido guiado") y botón de ayuda en la barra
    `#ee-editor-header`; persistencia bajo `eb:tour:*` (convención `eb:lib:*`), pasando ese
    prefijo a `@md/product-tour` (§0.4) en vez de que el paquete lo asuma.
  - Builder42: nuevas claves en `ConfigMap` de `hooks/useLocalConfig.ts` (`tourSeen`,
    `tourVersion`, prefijo `pb:`); entrada en `ProfileMenu` junto a `ExperienceLevelToggle`;
    arranque automático **solo** tras resolver `OnboardingExperienceModal`. Todo esto dentro de
    `packages/builder42`, sin tocar `src/` salvo la costura de props del punto siguiente (§0.7).
  - Host: props opcionales en `VisualEmailBuilder.tsx` y `LandingPageBuilder.tsx` (ambos en
    `src/`) para forzar/silenciar el tour y para inyectar el callback de analítica que llama a
    `window.posthog?.capture(...)` — este mapeo a PostHog vive **solo** en el wrapper del host,
    nunca dentro del paquete (§0.2/§0.7).
- **Aceptación:** primer arranque muestra el tour una vez; "ya visto" persiste; el bump de
  versión del tour lo vuelve a ofrecer; salir con Escape no cierra el editor (§1.4.3). **Grep de
  `packages/builder42/src` confirma cero imports desde `src/` del host y cero referencias a
  `posthog` (§0.1/§0.2) — la única conexión a PostHog vive en `LandingPageBuilder.tsx`.**

### F5 — Tema y pulido visual

- **Depende de:** F4.
- **Entrega:** `builder42/src/styles/chrome/tour.css` (+ dark + alta en **ambos** barrels) y el
  mapeo en runtime desde el tema MUI en EmailBuilder (§2). Revisión de recorte del "stage" en
  rieles compactos y paneles absolutos (§1.4.8), en claro y oscuro.
- **Aceptación:** los dos popovers son visualmente idénticos salvo el acento; `npm run
audit:apca` sin regresiones; captura comparativa claro/oscuro en el PR.

### F6 — Tests y gates

- **Depende de:** F5.
- **Entrega:** e2e Playwright que recorre el tour completo en `/dashboard/templates/email` y en
  `/dashboard/landings/editor` (cada paso resalta un elemento visible; el último cierra y
  persiste), más los unitarios de F1–F3 integrados en `pnpm test`.
- **Aceptación:** `pnpm check && pnpm lint && pnpm test && pnpm build` y `pnpm test:e2e` verdes.
  Los e2e son el gate honesto: las anclas solo existen en runtime.

### F7 — Documentación y telemetría — **implementado**

- **Depende de:** F6.
- **Entrega:** sección de tours en `docs/AGENTS.md` (contrato `data-tour`: no renombrar sin
  actualizar el registro), nota en `packages/VENDOR.md` (divergencia propia frente al
  upstream), **nota explícita en `packages/VENDOR.md` §Builder42 sobre el boundary de
  exportabilidad (§0): qué costuras existen entre `packages/builder42` y `src/` (solo props de
  `LandingPageBuilder.tsx`) y qué debe recablearse el día de la extracción**, eventos PostHog
  (`tour_started`, `tour_step_viewed`, `tour_completed`, `tour_dismissed`) conectados por el
  host, y actualización de este documento a "implementado".
- **Hecho:** sección "Guided product tours" añadida a `docs/AGENTS.md` (contrato de anclas,
  regla 1:1 de builder42, instancia única, Escape, entradas de relanzamiento por editor,
  claves de persistencia y los cuatro eventos + dónde vive el mapeo a PostHog). Nota de
  divergencia del tour (sin equivalente upstream) añadida a `packages/VENDOR.md` en la sección
  de EmailBuilder.js, y nota del boundary de exportabilidad añadida en la sección de Builder42
  (costuras de hoy — `tourEnabled`/`onTourEvent` en `LandingPageBuilder.tsx` — y qué se
  recablea el día de la extracción: analítica y persistencia). El comentario de cabecera de
  `packages/product-tour/src/createTour.ts` se actualizó (solo comentarios) para reflejar que
  el chequeo de "modal competidor" de D11 exige que el modal esté **visible** (D12,
  `isElementVisible()`), no solo presente en el DOM.
- **Nota de verificación (e2e, no ejecutado en esta tarea de documentación):** según el estado
  registrado en `.orquestacion/bitacora.md`, la suite de `tests/e2e/tour.spec.ts` es inestable
  bajo el `fullyParallel: true` de `playwright.config.ts` con el número de workers por defecto;
  el comando fiable registrado es `npx playwright test --project=chromium --no-deps
  --workers=1 --retries=0`. Con ese comando, las fallas fuera de la cadena del tour (automations,
  dashboard, lists, login, registration, smoke, subscribers, workspace-tour — 22 nombres) son
  preexistentes/no relacionadas en el entorno de desarrollo actual.

### F8 (opcional, posterior) — `driver.js/hints`

Puntos de ayuda persistentes sobre superficies concretas (p. ej. merge tags, breakpoints) como
complemento al tour lineal. Fuera del alcance inicial.

---

## 5. Riesgos y cómo se mitigan

| Riesgo                                                                  | Mitigación                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Un refactor renombra clases y el tour apunta a la nada                  | Anclas `data-tour` + registro único + test de existencia + e2e por paso          |
| El overlay bloquea la interacción que el paso pide                      | `pointer-events` (§1.4.4): pasos descriptivos o `disableActiveInteraction:false` |
| Paso hacia una superficie apagada por flags o por adapter no disponible | Construcción filtrada por flags + `skipMissingElement` como red                  |
| Escape cierra el editor en vez del tour                                 | Captura + `stopPropagation` mientras el tour está activo                         |
| Crecimiento del bundle del editor de email                              | `await import('driver.js')` en el arranque del tour, CSS en el mismo chunk       |
| driver.js entra en el runtime exportado de las landings                 | Imports confinados a `src/app/**`; revisar `scripts/build-runtime.mjs` en F6     |
| Tour y `OnboardingExperienceModal` compitiendo al primer arranque       | El tour solo arranca con `experienceLevelChosen === true`                        |
| Builder42 acopla el tour a Maildrill y bloquea la extracción a landing  | §0: `@md/product-tour` agnóstico de dominio/analítica, prefijo de storage inyectado, cero imports `packages/builder42` → `src/`, grep de verificación en F1/F2b/F4 |
