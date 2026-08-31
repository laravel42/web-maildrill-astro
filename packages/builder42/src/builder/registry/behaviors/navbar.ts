/**
 * Navbar — behavior del componente `navbar` (Bloque D, docs/16 §12.4 #20).
 * Runtime vanilla propio (sin dependencia npm): menú hamburguesa móvil con
 * toggle animado y `aria-expanded`. El componente `navbar` lo trae de fábrica.
 *
 * Degradación sin JS (P8/P9): sin este runtime la barra muestra todos los
 * enlaces (sin hamburger) — accesible. El JS añade el patrón móvil colapsable.
 */

import type { BehaviorDefinition } from "../types";

export const navbarBehavior: BehaviorDefinition = {
  type: "navbar",
  label: "Barra de navegación (hamburguesa móvil)",
  category: "structure",
  appliesTo: (node) => node.type === "navbar",
  defaultOptions: { duration: 240 },
  optionsSchema: {
    fields: [{ key: "duration", label: "Duración (ms)", control: "number", group: "Navbar", placeholder: "240" }],
  },
  runtime: {
    moduleId: "navbar",
    enhance: "enhanceNavbar",
    // CSS presentacional migrado a `ComponentDefinition.css` (T10, AGENTS.md,
    // `registry/components/Navbar.tsx`): ya no depende de que este behavior
    // esté adjunto — sin él, la barra sigue mostrando todos los enlaces (sin
    // hamburguesa, degradación accesible).
    loadPreview: async () => (await import("../../../runtime/behaviors/navbar")).enhanceNavbar,
  },
};
