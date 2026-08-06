import * as React from 'react';

import { cn } from '@/lib/cn';
import { Braces, FMT_ICON_CLASS, RemoveFormatting } from './text-format-icons';

type FormatBarButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

/** Round toolbar control — pairs with `.wts-fmtbar` in studio.css. */
export function FormatBarButton({
  active,
  className,
  type = 'button',
  onMouseDown,
  ...props
}: FormatBarButtonProps) {
  return (
    <button
      type={type}
      className={cn('wts-fmtbtn', className)}
      aria-pressed={active ? true : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.(e);
      }}
      {...props}
    />
  );
}

export function FormatBarDivider() {
  return <span aria-hidden="true" className="wts-fmtdivider" />;
}

type TextFormatBarProps = React.HTMLAttributes<HTMLDivElement>;

export function TextFormatBar({ className, ...props }: TextFormatBarProps) {
  return (
    <div
      role="group"
      aria-label="Text formatting"
      className={cn('wts-fmtbar', className)}
      {...props}
    />
  );
}

/** Insert-variable affordance — same Braces glyph as the body format bar. */
export function InsertVariableButton({
  onInsert,
  ...props
}: Omit<FormatBarButtonProps, 'children' | 'onClick'> & {
  onInsert: () => void;
}) {
  return (
    <FormatBarButton
      aria-label="Insert variable"
      title="Insert variable"
      onClick={onInsert}
      {...props}
    >
      <Braces className={FMT_ICON_CLASS} aria-hidden="true" />
    </FormatBarButton>
  );
}

/** Strip WhatsApp markup from the selection (or the whole field). */
export function ClearFormattingButton({
  onClear,
  ...props
}: Omit<FormatBarButtonProps, 'children' | 'onClick'> & {
  onClear: () => void;
}) {
  return (
    <FormatBarButton
      aria-label="Clear formatting"
      title="Clear formatting"
      onClick={onClear}
      {...props}
    >
      <RemoveFormatting className={FMT_ICON_CLASS} aria-hidden="true" />
    </FormatBarButton>
  );
}
