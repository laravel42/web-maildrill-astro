/**
 * StyleField — control de estilo editable con **token picker** rediseñado
 * (Fase 11.b). Docs: docs/01 §4, docs/03 §3-4, docs/08 §5.
 *
 * UX mejorada:
 *  - Si el campo tiene un token vinculado: muestra un **pill** compacto con
 *    un swatch de color inline (cuando aplica) + ruta del token + botón ×
 *    para desvincular. El usuario sabe de un vistazo qué token está usando.
 *  - Si el campo no tiene token: botón de cadena (🔗) junto al label para
 *    vincular. Abre un select de tokens. Más semántico que el '#' anterior.
 *  - Layout **row** para campos cortos (select + color): label izquierda,
 *    control derecha en la misma línea. Layout **stacked** para texto libre.
 *  - Badge de override/heredado integrado como dot inline en el label,
 *    no como texto que ocupa espacio.
 *
 * Regla de oro (docs/01 §4): muestra el valor EFECTIVO (resuelto) pero ESCRIBE
 * en la capa del breakpoint activo. Un campo sin valor en la capa activa muestra
 * el valor heredado de base con un indicador visual sutil.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import type {
  BuilderNode,
  Breakpoint,
  DesignTokens,
  StyleValue,
} from "@/builder/model/types";
import { flattenTokens, isTokenRef, resolveToken } from "@/builder/model/tokens";
import { tokenGroupForField, type StyleFieldDef } from "../styleFields";
import { CommittableInput } from "./CommittableInput";
import { NumericUnitInput } from "./NumericUnitInput";
import { CompatWarning } from "./CompatWarning";
import { IconButton, LinkIcon, CloseIcon, ResetIcon, WarnIcon, ColorPicker } from "@/components";

const HEX6 = /^#[0-9a-f]{6}$/i;

function declaredInActiveLayer(
  node: BuilderNode,
  bp: Breakpoint,
  group: string,
  key: string,
): boolean {
  const layer =
    bp === "base"
      ? (node.style.base as Record<string, Record<string, unknown>>)
      : ((node.style.overrides?.[bp] ?? {}) as Record<string, Record<string, unknown>>);
  return layer[group]?.[key] !== undefined;
}

/** Dot de estado: override (acento) o heredado (tenue) */
function StatusDot({ kind }: { kind: "override" | "inherited" | "none" }) {
  if (kind === "none") return null;
  return (
    <span
      className={`pbx-field-dot pbx-field-dot--${kind}`}
      aria-hidden="true"
    />
  );
}

export function StyleField({
  node,
  breakpoint,
  field,
  raw,
  tokens,
}: {
  node: BuilderNode;
  breakpoint: Breakpoint;
  field: StyleFieldDef;
  raw: StyleValue | undefined;
  tokens: DesignTokens | undefined;
}) {
  const { t } = useTranslation("inspector");
  const setStyleProp = useDocumentStore((s) => s.setStyleProp);
  const resetStyleProp = useDocumentStore((s) => s.resetStyleProp);
  const breakpointConfig = useDocumentStore((s) => s.site.meta.breakpoints);
  const [picking, setPicking] = useState(false);

  const path: [typeof field.group, string] = [field.group, field.key];
  const declared = declaredInActiveLayer(node, breakpoint, field.group, field.key);

  const tokenPrefix = tokenGroupForField(field);
  const tokenPaths = tokenPrefix
    ? Object.keys(flattenTokens(tokens ?? {})).filter((p) =>
        p.startsWith(`${tokenPrefix}.`),
      )
    : [];
  const canTokenize = tokenPaths.length > 0;

  const isToken = raw !== undefined && isTokenRef(raw);
  const tokenPath = isToken ? raw.token : "";
  const resolvedToken = isToken ? resolveToken(tokens, tokenPath, breakpoint, breakpointConfig) : undefined;
  const broken = isToken && resolvedToken === undefined;
  const freeValue = typeof raw === "string" ? raw : "";

  // Estado: override / heredado / nada
  const statusDot: "override" | "inherited" | "none" = declared
    ? "override"
    : freeValue !== "" || isToken
      ? "inherited"
      : "none";

  const commit = (v: string) => {
    if (v === "") resetStyleProp(node.id, breakpoint, path);
    else setStyleProp(node.id, breakpoint, path, v);
  };
  const reset = () => resetStyleProp(node.id, breakpoint, path);

  // Desvincula el token actual a un valor libre editable. Si el token está
  // ROTO (`resolvedToken === undefined`, ej. apunta a un token que ya no
  // existe en el sitio), NO puede caer a `commit("")`: eso dispara
  // `resetStyleProp`, que borra la declaración de la capa activa en vez de
  // dejar un valor libre. Si el campo nunca estuvo `declared` (el token roto
  // viene heredado del `defaultStyle` del componente, no de un override del
  // nodo), el reset no tiene nada que borrar y `resolveStyle` sigue leyendo el
  // mismo token roto del default — el pill queda en rojo sin salida posible
  // para el usuario (bug real, feedback de usuario). En ese caso se declara
  // explícitamente un string vacío en la capa activa vía `setStyleProp`, para
  // que el usuario tenga un input libre editable de inmediato.
  const unlinkToken = () => {
    if (resolvedToken !== undefined) commit(resolvedToken);
    else setStyleProp(node.id, breakpoint, path, "");
  };

  const chooseToken = (v: string) => {
    if (v === "") {
      setPicking(false);
      unlinkToken();
    } else {
      setStyleProp(node.id, breakpoint, path, { token: v });
      setPicking(false);
    }
  };

  // Determinar si el layout es "fila" (label + control en una línea)
  // o "stacked" (label arriba, control abajo en todo el ancho)
  const isRowLayout = field.control === "select" || field.control === "color" || field.control === "numeric";

  // ---- Renderizado del control (input de valor) ----
  const controlEl = picking ? (
    // Token picker abierto: select inline con opción de "valor libre"
    <div className="pbx-control__token-picker">
      {field.control === "color" && (
        <span
          className="pbx-token-swatch"
          style={{ background: resolvedToken ?? "transparent" }}
          aria-hidden="true"
        />
      )}
      <select
        className="pbx-control__input pbx-control__input--token-pick"
        value={isToken ? tokenPath : ""}
        onChange={(e) => chooseToken(e.target.value)}
        autoFocus
        aria-label={`${field.label}: token`}
      >
        <option value="">— {t("styleField.freeValue")} —</option>
        {tokenPaths.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <IconButton
        icon={CloseIcon}
        label={t("styleField.freeValue")}
        intent="ghost"
        onClick={() => setPicking(false)}
      />
    </div>
  ) : isToken ? (
    // Token vinculado: pill compacto con preview de color
    <div className={`pbx-token-pill${broken ? " pbx-token-pill--broken" : ""}`}>
      {field.control === "color" && !broken && (
        <span
          className="pbx-token-pill__swatch"
          style={{ background: resolvedToken }}
          aria-hidden="true"
        />
      )}
      {broken && <span className="pbx-token-pill__broken-icon" aria-hidden="true"><WarnIcon size={12} /></span>}
      <span className="pbx-token-pill__path" title={tokenPath}>{tokenPath}</span>
      <button
        type="button"
        className="pbx-token-pill__unlink"
        title={t("styleField.unlinkToken")}
        onClick={() => {
          unlinkToken();
          setPicking(false);
        }}
        aria-label={t("styleField.unlinkToken")}
      >
        <CloseIcon size={12} aria-hidden="true" />
      </button>
    </div>
  ) : field.control === "select" ? (
    <select
      className="pbx-control__input"
      value={freeValue}
      onChange={(e) => commit(e.target.value)}
    >
      <option value="">{t("styleField.inherit")}</option>
      {field.options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ) : field.control === "color" ? (
    <div className="pbx-control__color-row">
      <ColorPicker
        value={HEX6.test(freeValue) ? freeValue : "#000000"}
        onChange={() => {}}
        onChangeEnd={commit}
        label={t("styleField.pickColor")}
      />
      <CommittableInput value={freeValue} placeholder="#2563eb" onCommit={commit} />
    </div>
  ) : field.control === "numeric" ? (
    <NumericUnitInput
      value={freeValue}
      units={field.units ?? ["px"]}
      defaultUnit={field.defaultUnit}
      onCommit={commit}
      placeholder={field.placeholder}
    />
  ) : (
    <CommittableInput value={freeValue} placeholder={field.placeholder} onCommit={commit} />
  );

  return (
    <div className={`pbx-control${isRowLayout && !picking && !isToken ? " pbx-control--row" : " pbx-control--stacked"}`}>
      {/* Label con dot de estado + botón vincular + reset */}
      <div className="pbx-control__header">
        <StatusDot kind={statusDot} />
        <span className="pbx-control__label">{field.label}</span>
        {/* Alerta de compatibilidad entre navegadores (T6) — icono + tooltip. */}
        {field.compat ? <CompatWarning message={t(field.compat)} /> : null}
        {/* Botón de vincular a token (cadena) — solo cuando no hay token activo */}
        {canTokenize && !isToken && !picking && (
          <IconButton
            icon={LinkIcon}
            label={t("styleField.useToken")}
            intent="accent"
            onClick={() => setPicking(true)}
          />
        )}
        {/* Reset — solo cuando hay valor declarado en la capa activa */}
        {declared && !picking && (
          <IconButton
            icon={ResetIcon}
            label={t("styleField.resetToInherited")}
            intent="danger"
            onClick={reset}
          />
        )}
      </div>

      {/* Control de valor */}
      <div className="pbx-control__body">
        {controlEl}
      </div>
    </div>
  );
}
