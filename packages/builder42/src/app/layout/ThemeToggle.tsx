/**
 * ThemeToggle — control segmentado de 3 estados para el tema del chrome
 * (Fase 11.d, docs/18): system / light / dark. Chrome del editor (P8).
 *
 * Vive dentro del `ProfileMenu` (dropdown del header). Los iconos son Lucide
 * (`MonitorCog` = seguir al sistema, `Sun` = claro, `Moon` = oscuro).
 */

import { useTranslation } from "react-i18next";
import { useThemeMode, type ThemeMode } from "@/hooks/useThemeMode";
import { MonitorCog, Sun, Moon } from "@/components";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

const OPTIONS: { value: ThemeMode; Icon: ComponentType<LucideProps>; labelKey: string }[] = [
  { value: "system", Icon: MonitorCog, labelKey: "theme.system" },
  { value: "light", Icon: Sun, labelKey: "theme.light" },
  { value: "dark", Icon: Moon, labelKey: "theme.dark" },
];

export function ThemeToggle() {
  const { t } = useTranslation("header");
  const [mode, , setMode, hostControlled] = useThemeMode();

  // docs/52 F7 (I6): en modo embebido con `themeMode="host"`, el tema lo
  // decide el host — mostrar un toggle sin efecto sería confuso.
  if (hostControlled) return null;

  return (
    <div className="pbx-theme-toggle" role="group" aria-label={t("theme.label")}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={
            "pbx-theme-toggle__btn" +
            (mode === opt.value ? " pbx-theme-toggle__btn--active" : "")
          }
          aria-pressed={mode === opt.value}
          title={t(opt.labelKey)}
          onClick={() => setMode(opt.value)}
        >
          <opt.Icon size={15} aria-hidden="true" />
          <span className="pbx-theme-toggle__label">{t(opt.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
