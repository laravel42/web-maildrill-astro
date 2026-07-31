import { lazy, Suspense, useRef } from 'react';
import type { ChannelType, TemplateApprovalStatus } from '@/types/app';
import type { TEditorConfiguration } from 'email-builder-standalone';
import { routes } from '@/config/routes';
import { api, ApiError } from '@/lib/app/api';
import type { ApiTemplate } from '@/lib/app/template-map';
import { toApprovalStatus } from '@/lib/app/template-map';
import EmailBuilder from './EmailBuilder';
import LazyBoundary from './shared/LazyBoundary';

// Lazy: both visual editors are large bundles (MUI/tiptap for email, the WA
// studio's Tailwind/Radix build for WhatsApp). Each channel page mounts only
// its own editor, so defer the fetch until that editor actually renders.
const VisualEmailBuilder = lazy(() => import('./VisualEmailBuilder'));
const WaTemplateStudioEditor = lazy(() => import('./WaTemplateStudioEditor'));

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
    const submitApproval = async (): Promise<TemplateApprovalStatus> => {
      if (!live) throw new Error('Connect a workspace to submit templates');
      // Ensure the row exists before POST /submit (create-on-first-save).
      if (!idRef.current) throw new Error('Save the template before requesting approval');
      try {
        const updated = await api.post<ApiTemplate>(`templates/${idRef.current}/submit`, {});
        return toApprovalStatus(updated.approvalStatus) ?? 'pending';
      } catch (e) {
        throw new Error(e instanceof ApiError ? e.message : 'Could not submit for approval', {
          cause: e,
        });
      }
    };
    const refreshApproval = async (): Promise<TemplateApprovalStatus> => {
      if (!live || !idRef.current) throw new Error('Connect a workspace to refresh status');
      try {
        const updated = await api.post<ApiTemplate>(
          `templates/${idRef.current}/refresh-status`,
          {},
        );
        return toApprovalStatus(updated.approvalStatus) ?? 'pending';
      } catch (e) {
        throw new Error(e instanceof ApiError ? e.message : 'Could not refresh status', {
          cause: e,
        });
      }
    };

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
            approvalStatus={toApprovalStatus(template?.approvalStatus)}
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
            onSubmitForApproval={live ? submitApproval : undefined}
            onRefreshApproval={live ? refreshApproval : undefined}
          />
        </Suspense>
      </LazyBoundary>
    );
  }

  /* SMS / Voice keep the lightweight text composer. */
  return (
    <EmailBuilder
      channel={channel}
      name={name}
      kind="template"
      initialCategory={category}
      initialLanguage={template?.language}
      initialMessage={template?.text ?? undefined}
      initialBuilderDoc={template?.builderDoc ?? null}
      onClose={close}
      onSave={({
        channel: savedChannel,
        name: savedName,
        message,
        category: savedCategory,
        language,
        builderDoc,
      }) =>
        persist({
          name: savedName && savedName !== 'Untitled' ? savedName : 'Untitled template',
          channel: savedChannel,
          text: message || null,
          category: savedCategory,
          language,
          ...(builderDoc !== undefined ? { builderDoc } : {}),
        })
      }
    />
  );
}
