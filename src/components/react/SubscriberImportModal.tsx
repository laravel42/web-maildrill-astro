import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { api, ApiError } from '@/lib/app/api';
import { normalizeKey, type CustomField } from '@/lib/app/custom-fields';
import {
  buildImportRows,
  guessTarget,
  isExcelFile,
  MAX_IMPORT_ROWS,
  parseSpreadsheet,
  type ImportRow,
  type MapTarget,
  type ParsedSheet,
} from '@/lib/app/subscriber-import';
import Icon from './Icon';
import { useEscapeClose } from './shared/useEscapeClose';
import styles from './SubscriberImportModal.module.css';

/** Server response for one imported batch. */
type BatchResult = {
  created: number;
  updated: number;
  failed: number;
  errors: { index: number; email: string; error: string }[];
};

const CHUNK = 500;
/** Targets a file can claim only once. */
const SINGLETONS: MapTarget[] = ['email', 'name', 'phone', 'status', 'tags'];
const SINGLETON_LABEL: Record<string, string> = {
  skip: 'Skip',
  email: 'Email',
  name: 'Name',
  phone: 'Phone',
  status: 'Status',
  tags: 'Tags',
};

type Step = 'pick' | 'map' | 'importing' | 'done';

type Props = {
  lists: { id: string; name: string }[];
  onClose: () => void;
  /** Fires after a finished import so the host can refetch and toast. */
  onDone: (summary: { created: number; updated: number; failed: number }) => void;
};

/**
 * Bulk import: CSV / TSV / Excel file → column-to-field mapping → chunked
 * upsert through `subscribers/import`. Mapping targets cover the built-in
 * fields, tags (stored as `attributes.tags`, like the subscriber editor),
 * existing custom fields, and creating a field from a column on the fly.
 */
export default function SubscriberImportModal({ lists, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState<ParsedSheet>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<MapTarget[]>([]);
  const [listId, setListId] = useState('');
  const [fields, setFields] = useState<CustomField[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BatchResult>({
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  });
  const [abortNote, setAbortNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importing = step === 'importing';
  useEscapeClose(() => {
    if (!importing) onClose();
  });

  useEffect(() => {
    void api
      .get<{ data: CustomField[] }>('custom-fields')
      .then((res) => setFields(res.data))
      .catch(() => undefined);
  }, []);

  const built = useMemo(() => buildImportRows(sheet, mapping), [sheet, mapping]);

  const acceptFile = async (file: File) => {
    setParseError(null);
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setParseError('No rows found in that file — the first line must be column headers.');
        return;
      }
      const taken = new Set<MapTarget>();
      const guessed = parsed.headers.map((h) => {
        const target = guessTarget(h, fields, taken);
        if (target !== 'skip') taken.add(target);
        return target;
      });
      setFileName(file.name);
      setSheet(parsed);
      setMapping(guessed);
      setStep('map');
    } catch {
      setParseError(
        isExcelFile(file)
          ? 'Could not read that Excel file — export it as .xlsx and try again.'
          : 'Could not read that file as CSV.',
      );
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void acceptFile(file);
  };

  /** Assign a column; singleton targets are stolen from any other column. */
  const assign = (col: number, target: MapTarget) => {
    setMapping((prev) =>
      prev.map((t, i) => {
        if (i === col) return target;
        return target !== 'skip' && t === target ? 'skip' : t;
      }),
    );
  };

  const sampleFor = (col: number): string =>
    sheet.rows
      .map((r) => r[col] ?? '')
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ');

  /** Options for one column's select, `new:` offered only when key is novel. */
  const optionsFor = (header: string) => {
    const key = normalizeKey(header);
    const novel = key !== '' && !fields.some((f) => f.key === key);
    return { key, novel };
  };

  const runImport = async () => {
    setStep('importing');
    setAbortNote(null);
    const total = built.rows.length;
    setProgress({ done: 0, total });

    try {
      // Columns mapped to "create field" become real defs before any rows land.
      const newKeys = [
        ...new Set(
          mapping.filter((t) => t.startsWith('new:')).map((t) => t.slice('new:'.length)),
        ),
      ];
      for (const key of newKeys) {
        await api.post('custom-fields', { key, type: 'text' }).catch((e: unknown) => {
          // An already-defined key is fine — values still land on it.
          if (!(e instanceof ApiError && e.status === 409)) throw e;
        });
      }

      // `new:` and `attr:` land identically once the def exists.
      const rows: ImportRow[] = built.rows;
      const sum: BatchResult = { created: 0, updated: 0, failed: 0, errors: [] };
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = await api.post<BatchResult>('subscribers/import', {
          rows: rows.slice(i, i + CHUNK),
          ...(listId ? { listId } : {}),
        });
        sum.created += batch.created;
        sum.updated += batch.updated;
        sum.failed += batch.failed;
        sum.errors = [...sum.errors, ...batch.errors].slice(0, 10);
        setResult({ ...sum });
        setProgress({ done: Math.min(i + CHUNK, rows.length), total });
      }
    } catch (e) {
      setAbortNote(
        e instanceof ApiError ? `Import stopped: ${e.message}` : 'Import stopped — network error.',
      );
    }
    setStep('done');
  };

  const finish = () => {
    onDone({ created: result.created, updated: result.updated, failed: result.failed });
  };

  return (
    <div className={styles.overlay} onClick={() => !importing && onClose()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Import subscribers"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.title}>Import subscribers</span>
          {!importing && (
            <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>

        <div className={styles.body}>
          {step === 'pick' && (
            <>
              <div
                className={`${styles.drop}${dragOver ? ` ${styles.dropActive}` : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <span className={styles.dropIcon} aria-hidden="true">
                  <Icon name="upload" size={22} />
                </span>
                Drop a CSV or Excel file here, or click to browse
                <span className={styles.dropHint}>
                  .csv, .tsv, .xlsx — first row must be column headers · up to{' '}
                  {MAX_IMPORT_ROWS.toLocaleString('en-US')} rows
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void acceptFile(file);
                  e.target.value = '';
                }}
              />
              {parseError && (
                <p className={styles.parseError} role="alert">
                  {parseError}
                </p>
              )}
            </>
          )}

          {step === 'map' && (
            <>
              <div className={styles.fileRow}>
                <Icon name="folder" size={14} />
                <span className={styles.fileName}>{fileName}</span>
                <span>· {sheet.rows.length.toLocaleString('en-US')} rows</span>
                <button type="button" className={styles.swapFile} onClick={() => setStep('pick')}>
                  Change file
                </button>
              </div>

              <div className={styles.optRow}>
                <label className={styles.optLabel} htmlFor="import-list">
                  Add everyone to
                </label>
                <select
                  id="import-list"
                  className={styles.select}
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                >
                  <option value="">No list — subscribers only</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.mapTable} role="table" aria-label="Column mapping">
                <div className={styles.mapHead} role="row">
                  <span>File column</span>
                  <span>Sample</span>
                  <span>Import as</span>
                </div>
                {sheet.headers.map((header, col) => {
                  const { key, novel } = optionsFor(header);
                  return (
                    <div key={`${header}-${col}`} className={styles.mapRow} role="row">
                      <span className={styles.colName}>{header}</span>
                      <span className={styles.sample}>{sampleFor(col) || '—'}</span>
                      <select
                        className={styles.select}
                        aria-label={`Import “${header}” as`}
                        value={mapping[col]}
                        onChange={(e) => assign(col, e.target.value as MapTarget)}
                      >
                        {SINGLETONS.concat('skip' as MapTarget).map((t) => (
                          <option key={t} value={t}>
                            {SINGLETON_LABEL[t]}
                          </option>
                        ))}
                        {fields.map((f) => (
                          <option key={f.id} value={`attr:${f.key}`}>
                            Field: {f.label}
                          </option>
                        ))}
                        {novel && <option value={`new:${key}`}>New field “{key}”</option>}
                      </select>
                    </div>
                  );
                })}
              </div>

              <p
                className={`${styles.readout}${built.invalid.length ? ` ${styles.readoutWarn}` : ''}`}
              >
                {mapping.includes('email')
                  ? `${built.rows.length.toLocaleString('en-US')} rows ready` +
                    (built.invalid.length
                      ? ` · ${built.invalid.length} invalid email${built.invalid.length === 1 ? '' : 's'} will be skipped (first on line ${built.invalid[0]!.line})`
                      : '') +
                    (built.emptySkipped ? ` · ${built.emptySkipped} empty lines ignored` : '')
                  : 'Map one column to Email to continue.'}
              </p>
            </>
          )}

          {(step === 'importing' || step === 'done') && (
            <>
              {step === 'importing' && (
                <div className={styles.progressWrap}>
                  <div className={styles.progressLabel}>
                    <span>Importing…</span>
                    <span>
                      {progress.done.toLocaleString('en-US')} /{' '}
                      {progress.total.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {step === 'done' && (
                <>
                  <div className={styles.summary}>
                    <div className={styles.sumCell}>
                      <span className={styles.sumNum}>
                        {result.created.toLocaleString('en-US')}
                      </span>
                      <span className={styles.sumLbl}>added</span>
                    </div>
                    <div className={styles.sumCell}>
                      <span className={styles.sumNum}>
                        {result.updated.toLocaleString('en-US')}
                      </span>
                      <span className={styles.sumLbl}>updated</span>
                    </div>
                    <div className={styles.sumCell}>
                      <span className={styles.sumNum}>
                        {(result.failed + built.invalid.length).toLocaleString('en-US')}
                      </span>
                      <span className={styles.sumLbl}>skipped</span>
                    </div>
                  </div>
                  {abortNote && (
                    <p className={styles.parseError} role="alert">
                      {abortNote}
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <ul className={styles.errList}>
                      {result.errors.map((err) => (
                        <li key={`${err.index}-${err.email}`}>
                          <span className={styles.errWho}>{err.email}</span>
                          <span className={styles.errWhy}>{err.error}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className={styles.foot}>
          {step === 'map' && (
            <span className={styles.footNote}>
              Existing subscribers are updated, never duplicated.
            </span>
          )}
          {!importing && step !== 'done' && (
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
          )}
          {step === 'map' && (
            <button
              type="button"
              className={styles.primary}
              disabled={!mapping.includes('email') || built.rows.length === 0}
              onClick={() => void runImport()}
            >
              Import {built.rows.length.toLocaleString('en-US')} subscriber
              {built.rows.length === 1 ? '' : 's'}
            </button>
          )}
          {step === 'done' && (
            <button type="button" className={styles.primary} onClick={finish}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
