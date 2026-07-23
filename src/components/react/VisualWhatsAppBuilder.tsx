import { useEffect, useRef, useState } from 'react';
import type {
  TWhatsAppConfiguration,
  WaTemplateComponents,
  WhatsAppBuilderProps,
  WhatsAppBuilderRef,
} from 'whatsapp-builder-standalone';
import { TEMPLATE_CATEGORIES } from '@/lib/app/templates-data';
import Icon from './Icon';
import EditorHeader from './shared/EditorHeader';
import { useAutosave } from './shared/useAutosave';
import { useToast } from './shared/useToast';

/**
 * Full-screen wrapper around the vendored whatsapp-builder-standalone —
 * the visual WhatsApp template editor. WhatsApp-channel only; mirrors
 * VisualEmailBuilder so the two editors read as one product (same
 * EditorHeader, same autosave, same client-only dynamic import).
 */

type BuilderComponent = React.ComponentType<
  WhatsAppBuilderProps & { ref?: React.Ref<WhatsAppBuilderRef> }
>;

export type VisualWhatsAppBuilderSave = {
  name: string;
  /** Flattened body text (persisted as ApiTemplate.text). */
  text: string;
  /** Builder JSON (persisted as ApiTemplate.builderDoc for reopening). */
  document: TWhatsAppConfiguration;
  /** Meta template components payload (persisted as ApiTemplate.components). */
  components: WaTemplateComponents;
  category: string;
};

type Props = {
  name: string | null;
  /** Existing design to reopen for editing (builderDoc JSON), if any. */
  initialDocument?: TWhatsAppConfiguration | string;
  initialCategory?: string;
  kind?: 'template' | 'campaign';
  onClose: () => void;
  onSave: (value: VisualWhatsAppBuilderSave) => void | Promise<void>;
};

export default function VisualWhatsAppBuilder({
  name,
  initialDocument,
  initialCategory,
  kind = 'template',
  onClose,
  onSave,
}: Props) {
  const builderRef = useRef<WhatsAppBuilderRef>(null);
  const [Builder, setBuilder] = useState<BuilderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState(name ?? '');
  const [category, setCategory] = useState(initialCategory ?? TEMPLATE_CATEGORIES[1]);
  const { toast, show } = useToast();

  // Client-only load of the editor + its stylesheet (kept out of SSR).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await import('whatsapp-builder-standalone/style.css');
        const mod = await import('whatsapp-builder-standalone');
        if (alive) setBuilder(() => mod.WhatsAppBuilder as unknown as BuilderComponent);
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

  // Persist current content (throws on failure so autosave/flush can react).
  const persist = async () => {
    const el = builderRef.current;
    if (!el) throw new Error('Editor not ready');
    const document = el.getDocument();
    const components = el.getComponents();
    const text = el.getText();
    await onSave({ name: title.trim() || 'Untitled', text, document, components, category });
  };

  const { status, markDirty, flush } = useAutosave(persist);

  const handleSaveDraft = async () => {
    const ok = await flush();
    show(ok ? `“${title.trim() || 'Untitled template'}” saved` : 'Could not save.');
  };

  const handleSendTest = () => show('Test message sent');

  return (
    <div className="veb">
      <EditorHeader
        channel="whatsapp"
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
        onBack={onClose}
        onSendTest={handleSendTest}
        onSaveDraft={() => void handleSaveDraft()}
      />

      <div className="veb__stage">
        {loadError ? (
          <div className="veb__state">
            <p>Couldn’t load the WhatsApp editor.</p>
            <p className="veb__muted">{loadError}</p>
          </div>
        ) : Builder ? (
          <Builder
            ref={builderRef}
            initialDocument={initialDocument}
            height="100%"
            businessName="Maildrill"
            onAutoSave={() => markDirty()}
          />
        ) : (
          <div className="veb__state">
            <span className="veb__spinner" aria-hidden="true" />
            <p className="veb__muted">Loading WhatsApp editor…</p>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="veb__toast"
          role="status"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className="veb__toastic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      {/* Same .veb chrome as VisualEmailBuilder — duplicated because each
          wrapper injects its own styles and only one is ever mounted. The
          spinner accent is the WhatsApp channel green. */}
      <style>{`
        .veb {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: var(--surface, #fff);
        }
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
          border-top-color: var(--ch-whatsapp, #22c55e);
          border-radius: 50%;
          animation: veb-spin 0.7s linear infinite;
        }
        @keyframes veb-spin { to { transform: rotate(360deg); } }
        .veb__toast {
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
        .veb__toastic {
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
