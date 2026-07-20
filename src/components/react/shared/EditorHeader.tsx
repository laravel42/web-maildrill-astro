import { useRef, useState, type ChangeEvent } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from '../Icon';
import { CHANNEL } from './channels';
import styles from './EditorHeader.module.css';

export type SaveStatus = 'idle' | 'saving' | 'saved';

type Props = {
  channel: ChannelType;
  name: string;
  onNameChange: (value: string) => void;
  kind?: 'template' | 'campaign';
  /** Autosave indicator state. */
  status?: SaveStatus;
  /** Optional category picker — omit `categories` to hide it (e.g. campaigns). */
  category?: string;
  categories?: readonly string[];
  onCategoryChange?: (value: string) => void;
  onBack: () => void;
  onSendTest: () => void;
  onSaveDraft: () => void;
};

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: 'Draft',
  saving: 'Saving…',
  saved: 'Autosaved',
};

function BackArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * Shared editor header used by both the visual email editor and the SMS/
 * WhatsApp/Voice composer so they read as one product: back, channel icon,
 * an editable name, the draft crumb + autosave status, and Send test /
 * Save draft actions.
 */
export default function EditorHeader({
  channel,
  name,
  onNameChange,
  kind = 'template',
  status = 'idle',
  category,
  categories,
  onCategoryChange,
  onBack,
  onSendTest,
  onSaveDraft,
}: Props) {
  const meta = CHANNEL[channel];
  const section = kind === 'campaign' ? 'Campaigns' : 'Templates';
  const placeholder = kind === 'campaign' ? 'Untitled campaign' : 'Untitled template';
  // Name the thing being saved. "Save draft" said nothing about what it was,
  // and this header is shared with the campaign editor.
  const saveLabel = kind === 'campaign' ? 'Save campaign' : 'Save template';
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /* An unnamed template is unfindable in the gallery, so saving is blocked
     rather than silently filed as "Untitled". */
  const handleSave = () => {
    if (!name.trim()) {
      setNameError(`Give this ${kind} a name before saving.`);
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    onSaveDraft();
  };

  return (
    <header className={styles.head}>
      <div className={styles.left}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
          <BackArrow />
        </button>
        <span className={styles.chanic} style={{ color: meta.color }}>
          <Icon name={meta.icon} size={14} stroke={2} />
        </span>
        <div className={styles.titlecol}>
          <input
            ref={nameRef}
            className={`${styles.name}${nameError ? ` ${styles.nameInvalid}` : ''}`}
            value={name}
            aria-invalid={nameError ? true : undefined}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (nameError) setNameError(null);
              onNameChange(e.target.value);
            }}
            placeholder={placeholder}
            aria-label={`${section} name`}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <div className={styles.crumb}>
            {section} / {status === 'saved' ? 'Saved' : 'Draft'}
          </div>
          {nameError && (
            <div className={styles.error} role="alert">
              {nameError}
            </div>
          )}
        </div>

        {categories && onCategoryChange && (
          /* Radio group rather than a select: with four options the choices are
             worth showing, and native radios give arrow-key navigation and
             screen-reader semantics for free — the pills are the labels. */
          <div className={styles.categories} role="radiogroup" aria-label="Category">
            {categories.map((c) => (
              <label key={c} className={styles.pill}>
                <input
                  type="radio"
                  name="editor-category"
                  className={styles.pillInput}
                  value={c}
                  checked={(category ?? categories[0]) === c}
                  onChange={() => onCategoryChange(c)}
                />
                <span className={styles.pillLabel}>{c}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.status} role="status">
          <span className={`${styles.dot} ${status === 'saving' ? styles.dotSaving : ''}`} />
          {STATUS_LABEL[status]}
        </span>
        <button type="button" className={styles.sbtn} onClick={onSendTest}>
          <Icon name="send" size={14} />
          Send test
        </button>
        <button type="button" className={`${styles.sbtn} ${styles.primary}`} onClick={handleSave}>
          <Icon name="check" size={14} stroke={2.6} />
          {saveLabel}
        </button>
      </div>
    </header>
  );
}
