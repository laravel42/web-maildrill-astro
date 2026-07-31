import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

import type { SubscriberFieldOption } from '@/core/subscriber-fields';
import { Input } from '@/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';

type Props = {
  options: SubscriberFieldOption[];
  value: SubscriberFieldOption | null;
  onChange: (option: SubscriberFieldOption) => void;
  placeholder?: string;
  'aria-label'?: string;
};

function matchesQuery(option: SubscriberFieldOption, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    option.label.toLowerCase().includes(q) ||
    option.token.toLowerCase().includes(q) ||
    option.example.toLowerCase().includes(q)
  );
}

export function SubscriberFieldCombobox({
  options,
  value,
  onChange,
  placeholder = 'Map to subscriber field…',
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(
    () => options.filter((o) => matchesQuery(o, query.trim())),
    [options, query],
  );

  const core = filtered.filter((o) => o.group === 'core');
  const custom = filtered.filter((o) => o.group === 'custom');

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const pick = (option: SubscriberFieldOption) => {
    onChange(option);
    setOpen(false);
  };

  const renderGroup = (title: string, items: SubscriberFieldOption[]) => {
    if (items.length === 0) return null;
    return (
      <div className="py-1">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{title}</div>
        {items.map((option) => {
          const selected = value?.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-slot="combobox-item"
              data-selected={selected ? '' : undefined}
              className="wts-combobox-item flex w-full items-start gap-2 px-2 py-1.5 text-left outline-none"
              onClick={() => pick(option)}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {selected ? <Check className="size-3.5" aria-hidden /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">{option.label}</span>
                <span className="wts-combobox-token block text-xs">{option.token}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

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
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              aria-label="Search subscriber fields"
              className="h-8 pl-8"
            />
          </div>
        </div>
        <div className="wts-combobox-list">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No fields match.
              </p>
            ) : (
              <>
                {renderGroup('Subscriber fields', core)}
                {renderGroup('Custom fields', custom)}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
