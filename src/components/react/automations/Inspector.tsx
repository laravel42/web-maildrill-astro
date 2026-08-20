import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
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
export default function Inspector({
  flow,
  pieces,
  selected,
  errors,
  onChange,
  onClose,
}: {
  flow: FlowDefinition;
  pieces: PieceMeta[];
  selected: string;
  /** Validation messages for this step. */
  errors: string[];
  onChange: (next: FlowDefinition) => void;
  onClose: () => void;
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

  return (
    <aside className={styles.panel} aria-label="Step settings">
      <div className={styles.head}>
        <span className={styles.headTitle}>{isTrigger ? 'Trigger' : 'Step'}</span>
        <button type="button" className="kbtn" aria-label="Close settings" onClick={onClose}>
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>Name on the canvas</span>
          <input
            type="text"
            className={styles.input}
            value={step.displayName}
            onChange={(e) => rename(e.target.value)}
          />
        </label>

        {definition ? <p className={styles.about}>{definition.description}</p> : null}

        {errors.length > 0 ? (
          <ul className={styles.errors}>
            {errors.map((message) => (
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
                onChange={(next) => setInput(key, next)}
                onInsertData={(apply) => setPicker({ apply })}
              />
            ))
          : null}

        {pieceStep ? (
          <details className={styles.advanced}>
            <summary>Advanced</summary>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={pieceStep.settings.errorHandling?.continueOnFailure ?? false}
                onChange={(e) =>
                  onChange(
                    updateStep(flow, selected, (current) => {
                      if (current.type !== 'PIECE') return current;
                      current.settings = {
                        ...current.settings,
                        errorHandling: {
                          ...current.settings.errorHandling,
                          continueOnFailure: e.target.checked,
                        },
                      };
                      return current;
                    }),
                  )
                }
              />
              <span>
                Carry on if this step fails
                <em>The run continues and the failure is recorded in the log.</em>
              </span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={pieceStep.settings.errorHandling?.retryOnFailure !== false}
                onChange={(e) =>
                  onChange(
                    updateStep(flow, selected, (current) => {
                      if (current.type !== 'PIECE') return current;
                      current.settings = {
                        ...current.settings,
                        errorHandling: {
                          ...current.settings.errorHandling,
                          retryOnFailure: e.target.checked,
                        },
                      };
                      return current;
                    }),
                  )
                }
              />
              <span>
                Retry after a temporary failure
                <em>Timeouts and rate limits only; a rejected input is never retried.</em>
              </span>
            </label>
          </details>
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
  value,
  placeholder,
  multiline,
  onChange,
  onInsertData,
}: {
  id: string;
  label: string;
  describedBy?: string;
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

  return (
    <div className={styles.expression}>
      {multiline ? (
        <textarea
          id={id}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          className={styles.textarea}
          rows={4}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
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
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <button
        type="button"
        className={styles.insertBtn}
        aria-label={`Insert data into ${label}`}
        onClick={() => onInsertData(insert)}
      >
        <Icon name="variable" size={13} /> Insert data
      </button>
    </div>
  );
}

function PropField({
  propKey,
  prop,
  value,
  onChange,
  onInsertData,
}: {
  propKey: string;
  prop: PropMeta;
  value: unknown;
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
      {prop.required ? <em className={styles.required}> required</em> : null}
    </span>
  );

  const describedBy = prop.description ? `${propKey}-desc` : undefined;
  const description = prop.description ? (
    <span id={describedBy} className={styles.help}>
      {prop.description}
    </span>
  ) : null;

  switch (prop.type) {
    case 'CHECKBOX':
      return (
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {prop.displayName}
            {prop.description ? <em>{prop.description}</em> : null}
          </span>
        </label>
      );

    case 'STATIC_DROPDOWN':
      return (
        <label className={styles.field}>
          {label}
          <select
            className={styles.input}
            value={text}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Choose…</option>
            {(prop.options ?? []).map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
          {description}
        </label>
      );

    case 'DYNAMIC_DROPDOWN':
      return (
        <label className={styles.field}>
          {label}
          <select
            className={styles.input}
            value={text}
            disabled={loading}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{loading ? 'Loading…' : 'Choose…'}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {description}
        </label>
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
