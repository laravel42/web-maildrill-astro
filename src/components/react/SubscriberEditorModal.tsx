import { useState } from 'react';
import type { SubscriberStatus } from '@/types/app';
import Icon from './Icon';
import PhoneField from './PhoneField';
import { useEscapeClose } from './shared/useEscapeClose';
import { toneFor } from './SubscriberEditorModal.logic';
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
  /** Lists the subscriber already belongs to, when editing. */
  initialListIds?: string[];
  initialTags?: string[];
  /** Real workspace lists; the values saved are list ids. */
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
  initialListIds = [],
  initialTags = [],
  lists = [],
  onClose,
  onSave,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  // Status isn't edited here; it's carried through unchanged so a save doesn't
  // reset the subscriber's current status.
  const [status] = useState<SubscriberStatus>(initialStatus);
  const [listIds, setListIds] = useState<string[]>(initialListIds);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState('');

  useEscapeClose(onClose);

  const isEdit = mode === 'edit';
  const canSave = /.+@.+\..+/.test(email.trim());

  const toggleList = (id: string) =>
    setListIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      style={{ animation: 'ovfade .18s var(--ease-out)' }}
    >
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
          {lists.length === 0 ? (
            <p className={styles.listempty}>No lists yet — create one first.</p>
          ) : (
            <div className={styles.listpick} role="group" aria-label="Add to lists">
              {lists.map((l) => {
                const on = listIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`${styles.listchip}${on ? ` ${styles.listchipOn}` : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleList(l.id)}
                  >
                    {on && <Icon name="check" size={12} stroke={3.5} />}
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}

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
      </div>
    </div>
  );
}
