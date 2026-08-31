# chrome/ — módulos CSS del editor

Esta carpeta aloja los módulos CSS del chrome del editor, resultantes del
refactor del monolito `src/styles/chrome.css` (docs/28). Hay DOS barrels,
ambos consumidos como único punto de entrada visible:

- **`src/styles/chrome.css`** (standalone) — usado por `src/main.tsx`.
  Importa todos los módulos, incluido `chrome/standalone.css`.
- **`src/styles/chrome-embedded.css`** (embebido, docs/52 F6) — usado por la
  entrada de librería (`src/index.ts`, F7) cuando el editor se monta dentro
  de un host (Maildrill). Mismo orden y mismos módulos, EXCEPTO
  `chrome/standalone.css` — omitido a propósito (ver abajo).

## Convenciones

- **Namespace de clases:** solo `pbx-*` (chrome del editor). Cualquier
  referencia a clases `pb-*` debe justificarse en línea (criterio
  docs/22 §4).
- **CSS custom properties:** todas las variables `--pb-chrome-*` viven en
  `tokens.css` y se referencian desde los demás módulos. No redefinir
  tokens en un archivo distinto al de tokens.
- **Dark theme:** las reasignaciones de tokens bajo
  `:root[data-theme="dark"]` viven en `dark.css` (cargado al final del
  barrel para preservar la cascada). No reasignar colores por sección
  en los demás módulos.
- **Animaciones:** los `@keyframes` viven en `motion.css`. Los
  `animation:` que las consumen pueden vivir en cualquier módulo;
  mientras `motion.css` esté cargado, los nombres se resuelven.
- **Responsive narrow:** los overrides `@media (max-width: 1023px)`
  viven en `narrow.css` (cargado al final).
- **`standalone.css` (docs/52 F6, CSS embed-safe):** reglas que asumen que
  el editor es dueño de TODA la página (`html`/`body`/`#root`, `@font-face`
  de Geist, I3/I4 del plan) — solo seguras cuando el editor NO está
  embebido. Se importa ÚNICAMENTE desde el barrel standalone
  (`chrome.css`), nunca desde `chrome-embedded.css`. Cualquier regla nueva
  que dependa de ser dueño de la página completa va aquí, no en
  `reset.css` ni en ningún otro módulo compartido.
- **Scrollbars del chrome (`reset.css`):** el selector es por ATRIBUTO
  (`[class*="pbx-"]`), no por descendencia de `.pbx-app` — varios
  componentes del chrome se montan con `createPortal(..., document.body)`
  (`Toast`, `SimpleModal`, `FieldHelp`, `AiSectionGenerator`) y quedan como
  hermanos de `.pbx-app` en el árbol real, no como descendientes.

## Orden de carga (definido en el barrel)

```
tokens.css → reset.css → standalone.css (solo chrome.css) → motion.css →
shell.css → header.css → sidebar.css → inspector.css →
inspector-controls.css → inspector-sections.css → inspector-themes.css →
inspector-i18n.css → canvas.css → canvas-nodes.css → canvas-code-json.css →
dark.css → narrow.css
```

Cualquier módulo nuevo que se agregue al barrel standalone debe agregarse
también a `chrome-embedded.css`, en la misma posición relativa, salvo que
sea explícitamente standalone-only (como `standalone.css` mismo).

Cualquier cambio de orden debe justificarse con un diff antes/después
y verificación visual.
