/**
 * Temas de plantilla como presets reutilizables de la galería general
 * (docs/11 §9.5, docs/48 §3 — "no perder el trabajo de cada tema, permitir
 * combinarlo con cualquier página").
 *
 * Cada plantilla de sector (docs/48 §2) ya declara su propio `LayoutTheme`
 * (color + tipografía) en `layoutRegistry.ts`, pero hasta ahora solo se podía
 * obtener aplicando la plantilla COMPLETA (contenido + tema) vía
 * `applyPageLayout`. Este módulo deriva un preset de la galería general
 * (`ThemesEditor.tsx`, `THEME_PRESETS` de `model/themePresets.ts`) por cada
 * `LayoutTheme` ya declarado — **sin duplicar los datos de color/tipografía**:
 * se leen directamente de `layoutRegistry`, así que un ajuste al tema de una
 * plantilla se refleja aquí sin tocar dos sitios.
 *
 * Dirección de dependencia (P4 — el core no conoce sectores): este módulo
 * vive en `registry/` (no en `model/`) porque lee de `layoutRegistry.ts`.
 * `model/themePresets.ts` sigue sin depender de `registry/` — es
 * `ThemesEditor.tsx` (chrome del editor) quien importa AMBAS listas y las
 * muestra juntas, igual que ya hace con imports de `registry/` en otros
 * paneles (Inspector, TemplatesPanel).
 */

import { layoutRegistry, layoutThemeId, type LayoutTheme } from "./layoutRegistry";
import type { TokenFontFamily } from "../model/types";

/**
 * Preset de galería derivado de una plantilla. Superconjunto de `ThemePreset`
 * (`model/themePresets.ts`): además del color, trae las `fontFamilies` que la
 * plantilla necesita registradas como tokens del sitio (docs/48 §3.2) — sin
 * esto, aplicar el tema suelto pintaría el color correcto pero la tipografía
 * caería al fallback de sistema (Playfair Display, Oswald, etc. no se
 * cargarían).
 */
export interface LayoutThemePreset {
  id: string;
  name: string;
  colorScheme?: "light" | "dark";
  tokens: Record<string, string>;
  fontFamilies?: Record<string, TokenFontFamily>;
  /** Id determinista del `Theme` que resultaría de aplicar este preset (igual que `layoutThemeId`). */
  themeId: string;
  /** Slug/id de la plantilla de origen — para el indicador "de qué plantilla viene" en la UI. */
  sourceLayoutId: string;
}

function computeLayoutThemePresets(): LayoutThemePreset[] {
  return Object.values(layoutRegistry)
    .filter((def): def is typeof def & { theme: LayoutTheme } => def.theme !== undefined)
    .map((def) => {
      const theme = def.theme;
      const preset: LayoutThemePreset = {
        id: `layout-${theme.slug}`,
        name: theme.name,
        tokens: { ...theme.tokens },
        themeId: layoutThemeId(theme),
        sourceLayoutId: def.id,
      };
      if (theme.colorScheme) preset.colorScheme = theme.colorScheme;
      if (theme.fontFamilies) preset.fontFamilies = theme.fontFamilies;
      return preset;
    });
}

let cache: LayoutThemePreset[] | null = null;

/**
 * Los 16 (y contando) temas de plantilla, listos para aplicarse sueltos desde
 * la galería general. Se derivan iterando `layoutRegistry` — ninguna
 * plantilla de PÁGINA se importa de forma estática para esto (docs/48 §4):
 * `theme` vive en la metadata EAGER de cada `LayoutDefinition`, no dentro del
 * módulo perezoso, así que recorrer el registry no arrastra ningún fragmento
 * de página al bundle.
 *
 * **Perezoso y memoizado, nunca calculado en tiempo de módulo.**
 * `layoutRegistry.ts` termina de poblar su `Record` al final de su propio
 * cuerpo (`Object.fromEntries(DEFINITIONS...)`); calcular esto como `const`
 * de nivel de módulo aquí crea un ciclo de evaluación real cuando algo (p.
 * ej. `TemplatesPanel.tsx`) importa tanto `layoutRegistry` como,
 * indirectamente vía `documentStore` → `slices/themes.ts`, este módulo: si
 * el ciclo A→B→A hace que este archivo se evalúe ANTES de que
 * `layoutRegistry.ts` termine su propio cuerpo, `layoutRegistry` llega aquí
 * como `undefined` (bug real, encontrado corriendo `TemplatesPanel.test.tsx`
 * tras agregar `applyLayoutThemePreset` a la slice de temas). Calcularlo bajo
 * demanda rompe la dependencia de ORDEN de evaluación: para cuando algo
 * LLAMA a esta función (nunca durante el import de ningún módulo), todos ya
 * terminaron de evaluarse.
 */
export function getLayoutThemePresets(): LayoutThemePreset[] {
  if (cache === null) cache = computeLayoutThemePresets();
  return cache;
}

/** Preset de plantilla por id (o undefined). */
export function getLayoutThemePreset(id: string): LayoutThemePreset | undefined {
  return getLayoutThemePresets().find((p) => p.id === id);
}
