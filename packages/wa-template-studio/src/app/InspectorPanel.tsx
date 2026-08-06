import * as React from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, AlertTriangle, GripVertical, Trash2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Separator } from '@/ui/separator';
import { getBlockPlugin, getButtonPlugin } from '@/core/registry';
import {
  removeBlock,
  removeButton,
  reorderButtons,
  select,
  updateBlockData,
  updateButtonData,
  useStudio,
} from '@/core/store';
import { issuesForBlock, validateTemplate } from '@/core/validation';
import { TemplateGallery } from './TemplateGallery';

/**
 * Right sidebar: properties of the current selection, rendered by the
 * selected plugin's Editor. Includes per-instance issues, removal, and
 * (for buttons) the sortable order list. Template selection shows the
 * example send-payload.
 */

function IssueList({ blockId }: { blockId: string }) {
  const doc = useStudio((s) => s.doc);
  const issues = issuesForBlock(validateTemplate(doc), blockId);
  if (issues.length === 0) return null;
  const hasErrors = issues.some((issue) => issue.severity === 'error');
  return (
    <ul
      className={`wts-issue-list${hasErrors ? ' has-errors' : ' has-warnings'}`}
      role="alert"
    >
      {issues.map((issue, i) => (
        <li key={i} className={`wts-issue-item wts-issue-item--${issue.severity}`}>
          {issue.severity === 'error' ? (
            <AlertCircle className="wts-issue-icon" aria-hidden="true" />
          ) : (
            <AlertTriangle className="wts-issue-icon" aria-hidden="true" />
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function SortableButtonRow({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-card'
      } ${isDragging ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={onClick}>
        {label}
      </button>
      <Button
        type="button"
        variant="ghost-destructive"
        size="icon"
        className="size-6 shrink-0"
        aria-label={`Remove ${label}`}
        onClick={() => removeButton(id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function ButtonsOrderList() {
  const doc = useStudio((s) => s.doc);
  const selection = useStudio((s) => s.selection);
  const buttons = doc.blocks.buttons;
  if (buttons.length === 0) return null;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = buttons.findIndex((b) => b.id === active.id);
    const to = buttons.findIndex((b) => b.id === over.id);
    if (from >= 0 && to >= 0) reorderButtons(from, to);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Button order
      </h3>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={buttons.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {buttons.map((b) => {
            const plugin = getButtonPlugin(b.type);
            const data = b.data as { text?: string };
            return (
              <SortableButtonRow
                key={b.id}
                id={b.id}
                label={data.text?.trim() || plugin?.meta.label || b.type}
                active={selection.kind === 'button' && selection.id === b.id}
                onClick={() => select({ kind: 'button', id: b.id })}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function InspectorPanel() {
  const doc = useStudio((s) => s.doc);
  const selection = useStudio((s) => s.selection);
  const compact = useStudio((s) => s.inspectorMode === 'compact');
  const hasGallery = useStudio((s) => s.galleryTemplates.length > 0);

  let content: React.ReactNode = null;
  let title = 'Template';
  let removable: (() => void) | null = null;

  if (selection.kind === 'block') {
    const instance = doc.blocks[selection.slot];
    const plugin = instance ? getBlockPlugin(instance.type) : undefined;
    if (instance && plugin) {
      title = plugin.meta.label;
      if (selection.slot !== 'body') {
        const slot = selection.slot as 'header' | 'footer';
        removable = () => removeBlock(slot);
      }
      const Editor = plugin.Editor;
      content = (
        <>
          <Editor
            value={instance.data}
            onChange={(data) => updateBlockData(selection.slot, data)}
            doc={doc}
          />
          <IssueList blockId={instance.id} />
        </>
      );
    }
  } else if (selection.kind === 'button') {
    const instance = doc.blocks.buttons.find((b) => b.id === selection.id);
    const plugin = instance ? getButtonPlugin(instance.type) : undefined;
    if (instance && plugin) {
      title = `${plugin.meta.label} button`;
      removable = () => removeButton(instance.id);
      const Editor = plugin.Editor;
      content = (
        <>
          <Editor
            value={instance.data}
            onChange={(data) => updateButtonData(instance.id, data)}
            doc={doc}
          />
          <IssueList blockId={instance.id} />
        </>
      );
    }
  }

  if (!content) {
    if (hasGallery) {
      title = 'Templates';
      content = <TemplateGallery />;
    } else {
      title = 'Template';
      content = (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Select a block in the preview to edit it, or add components from the library.
        </p>
      );
    }
  }

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border bg-background"
      aria-label="Properties"
    >
      {!compact && (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">{title}</h2>
            {removable && (
              <Button
                variant="ghost-destructive"
                size="icon"
                aria-label={`Remove ${title}`}
                onClick={removable}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          <Separator />
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-4">
              {content}
              {selection.kind === 'button' && (
                <>
                  <Separator />
                  <ButtonsOrderList />
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
}
