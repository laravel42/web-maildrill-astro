/**
 * PropertyRow — gramática de fila única del panel de propiedades unificado
 * (docs/41 §4.3, §5, Paso 2 de la tabla §7). Es una primitiva de PRESENTACIÓN:
 * no sabe nada de `StylePath`, `resolveValueOrigin` ni el store — solo pinta
 * `[ etiqueta 70px ][ acciones ][ gap 12px ][ área de control ]` a 32px de
 * alto (excepto la excepción `tall`). El cableado con el descriptor
 * (`panel/sections.ts`) y el tri-estado (`panel/origin.ts`) llega en los
 * Pasos 3-5.
 *
 * Regla crítica (docs/41 §4.3, §10.10): los slots de acción (token 🔗 /
 * reset) están SIEMPRE presentes en el DOM, nunca se montan/desmontan al
 * hover — solo cambian de opacidad vía CSS (`.pbx-row__actions`). Así el
 * hover nunca desplaza contenido.
 *
 * Posición FLOTANTE, anclada al FINAL de la columna del label (fix 4, este
 * commit — versión definitiva 2, fix real): los 4 intentos anteriores
 * probaron (a) en flujo con ancho mínimo fijo — robaba ancho al control;
 * (b) flotante cubriendo TODO el label desde la izquierda — tapaba el
 * texto; (c) en flujo sin ancho mínimo + `justify-content:flex-end` —
 * seguía angostando columnas ajustadas; (d) flotante anclado al borde
 * DERECHO de la columna del label — **seguía fallando** con labels que no
 * son cortos o con controles compuestos (`lineHeight`, `textDecoration`,
 * `background`, `borderRadius`…, reportado real): el punto azul de
 * "modificado" (`::after`, `right:-6px` relativo al label) y el propio
 * texto del label competían por el MISMO territorio de 70px que el ícono
 * flotante, solapándose entre sí en vez de con el control.
 *
 * Ahora `.pbx-row__actions` flota sobre el borde IZQUIERDO del CONTROL
 * (`.pbx-row__control` es su ancla `relative`), no sobre la columna del
 * label — territorio completamente distinto al texto/punto azul del label,
 * que vive en su propia columna sin compartir espacio con nada más. Sigue
 * fuera del flujo flex (`position:absolute`): el control conserva su ancho
 * exacto con o sin el reset visible. Mismo criterio que ya usaba el modo
 * `bare` (`pair`/`sides`) desde el intento (d) — se unifica: ahora AMBOS
 * casos anclan sobre el control, nunca sobre el label.
 */

import type { ReactNode } from "react";
import { useId } from "react";

/** Cuántas columnas ocupa el área de control (docs/41 §4.3: "hasta 2 columnas"). */
export type PropertyRowColumns = 1 | 2;

export interface PropertyRowProps {
  /** Etiqueta ya traducida (el llamador resuelve la clave i18n, AGENTS §5.1). */
  label: string;
  /** El control de la fila (numeric input, select, segmented…, llega en el Paso 3). */
  children: ReactNode;
  /**
   * Excepción de altura (docs/41 §4.3): solo 3 casos cerrados — `SidesGrid`
   * (padding/margin), fila con slider + valor, picker de color expandido.
   * Aplica la clase `pbx-row--tall`; la altura de 32px normal vive en UNA
   * sola regla CSS (`.pbx-row`), nunca se repite acá.
   */
  tall?: boolean;
  /**
   * Slot de acción reservado (chip de token 🔗 / botón de reset). Se
   * renderiza SIEMPRE, incluso si no se pasa nada — el contenedor
   * `.pbx-row__actions` ocupa su espacio en reposo con `opacity:0`
   * (docs/41 §10.10). Pasar `undefined` es válido y esperado en este paso
   * (el tri-estado real llega en el Paso 4).
   */
  actions?: ReactNode;
  /** Cuántas columnas tiene el área de control (docs/41 §4.4: `pair`/`sides` = 2). */
  columns?: PropertyRowColumns;
  /**
   * Clase extra opcional para `.pbx-row__control` (caso puntual: `layout.overflow`
   * en modo `pair` necesita apilar label+control en bloque en vez de la rejilla
   * de 2 columnas por defecto — ver `.pbx-row__control--overflow-stack` en
   * `inspector-panel.css`). No afecta ningún otro `pair`/`sides` existente.
   */
  controlClassName?: string;
  /**
   * `id` del control, para asociar `<label htmlFor>` cuando el control es un
   * elemento nativo con un solo `id` (input/select). Ver nota de
   * accesibilidad abajo — si no se pasa, se usa el patrón `role="group"` +
   * `aria-labelledby`.
   */
  controlId?: string;
  /** `id` opcional para la fila completa (útil en tests o anclas de scroll). */
  id?: string;
  /**
   * Origen del valor mostrado (docs/41 §4.5, Paso 4): `"active"` cuando el
   * campo está declarado en la capa activa del nodo (modificado — pinta
   * azul, es el target de reset), `"inherited"` cuando el valor viene de una
   * capa inferior o del `defaultStyle` del componente, `"none"` si no hay
   * valor en ningún lado. Expuesto como `data-origin` para que el CSS pinte
   * el estado sin que `PropertyRow` conozca `ValueOrigin` (sigue siendo una
   * primitiva de presentación pura — solo consume un string ya decidido por
   * quien la usa, p. ej. `PropertyField`).
   */
  dataOrigin?: "active" | "inherited" | "none";
  /** Tooltip de la fila completa (p. ej. "Heredado de base"). */
  title?: string;
}

/**
 * NOTA DE ACCESIBILIDAD (docs/41 §4.3, criterio §10.4 "la etiqueta nunca va
 * encima del control"): el `children` de esta fila es un control ARBITRARIO
 * (puede ser un `<input>` simple, o un grupo de 2 campos en modo `pair`/
 * `sides` sin un único elemento focalizable). El repo no tiene un patrón
 * previo para esto (`StyleField.tsx` usaba un `<label>` envolvente con el
 * dot+texto+acciones dentro, acoplado 1:1 a un solo control — lo que este
 * paso reemplaza). Se resuelve así:
 *
 * - Si el llamador pasa `controlId` (el control es un elemento nativo con
 *   `id` propio, p. ej. un `<select id="...">`), la etiqueta se renderiza
 *   como `<label htmlFor={controlId}>` — asociación nativa, la más robusta.
 * - Si NO se pasa `controlId` (el control es compuesto: `pair`, `sides`, o
 *   cualquier widget sin un único id), la etiqueta se renderiza como
 *   `<span id={labelId}>` y el contenedor de la fila lleva
 *   `role="group" aria-labelledby={labelId}` — el patrón estándar de WAI-ARIA
 *   para agrupar un control complejo bajo una etiqueta visible sin forzar un
 *   `for` que no tendría un target único.
 */
export function PropertyRow({
  label,
  children,
  tall = false,
  actions,
  columns = 1,
  controlId,
  controlClassName,
  id,
  dataOrigin,
  title: rowTitle,
}: PropertyRowProps) {
  const labelId = useId();
  const rowClassName = ["pbx-row", tall ? "pbx-row--tall" : ""].filter(Boolean).join(" ");
  const controlClassNameFull = [
    "pbx-row__control",
    columns === 2 ? "pbx-row__control--pair" : "",
    controlClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const labelNode = controlId ? (
    <label className="pbx-row__label" htmlFor={controlId} title={label}>
      {label}
    </label>
  ) : (
    <span className="pbx-row__label" id={labelId} title={label}>
      {label}
    </span>
  );

  return (
    <div
      id={id}
      className={rowClassName}
      data-origin={dataOrigin}
      title={rowTitle}
      {...(controlId ? {} : { role: "group", "aria-labelledby": labelId })}
    >
      {/* Columna del label: SOLO el texto, sin compartir territorio con el
          slot de acciones (ver nota de cabecera "versión definitiva 2") —
          el punto azul de "modificado" (`::after`) y el texto largo de
          algunos labels ("Interlineado", "Decoración"...) viven aquí sin
          competir por espacio con ningún ícono. */}
      <div className="pbx-row__label-col">{labelNode}</div>
      {/* El control es la ancla `position: relative` del slot flotante
          (más abajo, `.pbx-row__actions` sobre su borde izquierdo) — mismo
          criterio que el modo `bare`, unificado en este commit. */}
      <div className={controlClassNameFull}>
        <div className="pbx-row__actions">{actions}</div>
        {children}
      </div>
    </div>
  );
}
