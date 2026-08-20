import * as React from 'react';
import { z } from 'zod';
import { FileText, Film, Image as ImageIcon, Play, UploadCloud } from 'lucide-react';

import { Field } from '@/ui/field';
import { ImagePicker } from '@/ui/image-picker';
import { Input } from '@/ui/input';
import type { BlockPlugin, ValidationIssue } from '@/core/types';

/**
 * Media headers (image / video / document) share one implementation,
 * registered three times — format is part of the plugin type so each
 * appears as its own library tile, mirrors its own Meta format, and
 * can diverge later without refactoring.
 */

const schema = z.object({
  /** CDN URL or local object URL. */
  url: z.string(),
  /** Original file name (uploads); shown in the document chip. */
  fileName: z.string().optional(),
  /** Unsplash attribution when the image came from the stock picker. */
  credit: z
    .object({
      name: z.string(),
      profileUrl: z.string(),
      unsplashUrl: z.string(),
    })
    .optional(),
});

type Data = z.infer<typeof schema>;

const ACCEPT: Record<MediaFormat, string> = {
  IMAGE: 'image/jpeg,image/png,image/webp',
  VIDEO: 'video/mp4,video/3gpp',
  DOCUMENT: 'application/pdf',
};

type MediaFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

function MediaEditor({
  value,
  onChange,
  format,
}: {
  value: Data;
  onChange: (next: Data) => void;
  format: MediaFormat;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    onChange({ url: URL.createObjectURL(file), fileName: file.name });
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-label={`Upload ${format.toLowerCase()}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          acceptFile(e.dataTransfer.files[0]);
        }}
        className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <UploadCloud className="size-5" />
        Drop a file or click to upload
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[format]}
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
      <Field label="Or paste a CDN URL" hint="Used as the sample media for Meta review">
        <Input
          value={value.url.startsWith('blob:') ? '' : value.url}
          onChange={(e) => onChange({ url: e.target.value, fileName: undefined })}
          placeholder="https://cdn.example.com/hero.jpg"
        />
      </Field>
      {value.fileName && (
        <div className="text-xs text-muted-foreground">Uploaded: {value.fileName}</div>
      )}
    </div>
  );
}

function makeMediaHeaderPlugin(config: {
  type: string;
  format: MediaFormat;
  label: string;
  description: string;
  icon: BlockPlugin<Data>['meta']['icon'];
  keywords: string[];
}): BlockPlugin<Data> {
  return {
    type: config.type,
    slot: 'header',
    meta: {
      label: config.label,
      description: config.description,
      group: 'Headers',
      icon: config.icon,
      keywords: config.keywords,
    },
    schema,
    defaults: () => ({ url: '' }),
    availableIn: (category) =>
      category === 'AUTHENTICATION'
        ? { available: false, reason: 'Authentication templates have no custom header' }
        : { available: true },
    validate: (data) => {
      const issues: ValidationIssue[] = [];
      if (!data.url.trim()) {
        issues.push({
          severity: 'error',
          slot: 'header',
          code: 'header/media-missing',
          message: `${config.label}: add a file or URL`,
        });
      }
      return issues;
    },
    Editor: function HeaderMediaEditor({ value, onChange }) {
      // Images get the full stock-search + media-library picker (same UX as
      // the email editor's image inspector); video/document keep the URL flow.
      if (config.format === 'IMAGE') return <ImagePicker value={value} onChange={onChange} />;
      return <MediaEditor value={value} onChange={onChange} format={config.format} />;
    },
    Preview: function HeaderMediaPreview({ data, ctx }) {
      const placeholderClasses = `flex h-[118px] items-center justify-center rounded-[6px] ${
        ctx.dark ? 'bg-[#2a3942] text-[#8696a0]' : 'bg-[#f0f2f5] text-[#667781]'
      }`;

      if (config.format === 'IMAGE') {
        return data.url ? (
          <img
            src={data.url}
            alt=""
            className="block max-h-[180px] w-full rounded-[6px] object-cover"
          />
        ) : (
          <div className={placeholderClasses}>
            <ImageIcon className="size-7" />
          </div>
        );
      }
      if (config.format === 'VIDEO') {
        return (
          <div className={`relative ${placeholderClasses}`}>
            {data.url && !data.url.startsWith('blob:') ? null : null}
            <span
              className={`flex size-11 items-center justify-center rounded-full ${
                ctx.dark ? 'bg-black/50 text-white' : 'bg-black/40 text-white'
              }`}
            >
              <Play className="size-5 translate-x-px" />
            </span>
          </div>
        );
      }
      // DOCUMENT
      return (
        <div
          className={`flex items-center gap-2.5 rounded-[6px] p-2.5 ${
            ctx.dark ? 'bg-[#2a3942] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
          }`}
        >
          <FileText className={ctx.dark ? 'size-6 text-[#8696a0]' : 'size-6 text-[#667781]'} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">
              {data.fileName || data.url.split('/').pop() || 'Document.pdf'}
            </div>
            <div className={`text-[11px] ${ctx.dark ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
              PDF
            </div>
          </div>
        </div>
      );
    },
    toMeta: (data) => ({
      type: 'HEADER',
      format: config.format,
      ...(data.url ? { example: { header_handle: [data.url] } } : {}),
    }),
    fromMeta: (component) => {
      if (String(component.type).toUpperCase() !== 'HEADER') return null;
      if (String(component.format ?? '').toUpperCase() !== config.format) return null;
      const handle = (component.example as { header_handle?: string[] } | undefined)
        ?.header_handle?.[0];
      return { url: handle ?? '' };
    },
  };
}

export const headerImagePlugin = makeMediaHeaderPlugin({
  type: 'header-image',
  format: 'IMAGE',
  label: 'Image header',
  description: 'JPEG, PNG or WebP hero image',
  icon: ImageIcon,
  keywords: ['photo', 'picture', 'hero'],
});

export const headerVideoPlugin = makeMediaHeaderPlugin({
  type: 'header-video',
  format: 'VIDEO',
  label: 'Video header',
  description: 'MP4 or 3GPP video',
  icon: Film,
  keywords: ['mp4', 'clip'],
});

export const headerDocumentPlugin = makeMediaHeaderPlugin({
  type: 'header-document',
  format: 'DOCUMENT',
  label: 'Document header',
  description: 'PDF attachment preview',
  icon: FileText,
  keywords: ['pdf', 'attachment', 'file'],
});
