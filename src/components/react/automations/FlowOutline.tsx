import { useMemo, type CSSProperties } from 'react';
import Icon from '../Icon';
import type { IconName } from '@/lib/icons';
import { outlineRows, type FlowDefinition, type OutlineRow } from '@/lib/app/automation-flow';
import type { PieceMeta } from '@/lib/app/automations';
import styles from './FlowOutline.module.css';

/**
 * The editor's left rail: an outline of the flow in execution order.
 *
 * It replaced a panel of two buttons and a shortcut cheat-sheet — controls the canvas
 * already offers, and a list you read once. An outline earns the space instead, because it
 * does three things the canvas cannot at any zoom level:
 *
 *   1. shows the whole journey at once, however long it is;
 *   2. says where you are, and moves you somewhere else in one click;
 *   3. surfaces which steps are unfinished, before Publish refuses.
 */

/** Icon per piece, mirroring the canvas so a step looks the same in both places. */
function iconFor(row: OutlineRow): IconName {
  if (row.kind === 'trigger') return 'zap';
  if (row.type === 'ROUTER') return 'branch';
  if (row.type === 'LOOP_ON_ITEMS') return 'loop';
  switch (row.pieceName) {
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

function accentFor(row: OutlineRow, pieces: PieceMeta[]): string {
  const piece = pieces.find((p) => p.name === row.pieceName);
  return `var(${piece?.accent ?? '--text3'})`;
}

export interface FlowOutlineProps {
  flow: FlowDefinition;
  pieces: PieceMeta[];
  selected: string | null;
  /** Step names carrying a validation message. */
  invalid: Set<string>;
  /** Live per-step status while a test run is being watched. */
  runStatus?: Record<string, 'succeeded' | 'failed' | 'running' | 'paused' | 'skipped'>;
  /**
   * True while an edit has not yet been validated by the server. Without it the summary
   * says "Ready to publish" in the second between typing and the autosave answering —
   * which is a claim the editor cannot yet make, and Publish is disabled while it says so.
   */
  checking?: boolean;
  onSelect: (stepName: string) => void;
  onChangeTrigger: () => void;
  onAddStep: () => void;
}

export default function FlowOutline({
  flow,
  pieces,
  selected,
  invalid,
  runStatus,
  checking = false,
  onSelect,
  onChangeTrigger,
  onAddStep,
}: FlowOutlineProps) {
  const rows = useMemo(() => outlineRows(flow), [flow]);
  const hasTrigger = flow.trigger.type !== 'EMPTY';
  const stepCount = rows.filter((r) => r.kind === 'step').length;

  /** The first unfinished step, so "needs attention" can go somewhere. */
  const firstInvalid = rows.find((r) => r.kind !== 'branch' && invalid.has(r.stepName));

  return (
    <aside className={styles.rail} aria-label="Flow outline">
      <header className={styles.head}>
        <h2 className={styles.title}>Flow</h2>
        {hasTrigger ? (
          <span className={styles.count}>
            {stepCount} {stepCount === 1 ? 'step' : 'steps'}
          </span>
        ) : null}
      </header>

      {!hasTrigger ? (
        // First-run state: one decision, named, with nothing else competing for it.
        <div className={styles.blank}>
          <p>Every automation starts with a trigger — the thing that sets it off.</p>
          <button type="button" className={styles.primary} onClick={onChangeTrigger}>
            <Icon name="zap" size={14} /> Choose a trigger
          </button>
        </div>
      ) : (
        <>
          <ol className={styles.list}>
            {rows.map((row) => {
              const isBranch = row.kind === 'branch';
              const isSelected = !isBranch && selected === row.stepName;
              const status = runStatus?.[row.stepName];
              return (
                <li key={row.id} style={{ '--depth': row.depth } as CSSProperties}>
                  {/* The trigger row carries a second control, so it is a wrapper rather
                      than a bare button — a button inside a button is invalid and the
                      nested one stops being reachable. */}
                  <div className={styles.rowWrap}>
                    <button
                      type="button"
                      className={[
                        styles.row,
                        isBranch ? styles.branch : '',
                        row.kind === 'trigger' ? styles.trigger : '',
                        isSelected ? styles.selected : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => onSelect(row.stepName)}
                    >
                      {isBranch ? (
                        <span className={styles.branchDash} aria-hidden="true" />
                      ) : (
                        <span className={styles.icon} style={{ color: accentFor(row, pieces) }}>
                          <Icon name={iconFor(row)} size={14} />
                        </span>
                      )}
                      <span className={styles.label}>{row.label}</span>
                      {status ? (
                        <span
                          className={`${styles.pip} ${styles[`pip_${status}`]}`}
                          title={`This step ${status}`}
                        />
                      ) : !isBranch && invalid.has(row.stepName) ? (
                        <Icon
                          name="alert-triangle"
                          size={13}
                          className={styles.warn}
                          title="Needs attention"
                        />
                      ) : null}
                    </button>
                    {row.kind === 'trigger' ? (
                      <button
                        type="button"
                        className={styles.swap}
                        aria-label="Change trigger"
                        title="Change trigger"
                        onClick={onChangeTrigger}
                      >
                        <Icon name="edit" size={12} />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>

          <button type="button" className={styles.add} onClick={onAddStep}>
            <Icon name="plus" size={14} /> Add a step
          </button>

          <div
            className={[
              styles.summary,
              firstInvalid ? styles.summaryWarn : '',
              checking && !firstInvalid ? styles.summaryIdle : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="status"
          >
            {checking && !firstInvalid ? (
              <span>
                <Icon name="clock" size={13} /> Checking…
              </span>
            ) : firstInvalid ? (
              <button type="button" onClick={() => onSelect(firstInvalid.stepName)}>
                <Icon name="alert-triangle" size={13} />
                {invalid.size} {invalid.size === 1 ? 'step needs' : 'steps need'} attention
              </button>
            ) : (
              <span>
                <Icon name="check-circle" size={13} /> Ready to publish
              </span>
            )}
          </div>
        </>
      )}

      {/* Learn-once reference: present, but not permanent chrome. */}
      <details className={styles.shortcuts}>
        <summary>Keyboard shortcuts</summary>
        <dl>
          <div>
            <dt>Undo / redo</dt>
            <dd>⌘Z · ⇧⌘Z</dd>
          </div>
          <div>
            <dt>Save now</dt>
            <dd>⌘S</dd>
          </div>
          <div>
            <dt>Delete step</dt>
            <dd>⌫</dd>
          </div>
          <div>
            <dt>Zoom</dt>
            <dd>⌘scroll</dd>
          </div>
        </dl>
      </details>
    </aside>
  );
}
