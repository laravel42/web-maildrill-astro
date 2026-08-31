/**
 * PublishModal — modal del botón "Publicar" del header (docs/36 D2/F6).
 * Envuelve `PublishPanel` (mismo componente que la tab del `SiteSettingsPanel`,
 * docs/36 §3) — este modal es solo presentación, no duplica lógica.
 *
 * `SimpleModal` en vez de `Modal` de c42 — mismo bug/fix documentado en
 * `src/components/SimpleModal.tsx` y ya usado por `TemplatesPanel.tsx`/
 * `TranslationModal.tsx`: el controller de c42 pierde el estado de React que
 * lo activó bajo `React.StrictMode` cuando se monta tras el mount inicial
 * (exactamente el caso de "click en el botón Publicar → aparece el modal").
 */

import { useTranslation } from "react-i18next";
import { SimpleModal, IconButton, CloseIcon } from "@/components";
import { PublishPanel } from "@/builder/inspector/PublishPanel";

export function PublishModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("header");

  return (
    <SimpleModal className="pbx-modal" onClose={onClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div
        data-c42-modal-content
        className="pbx-modal__content pbx-publish-modal"
        aria-label={t("publish.modalTitle")}
      >
        <div className="pbx-modal__header">
          <h3 className="pbx-modal__title">{t("publish.modalTitle")}</h3>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("publish.close")}
            data-c42-modal-close
          />
        </div>

        <div className="pbx-modal__body">
          <PublishPanel />
        </div>
      </div>
    </SimpleModal>
  );
}
