import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import type { IconName } from '@/lib/icons';
import { layoutFlow, NODE_H, NODE_W, type LayoutNode } from '@/lib/app/automation-layout';
import type { FlowDefinition, FlowStep, SlotRef } from '@/lib/app/automation-flow';
import type { PieceMeta } from '@/lib/app/automations';
import styles from './FlowCanvas.module.css';

/**
 * The canvas.
 *
 * A renderer, not a layout engine: positions come from `layoutFlow`, so this file only
 * deals with transform state (pan/zoom) and pointer/keyboard interaction. Nodes are
 * ordinary DOM — buttons, with real focus order — sitting above an SVG edge layer, which
 * is what makes the whole thing keyboard-navigable without a graph library.
 */

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;

export interface CanvasProps {
  flow: FlowDefinition;
  pieces: PieceMeta[];
  selected: string | null;
  /** Step names with a validation error, drawn with a warning outline. */
  invalid: Set<string>;
  /** Per-step status from the live test run, if one is in flight. */
  runStatus?: Record<string, 'succeeded' | 'failed' | 'running' | 'paused' | 'skipped'>;
  /**
   * Ask the canvas to bring a step into view. The `nonce` is what makes it repeatable:
   * clicking the same outline row twice must re-centre, and a plain name would not change.
   */
  focus?: { stepName: string; nonce: number };
  onSelect: (name: string | null) => void;
  onAddAt: (slot: SlotRef) => void;
}

interface NodeVisual {
  icon: IconName;
  accent: string;
  subtitle: string;
}

/** Icon and accent for a node, resolved from the catalog so the canvas stays data-driven. */
function visualFor(
  step: FlowStep | FlowDefinition['trigger'],
  pieces: PieceMeta[],
  isTrigger: boolean,
): NodeVisual {
  if (step.type === 'ROUTER') {
    return { icon: 'branch', accent: 'var(--text3)', subtitle: 'Branch' };
  }
  if (step.type === 'LOOP_ON_ITEMS') {
    return { icon: 'loop', accent: 'var(--text3)', subtitle: 'Loop' };
  }
  if (step.type === 'EMPTY') {
    return { icon: 'zap', accent: 'var(--muted)', subtitle: 'Not configured' };
  }
  const settings = step.settings as {
    pieceName?: string;
    actionName?: string;
    triggerName?: string;
  };
  const piece = pieces.find((p) => p.name === settings.pieceName);
  const definition = isTrigger
    ? piece?.triggers.find((t) => t.name === settings.triggerName)
    : piece?.actions.find((a) => a.name === settings.actionName);
  const accent = definition?.accent ?? piece?.accent ?? '--text3';
  return {
    icon: iconForPiece(settings.pieceName ?? ''),
    accent: `var(${accent})`,
    subtitle: piece?.displayName ?? 'Step',
  };
}

function iconForPiece(pieceName: string): IconName {
  switch (pieceName) {
    case '@maildrill/email':
      return 'mail';
    case '@maildrill/sms':
      return 'sms';
    case '@maildrill/whatsapp':
      return 'whatsapp';
    case '@maildrill/voice':
      return 'voice';
    case '@maildrill/subscribers':
      return 'subscribers';
    case '@maildrill/campaigns':
      return 'campaigns';
    case '@maildrill/logic':
      return 'clock';
    case '@maildrill/data':
      return 'code';
    case '@maildrill/webhook':
      return 'globe';
    default:
      return 'zap';
  }
}

export default function FlowCanvas({
  flow,
  pieces,
  selected,
  invalid,
  runStatus,
  focus,
  onSelect,
  onAddAt,
}: CanvasProps) {
  const layout = useMemo(() => layoutFlow(flow), [flow]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { clientWidth, clientHeight } = viewport;
    if (clientWidth === 0 || layout.width === 0) return;
    const next = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min(clientWidth / layout.width, clientHeight / layout.height, 1)),
    );
    setScale(next);
    setPan({ x: (clientWidth - layout.width * next) / 2, y: 24 });
  }, [layout.width, layout.height]);

  /**
   * Centre a step on request. Only ever driven by an explicit ask (the outline), never by
   * selection itself — the canvas must not yank itself around when someone clicks a node
   * they can already see.
   */
  useEffect(() => {
    if (!focus) return;
    const viewport = viewportRef.current;
    const node = layout.nodes.find((n) => n.id === focus.stepName);
    if (!viewport || !node) return;
    // Read the current zoom rather than depending on it: re-centring on every zoom step
    // would fight the user's own zooming.
    const z = scaleRef.current;
    setPan({
      x: viewport.clientWidth / 2 - (node.x + NODE_W / 2) * z,
      y: viewport.clientHeight / 2 - (node.y + NODE_H / 2) * z,
    });
  }, [focus, layout.nodes]);

  // Fit once the first layout is measured; afterwards the user owns the viewport.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || layout.width === 0) return;
    fitted.current = true;
    fit();
  }, [fit, layout.width]);

  const onWheel = (event: React.WheelEvent) => {
    // Ctrl/Cmd + wheel is the trackpad pinch gesture; plain wheel scrolls the canvas,
    // which is what people expect from a long vertical flow.
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s - event.deltaY * 0.002)));
      return;
    }
    setPan((p) => ({ x: p.x - event.deltaX, y: p.y - event.deltaY }));
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-node], [data-slot]')) return;
    dragging.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    onSelect(null);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const from = dragging.current;
    if (!from) return;
    setPan({ x: from.panX + (event.clientX - from.x), y: from.panY + (event.clientY - from.y) });
  };

  const endDrag = () => {
    dragging.current = null;
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="application"
        aria-label="Automation canvas"
      >
        <div
          className={styles.stage}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            width: layout.width,
            height: layout.height,
          }}
        >
          <svg
            className={styles.edges}
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.edges.map((edge) => (
              <path key={edge.id} d={edge.path} className={styles.edge} />
            ))}
          </svg>

          {layout.labels.map((label) => (
            <div
              key={label.id}
              className={`${styles.branchLabel} ${label.isFallback ? styles.branchFallback : ''}`}
              style={{ left: label.x, top: label.y, width: label.width }}
            >
              <span>{label.label}</span>
            </div>
          ))}

          {layout.slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              data-slot
              className={styles.plus}
              style={{ left: slot.x - 13, top: slot.y - 13 }}
              aria-label="Add a step here"
              onClick={(event) => {
                event.stopPropagation();
                onAddAt(slot.slot);
              }}
            >
              <Icon name="plus" size={14} />
            </button>
          ))}

          {layout.nodes.map((node) => (
            <Node
              key={node.id}
              node={node}
              pieces={pieces}
              selected={selected === node.id}
              invalid={invalid.has(node.id)}
              status={runStatus?.[node.id]}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <div className={styles.zoom}>
        <button
          type="button"
          className="kbtn"
          aria-label="Zoom out"
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))}
        >
          <Icon name="minus" size={15} />
        </button>
        <span className="tnum" aria-live="off">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          className="kbtn"
          aria-label="Zoom in"
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))}
        >
          <Icon name="plus" size={15} />
        </button>
        <button type="button" className="kbtn" aria-label="Fit to screen" onClick={fit}>
          <Icon name="maximize" size={15} />
        </button>
      </div>
    </div>
  );
}

function Node({
  node,
  pieces,
  selected,
  invalid,
  status,
  onSelect,
}: {
  node: LayoutNode;
  pieces: PieceMeta[];
  selected: boolean;
  invalid: boolean;
  status?: 'succeeded' | 'failed' | 'running' | 'paused' | 'skipped';
  onSelect: (name: string) => void;
}) {
  const isTrigger = node.kind === 'trigger';
  const visual = visualFor(node.step, pieces, isTrigger);

  return (
    <div
      data-node
      className={[
        styles.node,
        selected ? styles.nodeSelected : '',
        invalid ? styles.nodeInvalid : '',
        isTrigger ? styles.nodeTrigger : '',
        status ? styles[`status_${status}`] : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
    >
      <button
        type="button"
        className={styles.nodeBody}
        aria-pressed={selected}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
      >
        <span className={styles.nodeIcon} style={{ color: visual.accent }}>
          <Icon name={visual.icon} size={17} />
        </span>
        <span className={styles.nodeText}>
          <span className={styles.nodeTitle}>{node.step.displayName}</span>
          <span className={styles.nodeSub}>
            {isTrigger ? 'Trigger' : visual.subtitle}
            {status ? ` · ${status}` : ''}
          </span>
        </span>
        {invalid ? (
          <span className={styles.nodeWarn} title="This step needs attention">
            <Icon name="alert-triangle" size={15} />
          </span>
        ) : null}
      </button>
    </div>
  );
}

export { NODE_H, NODE_W };
