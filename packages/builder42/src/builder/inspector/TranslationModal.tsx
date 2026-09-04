/**
 * TranslationModal — tabla de traducción (docs/51 F5, evolución de Fase 19.j).
 *
 * Pasa del modelo "una fila por campo" (bug real documentado en docs/51 §6:
 * la tabla anterior recorría `Object.entries(nodes)`, el orden del `Record`,
 * no el orden visual del árbol) a **una fila por SEGMENTO**, en orden de
 * documento, vía `toSegments` (`services/translation/segments.ts`, F4a — no
 * se reimplementa aquí, solo se consume).
 *
 * Decisión de diseño (docs/51 §4 F5 punto 2): en vez de N columnas
 * simultáneas (una por locale extra, como la v1), el modal tiene un
 * **selector de "idioma a traducir" único** + la tabla muestra SOLO ese
 * locale. Motivo: la traducción automática (`runTranslation`, F4b) hace
 * **una request por locale** — combinarlo con N columnas visibles a la vez
 * habría exigido N barras de progreso/estados simultáneos por la misma
 * tabla, más complejidad de layout (rowspan × N columnas) sin beneficio real
 * (nadie traduce a la vez a 3 idiomas mirando los 3). Un selector +
 * "Autocompletar {idioma}" es más simple de implementar correctamente y más
 * accesible (un solo `aria-live` de progreso, no N). Por la misma razón NO
 * hay botón "Autocompletar todos los idiomas": con un locale activo por vez,
 * ese botón implicaría orquestar N requests secuenciales con progreso
 * agregado fuera del alcance de esta fase — el usuario cambia el selector y
 * repite la acción por idioma (documentado, no es un olvido).
 *
 * Edición manual por celda (v1) se mantiene: cada segmento sigue siendo
 * editable con `CommittableInput`, escribiendo vía `setNodeTranslation`
 * (única acción de escritura de traducciones, sin tocar `editingLocale`).
 *
 * "Retraducir" por segmento suelto (docs/51 §4 F5 punto 5) queda FUERA de
 * esta fase — es explícitamente opcional en el plan ("prioriza el flujo
 * completo de autocompletar por lote primero"). El usuario puede lograr el
 * mismo resultado editando la celda a mano.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SimpleModal, IconButton, CloseIcon, ToastHost, useToast, PbxSelect } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import {
  contentToHtml,
  isTiptapDoc,
  htmlToContent,
  isLegacyHtml,
  untranslatedNodes,
  mergeTranslationStructure,
  type TiptapDoc,
} from "@/builder/model/richtext";
import { isTranslatableTarget } from "../../../shared/deeplLang";
import { toSegments, type Segment } from "@/services/translation/segments";
import { planTranslation, runTranslation, type TranslationPlan } from "@/services/translation/autoTranslate";
import { fetchHealth, translateTexts, ApiError } from "@/services/apiClient";
import type { HealthResponse } from "../../../shared/api";
import { CommittableInput } from "./controls/CommittableInput";

/** Estado visual por segmento durante/después de un autocompletado en lote. */
type SegmentStatus = "idle" | "translating" | "done" | "error";

/** Snapshot de un valor previo, para "Deshacer autocompletado" (D8). */
interface UndoEntry {
  nodeId: string;
  key: string;
  /** Valor de `translations[nodeId][locale][key]` antes de escribir. `undefined` = no había traducción. */
  previousValue: string | undefined;
}

/** Referencia legible de un campo para agrupar visualmente los segmentos (docs/51 §4 F5 punto 1). */
interface FieldGroupInfo {
  nodeId: string;
  key: string;
  nodeType: string;
  fieldLabel: string;
  /** Valor de referencia en el idioma default (para mostrar la columna "origen"). */
  defaultValue: string;
  segments: Segment[];
  /** Solo para campos richtext con traducción existente completa: "N de M párrafos traducidos". */
  richTextProgress?: { translated: number; total: number };
  /**
   * `true` cuando el campo es richtext, hay traducción existente completa
   * para el locale activo, Y el doc base tiene MÁS nodos de nivel 1 que esa
   * traducción (docs/51 F6, §4): el usuario agregó contenido nuevo al
   * idioma default y la traducción existente quedó corta en estructura.
   * Habilita el botón "Sincronizar estructura". `false`/`undefined` en
   * cualquier otro caso (incluye: no es richtext, no hay traducción
   * existente todavía, o ambos docs ya tienen el mismo número de nodos).
   */
  structureMismatch?: boolean;
}

function groupSegmentsByField(segments: Segment[]): Map<string, Segment[]> {
  const groups = new Map<string, Segment[]>();
  for (const seg of segments) {
    const groupKey = `${seg.nodeId}:${seg.key}`;
    const group = groups.get(groupKey);
    if (group) group.push(seg);
    else groups.set(groupKey, [seg]);
  }
  return groups;
}

export function TranslationModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("inspector");
  const { t: tc } = useTranslation("common");

  const i18n = useDocumentStore((s) => s.site.meta.i18n);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const pageOrder = useDocumentStore((s) => s.site.pageOrder);
  const pages = useDocumentStore((s) => s.site.pages);
  const setNodeTranslation = useDocumentStore((s) => s.setNodeTranslation);

  // ─── Página activa dentro del modal (independiente de la página activa del
  // editor): la tabla puede cubrir sitios multipágina, así que se agrega un
  // selector propio que arranca en la página que el usuario tenía abierta.
  const [translationPageId, setTranslationPageId] = useState(activePageId);
  useEffect(() => {
    if (translationPageId && pages[translationPageId]) return;
    setTranslationPageId(activePageId);
  }, [pages, translationPageId, activePageId]);

  const activePage = pages[translationPageId] ?? pages[activePageId]!;
  const document_ = activePage.document;
  const translations = activePage.translations;

  const otherLocales = useMemo(() => (i18n?.locales ?? []).filter((l) => l !== defaultLang), [i18n, defaultLang]);
  const [activeLocale, setActiveLocale] = useState<string | undefined>(otherLocales[0]);

  // Re-sincroniza si `otherLocales` cambia (idioma agregado/quitado mientras el modal está abierto).
  useEffect(() => {
    if (activeLocale && otherLocales.includes(activeLocale)) return;
    setActiveLocale(otherLocales[0]);
  }, [otherLocales, activeLocale]);

  const [health, setHealth] = useState<HealthResponse["translate"] | undefined>(undefined);

  useEffect(() => {
    fetchHealth()
      .then((h) => setHealth(h.translate))
      .catch(() => setHealth({ enabled: false }));
  }, []);

  // ─── Segmentos del locale activo ──────────────────────────────────────────
  const segments = useMemo<Segment[]>(() => {
    if (!activeLocale) return [];
    return toSegments({
      document: document_,
      translations,
      targetLocale: activeLocale,
      defaultLocale: defaultLang,
    });
  }, [document_, translations, activeLocale, defaultLang]);

  const fieldGroups = useMemo<FieldGroupInfo[]>(() => {
    const grouped = groupSegmentsByField(segments);
    const out: FieldGroupInfo[] = [];
    for (const [, group] of grouped) {
      const first = group[0];
      if (!first) continue;
      const node = document_.nodes[first.nodeId];
      if (!node) continue;
      const def = getDefinition(node.type);
      const field = def?.propsSchema.fields.find((f) => f.key === first.key);
      const raw = node.props[first.key];
      const defaultValue =
        raw == null ? "" : field?.control === "richtext" && isTiptapDoc(raw) ? contentToHtml(raw) : String(raw);

      let richTextProgress: FieldGroupInfo["richTextProgress"];
      let structureMismatch: FieldGroupInfo["structureMismatch"];
      if (field?.control === "richtext" && first.existing !== undefined) {
        // "N de M párrafos traducidos" (docs/51 §4 F5 punto 6): compara el doc
        // base contra la traducción EXISTENTE completa vía `untranslatedNodes`.
        try {
          const baseDoc = isTiptapDoc(raw) ? raw : isLegacyHtml(raw) ? htmlToContent(String(raw)) : undefined;
          const existingRaw = first.existing;
          const existingDoc = isLegacyHtml(existingRaw) ? htmlToContent(existingRaw) : undefined;
          if (baseDoc && existingDoc) {
            const total = baseDoc.content.length;
            const untranslated = untranslatedNodes(baseDoc, existingDoc).length;
            richTextProgress = { translated: Math.max(0, total - untranslated), total };
            // docs/51 F6: desfase ESTRUCTURAL (no solo de traducción) — el
            // base ganó nodos de nivel 1 que la traducción existente no tiene.
            structureMismatch = baseDoc.content.length > existingDoc.content.length;
          }
        } catch {
          richTextProgress = undefined;
          structureMismatch = undefined;
        }
      }

      out.push({
        nodeId: first.nodeId,
        key: first.key,
        nodeType: node.type,
        fieldLabel: field?.label ?? first.key,
        defaultValue,
        segments: group,
        richTextProgress,
        structureMismatch,
      });
    }
    return out;
  }, [segments, document_]);

  // ─── Estado por segmento durante un autocompletado ────────────────────────
  const [segmentStatus, setSegmentStatus] = useState<Map<string, SegmentStatus>>(new Map());
  const [liveMessage, setLiveMessage] = useState("");
  const segmentKey = (s: Segment) => `${s.nodeId}:${s.key}:${s.index}`;

  // ─── Confirmación previa con costo estimado (docs/51 §4 F5 punto 4) ───────
  const [pendingPlan, setPendingPlan] = useState<{ plan: TranslationPlan; locale: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // ─── Deshacer autocompletado (D8) ──────────────────────────────────────────
  const lastUndoRef = useRef<UndoEntry[] | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  const activeLocaleTranslatable = activeLocale ? isTranslatableTarget(activeLocale) : false;
  const autoTranslateDisabledReason = !activeLocale
    ? undefined
    : health === undefined
      ? t("translationTable.autoCheckingAvailability")
      : health.enabled === false
        ? t("translationTable.autoDisabledServer")
        : !activeLocaleTranslatable
          ? t("translationTable.autoDisabledLocale", { locale: activeLocale.toUpperCase() })
          : undefined;

  function openConfirm() {
    if (!activeLocale) return;
    const pending = segments.filter((s) => s.existing === undefined);
    const plan = planTranslation(pending);
    if (plan.uniqueTexts.length === 0) return;
    setTranslateError(null);
    setPendingPlan({ plan, locale: activeLocale });
  }

  async function confirmTranslate() {
    if (!pendingPlan || !activeLocale) return;
    const { plan } = pendingPlan;
    const pendingSegments = segments.filter((s) => s.existing === undefined);

    setIsTranslating(true);
    setTranslateError(null);
    setLiveMessage(t("translationTable.autoInProgress", { locale: activeLocale.toUpperCase() }));
    setSegmentStatus((prev) => {
      const next = new Map(prev);
      for (const seg of pendingSegments) next.set(segmentKey(seg), "translating");
      return next;
    });

    // Snapshot de los valores previos de cada campo afectado (D8) — leído del
    // store REAL justo antes de escribir, no de `segments` (que solo trae
    // `existing`, no el valor crudo por si algún día se retraduce algo con valor previo).
    const affectedFields = new Set(pendingSegments.map((s) => `${s.nodeId}:${s.key}`));
    const undoEntries: UndoEntry[] = Array.from(affectedFields).map((fk) => {
      const [nodeId, key] = fk.split(":") as [string, string];
      const previousValue = translations?.[nodeId]?.[activeLocale]?.[key];
      return { nodeId, key, previousValue: previousValue == null ? undefined : String(previousValue) };
    });

    try {
      const outcome = await runTranslation({
        plan,
        segments: pendingSegments,
        targetLocale: activeLocale,
        translate: translateTexts,
        write: (nodeId, key, value) => setNodeTranslation(nodeId, activeLocale, key, value, translationPageId),
        document: document_,
      });

      const failedKeys = new Set(outcome.failedSegments.map((s) => `${s.nodeId}:${s.key}`));
      setSegmentStatus((prev) => {
        const next = new Map(prev);
        for (const seg of pendingSegments) {
          next.set(segmentKey(seg), failedKeys.has(`${seg.nodeId}:${seg.key}`) ? "error" : "done");
        }
        return next;
      });

      if (outcome.written > 0) {
        lastUndoRef.current = undoEntries;
        showToast({
          message: t("translationTable.autoDoneMessage", {
            count: outcome.written,
            locale: activeLocale.toUpperCase(),
          }),
          actionLabel: t("translationTable.undoAction"),
          onAction: () => undoLastBatch(undoEntries, activeLocale),
        });
      }

      if (outcome.failedSegments.length > 0) {
        setTranslateError(
          t("translationTable.autoPartialError", { count: outcome.failedSegments.length }),
        );
      }

      setLiveMessage(
        t("translationTable.autoDoneMessage", { count: outcome.written, locale: activeLocale.toUpperCase() }),
      );
    } catch (err) {
      setSegmentStatus((prev) => {
        const next = new Map(prev);
        for (const seg of pendingSegments) next.set(segmentKey(seg), "error");
        return next;
      });
      const message = err instanceof ApiError ? err.message : t("translationTable.autoErrorUnknown");
      setTranslateError(message);
      setLiveMessage(message);
    } finally {
      setIsTranslating(false);
      setPendingPlan(null);
    }
  }

  function undoLastBatch(entries: UndoEntry[], locale: string) {
    // Limitación documentada (docs/51 §4 F5 punto 7): `setNodeTranslation` no
    // tiene forma de BORRAR una clave (siempre asigna un valor). Si no había
    // valor previo, "deshacer" restaura una cadena vacía en vez de eliminar
    // la entrada — aceptable para el MVP: el campo vuelve a mostrarse como
    // "sin traducir" en la práctica (cadena vacía se trata como falta de
    // contenido en el resto del modelo de i18n), aunque técnicamente la
    // clave sigue presente en `translations`.
    for (const entry of entries) {
      setNodeTranslation(entry.nodeId, locale, entry.key, entry.previousValue ?? "", translationPageId);
    }
    hideToast();
  }

  /**
   * Sincroniza la estructura de un campo richtext (docs/51 F6, §4): mezcla
   * los nodos de nivel 1 nuevos del base con la traducción existente vía
   * `mergeTranslationStructure` (pura, `model/richtext.ts` — NO se
   * reimplementa aquí) y escribe el resultado con `setNodeTranslation`.
   *
   * Manual, disparada SOLO por el click de este botón (D8: un merge
   * silencioso sorprende y no es deshacible por `Ctrl+Z` — nunca se llama
   * desde un efecto). Ofrece "Deshacer" vía el mismo `ToastHost` que ya usa
   * el autocompletado (snapshot del valor previo, un solo campo).
   */
  function syncFieldStructure(group: FieldGroupInfo) {
    if (!activeLocale) return;
    const node = document_.nodes[group.nodeId];
    if (!node) return;
    const baseRaw = node.props[group.key];
    const existingRaw = translations?.[group.nodeId]?.[activeLocale]?.[group.key];
    if (existingRaw == null) return; // sin traducción existente: no aplica (docs/51 F6 punto 1)

    const baseIsTiptap = isTiptapDoc(baseRaw);
    let baseDoc: TiptapDoc | undefined;
    if (baseIsTiptap) baseDoc = baseRaw;
    else if (isLegacyHtml(baseRaw)) baseDoc = htmlToContent(baseRaw);
    if (!baseDoc) return;

    let translationDoc: TiptapDoc | undefined;
    if (isTiptapDoc(existingRaw)) translationDoc = existingRaw;
    else if (isLegacyHtml(existingRaw)) translationDoc = htmlToContent(existingRaw);
    if (!translationDoc) return;

    const mergedDoc = mergeTranslationStructure(baseDoc, translationDoc);
    const nextValue: unknown = baseIsTiptap ? mergedDoc : contentToHtml(mergedDoc);

    setNodeTranslation(group.nodeId, activeLocale, group.key, nextValue, translationPageId);
    setLiveMessage(t("translationTable.structureSyncDone", { field: group.fieldLabel }));

    showToast({
      message: t("translationTable.structureSyncDone", { field: group.fieldLabel }),
      actionLabel: t("translationTable.undoAction"),
      onAction: () => {
        setNodeTranslation(group.nodeId, activeLocale, group.key, existingRaw, translationPageId);
        hideToast();
      },
    });
  }

  // ─── Filas de la tabla del locale activo ──────────────────────────────────
  const hasContent = fieldGroups.length > 0;

  return (
    <SimpleModal className="pbx-modal" onClose={onClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div
        data-c42-modal-content
        className="pbx-modal__content pbx-translation-modal"
        aria-label={t("translationTable.title")}
      >
        <div className="pbx-modal__header">
          <div>
            <h3 className="pbx-modal__title">{t("translationTable.title")}</h3>
            <p className="pbx-modal__subtitle">{t("translationTable.subtitle")}</p>
          </div>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("translationTable.close")}
            data-c42-modal-close
          />
        </div>

        <div className="pbx-modal__body">
          {otherLocales.length === 0 ? (
            <p className="pbx-inspector__empty">{t("translationTable.empty")}</p>
          ) : (
            <>
              <div className="pbx-translation-table__toolbar">
                {pageOrder.length > 1 ? (
                  <label className="pbx-translation-table__locale-label">
                    {t("translationTable.pageSelectLabel")}
                    <PbxSelect
                      className="pbx-translation-table__locale-select"
                      value={translationPageId}
                      onChange={setTranslationPageId}
                      options={pageOrder.map((pid) => ({
                        value: pid,
                        label: pages[pid]?.meta.title ?? pid,
                      }))}
                    />
                  </label>
                ) : null}

                <label className="pbx-translation-table__locale-label">
                  {t("translationTable.localeSelectLabel")}
                  <PbxSelect
                    className="pbx-translation-table__locale-select"
                    value={activeLocale ?? ""}
                    onChange={setActiveLocale}
                    options={otherLocales.map((loc) => ({
                      value: loc,
                      label: loc.toUpperCase(),
                    }))}
                  />
                </label>

                <button
                  type="button"
                  className="pbx-translation-table__auto-btn"
                  disabled={Boolean(autoTranslateDisabledReason) || isTranslating}
                  title={autoTranslateDisabledReason}
                  onClick={openConfirm}
                >
                  {t("translationTable.autoButton", { locale: activeLocale?.toUpperCase() ?? "" })}
                </button>
              </div>

              <p className="pbx-translation-table__undo-note">{t("translationTable.undoHint")}</p>

              <div aria-live="polite" className="pbx-translation-table__live-region">
                {liveMessage}
              </div>

              {translateError ? (
                <p className="pbx-translation-table__error" role="alert">
                  {translateError}
                </p>
              ) : null}

              {!hasContent ? (
                <p className="pbx-inspector__empty">{t("translationTable.empty")}</p>
              ) : (
                <table className="pbx-translation-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("translationTable.field")}</th>
                      <th scope="col">{defaultLang.toUpperCase()}</th>
                      <th scope="col">{activeLocale?.toUpperCase()}</th>
                      <th scope="col">{t("translationTable.statusColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldGroups.map((group) => (
                      <FieldGroupRows
                        key={`${group.nodeId}:${group.key}`}
                        group={group}
                        activeLocale={activeLocale!}
                        translations={translations}
                        setNodeTranslation={(nodeId, locale, key, value) =>
                          setNodeTranslation(nodeId, locale, key, value, translationPageId)
                        }
                        segmentStatus={segmentStatus}
                        segmentKey={segmentKey}
                        onSyncStructure={syncFieldStructure}
                        tc={tc}
                        t={t}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {pendingPlan ? (
        <SimpleModal className="pbx-modal" onClose={() => setPendingPlan(null)}>
          <div data-c42-modal-overlay className="pbx-modal__overlay" />
          <div
            data-c42-modal-content
            className="pbx-modal__content pbx-translation-confirm-modal"
            role="alertdialog"
            aria-label={t("translationTable.confirmTitle")}
          >
            <div className="pbx-modal__header">
              <h3 className="pbx-modal__title">{t("translationTable.confirmTitle")}</h3>
              <IconButton
                icon={CloseIcon}
                intent="ghost"
                size="md"
                label={t("translationTable.close")}
                data-c42-modal-close
              />
            </div>
            <div className="pbx-modal__body">
              <p>
                {t("translationTable.confirmBody", {
                  segments: pendingPlan.plan.segmentCount,
                  chars: pendingPlan.plan.estimatedChars,
                  locale: pendingPlan.locale.toUpperCase(),
                })}
              </p>
              <div className="pbx-translation-confirm-modal__actions">
                <button
                  type="button"
                  className="pbx-publish-panel__btn"
                  disabled={isTranslating}
                  onClick={() => setPendingPlan(null)}
                >
                  {t("translationTable.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="pbx-publish-panel__btn pbx-published-sites__btn--danger"
                  disabled={isTranslating}
                  onClick={confirmTranslate}
                >
                  {isTranslating ? t("translationTable.confirmPending") : t("translationTable.confirmAction")}
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      <ToastHost toast={toast} onClose={hideToast} />
    </SimpleModal>
  );
}

/** Filas de un campo agrupado: un subencabezado + una fila por segmento (docs/51 §4 F5 punto 1). */
function FieldGroupRows({
  group,
  activeLocale,
  translations,
  setNodeTranslation,
  segmentStatus,
  segmentKey,
  onSyncStructure,
  tc,
  t,
}: {
  group: FieldGroupInfo;
  activeLocale: string;
  translations: Record<string, Record<string, Record<string, unknown>>> | undefined;
  setNodeTranslation: (nodeId: string, locale: string, key: string, value: unknown) => void;
  segmentStatus: Map<string, SegmentStatus>;
  segmentKey: (s: Segment) => string;
  onSyncStructure: (group: FieldGroupInfo) => void;
  tc: (key: string, opts?: Record<string, unknown>) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const multiSegment = group.segments.length > 1;
  const existingFieldValue = translations?.[group.nodeId]?.[activeLocale]?.[group.key];

  return (
    <>
      <tr className="pbx-translation-table__group-header">
        <th scope="rowgroup" colSpan={4} className="pbx-translation-table__field">
          <span className="pbx-translation-table__type">
            {tc(`components.${group.nodeType}`, { defaultValue: group.nodeType })}
          </span>
          <span className="pbx-translation-table__key">{group.fieldLabel}</span>
          {group.richTextProgress ? (
            <span className="pbx-translation-table__progress">
              {t("translationTable.richTextProgress", {
                translated: group.richTextProgress.translated,
                total: group.richTextProgress.total,
              })}
            </span>
          ) : null}
          {group.structureMismatch ? (
            <button
              type="button"
              className="pbx-translation-table__auto-btn"
              aria-label={t("translationTable.structureSyncButton", { field: group.fieldLabel })}
              onClick={() => onSyncStructure(group)}
            >
              {t("translationTable.structureSyncButton", { field: group.fieldLabel })}
            </button>
          ) : null}
        </th>
      </tr>
      {multiSegment ? (
        group.segments.map((seg) => {
          const status = segmentStatus.get(segmentKey(seg)) ?? "idle";
          return (
            <tr key={segmentKey(seg)}>
              <td className="pbx-translation-table__index">
                {t("translationTable.segmentIndex", { index: seg.index + 1 })}
              </td>
              <td className="pbx-translation-table__default" title={seg.text}>
                {seg.text}
              </td>
              <td>
                {/* Segmentos richtext se editan como campo completo (ver fila de comentario abajo), no por segmento individual. */}
                <span className="pbx-translation-table__segment-note">
                  {t("translationTable.editWholeField")}
                </span>
              </td>
              <td>
                <SegmentStatusBadge status={status} t={t} />
              </td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td className="pbx-translation-table__index">{group.fieldLabel}</td>
          <td className="pbx-translation-table__default" title={group.defaultValue}>
            {group.defaultValue}
          </td>
          <td>
            <CommittableInput
              value={existingFieldValue == null ? "" : String(existingFieldValue)}
              placeholder={group.defaultValue}
              onCommit={(v) => setNodeTranslation(group.nodeId, activeLocale, group.key, v)}
            />
          </td>
          <td>
            <SegmentStatusBadge status={segmentStatus.get(segmentKey(group.segments[0]!)) ?? "idle"} t={t} />
          </td>
        </tr>
      )}
      {multiSegment ? (
        <tr>
          <td />
          <td colSpan={3}>
            <CommittableInput
              value={existingFieldValue == null ? "" : String(existingFieldValue)}
              placeholder={group.defaultValue}
              onCommit={(v) => setNodeTranslation(group.nodeId, activeLocale, group.key, v)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SegmentStatusBadge({ status, t }: { status: SegmentStatus; t: (key: string) => string }) {
  if (status === "idle") return null;
  const key =
    status === "translating"
      ? "translationTable.statusTranslating"
      : status === "done"
        ? "translationTable.statusDone"
        : "translationTable.statusError";
  return (
    <span className={`pbx-translation-table__status pbx-translation-table__status--${status}`}>{t(key)}</span>
  );
}
