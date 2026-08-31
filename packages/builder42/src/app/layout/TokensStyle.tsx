/**
 * TokensStyle — inyecta los design tokens del sitio como CSS custom properties,
 * en vivo (docs/08 §3-4). Así el canvas y el preview resuelven las referencias
 * `var(--…)` con el MISMO CSS que produce el export (P3): editar un token o el
 * tema activo propaga al instante.
 *
 * **Aislamiento del chrome (docs/11 §6):** a diferencia del export —donde
 * `:root` ES la página—, en el editor la página convive con el chrome. Por eso
 * aquí los tokens y el tema se scopean al **frame del canvas**
 * (`.pbx-canvas__frame`), NO a `:root`: el tema (incluido `color-scheme`) afecta
 * SOLO a lo que se está construyendo, nunca al chrome del editor. El tema activo
 * se selecciona con `data-theme` en el frame (Canvas.tsx) → los bloques
 * `.pbx-canvas__frame[data-theme="…"]` ganan. Se omite el `@media
 * prefers-color-scheme` (el preview lo maneja `activeThemeId`, no el SO).
 *
 * Es chrome del editor (no toca el documento, P1/P8): solo refleja
 * `site.meta.tokens`/`site.meta.themes`.
 *
 * **Webfonts (docs/48 §3.3):** además de las custom properties, monta los
 * `<link>` de Google Fonts de las familias que el documento activo referencia
 * (`useWebFontLinks`). Los tokens solo declaran el *stack*; sin el `<link>` el
 * navegador cae al fallback de sistema y el canvas deja de coincidir con el
 * sitio exportado, que sí carga la fuente (`export/usage.ts` → `fontLinks`).
 */

import { useMemo } from "react";
import { useDocumentStore } from "@/builder/store/documentStore";
import { tokensToCss } from "@/builder/model/tokens";
import { themesToCss } from "@/builder/model/theme";
import { usedFontFamilyKeysInDocument } from "@/builder/export/usage";
import { useWebFontLinks } from "@/hooks/useWebFontLinks";

/** Raíz de theming en el editor: el frame del canvas, no `:root` (aislamiento). */
const FRAME_SELECTOR = ".pbx-canvas__frame";

export function TokensStyle() {
  const tokens = useDocumentStore((s) => s.site.meta.tokens);
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const defaultThemeId = useDocumentStore((s) => s.site.meta.defaultThemeId);
  const breakpoints = useDocumentStore((s) => s.site.meta.breakpoints);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const doc = useDocumentStore((s) => s.document);

  // Webfonts del documento activo (docs/48 §3.3): mismo criterio que el export
  // (`export/usage.ts` → `usedFontFamilyKeys` + `fontLinks`) — solo las familias
  // REFERENCIADAS por algún nodo, no todas las declaradas. Sin esto el canvas
  // pinta con el fallback de sistema mientras el sitio exportado usa la fuente
  // real, y el WYSIWYG deja de serlo.
  const usedFamilies = useMemo(() => {
    const families = tokens?.typography?.families;
    if (!families) return [];
    const used = usedFontFamilyKeysInDocument(doc);
    return [...used].map((key) => families[key]).filter((f) => f !== undefined);
  }, [tokens, doc]);
  useWebFontLinks(usedFamilies);

  const css = useMemo(() => {
    const parts = [
      // `activeBreakpoint` (docs/49, bug real): el frame del canvas es un
      // <div> de ancho fijo dentro de la ventana real del editor, NO un
      // viewport propio — un `@media` no se activaría según el breakpoint
      // LÓGICO seleccionado, sino según el ancho real de esa ventana. Se
      // resuelve el valor efectivo en JS en vez de emitir `@media` (igual
      // criterio que `resolveStyle` para el estilo de nodo).
      tokensToCss(tokens, FRAME_SELECTOR, breakpoints, activeBreakpoint),
      themesToCss(tokens, themes, defaultThemeId, {
        rootSelector: FRAME_SELECTOR,
        includePrefersColorScheme: false,
      }),
    ];
    return parts.filter(Boolean).join("\n\n");
  }, [tokens, themes, defaultThemeId, breakpoints, activeBreakpoint]);
  if (!css) return null;
  return <style data-pb-tokens>{css}</style>;
}
