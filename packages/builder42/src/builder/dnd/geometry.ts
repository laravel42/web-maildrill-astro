/**
 * Modelo de detección de drop — geometría pura.
 *
 * Sin DOM, sin React y sin librería de DnD: solo matemática sobre coordenadas,
 * de modo que sea 100% unit-testeable y agnóstico de la librería (docs/02 §4, §12).
 *
 * Idea central (docs/02 §4.1): el `index` de inserción lo calcula el CONTENEDOR
 * comparando la posición del puntero con los centros de sus hijos, NO el hijo
 * bajo el puntero. Esto hace robusto el drop sobre elementos delgados (dividers
 * de 2px) y sobre el gap entre hijos, donde puede no haber ningún hijo bajo el
 * puntero.
 *
 * La medición real de rects (getBoundingClientRect) vive en el wrapper de DnD;
 * aquí solo entran números.
 */

/** Eje del layout sobre el que se proyecta la geometría. */
export type Axis = "x" | "y";

/** Dirección de layout resuelta del contenedor (viene de resolveStyle, docs/01). */
export type LayoutDirection = "row" | "column" | "block" | "grid";

/** Subset de DOMRect necesario para el cálculo (permite testear sin DOM). */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Geometría del INDICADOR overlay (docs/02 §5, §10.4).
 *
 * Dado los rects de los hijos en coordenadas LOCALES del contenedor (relativas a
 * su content-box) y el `index` de inserción, devuelve el rect de la línea/celda
 * a resaltar. Es puro (sin DOM): el wrapper convierte client→local y llama aquí.
 *
 * - row  → línea vertical en la frontera X, altura completa del contenido.
 * - column/block → línea horizontal en la frontera Y, ancho completo.
 * - grid → línea vertical en el borde de la celda destino, alto = alto de esa
 *   celda (orden de lectura); resalta "voy a caer aquí" sin ocupar celda.
 *
 * Devuelve `null` sólo si no hay forma de posicionar (no debería con datos válidos).
 */
export function computeIndicatorRect(
  childRects: Rect[],
  index: number,
  direction: LayoutDirection,
  content: { width: number; height: number },
  thickness = 3,
): Rect | null {
  const n = childRects.length;

  if (direction === "row") {
    let x: number;
    if (n === 0) x = 0;
    else if (index <= 0) x = childRects[0]!.left;
    else if (index >= n) {
      const last = childRects[n - 1]!;
      x = last.left + last.width;
    } else {
      const prev = childRects[index - 1]!;
      const cur = childRects[index]!;
      x = (prev.left + prev.width + cur.left) / 2;
    }
    return { left: x - thickness / 2, top: 0, width: thickness, height: content.height };
  }

  if (direction === "grid") {
    if (n === 0) return { left: 0, top: 0, width: thickness, height: content.height };
    // Ancla a la celda destino (o al borde derecho de la última si es append).
    const anchor = index < n ? childRects[index]! : childRects[n - 1]!;
    const x = index < n ? anchor.left : anchor.left + anchor.width;
    return { left: x - thickness / 2, top: anchor.top, width: thickness, height: anchor.height };
  }

  // column / block
  let y: number;
  if (n === 0) y = 0;
  else if (index <= 0) y = childRects[0]!.top;
  else if (index >= n) {
    const last = childRects[n - 1]!;
    y = last.top + last.height;
  } else {
    const prev = childRects[index - 1]!;
    const cur = childRects[index]!;
    y = (prev.top + prev.height + cur.top) / 2;
  }
  return { left: 0, top: y - thickness / 2, width: content.width, height: thickness };
}

/**
 * Parsea las pistas resueltas de `getComputedStyle(el).gridTemplate*` (p. ej.
 * `"100px 100px 100px"`) a una lista de tamaños en px. `"none"`/"" → `[]`.
 */
export function parseTrackSizes(value: string): number[] {
  if (!value || value === "none") return [];
  return value
    .trim()
    .split(/\s+/)
    .map((t) => parseFloat(t))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Índice 1-based de la pista (columna o fila) en la que cae `offset` (px desde
 * el inicio del content-box), contando el `gap` entre pistas. Clampa a
 * `[1, tracks.length]`. Para el drop-to-cell explícito (docs/02 §10.4).
 */
export function trackIndexAtOffset(tracks: number[], gap: number, offset: number): number {
  if (tracks.length === 0) return 1;
  let pos = 0;
  for (let i = 0; i < tracks.length; i++) {
    const end = pos + tracks[i]!;
    if (offset < end + gap / 2) return i + 1;
    pos = end + gap;
  }
  return tracks.length;
}

/**
 * Encuentra la primera celda LIBRE en orden de lectura (row-major) a partir de
 * `target`, evitando las celdas `occupied` (claves `"col,row"`). Evita que dos
 * elementos con colocación explícita caigan en la misma celda y se superpongan
 * (docs/02 §10.4). Si `target` está libre, la devuelve tal cual.
 */
export function nextFreeCell(
  occupied: Set<string>,
  target: { column: number; row: number },
  columns: number,
): { column: number; row: number } {
  const cols = columns >= 1 ? columns : 1;
  let c = target.column;
  let r = target.row;
  let guard = 0;
  while (occupied.has(`${c},${r}`) && guard < 100000) {
    c += 1;
    if (c > cols) {
      c = 1;
      r += 1;
    }
    guard += 1;
  }
  return { column: c, row: r };
}

/**
 * Rect (en coords locales del padding-box) de la celda `(column,row)` 1-based de
 * un grid, a partir de las pistas resueltas + gaps + padding. Para que el
 * indicador resalte EXACTAMENTE la celda destino del drop explícito (docs/02
 * §10.4), en vez de una línea de orden de lectura desalineada.
 *
 * Filas implícitas (sin pistas): la celda ocupa todo el alto del contenido
 * (`contentHeight`). Índices fuera de rango se clampan a la última pista.
 */
export function gridCellRect(p: {
  colTracks: number[];
  rowTracks: number[];
  colGap: number;
  rowGap: number;
  padLeft: number;
  padTop: number;
  contentHeight: number;
  column: number;
  row: number;
}): Rect {
  const sumBefore = (tracks: number[], i: number, gap: number): number => {
    let s = 0;
    for (let k = 0; k < i && k < tracks.length; k++) s += tracks[k]! + gap;
    return s;
  };
  const ci = Math.max(0, Math.min(p.column, p.colTracks.length) - 1);
  const left = p.padLeft + sumBefore(p.colTracks, ci, p.colGap);
  const width = p.colTracks[ci] ?? 0;

  let top: number;
  let height: number;
  if (p.rowTracks.length === 0) {
    top = p.padTop;
    height = p.contentHeight;
  } else {
    const ri = Math.max(0, Math.min(p.row, p.rowTracks.length) - 1);
    top = p.padTop + sumBefore(p.rowTracks, ri, p.rowGap);
    height = p.rowTracks[ri] ?? 0;
  }
  return { left, top, width, height };
}

/** Eje relevante según la dirección del contenedor. `row` → horizontal. */
export function axisForDirection(dir: LayoutDirection): Axis {
  return dir === "row" ? "x" : "y";
}

/** Centro de un rect proyectado sobre el eje dado. */
export function centerOnAxis(rect: Rect, axis: Axis): number {
  return axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
}

/** Proyecta los rects de los hijos (en orden) a sus centros sobre el eje. */
export function projectCenters(rects: Rect[], axis: Axis): number[] {
  return rects.map((r) => centerOnAxis(r, axis));
}

/**
 * Núcleo de la detección (docs/02 §4.1).
 *
 * Dado los centros de los hijos en orden de layout y la coordenada del puntero
 * en el mismo eje, devuelve el índice de inserción: el número de hijos cuyo
 * centro queda estrictamente antes del puntero. Resultado en `[0, centers.length]`.
 *
 * No exige que el puntero esté "sobre" ningún hijo: cualquier posición dentro
 * del contenedor mapea a una frontera válida (sin zonas muertas).
 *
 * Asume un layout 1D con centros monótonos (flex row/column, block). El caso
 * grid 2D se trata aparte (docs/02 §10.4).
 */
export function computeDropIndex(centers: number[], pointer: number): number {
  let index = 0;
  for (const c of centers) {
    if (c < pointer) index++;
  }
  return index;
}

/**
 * Histéresis / banda muerta para evitar oscilación del hueco (docs/02 §13.2).
 *
 * Mantiene el `currentIndex` mientras el puntero no cruce el centro de la
 * frontera vecina por al menos `deadband` px. Solo cuando lo cruza se recalcula.
 * Esto rompe el bucle "abro hueco → se desplaza → se cierra → se reabre".
 *
 * @param currentIndex índice comprometido actualmente (o null si aún no hay uno)
 * @param pointer      coordenada del puntero en el eje
 * @param centers      centros de los hijos (snapshot tomado al dragStart)
 * @param deadband     margen en px antes de aceptar el cambio (p. ej. 8)
 */
export function applyHysteresis(
  currentIndex: number | null,
  pointer: number,
  centers: number[],
  deadband: number,
): number {
  // Sin índice previo: cálculo directo.
  if (currentIndex === null) return computeDropIndex(centers, pointer);

  // Subir de índice: el puntero debe pasar el centro del hijo en `currentIndex`.
  if (currentIndex < centers.length) {
    const upThreshold = centers[currentIndex]! + deadband;
    if (pointer >= upThreshold) return computeDropIndex(centers, pointer);
  }
  // Bajar de índice: el puntero debe pasar el centro del hijo en `currentIndex - 1`.
  if (currentIndex > 0) {
    const downThreshold = centers[currentIndex - 1]! - deadband;
    if (pointer <= downThreshold) return computeDropIndex(centers, pointer);
  }
  // Dentro de la banda muerta: mantener el índice comprometido.
  return currentIndex;
}

/**
 * Detección 2D para grid (docs/02 §10.4).
 *
 * El modelo es una lista ORDENADA (`children: id[]`) que el grid coloca por
 * auto-placement en orden de lectura (row-major). Así que "soltar en la celda X"
 * = elegir el `index` de inserción que hace caer el item en esa celda.
 *
 * Generaliza `computeDropIndex` a dos ejes: un hijo va "antes" del punto de
 * inserción si su fila está claramente por encima del puntero, o si —en la misma
 * fila (dentro de una banda vertical)— su centro queda a la izquierda. El índice
 * es el número de hijos "antes". Resultado en `[0, rects.length]`, sin zonas
 * muertas (cualquier posición mapea a una frontera válida).
 */
export function computeDropIndex2D(
  rects: Rect[],
  pointer: { x: number; y: number },
): number {
  let index = 0;
  for (const r of rects) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const band = r.height / 2; // tolerancia de "misma fila"
    const before =
      cy < pointer.y - band ||
      (Math.abs(cy - pointer.y) <= band && cx < pointer.x);
    if (before) index++;
  }
  return index;
}

/**
 * Conveniencia de alto nivel: de rects + dirección + puntero al índice de
 * inserción, aplicando histéresis. Es lo que llamará `getDropData` del wrapper
 * en cada `drag-over`, pasándole los rects medidos al `dragStart`.
 */
export function detectDropIndex(params: {
  childRects: Rect[];
  direction: LayoutDirection;
  pointer: { x: number; y: number };
  currentIndex?: number | null;
  deadband?: number;
}): number {
  const { childRects, direction, pointer, currentIndex = null, deadband = 8 } = params;
  // Grid: hit-testing 2D en orden de lectura (docs/02 §10.4). La histéresis 1D
  // no aplica; el snapshot único de rects ya da estabilidad.
  if (direction === "grid") {
    return computeDropIndex2D(childRects, pointer);
  }
  const axis = axisForDirection(direction);
  const centers = projectCenters(childRects, axis);
  const p = axis === "x" ? pointer.x : pointer.y;
  return applyHysteresis(currentIndex, p, centers, deadband);
}

/**
 * Mide los rects (`getBoundingClientRect`, coords de VIEWPORT) de una lista de
 * hijos por su `data-node-id`, buscándolos dentro de `container` (docs/24
 * §3.3). Extraída de `useDropTarget.ts` (antes privada) para que "pick &
 * insert" (Vía B, tap en vez de `dragover`) pueda reusar EXACTAMENTE el mismo
 * cómputo `punto → DropTarget` sin duplicar lógica ni tocar el DnD — mismo
 * criterio de "función nueva que envuelve la existente" que ya aplica
 * `detectDropIndex` en sí. `useDropTarget` la sigue usando igual (cero cambio
 * de comportamiento, sin cambiar su firma).
 */
export function measureChildRects(container: Element, childIds: string[]): Rect[] {
  const rects: Rect[] = [];
  for (const id of childIds) {
    const el = container.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    rects.push({ top: r.top, left: r.left, width: r.width, height: r.height });
  }
  return rects;
}

/**
 * Punto → `DropTarget` (docs/24 §3.3): dado un contenedor y la coordenada del
 * puntero/tap en el viewport, calcula el `index` de inserción con el MISMO
 * cómputo de proximidad que usa el DnD (`detectDropIndex` sobre los centros de
 * los hijos medidos en vivo — sin histéresis: cada tap es un cálculo fresco e
 * independiente, no hay gesto continuo que estabilizar). Puro respecto al
 * cálculo; solo la MEDICIÓN de rects toca el DOM (igual que `useDropTarget`).
 *
 * Usada por "pick & insert" (Vía B) para el paso de PREVIEW (§3.2 paso 2): un
 * tap en un contenedor no coloca directo, sino que calcula dónde caería —
 * exactamente igual que el "hover" del DnD, pero disparado por `click`.
 */
export function computeDropTargetAtPoint(params: {
  container: Element;
  childIds: string[];
  direction: LayoutDirection;
  pointer: { x: number; y: number };
}): { index: number } {
  const { container, childIds, direction, pointer } = params;
  const childRects = measureChildRects(container, childIds);
  const index = detectDropIndex({ childRects, direction, pointer });
  return { index };
}
