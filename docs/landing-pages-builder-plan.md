# Landing Pages (Builder42) — plan de trabajo por tareas

> Complemento de `docs/landing-pages-builder-integration.md` (arquitectura y lo
> ya hecho). Este documento es la **cola de trabajo**: tareas discretas,
> autocontenidas, pensadas para repartirse entre subagentes encolados.
>
> Revisión inicial hecha sobre `feat/landing-pages-builder-integration`.

---

## 0. Protocolo — léelo antes de empezar tu tarea

Esto va dirigido a quien ejecute una tarea de la cola (humano o subagente). Si
eres un subagente, **este apartado y tu ficha son todo el contexto que
necesitas**; no hace falta que releas el resto del plan.

### 0.1 Contexto mínimo

- `packages/builder42/` es el editor visual de landing pages. **Es código
  propio de este repo desde 2026-09-01**: no hay upstream, no hay re-sync desde
  `pb-static`, no existe el objetivo de "cero parches". Se edita como cualquier
  otra fuente de primera parte. Ver `packages/VENDOR.md` §Builder42.
- El editor se monta dentro del workspace en `/dashboard/landings/editor` vía
  `src/components/react/LandingPageBuilder.tsx`, con `locale="en"`.
- Maildrill es **monolingüe en inglés**. El editor conserva su chrome en
  es/en/it; lo que se corrige es que haya superficies que ignoran ese sistema y
  pintan español fijo.

### 0.2 Reglas

1. **No salgas de los archivos listados en tu ficha.** Si crees que hace falta
   tocar otro, dilo en el reporte en vez de hacerlo: probablemente pertenece a
   otra tarea de la cola y provocaría un conflicto.
2. **Respeta las dependencias** de tu ficha (`Depende de`). Si la tarea de la
   que dependes no está ✅ en el tablero, no empieces.
3. **No reescribas comentarios ajenos.** Los comentarios del paquete están en
   español y son extensos a propósito: explican decisiones. Cambiar su idioma
   generaría diffs enormes sin valor. Toca solo lo que tu tarea pide.
4. **Verifica antes de commitear**: `pnpm typecheck` y `pnpm test`. Si tu tarea
   es anterior a `B1`, el typecheck todavía no cubre `packages/builder42` —
   dilo en el reporte.
5. **Un commit por tarea**, en la rama actual. Prefijo según el log del repo:
   `feat(builder42):`, `fix(builder42):`, `chore(builder42):`,
   `docs(landing-pages):`. El mensaje empieza por el id de la tarea.
   Ejemplo: `fix(builder42): [I0] complete the en dictionary for components and behaviors`
6. **Actualiza el tablero (§1) en ese mismo commit**: pon tu fila en ✅ y añade
   una nota de una línea si algo quedó fuera. El tablero es la memoria
   compartida de la cola — si no lo actualizas, el siguiente subagente repite tu
   trabajo.
7. Si tu tarea resulta ser más grande de lo que dice la ficha, **no la
   amplíes**: haz la parte que cabe, marca la fila como 🟡 y describe el resto
   en la nota. Que otra tarea lo recoja es mejor que un commit gigante.

### 0.3 Decisiones ya cerradas (no las re-abras)

- **Labels de props del inspector → vía i18n**, no reescritos a inglés en el
  sitio. El editor sigue siendo traducible a es/en/it; los mapas `props` y
  `propGroups` de `common.json` ya existen y se conectan (tareas `I1`/`I2`).
- **Plantillas → se reescriben con base en inglés**: el copy inglés pasa a
  `props`, el español se mueve a `translations.es`, `defaultLang: "en"`
  (tareas `T0`–`T6`).
- **Builder42 no vuelve a sincronizarse con `pb-static`.**

---

## 1. Tablero

Estado: ⬜ pendiente · 🟡 parcial · ✅ hecho · ⛔ bloqueada.

| id     | Tarea                                                   | Estado | Depende de | Conflictos con |
| ------ | ------------------------------------------------------- | ------ | ---------- | -------------- |
| **B0** | Commitear el trabajo pendiente del árbol                | ⬜     | —          | —              |
| **B1** | `tsconfig.json` del paquete + `pnpm typecheck`          | ⬜     | B0         | —              |
| **B2** | Alcance de eslint para `packages/builder42`             | ⬜     | B1         | —              |
| **B3** | Vitest en el paquete + helpers de test huérfanos        | ⬜     | B1         | —              |
| **I0** | Huecos del diccionario `en` (components + behaviors)    | ⬜     | B1         | I1, I2         |
| **I1** | Cablear el lookup i18n de labels y grupos de props      | ⬜     | I0         | I2, I3         |
| **I2** | Poblar el diccionario de labels de props (en/es/it)     | ⬜     | I1         | I1, I3         |
| **I3** | Labels de estilos → `styleLabels`                       | ⬜     | I2         | I2             |
| **R1** | Español que llega al sitio publicado                    | ⬜     | B1         | D1             |
| **D1** | `defaultProps` en español de los componentes            | ⬜     | B1         | R1             |
| **S1** | Defaults del sitio nuevo (`defaultLang`, "Sitio")       | ⬜     | B1         | T0             |
| **E1** | Microcopy y mensajes de error del chrome                | ⬜     | B1         | —              |
| **T0** | Base inglesa: `applyPageLayout` y `meta.i18n`           | ⬜     | S1         | S1             |
| **T1** | Plantillas de sección → base inglesa (11 archivos)      | ⬜     | T0         | —              |
| **T2** | Plantillas de página, lote 1 (5 archivos)               | ⬜     | T0         | —              |
| **T3** | Plantillas de página, lote 2 (4 archivos)               | ⬜     | T0         | —              |
| **T4** | Plantillas de página, lote 3 (4 archivos)               | ⬜     | T0         | —              |
| **T5** | Plantillas de página, lote 4 (4 archivos)               | ⬜     | T0         | —              |
| **G1** | Guarda de regresión: cobertura i18n del chrome          | ⬜     | B3, I2     | —              |
| **P1** | Adapter `publish` (pipeline propio de Maildrill)        | ⬜     | decisión   | —              |
| **P2** | Adapter `generateFragment` (IA)                         | ⬜     | decisión   | —              |
| **P3** | Regenerar tipos OpenAPI y quitar los `as never`         | ⬜     | —          | —              |
| **P4** | Aplicar la migración `0032` en local                    | ⬜     | —          | —              |
| **P5** | Gate del 404 de `fetchTranslateUsage`                   | ⬜     | B1         | —              |

**Cómo encolar.** `B0` y `B1` van primero y solos. Después hay cuatro carriles
que pueden avanzar en paralelo:

```
carril i18n-chrome (serie, todos tocan los mismos JSON):  I0 → I1 → I2 → I3 → G1
carril contenido  (serie por el conflicto R1/D1):         R1 → D1
carril plantillas (T1..T5 en paralelo tras T0):           S1 → T0 → {T1,T2,T3,T4,T5}
carril suelto     (independientes entre sí):              E1, B2, B3, P3, P4, P5
```

`P1` y `P2` no entran en la cola todavía: dependen de decisiones de producto
(§4).

---

## 2. Fase B — base del paquete

Builder42 se importó **sin su tooling** (se descartaron `scripts`, vite,
vitest, typescript y `@types/*`). Mientras era código upstream tenía sentido: se
comprobaba en su repo. Ahora no lo comprueba nadie, y las fases siguientes
tocan ~40 archivos del paquete. Por eso esta fase va primero.

### B0 — Commitear el trabajo pendiente del árbol

**Objetivo.** Dejar el árbol limpio antes de encolar nada. Hay dos archivos
modificados sin commitear.

**Archivos.**

- `packages/builder42/src/builder/registry/components/Image.tsx`
- `packages/builder42/src/styles/chrome/inspector-controls.css`

**Qué hay.** `objectPosition` pasó de `control: "text"` a
`searchable-select` con un mini-diagrama 3×3 como preview de opción, y los
selects del inspector perdieron el `max-width` de 130/140px que apretaba
etiquetas de texto.

**Hecho cuando.** Commit hecho. Ojo: las opciones nuevas están en español
(`Centro`, `Arriba izquierda`, …) — **no las traduzcas aquí**, son material de
`I2`.

**Commit.** `feat(builder42): [B0] object-position as a searchable select with 3×3 preview`

---

### B1 — `tsconfig.json` del paquete y `pnpm typecheck`

**Objetivo.** Que una edición a `packages/builder42/` no pase sin
type-checkear. Hoy no hay `tsconfig.json` en el paquete, y `packages/` está
excluido del `tsconfig` raíz (`tsconfig.json:19`) y suprimido en
`scripts/typecheck.mjs` (descarta todo error cuyo path empiece por `packages/`).

**Archivos.**

- `packages/builder42/tsconfig.json` (nuevo)
- `package.json` (script `typecheck`)

**Cómo.** Copia el patrón de `packages/wa-template-studio/tsconfig.json`
(`strict`, `noUncheckedIndexedAccess`, `paths: { "@/*": ["./src/*"] }`,
`include: ["src", "shared"]`) y añade al script raíz
`tsc -p packages/builder42 --noEmit`, junto al de `wa-template-studio`.

**Aviso.** Es un árbol grande escrito contra reglas más laxas: la primera pasada
con `strict` + `noUncheckedIndexedAccess` va a sacar bastantes errores.
**No los arregles todos en esta tarea.** Si son muchos, arranca con esos dos
flags en `false`, deja el resto de `strict` activo, y anota en la nota del
tablero cuántos errores aparecen con ellos en `true` — endurecerlos es una
tarea aparte.

**Hecho cuando.** `pnpm typecheck` pasa e incluye el paquete.

**Commit.** `chore(builder42): [B1] type-check the package in CI`

---

### B2 — Alcance de eslint

**Objetivo.** Decidir si `packages/builder42` entra en el lint del repo.
`eslint.config.js:11` ignora `packages/**` entero.

**Archivos.** `eslint.config.js`

**Cómo.** Entrar con las reglas completas de golpe generará ruido masivo. Lo
pragmático es un override por directorio para `packages/builder42/**` con el
subconjunto que aporte (no-unused-vars, reglas de hooks de React) y el resto en
`warn` u `off`.

**Hecho cuando.** `pnpm lint` pasa con el paquete incluido.

**Commit.** `chore(builder42): [B2] lint the package with a scoped override`

---

### B3 — Vitest y helpers de test huérfanos

**Objetivo.** El paquete tiene **cero** archivos `*.test.*` — no vinieron en la
importación — pero sí trajo **5 helpers de test que no usa nadie** (hoy solo los
mencionan comentarios):

- `src/builder/registry/layouts/catalogCoverage.helper.ts`
- `src/builder/registry/layouts/layoutSignature.helper.ts`
- `src/builder/registry/layouts/localeCoverage.helper.ts`
- `src/builder/registry/layouts/themeAudit.helper.ts`
- `src/builder/registry/layouts/visualAudit.helper.ts`

**Archivos.** los 5 de arriba, `packages/builder42/vitest.config.ts` (nuevo),
`packages/builder42/package.json`, tests nuevos.

**Cómo.** `localeCoverage.helper.ts` y `catalogCoverage.helper.ts` son
justamente los que blindan el trabajo de las fases I y T — escribe tests que los
usen. Los otros tres: si no vas a mantenerlos, bórralos; código muerto que
aparenta cobertura es peor que no tener nada.

**Hecho cuando.** `vitest` corre dentro del paquete y ningún `*.helper.ts` queda
sin usar.

**Commit.** `test(builder42): [B3] wire vitest and revive the coverage helpers`

---

## 3. Fase I — i18n del chrome del editor

El editor se monta con `locale="en"`, pero eso solo traduce lo que pasa por
i18next. Hay superficies que renderizan el literal español directo. El
inventario completo está en el **Apéndice A**.

Decisión cerrada: se arregla **vía i18n**, no reescribiendo a inglés en el
sitio. La infraestructura ya existe — `src/i18n/locales/{en,es,it}/common.json`
define `props`, `propGroups` y `styleLabels`, y **ningún archivo del código los
lee** (verificado con grep sobre todo `src/`). El trabajo es conectarlos y
completarlos.

### I0 — Huecos del diccionario `en`

**Objetivo.** Claves que ya se consultan pero no existen en `en`, así que caen
al fallback español.

**Archivos.**

- `packages/builder42/src/i18n/locales/en/common.json`
- `packages/builder42/src/i18n/locales/en/inspector.json`
- (y sus gemelos `it/` si falta lo mismo ahí)

**Qué falta.**

1. `common.components`: faltan **`tab`** y **`accordion-item`**.
2. `inspector.behaviors.fields.*`: cubre 10 de ~19 behaviors. Faltan:

| Behavior          | Claves                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| `carousel`        | `prev`, `next`, `orientation`, `slideSize`, `gap`, `loop`, `autoplay`, `showArrows`  |
| `form-validation` | `validateOn`, `requiredMessage`, `emailMessage`, `patternMessage`                    |
| `accordion`       | `single`, `duration`                                                                 |
| `modal`           | `closeOnBackdrop`, `duration`                                                        |
| `navbar`          | `duration`                                                                           |
| `tabs`            | `duration`                                                                           |
| `toggle`          | `pressed`                                                                            |

Los literales españoles actuales están en `src/builder/registry/behaviors/*.ts`
(`label:` de cada campo) — úsalos como origen de la traducción, pero **no los
toques**: el mecanismo `t(..., { defaultValue: field.label })` ya existe
(`BehaviorsSection.tsx:126-128`) y el literal es el fallback.

**Hecho cuando.** Ningún campo de behavior ni nombre de componente se ve en
español con `locale="en"`.

**Commit.** `fix(builder42): [I0] complete the en dictionary for components and behaviors`

---

### I1 — Cablear el lookup de labels y grupos de props

**Objetivo.** Hoy `PropField.tsx:38` pinta `{field.label}` crudo y
`PropsGroupAccordion.tsx:41` pinta el nombre de grupo crudo. Ninguno pasa por
i18next, así que ~45 labels y los 9 nombres de grupo se ven en español.

**Archivos.**

- `packages/builder42/src/builder/inspector/controls/PropField.tsx`
- `packages/builder42/src/builder/inspector/form/PropsGroupAccordion.tsx`
- `packages/builder42/src/i18n/locales/{en,es,it}/common.json` — **solo la
  sección `propGroups`**; `props` es de `I2`.

**Cómo.** Mismo patrón que ya usan behaviors y acciones de click
(`BehaviorsSection.tsx:154`, `ModalTriggersSection.tsx:60`): clave con
`defaultValue` al literal actual, para que nada se rompa mientras el
diccionario se completa en `I2`.

```tsx
// PropField.tsx
const label = tc(`props.${node.type}.${field.key}`, { defaultValue: field.label });
// PropsGroupAccordion.tsx
const label = tc(`propGroups.${slug(groupName)}`, { defaultValue: groupName });
```

Los 9 grupos a cubrir en `propGroups` (hoy solo hay 3): `Contenido`, `Acción`,
`Estado`, `Formulario`, `Validación`, `Accesibilidad`, `Apariencia`, `Grid`,
`Orientación`.

Aprovecha para el microcopy de ese mismo archivo:
`PropsGroupAccordion.tsx:42` → `title={`${fields.length} campo(s)`}`.

**Hecho cuando.** Los nombres de grupo salen en inglés y los labels de props
siguen viéndose igual que antes (aún en español, vía `defaultValue`) — esta
tarea no traduce labels, solo abre el camino.

**Commit.** `fix(builder42): [I1] route prop labels and group names through i18n`

---

### I2 — Poblar el diccionario de labels de props

**Objetivo.** Rellenar `common.props` en los tres locales para los ~45 labels
españoles. Hoy tiene 9 claves sueltas.

**Archivos.** `packages/builder42/src/i18n/locales/{en,es,it}/common.json`

**Origen.** Los `propsSchema.fields[].label` de
`packages/builder42/src/builder/registry/components/*.tsx`. **No edites esos
archivos**: los literales se quedan como `defaultValue`. Reparto por componente
(fields totales / labels en español):

| Componente        | fields | es  | Componente     | fields | es  |
| ----------------- | ------ | --- | -------------- | ------ | --- |
| `PricingCard.tsx` | 8      | 5   | `Avatar.tsx`   | 3      | 2   |
| `Button.tsx`      | 5      | 5   | `Form.tsx`     | 3      | 2   |
| `Image.tsx`       | 5      | 3   | `NavMenu.tsx`  | 2      | 2   |
| `Input.tsx`       | 5      | 3   | `Stat.tsx`     | 2      | 2   |
| `Textarea.tsx`    | 5      | 2   | `Label.tsx`    | 2      | 2   |
| `Select.tsx`      | 4      | 1   | resto          | —      | 1   |
| `IconComponent`   | 3      | 3   |                |        |     |
| `Video.tsx`       | 3      | 3   |                |        |     |

Cubre también los `placeholder` y los `options[].label` de esos campos. Los
conjuntos de opciones con más español, para que no se escapen:

- `Image.tsx:139-146` — las 9 posiciones que dejó `B0` (`Centro`,
  `Arriba izquierda`, `Abajo derecha`, …)
- `LanguageNav.tsx:189-203` — `Ícono (globo)`, `Nombre nativo (Español)`,
  `Código (ES)`, `Nombre traducido (Spanish)`
- `Input.tsx:104-106` — `Teléfono`, `Número`, `Contraseña`
- `Alert.tsx:128-129` — `Información`, `Éxito`
- `SocialLinks.tsx:46-50` — `Twitter (clásico)`
- `Container.tsx:134-139` — `Colocación en grid`, `Automática (orden)`,
  `Explícita (celda)` (estas tres **ya tienen clave** en `common.props`:
  `gridPlacement*` — son de las 9 que existen y nadie lee)

**Hecho cuando.** Ningún label de prop, grupo, placeholder ni opción se ve en
español con `locale="en"`. Recorrido manual del inspector con los componentes de
la tabla.

**Commit.** `fix(builder42): [I2] translate every inspector prop label`

---

### I3 — Labels de estilos

**Objetivo.** `src/builder/inspector/styleFields.ts` define 79 labels a mano. La
mayoría son términos CSS en inglés, pero hay español mezclado: `Dirección`
(:71), `Color texto` (:217), `Tamaño` (:234), `Alineación` (:259), `Decoración`
(:271); y `PropertyRow.tsx:150` ("Decoración"). El mapa `common.styleLabels` ya
cubre 26 de esos labels y tampoco lo lee nadie.

**Archivos.**

- `packages/builder42/src/builder/inspector/styleFields.ts`
- el punto donde se pinta el label del panel de estilos
  (`panel/StylePanel.tsx` / `panel/PropertyRow.tsx`)
- `packages/builder42/src/i18n/locales/{en,es,it}/common.json` (`styleLabels`)

**Cómo.** Mismo patrón que `I1`: `tc(\`styleLabels.${key}\`, { defaultValue })`,
y completar el mapa hasta cubrir los 79.

**Commit.** `fix(builder42): [I3] route style labels through i18n`

---

### R1 — Español que llega al sitio publicado

**Objetivo.** Lo más grave del inventario: no es chrome del editor, son
literales que el runtime exportado escribe en la landing que ve el visitante
final. Un usuario que publique en inglés obtiene hoy mensajes en español sin
haber tocado nada.

**Archivos.**

- `packages/builder42/src/runtime/behaviors/formValidation.ts:35-37` —
  `"Este campo es obligatorio"`, `"Ingresa un correo válido"`,
  `"El formato no es válido"`
- `packages/builder42/src/builder/registry/behaviors/formValidation.ts:23-25` —
  los mismos defaults, duplicados
- `packages/builder42/src/runtime/behaviors/expandable.ts:44` —
  `DEFAULT_EXPAND_LABEL = "Ver más"` (y su pareja "Ver menos")
- `packages/builder42/src/builder/registry/components/Navbar.tsx:141` —
  `aria-label="Abrir menú"` en el botón hamburguesa

Barre también los `aria-label` de los demás componentes del registry: cualquier
literal dentro de un `render` sale al HTML exportado, aunque no lo veas en el
canvas.

**Cómo.** Estos **sí** se reescriben a inglés en el sitio: son valores por
defecto del documento del usuario y del HTML exportado, no chrome traducible.
Los de `form-validation` siguen siendo editables campo a campo desde el
inspector, que ya lo permite.

⚠️ Toca `registry/components/`, igual que `D1`. Ve antes que `D1`.

**Commit.** `fix(builder42): [R1] default published-site copy to English`

---

### D1 — `defaultProps` en español

**Objetivo.** Cada componente inserta su contenido de ejemplo en español al
arrastrarlo al canvas. Es contenido: se queda dentro del documento del usuario y
se publica tal cual si no lo edita.

**Archivos** (`packages/builder42/src/builder/registry/components/`), todos
verificados como `defaultProps` / `defaultChildren`:

| Archivo             | Dónde       | Qué                                                     |
| ------------------- | ----------- | ------------------------------------------------------- |
| `Button.tsx:108`    | defaultProps | `label: "Botón"`                                        |
| `Button.tsx:164`    | defaultProps | `label: "Enviar"` (variante submit)                     |
| `Button.tsx:70`     | render       | fallback `?? "Botón"` — **sale al HTML exportado**       |
| `Select.tsx:163-165` | defaultProps | `Opción 1/2/3`                                         |
| `Accordion.tsx:104-106` | defaultChildren | 3 secciones de FAQ completas                     |
| `Tab.tsx:69-73`     | defaultProps | `Pestaña`, `<p>Contenido de la pestaña.</p>`            |
| `AccordionItem.tsx:89-91` | defaultProps | `Sección`, `<p>Contenido de la sección.</p>`      |
| `Quote.tsx:85`      | defaultProps | cita + `attribution`                                    |
| `Testimonial.tsx:115-116` | defaultProps | `quote`, `name`                                   |
| `Alert.tsx:117`     | defaultProps | `message: "Este es un mensaje importante."`             |
| `Breadcrumb.tsx:115-116` | defaultProps | items `Inicio` / `Categoría` / `Página actual`    |
| `Modal.tsx:174`     | defaultProps | `title: "Únete a nuestra newsletter"`                   |
| `Text.stub.tsx:233` | defaultProps | `content: "Texto de ejemplo"`                           |

**Cómo.** Reescribir a inglés.

**No confundir** — estas tres cosas viven en los mismos archivos y **no** son de
esta tarea:

- `label:` del `ComponentDefinition` (ej. `Button.tsx:105`, `Tab.tsx:64`,
  `Section.tsx:68`, `Navbar.tsx:240`): es el nombre del componente en la
  paleta, y **sí** pasa por i18n (`common.components`). Lo cubre `I0`.
- `label:` de `propsSchema.fields[]` y sus `options[].label`
  (ej. `Input.tsx:104-106`, `SocialLinks.tsx:46-50`): son de `I2`.
- `Alert.tsx:128-129` (`Información`, `Éxito`): son `options[].label` → `I2`.

⚠️ Depende de `R1` por conflicto de archivos.

**Commit.** `fix(builder42): [D1] default component content to English`

---

### E1 — Microcopy y mensajes de error

**Objetivo.** Español suelto en el chrome y en errores. Prioridad baja, pero
barato y mecánico.

**Archivos.**

- `src/builder/inspector/controls/NumericUnitInput.tsx:316` —
  `aria-label="valor numérico"`
- `src/builder/registry/components/Modal.tsx:113` — hint punteado "suelta aquí"
- `src/main.tsx:9`, `src/builder/model/persist.ts:59` (`JSON inválido: …`),
  `src/builder/registry/componentRegistry.ts:155,185`
  (`Tipo de componente no registrado`), `src/Builder42Editor.tsx:98`
  (`sitio inicial inválido`), `src/builder/registry/layoutRegistry.ts:983`
- `src/builder/model/validate.ts` — ~53 mensajes tipo
  `debe ser un objeto SiteMeta`

**Cómo.** Los de `validate.ts` y los `throw` son de consola/error, no de UI
normal, pero salen a la superficie cuando un documento guardado no valida. No
hay razón para traducirlos vía i18n: basta escribirlos en inglés.

**Commit.** `fix(builder42): [E1] English microcopy and error messages`

---

### G1 — Guarda de regresión

**Objetivo.** Que la fase I no se deshaga componente a componente. Es lo único
que evita la regresión.

**Archivos.** un test nuevo en el paquete (necesita `B3`).

**Cómo.** Mismo espíritu que `localeCoverage.helper.ts`, pero para el **chrome**:
recorrer el registry y afirmar que toda `field.label`, `field.group`,
`options[].label` y `styleFields[].label` tiene clave en el diccionario `en`.

**Commit.** `test(builder42): [G1] assert full en coverage of inspector labels`

---

## 4. Fase T — plantillas con base inglesa

Decisión cerrada: las 28 plantillas (17 páginas + 11 secciones, ~700 literales)
se reescriben con **inglés como base** — el copy inglés pasa a `props`, el
español se mueve a `translations.es`, `defaultLang: "en"`.

Lo que abarata mucho el trabajo: **las traducciones inglesas ya existen nodo a
nodo** en cada archivo (`translations[nodeId].en`, y `metaTranslations.en` para
el SEO). El trabajo es sobre todo un **swap** base ↔ traducción, no traducir de
cero.

### S1 — Defaults del sitio nuevo

**Objetivo.** Toda landing creada en Maildrill nace declarándose española.
`createSiteFromDocument` (`src/builder/model/site.ts:196-212`) — el que usa
`Builder42Editor.tsx:96` cuando no hay `site` — fija:

- `siteName = "Sitio"` — lo pisa el host vía `setSiteName`, inocuo pero mejor
  cambiarlo.
- `defaultLang: "es"` — **sí importa**: marca el idioma base del documento y
  condiciona `editingLocale` (`store/slices/ui.ts:131`) y la resolución de
  traducciones.
- `meta: { title: "Inicio", slug: "" }` — nombre de la home, visible en el Page
  Manager.

Lo mismo en `migrateDocToSite` (`site.ts:174-190`).

**Archivos.** `src/builder/model/site.ts`, opcionalmente
`src/Builder42Editor.tsx` (prop `defaultLang`).

**Cómo.** Ya no hay consumidor standalone cuyo comportamiento haya que
preservar, así que se puede cambiar el default del paquete a `"en"`
directamente. Añadir además el prop `defaultLang` a `Builder42EditorProps` sigue
siendo razonable si se quiere que el host lo decida explícito.

**Commit.** `fix(builder42): [S1] default new sites to English`

---

### T0 — `applyPageLayout` y el `meta.i18n` no deseado

**Objetivo.** Preparar el terreno de `T1`–`T5` y arreglar un efecto secundario:
`store/slices/layouts.ts:88-106` — al aplicar una plantilla, si declara
`siteLocales`, el store **activa `meta.i18n`** en el sitio (locales es/en/it,
`routeStrategy: "prefix-except-default"`). En Maildrill, monolingüe y con la UI
de traducción oculta, eso deja al usuario con un sitio multilingüe que no pidió
y que no puede gestionar.

**Archivos.** `packages/builder42/src/builder/store/slices/layouts.ts`

**Cómo.** No activar `meta.i18n` salvo que el sitio ya sea multilingüe; si ya lo
es, seguir siendo aditivo como ahora.

**Hecho cuando.** Aplicar una plantilla a un sitio monolingüe lo deja
monolingüe.

**Commit.** `fix(builder42): [T0] don't turn a site multilingual on template apply`

---

### T1–T5 — El swap, por lotes

Cada lote es independiente: archivos distintos, sin estado compartido. Se pueden
correr en paralelo en cuanto `T0` esté ✅.

**Receta, idéntica para cada archivo** (`src/builder/registry/layouts/`):

1. Por cada nodo con `translations[nodeId].en`: mover ese valor a `props`, y el
   valor español que había en `props` a `translations[nodeId].es`.
2. Igual con `metaTranslations.en` ↔ los campos base de `LayoutPageMeta`
   (`title`, `description`, `seo.openGraph`, `seo.twitter`).
3. `it` se queda donde está, intacto.
4. Los nodos sin traducción `en` (nombres propios, teléfonos, direcciones) se
   quedan como están.
5. Alt-texts de imagen y `aria-label` cuentan como copy: también se cambian.

**Hecho cuando.** El archivo no tiene español en `props`, y
`translations[nodeId].es` cubre todo lo que antes era la base.

| id     | Lote                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **T1** | Las 11 de `layouts/sections/`                                                                                                |
| **T2** | `restaurantPage`, `spaWellnessPage`, `lawFirmPage`, `blogList`, `teamPage`                                                    |
| **T3** | `signupPage`, `dentalClinicPage`, `portfolio`, `barbershopPage`                                                              |
| **T4** | `landingProduct`, `autoRepairPage`, `creativeAgencyPage`, `architectureStudioPage`                                           |
| **T5** | `clothingStorePage`, `fitnessStudioPage`, `realEstatePage`, `hotelBoutiquePage`                                              |

`clothingStorePage` (en `T5`) tiene además copy **italiano** en la base, no solo
español — revísalo con cuidado.

**Commit.** `refactor(builder42): [T2] English base copy for page templates (batch 1)`

---

## 5. Fase P — producto y deuda

### P1 — Adapter `publish`

El hueco funcional más grande: sin él una landing no existe para nadie fuera del
editor. **No encolable todavía**: falta la decisión de producto de dónde se
hospeda la landing publicada y qué dominios/subdominios del tenant se usan.

Cuando llegue:

- `POST`/`DELETE /v1/landings/:id/publish` ya existen y responden `501`
  (`workers/apps/product-api/src/routes/landings.ts`).
- Debe rellenar `site_id` / `published_url` / `published_at`; la tabla y el
  listado ya tienen columnas y estado derivado (`draft`/`published`/`stale`).
- Front: el botón ya está deshabilitado en la UI; `health.publish.enabled` pasa
  a `true` y hay que decidir `capabilities` (`customSubdomain`, `openableUrl`,
  `list`, `remove`) en `src/lib/app/builder42-adapters.ts`.
- **No** se portan los providers de `pb-static`
  (`self-hosted`/`cloudflare`/`vercel`) — §5 del doc de integración.
- Ojo con el peso: el documento lleva imágenes inline, el editor avisa a 9 MB y
  el `bodyLimit` de create/patch es 12 MB. El pipeline tiene que aguantarlo o
  extraer los assets antes.

### P2 — Adapter `generateFragment` (IA)

Solo si existe un pipeline de IA reutilizable en Maildrill. Hoy
`ai.enabled: false` y `AiSectionGenerator` se oculta solo. No hay trabajo de UI:
es cablear el adapter y encender el flag.

### P3 — Regenerar tipos OpenAPI

`pnpm gen:api` y quitar los `as never` de
`src/pages/dashboard/landings/index.astro:26,29` y
`src/lib/server/landing-builder.ts:47,50`.

**Commit.** `chore(landings): [P3] regenerate OpenAPI types and drop the as-never casts`

### P4 — Migración `0032` en local

`pnpm --dir workers db:migrate` falla con
`permission denied for schema drizzle`. Arreglo:
`GRANT USAGE, CREATE ON SCHEMA drizzle TO maildrill`, o correr las migraciones
con el rol dueño del esquema. El SQL en sí aplica (verificado con `ROLLBACK`).

### P5 — Gate del 404 de `fetchTranslateUsage`

`SeoSettings.tsx:174,180` lo llama sin gate de capacidades, así que deja un 404
capturado por montaje. Ruido inocuo; se silencia con un gate sobre
`health.translate.enabled`.

**Commit.** `fix(builder42): [P5] gate the translate-usage call on health`

---

## Apéndice A — Inventario del español estático

Referencia compartida de las tareas de la fase I. Números medidos sobre el
código, no estimados.

| Superficie                        | Volumen                                       | Pasa por i18n | Tarea |
| --------------------------------- | --------------------------------------------- | ------------- | ----- |
| Labels de props del inspector     | ~45 de ~75, en 23 de 36 componentes           | ❌ no         | I1+I2 |
| Nombres de grupo de props         | 9, todos en español                            | ❌ no         | I1    |
| Placeholders y `options[].label`  | de esos mismos campos                          | ❌ no         | I2    |
| Labels de estilos                 | 5 de 79 en español; el mapa `styleLabels` existe y no se usa | ❌ no | I3 |
| Nombres de componentes            | faltan 2 claves en `en`                        | ✅ sí         | I0    |
| Campos de behaviors               | 7 behaviors sin claves `en`                    | ✅ sí         | I0    |
| Copy del sitio publicado          | validación de formularios, "Ver más", aria     | ❌ no         | R1    |
| `defaultProps` de componentes     | ~18 componentes                                | ❌ n/a        | D1    |
| Copy de plantillas                | ~700 literales en 28 archivos                  | parcial       | T1–T5 |
| Defaults del sitio nuevo          | `defaultLang`, "Sitio", "Inicio"               | ❌ n/a        | S1    |
| Microcopy y errores               | ~60 mensajes                                   | ❌ no         | E1    |

Detalle que explica por qué esto se arregla rápido: **los mapas
`common.props` (9 claves), `common.propGroups` (3) y `common.styleLabels` (26)
existen en en/es/it y no los lee ningún archivo.** La infraestructura estaba
puesta y desconectada.

---

## Apéndice B — Estado de la integración

Resumen para no tener que abrir el otro documento. Detalle completo en
`docs/landing-pages-builder-integration.md`.

**Funcionando:** editor montado con persistencia real (tabla `landings`), CRUD
con filtros/orden/paginación/duplicado, loader SSR, pestaña Landings, nombre
editable desde el host, media library del tenant y Unsplash como fuentes de
imagen, Publish oculto, edición JSON cruda eliminada, fix de z-index de modales.

**Apagados a propósito** (`fetchHealth` lo reporta y la UI se oculta sola):
`publish`, `ai`, `translate`.

**Único punto de cableado de adapters:** `src/lib/app/builder42-adapters.ts`.

---

## Referencias

- Estado y arquitectura: `docs/landing-pages-builder-integration.md`
- Estado del paquete (código propio, sin upstream): `packages/VENDOR.md`
  §Builder42
- Contrato de props del editor: `packages/builder42/src/Builder42Editor.tsx`
- Setup de i18n del editor: `packages/builder42/src/i18n/index.ts`
- Wrapper del host: `src/components/react/LandingPageBuilder.tsx`
