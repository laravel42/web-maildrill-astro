import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { AlertTriangle, Search, ShieldCheck } from 'lucide-react';

import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { listBlockPlugins, listButtonPlugins } from '@/core/registry';
import { addButton, placeBlock, setLibrarySearch, useStudio } from '@/core/store';
import type { Availability, PluginMeta } from '@/core/types';
import { validateTemplate } from '@/core/validation';

/**
 * Left sidebar: searchable component library grouped by category, plus
 * a live validation summary. Tiles are dnd-kit drag sources AND
 * click-to-place; unavailable ones are disabled with the reason.
 */

type LibraryEntry = {
  kind: 'block' | 'button';
  type: string;
  meta: PluginMeta;
  availability: Availability;
  /** For blocks: which slot it fills. */
  slot?: 'header' | 'body' | 'footer';
};

function matchesSearch(entry: LibraryEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    entry.meta.label.toLowerCase().includes(q) ||
    entry.meta.description.toLowerCase().includes(q) ||
    (entry.meta.keywords ?? []).some((k) => k.toLowerCase().includes(q)) ||
    entry.meta.group.toLowerCase().includes(q)
  );
}

function LibraryTile({ entry }: { entry: LibraryEntry }) {
  const disabled = !entry.availability.available;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${entry.kind}-${entry.type}`,
    data: { kind: entry.kind, type: entry.type, slot: entry.slot },
    disabled,
  });

  const place = () => {
    if (disabled) return;
    if (entry.kind === 'button') addButton(entry.type);
    else if (entry.slot) placeBlock(entry.slot, entry.type);
  };

  const Icon = entry.meta.icon;

  const tile = (
    <button
      ref={setNodeRef}
      type="button"
      onClick={place}
      disabled={disabled}
      aria-label={`Add ${entry.meta.label}`}
      className={`flex w-full items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-45'
          : 'cursor-grab hover:border-primary/60 hover:bg-accent active:cursor-grabbing'
      } ${isDragging ? 'opacity-40 ring-2 ring-primary' : ''}`}
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-tight">{entry.meta.label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{entry.meta.description}</span>
      </span>
    </button>
  );

  if (disabled && !entry.availability.available) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">{tile}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{entry.availability.reason}</TooltipContent>
      </Tooltip>
    );
  }
  return tile;
}

export function LibraryPanel() {
  const doc = useStudio((s) => s.doc);
  const search = useStudio((s) => s.librarySearch);

  const entries = React.useMemo<LibraryEntry[]>(() => {
    const blocks = listBlockPlugins().map((p) => ({
      kind: 'block' as const,
      type: p.type,
      meta: p.meta,
      slot: p.slot,
      availability: p.availableIn(doc.category, doc),
    }));
    const buttons = listButtonPlugins().map((p) => ({
      kind: 'button' as const,
      type: p.type,
      meta: p.meta,
      availability: p.availableIn(doc.category, doc),
    }));
    return [...blocks, ...buttons];
  }, [doc]);

  const groups = React.useMemo(() => {
    const visible = entries.filter((e) => matchesSearch(e, search));
    const byGroup = new Map<string, LibraryEntry[]>();
    for (const entry of visible) {
      const list = byGroup.get(entry.meta.group) ?? [];
      list.push(entry);
      byGroup.set(entry.meta.group, list);
    }
    return [...byGroup.entries()];
  }, [entries, search]);

  const issues = React.useMemo(() => validateTemplate(doc), [doc]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background" aria-label="Component library">
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search components…"
            aria-label="Search components"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
        <div className="flex flex-col gap-4">
          {groups.map(([group, groupEntries]) => (
            <section key={group} aria-label={group}>
              <h3 className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
              <div className="flex flex-col gap-1.5">
                {groupEntries.map((entry) => (
                  <LibraryTile key={`${entry.kind}-${entry.type}`} entry={entry} />
                ))}
              </div>
            </section>
          ))}
          {groups.length === 0 && <p className="px-1 text-xs text-muted-foreground">No components match “{search}”.</p>}

          <section aria-label="Validation" className="rounded-lg border border-border p-2.5">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {errors.length > 0 ? <AlertTriangle className="size-3.5 text-destructive" /> : <ShieldCheck className="size-3.5 text-primary" />}
              Validation
            </h3>
            {issues.length === 0 ? (
              <p className="text-xs text-muted-foreground">Template is ready for Meta review.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {errors.map((issue, i) => (
                  <li key={`e-${i}`} className="text-[11px] leading-snug text-destructive">
                    {issue.message}
                  </li>
                ))}
                {warnings.map((issue, i) => (
                  <li key={`w-${i}`} className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
