import { useRef, useState } from 'react';
import { EmojiPickerPanel } from '@md/emoji-picker';
import Icon from '../Icon';
import { retryDynamicImport } from '@/lib/app/retry-dynamic-import';
import styles from './EmojiPickerButton.module.css';

/*
 * Emoji trigger for the message composers. The picker itself is the shared
 * panel (@md/emoji-picker), so this file only owns the trigger and the popover
 * around it; the panel stays mounted once opened and toggles with CSS, which
 * keeps reopening instant and its emoji-mart wiring intact.
 */

export default function EmojiPickerButton({ onPick }: { onPick: (native: string) => void }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  return (
    <span ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Insert emoji"
        title="Insert emoji"
        aria-expanded={open}
        // Keep the textarea's caret/selection when the button is pressed.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setOpen((v) => !v);
          setEverOpened(true);
        }}
      >
        <Icon name="smile" size={15} />
      </button>
      {everOpened && (
        <div className={styles.panel} style={open ? undefined : { display: 'none' }}>
          <EmojiPickerPanel
            onPick={(native) => {
              onPick(native);
              setOpen(false);
            }}
            onClickOutside={(e) => {
              // The trigger's own click toggles state; acting here too would cancel it.
              if (e?.target instanceof Node && wrapRef.current?.contains(e.target)) return;
              setOpen(false);
            }}
            loadModule={retryDynamicImport}
          />
        </div>
      )}
    </span>
  );
}
