/**
 * StateStyleField — control de estilo para un ESTADO de interacción (T9,
 * AGENTS.md), p. ej. el botón de `tab` seleccionado. Variante simplificada de
 * `StyleField`: mismo control por tipo (`select`/`color`/`numeric`/texto) y
 * mismo token picker, pero SIN el eje de breakpoint (`states` es plano) — lee/
 * escribe con `setStateStyleProp`/`resetStateStyleProp` en vez de
 * `setStyleProp`/`resetStyleProp`.
 *
 * "Declarado" aquí significa "tiene un valor en `states[state]`" (no hay capa
 * base/override que heredar dentro del propio estado — el fallback visual a
 * "heredado de la capa normal" ya lo resuelve `resolveStateStyle`, que se usa
 * solo para calcular el placeholder/valor mostrado cuando no hay override).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { BuilderNode, DesignTokens, StyleState, StyleValue } from "@/builder/model/types";
import { flattenTokens, isTokenRef, resolveToken } from "@/builder/model/tokens";
import { tokenGroupForField, type StyleFieldDef } from "../styleFields";
import { CommittableInput } from "./CommittableInput";
import { NumericUnitInput } from "./NumericUnitInput";
import { CompatWarning } from "./CompatWarning";
import { IconButton, LinkIcon, CloseIcon, ResetIcon, WarnIcon, ColorPicker, PbxSelect } from "@/components";

const HEX6 = /^#[0-9a-f]{6}$/i;

function declaredInState(node: BuilderNode, state: StyleState, group: string, key: string): boolean {
  const layer = node.style.states?.[state] as Record<string, Record<string, unknown>> | undefined;
  return layer?.[group]?.[key] !== undefined;
}

function StatusDot({ kind }: { kind: "override" | "inherited" | "none" }) {
  if (kind === "none") return null;
  return <span className={`pbx-field-dot pbx-field-dot--${kind}`} aria-hidden="true" />;
}

export function StateStyleField({
  node,
  state,
  field,
  raw,
  tokens,
}: {
  node: BuilderNode;
  state: StyleState;
  field: StyleFieldDef;
  raw: StyleValue | undefined;
  tokens: DesignTokens | undefined;
}) {
  const { t } = useTranslation("inspector");
  const { t: tc } = useTranslation("common");
  const label = tc(`styleLabels.${field.key}`, { defaultValue: field.label });
  const setStateStyleProp = useDocumentStore((s) => s.setStateStyleProp);
  const resetStateStyleProp = useDocumentStore((s) => s.resetStateStyleProp);
  const [picking, setPicking] = useState(false);

  const path: [typeof field.group, string] = [field.group, field.key];
  const declared = declaredInState(node, state, field.group, field.key);

  const tokenPrefix = tokenGroupForField(field);
  const tokenPaths = tokenPrefix
    ? Object.keys(flattenTokens(tokens ?? {})).filter((p) => p.startsWith(`${tokenPrefix}.`))
    : [];
  const canTokenize = tokenPaths.length > 0;

  const isToken = raw !== undefined && isTokenRef(raw);
  const tokenPath = isToken ? raw.token : "";
  const resolvedToken = isToken ? resolveToken(tokens, tokenPath) : undefined;
  const broken = isToken && resolvedToken === undefined;
  const freeValue = typeof raw === "string" ? raw : "";

  const statusDot: "override" | "inherited" | "none" = declared
    ? "override"
    : freeValue !== "" || isToken
      ? "inherited"
      : "none";

  const commit = (v: string) => {
    if (v === "") resetStateStyleProp(node.id, state, path);
    else setStateStyleProp(node.id, state, path, v);
  };
  const reset = () => resetStateStyleProp(node.id, state, path);

  const unlinkToken = () => {
    if (resolvedToken !== undefined) commit(resolvedToken);
    else setStateStyleProp(node.id, state, path, "");
  };

  const chooseToken = (v: string) => {
    if (v === "") {
      setPicking(false);
      unlinkToken();
    } else {
      setStateStyleProp(node.id, state, path, { token: v });
      setPicking(false);
    }
  };

  const isRowLayout = field.control === "select" || field.control === "color" || field.control === "numeric";

  const controlEl = picking ? (
    <div className="pbx-control__token-picker">
      {field.control === "color" && (
        <span className="pbx-token-swatch" style={{ background: resolvedToken ?? "transparent" }} aria-hidden="true" />
      )}
      <PbxSelect
        className="pbx-control__input--token-pick"
        value={isToken ? tokenPath : ""}
        onChange={chooseToken}
        ariaLabel={`${label}: token`}
        options={[
          { value: "", label: `— ${t("styleField.freeValue")} —` },
          ...tokenPaths.map((p) => ({ value: p, label: p })),
        ]}
      />
      <IconButton icon={CloseIcon} label={t("styleField.freeValue")} intent="ghost" onClick={() => setPicking(false)} />
    </div>
  ) : isToken ? (
    <div className={`pbx-token-pill${broken ? " pbx-token-pill--broken" : ""}`}>
      {field.control === "color" && !broken && (
        <span className="pbx-token-pill__swatch" style={{ background: resolvedToken }} aria-hidden="true" />
      )}
      {broken && (
        <span className="pbx-token-pill__broken-icon" aria-hidden="true">
          <WarnIcon size={12} />
        </span>
      )}
      <span className="pbx-token-pill__path" title={tokenPath}>
        {tokenPath}
      </span>
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
    <PbxSelect
      value={freeValue}
      onChange={commit}
      options={[
        { value: "", label: t("styleField.inherit") },
        ...(field.options ?? []),
      ]}
    />
  ) : field.control === "color" ? (
    <div className="pbx-control__color-row">
      <ColorPicker
        value={HEX6.test(freeValue) ? freeValue : "#000000"}
        onChange={commit}
        onChangeEnd={commit}
        label={t("styleField.pickColor")}
        swatchClassName="pbx-control__swatch"
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
      <div className="pbx-control__header">
        <StatusDot kind={statusDot} />
        <span className="pbx-control__label">{label}</span>
        {field.compat ? <CompatWarning message={t(field.compat)} /> : null}
        {canTokenize && !isToken && !picking && (
          <IconButton icon={LinkIcon} label={t("styleField.useToken")} intent="accent" onClick={() => setPicking(true)} />
        )}
        {declared && !picking && (
          <IconButton icon={ResetIcon} label={t("styleField.resetToInherited")} intent="danger" onClick={reset} />
        )}
      </div>
      <div className="pbx-control__body">{controlEl}</div>
    </div>
  );
}
