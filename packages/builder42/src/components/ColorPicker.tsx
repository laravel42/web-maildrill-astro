/**
 * ColorPicker — control de color del chrome del editor (docs/40 §3).
 *
 * Excepción documentada a P10 (AGENTS.md §5.2, misma categoría que Lucide,
 * framer-motion y Tiptap): `react-colorful` es un control UI de dominio
 * especializado (área de saturación/luminosidad + barra de hue en 2D), no un
 * select/dropdown/modal genérico — c42 no ofrece un equivalente visual.
 * Se limita al chrome del editor; nunca se importa desde `registry/components/`
 * ni desde `export/` (P8).
 *
 * Se monta dentro de un `Dropdown` de c42 (popover), disparado al click en el
 * swatch actual — no ocupa espacio en el panel hasta abrirlo. Opcionalmente
 * muestra los tokens `colors.*` del sitio como pills de selección rápida.
 *
 * `onChange` se dispara en cada frame del drag (uso interno del picker,
 * feedback visual); `onChangeEnd` solo al soltar — es el que debe conectarse
 * a una acción de store que cree una entrada en el historial de undo (zundo),
 * para no saturarlo con un commit por frame.
 */

import { useEffect, useRef, useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { useTranslation } from "react-i18next";
import { Dropdown } from "@josecortez1/c42-react";

const HEX6 = /^#[0-9a-f]{6}$/i;

export interface ColorPickerProps {
  /** Valor actual en hex (`#rrggbb`). Si no es un hex válido, se usa negro. */
  value: string;
  /** Se dispara en cada cambio durante el drag (no commitear al store aquí). */
  onChange: (hex: string) => void;
  /** Se dispara al soltar el drag / terminar la interacción — commitear aquí. */
  onChangeEnd?: (hex: string) => void;
  /** Swatches de tokens del tema (`ruta -> hex`) como presets rápidos. */
  themeSwatches?: Record<string, string>;
  /** Etiqueta accesible del swatch disparador. */
  label: string;
  className?: string;
  /** Clase adicional para el botón swatch disparador (p. ej. para adoptar el
   * tamaño/radio del control que lo homologa: `pbx-token__swatch`,
   * `pbx-control__swatch`). Se agrega junto a `pbx-color-picker__swatch`,
   * nunca la reemplaza. */
  swatchClassName?: string;
}

export function ColorPicker({
  value,
  onChange,
  onChangeEnd,
  themeSwatches,
  label,
  className,
  swatchClassName,
}: ColorPickerProps) {
  const { t } = useTranslation("tokens");
  const safeValue = HEX6.test(value) ? value : "#000000";
  const swatchEntries = themeSwatches ? Object.entries(themeSwatches) : [];

  // Estado local del "borrador" en curso: `HexColorPicker` es un componente
  // controlado, pero solo queremos comitear al store (vía `onChangeEnd`) al
  // soltar el drag — no en cada frame (saturaría el undo stack de zundo,
  // docs/40 §3.3). Mientras se arrastra, el picker debe seguir el movimiento
  // del puntero en vivo, así que se refleja en un estado local en vez de
  // esperar a que el `value` (prop) vuelva a bajar tras el commit.
  const [draft, setDraft] = useState(safeValue);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Si el valor externo cambia (otro origen, o tras el commit de arriba),
  // sincroniza el borrador.
  useEffect(() => {
    setDraft(safeValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeValue]);

  const handleChange = (hex: string) => {
    setDraft(hex);
    onChange(hex);
  };

  const commit = () => onChangeEnd?.(draftRef.current);

  return (
    <Dropdown placement="bottom-start" className={"pbx-color-picker" + (className ? ` ${className}` : "")}>
      <button
        type="button"
        data-c42-dropdown-trigger
        className={"pbx-color-picker__swatch" + (swatchClassName ? ` ${swatchClassName}` : "")}
        style={{ background: safeValue }}
        aria-label={label}
        title={label}
      />
      <div data-c42-dropdown-menu className="pbx-color-picker__popover">
        <HexColorPicker color={draft} onChange={handleChange} onMouseUp={commit} onTouchEnd={commit} />
        <div className="pbx-color-picker__hex-row">
          <span className="pbx-color-picker__hex-prefix" aria-hidden="true">
            #
          </span>
          <HexColorInput
            className="pbx-color-picker__hex-input"
            color={draft}
            onChange={(hex) => {
              setDraft(hex);
              onChange(hex);
              onChangeEnd?.(hex);
            }}
            prefixed={false}
            aria-label={t("colorPicker.hexInput")}
          />
        </div>
        {swatchEntries.length > 0 ? (
          <div className="pbx-color-picker__theme-swatches">
            <span className="pbx-color-picker__theme-label">{t("colorPicker.themeSwatches")}</span>
            <div className="pbx-color-picker__theme-grid">
              {swatchEntries.map(([path, hex]) => (
                <button
                  key={path}
                  type="button"
                  className="pbx-color-picker__theme-pill"
                  style={{ background: HEX6.test(hex) ? hex : "transparent" }}
                  title={`${path} (${hex})`}
                  aria-label={`${path} (${hex})`}
                  onClick={() => {
                    setDraft(hex);
                    onChange(hex);
                    onChangeEnd?.(hex);
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Dropdown>
  );
}
