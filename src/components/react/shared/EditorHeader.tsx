import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from '../Icon';
import { CHANNEL } from './channels';
import styles from './EditorHeader.module.css';

export type SaveStatus = 'idle' | 'saving' | 'saved';

export type LanguageOption = { code: string; label: string };

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
  /** Categories rendered but not selectable, flagged as coming soon. */
  unavailableCategories?: readonly string[];
  onCategoryChange?: (value: string) => void;
  /** Optional language picker — suffix on the title field (templates). */
  language?: string;
  languageOptions?: readonly LanguageOption[];
  onLanguageChange?: (value: string) => void;
  /** Square flag image URL for a language code. */
  getLanguageFlagSrc?: (code: string) => string;
  onBack: () => void;
  /** Sends a real test message to the signed-in user; button hidden when omitted. */
  onSendTest?: () => void;
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

function LanguagePicker({
  value,
  options,
  onChange,
  getFlagSrc,
}: {
  value: string;
  options: readonly LanguageOption[];
  onChange: (code: string) => void;
  getFlagSrc?: (code: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedCode = value || options[0]?.code;
  const selected = options.find((o) => o.code === selectedCode) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!selected) return null;

  return (
    <div className={styles.languageWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.languageTrigger}
        aria-label={`Template language, ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {getFlagSrc && (
          <img
            className={styles.languageFlag}
            src={getFlagSrc(selected.code)}
            alt=""
            decoding="async"
          />
        )}
        <span className={styles.languageLabel}>{selected.label}</span>
        <Icon name="chevron-down" size={12} className={styles.languageCaret} />
      </button>
      {open && (
        <ul className={styles.languageMenu} role="listbox" aria-label="Template language">
          {options.map((option) => (
            <li key={option.code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.code === selected.code}
                className={`${styles.languageOption}${option.code === selected.code ? ` ${styles.languageOptionActive}` : ''}`}
                onClick={() => {
                  onChange(option.code);
                  setOpen(false);
                }}
              >
                {getFlagSrc && (
                  <img
                    className={styles.languageFlag}
                    src={getFlagSrc(option.code)}
                    alt=""
                    decoding="async"
                  />
                )}
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Shared editor header used by both the visual email editor and the SMS/
 * WhatsApp/Voice composer so they read as one product: back, a centered
 * editable name (with channel icon + save), and autosave status.
 */
export default function EditorHeader({
  channel,
  name,
  onNameChange,
  kind = 'template',
  status = 'idle',
  category,
  categories,
  unavailableCategories,
  onCategoryChange,
  language,
  languageOptions,
  onLanguageChange,
  getLanguageFlagSrc,
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

  // Clear the badge on its own, like the app's other notifications.
  useEffect(() => {
    if (!nameError) return;
    const id = window.setTimeout(() => setNameError(null), 3200);
    return () => window.clearTimeout(id);
  }, [nameError]);

  return (
    <header className={styles.head}>
      <div className={styles.left}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
          <BackArrow />
        </button>
        {categories && onCategoryChange && (
          /* Radio group rather than a select: with four options the choices are
             worth showing, and native radios give arrow-key navigation and
             screen-reader semantics for free — the pills are the labels. */
          <div className={styles.categories} role="radiogroup" aria-label="Category">
            {categories.map((c) => {
              const unavailable = unavailableCategories?.includes(c) ?? false;
              return (
                <label
                  key={c}
                  className={`${styles.pill}${unavailable ? ` ${styles.pillUnavailable}` : ''}`}
                >
                  <input
                    type="radio"
                    name="editor-category"
                    className={styles.pillInput}
                    value={c}
                    disabled={unavailable}
                    checked={(category ?? categories[0]) === c}
                    onChange={() => onCategoryChange(c)}
                  />
                  <span className={styles.pillLabel}>
                    {c}
                    {unavailable && <span className={styles.pillNote}>Coming soon</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.center}>
        <div className={styles.nameRow}>
          <div className={`${styles.nameField}${nameError ? ` ${styles.nameFieldInvalid}` : ''}`}>
            <span
              className={styles.nameIcon}
              style={{ background: meta.tint, color: meta.color }}
              aria-hidden="true"
            >
              <Icon name={meta.icon} size={14} stroke={2} />
            </span>
            <input
              ref={nameRef}
              className={styles.name}
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
            {languageOptions && onLanguageChange && (
              <LanguagePicker
                value={language ?? languageOptions[0]?.code ?? ''}
                options={languageOptions}
                onChange={onLanguageChange}
                getFlagSrc={getLanguageFlagSrc}
              />
            )}
          </div>
          <button
            type="button"
            className={styles.saveIcon}
            onClick={handleSave}
            disabled={status === 'saving'}
          >
            <Icon name="save" size={14} stroke={2} />
            {saveLabel}
          </button>
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.status} role="status">
          <span className={`${styles.dot} ${status === 'saving' ? styles.dotSaving : ''}`} />
          {STATUS_LABEL[status]}
        </span>
        {onSendTest && (
          <button type="button" className={styles.sbtn} onClick={onSendTest}>
            <Icon name="send" size={14} />
            Send test
          </button>
        )}
      </div>
      {nameError && (
        /* Bottom badge in the app's toast position, in its alert tone. Sits
           outside the header so it can never affect the bar's height, and
           auto-dismisses like every other notification. */
        <div
          className={styles.alertBadge}
          role="alert"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className={styles.alertBadgeIcon}>
            <Icon name="x" size={13} stroke={3} />
          </span>
          {nameError}
        </div>
      )}
    </header>
  );
}
