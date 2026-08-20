/**
 * Canvas layout.
 *
 * Turns a flow definition into absolutely-positioned nodes, SVG edge paths and the `+`
 * slots between them. Kept out of the React tree so it can be tested directly and so the
 * canvas component stays a renderer rather than a layout engine.
 *
 * The shape is a top-down journey with branches fanning out and rejoining — the way a
 * marketer draws a sequence on a whiteboard, and the same convention Activepieces uses.
 */
import type { FlowDefinition, FlowStep, SlotRef } from './automation-flow';

export const NODE_W = 268;
export const NODE_H = 62;
/** Vertical gap between two nodes; the `+` button sits in the middle of it. */
export const V_GAP = 52;
export const COL_GAP = 32;
/** Height of the labelled branch header above each path's first node. */
export const BRANCH_LABEL_H = 30;

export interface LayoutNode {
  id: string;
  kind: 'trigger' | 'step';
  x: number;
  y: number;
  step: FlowStep | FlowDefinition['trigger'];
}

export interface LayoutEdge {
  id: string;
  path: string;
}

export interface LayoutSlot {
  id: string;
  x: number;
  y: number;
  slot: SlotRef;
}

export interface BranchLabel {
  id: string;
  x: number;
  y: number;
  width: number;
  label: string;
  isFallback: boolean;
  routerName: string;
  branchIndex: number;
}

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  slots: LayoutSlot[];
  labels: BranchLabel[];
  width: number;
  height: number;
}

interface ChainResult {
  /** Distance from the chain's start to just below its last node. */
  height: number;
  /** Horizontal extent, centred on the chain's own x. */
  left: number;
  right: number;
  /** Name of the last step in the top-level chain, for the trailing `+`. */
  lastName: string | null;
}

/** Straight drop, or an orthogonal elbow when the columns differ. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const mid = y1 + (y2 - y1) / 2;
  const r = Math.min(14, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2);
  const dir = x2 > x1 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${mid - r}`,
    `Q ${x1} ${mid} ${x1 + r * dir} ${mid}`,
    `L ${x2 - r * dir} ${mid}`,
    `Q ${x2} ${mid} ${x2} ${mid + r}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

export function layoutFlow(flow: FlowDefinition): FlowLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const slots: LayoutSlot[] = [];
  const labels: BranchLabel[] = [];

  /**
   * Lay out one chain starting at (cx, top), where `cx` is the horizontal CENTRE.
   * `parentName` is the step the first `+` slot inserts after, or null for a branch head.
   */
  function layoutChain(
    first: FlowStep | null | undefined,
    cx: number,
    top: number,
    parentSlot: SlotRef,
  ): ChainResult {
    let y = top;
    let left = cx - NODE_W / 2;
    let right = cx + NODE_W / 2;
    let slot = parentSlot;
    let lastName: string | null = null;
    let step: FlowStep | null | undefined = first;

    while (step) {
      // `+` between the previous node and this one.
      slots.push({ id: `slot-${slotKey(slot)}`, x: cx, y: y - V_GAP / 2, slot });

      nodes.push({ id: step.name, kind: 'step', x: cx - NODE_W / 2, y, step });
      edges.push({
        id: `e-${step.name}-in`,
        path: edgePath(cx, y - V_GAP, cx, y),
      });

      let bottom = y + NODE_H;

      if (step.type === 'ROUTER') {
        const router = step;
        // Label chip, then a full gap, so the `+` slot below it never collides with it.
        const branchTop = bottom + BRANCH_LABEL_H + V_GAP * 1.5;
        const columns = router.settings.branches.map((_, index) =>
          measureChain(router.children[index] ?? null),
        );
        const totalWidth =
          columns.reduce((sum, c) => sum + c.width, 0) + COL_GAP * Math.max(columns.length - 1, 0);

        let colX = cx - totalWidth / 2;
        let deepest = branchTop;
        router.settings.branches.forEach((branch, index) => {
          const column = columns[index]!;
          const centre = colX + column.width / 2;
          labels.push({
            id: `label-${router.name}-${index}`,
            x: centre - NODE_W / 2,
            y: bottom + V_GAP - BRANCH_LABEL_H / 2,
            width: NODE_W,
            label: branch.branchName,
            isFallback: branch.branchType === 'FALLBACK',
            routerName: router.name,
            branchIndex: index,
          });
          // Split from the router down to this column.
          edges.push({
            id: `e-${router.name}-b${index}`,
            path: edgePath(cx, bottom, centre, bottom + V_GAP - BRANCH_LABEL_H / 2),
          });
          const result = layoutChain(router.children[index] ?? null, centre, branchTop, {
            kind: 'branch',
            routerName: router.name,
            branchIndex: index,
          });
          deepest = Math.max(deepest, branchTop + result.height);
          left = Math.min(left, colX);
          right = Math.max(right, colX + column.width);
          colX += column.width + COL_GAP;
        });

        // Rejoin below the deepest column.
        const merge = deepest + V_GAP;
        router.settings.branches.forEach((_, index) => {
          const column = columns[index]!;
          const centre =
            cx -
            totalWidth / 2 +
            columns.slice(0, index).reduce((sum, c) => sum + c.width + COL_GAP, 0) +
            column.width / 2;
          edges.push({
            id: `e-${router.name}-m${index}`,
            path: edgePath(centre, deepest, cx, merge),
          });
        });
        bottom = merge;
      }

      if (step.type === 'LOOP_ON_ITEMS') {
        const loop = step;
        const innerTop = bottom + BRANCH_LABEL_H + V_GAP * 1.5;
        labels.push({
          id: `label-${loop.name}-body`,
          x: cx - NODE_W / 2,
          y: bottom + V_GAP - BRANCH_LABEL_H / 2,
          width: NODE_W,
          label: 'For each item',
          isFallback: false,
          routerName: loop.name,
          branchIndex: 0,
        });
        edges.push({
          id: `e-${loop.name}-body`,
          path: edgePath(cx, bottom, cx, bottom + V_GAP - BRANCH_LABEL_H / 2),
        });
        const inner = layoutChain(loop.firstLoopAction ?? null, cx, innerTop, {
          kind: 'loop',
          loopName: loop.name,
        });
        left = Math.min(left, cx - inner.left);
        right = Math.max(right, cx + inner.right);
        bottom = innerTop + inner.height + V_GAP;
      }

      lastName = step.name;
      slot = { kind: 'after', stepName: step.name };
      y = bottom + V_GAP;
      step = step.nextAction ?? null;
    }

    // Trailing `+` at the end of the chain.
    slots.push({ id: `slot-${slotKey(slot)}-end`, x: cx, y: y - V_GAP / 2, slot });

    return { height: y - top, left: cx - left, right: right - cx, lastName };
  }

  // The trigger is always the root node.
  const rootX = 0;
  nodes.push({
    id: flow.trigger.name,
    kind: 'trigger',
    x: rootX - NODE_W / 2,
    y: 0,
    step: flow.trigger,
  });
  const chain = layoutChain(flow.trigger.nextAction ?? null, rootX, NODE_H + V_GAP, {
    kind: 'after',
    stepName: flow.trigger.name,
  });

  // Normalise so the leftmost element sits at a small positive margin.
  const minX = Math.min(rootX - NODE_W / 2, ...nodes.map((n) => n.x), ...labels.map((l) => l.x));
  const maxX = Math.max(
    rootX + NODE_W / 2,
    ...nodes.map((n) => n.x + NODE_W),
    ...labels.map((l) => l.x + l.width),
  );
  const pad = 60;
  const dx = pad - minX;

  return {
    nodes: nodes.map((n) => ({ ...n, x: n.x + dx })),
    edges: edges.map((e) => ({ ...e, path: shiftPath(e.path, dx) })),
    slots: slots.map((s) => ({ ...s, x: s.x + dx })),
    labels: labels.map((l) => ({ ...l, x: l.x + dx })),
    width: maxX - minX + pad * 2,
    height: NODE_H + V_GAP + chain.height + pad,
  };
}

/** Width a chain needs, so sibling branches can be packed without overlapping. */
function measureChain(first: FlowStep | null | undefined): { width: number } {
  let width = NODE_W;
  let cursor: FlowStep | null | undefined = first;
  while (cursor) {
    // Bound to a const so the narrowing survives the arrow function below — TypeScript
    // widens a mutable `let` back to the union inside a closure.
    const step = cursor;
    if (step.type === 'ROUTER') {
      const inner = step.settings.branches.map((_, i) => measureChain(step.children[i] ?? null));
      const total =
        inner.reduce((sum, c) => sum + c.width, 0) + COL_GAP * Math.max(inner.length - 1, 0);
      width = Math.max(width, total);
    }
    if (step.type === 'LOOP_ON_ITEMS') {
      width = Math.max(width, measureChain(step.firstLoopAction ?? null).width);
    }
    cursor = step.nextAction ?? null;
  }
  return { width };
}

function slotKey(slot: SlotRef): string {
  if (slot.kind === 'after') return `after-${slot.stepName}`;
  if (slot.kind === 'branch') return `branch-${slot.routerName}-${slot.branchIndex}`;
  return `loop-${slot.loopName}`;
}

/** Shift an SVG path horizontally — cheaper and safer than re-running the layout. */
function shiftPath(path: string, dx: number): string {
  return path.replace(
    /([ML]) (-?[\d.]+) (-?[\d.]+)|(Q) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g,
    (_m, cmd1, x1, y1, cmd2, cx, cy, x2, y2) => {
      if (cmd1) return `${cmd1} ${Number(x1) + dx} ${y1}`;
      return `${cmd2} ${Number(cx) + dx} ${cy} ${Number(x2) + dx} ${y2}`;
    },
  );
}
