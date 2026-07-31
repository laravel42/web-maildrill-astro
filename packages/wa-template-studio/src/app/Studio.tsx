import * as React from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';

import { TooltipProvider } from '@/ui/tooltip';
import { registerBuiltInPlugins } from '@/blocks';
import {
  INSPECTOR_COMPACT_WIDTH,
  INSPECTOR_FULL_WIDTH,
  LIBRARY_COMPACT_WIDTH,
  LIBRARY_FULL_WIDTH,
  PANEL_TRANSITION,
} from '@/core/panel-layout';
import {
  addButton,
  loadDraft,
  placeBlock,
  redo,
  replaceDoc,
  setInspectorMode,
  undo,
  useStudio,
} from '@/core/store';
import { CanvasPanel } from './CanvasPanel';
import { InspectorPanel } from './InspectorPanel';
import { InspectorPanelHandle } from './InspectorPanelHandle';
import { LibraryPanel } from './LibraryPanel';
import { LibraryPanelHandle } from './LibraryPanelHandle';
import { TopBar, type ApprovalStatus } from './TopBar';

registerBuiltInPlugins();

export interface StudioProps {
  /** Restore the last local draft on mount (default true). */
  restoreDraft?: boolean;
  /** Dark chrome for the studio UI itself (preview has its own toggle). */
  dark?: boolean;
  /** Toolbar accent (channel identity). Falls back to `--primary`. */
  accentColor?: string;
  /** Current Meta approval state when hosted by Maildrill. */
  approvalStatus?: ApprovalStatus | null;
  /** True while save/submit/refresh is in flight. */
  approvalBusy?: boolean;
  /**
   * Host callback for the top-bar approval control. When omitted the button
   * is hidden (standalone studio). Enabled only when the doc has content and
   * passes Meta validation (or when refreshing a pending review).
   */
  onRequestApproval?: () => void | Promise<void>;
}

/**
 * The WhatsApp Template Studio — four-panel layout:
 * top bar / library / live preview / properties.
 */
export function Studio({
  restoreDraft = true,
  dark = false,
  accentColor,
  approvalStatus,
  approvalBusy,
  onRequestApproval,
}: StudioProps) {
  const libraryOpen = useStudio((s) => s.libraryOpen);
  const inspectorMode = useStudio((s) => s.inspectorMode);

  const libraryWidth = libraryOpen ? LIBRARY_FULL_WIDTH : LIBRARY_COMPACT_WIDTH;
  // Collapsed inspector is fully hidden (width 0) so the canvas reclaims the space —
  // no leftover white rail. Only the floating handle stays to reopen it.
  const inspectorCollapsed = inspectorMode !== 'full';
  const inspectorWidth = inspectorCollapsed ? 0 : INSPECTOR_FULL_WIDTH;

  // Restore draft once on mount.
  React.useEffect(() => {
    if (!restoreDraft) return;
    const draft = loadDraft();
    if (draft) replaceDoc(draft, { resetHistory: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDraft]);

  // The inspector is visible by default whenever the studio opens. The store is a
  // module-level singleton that survives editor close/reopen, so reset any prior
  // collapsed state on mount.
  React.useEffect(() => {
    setInspectorMode('full');
  }, []);

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
    const payload = active.data.current as
      { kind: 'block' | 'button'; type: string; slot?: 'header' | 'body' | 'footer' } | undefined;
    if (!payload) return;
    if (payload.kind === 'button') addButton(payload.type);
    else if (payload.slot) placeBlock(payload.slot, payload.type);
  };

  return (
    <div
      className={dark ? 'wa-studio dark h-full min-h-0' : 'wa-studio h-full min-h-0'}
      style={
        accentColor
          ? ({
              '--wts-accent': accentColor,
              '--wts-accent-foreground': '#ffffff',
            } as React.CSSProperties)
          : undefined
      }
    >
      <TooltipProvider delayDuration={250}>
        <div className="flex h-full min-h-0 flex-col bg-background font-sans text-foreground antialiased">
          <TopBar
            approvalStatus={approvalStatus}
            approvalBusy={approvalBusy}
            onRequestApproval={onRequestApproval}
          />
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {/* Left floating panel */}
              <div
                className="wts-side-panel wts-side-panel--library"
                style={{ width: libraryWidth, transition: PANEL_TRANSITION }}
              >
                <LibraryPanel />
              </div>
              <LibraryPanelHandle />

              {/* Compact library rail spacer */}
              <div
                aria-hidden
                className="pointer-events-none shrink-0"
                style={{ width: LIBRARY_COMPACT_WIDTH, transition: PANEL_TRANSITION }}
              />

              <CanvasPanel />

              {/* Inspector rail spacer — collapses to 0 so the canvas fills the gap */}
              <div
                aria-hidden
                className="pointer-events-none shrink-0"
                style={{
                  width: inspectorCollapsed ? 0 : INSPECTOR_COMPACT_WIDTH,
                  transition: PANEL_TRANSITION,
                }}
              />

              {/* Right floating panel */}
              <div
                className={`wts-side-panel wts-side-panel--inspector${inspectorCollapsed ? ' is-collapsed' : ''}`}
                style={{ width: inspectorWidth, transition: PANEL_TRANSITION }}
              >
                <InspectorPanelHandle />
                <InspectorPanel />
              </div>
            </div>
          </DndContext>
        </div>
      </TooltipProvider>
    </div>
  );
}

/** Read the current studio state store (advanced embedding). */
export { useStudio };
