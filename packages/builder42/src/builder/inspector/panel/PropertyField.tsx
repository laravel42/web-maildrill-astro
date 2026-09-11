/**
 * PropertyField — tri-estado (heredado/modificado/token) + reset + chip de
 * token, todo en el mismo slot de `PropertyRow` (docs/41 §4.5, §6.1, §8.9,
 * Paso 4 de la tabla §7).
 *
 * `PropertyRow` es una primitiva de presentación pura; este componente la
 * CONECTA con el modelo: usa `resolveValueOrigin` (puro, sin React) para
 * decidir de dónde viene el valor de un campo y pinta en consecuencia:
 *
 * - `activeLayer` (declarado en la capa del breakpoint activo del nodo):
 *   fila "modificada" (`data-origin="active"`, azul vía CSS) con el botón de
 *   reset ACTIVO — el reset borra justo esa capa (`resetStyleProp`), es el
 *   target visual del punto azul (docs/41 §4.5).
 * - `inheritedLayer` / `componentDefault`: fila SIN modificar — se pinta el
 *   valor heredado REAL (nunca la cadena `(heredar)`, docs/41 §8.9), con un
 *   tooltip de origen (`panel.origin.inheritedFrom` / `.componentDefault`).
 * - Token vinculado (`isTokenRef`): un chip ocupa el MISMO slot de 32px que
 *   ocuparía el control, con su botón de desvincular.
 *
 * Sin cableado al panel real todavía (docs/41 §0.1): ni `InspectorForm.tsx`
 * ni `StyleSection.tsx` lo usan — el cableado llega en el Paso 5. Aditivo y
 * reversible, como los Pasos 1-3.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Breakpoint,
  BreakpointConfig,
  BuilderNode,
  DesignTokens,
  NodeStyle,
  StyleState,
} from "@/builder/model/types";
import { flattenTokens, resolveToken } from "@/builder/model/tokens";
import { effectiveThemeTokens, resolveTokenValue } from "@/builder/model/theme";
import { useDocumentStore } from "@/builder/store/documentStore";
import { IconButton, LinkIcon, CloseIcon, ResetIcon, WarnIcon, PbxSelect } from "@/components";
import { resolveValueOrigin } from "./origin";
import type { StylePath } from "./sections";
import { PropertyRow, type PropertyRowColumns } from "./PropertyRow";

export interface PropertyFieldRenderArgs {
  /** Valor libre actual del campo (string CSS), o `""` si no hay valor (origen `none`). */
  freeValue: string;
  /** Escribe en la capa activa del nodo; `commit("")` equivale a resetear. */
  commit: (v: string) => void;
  /**
   * Botón de "vincular a token" listo para montar, o `null` si no aplica
   * (sin prefijo tokenizable, ya vinculado, o en medio del picker). Solo se
   * entrega cuando el llamador pide `inlineTokenAction` (docs/41 §4.4 D8,
   * fix candado/token de `sides`): el control decide DÓNDE pintarlo en vez
   * de que `PropertyField` lo agregue a `.pbx-row__actions` (evita 2
   * botones de "cadena" visualmente idénticos con funciones distintas en la
   * misma fila — el candado de "vincular lados" de `SidesGrid` y el de
   * "vincular a token" quedan agrupados en el mismo slot central).
   */
  tokenAction: React.ReactNode | null;
}

export interface PropertyFieldProps {
  node: BuilderNode;
  breakpoint: Breakpoint;
  /** Config de breakpoints del SITIO (`site.meta.breakpoints`) — nunca hardcodeada (docs/41 §2.1.3). */
  breakpointConfig: BreakpointConfig;
  /** `defaultStyle` del componente (registry), para el caso `componentDefault`. */
  defaultStyle: NodeStyle | undefined;
  label: string;
  path: StylePath;
  /** Prefijo de ruta de token aplicable (`tokenGroupForField`), o `null` si el campo no se tokeniza. */
  tokenGroupPrefix: string | null;
  tokens: DesignTokens | undefined;
  columns?: PropertyRowColumns;
  tall?: boolean;
  controlId?: string;
  /**
   * `true` omite el `PropertyRow` envolvente (docs/41 Paso 5, punto 6 —
   * control `pair`): el llamador ya provee su propia fila (`PropertyRow`
   * con `columns={2}`) y monta 2 `PropertyField` independientes dentro de
   * un `PairGrid`, cada uno con SU PROPIO tri-estado/reset/token pero SIN
   * volver a envolver en otra fila de 32px (evita fila-dentro-de-fila). En
   * modo `bare` se renderiza únicamente el control (o el chip de token/
   * picker) + un slot de acciones inline con el mismo `data-origin` que
   * `PropertyRow` expondría, para que el CSS de tri-estado siga aplicando
   * sin depender de la primitiva de presentación completa.
   */
  bare?: boolean;
  /**
   * Estado de interacción activo (docs/41 §3 D7, Paso 5 punto 8). Cuando no
   * es `null`, el campo lee/escribe la capa `node.style.states[state]` en
   * vez de la capa de breakpoint (`setStateStyleProp`/`resetStateStyleProp`)
   * y el origen se calcula localmente (declarado en ese estado o no) en vez
   * de `resolveValueOrigin`, que es solo para el eje de breakpoint (docs/41
   * §2.1 punto 5: los estados son una capa ORTOGONAL, plana, sin cascada
   * propia que resolver). El tri-estado heredado/defaultStyle no aplica en
   * este eje: solo hay "declarado en el estado" (activo) o "no declarado"
   * (se muestra el valor de la capa normal resuelta, de solo lectura visual,
   * sin reset).
   */
  stateOverride?: StyleState | null;
  /**
   * `true` mueve el botón de "vincular a token" del slot `.pbx-row__actions`
   * (extremo derecho, solo hover) al render-prop `tokenAction` — el llamador
   * lo coloca donde quiera dentro del control (docs/41 §4.4 D8, Paso 2 fix:
   * usado por la fila `sides` para agruparlo con el candado de "vincular
   * lados" en el centro de la fila, en vez de 2 botones de cadena en
   * posiciones distintas de la misma fila).
   */
  inlineTokenAction?: boolean;
  /**
   * `true` muestra el VALOR RESUELTO del token en vez del chip con su
   * nombre, cuando el campo está vinculado a uno (petición del usuario,
   * este commit — modo simple del panel: la sección "Tokens" está oculta
   * ahí, así que un chip con un `path` como `spacing.sm` no tiene contexto
   * y confunde más de lo que ayuda; el usuario edita el VALOR sin necesitar
   * saber que hay un token detrás).
   *
   * El vínculo al token se conserva mientras el campo no se toca — sigue
   * siendo `{ token: "…" }` en el modelo, y el badge de "modificado"
   * (`data-origin="active"`) sigue aplicando igual. Solo al EDITAR el
   * campo se desvincula (mismo camino que el botón "×" de
   * `unlinkToken`/`chooseToken` ya usa): escribir un valor nuevo desde un
   * control que ni siquiera muestra que hay un token detrás no puede seguir
   * escribiendo AL TOKEN — eso cambiaría silenciosamente todos los demás
   * nodos que lo comparten. Editar aquí siempre pasa a valor libre en ESTE
   * nodo, igual que cualquier otro campo sin token.
   */
  showTokenAsValue?: boolean;
  children: (args: PropertyFieldRenderArgs) => React.ReactNode;
}

export function PropertyField({
  node,
  breakpoint,
  breakpointConfig,
  defaultStyle,
  label,
  path,
  tokenGroupPrefix,
  tokens,
  columns = 1,
  tall = false,
  controlId,
  bare = false,
  stateOverride = null,
  inlineTokenAction = false,
  showTokenAsValue = false,
  children,
}: PropertyFieldProps) {
  const { t } = useTranslation("inspector");
  const setStyleProp = useDocumentStore((s) => s.setStyleProp);
  const resetStyleProp = useDocumentStore((s) => s.resetStyleProp);
  const setStateStyleProp = useDocumentStore((s) => s.setStateStyleProp);
  const resetStateStyleProp = useDocumentStore((s) => s.resetStateStyleProp);
  const [picking, setPicking] = useState(false);

  // Eje de ESTADO (docs/41 §3 D7): plano, sin cascada — "declarado en
  // node.style.states[state]" o no. Se calcula un `ValueOrigin` equivalente
  // a mano (sin `resolveValueOrigin`, que es solo para breakpoints) para
  // reutilizar exactamente el mismo render de abajo.
  function readStateField(): unknown {
    if (!stateOverride) return undefined;
    const layer = node.style.states?.[stateOverride] as
      | Record<string, Record<string, unknown>>
      | undefined;
    return layer?.[path[0]]?.[path[1]];
  }

  const origin = stateOverride
    ? (() => {
        const v = readStateField();
        return v !== undefined ? { kind: "activeLayer" as const, value: v } : { kind: "none" as const };
      })()
    : resolveValueOrigin(node.style, defaultStyle, breakpoint, breakpointConfig, path);
  const isModified = origin.kind === "activeLayer";
  const rawValue = origin.kind === "none" ? undefined : origin.value;
  const isToken =
    rawValue !== undefined &&
    typeof rawValue === "object" &&
    rawValue !== null &&
    "token" in rawValue;
  const tokenPath = isToken ? (rawValue as { token: string }).token : "";
  // Theme-aware (bug real reportado por el usuario): antes se usaba
  // `resolveToken(tokens, …)` a secas, que solo lee el valor BASE del sitio
  // — si el nodo vive bajo un tema que remapea ese token (p. ej. un botón
  // verde por tema pero cuyo token base es azul), el Inspector mostraba el
  // azul base mientras el canvas pintaba el verde del tema, inconsistencia
  // visible en color/swatch. `activeThemeId` es la MISMA fuente de verdad
  // que usa el canvas en vivo (`Canvas.tsx`, `data-theme={activeThemeId}`).
  // Los tokens responsive de tipografía (`sizes`/`lineHeights`) no tienen
  // remapeo de tema — se resuelven igual que antes con `resolveToken`; el
  // resto sigue la cadena de referencias YA aplicando el tema activo
  // (`effectiveThemeTokens` + `resolveTokenValue`, misma fuente que
  // `themesToCss` usa para las custom properties reales del canvas).
  const activeThemeId = useDocumentStore((s) => s.activeThemeId);
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const isResponsiveTypography =
    tokenPath.startsWith("typography.sizes.") || tokenPath.startsWith("typography.lineHeights.");
  const resolvedToken = isToken
    ? isResponsiveTypography
      ? resolveToken(tokens, tokenPath, breakpoint, breakpointConfig)
      : resolveTokenValue(effectiveThemeTokens(tokens, themes, activeThemeId ?? undefined), tokenPath)
    : undefined;
  const broken = isToken && resolvedToken === undefined;
  const freeValue = typeof rawValue === "string" ? rawValue : "";

  const tokenPaths = tokenGroupPrefix
    ? Object.keys(flattenTokens(tokens ?? {})).filter((p) => p.startsWith(`${tokenGroupPrefix}.`))
    : [];
  const canTokenize = tokenPaths.length > 0;

  const commit = (v: string) => {
    if (stateOverride) {
      if (v === "") resetStateStyleProp(node.id, stateOverride, path);
      else setStateStyleProp(node.id, stateOverride, path, v);
      return;
    }
    if (v === "") resetStyleProp(node.id, breakpoint, path);
    else setStyleProp(node.id, breakpoint, path, v);
  };
  const reset = () => {
    if (stateOverride) resetStateStyleProp(node.id, stateOverride, path);
    else resetStyleProp(node.id, breakpoint, path);
  };

  // Mismo criterio que `StyleField.tsx` (comentario histórico, docs/01 §4):
  // desvincular un token ROTO no puede caer a `commit("")` (dispararía
  // `resetStyleProp`, que no borra nada si el token roto viene heredado del
  // `defaultStyle` — el usuario quedaría sin salida). Se declara "" explícito
  // en la capa activa para dejar el campo libre editable de inmediato.
  const unlinkToken = () => {
    if (resolvedToken !== undefined) commit(resolvedToken);
    else if (stateOverride) setStateStyleProp(node.id, stateOverride, path, "");
    else setStyleProp(node.id, breakpoint, path, "");
  };

  const chooseToken = (v: string) => {
    setPicking(false);
    if (v === "") unlinkToken();
    else if (stateOverride) setStateStyleProp(node.id, stateOverride, path, { token: v });
    else setStyleProp(node.id, breakpoint, path, { token: v });
  };

  const originTooltip =
    origin.kind === "inheritedLayer"
      ? t("panel.origin.inheritedFrom", { bp: origin.from })
      : origin.kind === "componentDefault"
        ? t("panel.origin.componentDefault")
        : undefined;

  const dataOrigin = isModified ? "active" : origin.kind === "none" ? "none" : "inherited";

  // El botón de "vincular a token" tampoco se muestra en modo simple
  // (`showTokenAsValue`): si el concepto de token está oculto (no hay
  // sección "Tokens" visible para dar contexto), ofrecer VINCULAR uno sería
  // tan confuso como mostrar el nombre de uno ya vinculado — mismo criterio
  // que el chip, arriba.
  const tokenButton =
    canTokenize && !isToken && !picking && !showTokenAsValue ? (
      <IconButton
        icon={LinkIcon}
        label={t("styleField.useToken")}
        intent="ghost"
        onClick={() => setPicking(true)}
      />
    ) : null;

  const actions = (
    <>
      {!inlineTokenAction && tokenButton}
      {isModified && !picking && (
        <IconButton icon={ResetIcon} label={t("panel.reset")} intent="ghost" onClick={reset} />
      )}
    </>
  );

  let control: React.ReactNode;
  if (picking) {
    control = (
      <div className="pbx-panel-token-picker">
        <PbxSelect
          className="pbx-panel-field"
          value={isToken ? tokenPath : ""}
          onChange={chooseToken}
          ariaLabel={`${label}: token`}
          options={[
            { value: "", label: `— ${t("styleField.freeValue")} —` },
            ...tokenPaths.map((p) => ({ value: p, label: p })),
          ]}
        />
        <IconButton
          icon={CloseIcon}
          label={t("styleField.freeValue")}
          intent="ghost"
          onClick={() => setPicking(false)}
        />
      </div>
    );
  } else if (isToken && showTokenAsValue) {
    // Modo simple (docs, ver comentario de `showTokenAsValue` arriba): el
    // control normal, con el VALOR RESUELTO del token como `freeValue` —
    // nunca `undefined` (un token roto cae a cadena vacía, igual que
    // cualquier otro campo sin valor). `commit` sigue siendo el `commit`
    // normal de la capa activa: escribir aquí SIEMPRE pasa a valor libre
    // (nunca vuelve a escribir `{ token }`), desvinculando implícitamente
    // sin que el usuario tenga que ver ni tocar un botón de "desvincular".
    control = children({
      freeValue: resolvedToken ?? "",
      commit,
      tokenAction: null,
    });
  } else if (isToken) {
    control = (
      <div className={`pbx-panel-token-chip${broken ? " pbx-panel-token-chip--broken" : ""}`}>
        {broken && (
          <span className="pbx-panel-token-chip__warn" aria-hidden="true">
            <WarnIcon size={12} />
          </span>
        )}
        <span className="pbx-panel-token-chip__path" title={tokenPath}>
          {tokenPath}
        </span>
        <button
          type="button"
          className="pbx-panel-token-chip__unlink"
          title={t("styleField.unlinkToken")}
          aria-label={t("styleField.unlinkToken")}
          onClick={unlinkToken}
        >
          <CloseIcon size={12} aria-hidden="true" />
        </button>
      </div>
    );
  } else {
    control = children({
      freeValue,
      commit,
      tokenAction: inlineTokenAction ? tokenButton : null,
    });
  }

  if (bare) {
    // Modo `bare` (docs/41 Paso 5, punto 6 — control `pair`): sin
    // `PropertyRow` envolvente. El llamador ya está dentro de su propia fila
    // (`PropertyRow columns={2}` + `PairGrid`); aquí solo se pinta el
    // control con el mismo `data-origin` + un slot de acciones, reutilizando
    // las clases de `.pbx-row__actions`/`data-origin` para que el CSS de
    // tri-estado (punto azul, D4) siga aplicando sin duplicar reglas nuevas.
    // El slot flota sobre el borde IZQUIERDO del propio control
    // (`.pbx-row__bare` es su ancla `position: relative`) — mismo criterio
    // ahora unificado con la fila completa (`PropertyRow.tsx`, ver su nota
    // de cabecera "versión definitiva 2"): el slot nunca comparte
    // territorio con texto de ningún label, solo con el control.
    return (
      <div className="pbx-row__bare" data-origin={dataOrigin} title={originTooltip}>
        <div className="pbx-row__actions">{actions}</div>
        <div className="pbx-row__control">{control}</div>
      </div>
    );
  }

  return (
    <PropertyRow
      label={label}
      columns={columns}
      tall={tall}
      controlId={picking || isToken ? undefined : controlId}
      actions={actions}
      dataOrigin={dataOrigin}
      title={originTooltip}
    >
      {control}
    </PropertyRow>
  );
}
