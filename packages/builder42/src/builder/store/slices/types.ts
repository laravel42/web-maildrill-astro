/**
 * Alias de tipo para las slices tipadas de Zustand (docs/27 §4.2).
 *
 * `SiteState` se importa con `import type` desde el barrel (`documentStore.ts`),
 * que a su vez importa las slices: es un ciclo, pero SOLO de tipos — `import
 * type` se borra en compilación y no existe en el grafo runtime de módulos.
 */
import type { StateCreator } from "zustand";
import type { SiteState } from "../documentStore";

/**
 * El initializer recibe ambos mutators. El orden refleja exactamente
 * temporal(immer(initializer)): temporal modifica el store e immer modifica set.
 * Omitir temporal no es compatible con las declaraciones instaladas de zundo/Zustand.
 */
export type SliceCreator<T> = StateCreator<
  SiteState,
  [["temporal", unknown], ["zustand/immer", never]],
  [],
  T
>;
