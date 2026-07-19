import { useEffect, useRef, useState } from 'react';
import type { EmailBuilderProps, EmailBuilderRef, TEditorConfiguration } from 'email-builder-online';
import { builderGenerateTemplate, builderTextAction } from '@/lib/app/services';
import Icon from './Icon';

/**
 * Full-screen wrapper around EmailBuilder.js (email-builder-online) — the visual
 * email editor imported from the Maildrill Laravel stack. Email-channel only;
 * SMS/WhatsApp/Voice keep the lightweight composer.
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
};

type Props = {
  name: string | null;
  /** Existing design to reopen for editing (builderDoc JSON), if any. */
  initialDocument?: TEditorConfiguration | string;
  onClose: () => void;
  onSave: (value: VisualEmailBuilderSave) => void | Promise<void>;
};

export default function VisualEmailBuilder({ name, initialDocument, onClose, onSave }: Props) {
  const builderRef = useRef<EmailBuilderRef>(null);
  const [Builder, setBuilder] = useState<BuilderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Client-only load of the editor + its stylesheet (kept out of SSR).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await import('email-builder-online/style.css');
        const mod = await import('email-builder-online');
        if (alive) setBuilder(() => mod.EmailBuilder as unknown as BuilderComponent);
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : 'Failed to load the editor.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Esc closes the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    const el = builderRef.current;
    if (!el || saving) return;
    setSaving(true);
    try {
      const html = el.getHtml();
      const document = el.getDocument();
      await onSave({ name: name?.trim() || 'Untitled', html, document });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="veb">
      <header className="veb__bar">
        <button type="button" className="veb__close" onClick={onClose} aria-label="Close editor">
          <Icon name="x" size={16} />
        </button>
        <span className="veb__title">{name?.trim() || 'Untitled template'}</span>
        <span className="veb__spacer" />
        <button
          type="button"
          className="veb__save"
          onClick={() => void handleSave()}
          disabled={!Builder || saving}
        >
          {saving ? 'Saving…' : 'Save to workspace'}
        </button>
      </header>

      <div className="veb__stage">
        {loadError ? (
          <div className="veb__state">
            <p>Couldn’t load the email editor.</p>
            <p className="veb__muted">{loadError}</p>
          </div>
        ) : Builder ? (
          <Builder
            ref={builderRef}
            initialDocument={initialDocument}
            primaryColor="#ff441f"
            secondaryColor="#ff441f"
            height="100%"
            sticky
            htmlTab
            jsonTab={false}
            galleryImages
            unsplashEnabled
            unsplashBackendUrl={typeof window !== 'undefined' ? window.location.origin : ''}
            templateSaving
            componentsStorage="local"
            enableAI
            onAIGenerateTemplate={builderGenerateTemplate}
            onAIRequest={builderTextAction}
          />
        ) : (
          <div className="veb__state">
            <span className="veb__spinner" aria-hidden="true" />
            <p className="veb__muted">Loading editor…</p>
          </div>
        )}
      </div>

      <style>{`
        .veb {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: var(--surface, #fff);
        }
        .veb__bar {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 52px;
          flex: none;
          padding: 0 14px;
          border-bottom: 1px solid var(--border, #ececf0);
          background: var(--surface, #fff);
        }
        .veb__close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid var(--border, #ececf0);
          border-radius: 8px;
          background: transparent;
          color: var(--text, #0b0b0f);
          cursor: pointer;
        }
        .veb__title {
          font-weight: 700;
          font-size: 14px;
          color: var(--text, #0b0b0f);
        }
        .veb__spacer { flex: 1; }
        .veb__save {
          height: 34px;
          padding: 0 16px;
          border: none;
          border-radius: 8px;
          background: #ff441f;
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .veb__save:disabled { opacity: 0.6; cursor: default; }
        .veb__stage { position: relative; flex: 1; min-height: 0; }
        .veb__state {
          height: 100%;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 10px;
          text-align: center;
        }
        .veb__muted { color: var(--muted, #6b7280); font-size: 13px; margin: 0; }
        .veb__spinner {
          width: 26px;
          height: 26px;
          border: 3px solid var(--border, #eee);
          border-top-color: #ff441f;
          border-radius: 50%;
          animation: veb-spin 0.7s linear infinite;
        }
        @keyframes veb-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
