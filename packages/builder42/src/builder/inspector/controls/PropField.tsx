import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { BuilderNode } from "@/builder/model/types";
import type { FieldSchema } from "@/builder/registry/types";
import { LocaleQuickAccess } from "./LocaleQuickAccess";
import { propControlUsesRowLayout, renderPropControl } from "./propControls/registry";

export function PropField({ node, field }: { node: BuilderNode; field: FieldSchema }) {
  const { t } = useTranslation("inspector");
  const setProp = useDocumentStore((s) => s.setProp);
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const activePage = useDocumentStore((s) => s.site.pages[s.activePageId]);
  const defaultValue = node.props[field.key];

  const { value: translatedValue, isTranslated } = useMemo(() => {
    if (!field.translatable || editingLocale === defaultLang) {
      return { value: defaultValue, isTranslated: true };
    }
    const nodeT = activePage?.translations?.[node.id]?.[editingLocale];
    if (nodeT && field.key in nodeT) {
      return { value: nodeT[field.key], isTranslated: true };
    }
    return { value: defaultValue, isTranslated: false };
  }, [field.translatable, field.key, editingLocale, defaultLang, activePage, defaultValue, node.id]);

  const raw = field.translatable ? translatedValue : defaultValue;
  const value = raw === undefined || raw === null ? "" : String(raw);
  const commit = (v: string) => setProp(node.id, field.key, v);
  const showUntranslated = field.translatable && editingLocale !== defaultLang && !isTranslated;

  const isRowLayout = propControlUsesRowLayout(field.control);

  return (
    <div className={`pbx-control${isRowLayout ? " pbx-control--row" : " pbx-control--stacked"}`}>
      <div className="pbx-control__header">
        <span className="pbx-control__label">{field.label}</span>

        {/* Badge "sin traducir" */}
        {showUntranslated ? (
          <span className="pbx-badge pbx-badge--untranslated" title={t("translation.untranslated")}>
            {t("translation.badge")}
          </span>
        ) : null}

        {/* Acceso rápido de idioma unificado (Globe + código) */}
        {field.translatable ? <LocaleQuickAccess /> : null}
      </div>

      {/* Cuerpo del control — delegado al registry por `field.control` (P4) */}
      <div className="pbx-control__body">
        {renderPropControl({ node, field, raw, value, commit, setProp, t })}
      </div>
    </div>
  );
}
