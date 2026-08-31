import type { BuilderDocument } from "../../../model/types";
import { chromeNodes } from "./chrome";
import { heroNodes } from "./hero";
import { contentNodes } from "./content";

export function createExampleDocument(): BuilderDocument {
  // Todos los estilos usan exclusivamente tokens de BASE_TOKENS (colors.primary.*,
  // colors.surface.*, colors.text, colors.muted, spacing.*, radii.*, typography.*,
  // sizes.container). Así el template funciona con cualquier tema de la galería
  // sin necesitar tokens custom extra: cambiar el tema propaga a todos los nodos.
  return {
    rootId: "root",
    meta: { version: 1 },
    nodes: { ...chromeNodes(), ...heroNodes(), ...contentNodes() },
  };
}
