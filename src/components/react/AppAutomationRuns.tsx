import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import TimeAgo from './shared/TimeAgo';
import { routes } from '@/config/routes';
import { ApiError } from '@/lib/app/api';
import {
  automationsApi,
  formatDuration,
  isRunSettled,
  RUN_STATUS_LABEL,
  runStatusChipClass,
  type RunRow,
  type RunStatus,
  type StepRunRow,
} from '@/lib/app/automations';
import styles from './AppAutomationRuns.module.css';

/**
 * Run history and the execution inspector.
 *
 * The inspector is the thing that makes automations debuggable: for every run it shows the
 * steps in execution order with timings, and for every step the input it received, the
 * output it produced, and the error that stopped it. Secrets are masked upstream, at the
 * point the journal is written, so nothing sensitive can arrive here to be redacted.
 */

const STATUS_FILTERS: { value: RunStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'running', label: 'Running' },
];

const PAGE_SIZE = 25;
const LIVE_POLL_MS = 4000;

export default function AppAutomationRuns({
  automationId,
  automationName,
  initial,
  initialTotal = 0,
}: {
  automationId: string;
  automationName: string;
  initial?: RunRow[];
  initialTotal?: number;
}) {
  const [rows, setRows] = useState<RunRow[]>(initial ?? []);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState<RunStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [openRun, setOpenRun] = useState<{ run: RunRow; steps: StepRunRow[] } | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await automationsApi.runs(automationId, {
        status: status === 'all' ? undefined : status,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load runs.');
    }
  }, [automationId, status, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the list live only while something is actually in flight — a finished history
  // does not need polling, and this page can be left open all day.
  const hasLive = useMemo(() => rows.some((row) => !isRunSettled(row.status)), [rows]);
  useEffect(() => {
    if (!hasLive) return;
    const timer = window.setInterval(() => void refresh(), LIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasLive, refresh]);

  const open = async (row: RunRow) => {
    try {
      setOpenRun(await automationsApi.run(row.id));
      setOpenStep(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that run.');
    }
  };

  const cancel = async (row: RunRow) => {
    try {
      await automationsApi.cancelRun(row.id);
      await refresh();
      if (openRun?.run.id === row.id) setOpenRun(await automationsApi.run(row.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel that run.');
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="screen screen--capped">
      <div className="screen__head">
        <div>
          <a className={styles.back} href={routes.app.automation(automationId)}>
            <Icon name="arrow-right" size={14} className={styles.backIcon} />
            {automationName}
          </a>
          <h1 className="screen__h1">Runs</h1>
          <p className="screen__sub">
            Every execution, in order, with what each step received and produced.
          </p>
        </div>
        <a className="sbtn" href={routes.app.automation(automationId)}>
          <Icon name="edit" size={14} /> Edit automation
        </a>
      </div>

      {error ? (
        <div className={styles.banner} role="status">
          {error}
        </div>
      ) : null}

      <div className="atable">
        <div className={styles.toolbar}>
          <div className="aseg" role="tablist" aria-label="Filter runs by status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={status === filter.value}
                className={`aseg__opt ${status === filter.value ? 'is-active' : ''}`}
                onClick={() => {
                  setPage(0);
                  setStatus(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`athead ${styles.grid}`}>
          <div>Started</div>
          <div>Status</div>
          <div>Source</div>
          <div className={styles.numeric}>Steps</div>
          <div>Duration</div>
          <div />
        </div>

        {rows.length === 0 ? (
          <div className="atable__empty">
            No runs yet. Publish the automation and it will show up here the first time its trigger
            fires.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={`atrow ${styles.grid} ${openRun?.run.id === row.id ? 'is-selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => void open(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void open(row);
                }
              }}
            >
              <div>
                <TimeAgo at={row.startedAt ?? row.createdAt} />
              </div>
              <div>
                <span className={`astatus ${runStatusChipClass(row.status)}`}>
                  {RUN_STATUS_LABEL[row.status]}
                </span>
              </div>
              <div className={styles.muted}>{row.source}</div>
              <div className={`${styles.numeric} tnum`}>{row.stepsExecuted}</div>
              <div className={styles.muted}>
                {row.completedAt && row.startedAt
                  ? formatDuration(
                      new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime(),
                    )
                  : row.status === 'waiting'
                    ? 'Waiting'
                    : '—'}
              </div>
              <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                {!isRunSettled(row.status) ? (
                  <button type="button" className="sbtn" onClick={() => void cancel(row)}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}

        {total > PAGE_SIZE ? (
          <div className="atable__foot">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <span className={styles.pager}>
              <button
                type="button"
                className="sbtn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="sbtn"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </span>
          </div>
        ) : null}
      </div>

      {openRun ? (
        <div className="adrawer-overlay" role="dialog" aria-modal="true" aria-label="Run details">
          <div className="adrawer">
            <div className="adrawer__head">
              <div>
                <span className="adrawer__eyebrow">Run</span>
                <div className="adrawer__title">
                  <span className={`astatus ${runStatusChipClass(openRun.run.status)}`}>
                    {RUN_STATUS_LABEL[openRun.run.status]}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="kbtn"
                aria-label="Close run details"
                onClick={() => setOpenRun(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="adrawer__body">
              <div className="adetail">
                <span className="adetail__k">Started</span>
                <span className="adetail__v">
                  <TimeAgo at={openRun.run.startedAt ?? openRun.run.createdAt} />
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Source</span>
                <span className="adetail__v">{openRun.run.source}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Steps executed</span>
                <span className="adetail__v tnum">{openRun.run.stepsExecuted}</span>
              </div>
              {openRun.run.resumeAt ? (
                <div className="adetail">
                  <span className="adetail__k">Continues</span>
                  <span className="adetail__v">
                    {new Date(openRun.run.resumeAt).toLocaleString()}
                  </span>
                </div>
              ) : null}

              {openRun.run.error?.message ? (
                <p className={styles.runError}>
                  <Icon name="alert-triangle" size={14} />
                  <span>
                    <strong>
                      {openRun.run.error.stepName ? `${openRun.run.error.stepName}: ` : ''}
                    </strong>
                    {openRun.run.error.message}
                  </span>
                </p>
              ) : null}

              <h3 className={styles.stepsTitle}>Steps</h3>
              <ol className={styles.steps}>
                {openRun.steps.map((step) => (
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
                      {step.attempt > 1 ? (
                        <span className={styles.attempt}>attempt {step.attempt}</span>
                      ) : null}
                      <span className={styles.stepTime}>{formatDuration(step.durationMs)}</span>
                    </button>
                    {openStep === step.id ? (
                      <div className={styles.detail}>
                        {step.errorMessage ? (
                          <section>
                            <h4>Error</h4>
                            <pre className={styles.errorPre}>
                              {step.errorMessage}
                              {step.errorCategory ? `\n(${step.errorCategory})` : ''}
                            </pre>
                          </section>
                        ) : null}
                        <section>
                          <h4>Input</h4>
                          <pre>{JSON.stringify(step.input ?? null, null, 2)}</pre>
                        </section>
                        <section>
                          <h4>Output</h4>
                          <pre>{JSON.stringify(step.output ?? null, null, 2)}</pre>
                        </section>
                        <section>
                          <h4>Timing</h4>
                          <pre>
                            {`started  ${step.startedAt}\nfinished ${step.completedAt ?? '—'}\nduration ${formatDuration(step.durationMs)}`}
                          </pre>
                        </section>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>

              <h3 className={styles.stepsTitle}>Trigger payload</h3>
              <pre className={styles.payload}>
                {JSON.stringify(openRun.run.triggerPayload ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
