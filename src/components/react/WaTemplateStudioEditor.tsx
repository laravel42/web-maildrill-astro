import { useEffect, useRef, useState } from 'react';
import type { TemplateDoc } from 'wa-template-studio';
import waTemplateCatalog from '../../../docs/whatsapp-message-templates.json';
import ToastHost from './shared/ToastHost';
import ChannelEditorShell, { shellStyles } from './shared/ChannelEditorShell';
import { CHANNEL } from './shared/channels';
import { useAutosave } from './shared/useAutosave';
import { useToast } from './shared/useToast';
import {
  normalizeTemplateLanguageCode,
  TEMPLATE_LANGUAGE_OPTIONS,
  templateLanguageFlagSrc,
} from '@/lib/app/template-language';
import { retryDynamicImport } from '@/lib/app/retry-dynamic-import';
import {
  docToApiFields,
  hydrateTemplateDoc,
  maildrillCategoryToMeta,
  WA_TEMPLATE_CATEGORY_LABELS,
  waCategoryLabel,
  waLabelToMeta,
  type WaTemplateCategoryLabel,
} from '@/lib/app/wa-template-map';

export type WaTemplateStudioSave = ReturnType<typeof docToApiFields>;

type StudioComponent = React.ComponentType<{
  restoreDraft?: boolean;
  dark?: boolean;
  accentColor?: string;
}>;

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

function normalizeWaCategoryLabel(value: string | null | undefined): WaTemplateCategoryLabel {
  if (value && WA_TEMPLATE_CATEGORY_LABELS.includes(value as WaTemplateCategoryLabel)) {
    return value as WaTemplateCategoryLabel;
  }
  return waCategoryLabel(maildrillCategoryToMeta(value ?? undefined));
}

const LOADING_STEPS = [
  'Loading WhatsApp template studio…',
  'Preparing the studio — loading components…',
  'Still working on it — first load can take a minute…',
  'Almost there — setting up the canvas…',
];

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
  const [waCategory, setWaCategory] = useState<WaTemplateCategoryLabel>(() =>
    normalizeWaCategoryLabel(category),
  );
  const [waLanguage, setWaLanguage] = useState(() => normalizeTemplateLanguageCode(language));
  const [loadingStep, setLoadingStep] = useState(0);
  const studioReady = useRef(false);
  const { toast, show } = useToast();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await retryDynamicImport(() => import('wa-template-studio/style.css'));
        const mod = await retryDynamicImport(() => import('wa-template-studio'));
        if (!alive) return;
        const { replaceDoc, setGalleryCatalog } = mod;
        // Ready-made template gallery shown in the inspector's default state.
        setGalleryCatalog(waTemplateCatalog);
        if (!studioReady.current) {
          const doc = hydrateTemplateDoc({
            name: title.trim() || name || '',
            language,
            text,
            builderDoc,
            components,
            category,
          });
          const hydrated = {
            ...doc,
            language: normalizeTemplateLanguageCode(doc.language),
            name: title.trim() || name || doc.name || '',
          };
          replaceDoc(hydrated, { resetHistory: true });
          setWaCategory(waCategoryLabel(hydrated.category));
          setWaLanguage(hydrated.language);
          studioReady.current = true;
        }
        setStudio(() => mod.Studio);
      } catch (err) {
        if (alive) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load the WhatsApp editor.');
        }
      }
    })();
    return () => {
      alive = false;
    };
    // Hydrate once on mount.
  }, []);

  useEffect(() => {
    if (Studio || loadError) return;
    const timers = [
      setTimeout(() => setLoadingStep(1), 4_000),
      setTimeout(() => setLoadingStep(2), 20_000),
      setTimeout(() => setLoadingStep(3), 60_000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [Studio, loadError]);

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
        if (state.doc.category !== prev.doc.category) {
          setWaCategory(waCategoryLabel(state.doc.category));
        }
        if (state.doc.language !== prev.doc.language) {
          setWaLanguage(normalizeTemplateLanguageCode(state.doc.language));
        }
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
    <ChannelEditorShell
      channel="whatsapp"
      name={title}
      onNameChange={(v) => {
        setTitle(v);
        markDirty();
        void import('wa-template-studio').then((mod) => mod.setTemplateField('name', v));
      }}
      status={status}
      category={waCategory}
      categories={WA_TEMPLATE_CATEGORY_LABELS}
      onCategoryChange={(v) => {
        const next = normalizeWaCategoryLabel(v);
        setWaCategory(next);
        markDirty();
        void import('wa-template-studio').then((mod) => {
          mod.changeTemplateCategory(waLabelToMeta(next));
        });
      }}
      language={waLanguage}
      languageOptions={TEMPLATE_LANGUAGE_OPTIONS}
      getLanguageFlagSrc={templateLanguageFlagSrc}
      onLanguageChange={(v) => {
        const next = normalizeTemplateLanguageCode(v);
        setWaLanguage(next);
        markDirty();
        void import('wa-template-studio').then((mod) => mod.setTemplateField('language', next));
      }}
      onBack={onClose}
      onSaveDraft={() => void handleSave()}
      toast={<ToastHost toast={toast} />}
    >
      {loadError ? (
        <div className={shellStyles.state}>
          <p>Couldn’t load the WhatsApp template editor.</p>
          <p className={shellStyles.muted}>{loadError}</p>
          <p className={shellStyles.muted}>
            This usually means the page outlived a server restart or an update — reloading fixes it.
          </p>
          <button type="button" className="sbtn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      ) : Studio ? (
        <Studio restoreDraft={false} accentColor={CHANNEL.whatsapp.hex} />
      ) : (
        <div className={shellStyles.state}>
          <span
            className={shellStyles.spinner}
            style={{ borderTopColor: '#00a884' }}
            aria-hidden="true"
          />
          <p className={shellStyles.muted}>{LOADING_STEPS[loadingStep]}</p>
        </div>
      )}
    </ChannelEditorShell>
  );
}
