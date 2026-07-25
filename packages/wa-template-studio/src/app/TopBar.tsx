import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import {
  redo,
  setPreviewDevice,
  setPreviewMode,
  undo,
  useStudio,
} from '@/core/store';
import { ToolbarIconButton } from './ToolbarIconButton';
import {
  IconDesktop,
  IconEditMode,
  IconMobile,
  IconPreviewMode,
  IconRedo,
  IconUndo,
} from './ToolbarIcons';

function PreviewModeToggle({
  mode,
  onChange,
}: {
  mode: 'edit' | 'interact';
  onChange: (mode: 'edit' | 'interact') => void;
}) {
  return (
    <div className="wts-mode-tabs absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" role="tablist" aria-label="Preview mode">
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            variant="tab"
            role="tab"
            aria-selected={mode === 'edit'}
            aria-label="Edit"
            active={mode === 'edit'}
            onClick={() => onChange('edit')}
          >
            <IconEditMode />
          </ToolbarIconButton>
        </TooltipTrigger>
        <TooltipContent side="bottom">Edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            variant="tab"
            role="tab"
            aria-selected={mode === 'interact'}
            aria-label="Preview"
            active={mode === 'interact'}
            onClick={() => onChange('interact')}
          >
            <IconPreviewMode />
          </ToolbarIconButton>
        </TooltipTrigger>
        <TooltipContent side="bottom">Preview</TooltipContent>
      </Tooltip>
    </div>
  );
}

function DeviceToggle({
  device,
  onChange,
}: {
  device: 'desktop' | 'mobile';
  onChange: (device: 'desktop' | 'mobile') => void;
}) {
  return (
    <div className="wts-device-toggle" role="group" aria-label="Preview device">
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            aria-label="Desktop preview"
            aria-pressed={device === 'desktop'}
            active={device === 'desktop'}
            onClick={() => onChange('desktop')}
          >
            <IconDesktop />
          </ToolbarIconButton>
        </TooltipTrigger>
        <TooltipContent side="bottom">Desktop preview</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            aria-label="Mobile preview"
            aria-pressed={device === 'mobile'}
            active={device === 'mobile'}
            onClick={() => onChange('mobile')}
          >
            <IconMobile />
          </ToolbarIconButton>
        </TooltipTrigger>
        <TooltipContent side="bottom">Mobile preview</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function TopBar() {
  const past = useStudio((s) => s.past.length);
  const future = useStudio((s) => s.future.length);
  const previewDevice = useStudio((s) => s.previewDevice);
  const previewMode = useStudio((s) => s.previewMode);

  return (
    <header className="relative z-10 flex h-[50px] shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <PreviewModeToggle mode={previewMode} onChange={setPreviewMode} />

      <div className="ml-auto flex items-center">
        <div className="wts-undo-redo">
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarIconButton variant="action" aria-label="Undo" disabled={past === 0} onClick={undo}>
                <IconUndo />
              </ToolbarIconButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">Undo ⌘Z</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarIconButton variant="action" aria-label="Redo" disabled={future === 0} onClick={redo}>
                <IconRedo />
              </ToolbarIconButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">Redo ⇧⌘Z</TooltipContent>
          </Tooltip>
        </div>

        <DeviceToggle
          device={previewDevice}
          onChange={(next) => setPreviewDevice(next)}
        />
      </div>
    </header>
  );
}
