/**
 * Reglas de colocación de nodos (docs/23 §4) — dirigidas por el registry (P4),
 * puras y testeables sin DOM ni React (P7).
 *
 * Responden: ¿puede un nodo de tipo `childType` ser HIJO DIRECTO de un nodo de
 * tipo `parentType`? Combina tres reglas del modelo composite-slots:
 *
 *  1. El padre debe aceptar hijos (`acceptsChildren`).
 *  2. Un NODO DE SLOT (`isSlot`) solo va dentro de SU composite declarado
 *     (`child.isSlot === parentType`).
 *  3. Un COMPOSITE (`slots`) solo acepta como hijos directos su `itemType`
 *     (las slots); nada de componentes genéricos sueltos sobre el composite —
 *     el contenido se suelta DENTRO de la slot (que es un container normal).
 *
 * La capa DnD (`canDrop`) y el store consumen esto; el árbol (`tree.ts`) sigue
 * siendo agnóstico del registry (su comentario de cabecera).
 */

import { getDefinition } from "./componentRegistry";
import type { ComponentDefinition } from "./types";

/**
 * Versión pura con las definiciones ya resueltas (inyección de dependencias):
 * testeable con definiciones fabricadas a mano, sin depender del registry
 * global. `undefined` = tipo no registrado → no se puede colocar.
 */
export function canPlaceChildDef(
  parent: ComponentDefinition | undefined,
  child: ComponentDefinition | undefined,
): boolean {
  if (!parent || !child) return false;
  if (!parent.acceptsChildren) return false;

  // (2) El hijo es un nodo de slot: solo dentro de SU composite.
  if (child.isSlot !== undefined) {
    return child.isSlot === parent.type;
  }

  // (3) El padre es un composite: solo acepta sus slots como hijos directos.
  //     Un no-slot (caímos aquí porque el hijo no es slot) no va directo.
  if (parent.slots !== undefined) {
    return false;
  }

  // (1) Caso normal: cualquier container acepta cualquier no-slot.
  return true;
}

/** Resuelve los tipos contra el registry global y delega en `canPlaceChildDef`. */
export function canPlaceChild(parentType: string, childType: string): boolean {
  return canPlaceChildDef(getDefinition(parentType), getDefinition(childType));
}
