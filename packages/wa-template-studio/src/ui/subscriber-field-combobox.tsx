import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { MergeTagMenuPanel, type MergeTagGroup } from '@md/merge-tag-menu';

import type { SubscriberFieldOption } from '@/core/subscriber-fields';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

type Props = {
  options: SubscriberFieldOption[];
  value: SubscriberFieldOption | null;
  onChange: (option: SubscriberFieldOption) => void;
  placeholder?: string;
  'aria-label'?: string;
};

/**
 * Maps a template variable to a subscriber field. The list itself is the
 * shared merge-tag panel every editor uses; this file owns the trigger and
 * the popover.
 */
export function SubscriberFieldCombobox({
  options,
  value,
  onChange,
  placeholder = 'Map to subscriber field…',
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const groups = React.useMemo<MergeTagGroup[]>(() => {
    const toGroup = (title: string, group: SubscriberFieldOption['group']) => ({
      title,
      options: options
        .filter((o) => o.group === group)
        .map((o) => ({ id: o.id, label: o.label, token: o.token, keywords: o.example })),
    });
    return [toGroup('Subscriber fields', 'core'), toGroup('Custom fields', 'custom')].filter(
      (g) => g.options.length > 0,
    );
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="wts-select w-full"
          aria-label={ariaLabel}
          {...(!value ? { 'data-placeholder': '' } : {})}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {value ? value.label : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="wts-select-menu w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <MergeTagMenuPanel
          groups={groups}
          selectedId={value?.id ?? null}
          searchable
          autoFocusSearch
          searchPlaceholder="Search fields…"
          onSelect={(option) => {
            const picked = options.find((o) => o.id === option.id);
            if (picked) onChange(picked);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
