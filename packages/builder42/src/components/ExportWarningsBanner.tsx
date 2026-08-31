import { useTranslation } from "react-i18next";
import type { ExportWarning } from "@/builder/export/warnings";

const MAX_SHOWN = 3;

type ExportWarningsNamespace = "inspector" | "canvas";

export function ExportWarningsBanner({
  warnings,
  ns,
}: {
  warnings: ExportWarning[];
  ns: ExportWarningsNamespace;
}) {
  const { t } = useTranslation(ns);
  if (warnings.length === 0) return null;

  const shown = warnings.slice(0, MAX_SHOWN);
  const rest = warnings.length - shown.length;

  return (
    <div className="pbx-export-warnings" role="alert">
      <p className="pbx-export-warnings__title">
        ⚠ {t("export.warningsTitle")} — {t("export.warningsCount", { count: warnings.length })}
      </p>
      <ul className="pbx-export-warnings__list">
        {shown.map((w, i) => (
          <li key={`${w.nodeId}-${w.type}-${i}`}>
            {w.type === "unknown-type"
              ? t("export.unknownType", { nodeId: w.nodeId, type: w.nodeType ?? "?" })
              : t("export.missingNode", { nodeId: w.nodeId })}
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="pbx-export-warnings__more">{t("export.andMore", { count: rest })}</p> : null}
    </div>
  );
}
