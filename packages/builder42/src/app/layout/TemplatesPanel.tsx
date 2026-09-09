/**
 * Panel "Plantillas" del sidebar (Fase 13, docs/16 §13).
 * Plantillas de página (reemplazo con confirmación).
 *
 * Las plantillas de **sección** (pick & insert) se movieron al panel
 * "Componentes" (`Sidebar.tsx`, `ComponentsPanel`) como último grupo de la
 * paleta, bajo la categoría `sections` — ver `docs/builder-sections-plan.md`.
 * Este panel ya solo agrupa por `page`; las tarjetas (`PageTemplateCard`) y
 * su lógica de miniatura compartida viven en `TemplateCard.tsx` para que
 * ambos paneles las reutilicen sin duplicar código.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listLayoutsByCategory, type PageLayoutDefinition } from "@/builder/registry/layoutRegistry";
import { useDocumentStore } from "@/builder/store/documentStore";
import { PageTemplateCard } from "./TemplateCard";
import { SimpleModal, IconButton, CloseIcon } from "@/components";
import { AiSectionGenerator } from "@/builder/inspector/AiSectionGenerator";

function PageLayoutConfirmModal({
  layoutId,
  onClose,
}: {
  layoutId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("sidebar");
  const applyPageLayout = useDocumentStore((s) => s.applyPageLayout);
  const [applying, setApplying] = useState(false);
  const layout = listLayoutsByCategory()
    .flatMap((g) => g.layouts)
    .find((l) => l.id === layoutId);

  // `applyPageLayout` es asíncrona desde la carga perezosa (docs/48 §4): el
  // fragmento se importa al confirmar. El modal se queda abierto con el botón en
  // estado de espera hasta que termina, para no cerrarse antes de que el canvas
  // muestre la plantilla.
  const handleApply = () => {
    setApplying(true);
    void applyPageLayout(layoutId).finally(() => {
      setApplying(false);
      onClose();
    });
  };

  // Portal a `document.body` vía `SimpleModal` (bug real, feedback de
  // usuario: "aparece un modal pero se cierra al instante"/"los templates no
  // se insertan"). El `Modal` de c42-react tiene un defecto confirmado bajo
  // `React.StrictMode` (activo en `main.tsx`) cuando se monta como resultado
  // de una actualización de estado posterior al montaje inicial — exactamente
  // este caso (click en la tarjeta → aparece el modal): el controller
  // imperativo del paquete pierde el estado de React que lo activó durante el
  // doble-invocado de efectos de StrictMode. `SimpleModal` (`src/components/`)
  // reimplementa el mismo contrato de marcado/CSS con `useState`/`useEffect`
  // planos, StrictMode-safe (ver comentario en su código fuente).
  return (
    <SimpleModal className="pbx-modal" onClose={onClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div data-c42-modal-content className="pbx-modal__content pbx-template-confirm">
        <div className="pbx-modal__header">
          <div>
            <h3 className="pbx-modal__title">{t("templates.confirm.title")}</h3>
            <p className="pbx-modal__subtitle">
              {t("templates.confirm.body", {
                name: layout ? t(layout.labelKey) : layoutId,
              })}
            </p>
          </div>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("templates.confirm.cancel")}
            data-c42-modal-close
          />
        </div>
        <div className="pbx-modal__body pbx-template-confirm__actions">
          <button type="button" className="pbx-template-confirm__btn" onClick={onClose}>
            {t("templates.confirm.cancel")}
          </button>
          <button
            type="button"
            className="pbx-template-confirm__btn pbx-template-confirm__btn--primary"
            onClick={handleApply}
            disabled={applying}
            aria-busy={applying || undefined}
          >
            {applying ? t("templates.confirm.applying") : t("templates.confirm.apply")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}

export function TemplatesPanel() {
  const { t } = useTranslation("sidebar");
  const [pendingPageLayout, setPendingPageLayout] = useState<string | null>(null);
  const pageLayouts = listLayoutsByCategory()
    .flatMap((g) => g.layouts)
    .filter((l): l is PageLayoutDefinition => l.category === "page");

  return (
    <>
      {pageLayouts.length > 0 ? (
        <div className="pbx-template__group">
          <div className="pbx-template__grid">
            {pageLayouts.map((layout) => (
              <PageTemplateCard
                key={layout.id}
                layout={layout}
                onSelect={setPendingPageLayout}
              />
            ))}
          </div>
        </div>
      ) : null}
      {pendingPageLayout ? (
        <PageLayoutConfirmModal
          layoutId={pendingPageLayout}
          onClose={() => setPendingPageLayout(null)}
        />
      ) : null}
      <AiSectionGenerator />
    </>
  );
}
