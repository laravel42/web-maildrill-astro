/**
 * Helper de TEST (no productivo, docs/48 §5.1) para la guarda anti-repetición
 * de la galería de plantillas por sector: dos plantillas no pueden compartir
 * la misma "firma de layout" — la secuencia de bandas de primer nivel y su
 * forma estructural.
 *
 * La firma NO se calcula sobre el hijo directo del root (`fragment.rootId`):
 * en las plantillas de negocio real (docs/42) ese hijo es casi siempre un
 * envoltorio `display:flex, flexDirection:column` (la banda entera apilada
 * verticalmente), así que comparar ahí no distingue nada. Se busca dentro de
 * cada banda el primer descendiente cuyo `layout.display` sea distinto de
 * "flex columna" — el primer grid, o el primer flex en fila —, que es la
 * pieza que de verdad varía entre arquetipos (catálogo denso vs. split
 * zig-zag vs. apilado editorial…). Si la banda no contiene ninguno, se usa el
 * propio hijo directo como fallback (banda sin "contenido de grid" real, p.
 * ej. una franja de solo texto).
 */

import type { NodeFragment } from "../../model/tree";
import type { BuilderNode, OverrideBreakpoint } from "../../model/types";

const OVERRIDE_BPS: OverrideBreakpoint[] = ["sm", "md", "lg", "xl"];

/** Orientación relativa media/copy cuando el grid tiene exactamente 2 columnas. */
export type MediaOrientation = "left" | "right" | "stacked" | "none";

/** Patrón normalizado de `gridTemplateColumns` (docs/48 §5.1, nota de normalización). */
export type GridColumnsPattern =
  | { kind: "none" }
  | { kind: "fluid" } // repeat(auto-fit|auto-fill, minmax(...)) — catálogo denso
  | { kind: "columns"; count: number; symmetric: boolean };

export interface BandSignature {
  /** Id del nodo sobre el que se calculó la firma (la banda o su descendiente elegido). */
  nodeId: string;
  display: string | undefined;
  gridColumns: GridColumnsPattern;
  /** Breakpoints con override en ESE nodo, en orden (ej. ["md", "lg"]). */
  overrideBreakpoints: OverrideBreakpoint[];
  hasMedia: boolean;
  orientation: MediaOrientation;
}

function isColumnFlex(node: BuilderNode): boolean {
  const layout = node.style.base.layout;
  return layout?.display === "flex" && (layout.flexDirection ?? "row") === "column";
}

/**
 * Normaliza `gridTemplateColumns` a un patrón simplificado: cuenta de columnas
 * + si son simétricas, o "fluido" para `repeat(auto-fit|auto-fill, minmax(...))`
 * (grid denso/catálogo, docs/48 §5.1). `"1fr 1fr"` y `"1fr 1.2fr"` colapsan al
 * mismo patrón (2 columnas, distinto solo simétrico/asimétrico) pero SÍ se
 * distinguen de un grid fluido.
 */
export function normalizeGridColumns(raw: string | undefined): GridColumnsPattern {
  if (!raw) return { kind: "none" };
  const trimmed = raw.trim();
  if (/auto-fit|auto-fill/.test(trimmed)) return { kind: "fluid" };

  const repeatFixed = /^repeat\(\s*(\d+)\s*,/.exec(trimmed);
  if (repeatFixed) {
    const count = Number(repeatFixed[1]);
    return { kind: "columns", count, symmetric: true };
  }

  // "1fr 1fr", "2fr 1fr", "minmax(0,1fr) minmax(0,1fr)" — split por espacios
  // que no estén dentro de paréntesis (mismo criterio que visualAudit.helper).
  const parts = trimmed.split(/\s+(?![^(]*\))/).filter((p) => p.length > 0);
  if (parts.length <= 1) return { kind: "none" };
  const symmetric = new Set(parts).size === 1;
  return { kind: "columns", count: parts.length, symmetric };
}

function overridesOf(node: BuilderNode): OverrideBreakpoint[] {
  return OVERRIDE_BPS.filter((bp) => node.style.overrides?.[bp]?.layout !== undefined);
}

function subtreeIds(fragment: NodeFragment, rootId: string): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const node = fragment.nodes[id];
    if (!node) return;
    out.push(id);
    for (const child of node.children ?? []) visit(child);
  };
  visit(rootId);
  return out;
}

/** ¿El subárbol de la banda contiene un nodo `image`/`video`/`hero` o un fondo no vacío? */
function subtreeHasMedia(fragment: NodeFragment, rootId: string): boolean {
  return subtreeIds(fragment, rootId).some((id) => {
    const node = fragment.nodes[id]!;
    if (node.type === "image" || node.type === "video" || node.type === "hero") return true;
    const bg = node.style.base.appearance?.background;
    if (bg === undefined) return false;
    if (typeof bg === "string") return bg.trim() !== "";
    return bg.token.trim() !== "";
  });
}

/**
 * Orientación relativa media/copy: solo tiene sentido cuando el grid elegido
 * tiene EXACTAMENTE 2 columnas en algún breakpoint (base o algún override).
 * Se determina mirando cuál de los dos primeros hijos directos del nodo de
 * grid contiene el media (`image`/`video`/`hero`) — si ninguno o ambos, no hay
 * orientación clara.
 */
function isTwoColumnPattern(pattern: GridColumnsPattern): boolean {
  return pattern.kind === "columns" && pattern.count === 2;
}

function orientationOf(
  fragment: NodeFragment,
  gridNode: BuilderNode,
  pattern: GridColumnsPattern,
): MediaOrientation {
  const isTwoCol =
    isTwoColumnPattern(pattern) ||
    OVERRIDE_BPS.some((bp) => {
      const overrideCols = gridNode.style.overrides?.[bp]?.layout?.gridTemplateColumns;
      return isTwoColumnPattern(normalizeGridColumns(overrideCols));
    });
  if (!isTwoCol) return "none";

  const children = gridNode.children ?? [];
  if (children.length < 2) return "stacked";
  const [firstId, secondId] = children;
  const firstHasMedia = subtreeHasMedia(fragment, firstId!);
  const secondHasMedia = subtreeHasMedia(fragment, secondId!);
  if (firstHasMedia === secondHasMedia) return "stacked";
  return firstHasMedia ? "left" : "right";
}

/**
 * Dentro de la banda `bandRootId`, encuentra el primer descendiente (recorrido
 * en profundidad, orden de `children`) cuyo `layout.display` no sea "flex
 * columna". `undefined` si no hay ninguno (el llamador usa el propio root como
 * fallback).
 */
function firstRealContentNode(fragment: NodeFragment, bandRootId: string): BuilderNode | undefined {
  let found: BuilderNode | undefined;
  const visit = (id: string): boolean => {
    const node = fragment.nodes[id];
    if (!node) return false;
    if (!isColumnFlex(node) && node.style.base.layout?.display !== undefined) {
      found = node;
      return true;
    }
    for (const child of node.children ?? []) {
      if (visit(child)) return true;
    }
    return false;
  };
  // No evalúa el propio bandRootId como candidato: es el fallback del llamador.
  const bandRoot = fragment.nodes[bandRootId];
  for (const child of bandRoot?.children ?? []) {
    if (visit(child)) break;
  }
  return found;
}

/** Firma estructural de un fragmento: una entrada por banda de primer nivel. */
export function layoutSignature(fragment: NodeFragment): BandSignature[] {
  const root = fragment.nodes[fragment.rootId];
  if (!root) return [];

  return (root.children ?? []).map((bandId) => {
    const bandRoot = fragment.nodes[bandId]!;
    const contentNode = firstRealContentNode(fragment, bandId) ?? bandRoot;
    const gridColumns = normalizeGridColumns(contentNode.style.base.layout?.gridTemplateColumns);
    return {
      nodeId: contentNode.id,
      display: contentNode.style.base.layout?.display,
      gridColumns,
      overrideBreakpoints: overridesOf(contentNode),
      hasMedia: subtreeHasMedia(fragment, bandId),
      orientation: orientationOf(fragment, contentNode, gridColumns),
    };
  });
}

function gridColumnsEqual(a: GridColumnsPattern, b: GridColumnsPattern): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "columns" && b.kind === "columns") {
    return a.count === b.count && a.symmetric === b.symmetric;
  }
  return true;
}

/** ¿Cuántos de los 5 rasgos de dos bandas difieren? (0 = idénticas, 5 = todo distinto). */
function bandDiffCount(a: BandSignature, b: BandSignature): number {
  let diff = 0;
  if (a.display !== b.display) diff += 1;
  if (!gridColumnsEqual(a.gridColumns, b.gridColumns)) diff += 1;
  if (a.overrideBreakpoints.join(",") !== b.overrideBreakpoints.join(",")) diff += 1;
  if (a.hasMedia !== b.hasMedia) diff += 1;
  if (a.orientation !== b.orientation) diff += 1;
  return diff;
}

/**
 * Cuenta total de rasgos distintos entre dos firmas completas: suma banda a
 * banda hasta `min(len(a), len(b))`, más una penalización de 5 (todos los
 * rasgos) por cada banda de más en la firma más larga — una banda extra ya es,
 * por definición, una diferencia estructural completa.
 */
export function signatureDiffCount(a: BandSignature[], b: BandSignature[]): number {
  const shared = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < shared; i++) diff += bandDiffCount(a[i]!, b[i]!);
  diff += Math.abs(a.length - b.length) * 5;
  return diff;
}

/** ¿Dos firmas son banda-a-banda IDÉNTICAS (mismo largo, 0 rasgos distintos en cada banda)? */
function signaturesIdentical(a: BandSignature[], b: BandSignature[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((band, i) => bandDiffCount(band, b[i]!) === 0);
}

export interface SignatureCollision {
  id: string;
  collidesWith: string;
}

/**
 * Verifica que ninguna plantilla comparta firma de layout con otra, según la
 * regla de docs/48 §5.1 / §2: dos plantillas del MISMO `archetype` deben
 * diferir en ≥2 de los 5 rasgos en alguna banda (o tener distinto número de
 * bandas); dos de `archetype` DISTINTO simplemente no deben tener la firma
 * IDÉNTICA banda-a-banda completa (pueden compartir algún rasgo suelto sin
 * problema — lo que no pueden es ser indistinguibles).
 *
 * `[]` = sin colisiones. El orden de iteración es estable (`Object.entries`),
 * así que `collidesWith` siempre referencia una entrada ya vista.
 */
export function allSignaturesDistinct(
  fragmentsById: Record<string, { fragment: NodeFragment; archetype?: string }>,
): SignatureCollision[] {
  const entries = Object.entries(fragmentsById);
  const signatures = entries.map(([id, { fragment, archetype }]) => ({
    id,
    archetype,
    signature: layoutSignature(fragment),
  }));

  const collisions: SignatureCollision[] = [];
  for (let i = 0; i < signatures.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = signatures[i]!;
      const b = signatures[j]!;
      const sameArchetype = a.archetype !== undefined && a.archetype === b.archetype;
      if (sameArchetype) {
        // Mismo arquetipo: exige ≥2 rasgos distintos en ALGUNA banda (o largo distinto).
        const lengthDiffers = a.signature.length !== b.signature.length;
        const someBandDiffersEnough =
          lengthDiffers ||
          a.signature.some((band, k) => {
            const other = b.signature[k];
            return other ? bandDiffCount(band, other) >= 2 : true;
          });
        if (!someBandDiffersEnough) {
          collisions.push({ id: a.id, collidesWith: b.id });
        }
      } else if (signaturesIdentical(a.signature, b.signature)) {
        collisions.push({ id: a.id, collidesWith: b.id });
      }
    }
  }
  return collisions;
}
