import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { api } from '@/lib/app/api';
import Icon from '../Icon';
import { useEscapeClose } from './useEscapeClose';
import styles from './SendTestModal.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPLIT_RE = /[\s,;]+/;
const MAX_RECIPIENTS = 10;

/** Just enough of GET /me to prefill the tester's own address. */
type MePrefill = { user: { email: string } };

type Props = {
  onClose: () => void;
  /** Queue the test for these recipients; a rejection message shows inline. */
  onSend: (to: string[]) => Promise<void>;
};

/**
 * Recipient picker for email template test sends: a tag-style field taking one
 * or more addresses, prefilled with the signed-in user's own.
 */
export default function SendTestModal({ onClose, onSend }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Once the user edits the field, the prefill must never overwrite it. */
  const touched = useRef(false);
  useEscapeClose(onClose);

  useEffect(() => {
    let alive = true;
    void api
      .get<MePrefill>('me')
      .then((me) => {
        if (!alive || touched.current || !me.user.email) return;
        setTags((prev) => (prev.length ? prev : [me.user.email]));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /** Commit raw input into tags; returns the updated list or null on error. */
  const commit = (raw: string): string[] | null => {
    const parts = raw
      .split(SPLIT_RE)
      .map((s) => s.trim())
      .filter(Boolean);
    const bad = parts.find((p) => !EMAIL_RE.test(p));
    if (bad) {
      setError(`“${bad}” is not a valid email address.`);
      return null;
    }
    const next = [...new Set([...tags, ...parts])].slice(0, MAX_RECIPIENTS);
    setTags(next);
    setDraft('');
    setError(null);
    return next;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    touched.current = true;
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === 'Backspace' && !draft) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    touched.current = true;
    const text = e.clipboardData.getData('text');
    if (SPLIT_RE.test(text)) {
      e.preventDefault();
      commit(`${draft} ${text}`);
    }
  };

  const submit = async () => {
    if (busy) return;
    const list = draft.trim() ? commit(draft) : tags;
    if (!list) return;
    if (list.length === 0) {
      setError('Add at least one email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSend(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send test');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Send test email"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.title}>Send test email</span>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={styles.body}>
          <label className={styles.label} htmlFor="send-test-to">
            Send to
          </label>
          <div className={styles.field} onClick={() => inputRef.current?.focus()}>
            {tags.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
                <button
                  type="button"
                  className={styles.tagX}
                  aria-label={`Remove ${t}`}
                  onClick={() => {
                    touched.current = true;
                    setTags((prev) => prev.filter((x) => x !== t));
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id="send-test-to"
              className={styles.input}
              autoFocus
              placeholder={tags.length ? '' : 'name@company.com'}
              value={draft}
              disabled={busy}
              onChange={(e) => {
                touched.current = true;
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : (
            <p className={styles.help}>One or more addresses — press Enter after each.</p>
          )}
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.send}
            disabled={busy || (tags.length === 0 && !draft.trim())}
            onClick={() => void submit()}
          >
            {busy
              ? 'Sending…'
              : tags.length > 1
                ? `Send to ${tags.length} recipients`
                : 'Send test'}
          </button>
        </div>
      </div>
    </div>
  );
}
