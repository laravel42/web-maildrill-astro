import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { SubscriberStatus } from '@/types/app';
import Icon from './Icon';
import PhoneField from './PhoneField';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  buildImportRows,
  guessMapping,
  IMPORT_ACCEPT,
  isIgnoredImportHeader,
  newFieldKeys,
  parseImportFile,
  type ImportTarget,
  type ParsedSheet,
  type SubscriberImportOutcome,
  type SubscriberImportPayload,
} from '@/lib/app/subscriber-import';
import { normalizeKey } from '@/lib/app/custom-fields';
import { toneFor } from './SubscriberEditorModal.logic';
import type { SubscriberEditorValues } from './SubscriberEditorModal.types';
import styles from './SubscriberEditorModal.module.css';

/*
 * Subscriber editor. Edit mode stays the centered profile form
 * (App.dc.html §ADD SUBSCRIBER). Create mode is a multistep wizard:
 *
 *   method ─┬─ details                  (add one person by hand)
 *           └─ file → mapping → summary (CSV/Excel/Numbers import with
 *                                        column mapping + bulk upsert)
 *
 * Client-side only; single adds go to `onSave`, file imports to `onImport`.
 * The parent gates mounting, so this renders open.
 */

export type { SubscriberEditorValues } from './SubscriberEditorModal.types';
export type { SubscriberImportOutcome, SubscriberImportPayload };

type Step = 'method' | 'details' | 'file' | 'mapping' | 'summary';

type Props = {
  mode: 'create' | 'edit';
  initialEmail?: string;
  initialPhone?: string;
  initialName?: string;
  initialStatus?: SubscriberStatus;
  /** Lists the subscriber already belongs to, when editing. */
  initialListIds?: string[];
  initialTags?: string[];
  /** Real workspace lists; the values saved are list ids. */
  lists?: { id: string; name: string }[];
  /** Workspace custom-field keys, offered as file-column targets. */
  customFieldKeys?: string[];
  onClose: () => void;
  onSave: (values: SubscriberEditorValues) => void;
  /** Runs the bulk import (create mode); resolves with the outcome counts. */
  onImport?: (payload: SubscriberImportPayload) => Promise<SubscriberImportOutcome>;
  /** Create-mode start step — `file` opens the importer without the method picker. */
  initialStep?: Step;
  /** Lists pre-checked on the import mapping step. */
  initialImportListIds?: string[];
  /** Hide the list picker — the caller already chose the destination list. */
  hideImportLists?: boolean;
};

/** Serialize an ImportTarget for a <select> value. */
const targetValue = (t: ImportTarget): string =>
  t.kind === 'attribute' ? `attr:${t.key}` : t.kind === 'newAttribute' ? `new:${t.key}` : t.kind;
const parseTargetValue = (v: string): ImportTarget =>
  v.startsWith('attr:')
    ? { kind: 'attribute', key: v.slice(5) }
    : v.startsWith('new:')
      ? { kind: 'newAttribute', key: v.slice(4) }
      : ({ kind: v } as ImportTarget);

const STEP_TITLES: Record<Step, string> = {
  method: 'Add subscribers',
  details: 'Add subscriber',
  file: 'Import from a file',
  mapping: 'Map columns',
  summary: 'Review import',
};

export default function SubscriberEditorModal({
  mode,
  initialEmail = '',
  initialPhone = '',
  initialName = '',
  initialStatus = 'active',
  initialListIds = [],
  initialTags = [],
  lists = [],
  customFieldKeys = [],
  onClose,
  onSave,
  onImport,
  initialStep,
  initialImportListIds = [],
  hideImportLists = false,
}: Props) {
  const isEdit = mode === 'edit';
  const [step, setStep] = useState<Step>(isEdit ? 'details' : (initialStep ?? 'method'));

  /* ------------------------------ single form ------------------------------ */
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  // Status isn't edited here; it's carried through unchanged so a save doesn't
  // reset the subscriber's current status.
  const [status] = useState<SubscriberStatus>(initialStatus);
  const [listIds, setListIds] = useState<string[]>(initialListIds);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState('');

  /* ------------------------------ file import ------------------------------ */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ImportTarget[]>([]);
  const [importListIds, setImportListIds] = useState<string[]>(initialImportListIds);
  const [importPhase, setImportPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [importResult, setImportResult] = useState<SubscriberImportOutcome | null>(null);

  useEscapeClose(onClose);

  const canSave = /.+@.+\..+/.test(email.trim());
  const toggleIn = (setter: typeof setListIds) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleList = toggleIn(setListIds);
  const toggleImportList = toggleIn(setImportListIds);

  const addTag = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setTags((s) => [...s, t]);
    }
    setDraft('');
  };
  const removeTag = (t: string) => setTags((s) => s.filter((x) => x !== t));

  const submit = () => {
    if (!canSave) return;
    onSave({ email: email.trim(), phone: phone.trim(), name: name.trim(), status, listIds, tags });
  };

  const acceptFile = async (file: File) => {
    setFileError(null);
    setParsing(true);
    try {
      const parsed = await parseImportFile(file);
      setSheet(parsed);
      setFileName(file.name);
      setMapping(guessMapping(parsed.headers, customFieldKeys));
      setStep('mapping');
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      setParsing(false);
    }
  };

  /** Single-valued targets move to the newly chosen column. */
  const setColumnTarget = (col: number, next: ImportTarget) => {
    setMapping((prev) =>
      prev.map((t, i) => {
        if (i === col) return next;
        if (
          (next.kind === 'email' || next.kind === 'name' || next.kind === 'phone') &&
          t.kind === next.kind
        ) {
          return { kind: 'skip' };
        }
        return t;
      }),
    );
  };

  const emailMapped = mapping.some((t) => t.kind === 'email');
  const built = useMemo(
    () => (sheet && emailMapped ? buildImportRows(sheet, mapping) : null),
    [sheet, mapping, emailMapped],
  );

  const runImport = async () => {
    if (!onImport || !built || built.rows.length === 0) return;
    setImportPhase('running');
    try {
      const res = await onImport({
        rows: built.rows,
        listIds: importListIds,
        newFields: newFieldKeys(mapping),
      });
      setImportResult(res);
      setImportPhase('done');
    } catch {
      setImportPhase('error');
    }
  };

  /** First non-empty cell per column, for the mapping preview. */
  const sampleFor = (col: number): string => {
    if (!sheet) return '';
    for (const row of sheet.rows.slice(0, 50)) {
      const v = (row[col] ?? '').trim();
      if (v) return v;
    }
    return '';
  };

  const back: Partial<Record<Step, Step>> = {
    details: 'method',
    file: 'method',
    mapping: 'file',
    summary: 'mapping',
  };
  const showBack = !isEdit && step !== 'method' && importPhase !== 'done';
  const wide = step === 'mapping' || step === 'summary';

  const listPicker = (selected: string[], toggle: (id: string) => void, groupLabel: string) =>
    lists.length === 0 ? (
      <p className={styles.listempty}>No lists yet — create one first.</p>
    ) : (
      <div className={styles.listpick} role="group" aria-label={groupLabel}>
        {lists.map((l) => {
          const on = selected.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              className={`${styles.listchip}${on ? ` ${styles.listchipOn}` : ''}`}
              aria-pressed={on}
              onClick={() => toggle(l.id)}
            >
              {on && <Icon name="check" size={12} stroke={3.5} />}
              {l.name}
            </button>
          );
        })}
      </div>
    );

  /* --------------------------------- steps --------------------------------- */

  const methodStep: ReactNode = (
    <div className={styles.body}>
      <button type="button" className={styles.method} onClick={() => setStep('details')}>
        <span className={styles.methodIc} style={{ background: 'var(--accent-tint)' }}>
          <Icon name="user" size={17} />
        </span>
        <span className={styles.methodText}>
          <span className={styles.methodTitle}>Add one person</span>
          <span className={styles.methodDesc}>Enter an email, name, and phone by hand.</span>
        </span>
        <Icon name="chevron-right" size={15} className={styles.methodGo} />
      </button>
      <button type="button" className={styles.method} onClick={() => setStep('file')}>
        <span className={styles.methodIc} style={{ background: 'var(--success-bg)' }}>
          <Icon name="upload" size={17} />
        </span>
        <span className={styles.methodText}>
          <span className={styles.methodTitle}>Import from a file</span>
          <span className={styles.methodDesc}>
            CSV, Excel, or Numbers — map columns, import in bulk.
          </span>
        </span>
        <Icon name="chevron-right" size={15} className={styles.methodGo} />
      </button>
    </div>
  );

  const detailsStep: ReactNode = (
    <>
      <div className={styles.body}>
        <label className={styles.label} htmlFor="sem-email">
          Email address
        </label>
        <input
          id="sem-email"
          type="email"
          className={styles.input}
          value={email}
          autoFocus={!isEdit}
          placeholder="name@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className={styles.label} htmlFor="sem-name">
          Full name <span className={styles.opt}>(optional)</span>
        </label>
        <input
          id="sem-name"
          className={styles.input}
          value={name}
          placeholder="Jane Doe"
          onChange={(e) => setName(e.target.value)}
        />

        <label className={styles.label} htmlFor="sem-phone">
          Phone <span className={styles.opt}>(optional)</span>
        </label>
        {/* Addressing field for SMS/WhatsApp/Voice, the same way email is for
            email. Guided country + national-number input; the value handed to
            onSave is E.164 (or empty). */}
        <div className={styles.phoneField}>
          <PhoneField
            name="sem-phone"
            defaultValue={initialPhone || null}
            onValueChange={setPhone}
            compact
          />
        </div>

        <label className={styles.label}>
          Add to lists <span className={styles.opt}>(optional)</span>
        </label>
        {listPicker(listIds, toggleList, 'Add to lists')}

        <label className={styles.label}>Tags</label>
        <div className={styles.tags}>
          {tags.map((t) => {
            const tone = toneFor(t);
            return (
              <span
                key={t}
                className={styles.tag}
                style={{ background: tone.bg, color: tone.color }}
              >
                {t}
                <button
                  type="button"
                  className={styles.tagx}
                  aria-label={`Remove ${t}`}
                  onClick={() => removeTag(t)}
                >
                  <Icon name="x" size={14} stroke={3} />
                </button>
              </span>
            );
          })}
          <input
            className={styles.taginput}
            value={draft}
            placeholder="Add tag…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            aria-label="Add tag"
          />
        </div>
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.save} onClick={submit} disabled={!canSave}>
          {isEdit ? 'Save changes' : 'Add subscriber'}
        </button>
      </div>
    </>
  );

  const fileStep: ReactNode = (
    <div className={styles.body}>
      <button
        type="button"
        className={`${styles.drop}${dragOver ? ` ${styles.dropOver}` : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void acceptFile(file);
        }}
        disabled={parsing}
      >
        <span className={styles.dropIc}>
          <Icon name="upload" size={18} />
        </span>
        <span className={styles.dropTitle}>
          {parsing ? 'Reading file…' : 'Drop a file here, or browse'}
        </span>
        <span className={styles.dropDesc}>.csv, .xls, .xlsx, or .numbers — up to 5,000 rows</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void acceptFile(file);
        }}
      />
      {fileError && (
        <p className={styles.fileError} role="alert">
          {fileError}
        </p>
      )}
      <p className={styles.fileHint}>
        The first row is used as column headers. You'll map columns to subscriber fields next —
        nothing imports until you confirm.
      </p>
    </div>
  );

  const mappingStep: ReactNode = sheet && (
    <>
      <div className={styles.body}>
        <p className={styles.mapIntro}>
          <strong>{fileName}</strong> · {sheet.rows.length.toLocaleString('en-US')}{' '}
          {sheet.rows.length === 1 ? 'row' : 'rows'}. Map each column to a field — at least one
          column must be the email address.
        </p>
        <div className={styles.mapTable} role="group" aria-label="Column mapping">
          <div className={`${styles.mapRow} ${styles.mapHead}`}>
            <span>File column</span>
            <span>Sample</span>
            <span>Imports as</span>
          </div>
          {sheet.headers.map((h, col) => {
            if (isIgnoredImportHeader(h)) return null;
            const novel = normalizeKey(h);
            return (
              <div key={`${h}-${col}`} className={styles.mapRow}>
                <span className={styles.mapCol}>{h}</span>
                <span className={styles.mapSample}>{sampleFor(col) || '—'}</span>
                <select
                  className={styles.mapSelect}
                  value={targetValue(mapping[col] ?? { kind: 'skip' })}
                  aria-label={`Field for column ${h}`}
                  onChange={(e) => setColumnTarget(col, parseTargetValue(e.target.value))}
                >
                  <option value="email">Email address</option>
                  <option value="name">Full name</option>
                  <option value="phone">Phone</option>
                  <option value="tags">Tags</option>
                  <option value="status">Subscription status</option>
                  {customFieldKeys.map((k) => (
                    <option key={k} value={`attr:${k}`}>
                      Custom · {k}
                    </option>
                  ))}
                  {novel && !customFieldKeys.includes(novel) && (
                    <option value={`new:${novel}`}>New custom field “{novel}”</option>
                  )}
                  <option value="skip">Don't import</option>
                </select>
              </div>
            );
          })}
        </div>

        {!hideImportLists && (
          <>
            <label className={styles.label} style={{ marginTop: 18 }}>
              Add everyone to lists <span className={styles.opt}>(optional)</span>
            </label>
            {listPicker(importListIds, toggleImportList, 'Add everyone to lists')}
          </>
        )}
        {!emailMapped && (
          <p className={styles.mapWarn}>Map a column to “Email address” to continue.</p>
        )}
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.cancel} onClick={() => setStep('file')}>
          Back
        </button>
        <button
          type="button"
          className={styles.save}
          disabled={!emailMapped || !built || built.rows.length === 0}
          onClick={() => setStep('summary')}
        >
          Continue
        </button>
      </div>
    </>
  );

  const summaryStep: ReactNode = built && (
    <>
      <div className={styles.body}>
        {importPhase === 'done' && importResult ? (
          <div className={styles.result}>
            <span className={styles.resultIc}>
              <Icon name="check-circle" size={22} />
            </span>
            <p className={styles.resultTitle}>
              {(importResult.created + importResult.updated).toLocaleString('en-US')}{' '}
              {importResult.created + importResult.updated === 1 ? 'subscriber' : 'subscribers'}{' '}
              imported
            </p>
            <p className={styles.resultNote}>
              {importResult.created.toLocaleString('en-US')} added ·{' '}
              {importResult.updated.toLocaleString('en-US')} updated
            </p>
            {importResult.failed > 0 && (
              <p className={styles.resultNote}>
                {importResult.failed.toLocaleString('en-US')}{' '}
                {importResult.failed === 1 ? 'row' : 'rows'} failed and{' '}
                {importResult.failed === 1 ? 'was' : 'were'} left out.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className={styles.sumGrid}>
              <div className={styles.sumCell}>
                <span className={styles.sumVal}>{built.rows.length.toLocaleString('en-US')}</span>
                <span className={styles.sumLbl}>ready to import</span>
              </div>
              <div className={styles.sumCell}>
                <span className={styles.sumVal}>{built.skipped.toLocaleString('en-US')}</span>
                <span className={styles.sumLbl}>skipped (no valid email)</span>
              </div>
              <div className={styles.sumCell}>
                <span className={styles.sumVal}>{importListIds.length}</span>
                <span className={styles.sumLbl}>
                  {importListIds.length === 1 ? 'list joined' : 'lists joined'}
                </span>
              </div>
            </div>
            <p className={styles.fileHint}>
              Existing subscribers (same email) are updated, never duplicated — new details merge
              into their profile.
            </p>
            {importPhase === 'error' && (
              <p className={styles.fileError} role="alert">
                The import failed — nothing may have been saved. Try again.
              </p>
            )}
          </>
        )}
      </div>
      <div className={styles.foot}>
        {importPhase === 'done' ? (
          <button type="button" className={styles.save} onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setStep('mapping')}
              disabled={importPhase === 'running'}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.save}
              onClick={() => void runImport()}
              disabled={importPhase === 'running' || !onImport}
            >
              {importPhase === 'running'
                ? 'Importing…'
                : `Import ${built.rows.length.toLocaleString('en-US')}`}
            </button>
          </>
        )}
      </div>
    </>
  );

  const stepBody: Record<Step, ReactNode> = {
    method: methodStep,
    details: detailsStep,
    file: fileStep,
    mapping: mappingStep,
    summary: summaryStep,
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      style={{ animation: 'ovfade .18s var(--ease-out)' }}
    >
      <div
        className={`${styles.sem}${wide ? ` ${styles.semWide}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit profile' : STEP_TITLES[step]}
        style={{ animation: 'pop .18s ease' }}
      >
        <div className={styles.head}>
          <span className={styles.headLead}>
            {showBack && (
              <button
                type="button"
                className={styles.back}
                aria-label="Back"
                onClick={() => setStep(back[step] ?? 'method')}
              >
                <Icon name="chevron-right" size={15} className={styles.flip} />
              </button>
            )}
            <span className={styles.title}>{isEdit ? 'Edit profile' : STEP_TITLES[step]}</span>
          </span>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        {isEdit ? detailsStep : stepBody[step]}
      </div>
    </div>
  );
}
