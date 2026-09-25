import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
/** `confirm` sits above a modal that opened it (--z-confirm); `default` is --z-modal. */
export type ModalLayer = 'default' | 'confirm';

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * The dialog's accessible name. Rendered invisibly and wired via
   * aria-labelledby — most consumers already render their own visible
   * heading (with a subtitle, back button, icon, etc.) inside `children`
   * using the `.amodal__*` shell classes, so this does not duplicate it
   * on screen.
   */
  title: string;
  /** Full panel content — header/body/footer markup, using `.amodal__*`. */
  children: ReactNode;
  size?: ModalSize;
  /** Focus this instead of the first focusable element when the modal opens. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** `confirm` for a dialog opened from within another modal (see ConfirmDialog). */
  layer?: ModalLayer;
  /**
   * Raw z-index override for the overlay, for the rare consumer that must
   * sit above a third-party UI with its own hard-coded stacking (the
   * vendored email builder's MUI surfaces use 1200/1300). Takes precedence
   * over `layer` when set.
   */
  zIndex?: number;
  /** Extra class for the panel — bespoke per-modal sizing/layout on top of the shell. */
  panelClassName?: string;
  /** Extra class for the overlay — for bespoke alignment (e.g. a top-anchored command palette). */
  overlayClassName?: string;
  /** role override — ConfirmDialog uses `alertdialog`. */
  role?: 'dialog' | 'alertdialog';
};

/** Selector for elements that can receive keyboard focus. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Focusable, visible elements inside `root`, in DOM order. Exported as a pure
 * helper so the trap's core logic can be unit tested without a DOM/React
 * rendering environment (see tests/unit/modal-focus-trap.test.ts).
 */
export function getFocusableElements(root: ParentNode): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (el.hasAttribute('inert')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // offsetParent is null for display:none (and, in jsdom, always — guarded
    // by the tests exercising getFocusableElements directly instead).
    return el.offsetParent !== null || el === document.activeElement;
  });
}

/**
 * Pure focus-trap decision: given how many focusable elements the panel has,
 * which one currently has focus (its index, or -1/null if focus is outside
 * the panel entirely — e.g. a click landed on the overlay), and which
 * direction Tab is moving, returns the index the trap should force focus to,
 * or `null` when the browser's default Tab behavior already keeps focus
 * inside the panel and no override is needed.
 *
 * Kept dependency-free (no DOM) so it can be unit tested directly — see
 * tests/unit/modal-focus-trap.test.ts — independent of `getFocusableElements`,
 * which does need a real DOM.
 */
export function computeTrapFocusTarget(
  focusableCount: number,
  currentIndex: number | null,
  shiftKey: boolean,
): number | null {
  if (focusableCount === 0) return null;
  const lastIndex = focusableCount - 1;
  const outsidePanel = currentIndex === null || currentIndex < 0 || currentIndex > lastIndex;

  if (shiftKey) {
    // Shift+Tab from the first element (or from outside the panel) wraps to
    // the last one instead of escaping to whatever the browser would tab to.
    if (outsidePanel || currentIndex === 0) return lastIndex;
    return null;
  }
  // Tab from the last element (or from outside the panel) wraps to the first.
  if (outsidePanel || currentIndex === lastIndex) return 0;
  return null;
}

/** Live count of open Modal layers, used to gate the shared scroll lock + inert. */
let openLayerCount = 0;
let savedBodyOverflow: string | null = null;
const inertedSiblings: HTMLElement[] = [];

function lockBackground(portalEl: HTMLElement) {
  openLayerCount += 1;
  if (openLayerCount > 1) return;

  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  for (const child of Array.from(document.body.children)) {
    if (child === portalEl || !(child instanceof HTMLElement)) continue;
    if (child.inert || child.getAttribute('aria-hidden') === 'true') continue;
    // `inert` is broadly supported (Chrome/Firefox/Safari); aria-hidden is
    // the fallback for anything older that still parses the attribute fine.
    child.inert = true;
    child.setAttribute('aria-hidden', 'true');
    inertedSiblings.push(child);
  }
}

function unlockBackground() {
  openLayerCount = Math.max(0, openLayerCount - 1);
  if (openLayerCount > 0) return;

  document.body.style.overflow = savedBodyOverflow ?? '';
  savedBodyOverflow = null;

  for (const el of inertedSiblings) {
    el.inert = false;
    el.removeAttribute('aria-hidden');
  }
  inertedSiblings.length = 0;
}

/**
 * Shared accessible modal shell: portal to `document.body`, `role="dialog"`
 * + `aria-modal`, focus trap with Tab/Shift+Tab, initial focus + restore,
 * Escape-to-close, and a scroll lock + background `inert` that stack across
 * nested layers (e.g. a ConfirmDialog opened from another modal) so only the
 * outermost open/close pair touches `document.body.style.overflow`.
 *
 * This is a shell, not a layout: `children` renders the whole panel (head,
 * body, foot) using the `.amodal__*` primitives in app.css, or its own
 * module CSS for genuinely bespoke shapes. Modal only supplies the overlay,
 * the panel's positioning/elevation, and the behavior above.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  initialFocus,
  layer = 'default',
  zIndex,
  panelClassName,
  overlayClassName,
  role = 'dialog',
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const portalElRef = useRef<HTMLDivElement | null>(null);

  if (!portalElRef.current && typeof document !== 'undefined') {
    portalElRef.current = document.createElement('div');
  }

  // Mount/unmount the portal container and manage the shared scroll lock +
  // inert background. Runs once per open/close transition.
  useEffect(() => {
    if (!open) return;
    const portalEl = portalElRef.current;
    if (!portalEl) return;

    document.body.appendChild(portalEl);
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    lockBackground(portalEl);

    const toFocus = initialFocus?.current ?? getFocusableElements(panelRef.current ?? portalEl)[0];
    toFocus?.focus();

    return () => {
      unlockBackground();
      if (portalEl.parentNode) portalEl.parentNode.removeChild(portalEl);
      // Restore focus to whatever had it before this layer opened, unless
      // that element left the document while the modal was up.
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;
    const focusable = getFocusableElements(panel);
    if (focusable.length === 0) {
      // Nothing to focus inside the panel — still don't let Tab escape it.
      e.preventDefault();
      return;
    }
    const current = document.activeElement;
    const currentIndex = current ? focusable.indexOf(current as HTMLElement) : -1;
    const targetIndex = computeTrapFocusTarget(
      focusable.length,
      currentIndex === -1 ? null : currentIndex,
      e.shiftKey,
    );
    if (targetIndex === null) return;
    e.preventDefault();
    focusable[targetIndex]?.focus();
  };

  if (!open || !portalElRef.current) return null;

  const sizeClass = size === 'md' ? '' : ` amodal--${size}`;

  return createPortal(
    <div
      className={`amodal-overlay${layer === 'confirm' ? ' amodal-overlay--confirm' : ''}${overlayClassName ? ` ${overlayClassName}` : ''}`}
      onClick={onClose}
      style={{ animation: 'ovfade .18s var(--ease-out)', ...(zIndex != null ? { zIndex } : null) }}
    >
      <div
        ref={panelRef}
        className={`amodal${sizeClass}${panelClassName ? ` ${panelClassName}` : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{ animation: 'pop .18s ease' }}
      >
        {/* Visually hidden — consumers render their own visible heading
            inside `children`; this only supplies the accessible name. */}
        <span id={titleId} className="sr-only">
          {title}
        </span>
        {children}
      </div>
    </div>,
    portalElRef.current,
  );
}
