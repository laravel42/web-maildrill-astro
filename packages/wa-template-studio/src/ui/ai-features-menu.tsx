import * as React from 'react';

import type { WaAiAction } from '@/core/ai';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { FormatBarButton } from '@/ui/text-format-bar';
import {
  CheckCircle,
  Description,
  FMT_ICON_CLASS,
  Pencil,
  Refresh,
  ShortText,
  Sparkles,
  Subject,
  type FormatIconComponent,
} from '@/ui/text-format-icons';

/* Mirrors the email editor's AiFeaturesDropdown: same actions, sections and
 * emojis, so both template editors offer the identical AI menu. */
type MenuEntry =
  | { kind: 'header'; label: string }
  | { kind: 'item'; label: string; action: WaAiAction; icon?: FormatIconComponent; emoji?: string };

const MENU: MenuEntry[] = [
  { kind: 'item', label: 'Rewrite', action: 'rewrite', icon: Refresh },
  { kind: 'item', label: 'Check grammar', action: 'grammar_check', icon: CheckCircle },
  { kind: 'item', label: 'Continue writing', action: 'continue_writing', icon: Pencil },
  { kind: 'header', label: 'MAKE IT' },
  { kind: 'item', label: 'Shorter', action: 'shorter', icon: ShortText },
  { kind: 'item', label: 'Descriptive', action: 'descriptive', icon: Description },
  { kind: 'item', label: 'Detailed', action: 'detailed', icon: Subject },
  { kind: 'header', label: 'CHANGE TONE TO' },
  { kind: 'item', label: 'Friendly', action: 'friendly', emoji: '😊' },
  { kind: 'item', label: 'Professional', action: 'professional', emoji: '💼' },
];

export function AiFeaturesButton({ onRun }: { onRun: (action: WaAiAction) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState<WaAiAction | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (action: WaAiAction) => {
    if (running) return;
    setRunning(action);
    setError(null);
    try {
      await onRun(action);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI is unavailable right now.');
    } finally {
      setRunning(null);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <PopoverTrigger asChild>
        <FormatBarButton aria-label="AI Features" title="AI Features">
          <Sparkles className={FMT_ICON_CLASS} aria-hidden="true" />
        </FormatBarButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="wts-ai-menu w-auto p-1"
        // The action splices into the textarea at the remembered caret;
        // stealing focus here (or handing it back on close) would clobber it.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {MENU.map((entry, i) =>
          entry.kind === 'header' ? (
            <div key={i} className="wts-ai-menu-header">
              {entry.label}
            </div>
          ) : (
            <button
              key={i}
              type="button"
              className="wts-ai-menu-item"
              disabled={running !== null}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void run(entry.action)}
            >
              <span className="wts-ai-menu-glyph" aria-hidden="true">
                {running === entry.action ? (
                  <span className="wts-ai-spinner" />
                ) : entry.emoji ? (
                  entry.emoji
                ) : entry.icon ? (
                  <entry.icon className="size-4" />
                ) : null}
              </span>
              {entry.label}
            </button>
          ),
        )}
        {error && (
          <div role="alert" className="wts-ai-menu-error">
            {error}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
