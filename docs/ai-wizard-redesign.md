# System Design — Refactor UX del AI Composition Wizard

> Ámbito: `packages/email-builder-standalone/src/App/AIGeneration/**`
> Objetivo del feedback: _"hacerlo más simple y útil; se volvió demasiado complejo.
> Refactorizar la UX de composición usando los tokens de estilo globales de la App y
> hacerla consistente entre todos los steps. Reemplazar los selectores de input por los
> que se usan en el resto de la App — principalmente **badges (pill btns)** y
> **radio pill selectors**."_

---

## 1. Contexto

El wizard de generación con IA vive **dentro del editor vendored** (`email-builder-standalone`),
que renderiza con **MUI** bajo un tema (`src/theme.ts`) que ya está calcado a los design tokens
del host app (neutros _warm-cream_, anillo de foco indigo `#4f46e5`, radios 6/8/10, y — clave para
este refactor — `MuiToggleButton` + `MuiToggleButtonGroup` ya estilizados como **pills
segmentados**). Por tanto "usar los tokens globales de la App" **no** significa traer el CSS del
sitio Astro al editor: significa **dejar de usar `sx` ad-hoc y `MUI Chip` sueltos y apoyarse en el
tema y en los primitivos compartidos del InspectorDrawer**.

### 1.1 Flujo actual (3 capas de decisión antes de responder nada útil)

```
EntryPicker (Direct | Wizard)         ← 2 cards
  └─ GenerationTargetPicker            ← 3 cards (Template | Component | Theme)
        └─ N steps                     ← Template=5, Component=3, Theme=2
              └─ SummaryStep / ThemeSummaryStep
   (+ WizardHeader con un Switch que alterna Direct↔Wizard en cualquier momento)
```

Archivos:

| Archivo | Rol |
| --- | --- |
| `AIGenerationDialog.tsx` | Orquesta `picker | direct | wizard`, estado de streaming, apply/retry |
| `Wizard/EntryPicker.tsx` | Cards Direct vs Wizard |
| `Wizard/GenerationTargetPicker.tsx` | Cards Template / Component / Theme |
| `Wizard/AIVisualWizard.tsx` | Stepper, secuencia de steps por target, `MobileStepper` |
| `Wizard/ChipQuestion.tsx` | Pregunta con `MUI Chip` (single/multi) + textfield opcional |
| `Wizard/WizardField.tsx` | TextField con `LabelProperty` + `INPUT_TEXTFIELD_SX` ✅ ya alineado |
| `Wizard/ColorPickerField.tsx` | Envuelve `BaseColorInput` del inspector ✅ |
| `Wizard/steps/Step01..05`, `StepThemeColors`, `StepThemeTypography` | Steps concretos |
| `Wizard/SummaryStep.tsx`, `ThemeSummaryStep.tsx` | Compilación de prompt / preview de tema |

### 1.2 Diagnóstico de complejidad e inconsistencia

**Navegación / arquitectura**
- Dos ejes de elección independientes presentados en cascada (Entry _y_ Target) + un `Switch`
  redundante en `WizardHeader` que vuelve a alternar el mismo eje. El usuario decide 2 veces lo
  mismo por caminos distintos.
- `Template` obliga a 5 steps; muchos son opcionales pero se presentan como obligatorios (botón
  **Skip** por step), lo que transmite "esto es largo".

**Controles (el núcleo del feedback)**
- `ChipQuestion` usa **`MUI Chip`** con `variant filled/outlined`. Un `Chip` es semánticamente un
  _tag_, no un control de selección; para **single-select** el patrón correcto ya existente en la App
  es el **radio-pill** (`RadioGroupInput` / `InspectorPillToggleGroup`, que son `ToggleButtonGroup`
  segmentados y ya tematizados). Hoy el single-select se emula haciendo que un chip "toggle" vacíe
  el array — inconsistente con el resto del editor.
- No hay un primitivo de **multi-select en formato pill/badge** coherente; se reusa el mismo `Chip`.
- Mezcla de controles crudos con `sx` inline: `MobileStepper`, `Slider`, `Card/CardActionArea`,
  `Chip` — cada uno con su propio spacing.

**Layout de steps (falta de consistencia entre steps)**
- Espaciados dispares: `Stack spacing={2}` (Step01), `spacing={3}` (Step02/03), `spacing={2.5}`
  (StepThemeColors/Typography).
- Jerarquía de títulos duplicada: `AIVisualWizard` pinta un `subtitle2` con el título del step y
  `ChipQuestion` pinta además su propio `subtitle1` de pregunta → dos "encabezados" compitiendo.
- Los color pickers se disponen en fila (Step03) vs columna (StepThemeColors) sin razón.
- `StepThemeTypography` usa el `Select` del inspector y `LabelProperty` (bien), pero también un
  `Slider` crudo → tercer estilo de control en el mismo flujo.

---

## 2. Objetivos y no-objetivos

### Objetivos
1. **Menos capas de decisión**: del patrón `Entry → Target → Steps` a **una sola pantalla de
   entrada** + steps.
2. **Un solo lenguaje de controles**, tomado del InspectorDrawer:
   - **radio-pill** para single-select,
   - **pill/badge toggle** para multi-select,
   - `WizardField` (text), `Select` del inspector, `ColorPickerField`, `RawSliderInput`.
3. **Scaffold de step único** que garantice spacing, título, hint y navegación idénticos en
   **todos** los steps y targets.
4. **Cero `sx` de espaciado/tipografía ad-hoc**: todo sale del tema (`theme.ts`) y de las constantes
   (`constants.ts`: `RADIUS_INPUT/CARD/DIALOG`) y de `inputStyles.ts` (`INPUT_HEIGHT`,
   `INPUT_TEXTFIELD_SX`, `INPUT_CONTAINER_SX`).

### No-objetivos
- No se toca el contrato de red (`compileBriefClient`, `generateThemeClient`, NDJSON streaming) ni el
  shape de `DraftBrief`. Es un refactor de **presentación/UX**, no de datos.
- No se rediseña el `AIPreviewPanel` ni la lógica de `apply/retry` de `AIGenerationDialog`.
- No se introduce CSS del sitio Astro dentro del editor (romperían la encapsulación Shadow DOM /
  tema MUI).

---

## 3. Principios de diseño

1. **Reutiliza, no reinventes.** Si el inspector ya resuelve un control, el wizard lo importa.
2. **El tema es la única fuente de estilo.** Un control nuevo no lleva colores/paddings propios.
3. **Consistencia por composición.** Los steps no maquetan; sólo declaran preguntas dentro de un
   scaffold común.
4. **El LLM decide lo derivable; el usuario sólo aporta lo que dirige de verdad.** Premisa: quien usa
   el wizard es porque **no sabe qué quiere**; pedirle decisiones de diseño (qué secciones, qué
   sujetos de imagen) es contraproducente — siempre marcará "todo" y el input no aporta señal. Por
   tanto **la estructura (secciones/layout) y los detalles inferibles los decide el modelo** a partir
   de la estrategia (propósito + vertical + tono). El wizard sólo pregunta lo que el usuario puede
   responder con confianza y que cambia el resultado de forma significativa.
5. **Menos pasos, menos campos.** Cada pregunta debe justificar su existencia: si el modelo puede
   inferirla del resto del brief, se elimina de la UI.

---

## 4. Arquitectura propuesta

### 4.1 Flujo simplificado

Estado final: **solo existe "Full Template"** (se retiraron los objetivos Theme y Component). No hay
selector de tipo (`GenerationTargetPicker` eliminado) ni flujos de theme/componente. El wizard entra
directo a **2 pasos** y luego el resumen.

```
AIGenerationDialog
  ├─ EntryPicker (Directo | Guiado)            ← se mantiene
  ├─ Directo: prompt + toggle New/Refine + sugerencias como PILLS (PillButton)
  └─ Guiado (AIVisualWizard):
        Paso 1 · Marca         → StepBrand    (marca + tipo de email [+ objetivo si custom])
        Paso 2 · Audiencia     → StepAudience (para quién + brand colors a todo el ancho)
        Resumen                → SummaryStep
```

Notas:
- **Refine / Generate-new** funcionan igual que antes; sólo cambió el estilo de los chips de
  sugerencia (ahora `PillButton`, mismo lenguaje pill que los selectores).
- Los **brand colors** ocupan el 100% del ancho (3 swatches en `flex:1`).
- Back en el paso 1 está deshabilitado (no hay selector de tipo al que volver).

### 4.2 Nuevos primitivos compartidos

Crear `Wizard/controls/` con wrappers finos sobre lo que ya existe:

#### `WizardStep` — scaffold único de step
```tsx
interface WizardStepProps {
  /** Título del step (una sola fuente; elimina el subtitle2 externo). */
  title: string;
  /** Microcopy corto bajo el título. */
  hint?: string;
  children: React.ReactNode;
}
// Layout fijo: <Stack spacing={2.5}> con título h6 + caption hint + contenido.
// TODOS los steps lo usan → spacing/tipografía idénticos por construcción.
```

#### `PillSelect` — single-select (radio-pill)
Envuelve **`RadioGroupInput`** (o `InspectorPillToggleGroup` cuando el set entra en una fila). Es el
mismo `ToggleButtonGroup` segmentado que usa `ContentAlignment`, `Shape`, `TextAlignInput`, etc.
```tsx
interface PillSelectProps {
  label: string;
  hint?: string;
  value: string | undefined;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  onChange: (v: string) => void;
  /** 'segmented' (fila única, ≤4 opts) | 'wrap' (rejilla de pills, sets largos). */
  layout?: 'segmented' | 'wrap';
}
```
- Sets cortos (paleta, photoStyle, vertical…): `layout='segmented'` → barra segmentada full-width.
- Sets largos (purpose: 8 opciones): `layout='wrap'` → pills que hacen wrap, mismo estilo
  `MuiToggleButton` seleccionado (fondo `primary.main`, texto `contrastText`) del tema.

#### `PillMultiSelect` — multi-select (pill/badge toggles)
```tsx
interface PillMultiSelectProps {
  label: string;
  hint?: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
}
```
- Render: fila con `flexWrap`, cada opción es un `ToggleButton` **standalone** (no dentro de un
  `ToggleButtonGroup exclusive`) para permitir selección múltiple, heredando el look pill del tema.
  Estado seleccionado = `.Mui-selected` (mismo fondo `primary`). Esto sustituye al `Chip` multi.
- Alternativa equivalente si se prefiere el look "badge": `Chip` **sólo** para display no-editable
  (p.ej. resumen), nunca para selección.

> `ChipQuestion.tsx` queda **deprecado** y se elimina una vez migrados los steps. Sus dos
> responsabilidades se separan limpiamente en `PillSelect` / `PillMultiSelect` (+ `WizardField`
> para el texto libre que hoy cuelga dentro de `ChipQuestion`).

### 4.3 Mapeo de controles por step

| Step | Pregunta | Control actual | Control propuesto |
| --- | --- | --- | --- |
| Sobre | Purpose (8) | Chip single | **PillSelect** `wrap` |
| Sobre | Brand / Audience | WizardField | WizardField ✅ (sin cambios) |
| Sobre | Goal (sólo `purpose=custom`) | WizardField | WizardField ✅ |
| Sobre | Moods (multi) | Chip multi | **PillMultiSelect** |
| Sobre | Vertical (11) | Chip single | **PillSelect** `wrap` |
| Estilo | Palette (6) | Chip single | **PillSelect** `segmented`/`wrap` |
| Estilo | Brand colors ×3 | ColorPickerField (fila) | ColorPickerField, **layout unificado** (ver 4.5) |
| Estilo | Photo style (5) | Chip single | **PillSelect** `wrap` |
| Estilo | Escena concreta (opcional) | Chip multi + TextField | **WizardField** (una línea, opcional) |
| ~~Layout~~ | ~~Sections (multi)~~ | ~~Chip multi~~ | **Eliminado — lo decide el LLM** (ver 4.7) |
| ~~Imagery~~ | ~~Subjects (multi)~~ | ~~Chip multi~~ | **Eliminado — lo infiere el LLM** (ver 4.7) |
| Theme colors | 3 colores + brand | ColorPickerField (columna) + WizardField | ColorPickerField (**mismo layout que Visual**) + WizardField |
| Theme typo | Body/Headings + radius | Select inspector + Slider crudo | **Select** ✅ + **RawSliderInput** (del inspector) |

### 4.4 Estructura de steps (Template, único objetivo)

- **Paso 1 · "Tu marca"** (`StepBrand`) = Brand name + What type (purpose) [+ Goal si `purpose=custom`].
- **Paso 2 · "Audiencia y colores"** (`StepAudience`) = Audience (para quién) + Brand colors
  (swatches a todo el ancho).
- Tono, industria, paleta, estilo de imagen, escena y secciones: **los decide el modelo**.
- Theme y Component: **eliminados** (archivos `GenerationTargetPicker`, `StepThemeColors`,
  `StepThemeTypography`, `ThemeSummaryStep`, `compileThemeClient`, `ColorPickerField` borrados).

> El `DraftBrief` conserva todos los campos (compat de tipos). Los no preguntados quedan vacíos y
> `toWireBrief` los envía tal cual para que el backend deje decidir al modelo.

### 4.5 Consistencia de layout (reglas duras)

- **Un solo título por step** (el de `WizardStep`). Se elimina el `subtitle2` externo de
  `AIVisualWizard` y los `subtitle1` internos de cada pregunta pasan a ser el `label` del control.
- **Spacing único**: `WizardStep` fija `spacing={2.5}`; los steps no vuelven a declararlo.
- **Color pickers**: siempre en **fila con wrap** (`ColorPickerField` × primary/secondary/accent),
  idéntico en Visual y en Theme.
- **Navegación**: reemplazar `MobileStepper` (dots + Skip/Back/Next) por una barra inferior fija con
  progreso textual ("Paso 1 de 2") y botones `Atrás` / `Siguiente` (`contained`). Sin "Skip": al
  quedar sólo 2 steps de campos de alta señal, saltar deja de tener sentido.

### 4.6 Tokens y estilo — qué usar exactamente

| Necesidad | Fuente única |
| --- | --- |
| Radio-pill / multi-pill | `MuiToggleButton`/`MuiToggleButtonGroup` del tema (ya `.Mui-selected` → `primary.main`) |
| Alturas / paddings de input | `INPUT_HEIGHT`, `INPUT_TEXTFIELD_SX`, `INPUT_CONTAINER_SX` (`inputStyles.ts`) |
| Radios | `RADIUS_INPUT` (6), `RADIUS_CARD` (8), `RADIUS_DIALOG` (10) (`constants.ts`) |
| Labels de campo | `LabelProperty` (12.5px / 600) |
| Colores/estado | `theme.palette` (`primary`, `text.secondary`, `divider`, `action.hover`) |
| Tipografía | variantes del tema (`h6`, `body2`, `caption`) — **no** `fontSize` inline |

Regla de lint conceptual: en `Wizard/**` no debe aparecer ningún hex literal ni `fontSize` inline;
todo pasa por tema/constantes.

### 4.7 Qué decide el LLM (campos retirados de la UI)

Se retiran de la interfaz los inputs de **baja señal** — aquellos donde el usuario del wizard
tenderá a "marcar todo" o que el modelo puede inferir mejor desde la estrategia:

| Campo del brief | Antes (UI) | Ahora |
| --- | --- | --- |
| `layout_strategy.sections` | Step Layout (multi-pill) | **Sin UI.** El modelo elige las secciones desde `purpose` + `vertical` + `moods`. |
| `image_queries.subjects` | Step Imagery (multi-pill) | **Sin UI.** El modelo deriva los sujetos desde el propósito y la escena opcional. |
| `image_queries.specificScene` | TextField dentro de Imagery | **Se conserva** como único campo de imagen: un input opcional de una línea ("¿alguna escena concreta?"). |

**Compatibilidad de contrato:**
- `DraftBrief` (cliente) **mantiene** `layout_strategy` e `image_queries.subjects`; sólo dejan de
  tener UI y quedan en `[]`. El tipo no cambia.
- Cambio **in-repo** (este repositorio) — `compileBriefClient.toWireBrief()`
  (`packages/email-builder-standalone/src/App/AIGeneration/Wizard/compileBriefClient.ts`) hoy
  **fuerza** `sections: ['hero', 'cta']` cuando el usuario no elige nada. Debe pasar a enviar `[]`
  (o omitir el campo). Sin esto, aunque quitemos la UI el cliente seguiría inyectando secciones.
  `subjects` ya se envía tal cual (vacío incluido).
- Cambios **en el backend** — [`workers/`](../workers/) (antes repo separado `workers`)
  (`apps/email-builder-api`), en **rama aparte** (ver 6.1). Dos ficheros:
  1. `src/wizard/brief-schema.ts`: hacer **opcionales** los campos que el modelo ahora decide:
     `layout_strategy.sections` (`.default([])`), `tone_strategy.moods` (`.default([])`),
     `tone_strategy.vertical` (`.optional()`), `visual_strategy.palette` (`.optional()`),
     `visual_strategy.photoStyle` (`.optional()`). `image_queries.subjects` ya admitía vacío.
  2. `src/wizard/compile-brief.ts` — `buildScaffold` emite instrucciones "elige tú…" cuando el
     campo falta: `[TONE]`, `[COLORS]` (deriva de los brand colours), `[LAYOUT]` y `[IMAGERY]`;
     `inferDensity(0) ⇒ 'standard'`; `hints.palette` cae a `''`; `deterministicQueries` tolera
     `vertical` ausente. Nunca imprime `undefined`.
- Efecto neto en cliente: `Step04Imagery` y `Step05Layout` desaparecen; `buildStepSequence` deja de
  incluir sus índices. La rama `photoStyle==='none'` deja de saltar un step (ya no existe); a lo
  sumo oculta el campo "escena concreta" dentro de Estilo.

---

## 5. Especificación de componentes (contratos)

```
Wizard/
  controls/
    WizardStep.tsx          # scaffold: title + hint + children (spacing fijo)
    PillSelect.tsx          # single-select radio-pill (segmented|wrap)
    PillMultiSelect.tsx     # multi-select pill/badge
    WizardNav.tsx           # barra inferior: progreso ("Paso 1 de 2") + Atrás/Siguiente
  WizardEntry.tsx           # radio-pill de target + prompt libre + "guíame"  (fusiona Entry+Target)
  WizardFlow.tsx            # antes AIVisualWizard: orquesta steps con WizardStep+WizardNav
  steps/*                   # sólo declaran preguntas con los controls/*
  (ChipQuestion.tsx, EntryPicker.tsx, GenerationTargetPicker.tsx,
   steps/Step04Imagery.tsx, steps/Step05Layout.tsx → eliminados)
```

`WizardEntry` sustituye a `EntryPicker` + `GenerationTargetPicker` y absorbe el prompt directo, de
modo que `AIGenerationDialog` deja de manejar el estado `entryMode: 'picker'|'direct'|'wizard'` y el
`WizardHeader`/Switch. El estado se reduce a: `target` + `mode ('quick'|'guided')`.

---

## 6. Plan de migración por fases

Cada fase compila y es verificable de forma aislada (`npm run check` + `npm run build`).

1. **F1 · Primitivos.** Crear `controls/WizardStep`, `PillSelect`, `PillMultiSelect`, `WizardNav`.
   Sin cablearlos aún. Tests unitarios de selección single/multi.
2. **F2 · Migrar steps.** Reescribir `Step01..03`, `StepThemeColors`, `StepThemeTypography` para usar
   `WizardStep` + los pills. `DraftBrief`/`patch` intactos. Eliminar `ChipQuestion`.
3. **F3 · Reagrupar y recortar.** Fusionar preguntas en **2 steps** (Sobre + Estilo) para Template /
   2 (Component/Theme) en `buildStepSequence` + `WizardFlow`. **Eliminar `Step04Imagery` y
   `Step05Layout`**; mover "escena concreta" (opcional) al step Estilo. Sustituir `MobileStepper` por
   `WizardNav`.
4. **F4 · Backend (rama aparte).** En `workers/apps/email-builder-api`:
   relajar `brief-schema.ts` (`sections` admite vacío) y ajustar `compile-brief.ts` (`[LAYOUT]`
   "elige la estructura" + density default). Ver 6.1.
5. **F5 · Entrada unificada.** Crear `WizardEntry`, eliminar `EntryPicker`,
   `GenerationTargetPicker`, `WizardHeader`/Switch y simplificar el estado de `AIGenerationDialog`.
6. **F6 · Limpieza.** Barrido de `sx` de estilo residuales; verificación de tokens; i18n (retirar
   claves de `subject`/`section` sin uso; el resto sólo se reubica).

### 6.1 Estrategia de ramas (dos repos)

Son **dos repositorios git independientes**; los cambios de backend **no** se mezclan con los del
frontend:

| Repo | Ubicación | Alcance | Rama |
| --- | --- | --- | --- |
| Frontend (este) | `web-maildrill-astro` | Wizard UX, primitivos, `toWireBrief` enviando `[]` | rama de trabajo del editor (p.ej. `work/email-builder-isolated` según `docs/AGENTS.md`) |
| Backend | `workers/` | `brief-schema.ts` + `compile-brief.ts` | **rama aparte dedicada**, p.ej. `feat/wizard-llm-decides-structure` |

Orden de despliegue recomendado para no romper en producción:
1. **Backend primero**: la rama del backend debe permitir `sections` vacío **antes** de que el
   cliente empiece a enviar `[]` (si no, `visual-brief/compile` respondería 400 por schema).
2. Frontend después: una vez el backend acepta vacío, se libera el cambio de `toWireBrief` + la UI.

Compatibilidad: mientras el backend siga exigiendo `min(1)`, el cliente puede seguir enviando el
default actual; el cambio de `toWireBrief` se activa sólo cuando el backend ya está desplegado.

---

## 7. Criterios de aceptación

- [ ] Todo single-select del wizard usa **radio-pill** del inspector; todo multi-select usa
      **pill/badge toggle**. No queda ningún `MUI Chip` como control de selección.
- [ ] No existe `Wizard/ChipQuestion.tsx`, `EntryPicker.tsx`, `GenerationTargetPicker.tsx`,
      `steps/Step04Imagery.tsx` ni `steps/Step05Layout.tsx`.
- [ ] Todos los steps renderizan a través de `WizardStep`: mismo título (h6), mismo hint (caption),
      mismo `spacing`. Inspección visual: los steps son intercambiables en ritmo vertical.
- [ ] El usuario llega al primer control accionable en **≤1 pantalla de entrada** (antes: 2).
- [ ] Template guiado tiene **2 steps** (Component 2, Theme 2). **No existe step de Estructura/Layout
      ni de Subjects**; el usuario nunca decide secciones.
- [ ] Con `sections`/`subjects` vacíos, el prompt compilado instruye al modelo a elegir la
      estructura (verificable en el `prompt` que muestra `SummaryStep`).
- [ ] `grep` en `Wizard/**` no encuentra hex literales ni `fontSize:` inline; radios vía
      `RADIUS_*`, alturas vía `INPUT_HEIGHT`.
- [ ] `npm run check` = 0 errores nuevos y `npm run build` verde (compila el editor vendored).
- [ ] Sin cambios en el contrato de `DraftBrief` ni en las llamadas de red del summary/theme.

---

## 8. Riesgos y mitigación

| Riesgo | Mitigación |
| --- | --- |
| Sets largos (purpose 8, vertical 11) se ven apretados como pills | `PillSelect layout='wrap'`; validar en el ancho del diálogo `sm` (≈600px) |
| Perder el "prompt directo" al fusionar la entrada | `WizardEntry` mantiene el textarea + `Generar` como acción de primer nivel (no un modo escondido) |
| Multi-select con `ToggleButton` standalone pierde estilos de grupo | Verificar `.Mui-selected` del tema aplica igual fuera de `ToggleButtonGroup`; si no, envolver en grupo `!exclusive` |
| Regresiones i18n | Reusar claves `aiWizard` existentes; sólo mover, no renombrar |
| Es código vendored | Cambios contenidos en `AIGeneration/**`; no tocar otros paquetes; gate = `build` |
```