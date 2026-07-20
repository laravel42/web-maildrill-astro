import { useEffect, useState } from 'react';
import Icon from './Icon';
import { api, ApiError } from '@/lib/app/api';
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  normalizeKey,
  type CustomField,
  type FieldType,
} from '@/lib/app/custom-fields';
import styles from './ListCustomFields.module.css';

/**
 * The "Custom fields" section of the list drawer.
 *
 * The catalogue is workspace-wide (see lib/app/custom-fields), so the section
 * says so rather than letting it read as a per-list setting — removing a field
 * here affects every list.
 *
 * `live` is false in the fixture preview, where there is no workspace to read
 * from; the section then renders nothing rather than showing invented fields.
 */
export default function ListCustomFields({
  live,
  onToast,
}: {
  live: boolean;
  onToast: (m: string) => void;
}) {
  const [fields, setFields] = useState<CustomField[]>([]);
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
        if (alive) setFields(res.data);
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

  if (!live) return null;

  const key = normalizeKey(keyDraft);
  const duplicate = key.length > 0 && fields.some((f) => f.key === key);
  const canAdd = key.length > 0 && !duplicate && !busy;

  const addField = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      const created = await api.post<CustomField>('custom-fields', { key, type: typeDraft });
      setFields((prev) => [...prev, created].sort((a, b) => a.key.localeCompare(b.key)));
      setKeyDraft('');
      setTypeDraft('text');
      onToast(`Added field “${created.key}”`);
    } catch (e) {
      onToast(
        e instanceof ApiError && e.status === 409
          ? 'A field with that key already exists.'
          : 'Could not add the field',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeField = async (f: CustomField) => {
    setBusy(true);
    try {
      await api.del(`custom-fields/${f.id}`);
      setFields((prev) => prev.filter((x) => x.id !== f.id));
      onToast(`Removed field “${f.key}”`);
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : 'Could not remove the field');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.head}>
        <span className="adrawer__eyebrow">Custom fields</span>
        <span className={styles.scope}>Shared across all lists</span>
      </div>

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
                onClick={() => void removeField(f)}
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
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addField();
            }}
          />
          <button
            type="button"
            className={styles.addBtn}
            disabled={!canAdd}
            onClick={() => void addField()}
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
    </>
  );
}
