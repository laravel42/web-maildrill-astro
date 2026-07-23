import * as React from 'react';
import { Braces, Check, Copy, Download, Upload } from 'lucide-react';

import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import { Textarea } from '@/ui/textarea';
import { replaceDoc, useStudio } from '@/core/store';
import { fromMetaJson, toInternalJson, toMetaJsonString } from '@/core/serialize';
import { hasErrors, validateTemplate } from '@/core/validation';

/** Export + Import dialogs for the top bar. */
export function ImportExportControls() {
  return (
    <>
      <ImportDialog />
      <ExportDialog />
    </>
  );
}

function ImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const doImport = () => {
    try {
      const doc = fromMetaJson(raw);
      replaceDoc(doc, { resetHistory: true });
      setOpen(false);
      setRaw('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Upload className="size-3.5" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Meta template</DialogTitle>
          <DialogDescription>
            Paste a template JSON from the WhatsApp Business API — it becomes editable blocks. Unknown components are
            preserved and re-exported untouched.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          placeholder='{"name":"order_update","language":"en_US","category":"UTILITY","components":[…]}'
          className="font-mono text-xs"
          aria-label="Template JSON"
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button onClick={doImport} disabled={!raw.trim()}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog() {
  const doc = useStudio((s) => s.doc);
  const [open, setOpen] = React.useState(false);
  const [pretty, setPretty] = React.useState(true);
  const [internal, setInternal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const issues = React.useMemo(() => (open ? validateTemplate(doc) : []), [open, doc]);
  const blocked = hasErrors(issues);

  const json = React.useMemo(() => {
    if (!open) return '';
    if (internal) return toInternalJson(doc);
    // Non-strict here: the dialog SHOWS the payload but gates copying.
    return toMetaJsonString(doc, pretty);
  }, [open, doc, pretty, internal]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Download className="size-3.5" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export template</DialogTitle>
          <DialogDescription>
            {internal
              ? 'Internal studio format — re-importable with full fidelity.'
              : 'Meta template-creation payload for the WhatsApp Business API.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Switch id="exp-pretty" checked={pretty} onCheckedChange={setPretty} disabled={internal} />
            <Label htmlFor="exp-pretty" className="text-xs">
              Pretty
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="exp-internal" checked={internal} onCheckedChange={setInternal} />
            <Label htmlFor="exp-internal" className="text-xs">
              Internal format
            </Label>
          </div>
        </div>
        <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {json}
        </pre>
        {blocked && !internal && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
            <Braces className="size-3.5" />
            {issues.filter((i) => i.severity === 'error').length} validation error(s) — fix them to copy a valid payload.
          </p>
        )}
        <DialogFooter>
          <Button onClick={copy} disabled={blocked && !internal} className="gap-1.5">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
