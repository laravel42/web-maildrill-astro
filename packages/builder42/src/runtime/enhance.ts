/**
 * Loader del runtime del OUTPUT (docs/10 §4, §11). Se bundlea aparte
 * (`assets/js/enhance.js`) y es el ÚNICO script que el `<head>` inyecta
 * (`<script type="module" src="…/enhance.js" defer>`, docs/10 §4 punto 3).
 *
 * Contrato de hidratación (docs/10 §4):
 * - El export marca los nodos con `data-pb-behavior="<type> [<type>…]"` (uno o
 *   varios tipos separados por espacio) + `data-pb-options='{ "<type>": {...} }'`
 *   (mapa `type → options`, JSON plano, sin handlers inline → CSP-friendly).
 * - Cada bundle de behavior (`assets/js/<moduleId>.js`, emitido SOLO si se usa)
 *   se auto-registra en `window.__pbBehaviors` al cargar, bajo la clave
 *   `BehaviorRuntimeSpec.enhance` (p. ej. "enhanceCarousel").
 * - Este loader escanea `[data-pb-behavior]`, resuelve el enhancer de CADA tipo
 *   por el nombre esperado (`enhance<Type PascalCase>` — mismo criterio que
 *   `registry/behaviors/*.ts`) y lo invoca con `(el, options)` sobre el mismo
 *   elemento (varios behaviors por nodo se hidratan todos).
 *
 * Regla dura (P8): este archivo tampoco importa nada de `src/builder/`. El
 * `type` → nombre de función se resuelve por convención de naming, NO
 * importando el `behaviorRegistry` del editor (ese vive en el core).
 */

type EnhanceFn = (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void;

declare global {
  interface Window {
    __pbBehaviors?: Record<string, EnhanceFn>;
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/**
 * Nombre de función esperado para un `type` de behavior (convención fija).
 * El `type` es kebab-case (`reveal-on-scroll`) y el enhancer registrado es
 * PascalCase (`enhanceRevealOnScroll`), así que hay que convertir CADA segmento
 * separado por `-`/`_`, no solo capitalizar la primera letra (bug real: un
 * `type` de una sola palabra como `carousel` funcionaba, pero `reveal-on-scroll`
 * y `theme-toggle` nunca resolvían su enhancer en el export → el behavior no se
 * hidrataba, aunque en Preview sí porque usa `loadPreview` por import directo).
 */
export function enhanceFnName(type: string): string {
  const pascal = type
    .split(/[-_]+/)
    .filter((seg) => seg.length > 0)
    .map(capitalize)
    .join("");
  return `enhance${pascal}`;
}

function parseOptions(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Escanea el documento y delega al enhancer registrado de cada behavior. */
export function runEnhancements(root: ParentNode = document): void {
  const registry = window.__pbBehaviors ?? {};
  const nodes = root.querySelectorAll<HTMLElement>("[data-pb-behavior]");
  nodes.forEach((el) => {
    const raw = el.dataset.pbBehavior;
    if (!raw) return;
    // `data-pb-behavior` puede listar varios tipos separados por espacio;
    // `data-pb-options` es un mapa `type → options` (docs/10 §4). Cada behavior
    // del nodo se hidrata sobre el MISMO elemento con sus propias opciones.
    const types = raw.split(/\s+/).filter(Boolean);
    const optionsByType = parseOptions(el.dataset.pbOptions);
    types.forEach((type) => {
      const fn = registry[enhanceFnName(type)];
      if (!fn) return;
      const opts = optionsByType[type];
      fn(el, opts && typeof opts === "object" ? (opts as Record<string, unknown>) : {});
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => runEnhancements());
  } else {
    runEnhancements();
  }
}
