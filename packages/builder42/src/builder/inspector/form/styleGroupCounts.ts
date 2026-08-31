import type { BuilderNode, StyleGroup, StyleState } from "@/builder/model/types";
import { styleFieldsForGroup } from "../styleFields";

/** Cuenta los campos que tienen un valor declarado en ALGUNA capa del nodo. */
export function countActiveFields(node: BuilderNode, group: StyleGroup): number {
  const fields = styleFieldsForGroup(group);
  let count = 0;
  for (const f of fields) {
    const inBase = (node.style.base as Record<string, Record<string, unknown>>)[group]?.[f.key];
    const inAny =
      inBase !== undefined ||
      Object.values(node.style.overrides ?? {}).some(
        (layer) => (layer as Record<string, Record<string, unknown>>)[group]?.[f.key] !== undefined,
      );
    if (inAny) count++;
  }
  return count;
}

/** Cuenta los campos con valor declarado en `node.style.states[state]` (T9). */
export function countActiveStateFields(node: BuilderNode, state: StyleState, group: StyleGroup): number {
  const fields = styleFieldsForGroup(group);
  const layer = node.style.states?.[state] as Record<string, Record<string, unknown>> | undefined;
  if (!layer) return 0;
  let count = 0;
  for (const f of fields) {
    if (layer[group]?.[f.key] !== undefined) count++;
  }
  return count;
}
