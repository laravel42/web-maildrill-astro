import { useEffect, useRef, useState } from 'react';
import type { TemplateDoc } from 'wa-template-studio';
import Icon from './Icon';
import EditorHeader from './shared/EditorHeader';
import { useAutosave } from './shared/useAutosave';
import { useToast } from './shared/useToast';
import { docToApiFields, hydrateTemplateDoc } from '@/lib/app/wa-template-map';

export type WaTemplateStudioSave = ReturnType<typeof docToApiFields>;

type StudioComponent = React.ComponentType<{ restoreDraft?: boolean; dark?: boolean }>;

type Props = {
  name: string | null;
  language?: string | null;
  text?: string | null;
  category?: string | null;
  builderDoc?: Record<string, unknown> | null;
  components?: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (value: WaTemplateStudioSave) => void | Promise<void>;
};

/**
 * Full-screen wrapper around wa-template-studio for WhatsApp template authoring.
 * Loads client-only (Tailwind + Radix bundle) and persists via the product API.
 */
export default function WaTemplateStudioEditor({
  name,
  language,
  text,
  category,
  builderDoc,
  components,
  onClose,
  onSave,
}: Props) {
  const [Studio, setStudio] = useState<StudioComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState(name ?? '');
  const studioReady = useRef(false);
  const { toast, show } = useToast();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await import('wa-template-studio/style.css');
        const mod = await import('wa-template-studio');
        if (!alive) return;
        const { replaceDoc, setTemplateField, useStudio } = mod;
        if (!studioReady.current) {
          const doc = hydrateTemplateDoc({
            name: title.trim() || name || '',
            language,
            text,
            builderDoc,
            components,
            category,
          });
          replaceDoc(doc, { resetHistory: true });
          studioReady.current = true;
        }
        setStudio(() => mod.Studio);
        // Keep header name in sync with the studio doc field used on export.
        setTemplateField('name', title.trim() || name || '');
      } catch (err) {
        if (alive) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load the WhatsApp editor.');
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const persist = async () => {
    const mod = await import('wa-template-studio');
    const doc = mod.useStudio.getState().doc as TemplateDoc;
    const next = { ...doc, name: title.trim() || doc.name || 'Untitled template' };
    mod.setTemplateField('name', next.name);
    await onSave(docToApiFields(next));
  };

  const { status, markDirty, flush } = useAutosave(persist);

  useEffect(() => {
    if (!Studio) return;
    let unsubscribe: (() => void) | undefined;
    let alive = true;
    void import('wa-template-studio').then((mod) => {
      if (!alive) return;
      unsubscribe = mod.useStudio.subscribe((state, prev) => {
        if (state.doc !== prev.doc) markDirty();
      });
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [Studio, markDirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    const ok = await flush();
    show(ok ? `“${title.trim() || 'Untitled template'}” saved` : 'Could not save.');
  };

  return (
    <div className="wts">
      <EditorHeader
        channel="whatsapp"
        name={title}
        onNameChange={(v) => {
          setTitle(v);
          markDirty();
          void import('wa-template-studio').then((mod) => mod.setTemplateField('name', v));
        }}
        status={status}
        onBack={onClose}
        onSendTest={() => show('Test message sent')}
        onSaveDraft={() => void handleSave()}
      />

      <div className="wts__stage">
        {loadError ? (
          <div className="wts__state">
            <p>Couldn’t load the WhatsApp template editor.</p>
            <p className="wts__muted">{loadError}</p>
          </div>
        ) : Studio ? (
          <Studio restoreDraft={false} />
        ) : (
          <div className="wts__state">
            <span className="wts__spinner" aria-hidden="true" />
            <p className="wts__muted">Loading WhatsApp template studio…</p>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="wts__toast"
          role="status"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className="wts__toastic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        .wts {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: var(--surface, #fff);
        }
        .wts__stage {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .wts__state {
          height: 100%;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 10px;
          text-align: center;
        }
        .wts__muted { color: var(--muted, #6b7280); font-size: 13px; margin: 0; }
        .wts__spinner {
          width: 26px;
          height: 26px;
          border: 3px solid var(--border, #eee);
          border-top-color: #00a884;
          border-radius: 50%;
          animation: wts-spin 0.7s linear infinite;
        }
        @keyframes wts-spin { to { transform: rotate(360deg); } }
        .wts__toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: var(--z-toast, 1200);
          display: flex;
          align-items: center;
          gap: 11px;
          background: var(--text, #1c1917);
          color: var(--bg, #fff);
          padding: 12px 16px 12px 13px;
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(28, 25, 23, 0.3);
          font-size: 13px;
          font-weight: 500;
        }
        .wts__toastic {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #22c55e;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
      `}</style>
    </div>
  );
}
