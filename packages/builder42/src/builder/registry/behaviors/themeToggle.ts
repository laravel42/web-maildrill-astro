/**
 * Theme toggle — behavior opt-in de claro/oscuro (docs/10, docs/11 §4/§9.4).
 * Convierte el nodo (p. ej. un botón) en un interruptor que alterna el
 * `data-theme` del documento entre dos temas y lo recuerda en `localStorage`.
 *
 * Cero-JS por defecto (P8/P9): sin este behavior el sitio ya respeta
 * `prefers-color-scheme` por CSS (themes.css, 9.4). El toggle solo AÑADE control
 * manual. Aplica a cualquier tipo de nodo (sin `appliesTo`, como reveal-on-scroll).
 *
 * Los ids `light`/`dark` son valores de `data-theme` (ids de tema del sitio).
 * El Inspector los expone con el control `theme-select`, un desplegable con los
 * temas realmente definidos en `site.meta.themes` (el usuario elige, no teclea);
 * si el sitio aún no tiene temas, el control ofrece un acceso directo a la
 * sección de Temas para crearlos primero (ver `BehaviorsSection.tsx`).
 */

import type { BehaviorDefinition } from "../types";

export const themeToggleBehavior: BehaviorDefinition = {
  type: "theme-toggle",
  label: "Interruptor de tema (claro/oscuro)",
  category: "appearance",
  // Sin `appliesTo`: aplica a todos los tipos de nodo.
  defaultOptions: { light: "", dark: "", storageKey: "pb-theme" },
  optionsSchema: {
    fields: [
      { key: "light", label: "Id del tema claro", control: "theme-select", group: "Tema" },
      { key: "dark", label: "Id del tema oscuro", control: "theme-select", group: "Tema" },
      {
        key: "storageKey",
        label: "Recordar preferencia (clave)",
        control: "text",
        group: "Tema",
        placeholder: "pb-theme",
        help: "behaviors.themeToggle.storageKeyHelp",
      },
    ],
  },
  runtime: {
    moduleId: "themeToggle",
    enhance: "enhanceThemeToggle",
    loadPreview: async () =>
      (await import("../../../runtime/behaviors/themeToggle")).enhanceThemeToggle,
  },
};
