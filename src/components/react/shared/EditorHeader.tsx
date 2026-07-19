import type { ChangeEvent } from 'react';
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
            className={styles.name}
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
            placeholder={placeholder}
            aria-label={`${section} name`}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <div className={styles.crumb}>{section} / Draft</div>
        </div>

        {categories && onCategoryChange && (
          <select
            className={styles.category}
            value={category ?? categories[0]}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onCategoryChange(e.target.value)}
            aria-label="Category"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.status} role="status">
          <span className={`${styles.dot} ${status === 'saving' ? styles.dotSaving : ''}`} />
          {STATUS_LABEL[status]}
        </span>
        <button type="button" className={styles.sbtn} onClick={onSendTest}>
          Send test
        </button>
        <button type="button" className={`${styles.sbtn} ${styles.primary}`} onClick={onSaveDraft}>
          Save draft
        </button>
      </div>
    </header>
  );
}
