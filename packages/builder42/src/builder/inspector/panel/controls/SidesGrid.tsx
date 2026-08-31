/**
 * SidesGrid — reemplazo de la cruz de padding/margin (docs/41 §4.4 "elimina
 * la cruz", D8, Paso 3 de la tabla §7). Rejilla 2×2 de campos numéricos con
 * icono de lado dentro del campo (top/right/bottom/left) + unidad, con un
 * botón de candado/vínculo a la izquierda del bloque.
 *
 * CRÍTICO (docs/41 §2.1.2, D8): el modelo solo tiene el shorthand
 * `padding`/`margin` como `StyleValue` — no existe `paddingTop` etc. Este
 * control COMPONE el shorthand a partir de 4 lados independientes y lo
 * `onCommit`ea como UN string CSS. Toda la aritmética de parseo/serialización
 * vive en funciones PURAS exportadas (`parseSides`, `serializeSides`),
 * testeadas sin DOM (P7, AGENTS §5).
 *
 * BUG QUE CORRIGE (docs/41 §4.4): el control de cruz anterior (borrado en
 * el Paso 8, docs/41) usaba `parseNumeric` (`parseFloat` + `isNaN → 0`), que
 * DESCARTA la unidad de
 * cada lado — "1rem" se lee como el número `1` y se re-serializa siempre en
 * `px` ("1px"), y un valor no numérico (token ref, o `auto`) se pinta como
 * `0`. `SidesGrid` preserva la unidad de CADA lado por separado — cada
 * `SideValue` es `{ num, unit }` o el string especial `"auto"` (válido en
 * `margin`, no numérico — NUNCA se fuerza a 0).
 *
 * Candado (docs/41 §4.4): el estado de "lados vinculados" (activo = un
 * cambio en cualquier lado propaga a los 4; inactivo = cada lado
 * independiente) se recuerda POR NODO, pero el dueño de ese estado es el
 * Paso 5 (quien cablea el panel real) — aquí solo se expone `locked` +
 * `onToggleLock` por props. Este componente NO usa `localStorage` ni ningún
 * almacenamiento propio. Usa `Lock`/`LockOpen` (nunca `LinkIcon`, fix
 * candado/token D8): antes ambos botones de esta fila eran el mismo glifo
 * de cadena (uno para "vincular lados", otro para "vincular a token" en
 * `.pbx-row__actions`) — visualmente indistinguibles pese a hacer cosas
 * distintas. Ahora ambos viven apilados en el mismo slot central
 * (`tokenAction` arriba, candado abajo) con iconos propios.
 */

import { useTranslation } from "react-i18next";
import { Lock, LockOpen } from "@/components";
import { NumericField } from "./NumericField";

// ---------------------------------------------------------------------------
// Funciones puras (docs/41 §4.4, §11.3) — sin React, sin DOM
// ---------------------------------------------------------------------------

/** Un lado puede ser una medida numérica con unidad, o el literal `"auto"` (margin). */
export type SideValue = { num: number; unit: string } | "auto";

export interface FourSides {
  top: SideValue;
  right: SideValue;
  bottom: SideValue;
  left: SideValue;
}

const ZERO: SideValue = { num: 0, unit: "" };

/** Serializa un `SideValue` individual a su representación CSS. */
function sideToCss(side: SideValue): string {
  if (side === "auto") return "auto";
  return `${side.num}${side.unit}`;
}

/** Parsea un único token del shorthand ("16px", "auto", "1rem", "2%") a `SideValue`. */
function parseSideToken(token: string): SideValue {
  if (token === "auto") return "auto";
  const m = token.match(/^(-?[\d.]+)([a-z%]*)$/i);
  if (!m) return ZERO; // token no reconocible (p. ej. una var CSS suelta) → 0 explícito, nunca crashea
  const numStr = m[1];
  if (!numStr) return ZERO;
  return { num: parseFloat(numStr), unit: m[2] ?? "" };
}

/**
 * Parsea un shorthand CSS de 1 a 4 valores ("16px", "8px 16px",
 * "8px 16px 24px", "1rem 2% 3px 4em", "0 auto") a los 4 lados, PRESERVANDO
 * la unidad de cada uno (a diferencia del control de cruz anterior, ya
 * borrado — docs/41 Paso 8).
 *
 * `undefined`/vacío/no parseable → los 4 lados en `0` (unitless), igual que
 * el comportamiento previo del control de cruz para el caso "sin valor".
 */
export function parseSides(raw: string | undefined): FourSides {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return { top: ZERO, right: ZERO, bottom: ZERO, left: ZERO };
  }
  const parts = raw.trim().split(/\s+/).map(parseSideToken);
  const [a, b, c, d] = parts;
  if (parts.length === 1) return { top: a!, right: a!, bottom: a!, left: a! };
  if (parts.length === 2) return { top: a!, right: b!, bottom: a!, left: b! };
  if (parts.length === 3) return { top: a!, right: b!, bottom: c!, left: b! };
  if (parts.length >= 4) return { top: a!, right: b!, bottom: c!, left: d! };
  return { top: ZERO, right: ZERO, bottom: ZERO, left: ZERO };
}

function sidesEqual(a: SideValue, b: SideValue): boolean {
  if (a === "auto" || b === "auto") return a === b;
  return a.num === b.num && a.unit === b.unit;
}

/**
 * Serializa los 4 lados al shorthand CSS MÁS COMPACTO posible (docs/41
 * §4.4: "colapso al shorthand más compacto en la serialización") —
 * 1 valor si los 4 son iguales, 2 si top=bottom y right=left, etc. Nunca
 * fuerza una unidad común: si dos lados iguales en número pero con
 * unidades distintas ("16px" vs "16rem"), NO se colapsan — son valores CSS
 * distintos aunque el número coincida.
 */
export function serializeSides(sides: FourSides): string {
  const { top, right, bottom, left } = sides;
  if (sidesEqual(top, right) && sidesEqual(right, bottom) && sidesEqual(bottom, left)) {
    return sideToCss(top);
  }
  if (sidesEqual(top, bottom) && sidesEqual(right, left)) {
    return `${sideToCss(top)} ${sideToCss(right)}`;
  }
  if (sidesEqual(right, left)) {
    return `${sideToCss(top)} ${sideToCss(right)} ${sideToCss(bottom)}`;
  }
  return `${sideToCss(top)} ${sideToCss(right)} ${sideToCss(bottom)} ${sideToCss(left)}`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export type SideKey = "top" | "right" | "bottom" | "left";

export interface SidesGridProps {
  /** Shorthand CSS actual ("16px", "8px 16px 24px 32px", "0 auto", ""). */
  value: string;
  units: string[];
  defaultUnit?: string;
  /** Iconos por lado (docs/41 §4.4), ya resueltos por el llamador (`@/components`). */
  icons: Record<SideKey, React.ReactNode>;
  /** Estado del candado — vive fuera de este componente (Paso 5), por nodo. */
  locked: boolean;
  onToggleLock: () => void;
  onCommit: (value: string) => void;
  /**
   * Botón de "vincular a token" (docs/41 §4.4 D8, fix candado/token): se
   * apila ARRIBA del candado en el mismo slot central de la fila, en vez de
   * vivir en `.pbx-row__actions` (extremo derecho) — evita 2 botones de
   * cadena visualmente idénticos con funciones distintas en la misma fila.
   * `null`/`undefined` = no aplica (sin prefijo tokenizable, ya vinculado).
   */
  tokenAction?: React.ReactNode | null;
}

const SIDE_ORDER: SideKey[] = ["top", "right", "bottom", "left"];

export function SidesGrid({
  value,
  units,
  defaultUnit,
  icons,
  locked,
  onToggleLock,
  onCommit,
  tokenAction,
}: SidesGridProps) {
  const { t } = useTranslation("inspector");
  const sides = parseSides(value);

  const handleSideChange = (side: SideKey, raw: string) => {
    const parsed = raw === "auto" ? ("auto" as const) : parseSideToken(raw || "0");
    if (locked) {
      // Candado activo: el nuevo valor se propaga a los 4 lados.
      onCommit(serializeSides({ top: parsed, right: parsed, bottom: parsed, left: parsed }));
      return;
    }
    onCommit(serializeSides({ ...sides, [side]: parsed }));
  };

  return (
    <div className="pbx-sides-grid">
      <div className="pbx-sides-grid__actions">
        {tokenAction}
        <button
          type="button"
          className={
            "pbx-sides-grid__lock" + (locked ? " pbx-sides-grid__lock--active" : "")
          }
          aria-pressed={locked}
          aria-label={locked ? t("panel.unlockSides") : t("panel.lockSides")}
          title={locked ? t("panel.unlockSides") : t("panel.lockSides")}
          onClick={onToggleLock}
        >
          {locked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
        </button>
      </div>
      <div className="pbx-sides-grid__cells">
        {SIDE_ORDER.map((side) => (
          <NumericField
            key={side}
            value={sideToCss(sides[side])}
            units={units}
            defaultUnit={defaultUnit}
            icon={icons[side]}
            iconLabel={t(`panel.sides.${side}`)}
            onCommit={(raw) => handleSideChange(side, raw)}
          />
        ))}
      </div>
    </div>
  );
}
