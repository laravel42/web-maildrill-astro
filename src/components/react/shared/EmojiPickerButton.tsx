import { lazy, memo, Suspense, useRef, useState } from 'react';
import Icon from '../Icon';
import { retryDynamicImport } from '@/lib/app/retry-dynamic-import';
import styles from './EmojiPickerButton.module.css';

/*
 * Emoji picker trigger for message composers (emoji-mart). The picker and its
 * ~500KB data load lazily on first open and then STAY MOUNTED — the panel
 * toggles with CSS, and the Picker itself renders inside a memoized child with
 * never-changing props. @emoji-mart/react re-feeds every prop through the web
 * component's update() on each parent render, which drops the select callback
 * mid-session; freezing the props freezes the wiring it got at construction.
 */

const Picker = lazy(() => retryDynamicImport(() => import('@emoji-mart/react')));

/** Loaded once per session, only when a picker actually opens. */
const emojiData = () => retryDynamicImport(() => import('@emoji-mart/data')).then((m) => m.default);

/** The app theme toggle stamps data-theme on <html>; default is light. */
function appTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

type PickerHandlers = {
  onEmojiSelect: (e: { native?: string }) => void;
  onClickOutside: (e?: Event) => void;
  theme: 'light' | 'dark';
};

/** memo + stable props → zero re-renders → the wrapper never calls update(). */
const PickerPanel = memo(function PickerPanel({
  onEmojiSelect,
  onClickOutside,
  theme,
}: PickerHandlers) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading emoji…</div>}>
      <Picker
        data={emojiData}
        theme={theme}
        previewPosition="none"
        onEmojiSelect={onEmojiSelect}
        onClickOutside={onClickOutside}
      />
    </Suspense>
  );
});

export default function EmojiPickerButton({ onPick }: { onPick: (native: string) => void }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Created once; identities never change so PickerPanel never re-renders.
  const [handlers] = useState<PickerHandlers>(() => ({
    theme: 'light',
    onEmojiSelect: (e) => {
      if (e.native) onPickRef.current(e.native);
      setOpen(false);
    },
    onClickOutside: (e) => {
      // The trigger's own click toggles state; acting here too would cancel it.
      if (e?.target instanceof Node && wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    },
  }));

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
          if (!everOpened) handlers.theme = appTheme();
          setOpen((v) => !v);
          setEverOpened(true);
        }}
      >
        <Icon name="smile" size={15} />
      </button>
      {everOpened && (
        <div className={styles.panel} style={open ? undefined : { display: 'none' }}>
          <PickerPanel {...handlers} />
        </div>
      )}
    </span>
  );
}
