/**
 * Galería de temas predefinidos (Fase 9.5, reemplazo del importador de design
 * systems — mejor ROI: el usuario cambia el estilo en un clic sin aprender
 * tokens, y reusa toda la maquinaria del theme system, docs/11).
 *
 * Datos puros (P1/P7): cada preset remapea los tokens **semánticos** que ya
 * usan los componentes (`colors.surface/text/border/primary/muted`), así aplica
 * out-of-the-box. Los pares claro/oscuro (`colorScheme`) activan además el
 * `prefers-color-scheme` automático del export (9.4).
 *
 * Invariante (verificado por test): en cada preset el par texto/superficie
 * cumple contraste WCAG AA — ningún preset es ilegible.
 */

export interface ThemePreset {
  id: string;
  /** Nombre visible y nombre del `Theme` creado (dato de sitio, no clave i18n). */
  name: string;
  colorScheme?: "light" | "dark";
  /** Remapeos de tokens semánticos (ruta → valor concreto). */
  tokens: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "light",
    name: "Claro",
    colorScheme: "light",
    tokens: {
      "colors.surface.default": "#ffffff",
      "colors.surface.alt": "#f3f4f6",
      "colors.text": "#1a1a1a",
      "colors.border": "#e2e8f0",
      "colors.primary.default": "#2563eb",
      "colors.primary.on": "#ffffff",
      "colors.muted": "#6b7280",
    },
  },
  {
    id: "dark",
    name: "Oscuro",
    colorScheme: "dark",
    tokens: {
      "colors.surface.default": "#0b1021",
      "colors.surface.alt": "#161d33",
      "colors.text": "#e5e7eb",
      "colors.border": "#1f2937",
      "colors.primary.default": "#60a5fa",
      "colors.primary.on": "#0b1021",
      "colors.muted": "#9ca3af",
    },
  },
  {
    id: "sepia",
    name: "Sepia",
    colorScheme: "light",
    tokens: {
      "colors.surface.default": "#f4ecd8",
      "colors.surface.alt": "#ece0c5",
      "colors.text": "#4b3621",
      "colors.border": "#ddcca7",
      "colors.primary.default": "#a1662f",
      "colors.primary.on": "#ffffff",
      "colors.muted": "#7c6a53",
    },
  },
  {
    id: "ocean",
    name: "Océano",
    colorScheme: "dark",
    tokens: {
      "colors.surface.default": "#0f2027",
      "colors.surface.alt": "#16303a",
      "colors.text": "#e0f7fa",
      "colors.border": "#204652",
      "colors.primary.default": "#22d3ee",
      "colors.primary.on": "#04252c",
      "colors.muted": "#7ba7b0",
    },
  },
  {
    id: "forest",
    name: "Bosque",
    colorScheme: "light",
    tokens: {
      "colors.surface.default": "#f1f8f2",
      "colors.surface.alt": "#e3f0e6",
      "colors.text": "#1b3a2b",
      "colors.border": "#cfe3d4",
      "colors.primary.default": "#2f855a",
      "colors.primary.on": "#ffffff",
      "colors.muted": "#5b7367",
    },
  },
  {
    id: "contrast",
    name: "Alto contraste",
    colorScheme: "dark",
    tokens: {
      "colors.surface.default": "#000000",
      "colors.surface.alt": "#141414",
      "colors.text": "#ffffff",
      "colors.border": "#ffffff",
      "colors.primary.default": "#ffff00",
      "colors.primary.on": "#000000",
      "colors.muted": "#d0d0d0",
    },
  },
];

/** Preset por id (o undefined). */
export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
