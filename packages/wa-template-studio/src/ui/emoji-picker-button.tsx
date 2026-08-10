import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { FormatBarButton } from '@/ui/text-format-bar';
import { FMT_ICON_CLASS, Smile } from '@/ui/text-format-icons';

/*
 * Emoji picker for the studio's text toolbars (emoji-mart). Picker + data are
 * lazy-loaded on first open and then stay mounted (forceMount + display
 * toggle) — remounting @emoji-mart/react per open can drop its select
 * callback, and a persistent instance reopens instantly.
 */

const Picker = React.lazy(() => import('@emoji-mart/react'));

const emojiData = () => import('@emoji-mart/data').then((m) => m.default);

/** The host app's theme toggle stamps data-theme on <html>; default light. */
function appTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

type PickerHandlers = {
  onEmojiSelect: (e: { native?: string }) => void;
  theme: 'light' | 'dark';
};

/** memo + stable props → zero re-renders → the wrapper never calls update(),
 * which would otherwise drop the select callback mid-session. */
const PickerPanel = React.memo(function PickerPanel({ onEmojiSelect, theme }: PickerHandlers) {
  return (
    <React.Suspense fallback={<div className="wts-emoji-loading">Loading emoji…</div>}>
      <Picker data={emojiData} theme={theme} previewPosition="none" onEmojiSelect={onEmojiSelect} />
    </React.Suspense>
  );
});

export function EmojiPickerButton({ onPick }: { onPick: (native: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [everOpened, setEverOpened] = React.useState(false);
  const onPickRef = React.useRef(onPick);
  onPickRef.current = onPick;

  // Created once; identities never change so PickerPanel never re-renders.
  const [handlers] = React.useState<PickerHandlers>(() => ({
    theme: 'light',
    onEmojiSelect: (e) => {
      if (e.native) onPickRef.current(e.native);
      setOpen(false);
    },
  }));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !everOpened) {
          handlers.theme = appTheme();
          setEverOpened(true);
        }
      }}
    >
      <PopoverTrigger asChild>
        <FormatBarButton aria-label="Insert emoji" title="Insert emoji">
          <Smile className={FMT_ICON_CLASS} aria-hidden="true" />
        </FormatBarButton>
      </PopoverTrigger>
      {everOpened && (
        <PopoverContent
          forceMount
          align="start"
          sideOffset={6}
          style={open ? undefined : { display: 'none' }}
          className="wts-emoji-popup w-auto border-none p-0 shadow-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
          // The insert refocuses the textarea at the caret; returning focus to
          // the trigger here would blur it again.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <PickerPanel {...handlers} />
        </PopoverContent>
      )}
    </Popover>
  );
}
