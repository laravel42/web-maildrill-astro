import * as React from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';

import { TooltipProvider } from '@/ui/tooltip';
import { registerBuiltInPlugins } from '@/blocks';
import { addButton, loadDraft, placeBlock, redo, replaceDoc, undo, useStudio } from '@/core/store';
import { CanvasPanel } from './CanvasPanel';
import { InspectorPanel } from './InspectorPanel';
import { LibraryPanel } from './LibraryPanel';
import { TopBar } from './TopBar';

registerBuiltInPlugins();

export interface StudioProps {
  /** Restore the last local draft on mount (default true). */
  restoreDraft?: boolean;
  /** Dark chrome for the studio UI itself (preview has its own toggle). */
  dark?: boolean;
}

/**
 * The WhatsApp Template Studio — four-panel layout:
 * top bar / library / live preview / properties.
 */
export function Studio({ restoreDraft = true, dark = false }: StudioProps) {
  // Restore draft once on mount.
  React.useEffect(() => {
    if (!restoreDraft) return;
    const draft = loadDraft();
    if (draft) replaceDoc(draft, { resetHistory: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDraft]);

  // Keyboard shortcuts: undo/redo.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || over.id !== 'canvas-drop') return;
    const payload = active.data.current as { kind: 'block' | 'button'; type: string; slot?: 'header' | 'body' | 'footer' } | undefined;
    if (!payload) return;
    if (payload.kind === 'button') addButton(payload.type);
    else if (payload.slot) placeBlock(payload.slot, payload.type);
  };

  return (
    <div className={dark ? 'wa-studio dark h-full min-h-0' : 'wa-studio h-full min-h-0'}>
      <TooltipProvider delayDuration={250}>
        <div className="flex h-full min-h-0 flex-col bg-background font-sans text-foreground antialiased">
          <TopBar />
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <LibraryPanel />
              <CanvasPanel />
              <InspectorPanel />
            </div>
          </DndContext>
        </div>
      </TooltipProvider>
    </div>
  );
}

/** Read the current studio state store (advanced embedding). */
export { useStudio };
