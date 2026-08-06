import { Suspense, useRef } from 'react';
import type { ChannelType } from '@/types/app';
import type { TEditorConfiguration } from 'email-builder-standalone';
import { routes } from '@/config/routes';
import { api, ApiError } from '@/lib/app/api';
import { lazyWithRetry } from '@/lib/app/lazy-with-retry';
import type { ApiTemplate } from '@/lib/app/template-map';
import LazyBoundary from './shared/LazyBoundary';
import SmsBuilder from './SmsBuilder';
import VoiceBuilder from './VoiceBuilder';
import type { ComposerSavePayload } from './shared/useMessageDraft';

// Lazy: both visual editors are large bundles (MUI/tiptap for email, the WA
// studio's Tailwind/Radix build for WhatsApp). Each channel page mounts only
// its own editor, so defer the fetch until that editor actually renders.
// lazyWithRetry: Vite can 504 mid-session while re-optimizing these deps.
const VisualEmailBuilder = lazyWithRetry(() => import('./VisualEmailBuilder'));
const WaTemplateStudioEditor = lazyWithRetry(() => import('./WaTemplateStudioEditor'));

type Props = {
  channel: ChannelType;
  /** Saved row when editing (SSR-fetched by the page); null when starting fresh. */
  template: ApiTemplate | null;
  /** Connected workspace — saves persist through the product API. */
  live: boolean;
  /** Demo-mode prefills when there is no saved row to fetch. */
  presetName?: string | null;
  presetCategory?: string | null;
};

/**
 * Channel template builder page body. Every channel's builder lives on its own
 * URL (/dashboard/templates/<channel>), and the create/update logic lives here
 * — the global templates screen only links to these pages.
 */
export default function TemplateBuilderPage({
  channel,
  template,
  live,
  presetName,
  presetCategory,
}: Props) {
  // Flips from undefined to the created row's id on first save so every later
  // save (including autosave) PATCHes in place instead of POSTing duplicates.
  const idRef = useRef<string | undefined>(template?.id);

  const close = () => window.location.assign(routes.app.templates);

  /* Create-or-update. Local (no-workspace) mode just acknowledges; errors
     propagate so the editors surface them. */
  const persist = async (body: Record<string, unknown>) => {
    if (!live) return;
    if (idRef.current) {
      await api.patch<ApiTemplate>(`templates/${idRef.current}`, body);
      return;
    }
    const created = await api.post<ApiTemplate>('templates', body);
    idRef.current = created.id;
    // Reflect the saved row in the URL so refresh/share keeps editing it.
    window.history.replaceState(null, '', `?id=${encodeURIComponent(created.id)}`);
  };

  const name = template?.name ?? presetName ?? null;
  const category = template?.category ?? presetCategory ?? undefined;

  if (channel === 'email') {
    return (
      <LazyBoundary label="the email editor" onClose={close}>
        <Suspense fallback={null}>
          <VisualEmailBuilder
            name={name}
            initialDocument={(template?.builderDoc as TEditorConfiguration | null) ?? undefined}
            initialCategory={category}
            initialLanguage={template?.language}
            onClose={close}
            onSave={({ name: savedName, html, document, category: savedCategory, language }) =>
              persist({
                name: savedName && savedName !== 'Untitled' ? savedName : 'Untitled template',
                channel: 'email',
                html,
                builderDoc: document as Record<string, unknown>,
                category: savedCategory,
                language,
              })
            }
          />
        </Suspense>
      </LazyBoundary>
    );
  }

  if (channel === 'whatsapp') {
    return (
      <LazyBoundary label="the WhatsApp template editor" onClose={close}>
        <Suspense fallback={null}>
          <WaTemplateStudioEditor
            name={name}
            language={template?.language}
            text={template?.text}
            category={category}
            builderDoc={template?.builderDoc}
            components={template?.components}
            onClose={close}
            onSave={(fields) =>
              persist({
                name: fields.name,
                channel: 'whatsapp',
                text: fields.text,
                category: fields.category,
                language: fields.language,
                builderDoc: fields.builderDoc,
                components: fields.components,
              })
            }
          />
        </Suspense>
      </LazyBoundary>
    );
  }

  /* SMS / Voice: the lightweight text composers. */
  const saveComposer = ({
    channel: savedChannel,
    name: savedName,
    message,
    category: savedCategory,
    language,
    builderDoc,
  }: ComposerSavePayload) =>
    persist({
      name: savedName && savedName !== 'Untitled' ? savedName : 'Untitled template',
      channel: savedChannel,
      text: message || null,
      category: savedCategory,
      language,
      ...(builderDoc !== undefined ? { builderDoc } : {}),
    });

  const composerProps = {
    name,
    initialCategory: category,
    initialLanguage: template?.language,
    initialMessage: template?.text ?? undefined,
    onClose: close,
    onSave: saveComposer,
  };

  if (channel === 'sms') return <SmsBuilder {...composerProps} />;
  return <VoiceBuilder {...composerProps} initialBuilderDoc={template?.builderDoc ?? null} />;
}
