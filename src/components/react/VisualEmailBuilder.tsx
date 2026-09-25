import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EmailBuilderProps,
  EmailBuilderRef,
  MergeTagGroup,
  TEditorConfiguration,
  TourAnalyticsEvent,
} from 'email-builder-standalone';
import { api, ApiError } from '@/lib/app/api';
import { buildMergeTagMenu, type CustomField } from '@/lib/app/custom-fields';
import { dataUrlToFile, uploadMediaFile } from '@/lib/app/media-upload';
import { builderGenerateTemplate, builderTextAction } from '@/lib/app/services';
import { TEMPLATE_CATEGORIES, defaultTemplateCategory } from '@/lib/app/templates-data';
import {
  normalizeTemplateLanguageCode,
  TEMPLATE_LANGUAGE_OPTIONS,
  templateLanguageFlagSrc,
} from '@/lib/app/template-language';
import ToastHost from './shared/ToastHost';
import MediaPickerModal, { type MediaPickerImage } from './shared/MediaPickerModal';
import SendTestModal from './shared/SendTestModal';
import { useToast } from './shared/useToast';
import ChannelEditorShell, { shellStyles } from './shared/ChannelEditorShell';
import { CHANNEL } from './shared/channels';
import { retryDynamicImport } from '@/lib/app/retry-dynamic-import';
import { useAutosave } from './shared/useAutosave';
import { useHostTheme } from './hooks/useHostTheme';

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
  /** Sends the saved template to the given recipients; host owns the API call. */
  onSendTest?: (to: string[]) => Promise<{ to: string[] }>;
  /**
   * Forces or silences the guided product tour (F4,
   * docs/product-tour-driverjs-plan.md §4). Optional — omitting it keeps the
   * current behavior (tour enabled, auto-starts once per browser). Pass
   * `false` to suppress it entirely for a given mount (e.g. an embed context
   * that shouldn't offer it).
   */
  tourEnabled?: boolean;
  /**
   * Receives the tour's analytics events. The mapping to
   * `window.posthog?.capture(...)` lives HERE, in the host — never inside
   * `email-builder-standalone` (§0.2/§0.7 of the plan). Optional: omitting it
   * means tour events aren't tracked, matching current behavior.
   */
  onTourEvent?: (event: TourAnalyticsEvent) => void;
};

export default function VisualEmailBuilder({
  name,
  initialDocument,
  initialCategory,
  initialLanguage,
  kind = 'template',
  onClose,
  onSave,
  onSendTest,
  tourEnabled,
  onTourEvent,
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
  // Media-library picker behind the image panel's "Browse gallery" button.
  const [mediaOpen, setMediaOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const { toast, show } = useToast();
  // D30: the host decides the theme, the package receives it as a prop — the
  // editor itself never reads data-theme/prefers-color-scheme.
  const hostTheme = useHostTheme();

  // The builder's image/background inputs dispatch `toggle-media-library` when
  // the user clicks "Browse gallery" (shown because we pass `galleryImages`).
  useEffect(() => {
    const onToggle = () => setMediaOpen(true);
    window.addEventListener('toggle-media-library', onToggle);
    return () => window.removeEventListener('toggle-media-library', onToggle);
  }, []);

  // Image/background Upload tab → workspace media library (S3 + register).
  // ImageInput reads the file as a data URL and fires this event; we PUT to
  // storage and answer with the public URL so the block can commit it.
  useEffect(() => {
    const onUpload = (event: Event) => {
      const { images, id } = (event as CustomEvent<{ images: string[]; id: string }>).detail ?? {
        images: [],
        id: '',
      };
      void (async () => {
        try {
          const dataUrl = images[0];
          if (!dataUrl) throw new Error('No image to upload');
          const file = dataUrlToFile(dataUrl, `email-${Date.now()}`);
          const asset = await uploadMediaFile(file);
          window.dispatchEvent(
            new CustomEvent('email-builder-upload-image-receive', {
              detail: { id, url: asset.url, data: null },
            }),
          );
        } catch (err) {
          window.dispatchEvent(
            new CustomEvent('email-builder-toggle-upload-file', {
              detail: { uploading: false, id },
            }),
          );
          show(err instanceof ApiError ? err.message : 'Could not upload image');
        }
      })();
    };
    window.addEventListener('email-builder-upload-image', onUpload);
    return () => window.removeEventListener('email-builder-upload-image', onUpload);
  }, [show]);

  // The image (or background-image) panel that opened the picker listens for
  // this event and applies the URL to the block it's editing on the canvas.
  const pickMediaImage = (img: MediaPickerImage) => {
    window.dispatchEvent(new CustomEvent('email-builder-set-image', { detail: { url: img.url } }));
    setMediaOpen(false);
  };

  // F4 (docs/product-tour-driverjs-plan.md §4/§0.2/§0.7): the ONLY place in this
  // codebase that maps `@md/product-tour`'s domain-agnostic analytics events to
  // PostHog. `email-builder-standalone` never imports PostHog itself — it only
  // calls this callback. The optional `onTourEvent` host prop is forwarded on
  // top of that mapping, so a caller can observe the same events without
  // losing the standard telemetry.
  const handleTourEvent = useCallback(
    (event: TourAnalyticsEvent) => {
      window.posthog?.capture(event.event, {
        tour_id: event.tourId,
        step_index: event.stepIndex,
        total_steps: event.totalSteps,
        editor: 'email',
      });
      onTourEvent?.(event);
    },
    [onTourEvent]
  );

  // Refetched on focus, not just on mount: custom fields are defined elsewhere
  // (list drawer, subscriber import), so an editor left open would otherwise
  // offer a merge-tag menu missing every field added since it was opened.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api.get<{ data: CustomField[] }>('custom-fields');
        if (alive) setMergeTags(buildMergeTagMenu(res.data));
      } catch {
        // No workspace/custom fields reachable — keep the default subscriber
        // fields; the menu is still real, just without custom ones.
      }
    };
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load();
    };

    void load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  // Client-only load of the editor + its stylesheet (kept out of SSR).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await retryDynamicImport(() => import('email-builder-standalone/style.css'));
        const mod = await retryDynamicImport(() => import('email-builder-standalone'));
        if (alive) setBuilder(() => mod.EmailBuilder as unknown as BuilderComponent);
      } catch (err) {
        if (alive) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load the editor.');
        }
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

  // Esc closes the editor. The media picker and send-test dialog are now
  // Modal instances that own their own Escape handling (stopping propagation
  // before it reaches this window listener), so this only fires when neither
  // is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
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

  // Save first so the test carries exactly what's on the canvas. Errors throw
  // so the recipient dialog can show them inline.
  const handleSendTest = async (to: string[]) => {
    if (!onSendTest) return;
    const ok = await flush();
    if (!ok) throw new Error('Could not save before sending');
    const res = await onSendTest(to);
    setTestOpen(false);
    show(
      res.to.length > 1
        ? `Test email queued to ${res.to.length} recipients`
        : `Test email queued to ${res.to[0]}`,
    );
  };

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
      onSendTest={onSendTest ? () => setTestOpen(true) : undefined}
      onSaveDraft={() => void handleSaveDraft()}
      toast={<ToastHost toast={toast} />}
    >
      {loadError ? (
        <div className={shellStyles.state}>
          <p>Couldn’t load the email editor.</p>
          <p className={shellStyles.muted}>{loadError}</p>
          <p className={shellStyles.muted}>
            This usually means the page outlived a server restart or an update — reloading fixes it.
          </p>
          <button type="button" className="sbtn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      ) : Builder ? (
        <Builder
          ref={builderRef}
          initialDocument={initialDocument}
          mergeTags={mergeTags}
          primaryColor={CHANNEL.email.hex}
          secondaryColor={CHANNEL.email.hex}
          darkMode={hostTheme === 'dark'}
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
          /* F4 (docs/product-tour-driverjs-plan.md §4): `tourEnabled` is an
             optional host prop — omitting it keeps the tour's own default
             (enabled) so existing behavior is unchanged. `handleTourEvent`
             is the ONLY place in this codebase that maps tour analytics to
             PostHog — the package itself never imports it (§0.2/§0.7). */
          tour={tourEnabled ?? true}
          onTourEvent={handleTourEvent}
        />
      ) : (
        <div className={shellStyles.state}>
          <span className={shellStyles.spinner} aria-hidden="true" />
          <p className={shellStyles.muted}>{LOADING_STEPS[loadingStep]}</p>
        </div>
      )}
      {mediaOpen && (
        <MediaPickerModal onPick={pickMediaImage} onClose={() => setMediaOpen(false)} />
      )}
      {testOpen && onSendTest && (
        <SendTestModal onClose={() => setTestOpen(false)} onSend={handleSendTest} />
      )}
    </ChannelEditorShell>
  );
}
