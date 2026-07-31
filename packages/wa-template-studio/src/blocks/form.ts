import { useEffect, useRef } from 'react';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

/**
 * Shared plugin-editor form hook: React Hook Form + zod resolver,
 * controlled from the outside (`value` from the store), emitting every
 * change back through `onChange` so the preview updates live. Each
 * plugin's Editor stays a thin field layout.
 */
export function usePluginForm<TSchema extends z.ZodType<FieldValues>>(
  schema: TSchema,
  value: z.infer<TSchema>,
  onChange: (next: z.infer<TSchema>) => void,
): UseFormReturn<z.infer<TSchema>> {
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema as never) as never,
    // `values` keeps RHF in sync with external updates (undo/redo).
    values: value,
    mode: 'onChange',
  });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const subscription = form.watch((data, info) => {
      // Only emit on actual user edits, not external `values` syncs.
      if (info.name !== undefined) onChangeRef.current(data as z.infer<TSchema>);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  return form;
}
