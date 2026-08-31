/**
 * PairGrid — dos controles en rejilla de 2 columnas bajo UNA sola etiqueta
 * de fila (docs/41 §4.4 `pair`, §6: `Overflow` X+Y, `Celda`
 * columna+fila). Se usa DENTRO de un `PropertyRow` con `columns={2}` — este
 * componente es solo el contenedor de los 2 sub-campos, no sabe nada de
 * `PropertyRow` ni del layout de la fila (eso ya lo resuelve
 * `.pbx-row__control--pair` en CSS, Paso 2).
 *
 * Primitiva de PRESENTACIÓN pura: cada sub-campo es un elemento children
 * arbitrario (normalmente un `NumericField` o un `<select>` nativo) que el
 * llamador ya conecta a su propio `onCommit` — `PairGrid` solo garantiza
 * que cada uno recibe su propio `aria-label` traducido, envolviéndolo en un
 * contenedor rotulado accesiblemente sin depender de que el control interno
 * soporte `aria-label` por sí mismo (algunos, como un `<select>` nativo, sí;
 * otros no).
 */

import type { ReactNode } from "react";

export interface PairGridField {
  /** `aria-label` traducido de este sub-campo (p. ej. "Overflow horizontal"). */
  ariaLabel: string;
  control: ReactNode;
}

export interface PairGridProps {
  /** Exactamente 2 sub-campos (docs/41 §4.4: Overflow X+Y, Celda columna+fila). */
  fields: [PairGridField, PairGridField];
}

export function PairGrid({ fields }: PairGridProps) {
  return (
    <>
      {fields.map((field, i) => (
        // eslint-disable-next-line react/no-array-index-key -- posición fija (0=X/columna, 1=Y/fila), no hay id propio.
        <div key={i} className="pbx-pair-grid__cell" role="group" aria-label={field.ariaLabel}>
          {field.control}
        </div>
      ))}
    </>
  );
}
