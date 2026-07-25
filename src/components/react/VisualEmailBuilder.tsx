import { useEffect, useRef, useState } from 'react';
import type {
  EmailBuilderProps,
  EmailBuilderRef,
  MergeTagGroup,
  TEditorConfiguration,
} from 'email-builder-standalone';
import { api } from '@/lib/app/api';
import { buildMergeTagMenu, type CustomField } from '@/lib/app/custom-fields';
import { builderGenerateTemplate, builderTextAction } from '@/lib/app/services';
import { TEMPLATE_CATEGORIES, defaultTemplateCategory } from '@/lib/app/templates-data';
import {
  normalizeTemplateLanguageCode,
  TEMPLATE_LANGUAGE_OPTIONS,
  templateLanguageFlagSrc,
} from '@/lib/app/template-language';
import Icon from './Icon';
import { useToast } from './shared/useToast';
import ChannelEditorShell, { shellStyles } from './shared/ChannelEditorShell';
import { CHANNEL } from './shared/channels';
import { useAutosave } from './shared/useAutosave';

/**
 * Full-screen wrapper around EmailBuilder.js (vendored email-builder-standalone) — the visual
 * email editor. Email-channel only; SMS/WhatsApp/Voice use the composer. Shares
 * EditorHeader with the composer so the two read as one product.
 *
 * The package pulls in react-dom/client and browser-only APIs, so it must never
 * load during Astro SSR: we dynamic-import both the module and its stylesheet in
 * an effect (client-only) and render a loading state until it resolves.
 */

type BuilderComponent = React.ComponentType<
  EmailBuilderProps & { ref?: React.Ref<EmailBuilderRef> }
>;

export type VisualEmailBuilderSave = {
  name: string;
  html: string;
  document: TEditorConfiguration;
  category: string;
  language: string;
};

type Props = {
  name: string | null;
  /** Existing design to reopen for editing (builderDoc JSON), if any. */
  initialDocument?: TEditorConfiguration | string;
  initialCategory?: string;
  initialLanguage?: string | null;
  kind?: 'template' | 'campaign';
  onClose: () => void;
  onSave: (value: VisualEmailBuilderSave) => void | Promise<void>;
};

export default function VisualEmailBuilder({
  name,
  initialDocument,
  initialCategory,
  initialLanguage,
  kind = 'template',
  onClose,
  onSave,
}: Props) {
  const builderRef = useRef<EmailBuilderRef>(null);
  const [Builder, setBuilder] = useState<BuilderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState(name ?? '');
  const [category, setCategory] = useState(() =>
    defaultTemplateCategory('email', initialCategory ?? 'Newsletter'),
  );
  const [language, setLanguage] = useState(() => normalizeTemplateLanguageCode(initialLanguage));
  // Real personalization tokens for the editor's merge-tag menus. Starts with
  // the always-present subscriber fields; workspace custom fields are appended
  // once fetched. Never the vendor's placeholder tags from another ESP.
  const [mergeTags, setMergeTags] = useState<MergeTagGroup>(() => buildMergeTagMenu([]));
  const { toast, show } = useToast();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<{ data: CustomField[] }>('custom-fields');
        if (alive) setMergeTags(buildMergeTagMenu(res.data));
      } catch {
        // No workspace/custom fields reachable — keep the default subscriber
        // fields; the menu is still real, just without custom ones.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Client-only load of the editor + its stylesheet (kept out of SSR).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await import('email-builder-standalone/style.css');
        const mod = await import('email-builder-standalone');
        if (alive) setBuilder(() => mod.EmailBuilder as unknown as BuilderComponent);
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : 'Failed to load the editor.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The editor is a large bundle (MUI, tiptap, drag-and-drop, image tools…).
  // In dev, the very first load after a cache clear can take a couple of
  // minutes while Vite transforms it all; without feedback that reads as a
  // hang rather than a one-time cold start. Step through reassuring copy
  // the longer it takes instead of a static "Loading editor…". None of this
  // matters in production, where the bundle is pre-built and loads quickly.
  const LOADING_STEPS = [
    'Loading editor…',
    'Preparing the editor — loading templates and sections…',
    'Still working on it — first load can take a minute…',
    'Almost there — setting up the canvas…',
  ];
  const [loadingStep, setLoadingStep] = useState(0);
  useEffect(() => {
    if (Builder || loadError) return;
    const timers = [
      setTimeout(() => setLoadingStep(1), 4_000),
      setTimeout(() => setLoadingStep(2), 20_000),
      setTimeout(() => setLoadingStep(3), 60_000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [Builder, loadError]);

  // Esc closes the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Persist current content (throws on failure so autosave/flush can react).
  const persist = async () => {
    const el = builderRef.current;
    if (!el) throw new Error('Editor not ready');
    const html = el.getHtml();
    const document = el.getDocument();
    await onSave({
      name: title.trim() || 'Untitled',
      html,
      document,
      category,
      language,
    });
  };

  const { status, markDirty, flush } = useAutosave(persist);

  const handleSaveDraft = async () => {
    const ok = await flush();
    show(ok ? `“${title.trim() || 'Untitled template'}” saved` : 'Could not save.');
  };

  const handleSendTest = () => show('Test message sent');

  return (
    <ChannelEditorShell
      channel="email"
      name={title}
      onNameChange={(v) => {
        setTitle(v);
        markDirty();
      }}
      kind={kind}
      status={status}
      category={category}
      categories={kind === 'template' ? TEMPLATE_CATEGORIES : undefined}
      onCategoryChange={
        kind === 'template'
          ? (v) => {
              setCategory(v);
              markDirty();
            }
          : undefined
      }
      language={kind === 'template' ? language : undefined}
      languageOptions={kind === 'template' ? TEMPLATE_LANGUAGE_OPTIONS : undefined}
      getLanguageFlagSrc={kind === 'template' ? templateLanguageFlagSrc : undefined}
      onLanguageChange={
        kind === 'template'
          ? (v) => {
              setLanguage(normalizeTemplateLanguageCode(v));
              markDirty();
            }
          : undefined
      }
      onBack={onClose}
      onSendTest={handleSendTest}
      onSaveDraft={() => void handleSaveDraft()}
      toast={
        toast ? (
          <div
            className={shellStyles.toast}
            role="status"
            style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
          >
            <span className={shellStyles.toastIcon}>
              <Icon name="check" size={13} stroke={3} />
            </span>
            {toast}
          </div>
        ) : null
      }
    >
      {loadError ? (
        <div className={shellStyles.state}>
          <p>Couldn’t load the email editor.</p>
          <p className={shellStyles.muted}>{loadError}</p>
        </div>
      ) : Builder ? (
        <Builder
          ref={builderRef}
          initialDocument={initialDocument}
          mergeTags={mergeTags}
          primaryColor={CHANNEL.email.hex}
          secondaryColor={CHANNEL.email.hex}
          height="100%"
          sticky
          /* Source-code and JSON views stay off: templates are edited
             visually here, and the raw HTML is an export concern rather than
             something to hand-edit inside the app. The component tree is off
             for the same reason — it exposes document structure that the
             canvas and inspector already cover. */
          htmlTab={false}
          jsonTab={false}
          componentTree={false}
          galleryImages
          unsplashEnabled
          unsplashBackendUrl={typeof window !== 'undefined' ? window.location.origin : ''}
          /* The "Save as template" button is off — templates aren't saved
             from here. The Templates tab (browse/apply saved templates)
             stays on via templateLibrary, so the two are independent.
             Theme saving stays off — themes are managed elsewhere. */
          templateSaving={false}
          templateLibrary
          themeSaving={false}
          componentsStorage="local"
          enableAI
          onAIGenerateTemplate={builderGenerateTemplate}
          onAIRequest={builderTextAction}
          onAutoSave={() => markDirty()}
        />
      ) : (
        <div className={shellStyles.state}>
          <span className={shellStyles.spinner} aria-hidden="true" />
          <p className={shellStyles.muted}>{LOADING_STEPS[loadingStep]}</p>
        </div>
      )}
    </ChannelEditorShell>
  );
}
