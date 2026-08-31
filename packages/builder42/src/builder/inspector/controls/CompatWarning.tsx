/**
 * CompatWarning — icono de alerta de **compatibilidad entre navegadores** (T6).
 *
 * Se coloca junto al título de una propiedad cuya personalización no es
 * uniforme en todos los navegadores (p. ej. la barra de desplazamiento: Firefox
 * solo respeta color + grosor "fino", mientras Chromium/WebKit permiten afinar
 * grosor exacto, esquinas y hover). Al pasar el cursor muestra un tooltip con la
 * salvedad sintetizada.
 *
 * Chrome del editor (P8/P10): usa el `Tooltip` headless de c42 (vía
 * `@/components`) y el `WarnIcon` de Lucide. El texto llega ya traducido por el
 * consumidor (P9) — este componente no fija idioma.
 */

import { useTranslation } from "react-i18next";
import { Tooltip, WarnIcon } from "@/components";

export function CompatWarning({
  message,
  label,
}: {
  /** Texto del tooltip, ya traducido por el consumidor. */
  message: string;
  /** aria-label del disparador (opcional; por defecto uno genérico i18n). */
  label?: string;
}) {
  const { t } = useTranslation("inspector");
  return (
    <Tooltip className="pbx-compat-tip" placement="bottom-end" openDelay={60} closeDelay={140}>
      <button
        type="button"
        className="pbx-compat-tip__trigger"
        data-c42-tooltip-trigger
        aria-label={label ?? t("compat.label")}
      >
        <WarnIcon size={13} aria-hidden="true" />
      </button>
      <span className="pbx-compat-tip__content" data-c42-tooltip-content>
        {message}
      </span>
    </Tooltip>
  );
}
