/**
 * Action Registry — punto único de extensión para las acciones de click del
 * output (docs/20 §3, docs/44 §2, P4/P9). El core (Inspector, export,
 * `NodeRenderer`) consulta este mapa; NUNCA hace `switch(action.type)`.
 * Agregar una acción = registrar su `ActionDefinition`, sin tocar el core.
 * Mismo espíritu que `behaviorRegistry.ts`.
 */

import type { BuilderDocument, BuilderNode, NodeAction } from "../model/types";
import type { ActionDefinition } from "./types";
import { openModalAction } from "./actions/openModal";
import { closeModalAction } from "./actions/closeModal";
import { dismissAction } from "./actions/dismiss";
import { scrollToAction } from "./actions/scrollTo";
import { openUrlAction } from "./actions/openUrl";
import { submitFormAction } from "./actions/submitForm";
import { resetFormAction } from "./actions/resetForm";

const DEFINITIONS: ActionDefinition[] = [
  openModalAction,
  closeModalAction,
  dismissAction,
  scrollToAction,
  openUrlAction,
  submitFormAction,
  resetFormAction,
];

export const actionRegistry: Record<string, ActionDefinition> = Object.fromEntries(
  DEFINITIONS.map((def) => [def.type, def]),
);

/** Definición por tipo (o undefined si no está registrada). */
export function getActionDefinition(type: string): ActionDefinition | undefined {
  return actionRegistry[type];
}

/** Lista ordenada de definiciones (para el catálogo del Inspector). */
export function listActionDefinitions(): ActionDefinition[] {
  return DEFINITIONS;
}

/** Acciones que APLICAN a un nodo dado (según `appliesTo`). */
export function actionsForNode(node: BuilderNode, doc: BuilderDocument): ActionDefinition[] {
  return DEFINITIONS.filter((def) => (def.appliesTo ? def.appliesTo(node, doc) : true));
}

/**
 * Atributos `data-pb-*` de TODAS las acciones de un nodo (docs/44 §8.1 D1),
 * fusionados en un solo objeto. Hoy `node.onClick` es una sola acción, así que
 * el resultado es idéntico al de leerla directamente — pero el consumidor
 * (`exportToHtml.ts`, `NodeRenderer.tsx`) ya no necesita cambiar el día que
 * pase a soportar varias. Acciones sin definición registrada se ignoran
 * (no rompen el export; el Inspector no debería permitir guardarlas).
 */
export function actionDataAttributes(actions: readonly NodeAction[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const action of actions) {
    const def = getActionDefinition(action.type);
    if (!def) continue;
    Object.assign(attrs, def.dataAttributes(action));
  }
  return attrs;
}
