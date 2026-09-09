/**
 * SeoSettings — metadata SEO de la página activa, traducible por idioma
 * (docs/12 §B.9, panel de configuración de sitio). Edita `title`,
 * `description`, `seo.canonical`, `seo.robots`, Open Graph y Twitter Card de
 * `page.meta`. Respeta `editingLocale` (docs/12 §B.6, mismo patrón que
 * `PropField.tsx`): en el idioma default escribe directo en `page.meta`; en
 * otro idioma escribe en `page.meta.metaTranslations[editingLocale]` y
 * muestra el badge "sin traducir" cuando el valor mostrado es el fallback al
 * default. El `slug` NO aparece aquí — se traduce en `PageManager` (no se
 * traduce el slug en sí, docs/12 §B.9).
 *
 * **Autocompletado de traducción (docs/51 §4 F6b, D13):** botón
 * "Autocompletar faltantes" que traduce los 6 campos de prosa de la lista
 * blanca (`TRANSLATABLE_META_FIELDS`, `services/translation/metaSegments.ts`)
 * al `editingLocale` activo — el MISMO selector de idioma de contenido que ya
 * usa el resto del panel (`ContentLocaleSelect`/`LocaleQuickAccess`), sin
 * agregar un segundo selector. Mismo patrón UX que `TranslationModal.tsx`
 * (F5): confirmación previa con estimado de caracteres, estado de
 * error/éxito, deshacer vía `ToastHost`, contador de uso.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SimpleModal, IconButton, CloseIcon, ToastHost, useToast } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { MetaFieldPath } from "@/builder/store/documentStore";
import type { PageId, PageMeta, PageMetaTranslation } from "@/builder/model/types";
import { isTranslatableTarget } from "../../../shared/deeplLang";
import {
  planMetaTranslation,
  runMetaTranslation,
  type MetaTranslationPlan,
} from "@/services/translation/metaSegments";
import { fetchHealth, fetchTranslateUsage, translateTexts, ApiError } from "@/services/apiClient";
import type { HealthResponse, TranslateUsageResponse } from "../../../shared/api";
import { CommittableInput } from "./controls/CommittableInput";
import { LocaleQuickAccess } from "./controls/LocaleQuickAccess";

/** Lee el valor default (idioma base) de `field` desde `PageMeta`. */
export function readDefault(meta: PageMeta, field: MetaFieldPath): string {
  switch (field) {
    case "title":
      return meta.title ?? "";
    case "description":
      return meta.description ?? "";
    case "seo.canonical":
      return meta.seo?.canonical ?? "";
    case "seo.robots":
      return meta.seo?.robots ?? "";
    case "seo.openGraph.title":
      return meta.seo?.openGraph?.title ?? "";
    case "seo.openGraph.description":
      return meta.seo?.openGraph?.description ?? "";
    case "seo.openGraph.image":
      return meta.seo?.openGraph?.image ?? "";
    case "seo.openGraph.type":
      return meta.seo?.openGraph?.type ?? "";
    case "seo.twitter.card":
      return meta.seo?.twitter?.card ?? "";
    case "seo.twitter.title":
      return meta.seo?.twitter?.title ?? "";
    case "seo.twitter.description":
      return meta.seo?.twitter?.description ?? "";
    case "seo.twitter.image":
      return meta.seo?.twitter?.image ?? "";
  }
}

/** Lee el valor traducido de `field` desde una `PageMetaTranslation`, o `undefined` si no está. */
export function readTranslation(t: PageMetaTranslation, field: MetaFieldPath): string | undefined {
  switch (field) {
    case "title":
      return t.title;
    case "description":
      return t.description;
    case "seo.canonical":
      return t.seo?.canonical;
    case "seo.robots":
      return t.seo?.robots;
    case "seo.openGraph.title":
      return t.seo?.openGraph?.title;
    case "seo.openGraph.description":
      return t.seo?.openGraph?.description;
    case "seo.openGraph.image":
      return t.seo?.openGraph?.image;
    case "seo.openGraph.type":
      return t.seo?.openGraph?.type;
    case "seo.twitter.card":
      return t.seo?.twitter?.card;
    case "seo.twitter.title":
      return t.seo?.twitter?.title;
    case "seo.twitter.description":
      return t.seo?.twitter?.description;
    case "seo.twitter.image":
      return t.seo?.twitter?.image;
  }
}

interface SeoFieldProps {
  pageId: string;
  field: MetaFieldPath;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

function SeoField({ pageId, field, label, placeholder }: SeoFieldProps) {
  const { t } = useTranslation("inspector");
  const setPageMetaTranslation = useDocumentStore((s) => s.setPageMetaTranslation);
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const page = useDocumentStore((s) => s.site.pages[pageId]);

  const defaultValue = page ? readDefault(page.meta, field) : "";

  const { value, isTranslated } = useMemo(() => {
    if (editingLocale === defaultLang) return { value: defaultValue, isTranslated: true };
    const t = page?.meta.metaTranslations?.[editingLocale];
    const translated = t ? readTranslation(t, field) : undefined;
    if (translated !== undefined) return { value: translated, isTranslated: true };
    return { value: defaultValue, isTranslated: false };
  }, [editingLocale, defaultLang, page, field, defaultValue]);

  const showUntranslated = editingLocale !== defaultLang && !isTranslated;

  return (
    <div className="pbx-control">
      <div className="pbx-control__header">
        <span className="pbx-control__label">{label}</span>
        {showUntranslated ? (
          <span className="pbx-badge pbx-badge--untranslated" title={t("translation.untranslated")}>
            {t("translation.badge")}
          </span>
        ) : null}
        <LocaleQuickAccess />
      </div>

      <CommittableInput
        value={value}
        placeholder={placeholder}
        onCommit={(v) => setPageMetaTranslation(pageId, field, v)}
      />
    </div>
  );
}

/** Snapshot de un valor previo, para "Deshacer autocompletado" (D8, docs/51 §4 F6b). */
interface MetaUndoEntry {
  field: MetaFieldPath;
  /** Valor de `metaTranslations[locale][field]` antes de escribir. `undefined` = no había traducción. */
  previousValue: string | undefined;
}

/**
 * SeoAutoTranslate — botón "Autocompletar faltantes" + confirmación previa +
 * deshacer + contador de uso (docs/51 §4 F6b). Usa el `editingLocale` YA
 * activo del store como locale destino (no agrega un segundo selector).
 * Visible solo si el sitio es multilingüe y hay al menos un locale extra
 * (controlado por el caller, `SeoSettings`).
 */
function SeoAutoTranslate({ pageId }: { pageId: PageId }) {
  const { t } = useTranslation("inspector");
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const setPageMetaTranslation = useDocumentStore((s) => s.setPageMetaTranslation);
  const page = useDocumentStore((s) => s.site.pages[pageId]);

  const [health, setHealth] = useState<HealthResponse["translate"] | undefined>(undefined);
  const [usage, setUsage] = useState<TranslateUsageResponse | undefined>(undefined);

  useEffect(() => {
    fetchHealth()
      .then((h) => {
        setHealth(h.translate);
        if (h.translate?.enabled) {
          fetchTranslateUsage().then(setUsage).catch(() => setUsage(undefined));
        }
      })
      .catch(() => setHealth({ enabled: false }));
  }, []);

  const refreshUsage = useCallback(() => {
    if (!health?.enabled) return;
    fetchTranslateUsage().then(setUsage).catch(() => undefined);
  }, [health?.enabled]);

  const [pendingPlan, setPendingPlan] = useState<MetaTranslationPlan | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  const localeTranslatable = isTranslatableTarget(editingLocale);
  const disabledReason =
    health === undefined
      ? t("translationTable.autoCheckingAvailability")
      : health.enabled === false
        ? t("translationTable.autoDisabledServer")
        : !localeTranslatable
          ? t("translationTable.autoDisabledLocale", { locale: editingLocale.toUpperCase() })
          : undefined;

  function currentReaders() {
    return {
      readDefaultField: (field: MetaFieldPath) => (page ? readDefault(page.meta, field) : ""),
      readTranslationField: (field: MetaFieldPath): string | undefined => {
        const translation = page?.meta.metaTranslations?.[editingLocale];
        return translation ? readTranslation(translation, field) : undefined;
      },
    };
  }

  function openConfirm() {
    const { readDefaultField, readTranslationField } = currentReaders();
    const plan = planMetaTranslation({ readDefault: readDefaultField, readTranslation: readTranslationField });
    if (plan.uniqueTexts.length === 0) return;
    setTranslateError(null);
    setPendingPlan(plan);
  }

  async function confirmTranslate() {
    if (!pendingPlan) return;
    const plan = pendingPlan;

    setIsTranslating(true);
    setTranslateError(null);

    // Snapshot de los valores previos (D8) — leídos justo antes de escribir.
    const { readTranslationField } = currentReaders();
    const undoEntries: MetaUndoEntry[] = plan.segments.map((seg) => ({
      field: seg.field,
      previousValue: readTranslationField(seg.field),
    }));

    try {
      const outcome = await runMetaTranslation({
        plan,
        targetLocale: editingLocale,
        translate: translateTexts,
        write: (field, value) => setPageMetaTranslation(pageId, field, value),
      });

      if (outcome.written > 0) {
        showToast({
          message: t("seoSettings.autoDoneMessage", {
            count: outcome.written,
            locale: editingLocale.toUpperCase(),
          }),
          actionLabel: t("translationTable.undoAction"),
          onAction: () => undoLastBatch(undoEntries),
        });
      }

      if (outcome.failedSegments.length > 0) {
        setTranslateError(t("translationTable.autoPartialError", { count: outcome.failedSegments.length }));
      }

      refreshUsage();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("translationTable.autoErrorUnknown");
      setTranslateError(message);
    } finally {
      setIsTranslating(false);
      setPendingPlan(null);
    }
  }

  function undoLastBatch(entries: MetaUndoEntry[]) {
    // Misma limitación documentada que `TranslationModal.tsx` (docs/51 §4 F5
    // punto 7): `setPageMetaTranslation` no borra una clave, solo asigna un
    // valor. Sin valor previo, "deshacer" restaura cadena vacía — el campo
    // vuelve a mostrarse como "sin traducir" en la práctica.
    for (const entry of entries) {
      setPageMetaTranslation(pageId, entry.field, entry.previousValue ?? "");
    }
    hideToast();
  }

  return (
    <div className="pbx-seo-settings__auto-translate">
      <div className="pbx-translation-table__toolbar">
        <button
          type="button"
          className="pbx-translation-table__auto-btn"
          disabled={Boolean(disabledReason) || isTranslating}
          title={disabledReason}
          onClick={openConfirm}
        >
          {t("seoSettings.autoButton", { locale: editingLocale.toUpperCase() })}
        </button>
      </div>

      <p className="pbx-translation-table__privacy-note">{t("translationTable.privacyNote")}</p>

      {usage ? (
        <p className="pbx-translation-table__usage">
          {t("translationTable.usage", { used: usage.daily.used, limit: usage.daily.limit })}
        </p>
      ) : null}

      {translateError ? (
        <p className="pbx-translation-table__error" role="alert">
          {translateError}
        </p>
      ) : null}

      {pendingPlan ? (
        <SimpleModal className="pbx-modal" onClose={() => setPendingPlan(null)}>
          <div data-c42-modal-overlay className="pbx-modal__overlay" />
          <div
            data-c42-modal-content
            className="pbx-modal__content pbx-translation-confirm-modal"
            role="alertdialog"
            aria-label={t("seoSettings.confirmTitle")}
          >
            <div className="pbx-modal__header">
              <h3 className="pbx-modal__title">{t("seoSettings.confirmTitle")}</h3>
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
                {t("seoSettings.confirmBody", {
                  fields: pendingPlan.segments.length,
                  chars: pendingPlan.estimatedChars,
                  locale: editingLocale.toUpperCase(),
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
    </div>
  );
}

export function SeoSettings() {
  const { t } = useTranslation("inspector");
  const activePageId = useDocumentStore((s) => s.activePageId);
  const i18n = useDocumentStore((s) => s.site.meta.i18n);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const editingLocale = useDocumentStore((s) => s.editingLocale);

  // docs/51 §4 F6b: el botón de autocompletar solo aplica en un locale de
  // CONTENIDO no-default (mismo criterio que el resto del panel para el
  // badge "sin traducir") y solo si el sitio es multilingüe con al menos un
  // locale extra además del default.
  const hasExtraLocale = Boolean(i18n) && (i18n?.locales.length ?? 0) > 1;
  const showAutoTranslate = hasExtraLocale && editingLocale !== defaultLang;

  return (
    <section className="pbx-site-settings__section pbx-seo-settings">
      <h4 className="pbx-inspector__heading">{t("seoSettings.title")}</h4>
      <p className="pbx-i18n-settings__hint">{t("seoSettings.hint")}</p>

      {showAutoTranslate ? <SeoAutoTranslate pageId={activePageId} /> : null}

      <SeoField pageId={activePageId} field="title" label={t("seoSettings.pageTitle")} />
      <SeoField
        pageId={activePageId}
        field="description"
        label={t("seoSettings.description")}
        placeholder={t("seoSettings.descriptionPlaceholder")}
      />
      <SeoField
        pageId={activePageId}
        field="seo.canonical"
        label={t("seoSettings.canonical")}
        placeholder="https://ejemplo.com/pagina/"
      />
      <SeoField
        pageId={activePageId}
        field="seo.robots"
        label={t("seoSettings.robots")}
        placeholder="index, follow"
      />

      <h5 className="pbx-inspector__subheading">{t("seoSettings.openGraphTitle")}</h5>
      <SeoField pageId={activePageId} field="seo.openGraph.title" label={t("seoSettings.ogTitle")} />
      <SeoField
        pageId={activePageId}
        field="seo.openGraph.description"
        label={t("seoSettings.ogDescription")}
      />
      <SeoField
        pageId={activePageId}
        field="seo.openGraph.image"
        label={t("seoSettings.ogImage")}
        placeholder="https://ejemplo.com/og.jpg"
      />
      <SeoField
        pageId={activePageId}
        field="seo.openGraph.type"
        label={t("seoSettings.ogType")}
        placeholder="website"
      />

      <h5 className="pbx-inspector__subheading">{t("seoSettings.twitterTitle")}</h5>
      <SeoField
        pageId={activePageId}
        field="seo.twitter.card"
        label={t("seoSettings.twitterCard")}
        placeholder="summary_large_image"
      />
      <SeoField pageId={activePageId} field="seo.twitter.title" label={t("seoSettings.twitterTitleField")} />
      <SeoField
        pageId={activePageId}
        field="seo.twitter.description"
        label={t("seoSettings.twitterDescription")}
      />
      <SeoField
        pageId={activePageId}
        field="seo.twitter.image"
        label={t("seoSettings.twitterImage")}
        placeholder="https://ejemplo.com/twitter.jpg"
      />
    </section>
  );
}
