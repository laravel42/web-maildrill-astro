# UI/UX polish plan — fases P1 y P2

Plan de ejecución derivado del audit de frontend. Cubre **P1** (consistencia de
estados y sistema de diseño) y **P2** (pulido). Los items **P0** —integridad de
datos, flujo de reset falso, testimonio fabricado, 401 sin manejar— quedan fuera:
van antes y por separado.

## Estado de partida (medido, no supuesto)

Lo que **ya está resuelto** y no hay que rehacer:

| Activo                             | Evidencia                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Capa de primitivas globales de app | `src/styles/app.css` — ~60 clases (`.pbtn`, `.sbtn`, `.kbtn`, `.iconbtn`, `.abtn-danger`, `.apill`, `.astatus`, `.acrd`, `.akpi`, `.atable`/`.athead`/`.atrow`/`.atable__foot`/`.atable__empty`, `.atabs`/`.atab`, `.aseg`, `.atoggle`, `.abar`, `.adrawer*`, `.adetail`, `.aempty`) |
| Adopción real de esas primitivas   | 323 usos en 44 archivos bajo `src/components/react/`                                                                                                                                                                                                                                 |
| Capa `shared/` de React            | 52 archivos: `ConfirmDialog`, `StatusBadge`, `DatePicker`, `TimePicker`, `SearchableSelect`, `TagFilter`, `ColFilter`, `FolderFilter`, `FilterChipsRow`, `LazyBoundary`, `useEscapeClose`, `useToast`, `useAutosave`, `pagination.ts`, `TimeAgo`, `Sparkline`                        |
| Botones de marketing               | `.btn`/`.btn--*` en `src/styles/components.css`, consumidos por `src/components/ui/Button.astro` — clases globales, por tanto reutilizables desde React sin duplicar CSS                                                                                                             |
| `prefers-reduced-motion`           | Guard universal con `!important` en `src/styles/global.css:47-58`; las 169 transiciones lo heredan                                                                                                                                                                                   |
| Focus ring de último recurso       | `src/styles/global.css:112-116`                                                                                                                                                                                                                                                      |
| Tokens                             | `src/styles/tokens.css`, incluida una rampa `[data-theme='dark']` completa (líneas 187-243)                                                                                                                                                                                          |

Lo que **falta**, cuantificado:

| Hueco                                      | Medición                                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primitivas sin equivalente global          | `Skeleton`, host de toast, `EmptyState` con variantes (primera vez vs. filtro vacío), shell de modal con focus trap                                                                                  |
| Duplicación local de primitivas existentes | 108 selectores (`.empty`, `.table`, `.row`, `.btn`, `.iconBtn`, `.drawer`, `.overlay`, `.modal`, `.tabs`, `.tab`, `.kpi`, `.card`, `.skel`) en 37 módulos CSS                                        |
| Toasts                                     | `shared/useToast.ts` son 28 líneas de estado puro; el markup se repite en **15 sitios** con clases propias (`styles.toast`, `styles.toastIc`, y `styles.toastic` en `AppSubscribers.module.css:617`) |
| Skeletons                                  | Solo `AppDashboard` (15 refs) y `AppAnalytics` (12 refs); el resto carga con texto plano                                                                                                             |
| Dark mode                                  | Solo 7/57 módulos CSS tienen overrides; `src/layouts/BaseLayout.astro:21` fija `data-theme="light"` en `<html>`                                                                                      |
| Responsive de editores                     | 0 `@media` en `ChannelEditorShell.module.css`, `VoiceBuilder.module.css`, `LandingPageBuilder.module.css`; `VisualEmailBuilder` y `WaTemplateStudioEditor` sin módulo propio                         |
| Focus/tap targets                          | 169 `outline: none` en 41 archivos vs. 60 reglas `:focus-visible` en 27; 223 declaraciones de botón-icono entre 20-39px                                                                              |
| Token drift                                | 249 hex crudos en 40/57 módulos; 131 `rgba()` en 33; 490 `font-size` en px pese a los 9 tokens `--fs-*`                                                                                              |
| Teclado                                    | `⌘K` en `AppShell.tsx` solo maneja Escape; `automations/FlowCanvas.tsx` y el reordenado de pins son drag-only                                                                                        |
| Onboarding                                 | 0 referencias a checklist/tour/first-run en `AppDashboard.tsx`                                                                                                                                       |

## Reglas de ejecución

1. **Converger, no reinventar.** Toda primitiva nueva se añade a `src/styles/app.css`
   con el prefijo `a*` y, si necesita estado en React, un wrapper en
   `src/components/react/shared/`. Nada de un sistema paralelo.
2. **Un lote = un PR.** Cada lote de abajo es independiente y desplegable solo.
3. **Migración por goteo, no big-bang.** Al introducir una primitiva se migran
   los consumidores en el mismo PR y se **borran** los selectores locales que
   sustituye. Un lote que no reduce el conteo de duplicados no está terminado.
4. **Sin cambios de copy factual** sin confirmación (nombres, cifras, claims).
5. **Gate por lote:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`,
   más `pnpm test:e2e` en los lotes que toquen el shell, los editores o el nav.
6. **Rampa de tokens.** Cuando un lote toca un módulo CSS, sustituye ahí los hex
   y px por tokens. El drift se paga como peaje, no como proyecto aparte.

---

# Fase P1 — estados y consistencia

## P1.a · Host de toast único · esfuerzo S · sin dependencias

**Problema:** 15 render sites con markup y `aria-live` divergentes.

Archivos: `shared/useToast.ts`, nuevo `shared/ToastHost.tsx` + `.module.css` (o
clases `.atoast*` en `app.css`), y los 15 consumidores —
`AppListDetail.tsx:826`, `AppMedia.tsx:1068`, `AppProfile.tsx:662`,
`AppSettings.tsx:1295`, `AppSubscriberDetail.tsx:1102`, `AppSubscribers.tsx:2052`,
`AppTemplates.tsx:903`, `CampaignsBoard.tsx:1352`, `AppAnalytics.tsx:536`,
`AppAutomations.tsx:364`, `AppLandings.tsx:451`, `AppLists.tsx:893`,
`LandingPageBuilder.tsx:201`, `VisualEmailBuilder.tsx:294`,
`WaTemplateStudioEditor.tsx:214`, `shared/MessageComposer.tsx:78`.

Tareas:

- `ToastHost` con `role="status"` para `tone: 'success'` y `role="alert"` para
  `'alert'`, `aria-live` coherente, y salida en `--z-toast`.
- Sustituir los 15 bloques; borrar `.toast`, `.toastIc`, `.toastic`, `.toastAlert`
  de los 15 módulos CSS.
- Mantener la firma de `useToast` para no tocar los ~40 `show(...)` existentes.

**Aceptación:** un solo componente renderiza toasts; `grep "styles.toast"` en
`src/components/react` devuelve 0; el tono `alert` es anunciado por lector de
pantalla en todos los sitios.

## P1.b · `Skeleton` + estados de carga · esfuerzo M · tras P1.a

**Problema:** solo 2 de ~14 pantallas tienen skeleton; el resto provoca layout
shift. `AppCampaignReport.tsx:866` es texto plano.

Tareas:

- Extraer el patrón de `AppDashboard.module.css`/`AppAnalytics.module.css` a
  `.askel`, `.askel--text`, `.askel--row`, `.askel--card` en `app.css` (animación
  ya cubierta por el guard global de reduced-motion).
- Wrapper `shared/Skeleton.tsx` con `aria-hidden` + `aria-busy` en el contenedor.
- Aplicar a: `AppCampaignReport`, `AppLists`, `AppListDetail`, `AppSubscribers`,
  `AppSubscriberDetail`, `AppTemplates`, `AppMedia`, `AppLandings`,
  `AppAutomations`, `AppAutomationRuns`, `AppSettings`, `CampaignsBoard`.
- Regla: el skeleton debe ocupar la **misma altura** que el contenido resuelto.

**Aceptación:** ninguna pantalla de workspace muestra texto de carga; CLS medido
sin regresión en el paso de carga a resuelto.

## P1.c · `EmptyState` con variantes · esfuerzo M · tras P1.b

**Problema:** `.aempty` existe pero no distingue _workspace nuevo_ de _filtro sin
resultados_. `AppMedia.tsx:654` solo tiene el segundo caso.

Tareas:

- Extender a `.aempty--first` (icono + título + explicación + CTA primaria) y
  `.aempty--filtered` (mensaje + "limpiar filtros").
- `shared/EmptyState.tsx` con props `variant`, `title`, `body`, `action`,
  `onClearFilters`.
- Auditar y cablear las dos variantes en: `AppLists`, `AppSubscribers`,
  `AppTemplates`, `AppMedia`, `AppLandings`, `AppAutomations`,
  `AppAutomationRuns`, `CampaignsBoard`, `AppListDetail`.
- Borrar los `.empty*` locales que sustituya (parte de los 108 duplicados).

**Aceptación:** cada lista/tabla/board tiene ambos estados; el primer-uso lleva
CTA que abre el flujo de creación real.

## P1.d · Shell de modal con focus trap · esfuerzo M · sin dependencias

**Problema:** `useEscapeClose` solo escucha Escape en `window`. No hay focus trap,
ni restauración de foco, ni `inert` en el fondo. ~12 archivos montan overlay
propio.

Tareas:

- `shared/Modal.tsx`: portal, `role="dialog"` + `aria-modal`, focus inicial,
  trap con Tab/Shift+Tab, restauración al elemento disparador, Escape, bloqueo de
  scroll con guardado/restauración del valor previo de `body.style.overflow`,
  `inert` o `aria-hidden` en el contenedor de app.
- Clases `.amodal*` en `app.css`, alineadas con `.adrawer*` ya existente.
- Migrar `SubscriberEditorModal`, `ListEditorModal`, `CustomFieldsModal`,
  `PinPickerModal`, `shared/MediaPickerModal`, `shared/SendTestModal`,
  `shared/SubscriberImportModal`, `shared/ConfirmDialog`, `profile/SecurityModal`,
  `profile/ReauthDialog`, `automations/DataPicker`, `automations/StepPicker`.
- `ConfirmDialog` conserva su `--z-confirm` por encima del modal que lo abre.

**Aceptación:** en cada modal, Tab no escapa al fondo, Escape cierra, y al cerrar
el foco vuelve al disparador. Test unitario del trap.

## P1.e · Responsive de editores y builders · esfuerzo L · sin dependencias

**Problema:** 0 `@media` en los shells de editor. Bajo ~900px se rompen sin aviso.

Tareas:

- Decidir y documentar el umbral (propuesta: `<900px`).
- `ChannelEditorShell`: en móvil, colapsar el panel de inspector a hoja inferior
  (bottom sheet) o a pestañas lienzo/ajustes; barra de acciones fija.
- `VoiceBuilder`, `LandingPageBuilder`, `WaTemplateStudioEditor`,
  `VisualEmailBuilder`: para los que dependen de librería vendorizada
  (EmailBuilder.js, Builder42) y no admitan layout móvil razonable, **mensaje
  explícito** "Este editor necesita una pantalla más ancha" con CTA de volver —
  no un layout roto.
- `automations/FlowCanvas.module.css`: breakpoints + zoom/ajustar a pantalla.

**Aceptación:** a 360px y 768px ningún editor produce scroll horizontal ni
controles inalcanzables; los no soportados muestran el fallback.

## P1.f · Teclado y foco · esfuerzo M · tras P1.d

Tareas:

- `AppShell.tsx` `⌘K`: flechas ↑/↓, Enter, Home/End, `aria-activedescendant`,
  `role="listbox"`/`option`, scroll del item activo.
- `automations/FlowCanvas.tsx`: alternativa de teclado a arrastrar (mover paso
  arriba/abajo en el orden con Alt+↑/↓, o reordenar desde `FlowOutline`).
- Reordenado de pins del sidebar (`AppShell.tsx`): misma alternativa.
- Barrido de los 169 `outline: none`: cada uno con `:focus-visible` explícito o
  eliminado en favor del fallback global. Usar `var(--focus-ring)`.
- Tap targets: subir a ≥40px (área táctil, permitido mantener el icono visual
  pequeño con padding o `::after` expandido) los botones-icono de
  `AppSubscribers.module.css:75`, `PricingEstimator.module.css:483` y el resto
  del barrido de 20-39px.

**Aceptación:** el paleta de comandos es operable sin ratón; `axe`/eslint-jsx-a11y
sin nuevas violaciones; ningún control interactivo por debajo de 40px de área.

## P1.g · Decisión de dark mode · esfuerzo L (completar) o S (recortar)

Hoy la rampa dark está pagada y sin usar: 12% de cobertura y marketing
imposibilitado por `BaseLayout.astro:21`.

**Opción A — completar** (si dark es requisito de producto):

- Quitar el `data-theme="light"` fijo; inicializar desde `localStorage` con
  fallback a `prefers-color-scheme` en `BaseLayout` (script inline anti-flash,
  igual al que ya existe en `AppLayout.astro:54-55`).
- `AppShell.tsx:100` arranca en `'light'`; que respete la misma resolución.
- Añadir toggle en el footer de marketing.
- Barrer los 13 módulos con blanco/`rgba(255,255,255,…)` hardcodeado y los 249
  hex crudos, sustituyendo por tokens — esto es lo que da cobertura, no los
  overrides `[data-theme='dark']` uno a uno.
- Bandas oscuras de marketing (`--ink-band*`) necesitan revisión: en dark dejan
  de contrastar contra el fondo.

**Opción B — recortar** (si dark no es requisito):

- Eliminar el bloque `[data-theme='dark']` de `tokens.css` y los 7 overrides de
  módulos, más el toggle de `AppShell`.

**Aceptación:** una de las dos, decidida y documentada. El estado actual —a medias—
es el único resultado inaceptable.

## P1.h · Onboarding del workspace vacío · esfuerzo M · tras P1.c

**Problema:** un workspace nuevo aterriza en KPIs en cero sin siguiente paso.

Tareas:

- Checklist de activación en `AppDashboard.tsx`, visible mientras falten pasos:
  verificar dominio, crear lista, importar suscriptores, crear plantilla, enviar
  primera campaña. Derivada de datos reales, no de flags locales.
- Reutilizar `.acrd` + `EmptyState` de P1.c; sin librería de tours.
- Descartable y con persistencia por workspace.

**Aceptación:** con 0 suscriptores y 0 campañas, el dashboard propone una acción
concreta en vez de mostrar ceros.

## P1.i · Tablas en móvil · esfuerzo M · tras P1.b

**Problema:** degradan ocultando columnas; se pierde información sin avisar.

Tareas:

- Variante `.atable--cards` en `app.css`: bajo el breakpoint, cada `.atrow` pasa
  a tarjeta con pares etiqueta/valor.
- Aplicar en `AppSubscribers`, `AppLists`, `AppTemplates`, `AppAutomationRuns`,
  `AppMedia` (vista lista).
- Donde se sigan ocultando columnas, exponerlo en el selector de columnas
  (`shared/ColFilter`) en lugar de hacerlo en silencio.

**Aceptación:** a 360px ninguna tabla oculta datos sin que el usuario pueda
recuperarlos.

---

# Fase P2 — pulido

Lotes cortos, agrupables en 2-3 PRs.

## P2.a · Formularios y submits · esfuerzo S

- `AuthForm.tsx`: spinner + `aria-busy` en submit, no solo cambio de texto.
- `AuthForm.tsx`: el gate de "not invited" pasa de `role="status"` a `role="alert"`
  (bloquea el resultado esperado, debe ser asertivo).
- `unsubscribe.astro:66-69`: deshabilitar el submit al enviar.
- `ContactForm.tsx`: marcar visualmente el `<select>` de tema como opcional.
- Copy drift de expiración del enlace en `AuthForm.tsx`: unificar 15 vs. 30
  minutos con el valor real del backend.

## P2.b · Marketing: afordancias y descubribilidad · esfuerzo S

- `pricing.astro`: sombra/indicador de borde en `.pcmp__scroll` para que se
  descubra el scroll horizontal de la tabla `min-width: 840px`.
- `404.astro`: añadir entrada a búsqueda/guías, no solo "Back home" y "Support".
- `MarketingFooter.astro:22-24`: `HIDE_SOCIALS` pasa a config por red en
  `src/config/site.ts` en lugar de booleano todo-o-nada.
- `MarketingFooter.astro` `.foot__credit`: `clamp()` en el tipo manuscrito de
  22px fijo para evitar wrap a 360px.
- `login.astro:20` y `signup.astro:27`: sustituir `color:#ff441f` inyectado en
  crudo por `var(--brand)`.
- `MobileNav.tsx:15-19`: guardar y restaurar `body.style.overflow`
  (o reutilizar el bloqueo de scroll de `Modal` de P1.d).
- Verificar contraste del botón de búsqueda de `support.astro` sobre la banda ink.

## P2.c · Contenido decorativo que parece interactivo · esfuerzo S

Mismo patrón que los P0 de búsqueda de soporte, pero de menor impacto:

- `blog/index.astro`: chips de tema sin filtrado, y el form de newsletter que
  hace GET del email a `/contact` donde `ContactForm.tsx` nunca lo lee. Cablear
  o convertir en texto no interactivo.

## P2.d · Miniaturas y previews · esfuerzo S

Los `font-size` de 6-9px en `shared/GalleryPreview.module.css:30,36,79`,
`AppTemplates.module.css:564`, `AppMedia.module.css:258` e `index.astro:1173`
son cromo decorativo de maquetas, no copy — correcto que sean diminutos, pero:

- Marcar los contenedores como `aria-hidden="true"` para que no se lean.
- Comprobar que ningún dato real (nombre de plantilla, de archivo) se apoye solo
  en ese tamaño.

## P2.e · Tipografía y token drift residual · esfuerzo M

- Barrido de los `font-size` en px restantes hacia `--fs-*`; ampliar la escala si
  falta algún escalón en vez de volver a px.
- Los cinco módulos >1.000 líneas (`AppSettings.module.css` 1.528,
  `AppSubscriberDetail` 1.144, `AppListDetail` 1.099, `AppSubscribers` 1.075,
  `AppProfile` 1.000) deberían encogerse de forma medible como consecuencia de
  P1.a-P1.d; si no lo hacen, hay duplicación que los lotes no capturaron.
- `AppProfile.module.css` es el peor ofensor de drift (31 hex, 18 rgba): pasada
  dedicada.

## P2.f · Documentación · esfuerzo S

- `DESIGN.md` no existe pero `tokens.css:2` y `global.css:314` lo citan como
  fuente canónica: o se escribe (generado desde el código actual) o se corrigen
  las referencias.
- `docs/improve_SEO.md` está vacío (0 bytes): rellenar o borrar.
- Documentar en este repo el inventario de primitivas de `app.css` y la regla
  "primero busca la primitiva `a*`", que es lo que evita que los 108 duplicados
  vuelvan a crecer.

## P2.g · i18n — decisión, no implementación · esfuerzo S (decisión)

`lang="en"` está fijo en `BaseLayout.astro:21`, `auth/verify.astro:2` y
`waitlist-template.ts:29`; no hay capa de traducción y las fechas/números se
formatean ad hoc. Correcto si el producto es solo inglés. Registrar la decisión
explícitamente: es la más cara de revertir más tarde, y conviene que sea una
elección y no un descuido. Si se prevé multi-idioma, extraer los strings **antes**
de P2.e (que toca los mismos archivos).

---

## Orden y dependencias

```
P1.a Toast ──┬─> P1.b Skeleton ──┬─> P1.c EmptyState ──> P1.h Onboarding
             │                   └─> P1.i Tablas móvil
P1.d Modal ──┴─> P1.f Teclado
P1.e Editores responsive   (independiente, el más largo — arrancar en paralelo)
P1.g Dark mode: DECIDIR primero; si es "completar", ejecutar después de P1.a-P1.d
                para no barrer los mismos módulos dos veces
P2.a-P2.d  (independientes, agrupables)
P2.e       después de P1.a-P1.d (mide el efecto real)
P2.f-P2.g  cierre
```

Camino crítico sugerido: **P1.g (decisión) → P1.a → P1.d → P1.b → P1.c → P1.f →
P1.i → P1.h**, con **P1.e** en paralelo desde el día uno por ser el de mayor
duración.

## Gates de verificación

Por lote:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Además, en lotes que toquen shell, nav o editores:

```bash
pnpm test:e2e
```

Métricas de cierre de fase P1 — todas verificables por grep/conteo:

| Métrica                                             | Hoy                | Objetivo P1               |
| --------------------------------------------------- | ------------------ | ------------------------- |
| Render sites de toast                               | 15                 | 1                         |
| Pantallas de workspace con skeleton                 | 2                  | todas las que hagan fetch |
| Selectores locales duplicando primitivas `a*`       | 108                | < 40                      |
| Módulos CSS con `@media` entre los shells de editor | 0/3                | 3/3                       |
| `outline: none` sin `:focus-visible` explícito      | 169 en 41 archivos | 0 sin justificar          |
| Botones-icono con área < 40px                       | 223 declaraciones  | 0                         |
| Cobertura dark en módulos CSS                       | 7/57               | 57/57 o 0/57 (según P1.g) |
| Pantallas con estado de primer uso + CTA            | parcial            | todas las listas/boards   |

Tests a añadir: focus trap del `Modal` (unitario), navegación por teclado del
`⌘K` (unitario o e2e), y un e2e que recorra el workspace vacío comprobando que
cada lista muestra estado de primer uso en vez de tabla vacía.
