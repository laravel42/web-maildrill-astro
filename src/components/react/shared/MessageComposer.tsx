import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from '../Icon';
import { CHANNEL } from './channels';
import {
  templateCategoriesForChannel,
  unavailableTemplateCategoriesForChannel,
} from '@/lib/app/templates-data';
import {
  normalizeTemplateLanguageCode,
  TEMPLATE_LANGUAGE_OPTIONS,
  templateLanguageFlagSrc,
} from '@/lib/app/template-language';
import ChannelEditorShell, { shellStyles } from './ChannelEditorShell';
import EmojiPickerButton from './EmojiPickerButton';
import { useEscapeClose } from './useEscapeClose';
import type { MessageDraft } from './useMessageDraft';
import styles from './MessageComposer.module.css';

/* ------------------------------------------------------------------ *
 * Presentational scaffolding shared by the text-message builders
 * (SmsBuilder, VoiceBuilder): full-screen shell wired to the draft,
 * personalize rail, editor card, and the phone live-preview column.
 * ------------------------------------------------------------------ */

const labelCap: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
  marginBottom: 10,
};

/** Max characters shown in the device preview bubbles. */
export const PREVIEW_MAX_CHARS = 190;

/** Clip long copy for the side-panel device mockups (full text still used for TTS). */
export function truncatePreview(text: string, max = PREVIEW_MAX_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** Full-screen editor shell wired to a useMessageDraft draft. */
export function ComposerShell({
  channel,
  draft,
  onClose,
  children,
}: {
  channel: ChannelType;
  draft: MessageDraft;
  onClose: () => void;
  children: ReactNode;
}) {
  useEscapeClose(onClose);
  return (
    <ChannelEditorShell
      channel={channel}
      name={draft.templateName}
      onNameChange={draft.setTemplateName}
      kind="template"
      status={draft.status}
      category={draft.category}
      categories={templateCategoriesForChannel(channel)}
      unavailableCategories={unavailableTemplateCategoriesForChannel(channel)}
      onCategoryChange={draft.setCategory}
      language={draft.language}
      languageOptions={TEMPLATE_LANGUAGE_OPTIONS}
      getLanguageFlagSrc={templateLanguageFlagSrc}
      onLanguageChange={(v) => draft.setLanguage(normalizeTemplateLanguageCode(v))}
      onBack={onClose}
      onSaveDraft={() => void draft.handleSaveDraft()}
      className={styles.overlayFade}
      toast={
        draft.toast ? (
          <div
            className={shellStyles.toast}
            role="status"
            style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
          >
            <span className={shellStyles.toastIcon}>
              <Icon name="check" size={13} stroke={3} />
            </span>
            {draft.toast}
          </div>
        ) : null
      }
    >
      <div className={styles.grid}>{children}</div>
    </ChannelEditorShell>
  );
}

/** Left rail: personalization token chips + channel best practices. */
export function PersonalizeRail({
  tokens,
  tips,
  color,
  onInsert,
}: {
  tokens: ReadonlyArray<{ label: string; token: string }>;
  tips: readonly string[];
  color: string;
  onInsert: (token: string) => void;
}) {
  return (
    <aside className={`${styles.panel} ${styles.railLeft}`}>
      <div style={labelCap}>Personalize</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {tokens.map(({ label, token }) => (
          <button
            key={token}
            type="button"
            className={styles.varchip}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(token)}
          >
            <span style={{ color }}>+</span>
            {label}
          </button>
        ))}
      </div>
      <div style={labelCap}>Best practices</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tips.map((t) => (
          <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: color,
                marginTop: 6,
                flex: 'none',
              }}
            />
            <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text4)' }}>{t}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Center column: message textarea card with character/metric counters. */
export function ComposerCard({
  channel,
  draft,
  placeholder,
  count,
  countLabel,
  emoji = false,
  children,
}: {
  channel: ChannelType;
  draft: MessageDraft;
  placeholder: string;
  /** Channel metric badge: SMS segments or estimated voice seconds. */
  count: number;
  countLabel: string;
  /** Offer the emoji picker (text channels; not spoken voice scripts). */
  emoji?: boolean;
  /** Channel-specific controls below the counter row (voice pickers, …). */
  children?: ReactNode;
}) {
  const meta = CHANNEL[channel];
  return (
    <div
      style={{
        overflowY: 'auto',
        padding: '32px 40px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          height: 'fit-content',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '26px 28px',
          boxShadow: '0 1px 2px rgba(30,27,22,.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{ display: 'flex', color: meta.color }}>
            <Icon name={meta.icon} size={15} stroke={2} />
          </span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>
            {meta.label} message
          </h3>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text4)' }}>
          Use the variables on the left to personalize. Changes autosave.
        </p>
        <textarea
          ref={draft.textareaRef}
          className={styles.ta}
          value={draft.message}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => draft.setMessage(e.target.value)}
          onSelect={draft.rememberSelection}
          onBlur={draft.rememberSelection}
          onKeyUp={draft.rememberSelection}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: 150,
            resize: 'vertical',
            border: '1px solid var(--border2)',
            borderRadius: 10,
            padding: '14px 15px',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text2)',
            background: 'var(--surface2)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--divider)',
            fontSize: 11.5,
            color: 'var(--muted)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {emoji && <EmojiPickerButton onPick={draft.insertVariable} />}
            <span className={styles.tnum}>{draft.message.length} characters</span>
          </span>
          <span
            className={`${styles.tnum} ${styles.metricBadge}`}
            style={{ background: meta.tint, color: meta.color }}
          >
            {count} {countLabel}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBar({ color }: { color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 18px 3px',
        fontSize: 11,
        fontWeight: 600,
        color,
      }}
    >
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
          <rect x="0" y="6" width="2" height="4" rx=".5" />
          <rect x="4" y="4" width="2" height="6" rx=".5" />
          <rect x="8" y="2" width="2" height="8" rx=".5" />
          <rect x="12" y="0" width="2" height="10" rx=".5" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" />
          <rect x="2" y="2" width="13" height="7" rx="1" fill="currentColor" />
          <rect x="19" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

/** Right rail: phone chrome with the channel's live preview screen inside. */
export function PhonePreview({
  accent,
  screenBackground,
  statusBarColor,
  children,
}: {
  /** Channel color for the "Live preview" activity dot. */
  accent: string;
  screenBackground: string;
  statusBarColor: string;
  children: ReactNode;
}) {
  return (
    <aside className={`${styles.panel} ${styles.railRight}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 17,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>Live preview</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
      </div>
      <div
        style={{
          maxWidth: 236,
          margin: '0 auto',
          background: '#0b0b0f',
          borderRadius: 34,
          padding: 9,
          boxShadow: '0 10px 30px rgba(28,25,23,.22)',
        }}
      >
        <div
          style={{
            background: screenBackground,
            borderRadius: 26,
            overflow: 'hidden',
            minHeight: 420,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 70,
              height: 18,
              background: '#000',
              borderRadius: '0 0 10px 10px',
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
            }}
          />
          <StatusBar color={statusBarColor} />
          {children}
        </div>
      </div>
    </aside>
  );
}
