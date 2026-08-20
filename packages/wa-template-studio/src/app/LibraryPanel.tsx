import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';

import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { listBlockPlugins, listButtonPlugins } from '@/core/registry';
import { addButton, placeBlock, setLibrarySearch, useStudio } from '@/core/store';
import type { Availability, PluginMeta } from '@/core/types';

/**
 * Left sidebar: searchable component library grouped by category.
 * Tiles are dnd-kit drag sources AND click-to-place; unavailable ones
 * are disabled with the reason. Validation lives in the inspector
 * (per-instance) — not here.
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

function LibraryTile({ entry, compact = false }: { entry: LibraryEntry; compact?: boolean }) {
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
      className={`wts-lib-tile flex w-full text-left ${
        compact ? 'flex-col items-center gap-1 bg-card p-2' : 'items-start gap-2.5 bg-card p-2.5'
      } ${
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      <span
        className={
          compact
            ? 'flex w-full items-center justify-center rounded-md bg-muted py-1.5 text-muted-foreground'
            : 'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground'
        }
      >
        <Icon className={compact ? 'size-5' : 'size-4'} />
      </span>
      {compact ? (
        <span className="w-full truncate text-center text-xs font-medium leading-tight">
          {entry.meta.label}
        </span>
      ) : (
        <span className="min-w-0">
          <span className="block text-[13px] font-medium leading-tight">{entry.meta.label}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {entry.meta.description}
          </span>
        </span>
      )}
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
  const open = useStudio((s) => s.libraryOpen);

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
    const visible = entries.filter((e) => matchesSearch(e, open ? search : ''));
    const byGroup = new Map<string, LibraryEntry[]>();
    for (const entry of visible) {
      const list = byGroup.get(entry.meta.group) ?? [];
      list.push(entry);
      byGroup.set(entry.meta.group, list);
    }
    return [...byGroup.entries()];
  }, [entries, search, open]);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border bg-background"
      aria-label="Component library"
    >
      {open ? (
        <>
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
            <div className="flex flex-col gap-4 px-1">
              {groups.map(([group, groupEntries]) => (
                <section key={group} aria-label={group}>
                  <h3 className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {groupEntries.map((entry) => (
                      <LibraryTile key={`${entry.kind}-${entry.type}`} entry={entry} />
                    ))}
                  </div>
                </section>
              ))}
              {groups.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">
                  No components match “{search}”.
                </p>
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
          <div className="flex flex-col gap-3 py-2">
            {groups.map(([group, groupEntries]) => (
              <section key={group} aria-label={group}>
                <h3 className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {groupEntries.slice(0, 2).map((entry) => (
                    <LibraryTile key={`${entry.kind}-${entry.type}`} entry={entry} compact />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
