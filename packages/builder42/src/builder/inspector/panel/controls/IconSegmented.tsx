/**
 * IconSegmented — control segmentado de botones-icono para enumeraciones ≤5
 * (docs/41 §4.4 `segmented`, §6: flexDirection, justifyContent, alignItems,
 * textAlign, textDecoration, flexWrap).
 *
 * Clases PROPIAS del panel (`pbx-segmented*`, en `chrome/inspector-panel.css`),
 * NO las de `AlignmentButtons` (`pbx-alignment-buttons`, en
 * `chrome/inspector-simple.css`): ese módulo CSS se borra en el Paso 8 junto
 * con el modo simple, así que el panel unificado no puede depender de él. El
 * estado activo se pinta con el acento de marca de Maildrill
 * (`--pb-chrome-accent`, D4 revisado — petición explícita del usuario,
 * 2026-09-03): distinto del azul de "modificado" (`--pb-chrome-panel-modified`)
 * a propósito, para que el usuario distinga "esta opción está seleccionada"
 * de "este valor fue modificado" (ver nota de cabecera de
 * `chrome/inspector-panel.css`). Cada botón mide ≥24×24px (WCAG 2.5.8).
 *
 * Primitiva de PRESENTACIÓN + commit (Paso 3, docs/41 §7): recibe el valor
 * actual como string CSS y un callback `onCommit`. No lee el store, no
 * conoce breakpoints ni tokens — eso lo cablea el Paso 4/5.
 *
 * DECISIÓN DOCUMENTADA (deselección, pedida por la tarea): un clic en la
 * opción YA activa hace `onCommit("")` en vez de no hacer nada. Motivo: es
 * la única forma de volver a "heredado" desde un segmented sin pasar por el
 * botón de reset separado — el propio control es su propio "borrador". Un
 * segmented sin ninguna opción resaltada es una señal visual inequívoca de
 * "no hay override en esta capa", coherente con `resolveValueOrigin` (Paso 4)
 * pintando el campo como heredado cuando el valor está vacío.
 */

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export interface IconSegmentedOption {
  /** Valor CSS que representa esta opción (p. ej. "row", "center"). */
  value: string;
  icon: ComponentType<LucideProps>;
  /** Etiqueta ya traducida — usada como `aria-label`/tooltip del botón. */
  label: string;
}

export interface IconSegmentedProps {
  /** Máximo 5 opciones (docs/41 §4.4); no se valida en runtime, es una guía de uso. */
  options: IconSegmentedOption[];
  /** Valor CSS actual. Ninguna opción se marca activa si no coincide con ninguna. */
  value: string | undefined;
  /** Se llama con el valor de la opción elegida, o `""` si se deselecciona la activa. */
  onCommit: (value: string) => void;
  /** Etiqueta accesible del grupo completo (p. ej. "Dirección"). */
  ariaLabel: string;
}

export function IconSegmented({ options, value, onCommit, ariaLabel }: IconSegmentedProps) {
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
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onCommit(isActive ? "" : opt.value)}
          >
            <opt.icon size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
