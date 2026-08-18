import { lazy, memo, Suspense, useRef, useState, type ComponentType, type ReactNode } from 'react';
import './emoji-picker.css';

/*
 * The emoji picker itself, shared by every composer that offers one: the
 * SMS/voice composer, the WhatsApp studio toolbars and the email editor's
 * bubble menu. Only the picker is shared — each caller wraps it in its own
 * popover, because the three live in different UI stacks (CSS modules, Radix,
 * MUI) with different anchoring needs.
 *
 * Two things are deliberate here:
 *
 * - The picker and its ~500KB of data load lazily, on first render of the
 *   panel. Callers decide whether that means "on first open" (keeping the
 *   panel mounted and toggling visibility) or "on every open".
 * - Every prop handed to @emoji-mart/react is frozen at mount. The wrapper
 *   re-feeds its props through the web component's update() on each render,
 *   which drops the select callback mid-session; freezing the props keeps the
 *   wiring the picker got at construction. Callbacks are read through refs, so
 *   callers can still pass inline closures.
 */

/** Emoji code point plus the metadata emoji-mart reports alongside it. */
export type PickedEmoji = { native?: string };

/** Wraps the lazy `import()`, e.g. with a host app's retry/heal logic. */
export type ModuleLoader = <T>(importFn: () => Promise<T>) => Promise<T>;

export type EmojiPickerPanelProps = {
  onPick: (native: string) => void;
  /**
   * Clicks outside the picker. Popovers that already handle dismissal (Radix,
   * MUI) should leave this unset.
   */
  onClickOutside?: (event?: Event) => void;
  /** Frozen at mount; defaults to `data-theme` on `<html>`. */
  theme?: 'light' | 'dark';
  /** Shown until the picker chunk resolves. */
  fallback?: ReactNode;
  loadModule?: ModuleLoader;
};

/*
 * Trimmed layout: the stock picker is ~352x435, much of it nav, frequent-emoji
 * rows and a preview bar that only repeats the emoji under the cursor. Nine
 * columns keeps the category nav's icons from bunching up.
 */
export const EMOJI_PICKER_LAYOUT = {
  perLine: 9,
  emojiSize: 20,
  emojiButtonSize: 30,
  maxFrequentRows: 1,
  previewPosition: 'none',
  // Home for the skin-tone control now that the preview bar is gone.
  skinTonePosition: 'search',
} as const;

/** The app's theme toggle stamps data-theme on <html>; default is light. */
function detectTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

const load: ModuleLoader = (importFn) => importFn();

type FrozenProps = {
  Picker: ComponentType<Record<string, unknown>>;
  data: () => Promise<unknown>;
  theme: 'light' | 'dark';
  onEmojiSelect: (emoji: PickedEmoji) => void;
  onClickOutside: (event?: Event) => void;
};

/** memo + never-changing props → no re-render → the wrapper never calls update(). */
const FrozenPicker = memo(function FrozenPicker({ Picker, ...pickerProps }: FrozenProps) {
  return <Picker {...pickerProps} {...EMOJI_PICKER_LAYOUT} />;
});

export default function EmojiPickerPanel({
  onPick,
  onClickOutside,
  theme,
  fallback,
  loadModule,
}: EmojiPickerPanelProps) {
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onClickOutsideRef = useRef(onClickOutside);
  onClickOutsideRef.current = onClickOutside;
  const loadRef = useRef<ModuleLoader>(loadModule ?? load);
  loadRef.current = loadModule ?? load;

  // Built once per mount. The lazy component is per-instance rather than
  // module-level so each caller's loadModule applies; the underlying import is
  // cached by the bundler either way.
  const [frozen] = useState<FrozenProps>(() => ({
    Picker: lazy(() => loadRef.current(() => import('@emoji-mart/react'))),
    data: () => loadRef.current(() => import('@emoji-mart/data').then((m) => m.default)),
    theme: theme ?? detectTheme(),
    onEmojiSelect: (emoji) => {
      // Closing (or not) belongs to the caller: the editor inserts several in
      // a row, the composers close after one.
      if (emoji.native) onPickRef.current(emoji.native);
    },
    onClickOutside: (event) => onClickOutsideRef.current?.(event),
  }));

  return (
    <div className="md-emoji-panel">
      <Suspense fallback={fallback ?? <div className="md-emoji-loading">Loading emoji…</div>}>
        <FrozenPicker {...frozen} />
      </Suspense>
    </div>
  );
}
