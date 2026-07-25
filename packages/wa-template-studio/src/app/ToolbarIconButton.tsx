import * as React from 'react';

import { cn } from '@/lib/cn';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  /** `tab` = centered Edit/Preview tabs; `action` = undo/redo; `icon` = device toggle. */
  variant?: 'icon' | 'tab' | 'action';
};

const variantClass: Record<NonNullable<Props['variant']>, string> = {
  icon: 'wts-toolbar-icon',
  tab: 'wts-mode-tab',
  action: 'wts-toolbar-action',
};

/** Icon-only toolbar control — matches email-builder TemplatePanel chrome. */
export function ToolbarIconButton({
  active,
  variant = 'icon',
  className,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(variantClass[variant], active && 'is-active', className)}
      {...props}
    />
  );
}
