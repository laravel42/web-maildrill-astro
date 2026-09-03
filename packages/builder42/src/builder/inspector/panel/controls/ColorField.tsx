/**
 * ColorField — swatch + valor hex en un mismo campo, con opacidad como pieza
 * adyacente (docs/41 §4.2, §4.4 `color`, Paso 3 de la tabla §7). Reutiliza
 * `ColorPicker` de `@/components` (swatch disparador + popover con
 * saturación/hue + input hex) y `controls/CommittableInput.tsx` para el
 * campo de opacidad (0-100, se guarda como parte del octeto alfa del color
 * si el llamador lo necesita — aquí se expone como valor de texto separado,
 * la composición a un solo string CSS de color con alpha la decide el
 * llamador del Paso 4/5 según el campo real, `background`/`color`/etc.).
 *
 * Mantiene la fila en 32px salvo cuando el picker está expandido — esa
 * expansión ya la resuelve `ColorPicker` con su propio popover flotante
 * (`Dropdown` de c42, no reserva espacio en el flujo), así que ColorField
 * en reposo SIEMPRE mide 32px; no hace falta que este componente pida
 * `tall` a `PropertyRow` — el llamador solo pasa `tall` si de verdad ancla
 * la fila a la excepción documentada (docs/41 §4.3).
 *
 * `hideHexInput` (modo simple, petición explícita del usuario): oculta el
 * `CommittableInput` de valor hex, dejando SOLO el swatch/botón de
 * `ColorPicker` — el popover de ese swatch ya expone saturación/hue + su
 * propio input hex interno, así que el campo hex duplicado de esta fila es
 * redundante para el usuario de modo simple. En modo avanzado (prop
 * ausente/`false`) el comportamiento no cambia: swatch + hex + opacidad
 * lado a lado, como siempre.
 */

import { useTranslation } from "react-i18next";
import { ColorPicker } from "@/components";
import { CommittableInput } from "../../controls/CommittableInput";

const HEX6 = /^#[0-9a-f]{6}$/i;

export interface ColorFieldProps {
  /** Valor hex actual (`#rrggbb`). Si no es hex válido se usa negro en el swatch. */
  value: string;
  /** Opacidad actual (0-100 como string, p. ej. "100"). `undefined` = sin control de opacidad. */
  opacity?: string;
  onCommit: (hex: string) => void;
  onCommitOpacity?: (opacity: string) => void;
  /** Swatches de tokens del tema, reenviados a `ColorPicker`. */
  themeSwatches?: Record<string, string>;
  /** Etiqueta accesible del swatch (p. ej. "Color de fondo"). */
  label: string;
  /** Modo simple (docs de cabecera): oculta el input de texto hex, solo el swatch. */
  hideHexInput?: boolean;
}

export function ColorField({
  value,
  opacity,
  onCommit,
  onCommitOpacity,
  themeSwatches,
  label,
  hideHexInput,
}: ColorFieldProps) {
  const { t } = useTranslation("inspector");
  const safeValue = HEX6.test(value) ? value : value;

  return (
    <div className={"pbx-color-field" + (hideHexInput ? " pbx-color-field--swatch-only" : "")}>
      <ColorPicker
        value={safeValue}
        onChange={onCommit}
        onChangeEnd={onCommit}
        themeSwatches={themeSwatches}
        label={label}
      />
      {!hideHexInput && (
        <CommittableInput
          value={value}
          placeholder={t("styleField.freeValue")}
          onCommit={onCommit}
        />
      )}
      {opacity !== undefined && onCommitOpacity != null && (
        <div
          className="pbx-color-field__opacity"
          role="group"
          aria-label={t("styleField.opacity", { defaultValue: "Opacidad" })}
        >
          <CommittableInput value={opacity} onCommit={onCommitOpacity} />
          <span className="pbx-color-field__opacity-suffix" aria-hidden="true">
            %
          </span>
        </div>
      )}
    </div>
  );
}
