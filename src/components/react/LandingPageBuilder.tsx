import { useEffect, useRef, useState } from 'react';
import type { Builder42EditorHandle, Builder42EditorProps, BuilderSite } from 'builder42';
import { retryDynamicImport } from '@/lib/app/retry-dynamic-import';
import { landingBuilderAdapters } from '@/lib/app/builder42-adapters';
import styles from './LandingPageBuilder.module.css';

/**
 * Full-screen wrapper around Builder42 (vendored `packages/builder42/`, D9/F8 of
 * docs/52 in the pb-static repo) — the visual landing-page editor, mounted as a
 * creator of landing pages inside Maildrill's workspace.
 *
 * Same client-only + retry pattern as `VisualEmailBuilder.tsx`: the package pulls
 * in react-dom/client and browser-only APIs (drag-and-drop, ProseMirror), so it
 * must never load during Astro SSR. Unlike the email builder, this wrapper does
 * NOT use `ChannelEditorShell` — that shell is scoped to `ChannelType`
 * ('email' | 'sms' | 'whatsapp' | 'voice'), a messaging-channel concept a
 * landing page isn't. This ships its own minimal full-screen shell instead,
 * with a small header bar for Save/Close — the vendored editor's OWN chrome
 * (`Header.tsx`) doesn't know about this host's `onSave`/`onClose` by design
 * (docs/52 F7: those are only reachable via `Builder42EditorHandle`, the
 * imperative ref, so the shared chrome stays untouched between standalone
 * and embedded mode).
 */

type BuilderComponent = React.ComponentType<
  Builder42EditorProps & { ref?: React.Ref<Builder42EditorHandle> }
>;

type Props = {
  /** Existing site to reopen for editing (BuilderSite JSON), if any. */
  initialSite?: BuilderSite | string;
  /** Row name, shown in the host bar so it's clear which landing is open. */
  siteName?: string | null;
  onClose: () => void;
  onSave: (site: BuilderSite) => Promise<void> | void;
};

export default function LandingPageBuilder({ initialSite, siteName, onClose, onSave }: Props) {
  const editorRef = useRef<Builder42EditorHandle>(null);
  const [Builder, setBuilder] = useState<BuilderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Editable copy of the site's display name, shown in the host's own bar —
  // the vendored editor has no UI of its own for this (`meta.name` is only
  // ever read internally, for the publish slug/export title). Seeded from the
  // row's name; falls back to the initial site's own `meta.name` for a
  // reopened landing whose row name and document had drifted apart, then to
  // the empty placeholder for a brand-new one.
  const [name, setName] = useState(
    () => siteName ?? (typeof initialSite === 'object' ? initialSite?.meta.name : null) ?? '',
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

  // Esc closes the editor (mirrors VisualEmailBuilder's own shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The editor loads its initial site asynchronously (dynamic import, then
  // its own mount effect) — if the user edited the name field before that
  // finished, push the current value in now so it isn't silently dropped.
  useEffect(() => {
    if (Builder) editorRef.current?.setSiteName(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Builder]);

  // Pushes the host's name field into the editor's own document as it's
  // typed, so `site.meta.name` is never stale by the time Save reads it
  // (`getFlushedSite()` inside the handle's `save()`/`onSave`).
  const handleNameChange = (value: string) => {
    setName(value);
    editorRef.current?.setSiteName(value);
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      await editorRef.current.save();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.bar}>
        <button type="button" className="sbtn" onClick={onClose}>
          Back
        </button>
        <input
          className={styles.title}
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Untitled landing"
          aria-label="Landing name"
          spellCheck={false}
        />
        <button
          type="button"
          className="sbtn sbtn-primary"
          onClick={() => void handleSave()}
          disabled={saving || !Builder}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className={styles.stage}>
        {loadError ? (
          <div className={styles.state}>
            <p>Couldn&apos;t load the landing page editor.</p>
            <p className={styles.muted}>{loadError}</p>
            <button type="button" className="sbtn" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        ) : Builder ? (
          <Builder
            ref={editorRef}
            site={initialSite}
            onSave={onSave}
            onClose={onClose}
            themeMode="host"
            // Maildrill's workspace is English-only, and the editor's own
            // auto-translate feature is reported off by `landingBuilderAdapters`
            // — pinning the chrome locale keeps the two consistent.
            locale="en"
            adapters={landingBuilderAdapters}
          />
        ) : (
          <div className={styles.state}>
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.muted}>Loading editor…</p>
          </div>
        )}
      </div>
    </div>
  );
}
