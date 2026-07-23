import * as React from 'react';
import { Check, Loader2, Moon, Monitor, Redo2, Smartphone, Sun, Undo2 } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Separator } from '@/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { CATEGORIES, LANGUAGES } from '@/core/limits';
import {
  redo,
  setCategory,
  setPreviewDark,
  setPreviewDevice,
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
  const previewDark = useStudio((s) => s.previewDark);
  const previewDevice = useStudio((s) => s.previewDevice);
  const saveState = useStudio((s) => s.saveState);

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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <div className="flex items-center gap-1.5 pr-1">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
          W
        </span>
        <span className="text-sm font-semibold tracking-tight">Template Studio</span>
      </div>
      <Separator orientation="vertical" className="h-6" />

      <Input
        value={doc.name}
        onChange={(e) => setTemplateField('name', e.target.value)}
        placeholder="template_name"
        aria-label="Template name"
        className="h-8 w-44 font-mono text-xs"
      />
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

      <div className="ml-auto flex items-center gap-1">
        <Badge variant="outline" className="mr-1 gap-1 text-[11px] font-normal text-muted-foreground">
          {saveState === 'saving' ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Saving
            </>
          ) : saveState === 'saved' ? (
            <>
              <Check className="size-3" /> Draft saved
            </>
          ) : (
            'Draft'
          )}
        </Badge>

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={previewDark ? 'Switch preview to light mode' : 'Switch preview to dark mode'}
              onClick={() => setPreviewDark(!previewDark)}
            >
              {previewDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Preview theme</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />
        <ImportExportControls />
      </div>
    </header>
  );
}
