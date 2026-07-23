import * as React from 'react';
import { Monitor, Pencil, Play, Redo2, Smartphone, Undo2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Separator } from '@/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { CATEGORIES, LANGUAGES } from '@/core/limits';
import {
  redo,
  setCategory,
  setPreviewDevice,
  setPreviewMode,
  setTemplateField,
  undo,
  useStudio,
} from '@/core/store';
import { placeBlock } from '@/core/store';
import type { TemplateCategory } from '@/core/types';
import { ImportExportControls } from './ImportExportDialog';

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
};

export function TopBar() {
  const doc = useStudio((s) => s.doc);
  const past = useStudio((s) => s.past.length);
  const future = useStudio((s) => s.future.length);
  const previewDevice = useStudio((s) => s.previewDevice);
  const previewMode = useStudio((s) => s.previewMode);

  const onCategoryChange = (category: TemplateCategory) => {
    setCategory(category);
    // Swap slot content to category-appropriate plugins so the doc
    // stays coherent (undo restores everything in one step).
    if (category === 'AUTHENTICATION') {
      placeBlock('body', 'body-auth');
      placeBlock('footer', 'footer-auth');
    } else if (doc.category === 'AUTHENTICATION') {
      placeBlock('body', 'body');
    }
  };

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <Select value={doc.language} onValueChange={(v) => setTemplateField('language', v)}>
        <SelectTrigger className="h-8 w-24 text-xs" aria-label="Language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={doc.category} onValueChange={(v) => onCategoryChange(v as TemplateCategory)}>
        <SelectTrigger className="h-8 w-36 text-xs" aria-label="Template category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Edit / Test segmented toggle — centered in the bar like Figma's
          play mode, independent of the side groups' widths. */}
      <div
        role="group"
        aria-label="Preview mode"
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-lg border border-border bg-muted/60 p-0.5"
      >
        <Button
          variant={previewMode === 'edit' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={previewMode === 'edit'}
          onClick={() => setPreviewMode('edit')}
          className="h-7 gap-1.5 px-2.5"
        >
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button
          variant={previewMode === 'interact' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={previewMode === 'interact'}
          onClick={() => setPreviewMode('interact')}
          className="h-7 gap-1.5 px-2.5"
        >
          <Play className="size-3.5" /> Test
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Undo" disabled={past === 0} onClick={undo}>
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo ⌘Z</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Redo" disabled={future === 0} onClick={redo}>
              <Redo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo ⇧⌘Z</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={previewDevice === 'mobile' ? 'Switch to desktop preview' : 'Switch to mobile preview'}
              onClick={() => setPreviewDevice(previewDevice === 'mobile' ? 'desktop' : 'mobile')}
            >
              {previewDevice === 'mobile' ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Preview device</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ImportExportControls />
      </div>
    </header>
  );
}
