/**
 * ExperienceLevelToggle — control segmentado de 2 estados para el nivel de
 * experiencia de la UI: simple / avanzado (`experienceLevel`, ver
 * `useLocalConfig.ts`). Vive dentro del `ProfileMenu` (dropdown del header),
 * mismo patrón que `ThemeToggle`/`ReorderControlsToggle` (reusa la clase
 * `pbx-theme-toggle`, chrome del editor, P8).
 *
 * Bandera NUEVA e independiente del `uiComplexity` derogado en docs/41 (D1)
 * — no reintroduce ninguna de sus condicionales del Inspector. El alcance
 * concreto de qué secciones de la UI cambian con cada valor se define
 * incrementalmente fuera de este control.
 *
 * Se pregunta una única vez al primer inicio vía `OnboardingExperienceModal`
 * (que además marca `experienceLevelChosen`); este toggle permite cambiarla
 * después en cualquier momento.
 */

import { useTranslation } from "react-i18next";
import { useLocalConfig, type ConfigMap } from "@/hooks/useLocalConfig";
import { Sparkles, SlidersHorizontal } from "@/components";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

type ExperienceLevel = ConfigMap["experienceLevel"];

const OPTIONS: { value: ExperienceLevel; Icon: ComponentType<LucideProps>; labelKey: string }[] = [
  { value: "simple", Icon: Sparkles, labelKey: "experienceLevel.simple" },
  { value: "advanced", Icon: SlidersHorizontal, labelKey: "experienceLevel.advanced" },
];

export function ExperienceLevelToggle() {
  const { t } = useTranslation("header");
  const [value, setValue] = useLocalConfig("experienceLevel");

  return (
    <div className="pbx-theme-toggle" role="group" aria-label={t("experienceLevel.label")}>
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
          <opt.Icon size={15} aria-hidden="true" />
          <span className="pbx-theme-toggle__label">{t(opt.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
