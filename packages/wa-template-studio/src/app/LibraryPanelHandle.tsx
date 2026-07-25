import { Library } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import {
  INSPECTOR_COMPACT_WIDTH,
  LIBRARY_COMPACT_WIDTH,
  LIBRARY_FULL_WIDTH,
} from '@/core/panel-layout';
import { toggleLibraryOpen, useStudio } from '@/core/store';

/** Vertical tab on the library rail edge — matches email-builder ComponentsLibraryHandle. */
export function LibraryPanelHandle() {
  const open = useStudio((s) => s.libraryOpen);
  const drawerWidth = open ? LIBRARY_FULL_WIDTH : LIBRARY_COMPACT_WIDTH;

  return (
    <div className="wts-panel-handle wts-panel-handle--library" style={{ left: drawerWidth }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`wts-panel-handle-btn wts-panel-handle-btn--library${open ? ' is-active' : ''}`}
            aria-label={open ? 'Close components library' : 'Open components library'}
            onClick={toggleLibraryOpen}
          >
            <Library className="size-[18px] shrink-0" aria-hidden />
            <span className="wts-panel-handle-label">Library</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {open ? 'Close components library' : 'Open components library'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}