import type { CSSProperties, ReactNode } from 'react';
import EditorHeader, { type LanguageOption, type SaveStatus } from './EditorHeader';
import type { ChannelType } from '@/types/app';
import { resolveEditorIdentity, type EditorIdentity } from './channels';
import shellStyles from './ChannelEditorShell.module.css';

type Props = {
  /** Channel editor (email/sms/whatsapp/voice). Omit and pass `identity` for a non-channel editor. */
  channel?: ChannelType;
  /** Presentation identity for a non-channel editor (e.g. Landings). Wins over `channel`. */
  identity?: EditorIdentity;
  name: string;
  onNameChange: (value: string) => void;
  kind?: 'template' | 'campaign';
  /** Noun for the header's generated copy (e.g. 'landing'); see `EditorHeader`. */
  nounLabel?: string;
  status?: SaveStatus;
  category?: string;
  categories?: readonly string[];
  unavailableCategories?: readonly string[];
  onCategoryChange?: (value: string) => void;
  language?: string;
  languageOptions?: readonly LanguageOption[];
  onLanguageChange?: (value: string) => void;
  getLanguageFlagSrc?: (code: string) => string;
  onBack: () => void;
  /** Sends a real test message to the signed-in user; button hidden when omitted. */
  onSendTest?: () => void;
  onSaveDraft: () => void;
  children: ReactNode;
  toast?: ReactNode;
  className?: string;
  stageClassName?: string;
  isDirty?: boolean;
};

/**
 * Full-screen shell shared by every channel editor (email, SMS, WhatsApp, voice).
 * Keeps the centered title block, autosave row, and stage layout identical.
 */
export default function ChannelEditorShell({
  children,
  toast,
  className,
  stageClassName,
  channel,
  identity,
  ...headerProps
}: Props) {
  const meta = resolveEditorIdentity({ identity, channel });
  return (
    <div
      className={`${shellStyles.shell}${className ? ` ${className}` : ''}`}
      style={{ '--editor-channel-color': meta.hex } as CSSProperties}
    >
      <EditorHeader
        channel={channel}
        identity={identity}
        {...headerProps}
      />
      <div className={`${shellStyles.stage}${stageClassName ? ` ${stageClassName}` : ''}`}>
        {children}
      </div>
      {toast}
    </div>
  );
}

export { shellStyles };
