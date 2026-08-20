import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import ConfirmDialog from '../shared/ConfirmDialog';
import FlowCanvas from './FlowCanvas';
import Inspector from './Inspector';
import StepPicker, { type PickerChoice } from './StepPicker';
import TestPanel from './TestPanel';
import { routes } from '@/config/routes';
import { ApiError } from '@/lib/app/api';
import {
  duplicateStep,
  EMPTY_FLOW,
  insertStep,
  moveStep,
  nextStepName,
  removeStep,
  updateTrigger,
  type FlowDefinition,
  type FlowStep,
  type SlotRef,
} from '@/lib/app/automation-flow';
import {
  automationsApi,
  statusChipClass,
  STATUS_LABEL,
  type AutomationDetail,
  type PieceMeta,
  type ValidationIssue,
} from '@/lib/app/automations';
import styles from './AutomationBuilder.module.css';

/**
 * The composer.
 *
 * Everything a workflow author does happens here: choose a trigger, add steps, configure
 * them, test, publish. The three-pane shell (library ⋅ canvas ⋅ inspector) and every
 * control are built from `app.css` primitives and design tokens, so it reads as the same
 * product as Campaigns or Lists rather than as an embedded tool.
 *
 * State discipline worth knowing about:
 *  - `flow` is the single source of truth; every edit produces a NEW object (the ops in
 *    `automation-flow.ts` are pure), which is what makes undo/redo a stack of snapshots
 *    rather than a command log.
 *  - Saving is autosave-with-debounce against the DRAFT. Publishing is the only thing that
 *    touches what is actually running.
 */

const AUTOSAVE_DELAY_MS = 1100;
const HISTORY_LIMIT = 50;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface BuilderProps {
  automation: AutomationDetail;
  /** Server-rendered catalog, so the composer is usable on first paint. */
  pieces: PieceMeta[];
}

export default function AutomationBuilder({ automation: initial, pieces }: BuilderProps) {
  const [automation, setAutomation] = useState(initial);
  const [flow, setFlowState] = useState<FlowDefinition>(() =>
    initial.draft.trigger
      ? { trigger: initial.draft.trigger as FlowDefinition['trigger'] }
      : EMPTY_FLOW,
  );
  const [past, setPast] = useState<FlowDefinition[]>([]);
  const [future, setFuture] = useState<FlowDefinition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { kind: 'trigger' | 'action'; slot: SlotRef | null }>(
    null,
  );
  const [issues, setIssues] = useState<ValidationIssue[]>(initial.draft.validationErrors ?? []);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  /** Per-step status from the run the test panel is watching; drawn on the canvas. */
  const [runStatus, setRunStatus] = useState<
    Record<string, 'succeeded' | 'failed' | 'running' | 'paused' | 'skipped'>
  >({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(initial.name);

  const saveTimer = useRef<number | null>(null);
  const latestFlow = useRef(flow);
  latestFlow.current = flow;

  const flash = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    setNotice({ text, tone });
    window.setTimeout(
      () => setNotice((current) => (current?.text === text ? null : current)),
      3200,
    );
  }, []);

  // --- persistence -------------------------------------------------------------------

  const save = useCallback(
    async (definition: FlowDefinition) => {
      setSaveState('saving');
      try {
        const result = await automationsApi.saveDraft(automation.id, definition);
        setAutomation(result.automation);
        setIssues(result.errors);
        setSaveState('saved');
        setDirty(false);
      } catch (err) {
        setSaveState('error');
        flash(
          err instanceof ApiError ? err.message : 'Could not save. Retrying on the next edit.',
          'err',
        );
      }
    },
    [automation.id, flash],
  );

  const setFlow = useCallback(
    (next: FlowDefinition) => {
      setPast((stack) => [...stack, latestFlow.current].slice(-HISTORY_LIMIT));
      setFuture([]);
      setFlowState(next);
      setDirty(true);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void save(next), AUTOSAVE_DELAY_MS);
    },
    [save],
  );

  // Warn before losing an unsaved edit — autosave is fast, but a closed tab beats it.
  useEffect(() => {
    if (!dirty) return;
    // `preventDefault()` alone is the modern contract; `returnValue` is deprecated and
    // only Safari still needs it, which is why it is assigned through an index rather than
    // the typed (deprecated) property.
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      (event as unknown as Record<string, unknown>).returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const undo = useCallback(() => {
    setPast((stack) => {
      const previous = stack[stack.length - 1];
      if (!previous) return stack;
      setFuture((f) => [latestFlow.current, ...f]);
      setFlowState(previous);
      setDirty(true);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void save(previous), AUTOSAVE_DELAY_MS);
      return stack.slice(0, -1);
    });
  }, [save]);

  const redo = useCallback(() => {
    setFuture((stack) => {
      const next = stack[0];
      if (!next) return stack;
      setPast((p) => [...p, latestFlow.current].slice(-HISTORY_LIMIT));
      setFlowState(next);
      setDirty(true);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void save(next), AUTOSAVE_DELAY_MS);
      return stack.slice(1);
    });
  }, [save]);

  // --- editing ------------------------------------------------------------------------

  const addStep = useCallback(
    (choice: PickerChoice, slot: SlotRef | null) => {
      if (choice.kind === 'trigger') {
        setFlow(
          updateTrigger(flow, (trigger) => ({
            ...trigger,
            type: 'PIECE',
            displayName: choice.displayName,
            valid: false,
            settings: {
              pieceName: choice.pieceName,
              pieceVersion: choice.pieceVersion,
              triggerName: choice.name,
              input: defaultsFor(choice),
            },
          })),
        );
        setSelected(flow.trigger.name);
        setPicker(null);
        return;
      }
      if (!slot) return;

      const name = nextStepName(flow, choice.displayName);
      let step: FlowStep;
      if (choice.pieceName === '__router__') {
        step = {
          name,
          displayName: choice.displayName,
          valid: false,
          type: 'ROUTER',
          settings: {
            executionType: 'EXECUTE_FIRST_MATCH',
            branches: [
              {
                branchName: 'Yes',
                branchType: 'CONDITION',
                conditions: [
                  [{ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '' }],
                ],
              },
              { branchName: 'Otherwise', branchType: 'FALLBACK', conditions: [] },
            ],
          },
          children: [null, null],
          nextAction: null,
        };
      } else if (choice.pieceName === '__loop__') {
        step = {
          name,
          displayName: choice.displayName,
          valid: false,
          type: 'LOOP_ON_ITEMS',
          settings: { items: '' },
          firstLoopAction: null,
          nextAction: null,
        };
      } else {
        step = {
          name,
          displayName: choice.displayName,
          valid: false,
          type: 'PIECE',
          settings: {
            pieceName: choice.pieceName,
            pieceVersion: choice.pieceVersion,
            actionName: choice.name,
            input: defaultsFor(choice),
          },
          nextAction: null,
        };
      }

      setFlow(insertStep(flow, slot, step));
      setSelected(name);
      setPicker(null);
    },
    [flow, setFlow],
  );

  const deleteStep = useCallback(
    (name: string) => {
      setFlow(removeStep(flow, name));
      setSelected((current) => (current === name ? null : current));
      setConfirmDelete(null);
    },
    [flow, setFlow],
  );

  const requestDelete = useCallback(
    (name: string) => {
      const step = [...flatten(flow)].find((s) => s.name === name);
      // Deleting a container throws away its children, which is not obvious from the
      // canvas — that one asks first. A plain step just goes.
      const hasChildren =
        step?.type === 'ROUTER'
          ? step.children.some(Boolean)
          : step?.type === 'LOOP_ON_ITEMS'
            ? Boolean(step.firstLoopAction)
            : false;
      if (hasChildren) setConfirmDelete(name);
      else deleteStep(name);
    },
    [flow, deleteStep],
  );

  // --- keyboard ------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        void save(latestFlow.current);
        return;
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (event.key === 'Escape') {
        setPicker(null);
        setSelected(null);
        return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selected &&
        selected !== flow.trigger.name
      ) {
        event.preventDefault();
        requestDelete(selected);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [flow.trigger.name, redo, requestDelete, save, selected, undo]);

  // --- derived --------------------------------------------------------------------------

  const issuesByStep = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      const key = issue.stepName ?? '__flow__';
      map.set(key, [...(map.get(key) ?? []), issue.message]);
    }
    return map;
  }, [issues]);

  const invalidSteps = useMemo(
    () => new Set([...issuesByStep.keys()].filter((key) => key !== '__flow__')),
    [issuesByStep],
  );

  const flowIssues = issuesByStep.get('__flow__') ?? [];
  const canPublish = issues.length === 0 && flow.trigger.type !== 'EMPTY';

  const publish = async () => {
    setPublishing(true);
    try {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      await save(latestFlow.current);
      const result = await automationsApi.publish(automation.id);
      setAutomation(result.automation);
      setIssues(result.errors);
      flash(
        result.automation.status === 'paused'
          ? 'Published. This automation is still paused — resume it when you are ready.'
          : 'Published. New events will run this version.',
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        flash('Fix the highlighted steps before publishing.', 'err');
      } else {
        flash(err instanceof ApiError ? err.message : 'Could not publish.', 'err');
      }
    } finally {
      setPublishing(false);
    }
  };

  const toggleActive = async () => {
    try {
      const next =
        automation.status === 'active'
          ? await automationsApi.pause(automation.id)
          : await automationsApi.activate(automation.id);
      setAutomation(next);
      flash(next.status === 'active' ? 'Automation resumed.' : 'Automation paused.');
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'Could not change the status.', 'err');
    }
  };

  const commitName = async () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === automation.name) {
      setName(automation.name);
      return;
    }
    try {
      setAutomation(await automationsApi.rename(automation.id, { name: trimmed }));
    } catch {
      setName(automation.name);
      flash('Could not rename it.', 'err');
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.back} href={routes.app.automations}>
          <Icon name="arrow-right" size={15} className={styles.backIcon} />
          Automations
        </a>

        <div className={styles.title}>
          {renaming ? (
            <input
              className={styles.nameInput}
              value={name}
              autoFocus
              aria-label="Automation name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitName();
                if (e.key === 'Escape') {
                  setName(automation.name);
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button type="button" className={styles.nameButton} onClick={() => setRenaming(true)}>
              {automation.name}
              <Icon name="edit" size={13} />
            </button>
          )}
          <span className={`astatus ${statusChipClass(automation.status)}`}>
            {STATUS_LABEL[automation.status]}
          </span>
          {automation.hasUnpublishedChanges ? (
            <span className={styles.unpublished}>
              Draft v{automation.version} · published v{automation.publishedVersion}
            </span>
          ) : null}
        </div>

        <div className={styles.actions}>
          <span className={styles.saveState} aria-live="polite">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'error'
                ? 'Not saved'
                : dirty
                  ? 'Unsaved changes'
                  : saveState === 'saved'
                    ? 'Saved'
                    : ''}
          </span>
          <button
            type="button"
            className="kbtn"
            aria-label="Undo"
            disabled={past.length === 0}
            onClick={undo}
          >
            <Icon name="undo" size={16} />
          </button>
          <button
            type="button"
            className="kbtn"
            aria-label="Redo"
            disabled={future.length === 0}
            onClick={redo}
          >
            <Icon name="redo" size={16} />
          </button>
          <a className="sbtn" href={routes.app.automationRuns(automation.id)}>
            Runs
          </a>
          <button
            type="button"
            className="sbtn"
            onClick={() => setTestOpen(true)}
            disabled={!canPublish}
            title={canPublish ? 'Run this draft once' : 'Finish the highlighted steps first'}
          >
            <Icon name="play" size={14} /> Test
          </button>
          {automation.publishedVersion ? (
            <button type="button" className="sbtn" onClick={() => void toggleActive()}>
              <Icon name={automation.status === 'active' ? 'pause' : 'play'} size={14} />
              {automation.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          ) : null}
          <button
            type="button"
            className="pbtn"
            onClick={() => void publish()}
            disabled={!canPublish || publishing}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </header>

      {flowIssues.length > 0 ? (
        <div className={styles.flowIssues} role="status">
          <Icon name="alert-triangle" size={15} />
          {flowIssues.join(' ')}
        </div>
      ) : null}

      <div className={styles.body}>
        <aside className={styles.library} aria-label="Steps">
          <h2 className={styles.libraryTitle}>Build</h2>
          <p className={styles.libraryHint}>
            {flow.trigger.type === 'EMPTY'
              ? 'Start by choosing what sets this automation off.'
              : 'Click a + on the canvas to add the next step.'}
          </p>
          <button
            type="button"
            className={styles.libraryBtn}
            onClick={() => setPicker({ kind: 'trigger', slot: null })}
          >
            <Icon name="zap" size={15} />
            <span>
              <strong>
                {flow.trigger.type === 'EMPTY' ? 'Choose a trigger' : 'Change trigger'}
              </strong>
              <em>What starts this automation</em>
            </span>
          </button>
          <button
            type="button"
            className={styles.libraryBtn}
            disabled={flow.trigger.type === 'EMPTY'}
            onClick={() =>
              setPicker({ kind: 'action', slot: { kind: 'after', stepName: lastStepName(flow) } })
            }
          >
            <Icon name="plus" size={15} />
            <span>
              <strong>Add a step</strong>
              <em>Appends to the end of the flow</em>
            </span>
          </button>

          <h3 className={styles.libraryGroup}>Shortcuts</h3>
          <dl className={styles.shortcuts}>
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
        </aside>

        <FlowCanvas
          flow={flow}
          pieces={pieces}
          selected={selected}
          invalid={invalidSteps}
          runStatus={testOpen ? runStatus : undefined}
          onSelect={(nameOrNull) => {
            if (nameOrNull === flow.trigger.name && flow.trigger.type === 'EMPTY') {
              setPicker({ kind: 'trigger', slot: null });
              return;
            }
            setSelected(nameOrNull);
          }}
          onAddAt={(slot) => setPicker({ kind: 'action', slot })}
          onDelete={requestDelete}
          onDuplicate={(stepName) => setFlow(duplicateStep(flow, stepName))}
          onMove={(stepName, direction) => setFlow(moveStep(flow, stepName, direction))}
        />

        {selected ? (
          <Inspector
            flow={flow}
            pieces={pieces}
            selected={selected}
            errors={issuesByStep.get(selected) ?? []}
            onChange={setFlow}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </div>

      {picker ? (
        <StepPicker
          pieces={pieces}
          kind={picker.kind}
          onPick={(choice) => addStep(choice, picker.slot)}
          onClose={() => setPicker(null)}
        />
      ) : null}

      {testOpen ? (
        <TestPanel
          automation={automation}
          flow={flow}
          pieces={pieces}
          onProgress={setRunStatus}
          onClose={() => {
            setTestOpen(false);
            setRunStatus({});
          }}
          onBeforeRun={async () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            await save(latestFlow.current);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this step and everything inside it?"
          message="The steps nested under it go too. This cannot be undone from the server, but ⌘Z still works until you leave."
          confirmLabel="Delete"
          onConfirm={() => deleteStep(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}

      {notice ? (
        <div
          className={`${styles.notice} ${notice.tone === 'err' ? styles.noticeErr : ''}`}
          role="status"
        >
          {notice.text}
        </div>
      ) : null}
    </div>
  );
}

function defaultsFor(choice: PickerChoice): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(choice.props)) {
    if (prop.defaultValue !== undefined) input[key] = prop.defaultValue;
  }
  return input;
}

function flatten(flow: FlowDefinition): FlowStep[] {
  const out: FlowStep[] = [];
  const visit = (step: FlowStep | null | undefined): void => {
    if (!step) return;
    out.push(step);
    if (step.type === 'LOOP_ON_ITEMS') visit(step.firstLoopAction);
    if (step.type === 'ROUTER') step.children.forEach(visit);
    visit(step.nextAction);
  };
  visit(flow.trigger.nextAction);
  return out;
}

/** Last step of the TOP-LEVEL chain — where "Add a step" appends. */
function lastStepName(flow: FlowDefinition): string {
  let name = flow.trigger.name;
  let step = flow.trigger.nextAction;
  while (step) {
    name = step.name;
    step = step.nextAction ?? null;
  }
  return name;
}
