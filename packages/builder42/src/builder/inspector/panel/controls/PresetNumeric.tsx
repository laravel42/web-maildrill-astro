/**
 * PresetNumeric — par preset + valor sincronizados en una misma fila de 32px
 * (docs/41 §4.4 `presetNumeric`, §6: `fontSize` S/M/L y `width`
 * Completo/Auto/Custom + numérico).
 *
 * REDISEÑO (petición del usuario, este commit): la versión anterior
 * mostraba el segmented de presets Y el `NumericField` SIEMPRE juntos en la
 * misma fila — dos controles a la vez ocupaba demasiado espacio en filas ya
 * angostas (`size.width`, `typography.fontSize`). Ahora es una alternancia:
 *
 * - Si el valor actual coincide con un preset (o está vacío/heredado): se
 *   muestra el segmented de presets + un botón "Custom" al final.
 * - Si se pulsa "Custom", o el valor actual NO coincide con ningún preset
 *   (p. ej. "37px", escrito a mano): se muestra el `NumericField` en su
 *   lugar, sin el segmented.
 * - El botón de reset del panel (`PropertyField`, fuera de este componente)
 *   hace `commit("")` — un valor vacío SIEMPRE cae en el modo "presets"
 *   (nunca en "Custom"), que es la forma de "volver al switch" pedida: el
 *   reset ya lo resuelve gratis, sin lógica adicional aquí.
 * - Pulsar "Custom" es una decisión de UI pura (no escribe ningún valor
 *   todavía) — vive en un `useState` local que se resetea cuando el valor
 *   pasa a coincidir con un preset por otra vía (p. ej. el usuario elige un
 *   preset mientras estaba en modo Custom, o un reset externo).
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NumericField, type NumericFieldProps } from "./NumericField";

export interface PresetNumericPreset {
  /** Etiqueta ya traducida del preset (p. ej. "S", "Completo"). */
  label: string;
  /** Valor CSS que escribe este preset (p. ej. "14px", "100%", "auto"). */
  value: string;
}

export interface PresetNumericProps {
  /** Valor CSS actual — única fuente de verdad, compartida entre preset y numérico. */
  value: string;
  presets: PresetNumericPreset[];
  /** Props que se reenvían al `NumericField` en modo Custom (unidades, icono, etc.). */
  numericProps: Omit<NumericFieldProps, "value" | "onCommit">;
  /** Etiqueta accesible del grupo de presets (p. ej. "Tamaño de fuente"). */
  presetsAriaLabel: string;
  onCommit: (value: string) => void;
}

export function PresetNumeric({
  value,
  presets,
  numericProps,
  presetsAriaLabel,
  onCommit,
}: PresetNumericProps) {
  const { t } = useTranslation("inspector");
  const matchesPreset = presets.some((p) => p.value === value);

  // Modo "Custom" forzado por el usuario (botón "Custom"), independiente de
  // si el valor coincide con un preset — permite pasar a Custom ANTES de
  // escribir un valor propio. Se resetea a `false` en cuanto el valor pasa a
  // coincidir con un preset por cualquier vía externa (elegir un preset,
  // reset del panel a "") — nunca queda "atascado" en Custom con un valor de
  // preset activo.
  const [forcedCustom, setForcedCustom] = useState(false);
  useEffect(() => {
    if (matchesPreset || value === "") setForcedCustom(false);
  }, [matchesPreset, value]);

  const showCustom = forcedCustom || (!matchesPreset && value !== "");

  if (showCustom) {
    return <NumericField {...numericProps} value={value} onCommit={onCommit} />;
  }

  return (
    <div className="pbx-preset-numeric" role="group" aria-label={presetsAriaLabel}>
      <div className="pbx-segmented pbx-preset-numeric__segmented">
        {presets.map((preset) => {
          const isActive = value === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              className={
                "pbx-segmented__btn pbx-preset-numeric__preset" +
                (isActive ? " pbx-segmented__btn--active" : "")
              }
              aria-pressed={isActive}
              onClick={() => onCommit(isActive ? "" : preset.value)}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          className="pbx-segmented__btn pbx-preset-numeric__preset pbx-preset-numeric__custom-btn"
          onClick={() => setForcedCustom(true)}
        >
          {t("panel.custom")}
        </button>
      </div>
    </div>
  );
}
