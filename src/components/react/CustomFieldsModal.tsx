import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import Modal from './shared/Modal';
import { api, ApiError } from '@/lib/app/api';
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  normalizeKey,
  type CustomField,
  type FieldType,
} from '@/lib/app/custom-fields';
import styles from './CustomFieldsModal.module.css';

/**
 * Custom fields editor — the centered modal opened from the Lists page header.
 *
 * The catalogue is workspace-wide (see lib/app/custom-fields): values live in
 * one flat `subscribers.attributes` bag, so adding or removing a field here
 * affects every list. Add/remove stage locally; Save persists the diff to the
 * database.
 *
 * `live` is false in the fixture preview, where there is no workspace to read
 * from; the modal then starts empty and keeps edits local.
 */
export default function CustomFieldsModal({
  live,
  onToast,
  onClose,
}: {
  live: boolean;
  onToast: (m: string) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<CustomField[]>([]);
  /** Server snapshot at load — used to compute create/delete on Save. */
  const [baseline, setBaseline] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(live);
  const [loadError, setLoadError] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState<FieldType>('text');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<{ data: CustomField[] }>('custom-fields');
        if (!alive) return;
        const data = res.data ?? [];
        setFields(data);
        setBaseline(data);
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [live]);

  const key = normalizeKey(keyDraft);
  const duplicate = key.length > 0 && fields.some((f) => f.key === key);
  const canStage = key.length > 0 && !duplicate && !busy;

  const dirty = useMemo(() => {
    if (canStage) return true;
    if (fields.length !== baseline.length) return true;
    const baseIds = new Set(baseline.map((f) => f.id));
    return (
      fields.some((f) => !baseIds.has(f.id)) ||
      baseline.some((f) => !fields.some((x) => x.id === f.id))
    );
  }, [fields, baseline, canStage]);

  const stageField = () => {
    if (!canStage) return;
    const created: CustomField = {
      id: `local:${key}`,
      key,
      label: key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      type: typeDraft,
      createdAt: new Date().toISOString(),
    };
    setFields((prev) => [...prev, created].sort((a, b) => a.key.localeCompare(b.key)));
    setKeyDraft('');
    setTypeDraft('text');
  };

  const removeField = (f: CustomField) => {
    if (busy) return;
    setFields((prev) => prev.filter((x) => x.id !== f.id));
  };

  const save = async () => {
    if (busy) return;

    // Include an unstaged draft in this save when the key is valid.
    let next = fields;
    if (canStage) {
      const staged: CustomField = {
        id: `local:${key}`,
        key,
        label: key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
        type: typeDraft,
        createdAt: new Date().toISOString(),
      };
      next = [...fields, staged].sort((a, b) => a.key.localeCompare(b.key));
      setFields(next);
      setKeyDraft('');
      setTypeDraft('text');
    }

    if (!live) {
      onToast(dirty || canStage ? 'Custom fields updated' : 'No changes');
      onClose();
      return;
    }

    const baseById = new Map(baseline.map((f) => [f.id, f]));
    const nextIds = new Set(next.map((f) => f.id));
    const toDelete = baseline.filter((f) => !nextIds.has(f.id));
    const toCreate = next.filter((f) => !baseById.has(f.id));

    if (toDelete.length === 0 && toCreate.length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      for (const f of toDelete) {
        await api.del(`custom-fields/${f.id}`);
      }
      const created: CustomField[] = [];
      for (const f of toCreate) {
        const row = await api.post<CustomField>('custom-fields', { key: f.key, type: f.type });
        created.push(row);
      }
      const kept = next.filter((f) => baseById.has(f.id));
      const saved = [...kept, ...created].sort((a, b) => a.key.localeCompare(b.key));
      setFields(saved);
      setBaseline(saved);
      const parts: string[] = [];
      if (created.length) parts.push(`added ${created.length}`);
      if (toDelete.length) parts.push(`removed ${toDelete.length}`);
      onToast(`Custom fields saved (${parts.join(', ')})`);
      onClose();
    } catch (e) {
      onToast(
        e instanceof ApiError && e.status === 409
          ? 'A field with that key already exists.'
          : e instanceof ApiError
            ? e.message
            : 'Could not save custom fields',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Custom fields" panelClassName={styles.cfm}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.title}>Custom fields</span>
          <span className={styles.scope}>Shared across all lists</span>
        </div>
        <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className={styles.body}>
          {loading ? (
            <div className="aempty">Loading fields…</div>
          ) : loadError ? (
            <div className="aempty">Could not load custom fields</div>
          ) : fields.length === 0 ? (
            <div className="aempty">No custom fields defined yet</div>
          ) : (
            <div className={styles.rows}>
              {fields.map((f) => (
                <div key={f.id} className={styles.row}>
                  <code className={styles.key}>{f.key}</code>
                  <span className={styles.type}>{FIELD_TYPE_LABEL[f.type]}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    title={`Remove ${f.key}`}
                    aria-label={`Remove field ${f.key}`}
                    disabled={busy}
                    onClick={() => removeField(f)}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.add}>
            <div className={styles.addRow}>
              <input
                className={styles.input}
                value={keyDraft}
                placeholder="field_key"
                aria-label="New field key"
                disabled={busy}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') stageField();
                }}
              />
              <button
                type="button"
                className={styles.addBtn}
                disabled={!canStage}
                onClick={stageField}
              >
                Add field
              </button>
            </div>
            <div className={styles.chips}>
              {FIELD_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.chip}${t === typeDraft ? ` ${styles.chipOn}` : ''}`}
                  aria-pressed={t === typeDraft}
                  disabled={busy}
                  onClick={() => setTypeDraft(t)}
                >
                  {FIELD_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            {duplicate && <div className={styles.warn}>A field with that key already exists.</div>}
            {/* Typing "First Name" silently becomes first_name — show it before saving. */}
            {!duplicate && key.length > 0 && key !== keyDraft.trim() && (
              <div className={styles.hint}>
                Will be saved as <code>{key}</code>
              </div>
            )}
          </div>
      </div>

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.done}
          onClick={() => void save()}
          disabled={busy || loading || loadError}
        >
          <Icon name="save" size={14} stroke={2} />
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
