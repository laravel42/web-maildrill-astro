/**
 * Componente de generación de secciones con IA (docs/33 §6.5).
 * Se monta en el TemplatesPanel cuando el servidor reporta `ai.enabled: true`.
 *
 * UI: botón trigger con ícono Sparkles que abre un panel flotante (position:
 * fixed, escapa del overflow del sidebar) con el textarea del prompt, estado
 * de carga, preview y acciones de insertar/cancelar.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useDocumentStore } from "@/builder/store/documentStore";
import { generateSection, fetchHealth, ApiError } from "@/services/apiClient";
import { flattenTokens } from "@/builder/model/tokens";
import { Sparkles, Loader2 } from "@/components";
import type { AiGenerateSectionResponse } from "../../../shared/api";
import type { NodeFragment } from "@/builder/model/tree";

type AiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "preview"; fragment: AiGenerateSectionResponse }
  | { kind: "error"; message: string };

export function AiSectionGenerator() {
  const { t } = useTranslation("sidebar");
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<AiState>({ kind: "idle" });
  const [aiAvailable, setAiAvailable] = useState<boolean | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const site = useDocumentStore((s) => s.site);

  // Verificar disponibilidad de la IA al montar (docs/33 §6.5)
  useEffect(() => {
    fetchHealth()
      .then((h) => setAiAvailable(h.ai.enabled))
      .catch(() => setAiAvailable(false));
  }, []);

  // Position the panel relative to the trigger (fixed, escapes overflow)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({
      left: `${rect.right + 8}px`,
      bottom: `${window.innerHeight - rect.bottom}px`,
    });
  }, [open]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setState({ kind: "loading" });
    try {
      const availableTokens = site.meta.tokens
        ? Object.keys(flattenTokens(site.meta.tokens))
        : undefined;

      const result = await generateSection({
        prompt: prompt.trim(),
        context: {
          locale: editingLocale ?? site.meta.defaultLang,
          availableTokens,
        },
      });
      setState({ kind: "preview", fragment: result });
    } catch (err) {
      if (err instanceof ApiError) {
        setState({ kind: "error", message: err.message });
      } else {
        setState({ kind: "error", message: t("ai.errorUnknown") });
      }
    }
  }, [prompt, editingLocale, site, t]);

  const handleInsert = useCallback(() => {
    if (state.kind !== "preview") return;
    const fragment = state.fragment.fragment as NodeFragment;
    const { insertFragment, document: doc } = useDocumentStore.getState();
    const rootChildren = doc.nodes[doc.rootId]?.children ?? [];
    insertFragment(fragment, { parentId: doc.rootId, index: rootChildren.length });
    setState({ kind: "idle" });
    setPrompt("");
    setOpen(false);
  }, [state]);

  const handleCancel = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  // No mostrar mientras se verifica disponibilidad o si la IA no está disponible
  if (aiAvailable === undefined) return null;
  if (!aiAvailable) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="pbx-ai__trigger"
        aria-label={t("ai.title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Sparkles size={16} aria-hidden="true" />
        <span>{t("ai.title")}</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              className="pbx-ai__panel"
              style={panelStyle}
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <div className="pbx-ai__header">
                <Sparkles size={14} aria-hidden="true" className="pbx-ai__header-icon" />
                <span className="pbx-ai__header-title">{t("ai.title")}</span>
              </div>

              <p className="pbx-ai__hint">{t("ai.hint")}</p>

              {state.kind !== "preview" && (
                <div className="pbx-ai__form">
                  <textarea
                    className="pbx-ai__input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t("ai.promptPlaceholder")}
                    rows={4}
                    maxLength={5000}
                    disabled={state.kind === "loading"}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  <button
                    type="button"
                    className="pbx-ai__btn pbx-ai__btn--primary"
                    disabled={state.kind === "loading" || !prompt.trim()}
                    onClick={handleGenerate}
                  >
                    {state.kind === "loading" ? (
                      <>
                        <Loader2 size={14} className="pbx-ai__spinner" aria-hidden="true" />
                        {t("ai.generating")}
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} aria-hidden="true" />
                        {t("ai.generate")}
                      </>
                    )}
                  </button>
                  {state.kind === "error" && (
                    <p className="pbx-ai__error" role="alert">{state.message}</p>
                  )}
                </div>
              )}

              {state.kind === "preview" && (
                <div className="pbx-ai__preview">
                  <div className="pbx-ai__preview-badge">
                    <span className="pbx-ai__preview-dot" aria-hidden="true" />
                    {t("ai.previewReady")}
                  </div>
                  <p className="pbx-ai__preview-model">
                    {t("ai.model")}: <code>{state.fragment.model}</code>
                  </p>
                  <div className="pbx-ai__actions">
                    <button
                      type="button"
                      className="pbx-ai__btn pbx-ai__btn--ghost"
                      onClick={handleCancel}
                    >
                      {t("ai.cancel")}
                    </button>
                    <button
                      type="button"
                      className="pbx-ai__btn pbx-ai__btn--primary"
                      onClick={handleInsert}
                    >
                      {t("ai.insert")}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
