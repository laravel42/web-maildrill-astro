/**
 * First-run empty canvas: one starter vs keep blank. Only in the Maildrill
 * embed — standalone still shows the bare container.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { useEmbeddedChrome } from "@/app/EmbeddedChrome";

const STARTER_LAYOUT_ID = "landing-product";

export function CanvasEmptyStart() {
  const embedded = useEmbeddedChrome();
  const { t } = useTranslation("canvas");
  const applyPageLayout = useDocumentStore((s) => s.applyPageLayout);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const childCount = useDocumentStore((s) => s.document.nodes[s.document.rootId]?.children?.length ?? 0);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);

  if (!embedded || dismissed || childCount > 0) return null;

  const handleStarter = () => {
    setApplying(true);
    void applyPageLayout(STARTER_LAYOUT_ID).finally(() => setApplying(false));
  };

  return (
    <div className="pbx-canvas-empty" data-empty-root={rootId}>
      <p className="pbx-canvas-empty__title">{t("empty.title")}</p>
      <p className="pbx-canvas-empty__body">{t("empty.body")}</p>
      <div className="pbx-canvas-empty__actions">
        <button
          type="button"
          className="pbx-canvas-empty__primary"
          disabled={applying}
          onClick={handleStarter}
        >
          {applying ? t("empty.applying") : t("empty.useTemplate")}
        </button>
        <button type="button" className="pbx-canvas-empty__ghost" onClick={() => setDismissed(true)}>
          {t("empty.blank")}
        </button>
      </div>
    </div>
  );
}
