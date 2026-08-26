import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import type { IconName } from '@/lib/icons';
import ConditionEditor from './ConditionEditor';
import DataPicker from './DataPicker';
import {
  addBranch,
  removeBranch,
  updateStep,
  updateTrigger,
  type ConditionGroups,
  type FlowDefinition,
  type FlowStep,
} from '@/lib/app/automation-flow';
import { automationsApi, type PieceMeta, type PropMeta } from '@/lib/app/automations';
import SelectMenu from './SelectMenu';
import styles from './Inspector.module.css';

/**
 * Step configuration, in place.
 *
 * Opening a node fills this panel rather than navigating anywhere — the canvas stays
 * visible so the change can be seen in context, which is the whole point of a visual
 * builder.
 *
 * Fields are rendered from the piece's `props` metadata (fetched from the server), so a new
 * piece becomes configurable without a line of UI code.
 */
/** Same mapping the canvas and the outline use, so one step wears one icon everywhere. */
const PIECE_ICON: Record<string, IconName> = {
  '@maildrill/email': 'mail',
  '@maildrill/sms': 'sms',
  '@maildrill/whatsapp': 'whatsapp',
  '@maildrill/voice': 'voice',
  '@maildrill/subscribers': 'subscribers',
  '@maildrill/campaigns': 'campaigns',
  '@maildrill/logic': 'clock',
  '@maildrill/data': 'code',
  '@maildrill/webhook': 'globe',
};

export default function Inspector({
  flow,
  pieces,
  selected,
  errors,
  onChange,
  onClose,
  onDuplicate,
  onDelete,
}: {
  flow: FlowDefinition;
  pieces: PieceMeta[];
  selected: string;
  /** Validation messages for this step. */
  errors: string[];
  onChange: (next: FlowDefinition) => void;
  onClose: () => void;
  /** Step actions live here too — this is where the cursor already is. */
  onDuplicate?: (stepName: string) => void;
  onDelete?: (stepName: string) => void;
}) {
  const isTrigger = flow.trigger.name === selected;
  const step = isTrigger
    ? flow.trigger
    : ([...allStepsOf(flow)].find((s) => s.name === selected) ?? null);

  const [picker, setPicker] = useState<null | { apply: (expression: string) => void }>(null);

  /*
   * `FlowTrigger` and `PieceStep` both carry `type: 'PIECE'`, so `step.type` alone cannot
   * narrow the union — position is what distinguishes them. `isTrigger` already holds that
   * answer, so it is used to pick the action branch before narrowing further.
   */
  const actionStep: FlowStep | null = isTrigger ? null : ((step as FlowStep | null) ?? null);
  const pieceStep = actionStep && actionStep.type === 'PIECE' ? actionStep : null;

  if (!step) {
    return (
      <aside className={styles.panel} aria-label="Step settings">
        <div className={styles.head}>
          <span>Step</span>
          <button type="button" className="kbtn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>
        <p className={styles.empty}>That step is gone.</p>
      </aside>
    );
  }

  const settings = step.settings as Record<string, unknown>;
  const pieceName = typeof settings.pieceName === 'string' ? settings.pieceName : null;
  const piece = pieces.find((p) => p.name === pieceName) ?? null;
  const definition = isTrigger
    ? (piece?.triggers.find((t) => t.name === settings.triggerName) ?? null)
    : (piece?.actions.find((a) => a.name === settings.actionName) ?? null);

  const inputValues = (isTrigger ? settings.input : (settings as { input?: unknown }).input) ?? {};
  const values = (inputValues ?? {}) as Record<string, unknown>;

  const setInput = (key: string, value: unknown) => {
    const nextValues = { ...values, [key]: value };
    onChange(
      isTrigger
        ? updateTrigger(flow, (trigger) => ({
            ...trigger,
            settings: {
              ...(trigger.settings as Record<string, unknown>),
              input: nextValues,
            } as never,
          }))
        : updateStep(flow, selected, (current) => {
            if (current.type !== 'PIECE') return current;
            current.settings = { ...current.settings, input: nextValues };
            return current;
          }),
    );
  };

  const rename = (displayName: string) => {
    onChange(
      isTrigger
        ? updateTrigger(flow, (trigger) => ({ ...trigger, displayName }))
        : updateStep(flow, selected, (current) => ({ ...current, displayName })),
    );
  };

  /*
   * Route each message to the field it is about.
   *
   * The validator phrases them as `"Subject" is required.`, so the quoted display name
   * identifies the prop. One amber block at the top listed three problems without saying
   * which control fixed which; anchored to the field, the message is the instruction.
   * Anything that names no field (branch and flow-level problems) still shows at the top.
   */
  const fieldErrors = new Map<string, string>();
  const panelErrors: string[] = [];
  for (const message of errors) {
    const quoted = /^"([^"]+)"/.exec(message)?.[1];
    const key = quoted
      ? Object.entries(definition?.props ?? {}).find(([, prop]) => prop.displayName === quoted)?.[0]
      : undefined;
    if (key) fieldErrors.set(key, message);
    else panelErrors.push(message);
  }

  const kindLabel = isTrigger ? 'Trigger' : (piece?.displayName ?? 'Step');
  const accent = `var(${definition?.accent ?? piece?.accent ?? '--text3'})`;
  const headIcon: IconName = isTrigger
    ? 'zap'
    : step.type === 'ROUTER'
      ? 'branch'
      : step.type === 'LOOP_ON_ITEMS'
        ? 'loop'
        : (PIECE_ICON[pieceName ?? ''] ?? 'zap');

  return (
    <aside className={styles.panel} aria-label="Step settings">
      {/*
        The header IS the step: icon, its name edited in place, and what kind of step it
        is. Previously this row said only "STEP" and the identity sat below it in a field
        called "Name on the canvas" — renaming is a rare action that was occupying the
        panel's most valuable row, above the configuration people actually came for.
      */}
      <div className={styles.head}>
        <span className={styles.headIcon} style={{ color: accent }}>
          <Icon name={headIcon} size={16} />
        </span>
        <span className={styles.headText}>
          <input
            className={styles.headName}
            value={step.displayName}
            aria-label={`${kindLabel} name`}
            onChange={(e) => rename(e.target.value)}
          />
          <span className={styles.headKind}>{kindLabel}</span>
        </span>
        {!isTrigger && onDuplicate ? (
          <button
            type="button"
            className={styles.headBtn}
            aria-label="Duplicate this step"
            title="Duplicate"
            onClick={() => onDuplicate(selected)}
          >
            <Icon name="copy" size={14} />
          </button>
        ) : null}
        {!isTrigger && onDelete ? (
          <button
            type="button"
            className={`${styles.headBtn} ${styles.headBtnDanger}`}
            aria-label="Delete this step"
            title="Delete"
            onClick={() => onDelete(selected)}
          >
            <Icon name="trash" size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className={styles.headBtn}
          aria-label="Close settings"
          onClick={onClose}
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className={styles.body}>
        {definition ? <p className={styles.about}>{definition.description}</p> : null}

        {panelErrors.length > 0 ? (
          <ul className={styles.errors}>
            {panelErrors.map((message) => (
              <li key={message}>
                <Icon name="alert-triangle" size={13} /> {message}
              </li>
            ))}
          </ul>
        ) : null}

        {step.type === 'ROUTER' ? (
          <RouterSettings
            flow={flow}
            step={step}
            onChange={onChange}
            onInsertData={(apply) => setPicker({ apply })}
          />
        ) : null}

        {step.type === 'LOOP_ON_ITEMS' ? (
          <div className={styles.field}>
            <label className={styles.labelWrap} htmlFor="loop-items">
              <span className={styles.label}>Repeat for each item in</span>
            </label>
            <ExpressionInput
              id="loop-items"
              label="Repeat for each item in"
              value={step.settings.items}
              placeholder="{{steps.find_orders.output.items}}"
              onChange={(next) =>
                onChange(
                  updateStep(flow, selected, (current) => {
                    if (current.type !== 'LOOP_ON_ITEMS') return current;
                    current.settings = { items: next };
                    return current;
                  }),
                )
              }
              onInsertData={(apply) => setPicker({ apply })}
            />
          </div>
        ) : null}

        {definition
          ? Object.entries(definition.props).map(([key, prop]) => (
              <PropField
                key={key}
                propKey={key}
                prop={prop}
                value={values[key]}
                error={fieldErrors.get(key)}
                onChange={(next) => setInput(key, next)}
                onInsertData={(apply) => setPicker({ apply })}
              />
            ))
          : null}

        {pieceStep ? (
          <div className={styles.advanced}>
            <div className={styles.checkbox}>
              <div className={styles.checkboxBody}>
                Carry on if this step fails
                <em>The run continues and the failure is recorded in the log.</em>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pieceStep.settings.errorHandling?.continueOnFailure ?? false}
                aria-label="Carry on if this step fails"
                className={`${styles.switch} ${pieceStep.settings.errorHandling?.continueOnFailure ? styles.isOn : ''}`}
                onClick={() =>
                  onChange(
                    updateStep(flow, selected, (current) => {
                      if (current.type !== 'PIECE') return current;
                      const next = !(current.settings.errorHandling?.continueOnFailure ?? false);
                      current.settings = {
                        ...current.settings,
                        errorHandling: {
                          ...current.settings.errorHandling,
                          continueOnFailure: next,
                        },
                      };
                      return current;
                    }),
                  )
                }
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
            <div className={styles.checkbox}>
              <div className={styles.checkboxBody}>
                Retry after a temporary failure
                <em>Timeouts and rate limits only; a rejected input is never retried.</em>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pieceStep.settings.errorHandling?.retryOnFailure !== false}
                aria-label="Retry after a temporary failure"
                className={`${styles.switch} ${pieceStep.settings.errorHandling?.retryOnFailure !== false ? styles.isOn : ''}`}
                onClick={() =>
                  onChange(
                    updateStep(flow, selected, (current) => {
                      if (current.type !== 'PIECE') return current;
                      const next = current.settings.errorHandling?.retryOnFailure === false;
                      current.settings = {
                        ...current.settings,
                        errorHandling: {
                          ...current.settings.errorHandling,
                          retryOnFailure: next,
                        },
                      };
                      return current;
                    }),
                  )
                }
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {picker ? (
        <div className={styles.pickerDock}>
          <DataPicker
            flow={flow}
            stepName={selected}
            pieces={pieces}
            onInsert={(expression) => {
              picker.apply(expression);
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        </div>
      ) : null}
    </aside>
  );
}

function allStepsOf(flow: FlowDefinition): FlowStep[] {
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

function RouterSettings({
  flow,
  step,
  onChange,
  onInsertData,
}: {
  flow: FlowDefinition;
  step: Extract<FlowStep, { type: 'ROUTER' }>;
  onChange: (next: FlowDefinition) => void;
  onInsertData: (apply: (expression: string) => void) => void;
}) {
  const setBranch = (
    index: number,
    patch: Partial<{ branchName: string; conditions: ConditionGroups }>,
  ) => {
    onChange(
      updateStep(flow, step.name, (current) => {
        if (current.type !== 'ROUTER') return current;
        const branch = current.settings.branches[index];
        if (branch) Object.assign(branch, patch);
        return current;
      }),
    );
  };

  return (
    <div className={styles.branches}>
      {step.settings.branches.map((branch, index) => (
        <div key={index} className={styles.branch}>
          <div className={styles.branchHead}>
            <input
              type="text"
              className={styles.branchName}
              value={branch.branchName}
              aria-label={`Name of path ${index + 1}`}
              onChange={(e) => setBranch(index, { branchName: e.target.value })}
            />
            {step.settings.branches.length > 1 ? (
              <button
                type="button"
                className="kbtn"
                aria-label={`Remove path ${branch.branchName}`}
                onClick={() => onChange(removeBranch(flow, step.name, index))}
              >
                <Icon name="trash" size={14} />
              </button>
            ) : null}
          </div>
          {branch.branchType === 'FALLBACK' ? (
            <p className={styles.fallbackNote}>Taken when none of the paths above match.</p>
          ) : (
            <ConditionEditor
              value={branch.conditions}
              onChange={(conditions) => setBranch(index, { conditions })}
              onInsertData={onInsertData}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        className={styles.addBranch}
        onClick={() => onChange(addBranch(flow, step.name))}
      >
        <Icon name="plus" size={13} /> Add a path
      </button>
    </div>
  );
}

/**
 * A text field with an "insert data" affordance.
 *
 * `id` and `describedBy` are threaded through rather than relying on a wrapping `<label>`:
 * the control is not the only child of its label (the insert button sits beside it), so
 * implicit association would be ambiguous — and, in practice, absent.
 */
function ExpressionInput({
  id,
  label,
  describedBy,
  invalid,
  value,
  placeholder,
  multiline,
  onChange,
  onInsertData,
}: {
  id: string;
  label: string;
  describedBy?: string;
  invalid?: boolean;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (next: string) => void;
  onInsertData: (apply: (expression: string) => void) => void;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  /** Insert at the caret, not at the end — people write around a token, not after it. */
  const insert = (expression: string) => {
    const element = ref.current;
    if (!element) {
      onChange(`${value}${expression}`);
      return;
    }
    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${expression}${value.slice(end)}`);
  };

  /*
   * "Insert data" sits INSIDE the control, not as a text link under it.
   *
   * It is the panel's most-used affordance — it is how you avoid typing expression syntax
   * by hand — and three of them stacked under three fields was the noisiest thing in the
   * panel while also separating each hint from the field it described. Inside the field it
   * reads as part of the control, and it matches the condition builder two sections down,
   * which already put it there.
   */
  return (
    <div className={`${styles.expression} ${multiline ? styles.expressionMultiline : ''}`}>
      {multiline ? (
        <textarea
          id={id}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          className={styles.textarea}
          rows={4}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          className={styles.input}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <button
        type="button"
        className={styles.insertBtn}
        aria-label={`Insert data into ${label}`}
        title="Insert data from an earlier step"
        onClick={() => onInsertData(insert)}
      >
        <Icon name="variable" size={14} />
      </button>
    </div>
  );
}

function PropField({
  propKey,
  prop,
  value,
  error,
  onChange,
  onInsertData,
}: {
  propKey: string;
  prop: PropMeta;
  value: unknown;
  /** Validation message for THIS field, rendered under its control. */
  error?: string;
  onChange: (next: unknown) => void;
  onInsertData: (apply: (expression: string) => void) => void;
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prop.type !== 'DYNAMIC_DROPDOWN' || !prop.source) return;
    let cancelled = false;
    setLoading(true);
    automationsApi
      .options(prop.source)
      .then((result) => {
        if (!cancelled) setOptions(result.data);
      })
      .catch(() => {
        // A failed lookup leaves the field as a free-text id rather than blocking the
        // whole inspector — the publish gate still catches a bad reference.
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prop.type, prop.source]);

  const text =
    typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  const fieldId = `prop-${propKey}`;
  const label = (
    <span className={styles.label}>
      {prop.displayName}
      {/* A marker, not a word: "Subscriber required" read as the label's own text. */}
      {prop.required ? (
        <abbr className={styles.required} title="Required">
          *
        </abbr>
      ) : null}
    </span>
  );

  const errorId = error ? `${propKey}-err` : undefined;
  const describedBy =
    [errorId, prop.description ? `${propKey}-desc` : null].filter(Boolean).join(' ') || undefined;
  /* The message replaces the hint rather than stacking on it: when a field is wrong, what
     to do about it is the only thing worth reading. */
  const description = error ? (
    <span id={errorId} className={styles.fieldError} role="alert">
      <Icon name="alert-triangle" size={12} />
      {error}
    </span>
  ) : prop.description ? (
    <span id={`${propKey}-desc`} className={styles.help}>
      {prop.description}
    </span>
  ) : null;
  const invalid = error ? true : undefined;

  switch (prop.type) {
    case 'CHECKBOX':
      return (
        <div className={styles.checkbox}>
          <div className={styles.checkboxBody}>
            {prop.displayName}
            {prop.description ? <em>{prop.description}</em> : null}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            aria-label={prop.displayName}
            className={`${styles.switch} ${value ? styles.isOn : ''}`}
            onClick={() => onChange(!value)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
      );

    case 'STATIC_DROPDOWN':
      return (
        <div className={styles.field}>
          <div className={styles.labelWrap}>{label}</div>
          <SelectMenu
            label={prop.displayName}
            value={text}
            options={(prop.options ?? []).map((option) => ({
              value: String(option.value),
              label: option.label,
            }))}
            describedBy={describedBy}
            invalid={invalid}
            onChange={(next) => onChange(next)}
          />
          {description}
        </div>
      );

    case 'DYNAMIC_DROPDOWN':
      return (
        <div className={styles.field}>
          <div className={styles.labelWrap}>{label}</div>
          <SelectMenu
            label={prop.displayName}
            value={text}
            options={options}
            placeholder={loading ? 'Loading…' : 'Choose…'}
            disabled={loading}
            describedBy={describedBy}
            invalid={invalid}
            onChange={(next) => onChange(next)}
          />
          {description}
        </div>
      );

    case 'NUMBER':
      return (
        <label className={styles.field}>
          {label}
          <input
            type="number"
            className={styles.input}
            value={text}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {description}
        </label>
      );

    case 'LONG_TEXT':
    case 'JSON':
    case 'OBJECT':
      return (
        <div className={styles.field}>
          <label className={styles.labelWrap} htmlFor={fieldId}>
            {label}
          </label>
          <ExpressionInput
            id={fieldId}
            label={prop.displayName}
            describedBy={describedBy}
            multiline
            invalid={invalid}
            value={text}
            placeholder={prop.placeholder}
            onChange={onChange}
            onInsertData={onInsertData}
          />
          {description}
        </div>
      );

    default:
      return (
        <div className={styles.field}>
          <label className={styles.labelWrap} htmlFor={fieldId}>
            {label}
          </label>
          <ExpressionInput
            id={fieldId}
            label={prop.displayName}
            describedBy={describedBy}
            invalid={invalid}
            value={text}
            placeholder={prop.placeholder}
            onChange={onChange}
            onInsertData={onInsertData}
          />
          {description}
        </div>
      );
  }
}
