/**
 * StylePresetsSection (F27) — sección del panel de Estilo que ofrece los
 * style presets aplicables al nodo seleccionado (`stylePresetsForNode`).
 * Mismo espíritu que `BehaviorsSection`: el core solo consulta el registro
 * con `appliesTo`, nunca hace `switch(preset.id)`. A diferencia de un
 * behavior, aplicar un preset no deja nada "activo" que mostrar de vuelta —
 * no hay card activa/inactiva, cada card es siempre la misma acción
 * (fusionar el preset sobre el estilo actual, `applyStylePreset`), y sus
 * campos quedan editables como cualquier otro justo después (decisión 2 de
 * la bitácora, chain F27).
 *
 * Se oculta sola cuando el nodo no admite ningún preset (decisión 8): un
 * `return null` temprano, igual que `sectionsForNode` ya omite una sección
 * de campos sin filas — sin estado "no disponible" que mostrar, a
 * diferencia de `BehaviorsSection` (esa tab siempre existe; esta sección es
 * un bloque más dentro de una tab que sí tiene otro contenido).
 *
 * Reusa `PanelSection` (encabezado colapsable, `panel/PanelSection.tsx`) y
 * las clases `.pbx-behaviors-grid`/`.pbx-behavior-card--available` que ya
 * pinta el grid de cards de `BehaviorsSection` — mismo patrón visual
 * (card = botón que aplica algo), sin CSS nueva.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BuilderNode } from "../model/types";
import { stylePresetsForNodeByCategory } from "../registry/stylePresetRegistry";
import { useDocumentStore } from "../store/documentStore";
import { PanelSection } from "./panel/PanelSection";

export function StylePresetsSection({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const applyStylePreset = useDocumentStore((s) => s.applyStylePreset);
  const [open, setOpen] = useState(true);

  const groups = stylePresetsForNodeByCategory(node);
  if (groups.length === 0) return null;

  const definitions = groups.flatMap((group) => group.definitions);

  return (
    <PanelSection
      id="stylePresets"
      label={t("stylePresets.title")}
      modifiedCount={0}
      open={open}
      onToggleOpen={() => setOpen((v) => !v)}
    >
      <p className="pbx-behaviors__hint">{t("stylePresets.hint")}</p>
      <div className="pbx-behaviors-grid">
        {definitions.map((def) => (
          <button
            key={def.id}
            type="button"
            className="pbx-behavior-card--available"
            onClick={() => applyStylePreset(node.id, def.id)}
          >
            <span className="pbx-behavior-card__head">
              <span className="pbx-behavior-card__name">{t(def.labelKey)}</span>
            </span>
          </button>
        ))}
      </div>
    </PanelSection>
  );
}
