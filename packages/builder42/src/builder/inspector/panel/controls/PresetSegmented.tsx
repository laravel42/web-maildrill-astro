/**
 * PresetSegmented — segmentado de TEXTO (sin icono) para presets CSS de un
 * campo que no tiene una representación visual clara opción-por-opción (a
 * diferencia de `IconSegmented`, pensado para enums con icono Lucide por
 * valor — alineación, dirección…). Fase 5 de simplificación del panel:
 * `effects.boxShadow` en modo simple (docs/41, ver `sections.ts` D9).
 *
 * Por qué NO se reutiliza `IconSegmented`: exige un icono Lucide por opción
 * y no hay un glifo inequívoco para "sombra sutil" vs "sombra media" — el
 * catálogo ya usa iconos solo donde el enum tiene una representación visual
 * directa (alineación, flex-direction). Por qué NO se reutiliza
 * `PresetNumeric`: ese control alterna entre el segmented de presets y un
 * `NumericField` en modo "Custom" cuando el valor no matchea ningún preset —
 * pensado para valores NUMÉRICOS con una unidad. `box-shadow` es una lista de
 * capas CSS (no una medida), y el "modo avanzado" para valores no-preset ya
 * existe como el `CommittableInput` de texto libre SIEMPRE visible en modo
 * avanzado (fuera de este control) — no hace falta una alternancia interna.
 *
 * Semántica de valor no-preset (docs/41, mismo criterio que `IconSegmented`
 * para "heredado"): si `value` no coincide con ningún `option.value`, NINGÚN
 * botón se marca activo. No se agrega una opción "Personalizado" seleccionable
 * — el usuario cambia ese valor desde el modo avanzado, este control solo
 * ofrece los presets curados.
 *
 * Deselección: clic en la opción YA activa hace `onCommit("")` (mismo patrón
 * que `IconSegmented`) — vuelve a "heredado/sin override", coherente con que
 * el primer preset ("Ninguna") también sea `""`/`"none"` semánticamente pero
 * ELEGIBLE como botón propio (a diferencia de un `commit("")` implícito): así
 * "Ninguna" queda resaltado como activo cuando el valor es exactamente su
 * `value`, en vez de comportarse como "sin selección" indistinguible del
 * estado heredado.
 */

export interface PresetSegmentedOption {
  /** Valor CSS que escribe esta opción (p. ej. "", "0 1px 2px ..."). */
  value: string;
  /** Etiqueta ya traducida (p. ej. "Ninguna", "S", "M", "L"). */
  label: string;
}

export interface PresetSegmentedProps {
  options: PresetSegmentedOption[];
  /** Valor CSS actual. Ninguna opción se marca activa si no coincide con ninguna. */
  value: string;
  onCommit: (value: string) => void;
  /** Etiqueta accesible del grupo completo. */
  ariaLabel: string;
}

export function PresetSegmented({ options, value, onCommit, ariaLabel }: PresetSegmentedProps) {
  return (
    <div className="pbx-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={"pbx-segmented__btn" + (isActive ? " pbx-segmented__btn--active" : "")}
            aria-pressed={isActive}
            onClick={() => onCommit(isActive ? "" : opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
