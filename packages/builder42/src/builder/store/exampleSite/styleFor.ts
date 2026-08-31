import type { BuilderNode } from "../../model/types";
import { getDefinition } from "../../registry/componentRegistry";

/**
 * `defaultStyle` de un tipo de componente registrado, para usar en el sitio
 * de ejemplo. Lee directo de `componentRegistry` (fuente única de verdad de
 * cada `ComponentDefinition`, PLAN §3, P4): si el `defaultStyle` de un
 * componente cambia, el ejemplo lo hereda gratis, igual que si el usuario lo
 * arrastrara desde el sidebar.
 *
 * Antes (Fase 1) esto importaba ~25 constantes `*_DEFAULT_STYLE` directo de
 * cada archivo de componente para evitar un ciclo real:
 * `componentRegistry.ts` → `Text.stub.tsx` → `useDocumentStore`
 * (`documentStore.ts`). El sitio de ejemplo se creaba en tiempo de módulo
 * (`const initialSite = createExampleSite()` en `documentStore.ts`), así que
 * si algún test importaba `Text.stub.tsx` primero, `componentRegistry.ts`
 * podía quedar a medio poblar cuando este archivo llamaba `getDefinition`.
 *
 * Fase 2 (docs/27 §5) rompe ese ciclo en la raíz: `documentStore.ts` ya NO
 * crea el sitio de ejemplo en tiempo de módulo — su estado inicial es un
 * sitio mínimo, y `createExampleSite()` solo se invoca desde el bootstrap
 * de `src/bootstrap.ts` (tras `main.tsx` haber importado todo, registro
 * incluido) o desde el cuerpo de un test. En ninguno de los dos casos puede
 * ejecutarse mientras `componentRegistry.ts` está a medio evaluar, así que
 * usar `getDefinition` aquí ya es seguro.
 */
export function defaultStyleFor(type: string): BuilderNode["style"] {
  const def = getDefinition(type);
  if (!def) throw new Error(`Componente no registrado en el ejemplo: "${type}"`);
  return structuredClone(def.defaultStyle);
}
