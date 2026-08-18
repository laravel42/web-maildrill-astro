import * as React from 'react';
import { EmojiPickerPanel } from '@md/emoji-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { FormatBarButton } from '@/ui/text-format-bar';
import { FMT_ICON_CLASS, Smile } from '@/ui/text-format-icons';

/*
 * Emoji picker for the studio's text toolbars. The picker is the shared panel
 * (@md/emoji-picker) so every composer in the product offers the same one;
 * this file owns the toolbar trigger and the Radix popover around it. The
 * panel stays mounted after the first open (forceMount + display toggle) so
 * reopening is instant.
 */

export function EmojiPickerButton({ onPick }: { onPick: (native: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [everOpened, setEverOpened] = React.useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setEverOpened(true);
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
          // Opens leftward from the toolbar button (see the composer picker).
          align="end"
          sideOffset={6}
          style={open ? undefined : { display: 'none' }}
          className="wts-emoji-popup w-auto border-none p-0 shadow-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
          // The insert refocuses the textarea at the caret; returning focus to
          // the trigger here would blur it again.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <EmojiPickerPanel
            onPick={(native) => {
              onPick(native);
              setOpen(false);
            }}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}
