import type { CSSProperties, ReactNode } from 'react';
import EditorHeader, { type LanguageOption, type SaveStatus } from './EditorHeader';
import type { ChannelType } from '@/types/app';
import { CHANNEL } from './channels';
import shellStyles from './ChannelEditorShell.module.css';

type Props = {
  channel: ChannelType;
  name: string;
  onNameChange: (value: string) => void;
  kind?: 'template' | 'campaign';
  status?: SaveStatus;
  category?: string;
  categories?: readonly string[];
  onCategoryChange?: (value: string) => void;
  language?: string;
  languageOptions?: readonly LanguageOption[];
  onLanguageChange?: (value: string) => void;
  getLanguageFlagSrc?: (code: string) => string;
  onBack: () => void;
  onSaveDraft: () => void;
  children: ReactNode;
  toast?: ReactNode;
  className?: string;
  stageClassName?: string;
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
  ...headerProps
}: Props) {
  return (
    <div
      className={`${shellStyles.shell}${className ? ` ${className}` : ''}`}
      style={{ '--editor-channel-color': CHANNEL[channel].hex } as CSSProperties}
    >
      <EditorHeader channel={channel} {...headerProps} />
      <div className={`${shellStyles.stage}${stageClassName ? ` ${stageClassName}` : ''}`}>
        {children}
      </div>
      {toast}
    </div>
  );
}

export { shellStyles };
