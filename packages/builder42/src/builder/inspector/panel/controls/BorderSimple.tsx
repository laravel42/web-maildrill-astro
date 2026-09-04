/**
 * BorderSimple — 3 sub-controles combinados (grosor / color / tipo) para la
 * fila `appearance.border` en modo simple (Fase 6 de simplificación del
 * panel, docs/41). Sustituye al `CommittableInput` de texto libre donde el
 * usuario escribía el shorthand CSS completo a mano
 * (`"1px solid #cccccc"`) por controles discretos que arman y leen ESE MISMO
 * string shorthand — el modelo sigue siendo un solo campo
 * `appearance.border: string` (no se agregan 3 campos nuevos al esquema de
 * estilo), igual que `effects.boxShadow` (fase 5) sigue siendo un string
 * aunque en modo simple se edite con presets.
 *
 * **Layout elegido (documentado, pedido por la tarea):** los 3 sub-controles
 * viven en una sola fila de 3 columnas (`display:grid`,
 * `grid-template-columns: 1fr 1fr auto` — grosor y tipo se reparten el ancho
 * disponible en partes iguales, el color ocupa solo lo que su swatch+hex
 * necesitan al final), NO se apilan en 2 filas (`pair` + fila de color
 * aparte). Motivo: `PairGrid` + una fila separada de color habría partido un
 * concepto ATÓMICO (un solo valor de `appearance.border`) en 2 filas
 * distintas del panel — dos etiquetas, dos íconos de reset independientes,
 * dos posiciones para deshacer un mismo campo — cuando en realidad los 3
 * sub-controles comparten el MISMO origen/reset/token (un solo
 * `PropertyField` con un solo `commit`). Mantenerlos en una fila conserva la
 * semántica de "esto es UN campo" y es más simple de implementar: no hace
 * falta duplicar `PropertyField` (que si se usara 2 veces, cada mitad
 * pelearía por escribir el mismo shorthand con datos parciales del otro
 * sub-control). El propio componente es el único que sabe combinar los 3
 * valores en un string antes de llamar a `commit`.
 *
 * **Selects nativos** para grosor/tipo (mismo criterio que `renderRowControl`
 * ya usa para `control:"select"` en modo avanzado — no se introduce un
 * `IconSegmented`/`PresetSegmented` nuevo porque no hay glifo representativo
 * para "punteado" vs "discontinuo" que no sea ya el propio texto de la
 * opción, y un segmentado de texto de 3 opciones ocuparía más ancho que un
 * `<select>` en una fila ya compartida con 2 controles más).
 */

import { useTranslation } from "react-i18next";
import { PbxSelect } from "@/components";
import { ColorField } from "./ColorField";

// ---------------------------------------------------------------------------
// Parseo / serialización puros (sin React) — Paso 1 de la fase.
// ---------------------------------------------------------------------------

/** Grosores ofrecidos por el select simple (docs de la tarea: 0 para poder quitar el borde). */
export const BORDER_SIMPLE_WIDTHS = ["0px", "1px", "2px", "4px"] as const;
export type BorderSimpleWidth = (typeof BORDER_SIMPLE_WIDTHS)[number];

/** Tipos de trazo ofrecidos por el select simple. */
export const BORDER_SIMPLE_STYLES = ["solid", "dashed", "dotted"] as const;
export type BorderSimpleStyle = (typeof BORDER_SIMPLE_STYLES)[number];

/** Defaults cuando el valor actual está vacío o no es parseable (ver `parseBorderShorthand`). */
export const BORDER_SIMPLE_DEFAULT_WIDTH: BorderSimpleWidth = "1px";
export const BORDER_SIMPLE_DEFAULT_STYLE: BorderSimpleStyle = "solid";
/** Mismo gris que ya usaba el placeholder histórico del campo (`styleFields.ts`: `"1px solid #ccc"`), normalizado a hex de 6 dígitos. */
export const BORDER_SIMPLE_DEFAULT_COLOR = "#cccccc";

export interface BorderShorthand {
  width: string;
  style: string;
  color: string;
}

const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const WIDTH_RE = /^\d+(\.\d+)?(px|em|rem|%)$/i;

/** Normaliza `#abc` a `#aabbcc` — mismo formato de 6 dígitos que usa `ColorField`/`HEX6`. */
function normalizeHex(hex: string): string {
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const r = hex[1]!, g = hex[2]!, b = hex[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return hex.toLowerCase();
}

/**
 * Parsea un shorthand CSS de `border` (`"1px solid #cccccc"`) en sus 3
 * partes. Tolera cualquier ORDEN de los 3 tokens (el shorthand CSS real no
 * impone orden) y espacios extra. Si una parte no aparece o no es
 * reconocible, se rellena con el default razonable de esa parte (nunca se
 * deja `undefined` — este control siempre tiene los 3 sub-controles con un
 * valor mostrable). Un valor vacío/no parseable en su totalidad devuelve los
 * 3 defaults.
 */
export function parseBorderShorthand(value: string | undefined): BorderShorthand {
  const tokens = (value ?? "").trim().split(/\s+/).filter(Boolean);

  let width: string | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const tok of tokens) {
    if (width === undefined && WIDTH_RE.test(tok)) {
      width = tok.toLowerCase();
      continue;
    }
    if (style === undefined && (BORDER_SIMPLE_STYLES as readonly string[]).includes(tok.toLowerCase())) {
      style = tok.toLowerCase();
      continue;
    }
    if (color === undefined && HEX_RE.test(tok)) {
      color = normalizeHex(tok);
      continue;
    }
  }

  return {
    width: width ?? BORDER_SIMPLE_DEFAULT_WIDTH,
    style: style ?? BORDER_SIMPLE_DEFAULT_STYLE,
    color: color ?? BORDER_SIMPLE_DEFAULT_COLOR,
  };
}

/** Serializa las 3 partes de vuelta al shorthand `"<width> <style> <color>"`. */
export function serializeBorderShorthand(parts: BorderShorthand): string {
  return `${parts.width} ${parts.style} ${parts.color}`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export interface BorderSimpleProps {
  /** Valor CSS actual completo de `appearance.border` (shorthand, puede estar vacío). */
  value: string;
  onCommit: (value: string) => void;
}

export function BorderSimple({ value, onCommit }: BorderSimpleProps) {
  const { t } = useTranslation("inspector");
  const parsed = parseBorderShorthand(value);

  const commitPart = (next: Partial<BorderShorthand>) => {
    onCommit(serializeBorderShorthand({ ...parsed, ...next }));
  };

  return (
    <div className="pbx-border-simple">
      <PbxSelect
        className="pbx-border-simple__width"
        value={parsed.width}
        ariaLabel={t("panel.border.width")}
        onChange={(v) => commitPart({ width: v })}
        options={BORDER_SIMPLE_WIDTHS.map((w) => ({
          value: w,
          label: w === "0px" ? t("panel.border.widthNone") : w,
        }))}
      />
      <PbxSelect
        className="pbx-border-simple__style"
        value={parsed.style}
        ariaLabel={t("panel.border.style")}
        onChange={(v) => commitPart({ style: v })}
        options={BORDER_SIMPLE_STYLES.map((s) => ({
          value: s,
          label: t(`panel.border.styleOptions.${s}`),
        }))}
      />
      <div className="pbx-border-simple__color">
        <ColorField
          value={parsed.color}
          onCommit={(hex) => commitPart({ color: hex })}
          label={t("panel.border.color")}
        />
      </div>
    </div>
  );
}
