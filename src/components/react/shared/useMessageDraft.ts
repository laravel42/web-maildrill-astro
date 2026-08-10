import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import { buildPersonalizationTokens, type CustomField } from '@/lib/app/custom-fields';
import { defaultTemplateCategory } from '@/lib/app/templates-data';
import { normalizeTemplateLanguageCode } from '@/lib/app/template-language';
import { useAutosave } from './useAutosave';
import { useToast } from './useToast';

/** Payload every text-composer save produces (voice adds builderDoc). */
export type ComposerSavePayload = {
  channel: ChannelType;
  name: string;
  message: string;
  category: string;
  language: string;
  /** Present for voice templates: the persisted TTS selection. */
  builderDoc?: Record<string, unknown>;
};

/** Props shared by the text-composer builders (SMS, voice). */
export type ComposerProps = {
  name?: string | null;
  initialCategory?: string;
  initialLanguage?: string | null;
  /** Saved body when reopening an existing template, so edits replace it. */
  initialMessage?: string;
  onClose: () => void;
  onSave: (payload: ComposerSavePayload) => void | Promise<void>;
};

/** Insert `insert` into `text` at `[start, end)`, returning the new text and caret. */
export function insertTextAt(
  text: string,
  insert: string,
  start: number,
  end: number = start,
): { text: string; caret: number } {
  const next = text.slice(0, start) + insert + text.slice(end);
  return { text: next, caret: start + insert.length };
}

/**
 * Draft state shared by the text-message builders: the message body with
 * caret-aware {{token}} insertion, template name/category/language, the
 * workspace's personalization tokens, and 5s autosave with manual flush.
 * Channel-specific builders bolt on their own state and feed it back through
 * `extras` (payload additions) + the returned `markDirty`.
 */
export function useMessageDraft({
  channel,
  name,
  initialCategory,
  initialLanguage,
  initialMessage,
  onSave,
  extras,
}: ComposerProps & {
  channel: ChannelType;
  /**
   * Channel-specific additions to the autosave payload (voice TTS doc),
   * computed at save time against the draft's current language.
   */
  extras?: (draft: { language: string }) => Pick<ComposerSavePayload, 'builderDoc'>;
}) {
  const [message, setMessage] = useState(initialMessage ?? '');
  const [templateName, setTemplateName] = useState(name ?? '');
  const [category, setCategory] = useState(() => defaultTemplateCategory(channel, initialCategory));
  const [language, setLanguage] = useState(() => normalizeTemplateLanguageCode(initialLanguage));
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const { toast, show } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const personalizationTokens = useMemo(
    () => buildPersonalizationTokens(customFields),
    [customFields],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<{ data: CustomField[] }>('custom-fields');
        if (alive) setCustomFields(res.data);
      } catch {
        // No session or API unreachable — keep core name/email/phone chips.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rememberSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    };
  };

  const insertVariable = (token: string) => {
    const el = textareaRef.current;
    const text = message;
    const focused = !!el && document.activeElement === el;
    const fallback =
      selectionRef.current.end <= text.length
        ? selectionRef.current
        : { start: text.length, end: text.length };
    const start = focused ? (el.selectionStart ?? text.length) : fallback.start;
    const end = focused ? (el.selectionEnd ?? text.length) : fallback.end;

    if (el) {
      el.focus();
      // setRangeText mutates el.value in place; feeding React the same string
      // lets the controlled textarea keep the caret we set below.
      el.setRangeText(token, start, end, 'end');
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
      setMessage(el.value);
      selectionRef.current = { start: caret, end: caret };
      return;
    }

    const result = insertTextAt(text, token, start, end);
    setMessage(result.text);
    selectionRef.current = { start: result.caret, end: result.caret };
  };

  // Autosave the draft every 5s once the user starts editing.
  const persist = async () => {
    await onSave({
      channel,
      name: templateName.trim() || 'Untitled',
      message,
      category,
      language,
      ...(extras?.({ language }) ?? {}),
    });
  };
  const { status, markDirty, flush } = useAutosave(persist);
  const dirtyInit = useRef(false);
  useEffect(() => {
    if (!dirtyInit.current) {
      dirtyInit.current = true;
      return;
    }
    markDirty();
  }, [message, templateName, category, language, markDirty]);

  const handleSaveDraft = async () => {
    const ok = await flush();
    show(ok ? `“${templateName.trim() || 'Untitled template'}” saved` : 'Could not save.');
  };

  return {
    message,
    setMessage,
    templateName,
    setTemplateName,
    category,
    setCategory,
    language,
    setLanguage,
    personalizationTokens,
    textareaRef,
    rememberSelection,
    insertVariable,
    status,
    markDirty,
    handleSaveDraft,
    toast,
  };
}

export type MessageDraft = ReturnType<typeof useMessageDraft>;
