/**
 * ReorderControlsToggle — control segmentado de 3 estados para la visibilidad
 * de los controles de reordenamiento por flechas (▲▼◀▶, docs/24 §2.3):
 * auto / on / off. Vive dentro del `ProfileMenu` (dropdown del header), mismo
 * patrón que `ThemeToggle` (reusa la clase `pbx-theme-toggle`, chrome del
 * editor, P8).
 *
 * "auto" sigue `usePointerCoarse()` (visible en touch/tablet, oculto en
 * desktop con puntero fino); "on"/"off" fuerzan el valor sin importar el
 * dispositivo.
 */

import { useTranslation } from "react-i18next";
import { useLocalConfig, type ConfigMap } from "@/hooks/useLocalConfig";
import { ArrowUpDown } from "@/components";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

type ReorderControls = ConfigMap["reorderControls"];

const OPTIONS: { value: ReorderControls; labelKey: string }[] = [
  { value: "auto", labelKey: "reorderControls.auto" },
  { value: "on", labelKey: "reorderControls.on" },
  { value: "off", labelKey: "reorderControls.off" },
];

const Icon: ComponentType<LucideProps> = ArrowUpDown;

export function ReorderControlsToggle() {
  const { t } = useTranslation("header");
  const [value, setValue] = useLocalConfig("reorderControls");

  return (
    <div className="pbx-theme-toggle" role="group" aria-label={t("reorderControls.label")}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={
            "pbx-theme-toggle__btn" +
            (value === opt.value ? " pbx-theme-toggle__btn--active" : "")
          }
          aria-pressed={value === opt.value}
          title={t(opt.labelKey)}
          onClick={() => setValue(opt.value)}
        >
          <Icon size={15} aria-hidden="true" />
          <span className="pbx-theme-toggle__label">{t(opt.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
