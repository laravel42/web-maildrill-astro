import { useMemo, useState } from 'react';
import Icon from '../Icon';
import { stepsBefore, type FlowDefinition } from '@/lib/app/automation-flow';
import type { PieceMeta } from '@/lib/app/automations';
import styles from './DataPicker.module.css';

/**
 * "Insert data" — the tree that means nobody has to memorise expression syntax.
 *
 * The available fields come from sample data, not from a run: the trigger's `samplePayload`
 * and each earlier step's `sampleOutput`, both published by the piece definitions. That is
 * what lets a workflow be built correctly *before* it has ever executed, which is the whole
 * problem with expression languages in tools like this.
 */

export interface DataNode {
  label: string;
  /** Full expression, e.g. `trigger.subscriber.email`. Absent on group rows. */
  path?: string;
  preview?: string;
  children?: DataNode[];
}

const MAX_DEPTH = 4;

function describe(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return '{…}';
  const text = String(value);
  return text.length > 34 ? `${text.slice(0, 33)}…` : text;
}

/** Walk a sample value into a tree of insertable paths. */
export function treeFromSample(root: unknown, prefix: string, depth = 0): DataNode[] {
  if (depth >= MAX_DEPTH || root === null || typeof root !== 'object') return [];
  if (Array.isArray(root)) {
    // Offer the array itself plus its first element's shape — enough to write
    // `{{steps.x.output.items[0].id}}` without guessing.
    const first = root[0];
    return first !== undefined
      ? [
          {
            label: '[0]',
            path: `${prefix}[0]`,
            preview: describe(first),
            children: treeFromSample(first, `${prefix}[0]`, depth + 1),
          },
        ]
      : [];
  }
  return Object.entries(root as Record<string, unknown>).map(([key, value]) => {
    const path = `${prefix}.${key}`;
    return {
      label: key,
      path,
      preview: describe(value),
      children: treeFromSample(value, path, depth + 1),
    };
  });
}

export function buildDataTree(
  flow: FlowDefinition,
  stepName: string,
  pieces: PieceMeta[],
): DataNode[] {
  const nodes: DataNode[] = [];

  const triggerSettings = flow.trigger.settings as { pieceName?: string; triggerName?: string };
  const triggerMeta = pieces
    .find((p) => p.name === triggerSettings.pieceName)
    ?.triggers.find((t) => t.name === triggerSettings.triggerName);
  if (triggerMeta) {
    nodes.push({
      label: flow.trigger.displayName || 'Trigger',
      children: treeFromSample(triggerMeta.samplePayload, 'trigger'),
    });
  }

  for (const step of stepsBefore(flow, stepName)) {
    if (step.type !== 'PIECE') continue;
    const meta = pieces
      .find((p) => p.name === step.settings.pieceName)
      ?.actions.find((a) => a.name === step.settings.actionName);
    const sample = meta?.sampleOutput;
    if (sample === null || sample === undefined) continue;
    nodes.push({
      label: step.displayName,
      children: treeFromSample(sample, `steps.${step.name}.output`),
    });
  }

  return nodes.filter((node) => (node.children?.length ?? 0) > 0);
}

export default function DataPicker({
  flow,
  stepName,
  pieces,
  onInsert,
  onClose,
}: {
  flow: FlowDefinition;
  stepName: string;
  pieces: PieceMeta[];
  onInsert: (expression: string) => void;
  onClose: () => void;
}) {
  const tree = useMemo(() => buildDataTree(flow, stepName, pieces), [flow, stepName, pieces]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.map((n) => n.label)));

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderNodes = (nodes: DataNode[], parentKey: string, depth: number) =>
    nodes.map((node) => {
      const key = `${parentKey}/${node.label}`;
      const hasChildren = (node.children?.length ?? 0) > 0;
      const isOpen = open.has(key);
      return (
        <li key={key}>
          <div className={styles.row} style={{ paddingLeft: 8 + depth * 14 }}>
            {hasChildren ? (
              <button
                type="button"
                className={styles.twisty}
                aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                aria-expanded={isOpen}
                onClick={() => toggle(key)}
              >
                <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} />
              </button>
            ) : (
              <span className={styles.twistySpacer} />
            )}
            {node.path ? (
              <button
                type="button"
                className={styles.leaf}
                onClick={() => onInsert(`{{${node.path}}}`)}
                title={`Insert {{${node.path}}}`}
              >
                <span className={styles.leafLabel}>{node.label}</span>
                <span className={styles.leafPreview}>{node.preview}</span>
              </button>
            ) : (
              <span className={styles.groupLabel}>{node.label}</span>
            )}
          </div>
          {hasChildren && isOpen ? (
            <ul className={styles.children}>{renderNodes(node.children!, key, depth + 1)}</ul>
          ) : null}
        </li>
      );
    });

  return (
    <div className={styles.panel} role="dialog" aria-label="Insert data">
      <div className={styles.head}>
        <span>Insert data</span>
        <button type="button" className="kbtn" aria-label="Close data picker" onClick={onClose}>
          <Icon name="x" size={14} />
        </button>
      </div>
      {tree.length === 0 ? (
        <p className={styles.empty}>
          Nothing to insert yet — choose a trigger, or add a step that produces data.
        </p>
      ) : (
        <ul className={styles.tree}>{renderNodes(tree, 'root', 0)}</ul>
      )}
    </div>
  );
}
