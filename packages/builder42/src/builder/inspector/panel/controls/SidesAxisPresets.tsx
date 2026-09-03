/**
 * SidesAxisPresets — control simplificado para `spacing.padding`/`.margin`
 * en modo simple (docs/spacing-simple-presets-plan.md). Sustituye la rejilla
 * numérica 2×2 de `SidesGrid` por 2 `PbxSelect` (eje X = left+right, eje Y =
 * top+bottom) con presets `sm`/`md`/`lg` — mismo criterio que `BorderSimple`
 * (varios sub-controles curados que arman/leen el MISMO shorthand CSS del
 * modelo, sin campos nuevos en el esquema de estilo) y que `PresetNumeric`
 * (presets curados en vez de un numérico libre).
 *
 * Reusa `parseSides`/`serializeSides` (funciones puras de `SidesGrid.tsx`,
 * sin cambios) para leer/escribir el shorthand — solo cambia CÓMO se edita
 * cada eje: en vez de 1 `NumericField` por lado, 1 `PbxSelect` por eje que
 * escribe el MISMO valor a ambos lados de ese eje (`applyAxisPreset`).
 *
 * Agrupación por EJE (no por lado, decisión de diseño del plan §4): el
 * pedido original permitía ambas variantes; se elige por eje porque es el
 * caso más común (espaciados simétricos) y coincide con "dos selects"
 * (plan §6.5) sin agregar un toggle adicional de agrupación.
 *
 * Sin candado propio: a diferencia de `SidesGrid`, este control no tiene
 * modo "lados independientes" — cada select YA controla 2 lados a la vez.
 * El candado de `SidesGrid` (vincular los 4 lados a 1 valor) no aplica aquí;
 * si el usuario necesita esa granularidad completa, usa el modo avanzado.
 *
 * Valor sin preset activo (eje no uniforme, "auto", 0, o número fuera de la
 * escala sm/md/lg — p. ej. heredado de una edición previa en modo avanzado):
 * el select de ese eje se muestra SIN selección (`value: ""`,
 * `PbxSelect.placeholder`) en vez de forzar un valor — elegir cualquier
 * preset del select sigue funcionando y sobrescribe ese eje.
 */

import { useTranslation } from "react-i18next";
import { PbxSelect } from "@/components";
import {
  applyAxisPreset,
  axisPresetValue,
  AXIS_PRESET_SIZES,
  parseSides,
  serializeSides,
  type AxisPresetSize,
  type SpacingAxis,
} from "./SidesGrid";

export interface SidesAxisPresetsProps {
  /** Shorthand CSS actual ("16px", "8px 16px 24px 32px", "0 auto", ""). */
  value: string;
  onCommit: (value: string) => void;
}

export function SidesAxisPresets({ value, onCommit }: SidesAxisPresetsProps) {
  const { t } = useTranslation("inspector");
  const sides = parseSides(value);

  const options = AXIS_PRESET_SIZES.map((size) => ({
    value: size,
    label: t(`panel.sidesAxisPresets.sizes.${size}`),
  }));

  const handleChange = (axis: SpacingAxis, size: string) => {
    onCommit(serializeSides(applyAxisPreset(sides, axis, size as AxisPresetSize)));
  };

  return (
    <div className="pbx-sides-axis-presets">
      <div className="pbx-sides-axis-presets__field">
        <span className="pbx-sides-axis-presets__label">{t("panel.sidesAxisPresets.x")}</span>
        <PbxSelect
          value={axisPresetValue(sides, "x") ?? ""}
          options={options}
          placeholder={t("panel.custom")}
          ariaLabel={t("panel.sidesAxisPresets.x")}
          onChange={(v) => handleChange("x", v)}
        />
      </div>
      <div className="pbx-sides-axis-presets__field">
        <span className="pbx-sides-axis-presets__label">{t("panel.sidesAxisPresets.y")}</span>
        <PbxSelect
          value={axisPresetValue(sides, "y") ?? ""}
          options={options}
          placeholder={t("panel.custom")}
          ariaLabel={t("panel.sidesAxisPresets.y")}
          onChange={(v) => handleChange("y", v)}
        />
      </div>
    </div>
  );
}
