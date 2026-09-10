import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import Modal from '../shared/Modal';
import { ApiError } from '@/lib/app/api';
import {
  automationsApi,
  formatDuration,
  isRunSettled,
  RUN_STATUS_LABEL,
  runStatusChipClass,
  type AutomationDetail,
  type PieceMeta,
  type RunRow,
  type StepRunRow,
} from '@/lib/app/automations';
import type { FlowDefinition } from '@/lib/app/automation-flow';
import styles from './TestPanel.module.css';

/**
 * Test a draft before publishing it.
 *
 * Two things make this safe to hand to a marketer:
 *  - it runs the DRAFT, not the published version, so testing an edit does not require
 *    publishing it first; and
 *  - it runs in dry-run mode by default, so a send step reports what it *would* send. The
 *    switch to a real send is explicit and labelled, because the alternative is discovering
 *    the difference by mailing a customer.
 *
 * Progress is polled rather than streamed. Runs finish in well under a second in the common
 * case, the run row is already the source of truth, and a websocket for this alone would be
 * infrastructure the product does not otherwise need.
 */
const POLL_MS = 700;
const MAX_POLLS = 90;

export default function TestPanel({
  automation,
  flow,
  pieces,
  onClose,
  onBeforeRun,
  onProgress,
}: {
  automation: AutomationDetail;
  flow: FlowDefinition;
  pieces: PieceMeta[];
  onClose: () => void;
  /** Flush the autosave so the run executes what is on screen. */
  onBeforeRun: () => Promise<void>;
  /**
   * Per-step status, pushed to the canvas so progress is visible on the nodes themselves
   * and not only in this panel — the brief's "show execution progress live".
   */
  onProgress: (statuses: Record<string, StepRunRow['status']>) => void;
}) {
  const samplePayload = useMemo(() => {
    const settings = flow.trigger.settings as { pieceName?: string; triggerName?: string };
    const meta = pieces
      .find((p) => p.name === settings.pieceName)
      ?.triggers.find((t) => t.name === settings.triggerName);
    return JSON.stringify(meta?.samplePayload ?? {}, null, 2);
  }, [flow.trigger.settings, pieces]);

  const [payload, setPayload] = useState(samplePayload);
  const [dryRun, setDryRun] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunRow | null>(null);
  const [steps, setSteps] = useState<StepRunRow[]>([]);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    },
    [],
  );

  const poll = useCallback(
    (runId: string, attempt = 0) => {
      automationsApi
        .run(runId)
        .then((result) => {
          setRun(result.run);
          setSteps(result.steps);
          onProgress(Object.fromEntries(result.steps.map((step) => [step.stepName, step.status])));
          // `waiting` is terminal for this panel: the run is parked on a Wait and will
          // continue days from now. Saying so beats spinning forever.
          if (isRunSettled(result.run.status) || result.run.status === 'waiting') return;
          if (attempt >= MAX_POLLS) return;
          pollRef.current = window.setTimeout(() => poll(runId, attempt + 1), POLL_MS);
        })
        .catch(() => {
          setError('Lost track of the run. Open the run history to see how it finished.');
        });
    },
    [onProgress],
  );

  const start = async () => {
    setError(null);
    setRun(null);
    setSteps([]);
    onProgress({});
    setStarting(true);
    try {
      let parsed: Record<string, unknown> = {};
      if (payload.trim()) {
        const value: unknown = JSON.parse(payload);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new SyntaxError('The test payload has to be a JSON object.');
        }
        parsed = value as Record<string, unknown>;
      }
      await onBeforeRun();
      const { runId } = await automationsApi.test(automation.id, parsed, dryRun);
      poll(runId);
    } catch (err) {
      if (err instanceof SyntaxError) setError(err.message || 'That is not valid JSON.');
      else if (err instanceof ApiError && err.status === 422) {
        setError('Fix the highlighted steps before testing.');
      } else setError(err instanceof ApiError ? err.message : 'Could not start the test run.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Test this automation"
      overlayClassName={styles.overlay}
      panelClassName={styles.panel}
    >
      <header className={styles.head}>
        <h2>Test this automation</h2>
        <button type="button" className="kbtn" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </header>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>Trigger payload</span>
            <textarea
              className={styles.textarea}
              rows={8}
              spellCheck={false}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
            <span className={styles.help}>
              This is what <code>{'{{trigger}}'}</code> resolves to. It is pre-filled with the
              trigger’s example data.
            </span>
          </label>

          <label className={styles.toggle}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            <span>
              Dry run
              <em>
                {dryRun
                  ? 'Sends are described, not delivered. Nothing reaches a real subscriber.'
                  : 'Careful: sends will really go out to whoever the payload names.'}
              </em>
            </span>
          </label>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <button type="button" className="pbtn" onClick={() => void start()} disabled={starting}>
            <Icon name="play" size={14} />
            {starting ? 'Starting…' : 'Run test'}
          </button>

          {run ? (
            <div className={styles.result}>
              <div className={styles.resultHead}>
                <span className={`astatus ${runStatusChipClass(run.status)}`}>
                  {RUN_STATUS_LABEL[run.status]}
                </span>
                {run.status === 'waiting' ? (
                  <span className={styles.waitingNote}>
                    Parked on a Wait — it will carry on
                    {run.resumeAt ? ` at ${new Date(run.resumeAt).toLocaleString()}` : ' later'}.
                  </span>
                ) : null}
              </div>

              <ol className={styles.steps}>
                {steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={styles.stepRow}
                      aria-expanded={openStep === step.id}
                      onClick={() => setOpenStep(openStep === step.id ? null : step.id)}
                    >
                      <span className={`${styles.mark} ${styles[`mark_${step.status}`]}`}>
                        <Icon
                          name={
                            step.status === 'succeeded'
                              ? 'check'
                              : step.status === 'failed'
                                ? 'x'
                                : step.status === 'paused'
                                  ? 'clock'
                                  : 'minus'
                          }
                          size={12}
                        />
                      </span>
                      <span className={styles.stepName}>{step.displayName}</span>
                      <span className={styles.stepTime}>{formatDuration(step.durationMs)}</span>
                    </button>
                    {openStep === step.id ? (
                      <div className={styles.detail}>
                        {step.errorMessage ? (
                          <div className={styles.detailBlock}>
                            <h4>Error</h4>
                            <pre className={styles.errorPre}>{step.errorMessage}</pre>
                          </div>
                        ) : null}
                        <div className={styles.detailBlock}>
                          <h4>Input</h4>
                          <pre>{JSON.stringify(step.input ?? null, null, 2)}</pre>
                        </div>
                        <div className={styles.detailBlock}>
                          <h4>Output</h4>
                          <pre>{JSON.stringify(step.output ?? null, null, 2)}</pre>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>

              {run.error?.message ? (
                <p className={styles.runError}>
                  <Icon name="alert-triangle" size={14} /> {run.error.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
    </Modal>
  );
}
