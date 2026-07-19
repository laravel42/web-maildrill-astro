import { useEffect, useState } from 'react';
import type { SubscriberStatus } from '@/types/app';
import Icon from './Icon';

/*
 * Subscriber editor — the centered "Add subscriber / Edit profile" modal
 * (App.dc.html §ADD SUBSCRIBER). Client-side only; hands edited values to the
 * parent via `onSave`. The parent gates mounting, so this renders open.
 */

export type SubscriberEditorValues = {
  email: string;
  name: string;
  status: SubscriberStatus;
  list: string;
  tags: string[];
};

const STATUS_OPTS: { value: SubscriberStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
];

// Deterministic tag chip color from a small palette (no Math.random at render).
const TAG_TONES = [
  { bg: 'var(--accent-tint)', color: '#4f46e5' },
  { bg: '#e7f6ec', color: '#15803d' },
  { bg: '#fef3c7', color: '#b45309' },
  { bg: '#fce7f3', color: '#be185d' },
];
const toneFor = (tag: string) => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_TONES[h % TAG_TONES.length];
};

type Props = {
  mode: 'create' | 'edit';
  initialEmail?: string;
  initialName?: string;
  initialStatus?: SubscriberStatus;
  initialList?: string;
  initialTags?: string[];
  lists?: string[];
  onClose: () => void;
  onSave: (values: SubscriberEditorValues) => void;
};

export default function SubscriberEditorModal({
  mode,
  initialEmail = '',
  initialName = '',
  initialStatus = 'active',
  initialList,
  initialTags = [],
  lists = ['Newsletter', 'VIP customers', 'Recent buyers'],
  onClose,
  onSave,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<SubscriberStatus>(initialStatus);
  const [list, setList] = useState(initialList ?? lists[0] ?? '');
  const [tags, setTags] = useState<string[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
    onSave({ email: email.trim(), name: name.trim(), status, list, tags });
  };

  return (
    <div className="sem-overlay" onClick={onClose}>
      <div
        className="sem"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit profile' : 'Add subscriber'}
      >
        <div className="sem__head">
          <span className="sem__title">{isEdit ? 'Edit profile' : 'Add subscriber'}</span>
          <button type="button" className="sem__x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="sem__body">
          <label className="sem__label" htmlFor="sem-email">
            Email address
          </label>
          <input
            id="sem-email"
            type="email"
            className="sem__input"
            value={email}
            autoFocus={!isEdit}
            placeholder="name@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="sem__label" htmlFor="sem-name">
            Full name <span className="sem__opt">(optional)</span>
          </label>
          <input
            id="sem-name"
            className="sem__input"
            value={name}
            placeholder="Jane Doe"
            onChange={(e) => setName(e.target.value)}
          />

          <div className="sem__grid">
            <div>
              <label className="sem__label" htmlFor="sem-list">
                Add to list
              </label>
              <select
                id="sem-list"
                className="sem__input sem__select"
                value={list}
                onChange={(e) => setList(e.target.value)}
              >
                {lists.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="sem__label" htmlFor="sem-status">
                  Status
                </label>
                <select
                  id="sem-status"
                  className="sem__input sem__select"
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

          <label className="sem__label">Tags</label>
          <div className="sem__tags">
            {tags.map((t) => {
              const tone = toneFor(t);
              return (
                <span key={t} className="sem__tag" style={{ background: tone.bg, color: tone.color }}>
                  {t}
                  <button
                    type="button"
                    className="sem__tagx"
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
                className="sem__taginput"
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
              <button type="button" className="sem__addtag" onClick={() => setAdding(true)}>
                + Add tag
              </button>
            )}
          </div>
        </div>

        <div className="sem__foot">
          <button type="button" className="sem__cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sem__save" onClick={submit} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Add subscriber'}
          </button>
        </div>

        <style>{`
          .sem-overlay {
            position: fixed; inset: 0; z-index: var(--z-modal);
            background: rgba(28,25,23,.4); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center; padding: 32px;
            animation: ovfade .18s var(--ease-out);
          }
          .sem {
            width: 460px; max-width: 100%; background: var(--surface); border-radius: 20px;
            box-shadow: 0 24px 60px rgba(28,25,23,.28); overflow: hidden; animation: pop .18s ease;
          }
          .sem__head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 22px; border-bottom: 1px solid var(--divider);
          }
          .sem__title { font-weight: 600; font-size: 15px; }
          .sem__x {
            width: 30px; height: 30px; border: none; background: var(--surface2);
            border-radius: 9px; cursor: pointer; color: var(--text4);
            display: flex; align-items: center; justify-content: center;
          }
          .sem__x:hover { color: var(--text2); background: var(--border2); }
          .sem__body { padding: 22px; }
          .sem__label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 6px; color: var(--text2); }
          .sem__opt { color: var(--muted); font-weight: 400; }
          .sem__input {
            width: 100%; border: 1px solid var(--border2); border-radius: 10px;
            padding: 10px 12px; font-size: 13.5px; color: var(--text); background: transparent;
            margin-bottom: 18px; font-family: inherit;
            transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
          }
          .sem__input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
          .sem__select { appearance: none; cursor: pointer; background-image: none; }
          .sem__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .sem__grid > div { min-width: 0; }
          .sem__tags { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
          .sem__tag {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 6px 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600;
          }
          .sem__tagx {
            display: inline-flex; align-items: center; justify-content: center;
            border: none; background: none; cursor: pointer; color: inherit; opacity: .7; padding: 0;
          }
          .sem__tagx:hover { opacity: 1; }
          .sem__addtag {
            padding: 5px 10px; border: 1px dashed var(--muted2); border-radius: 20px;
            font-size: 11.5px; color: var(--muted); background: none; cursor: pointer;
          }
          .sem__addtag:hover { color: var(--accent); border-color: var(--accent); }
          .sem__taginput {
            border: 1px solid var(--accent); border-radius: 20px; padding: 4px 10px;
            font-size: 11.5px; width: 110px; background: transparent; color: var(--text); outline: none;
          }
          .sem__foot {
            display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px;
            border-top: 1px solid var(--divider); background: var(--surface2);
          }
          .sem__cancel, .sem__save { padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; }
          .sem__cancel { background: var(--surface); border: 1px solid var(--border2); color: var(--text2); }
          .sem__cancel:hover { background: var(--surface2); }
          .sem__save {
            background: var(--accent); color: #fff; border: none; padding: 9px 18px;
            box-shadow: 0 1px 2px rgba(79,70,229,.35), inset 0 1px 0 rgba(255,255,255,.16);
          }
          .sem__save:disabled { opacity: .55; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
