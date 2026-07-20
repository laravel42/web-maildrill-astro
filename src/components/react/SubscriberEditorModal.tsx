import { useState } from 'react';
import type { SubscriberStatus } from '@/types/app';
import Icon from './Icon';
import { useEscapeClose } from './shared/useEscapeClose';
import { STATUS_OPTS, toneFor } from './SubscriberEditorModal.logic';
import type { SubscriberEditorValues } from './SubscriberEditorModal.types';
import styles from './SubscriberEditorModal.module.css';

/*
 * Subscriber editor — the centered "Add subscriber / Edit profile" modal
 * (App.dc.html §ADD SUBSCRIBER). Client-side only; hands edited values to the
 * parent via `onSave`. The parent gates mounting, so this renders open.
 */

export type { SubscriberEditorValues } from './SubscriberEditorModal.types';

type Props = {
  mode: 'create' | 'edit';
  initialEmail?: string;
  initialPhone?: string;
  initialName?: string;
  initialStatus?: SubscriberStatus;
  /** Currently selected list id, when editing. */
  initialList?: string;
  initialTags?: string[];
  /** Real workspace lists; the value saved is the list id. */
  lists?: { id: string; name: string }[];
  onClose: () => void;
  onSave: (values: SubscriberEditorValues) => void;
};

export default function SubscriberEditorModal({
  mode,
  initialEmail = '',
  initialPhone = '',
  initialName = '',
  initialStatus = 'active',
  initialList,
  initialTags = [],
  lists = [],
  onClose,
  onSave,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<SubscriberStatus>(initialStatus);
  const [list, setList] = useState(initialList ?? '');
  const [tags, setTags] = useState<string[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEscapeClose(onClose);

  const isEdit = mode === 'edit';
  const canSave = /.+@.+\..+/.test(email.trim());

  const addTag = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) setTags((s) => [...s, t]);
    setDraft('');
    setAdding(false);
  };
  const removeTag = (t: string) => setTags((s) => s.filter((x) => x !== t));

  const submit = () => {
    if (!canSave) return;
    onSave({ email: email.trim(), phone: phone.trim(), name: name.trim(), status, list, tags });
  };

  return (
    <div className={styles.overlay} onClick={onClose} style={{ animation: 'ovfade .18s var(--ease-out)' }}>
      <div
        className={styles.sem}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit profile' : 'Add subscriber'}
        style={{ animation: 'pop .18s ease' }}
      >
        <div className={styles.head}>
          <span className={styles.title}>{isEdit ? 'Edit profile' : 'Add subscriber'}</span>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

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
              email. Kept permissive: numbers vary too much to validate here. */}
          <input
            id="sem-phone"
            type="tel"
            className={styles.input}
            value={phone}
            placeholder="+1 555 123 4567"
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className={styles.grid}>
            <div>
              <label className={styles.label} htmlFor="sem-list">
                Add to list
              </label>
              <select
                id="sem-list"
                className={`${styles.input} ${styles.select}`}
                value={list}
                onChange={(e) => setList(e.target.value)}
              >
                <option value="">No list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className={styles.label} htmlFor="sem-status">
                  Status
                </label>
                <select
                  id="sem-status"
                  className={`${styles.input} ${styles.select}`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SubscriberStatus)}
                >
                  {STATUS_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className={styles.label}>Tags</label>
          <div className={styles.tags}>
            {tags.map((t) => {
              const tone = toneFor(t);
              return (
                <span key={t} className={styles.tag} style={{ background: tone.bg, color: tone.color }}>
                  {t}
                  <button
                    type="button"
                    className={styles.tagx}
                    aria-label={`Remove ${t}`}
                    onClick={() => removeTag(t)}
                  >
                    <Icon name="x" size={11} stroke={2.6} />
                  </button>
                </span>
              );
            })}
            {adding ? (
              <input
                className={styles.taginput}
                value={draft}
                autoFocus
                placeholder="Tag name"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={addTag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTag();
                  if (e.key === 'Escape') {
                    setDraft('');
                    setAdding(false);
                  }
                }}
              />
            ) : (
              <button type="button" className={styles.addtag} onClick={() => setAdding(true)}>
                + Add tag
              </button>
            )}
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
      </div>
    </div>
  );
}
