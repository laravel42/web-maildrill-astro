/**
 * Behavior Registry — punto único de extensión para el runtime JS opt-in del
 * output (docs/10 §3, P4/P9). El core (Inspector, export) consulta este mapa;
 * NUNCA hace `switch(behavior.type)`. Agregar un behavior = registrar su
 * `BehaviorDefinition`, sin tocar el core.
 *
 * En 8.1 no hay runtime: las definiciones solo aportan schema de opciones (para
 * el Inspector) y metadata (para el export de 8.2/8.3).
 */

import type { BuilderNode } from "../model/types";
import type { BehaviorCategory, BehaviorDefinition } from "./types";
import { carouselBehavior } from "./behaviors/carousel";
import { revealOnScrollBehavior } from "./behaviors/revealOnScroll";
import { themeToggleBehavior } from "./behaviors/themeToggle";
import { toggleBehavior } from "./behaviors/toggle";
import { accordionBehavior } from "./behaviors/accordion";
import { modalBehavior } from "./behaviors/modal";
import { tabsBehavior } from "./behaviors/tabs";
import { navbarBehavior } from "./behaviors/navbar";
import { formValidationBehavior } from "./behaviors/formValidation";
import { stickyBehavior } from "./behaviors/sticky";
import { countUpBehavior } from "./behaviors/countUp";
import { marqueeBehavior } from "./behaviors/marquee";
import { expandableBehavior } from "./behaviors/expandable";
import { parallaxBehavior } from "./behaviors/parallax";
import { scrollProgressBehavior } from "./behaviors/scrollProgress";
import { scrollSpyBehavior } from "./behaviors/scrollSpy";
import { lightboxBehavior } from "./behaviors/lightbox";

const DEFINITIONS: BehaviorDefinition[] = [
  carouselBehavior,
  revealOnScrollBehavior,
  themeToggleBehavior,
  toggleBehavior,
  accordionBehavior,
  modalBehavior,
  tabsBehavior,
  navbarBehavior,
  formValidationBehavior,
  stickyBehavior,
  countUpBehavior,
  marqueeBehavior,
  expandableBehavior,
  parallaxBehavior,
  scrollProgressBehavior,
  scrollSpyBehavior,
  lightboxBehavior,
];

export const behaviorRegistry: Record<string, BehaviorDefinition> = Object.fromEntries(
  DEFINITIONS.map((def) => [def.type, def]),
);

/** Definición por tipo (o undefined si no está registrado). */
export function getBehaviorDefinition(type: string): BehaviorDefinition | undefined {
  return behaviorRegistry[type];
}

/** Lista ordenada de definiciones (para el catálogo del Inspector). */
export function listBehaviorDefinitions(): BehaviorDefinition[] {
  return DEFINITIONS;
}

/** Behaviors que APLICAN a un nodo dado (según `appliesTo`). */
export function behaviorsForNode(node: BuilderNode): BehaviorDefinition[] {
  return DEFINITIONS.filter((def) => (def.appliesTo ? def.appliesTo(node) : true));
}

/** Orden canónico de categorías para agrupar el catálogo del Inspector (docs/46 §3 Fase 3). */
export const BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  "content",
  "motion",
  "navigation",
  "structure",
  "interactive",
  "appearance",
];

/**
 * Behaviors aplicables a un nodo (`behaviorsForNode`), agrupados por
 * `category` en el orden canónico (`BEHAVIOR_CATEGORIES`); dentro de cada
 * grupo, orden de registro. Omite categorías vacías. La usa
 * `BehaviorsSection` (docs/46 §3 Fase 3, H3) para reemplazar el grid plano
 * de hasta 17 cards por un acordeón por categoría — mismo patrón que
 * `listDefinitionsByCategory` del `componentRegistry`.
 */
export function behaviorsForNodeByCategory(
  node: BuilderNode,
): { category: BehaviorCategory; definitions: BehaviorDefinition[] }[] {
  const applicable = behaviorsForNode(node);
  return BEHAVIOR_CATEGORIES.map((category) => ({
    category,
    definitions: applicable.filter((def) => def.category === category),
  })).filter((group) => group.definitions.length > 0);
}

/**
 * ¿El nodo tiene al menos un behavior ESPECÍFICO posible (con `appliesTo`
 * propio, ej. `accordion`/`carousel`/`form-validation`/`modal`/`navbar`/
 * `tabs`)? Excluye a propósito los behaviors "universales" (`toggle`,
 * `theme-toggle`, `reveal-on-scroll`) que no declaran `appliesTo` — aplican a
 * CUALQUIER nodo por diseño (son efectos genéricos de animación, no algo
 * configurable propio de ese tipo de componente). Sin este filtro,
 * `behaviorsForNode(node).length > 0` es SIEMPRE `true` para todo nodo del
 * registry, lo cual vacía de sentido cualquier UI que use "hay behaviors
 * posibles" como señal de "este nodo tiene algo interactivo/configurable
 * específico" (docs/39 §2.3 — tab "Interactividad" del Inspector). El
 * registry sigue exponiendo esos 3 behaviors para cualquier nodo vía
 * `behaviorsForNode`/`BehaviorsSection` — este helper es solo un criterio de
 * UI, no cambia qué behaviors se pueden adjuntar.
 */
export function hasNodeSpecificBehaviors(node: BuilderNode): boolean {
  return DEFINITIONS.some((def) => def.appliesTo !== undefined && def.appliesTo(node));
}

/**
 * ¿Algún behavior ACTIVO en el nodo declara `runtime.clipsContentWhenActive`?
 * (docs/10 §5, feedback de usuario sobre el carousel vertical). Puro: solo
 * lee `node.behaviors` contra el registry, sin acoplar el core a "carousel"
 * (P4) — lo consume `NodeRenderer` para calcular `RenderContext.suppressClip`
 * únicamente en modo Edit (nunca en Preview/export, ver el flag en
 * `registry/types.ts`).
 */
export function nodeClipsContentWhenActive(node: BuilderNode): boolean {
  return (node.behaviors ?? []).some(
    (instance) => getBehaviorDefinition(instance.type)?.runtime.clipsContentWhenActive === true,
  );
}

/**
 * CSS de chrome de los behaviors REALMENTE usados en un conjunto de nodos
 * (docs/10 §5, §8.3-8.4): concatena `BehaviorRuntimeSpec.css` de cada
 * definición cuyo `type` aparece en algún nodo, en orden estable de
 * `listBehaviorDefinitions()`. "" si ninguno declara `css` (incluye el caso
 * sin behaviors). Compartido por el export (`export/site.ts`, contra
 * `BuilderPage[]`) y el editor en vivo (`app/layout/BehaviorsStyle.tsx`,
 * contra el documento activo del store) — misma lógica, distinta fuente.
 */
export function usedBehaviorsCssForNodes(nodes: Iterable<BuilderNode>): string {
  const usedTypes = new Set<string>();
  for (const node of nodes) {
    for (const behavior of node.behaviors ?? []) usedTypes.add(behavior.type);
  }
  return DEFINITIONS.filter((def) => usedTypes.has(def.type) && def.runtime.css)
    .map((def) => def.runtime.css)
    .join("\n\n");
}
