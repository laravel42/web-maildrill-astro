import { SlidersHorizontal } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { toggleInspectorMode, useStudio } from '@/core/store';

/** Vertical tab on the inspector edge — matches email-builder InspectorHandle. */
export function InspectorPanelHandle() {
  const mode = useStudio((s) => s.inspectorMode);
  const isCompact = mode === 'compact';

  return (
    <div className="wts-panel-handle wts-panel-handle--inspector">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`wts-panel-handle-btn wts-panel-handle-btn--inspector${isCompact ? ' is-active' : ''}`}
            aria-label={isCompact ? 'Expand panel' : 'Compact panel'}
            onClick={toggleInspectorMode}
          >
            <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{isCompact ? 'Expand panel' : 'Compact panel'}</TooltipContent>
      </Tooltip>
    </div>
  );
}
