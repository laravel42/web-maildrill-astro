import * as React from "react";

import { cn } from "@/lib/cn";
import { Label } from "@/ui/label";

interface FieldProps {
  /** Label rendered above the control. */
  label?: React.ReactNode;
  /** Helper text rendered under the control (hidden while `error` is set). */
  hint?: React.ReactNode;
  /** Error message rendered under the control; takes precedence over `hint`. */
  error?: React.ReactNode;
  /** Right-aligned counter (e.g. "42/1024") on the label row. */
  counter?: React.ReactNode;
  /** Forwarded to the underlying Label's `htmlFor`. */
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({
  label,
  hint,
  error,
  counter,
  htmlFor,
  className,
  children,
}: FieldProps) {
  const hasHeader = label != null || counter != null;

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-2">
          {label != null ? (
            <Label htmlFor={htmlFor}>{label}</Label>
          ) : (
            <span aria-hidden="true" />
          )}
          {counter != null && (
            <span
              data-slot="field-counter"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {counter}
            </span>
          )}
        </div>
      )}
      {children}
      {error != null ? (
        <p data-slot="field-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint != null ? (
        <p data-slot="field-hint" className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
export type { FieldProps };
