/**
 * Helper de TEST (no productivo, docs/48 §5.3) para la guarda de cobertura
 * funcional del catálogo: entre el conjunto de plantillas dado, ¿aparece cada
 * componente/behavior/acción registrado al menos una vez? Y, por plantilla
 * individual, ¿se mantiene por debajo del techo de behaviors únicos (una
 * página real no es un escaparate de JS, docs/48 §5.3)?
 *
 * Amplía la guarda de cobertura de `docs/37` (que ya cubre las secciones) al
 * caso de un conjunto de PÁGINAS completas. No importa nada del bundle
 * productivo — solo archivos `*.test.ts`.
 */

import type { NodeFragment } from "../../model/tree";

function nodesOf(fragment: NodeFragment) {
  return Object.values(fragment.nodes);
}

/** Tipos de `componentRegistry` usados en el conjunto de fragmentos dado. */
export function usedComponentTypes(fragments: NodeFragment[]): Set<string> {
  const set = new Set<string>();
  for (const fragment of fragments) {
    for (const node of nodesOf(fragment)) set.add(node.type);
  }
  return set;
}

/** Tipos de `behaviorRegistry` usados en el conjunto de fragmentos dado. */
export function usedBehaviorTypes(fragments: NodeFragment[]): Set<string> {
  const set = new Set<string>();
  for (const fragment of fragments) {
    for (const node of nodesOf(fragment)) {
      for (const behavior of node.behaviors ?? []) set.add(behavior.type);
    }
  }
  return set;
}

/** Tipos de `actionRegistry` usados en el conjunto de fragmentos dado (`node.onClick`). */
export function usedActionTypes(fragments: NodeFragment[]): Set<string> {
  const set = new Set<string>();
  for (const fragment of fragments) {
    for (const node of nodesOf(fragment)) {
      if (node.onClick) set.add(node.onClick.type);
    }
  }
  return set;
}

export interface CatalogCoverageReport {
  missingComponentTypes: string[];
  missingBehaviorTypes: string[];
  missingActionTypes: string[];
}

/**
 * Reporte legible de qué tipos de cada registry NO aparecen en el conjunto de
 * fragmentos dado. Todas las listas vacías = cobertura completa.
 */
export function catalogCoverageReport(
  fragments: NodeFragment[],
  allComponentTypes: string[],
  allBehaviorTypes: string[],
  allActionTypes: string[],
): CatalogCoverageReport {
  const used = {
    components: usedComponentTypes(fragments),
    behaviors: usedBehaviorTypes(fragments),
    actions: usedActionTypes(fragments),
  };
  return {
    missingComponentTypes: allComponentTypes.filter((t) => !used.components.has(t)).sort(),
    missingBehaviorTypes: allBehaviorTypes.filter((t) => !used.behaviors.has(t)).sort(),
    missingActionTypes: allActionTypes.filter((t) => !used.actions.has(t)).sort(),
  };
}

/**
 * Behaviors únicos (tipos distintos, no instancias) que usa UNA plantilla.
 * docs/48 §5.3: ninguna plantilla individual debe exceder 3 — una página real
 * no es un escaparate de todo el catálogo de runtime JS.
 */
export function uniqueBehaviorCount(fragment: NodeFragment): number {
  return usedBehaviorTypes([fragment]).size;
}

/** Plantillas (por id) que exceden el techo de 3 behaviors únicos. */
export function templatesExceedingBehaviorBudget(
  fragmentsById: Record<string, NodeFragment>,
  budget = 3,
): { id: string; count: number; types: string[] }[] {
  const out: { id: string; count: number; types: string[] }[] = [];
  for (const [id, fragment] of Object.entries(fragmentsById)) {
    const types = [...usedBehaviorTypes([fragment])].sort();
    if (types.length > budget) out.push({ id, count: types.length, types });
  }
  return out;
}
