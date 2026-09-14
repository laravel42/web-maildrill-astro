import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Builder42EditorHandle,
  Builder42EditorProps,
  BuilderSite,
  TourAnalyticsEvent,
} from 'builder42';
import { retryDynamicImport } from '@/lib/app/retry-dynamic-import';
import { landingBuilderAdapters } from '@/lib/app/builder42-adapters';
import ToastHost from './shared/ToastHost';
import ChannelEditorShell, { shellStyles } from './shared/ChannelEditorShell';
import ConfirmDialog from './shared/ConfirmDialog';
import { LANDING_IDENTITY } from './shared/channels';
import { useAutosave } from './shared/useAutosave';
import { useToast } from './shared/useToast';
// Global z-index fix for Builder42's own modals nested inside this shell —
// see LandingPageBuilder.module.css. No local classes are used from it.
import './LandingPageBuilder.module.css';

/**
 * Full-screen wrapper around Builder42 (vendored `packages/builder42/`) — the
 * visual landing-page editor, mounted as a creator of landing pages inside
 * Maildrill's workspace.
 *
 * Presents through the SAME shared shell as the email editor
 * (`ChannelEditorShell` + `EditorHeader`, via `VisualEmailBuilder.tsx`) so the
 * two read as one product: identical top bar, centred name field, indigo Save
 * button, and bottom-centre toast. A landing is NOT a
 * messaging channel, so it passes `LANDING_IDENTITY` (plain indigo `--accent`,
 * the `landing` icon) instead of a `channel` — the shell was generalised beyond
 * `ChannelType` for exactly this.
 *
 * Same client-only + retry pattern as `VisualEmailBuilder.tsx`: the package
 * pulls in react-dom/client and browser-only APIs (drag-and-drop, ProseMirror),
 * so it must never load during Astro SSR. Edit/Preview, viewport, and undo/redo
 * live in Builder42's 50px canvas bar (same row as the email `#ee-editor-header`).
 * Builder42's own document header is not mounted in embed. Save/close still
 * go through `Builder42EditorHandle`.
 */

type BuilderComponent = React.ComponentType<
  Builder42EditorProps & { ref?: React.Ref<Builder42EditorHandle> }
>;

type Props = {
  /** Existing site to reopen for editing (BuilderSite JSON), if any. */
  initialSite?: BuilderSite | string;
  /** Row name, shown in the shell's name field so it's clear which landing is open. */
  siteName?: string | null;
  onClose: () => void;
  onSave: (site: BuilderSite) => Promise<void> | void;
  /**
   * Forces or silences the guided product tour (F4,
   * docs/product-tour-driverjs-plan.md §4). Optional — omitting it keeps the
   * current behavior (tour enabled, auto-starts once per browser, after
   * `OnboardingExperienceModal`/its embedded equivalent resolves).
   */
  tourEnabled?: boolean;
  /**
   * Receives the tour's analytics events. The mapping to
   * `window.posthog?.capture(...)` lives HERE, in the host — never inside
   * `packages/builder42` (§0.2/§0.7 of the plan). Optional: omitting it means
   * tour events aren't tracked, matching current behavior.
   */
  onTourEvent?: (event: TourAnalyticsEvent) => void;
};

export default function LandingPageBuilder({
  initialSite,
  siteName,
  onClose,
  onSave,
  tourEnabled,
  onTourEvent,
}: Props) {
  const editorRef = useRef<Builder42EditorHandle>(null);
  const [Builder, setBuilder] = useState<BuilderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, tone, show } = useToast();
  // Editable copy of the site's display name, shown in the shell's own name
  // field — the vendored editor has no UI of its own for this (`meta.name` is
  // only ever read internally, for the publish slug/export title). Seeded from
  // the row's name; falls back to the initial site's own `meta.name` for a
  // reopened landing whose row name and document had drifted apart, then to an
  // empty placeholder for a brand-new one.
  const [name, setName] = useState(
    () => siteName ?? (typeof initialSite === 'object' ? initialSite?.meta.name : null) ?? '',
  );

  // Persist current content: flush the editor's working copy through the
  // imperative handle, which calls the host `onSave` with the whole site.
  // Throws on failure so autosave/flush report it (mirrors VisualEmailBuilder).
  const persistErrorRef = useRef<string | null>(null);
  const persist = async () => {
    const el = editorRef.current;
    if (!el) throw new Error('Editor not ready');
    persistErrorRef.current = null;
    try {
      await el.save();
    } catch (err) {
      persistErrorRef.current =
        err instanceof Error ? err.message : 'Couldn’t save this landing.';
      throw err;
    }
  };
  const { status, isDirty, markDirty, flush } = useAutosave(persist);
  const [leaveBlocked, setLeaveBlocked] = useState(false);
  const pendingClose = useRef(false);

  // F4 (docs/product-tour-driverjs-plan.md §4/§0.2/§0.7): the ONLY place in this
  // codebase that maps `@md/product-tour`'s domain-agnostic analytics events to
  // PostHog. `packages/builder42` never imports PostHog itself — it only calls
  // this callback. The optional `onTourEvent` host prop is forwarded on top of
  // that mapping, so a caller can observe the same events without losing the
  // standard telemetry.
  const handleTourEvent = useCallback(
    (event: TourAnalyticsEvent) => {
      window.posthog?.capture(event.event, {
        tour_id: event.tourId,
        step_index: event.stepIndex,
        total_steps: event.totalSteps,
        editor: 'landing',
      });
      onTourEvent?.(event);
    },
    [onTourEvent]
  );

  // Client-only load of the editor + its stylesheet (kept out of SSR) — same
  // reasoning as VisualEmailBuilder's own effect.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await retryDynamicImport(() => import('builder42/style.css'));
        const mod = await retryDynamicImport(() => import('builder42'));
        if (alive) setBuilder(() => mod.Builder42Editor as unknown as BuilderComponent);
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

  // The editor loads its initial site asynchronously (dynamic import, then its
  // own mount effect) — if the user edited the name before that finished, push
  // the current value in now so it isn't silently dropped.
  // Runs only when `Builder` becomes available (deps intentionally exclude
  // `name`: the current value is read once, at editor-ready time, not tracked).
  const nameRef = useRef(name);
  nameRef.current = name;
  useEffect(() => {
    if (Builder) editorRef.current?.setSiteName(nameRef.current);
  }, [Builder]);

  // Pushes the shell's name field into the editor's own document as it's typed,
  // so `site.meta.name` is never stale by the time Save reads it
  // (`getFlushedSite()` inside the handle's `save()`), and marks the draft dirty
  // so the autosave status reflects the pending change.
  const handleNameChange = (value: string) => {
    setName(value);
    editorRef.current?.setSiteName(value);
    markDirty();
  };

  const handleSaveDraft = useCallback(async () => {
    const ok = await flush();
    if (ok) {
      show(`“${name.trim() || 'Untitled landing'}” saved`);
    } else {
      show(persistErrorRef.current || 'Could not save.', 'alert');
    }
  }, [flush, name, show]);

  const overlayOpen = () =>
    Boolean(document.querySelector('[data-c42-modal], [role="alertdialog"]'));

  const requestClose = useCallback(async () => {
    if (overlayOpen()) return;
    if (status === 'saving') {
      pendingClose.current = true;
      return;
    }
    if (!isDirty) {
      onClose();
      return;
    }
    const ok = await flush();
    if (ok) onClose();
    else setLeaveBlocked(true);
  }, [flush, isDirty, onClose, status]);

  useEffect(() => {
    if (!pendingClose.current) return;
    if (status === 'saved') {
      pendingClose.current = false;
      onClose();
    } else if (status === 'idle' && isDirty) {
      pendingClose.current = false;
      setLeaveBlocked(true);
    }
  }, [isDirty, onClose, status]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Esc closes the editor unless a modal/dialog is in front. ⌘S / Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveDraft();
        return;
      }
      if (e.key !== 'Escape') return;
      if (overlayOpen()) return;
      void requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSaveDraft, requestClose]);

  return (
    <>
      <ChannelEditorShell
        identity={LANDING_IDENTITY}
        nounLabel="landing"
        name={name}
        onNameChange={handleNameChange}
        status={status}
        isDirty={isDirty}
        onBack={() => void requestClose()}
        onSaveDraft={() => void handleSaveDraft()}
        toast={<ToastHost toast={toast} tone={tone} />}
      >
        {loadError ? (
          <div className={shellStyles.state}>
            <p>Couldn&apos;t load the landing page editor.</p>
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
            ref={editorRef}
            site={initialSite}
            onSave={onSave}
            onClose={() => void requestClose()}
            onDirty={markDirty}
            themeMode="host"
            // Maildrill's workspace is English-only, and the editor's own
            // auto-translate feature is reported off by `landingBuilderAdapters`
            // — pinning the chrome locale keeps the two consistent.
            locale="en"
            adapters={landingBuilderAdapters}
            tourEnabled={tourEnabled}
            onTourEvent={handleTourEvent}
          />
        ) : (
          <div className={shellStyles.state}>
            <span className={shellStyles.spinner} aria-hidden="true" />
            <p className={shellStyles.muted}>Loading editor…</p>
          </div>
        )}
      </ChannelEditorShell>
      {leaveBlocked ? (
        <ConfirmDialog
          title="Couldn’t save this landing"
          message="Leave anyway? The latest edits on the canvas will be lost."
          confirmLabel="Leave"
          cancelLabel="Stay"
          tone="danger"
          onConfirm={onClose}
          onCancel={() => setLeaveBlocked(false)}
        />
      ) : null}
    </>
  );
}
