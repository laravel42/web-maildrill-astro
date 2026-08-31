/**
 * TokensEditor — editor CRUD de design tokens a nivel sitio (docs/08 §5-6).
 *
 * Chrome del editor (no toca el output, P8). Cubre TODOS los grupos de token:
 * los planos (colores, espaciado, radios, sombras) y la tipografía (familias con
 * `stack` + `webFont`, y los escalares tamaños/pesos/interlineados). Editar un
 * valor propaga al instante al canvas: la acción del store actualiza
 * `site.meta.tokens` y `TokensStyle` reinyecta el `:root` (P1).
 *
 * La clave se valida (docs/08 §7): solo `[a-z0-9]` por segmento y `.` como
 * separador; se normaliza la entrada y se rechaza si queda inválida o ya existe.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import {
  IconButton,
  Toggle,
  CloseIcon,
  ChevronDown,
  ChevronRight,
  ColorPicker,
  Search,
  Info,
  Tooltip,
  FontFamilyCombobox,
} from "@/components";
import { NumericUnitInput } from "@/builder/inspector/controls/NumericUnitInput";
import {
  TOKEN_GROUPS,
  TYPOGRAPHY_SCALAR_GROUPS,
  isValidTokenKey,
  normalizeTokenKey,
  isBaseToken,
  flattenTree,
  googleFontHref,
  baseValueOf,
  type TokenGroup,
  type TypographyScalarGroup,
} from "@/builder/model/tokens";
import type {
  TokenFontFamily,
  TokenGroupTree,
  ResponsiveTokenValue,
  OverrideBreakpoint,
  Breakpoint,
  BreakpointConfig,
} from "@/builder/model/types";
import { isResponsiveTokenValue } from "@/builder/model/types";

const HEX6 = /^#[0-9a-f]{6}$/i;

// ---------------------------------------------------------------------------
// Acordeón de grupo de tokens — mismo patrón visual que StyleGroupAccordion
// del Inspector (docs/40 §2, `pbx-style-group*` en inspector-controls.css):
// trigger con icono + título + count + chevron, body colapsable. Abierto por
// defecto si el grupo tiene tokens.
// ---------------------------------------------------------------------------

function TokenGroupAccordion({
  title,
  count,
  icon,
  children,
  groupId,
  defaultOpen,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
  groupId: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(() => defaultOpen ?? true);
  return (
    <div className={`pbx-style-group${open ? " pbx-style-group--open" : " pbx-style-group--collapsed"}`}>
      <button
        type="button"
        className="pbx-style-group__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`pbx-tokens-group-body-${groupId}`}
      >
        {icon ? <span className="pbx-style-group__icon">{icon}</span> : null}
        <span className="pbx-style-group__name">
          {title} ({count})
        </span>
        <span className="pbx-style-group__chevron" aria-hidden="true">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open ? (
        <div className="pbx-style-group__body" id={`pbx-tokens-group-body-${groupId}`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grupo escalar genérico (valor = string). Reutilizado por los grupos planos y
// por los escalares de tipografía; solo cambian el `groupId` y los callbacks.
//
// `visual` (docs/40 §2.3): representación visual del valor, además del input
// de texto. `"radius"`/`"shadow"` (paso 7) muestran un cuadradito con el
// `border-radius`/`box-shadow` aplicado directamente. `"bar"` (spacing/sizes)
// ya no dibuja una barra proporcional (removido en pulido visual) — el marcador
// se conserva para distinguir el grupo semánticamente si se necesita a futuro.
// ---------------------------------------------------------------------------

type ScalarVisual = "bar" | "radius" | "shadow";

/**
 * Separa las claves de un grupo en base (tema, protegidas) vs custom
 * (agregadas por el usuario) — docs/40 §2 "separación visual base vs custom".
 * Mantiene el orden original dentro de cada partición.
 */
function splitBaseCustom(groupId: string, keys: string[]): { base: string[]; custom: string[] } {
  const base: string[] = [];
  const custom: string[] = [];
  for (const k of keys) (isBaseToken(groupId, k) ? base : custom).push(k);
  return { base, custom };
}

/** Header de sub-sección dentro del body de un acordeón ("Tema base"/"Tus tokens"). `trailing` (docs/49): slot opcional al final de la misma línea — el selector de breakpoint de un `ResponsiveScalarGroup` vive ahí, UNA sola vez por grupo en vez de repetirse por fila. */
function ScalarSectionLabel({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="pbx-tokens__section-label">
      <span className="pbx-tokens__section-label-text">{children}</span>
      {trailing}
    </div>
  );
}

interface ScalarGroupProps {
  title: string;
  /** Prefijo de ruta del token (`colors`, `typography.sizes`…). Base de aria-labels. */
  groupId: string;
  entries: Record<string, string>;
  placeholder: string;
  visual?: ScalarVisual;
  /**
   * Unidades válidas para el valor (docs/08, mismo control que el Inspector de
   * estilo). Presente = el valor se edita con `NumericUnitInput` (pill numérico
   * + selector de unidad + stepper ▲▼) en vez de un input de texto libre.
   * Ausente = el grupo admite shorthands/valores no numéricos (`shadows`), se
   * mantiene como texto libre.
   */
  units?: string[];
  defaultUnit?: string;
  onSet: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}

function ScalarRow({
  groupId,
  tokenKey,
  value,
  isProtected,
  visual,
  units,
  defaultUnit,
  onSet,
  onRemove,
}: {
  groupId: string;
  tokenKey: string;
  value: string;
  isProtected?: boolean;
  visual?: ScalarVisual;
  units?: string[];
  defaultUnit?: string;
  onSet: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation("tokens");
  return (
    <div className={"pbx-token-row" + (isProtected ? " pbx-token-row--base" : "")}>
      <span className="pbx-token-row__key" title={`${groupId}.${tokenKey}`}>
        {tokenKey}
      </span>
      {visual === "radius" ? (
        <span className="pbx-scalar-preview pbx-scalar-preview--radius" style={{ borderRadius: value }} aria-hidden="true" />
      ) : null}
      {visual === "shadow" ? (
        <span className="pbx-scalar-preview pbx-scalar-preview--shadow" style={{ boxShadow: value }} aria-hidden="true" />
      ) : null}
      {units ? (
        <NumericUnitInput
          value={value}
          units={units}
          defaultUnit={defaultUnit}
          onCommit={(v) => {
            if (v !== value) onSet(tokenKey, v);
          }}
        />
      ) : (
        <input
          type="text"
          className="pbx-token__input"
          defaultValue={value}
          key={value}
          onBlur={(e) => {
            if (e.target.value !== value) onSet(tokenKey, e.target.value);
          }}
          aria-label={`${groupId}.${tokenKey}`}
        />
      )}
      <IconButton
        icon={CloseIcon}
        label={isProtected ? t("baseTokenCannotDelete") : t("deleteTitle", { path: `${groupId}.${tokenKey}` })}
        intent="danger"
        disabled={isProtected}
        onClick={() => onRemove(tokenKey)}
      />
    </div>
  );
}

function AddScalar({
  groupId,
  existing,
  placeholder,
  units,
  defaultUnit,
  onAdd,
}: {
  groupId: string;
  existing: Set<string>;
  placeholder: string;
  units?: string[];
  defaultUnit?: string;
  onAdd: (key: string, value: string) => void;
}) {
  const { t } = useTranslation("tokens");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const k = normalizeTokenKey(key);
    if (!isValidTokenKey(k)) {
      setError(t("validation.invalidKey"));
      return;
    }
    if (existing.has(k)) {
      setError(t("validation.alreadyExists"));
      return;
    }
    onAdd(k, value || placeholder);
    setKey("");
    setValue("");
    setError(null);
  };

  return (
    <div className="pbx-token-add">
      <input
        type="text"
        className="pbx-token__input"
        placeholder={t("keyPlaceholder")}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        aria-label={t("newKeyAriaLabel", { group: groupId })}
      />
      {units ? (
        <NumericUnitInput
          value={value}
          units={units}
          defaultUnit={defaultUnit}
          placeholder={placeholder}
          onCommit={setValue}
        />
      ) : (
        <input
          type="text"
          className="pbx-token__input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t("newValueAriaLabel", { group: groupId })}
        />
      )}
      <button type="button" className="pbx-token-add__btn" title={t("addTitle", { group: groupId })} onClick={add}>
        +
      </button>
      {error ? <span className="pbx-token-add__error">{error}</span> : null}
    </div>
  );
}

function ScalarGroup({ title, groupId, entries, placeholder, visual, units, defaultUnit, onSet, onRemove }: ScalarGroupProps) {
  const keys = Object.keys(entries);
  const { base, custom } = splitBaseCustom(groupId, keys);
  const { t } = useTranslation("tokens");
  const renderRow = (k: string) => (
    <ScalarRow
      key={k}
      groupId={groupId}
      tokenKey={k}
      value={entries[k]!}
      isProtected={isBaseToken(groupId, k)}
      visual={visual}
      units={units}
      defaultUnit={defaultUnit}
      onSet={onSet}
      onRemove={onRemove}
    />
  );
  return (
    <TokenGroupAccordion title={title} count={keys.length} groupId={groupId}>
      {base.length > 0 ? (
        <>
          <ScalarSectionLabel>{t("sections.base")}</ScalarSectionLabel>
          {base.map(renderRow)}
        </>
      ) : null}
      {custom.length > 0 ? (
        <>
          <ScalarSectionLabel>{t("sections.custom")}</ScalarSectionLabel>
          {custom.map(renderRow)}
        </>
      ) : null}
      <AddScalar groupId={groupId} existing={new Set(keys)} placeholder={placeholder} units={units} defaultUnit={defaultUnit} onAdd={onSet} />
    </TokenGroupAccordion>
  );
}

// ---------------------------------------------------------------------------
// Tokens responsive por breakpoint (docs/49): SOLO `typography.sizes` y
// `typography.lineHeights`. El input de CADA fila edita el valor del
// breakpoint ACTIVO del editor (`activeBreakpoint`, mismo estado que ya
// gobierna el canvas y `VisibilityStrip`); un ÚNICO selector de breakpoint
// (`ResponsiveBreakpointSwitcher`) vive una sola vez por grupo, en línea con
// el label "Tema base" (`ScalarSectionLabel` `trailing`) — NO se repite un
// selector por fila (evita la duplicación de "screen switcher" por token).
// ---------------------------------------------------------------------------

function ResponsiveScalarRow({
  groupId,
  tokenKey,
  value,
  isProtected,
  units,
  defaultUnit,
  onSet,
  onRemove,
}: {
  groupId: string;
  tokenKey: string;
  value: ResponsiveTokenValue;
  isProtected?: boolean;
  units?: string[];
  defaultUnit?: string;
  onSet: (key: string, value: string, breakpoint?: OverrideBreakpoint) => void;
  onRemove: (key: string, breakpoint?: OverrideBreakpoint) => void;
}) {
  const { t } = useTranslation("tokens");
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);

  // El editor de tokens no tiene una capa "base" propia distinta de "sm": el
  // primer breakpoint de `cfg.order` (normalmente "base") es donde vive el
  // valor mobile-first sin @media — igual semántica que `NodeStyle.base`. Si
  // el breakpoint activo del editor es "base", edita el valor base directo;
  // cualquier otro edita/borra SOLO el override de ESE breakpoint.
  const activeIsBase = activeBreakpoint === "base";
  const resolvedValue = resolveResponsiveDisplay(value, activeBreakpoint, cfg);

  const commit = (v: string) => {
    if (v === resolvedValue) return;
    onSet(tokenKey, v, activeIsBase ? undefined : activeBreakpoint);
  };
  const removeHere = () => {
    onRemove(tokenKey, activeIsBase ? undefined : activeBreakpoint);
  };

  return (
    <div className={"pbx-token-row" + (isProtected ? " pbx-token-row--base" : "")}>
      <span className="pbx-token-row__key" title={`${groupId}.${tokenKey}`}>
        {tokenKey}
      </span>
      {units ? (
        <NumericUnitInput
          key={`${activeBreakpoint}-${resolvedValue}`}
          value={resolvedValue}
          units={units}
          defaultUnit={defaultUnit}
          onCommit={commit}
        />
      ) : (
        <input
          type="text"
          className="pbx-token__input"
          defaultValue={resolvedValue}
          key={`${activeBreakpoint}-${resolvedValue}`}
          onBlur={(e) => commit(e.target.value)}
          aria-label={`${groupId}.${tokenKey}`}
        />
      )}

      <IconButton
        icon={CloseIcon}
        label={
          isProtected && activeIsBase
            ? t("baseTokenCannotDelete")
            : activeIsBase
              ? t("deleteTitle", { path: `${groupId}.${tokenKey}` })
              : t("responsive.removeOverrideTitle", { bp: activeBreakpoint })
        }
        intent="danger"
        disabled={isProtected && activeIsBase}
        onClick={removeHere}
      />
    </div>
  );
}

/** Valor a mostrar en el input para el breakpoint activo del EDITOR (no confundir con `resolveToken`, que resuelve para el CANVAS con el mismo criterio mobile-first). */
function resolveResponsiveDisplay(
  value: ResponsiveTokenValue,
  breakpoint: Breakpoint,
  cfg: BreakpointConfig,
): string {
  if (!isResponsiveTokenValue(value)) return value;
  if (breakpoint === "base") return value.base;
  const idx = cfg.order.indexOf(breakpoint);
  for (let i = idx; i >= 0; i--) {
    const bp = cfg.order[i];
    if (bp === undefined) continue;
    if (bp === "base") return value.base;
    const override = value.overrides?.[bp as OverrideBreakpoint];
    if (override !== undefined) return override;
  }
  return value.base;
}

/**
 * Selector de breakpoint ÚNICO por grupo responsive (docs/49, feedback de
 * pulido: un solo "screen switcher" por card, no uno repetido por fila).
 * Mismo patrón visual/aria que `VisibilityStrip.tsx` `__dots`/`__dot`
 * (`inspector-panel.css`) — pero sin distinción "set"/"heredado" por dot: esa
 * distinción ahora es implícita en el VALOR de cada fila (una fila con
 * override propio simplemente muestra otro número al cambiar de breakpoint),
 * no en el selector, que solo elige CUÁL breakpoint se está editando.
 */
function ResponsiveBreakpointSwitcher() {
  const { t } = useTranslation("tokens");
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const setActiveBreakpoint = useDocumentStore((s) => s.setActiveBreakpoint);

  return (
    <div className="pbx-responsive-scalar__dots" role="group" aria-label={t("responsive.breakpointsLabel")}>
      {cfg.order.map((bp) => {
        const dotClassName =
          "pbx-responsive-scalar__dot" + (bp === activeBreakpoint ? " pbx-responsive-scalar__dot--active" : "");
        const tooltip = t("responsive.dotTooltip", { bp });
        return (
          <button
            key={bp}
            type="button"
            className={dotClassName}
            title={tooltip}
            aria-label={tooltip}
            onClick={() => setActiveBreakpoint(bp)}
          />
        );
      })}
    </div>
  );
}

function ResponsiveScalarGroup({
  title,
  groupId,
  entries,
  placeholder,
  units,
  defaultUnit,
  onSet,
  onRemove,
}: {
  title: string;
  groupId: string;
  entries: Record<string, ResponsiveTokenValue>;
  placeholder: string;
  units?: string[];
  defaultUnit?: string;
  onSet: (key: string, value: string, breakpoint?: OverrideBreakpoint) => void;
  onRemove: (key: string, breakpoint?: OverrideBreakpoint) => void;
}) {
  const keys = Object.keys(entries);
  const { base, custom } = splitBaseCustom(groupId, keys);
  const { t } = useTranslation("tokens");
  const renderRow = (k: string) => (
    <ResponsiveScalarRow
      key={k}
      groupId={groupId}
      tokenKey={k}
      value={entries[k]!}
      isProtected={isBaseToken(groupId, k)}
      units={units}
      defaultUnit={defaultUnit}
      onSet={onSet}
      onRemove={onRemove}
    />
  );
  return (
    <TokenGroupAccordion title={title} count={keys.length} groupId={groupId}>
      {base.length > 0 ? (
        <>
          <ScalarSectionLabel trailing={<ResponsiveBreakpointSwitcher />}>{t("sections.base")}</ScalarSectionLabel>
          {base.map(renderRow)}
        </>
      ) : null}
      {custom.length > 0 ? (
        <>
          <ScalarSectionLabel trailing={base.length === 0 ? <ResponsiveBreakpointSwitcher /> : undefined}>
            {t("sections.custom")}
          </ScalarSectionLabel>
          {custom.map(renderRow)}
        </>
      ) : null}
      <AddScalar
        groupId={groupId}
        existing={new Set(keys)}
        placeholder={placeholder}
        units={units}
        defaultUnit={defaultUnit}
        onAdd={(k, v) => onSet(k, v)}
      />
    </TokenGroupAccordion>
  );
}

// ---------------------------------------------------------------------------
// Paleta de colores como grid de swatches (docs/40 §2.1): reemplaza el listado
// tipo fila de `ScalarGroup` SOLO para el grupo `colors` — swatches grandes
// (≥32×32px) con nombre + hex debajo, en vez de mini-inputs. El picker se abre
// al click en el swatch (mismo `ColorPicker` que el resto del chrome).
// ---------------------------------------------------------------------------

function ColorTokenSwatch({
  groupId,
  tokenKey,
  value,
  isProtected,
  onSet,
  onRemove,
}: {
  groupId: string;
  tokenKey: string;
  value: string;
  isProtected?: boolean;
  onSet: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation("tokens");
  const safeValue = HEX6.test(value) ? value : "#000000";
  return (
    <div className={"pbx-color-grid__cell" + (isProtected ? " pbx-color-grid__cell--base" : "")}>
      <div className="pbx-color-grid__swatch-wrap">
        <ColorPicker
          value={safeValue}
          onChange={() => {}}
          onChangeEnd={(hex) => onSet(tokenKey, hex)}
          label={`${groupId}.${tokenKey} color`}
          className="pbx-color-grid__swatch-picker"
        />
        <IconButton
          icon={CloseIcon}
          label={isProtected ? t("baseTokenCannotDelete") : t("deleteTitle", { path: `${groupId}.${tokenKey}` })}
          intent="danger"
          size="sm"
          disabled={isProtected}
          onClick={() => onRemove(tokenKey)}
          className="pbx-color-grid__remove"
        />
      </div>
      <span className="pbx-color-grid__name" title={`${groupId}.${tokenKey}`}>
        {tokenKey}
      </span>
      <span className="pbx-color-grid__hex">{safeValue}</span>
    </div>
  );
}

function ColorTokenGrid({
  title,
  groupId,
  entries,
  onSet,
  onRemove,
}: {
  title: string;
  groupId: string;
  entries: Record<string, string>;
  onSet: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation("tokens");
  const keys = Object.keys(entries);
  const { base, custom } = splitBaseCustom(groupId, keys);
  const renderSwatch = (k: string) => (
    <ColorTokenSwatch
      key={k}
      groupId={groupId}
      tokenKey={k}
      value={entries[k]!}
      isProtected={isBaseToken(groupId, k)}
      onSet={onSet}
      onRemove={onRemove}
    />
  );
  return (
    <TokenGroupAccordion title={title} count={keys.length} groupId={groupId}>
      {base.length > 0 ? (
        <>
          <ScalarSectionLabel>{t("sections.base")}</ScalarSectionLabel>
          <div className="pbx-color-grid">{base.map(renderSwatch)}</div>
        </>
      ) : null}
      {custom.length > 0 ? (
        <>
          <ScalarSectionLabel>{t("sections.custom")}</ScalarSectionLabel>
          <div className="pbx-color-grid">{custom.map(renderSwatch)}</div>
        </>
      ) : null}
      <AddScalar groupId={groupId} existing={new Set(keys)} placeholder={t("placeholders.colors")} onAdd={onSet} />
    </TokenGroupAccordion>
  );
}

// ---------------------------------------------------------------------------
// Familias tipográficas (valor = TokenFontFamily: stack + webFont opcional).
// ---------------------------------------------------------------------------

const GROUP = "typography.families";

function FamilyRow({ tokenKey, family }: { tokenKey: string; family: TokenFontFamily }) {
  const { t } = useTranslation("tokens");
  const setFontFamily = useDocumentStore((s) => s.setFontFamily);
  const removeFontFamily = useDocumentStore((s) => s.removeFontFamily);
  const web = family.webFont;
  const isProtected = isBaseToken("typography.families", tokenKey);

  const commitStack = (stack: string) => setFontFamily(tokenKey, { ...family, stack });
  const toggleWeb = (on: boolean) =>
    setFontFamily(
      tokenKey,
      on
        ? { ...family, webFont: { provider: "google", family: web?.family ?? "", weights: web?.weights } }
        : { stack: family.stack },
    );
  const commitWebFamily = (fam: string) =>
    setFontFamily(tokenKey, { ...family, webFont: { provider: "google", family: fam, weights: web?.weights } });
  const commitWeights = (raw: string) => {
    const weights = raw.split(",").map((w) => w.trim()).filter(Boolean);
    setFontFamily(tokenKey, {
      ...family,
      webFont: { provider: "google", family: web?.family ?? "", weights: weights.length ? weights : undefined },
    });
  };

  // Preview de tipografía (docs/40 §2.2): si la familia tiene una fuente web
  // de Google activa, se inyecta un <link> en el <head> del chrome mientras
  // el preview está montado (grupo expandido) para que el navegador cargue
  // la fuente real y el texto de ejemplo se vea con ella — no toca el export
  // (P8, `export/usage.ts` mantiene su propio mecanismo basado en uso real).
  const fontHref = googleFontHref(family);
  useEffect(() => {
    if (!fontHref) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontHref;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [fontHref]);

  return (
    <div className="pbx-family">
      <div className={"pbx-token-row" + (isProtected ? " pbx-token-row--base" : "")}>
        <span className="pbx-token-row__key" title={`${GROUP}.${tokenKey}`}>
          {tokenKey}
        </span>
        <input
          type="text"
          className="pbx-token__input"
          defaultValue={family.stack}
          key={family.stack}
          onBlur={(e) => {
            if (e.target.value !== family.stack) commitStack(e.target.value);
          }}
          aria-label={`${GROUP}.${tokenKey} stack`}
          placeholder={t("families.stackPlaceholder")}
        />
        <IconButton
          icon={CloseIcon}
          label={isProtected ? t("baseTokenCannotDelete") : t("deleteTitle", { path: `${GROUP}.${tokenKey}` })}
          intent="danger"
          disabled={isProtected}
          onClick={() => removeFontFamily(tokenKey)}
        />
      </div>
      <p className="pbx-family__preview" style={{ fontFamily: family.stack }}>
        {t("families.preview")}
      </p>
      <div className="pbx-family__web">
        <Toggle
          checked={!!web}
          onChange={(c) => toggleWeb(c)}
          label={`${GROUP}.${tokenKey} fuente web`}
        >
          {t("families.webFont")}
        </Toggle>
      </div>
      {web ? (
        <div className="pbx-family__web-fields">
          <FontFamilyCombobox
            value={web.family}
            onChange={commitWebFamily}
            ariaLabel={`${GROUP}.${tokenKey} nombre Google`}
          />
          <input
            type="text"
            className="pbx-token__input"
            defaultValue={(web.weights ?? []).join(", ")}
            key={`w-${(web.weights ?? []).join(",")}`}
            onBlur={(e) => commitWeights(e.target.value)}
            aria-label={`${GROUP}.${tokenKey} pesos`}
            placeholder={t("families.weightsPlaceholder")}
          />
        </div>
      ) : null}
    </div>
  );
}

function AddFamily({ existing }: { existing: Set<string> }) {
  const { t } = useTranslation("tokens");
  const setFontFamily = useDocumentStore((s) => s.setFontFamily);
  const [key, setKey] = useState("");
  const [stack, setStack] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const k = normalizeTokenKey(key);
    if (!isValidTokenKey(k)) {
      setError(t("validation.invalidKey"));
      return;
    }
    if (existing.has(k)) {
      setError(t("validation.alreadyExists"));
      return;
    }
    setFontFamily(k, { stack: stack || "system-ui, sans-serif" });
    setKey("");
    setStack("");
    setError(null);
  };

  return (
    <div className="pbx-token-add">
      <input
        type="text"
        className="pbx-token__input"
        placeholder={t("families.addKeyPlaceholder")}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        aria-label={t("newKeyAriaLabel", { group: "typography.families" })}
      />
      <input
        type="text"
        className="pbx-token__input"
        placeholder={t("families.addValuePlaceholder")}
        value={stack}
        onChange={(e) => setStack(e.target.value)}
        aria-label={t("newValueAriaLabel", { group: "typography.families" })}
      />
      <button type="button" className="pbx-token-add__btn" title={t("families.addTitle")} onClick={add}>
        +
      </button>
      {error ? <span className="pbx-token-add__error">{error}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TokensEditor() {
  const { t } = useTranslation("tokens");
  const tokens = useDocumentStore((s) => s.site.meta.tokens);
  const setToken = useDocumentStore((s) => s.setToken);
  const removeToken = useDocumentStore((s) => s.removeToken);
  const setTypographyToken = useDocumentStore((s) => s.setTypographyToken);
  const removeTypographyToken = useDocumentStore((s) => s.removeTypographyToken);
  const [query, setQuery] = useState("");

  const families = tokens?.typography?.families ?? {};

  const visualByGroup: Partial<Record<TokenGroup, ScalarVisual>> = {
    spacing: "bar",
    sizes: "bar",
    radii: "radius",
    shadows: "shadow",
  };

  // Unidades válidas por grupo (mismos conjuntos que `styleFields.ts` — el
  // Inspector de estilo consume estos MISMOS tokens vía referencia `{ token }`,
  // así que ambos editores deben ofrecer las mismas unidades). Grupos ausentes
  // aquí (`shadows`) siguen como texto libre: son shorthands multi-valor
  // (`0 1px 3px rgba(...)`), no una sola medida (igual que `padding`/`border`
  // en `styleFields.ts`).
  const unitsByGroup: Partial<Record<TokenGroup, string[]>> = {
    spacing: ["px", "%", "em", "rem", "vw", "vh", "ch"],
    radii: ["px", "%", "em", "rem"],
    sizes: ["px", "%", "em", "rem", "vw", "vh", "fr", "ch"],
  };
  const defaultUnitByGroup: Partial<Record<TokenGroup, string>> = {
    spacing: "px",
    radii: "px",
    sizes: "px",
  };

  const unitsByTypographyGroup: Partial<Record<TypographyScalarGroup, string[]>> = {
    sizes: ["px", "rem", "em", "%"],
    weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    lineHeights: ["", "px", "em", "rem"],
  };
  const defaultUnitByTypographyGroup: Partial<Record<TypographyScalarGroup, string>> = {
    sizes: "px",
  };

  // Búsqueda (docs/40 §2.4): filtra por nombre de clave O valor, sin distinguir
  // mayúsculas. Un grupo entero se oculta si no queda ningún token que
  // matchee y hay una búsqueda activa — reduce el scroll a solo lo relevante.
  const q = query.trim().toLowerCase();
  const matchesQuery = (key: string, value: string) =>
    q === "" || key.toLowerCase().includes(q) || value.toLowerCase().includes(q);
  const filterEntries = (entries: Record<string, string>): Record<string, string> => {
    if (q === "") return entries;
    return Object.fromEntries(Object.entries(entries).filter(([k, v]) => matchesQuery(k, v)));
  };
  /** Mismo filtro que `filterEntries`, para `Record<string, ResponsiveTokenValue>` (docs/49) — matchea contra el valor BASE. */
  const filterResponsiveEntries = (
    entries: Record<string, ResponsiveTokenValue>,
  ): Record<string, ResponsiveTokenValue> => {
    if (q === "") return entries;
    return Object.fromEntries(Object.entries(entries).filter(([k, v]) => matchesQuery(k, baseValueOf(v))));
  };
  const filteredFamilies = Object.fromEntries(
    Object.entries(families).filter(([k, fam]) => matchesQuery(k, fam.stack)),
  );

  return (
    <div className="pbx-tokens">
      <div className="pbx-tokens__search">
        <Search size={14} className="pbx-tokens__search-icon" aria-hidden="true" />
        <input
          type="text"
          className="pbx-control__input pbx-tokens__search-input"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("search.ariaLabel")}
        />
        <Tooltip className="pbx-info-tip" placement="bottom-end" openDelay={60} closeDelay={120}>
          <button
            type="button"
            className="pbx-info-tip__trigger"
            data-c42-tooltip-trigger
            aria-label={t("baseToken")}
          >
            <Info size={14} aria-hidden="true" />
          </button>
          <span className="pbx-info-tip__content" data-c42-tooltip-content>
            {t("baseTokenInfo")}
          </span>
        </Tooltip>
      </div>

      {TOKEN_GROUPS.map((group) => {
        const entries = filterEntries(flattenTree((tokens?.[group] ?? {}) as TokenGroupTree));
        if (q !== "" && Object.keys(entries).length === 0) return null;
        return group === "colors" ? (
          <ColorTokenGrid
            key={group}
            title={t(`groups.${group}`)}
            groupId={group}
            entries={entries}
            onSet={(k, v) => setToken("colors", k, v)}
            onRemove={(k) => removeToken("colors", k)}
          />
        ) : (
          <ScalarGroup
            key={group}
            title={t(`groups.${group}`)}
            groupId={group}
            entries={entries}
            placeholder={t(`placeholders.${group}`)}
            visual={visualByGroup[group]}
            units={unitsByGroup[group]}
            defaultUnit={defaultUnitByGroup[group]}
            onSet={(k, v) => setToken(group, k, v)}
            onRemove={(k) => removeToken(group, k)}
          />
        );
      })}

      {q === "" || Object.keys(filteredFamilies).length > 0 ? (
        <TokenGroupAccordion
          title={t("families.title")}
          count={Object.keys(filteredFamilies).length}
          groupId="typography-families"
        >
          {(() => {
            const { base, custom } = splitBaseCustom("typography.families", Object.keys(filteredFamilies));
            return (
              <>
                {base.length > 0 ? (
                  <>
                    <ScalarSectionLabel>{t("sections.base")}</ScalarSectionLabel>
                    {base.map((k) => (
                      <FamilyRow key={k} tokenKey={k} family={families[k]!} />
                    ))}
                  </>
                ) : null}
                {custom.length > 0 ? (
                  <>
                    <ScalarSectionLabel>{t("sections.custom")}</ScalarSectionLabel>
                    {custom.map((k) => (
                      <FamilyRow key={k} tokenKey={k} family={families[k]!} />
                    ))}
                  </>
                ) : null}
              </>
            );
          })()}
          <AddFamily existing={new Set(Object.keys(families))} />
        </TokenGroupAccordion>
      ) : null}

      {TYPOGRAPHY_SCALAR_GROUPS.map((sub) => {
        if (sub === "weights") {
          const entries = filterEntries((tokens?.typography?.weights ?? {}) as Record<string, string>);
          if (q !== "" && Object.keys(entries).length === 0) return null;
          return (
            <ScalarGroup
              key={sub}
              title={t(`typography.${sub}`)}
              groupId={`typography.${sub}`}
              entries={entries}
              placeholder={t(`typographyPlaceholders.${sub}`)}
              units={unitsByTypographyGroup[sub]}
              defaultUnit={defaultUnitByTypographyGroup[sub]}
              onSet={(k, v) => setTypographyToken(sub, k, v)}
              onRemove={(k) => removeTypographyToken(sub, k)}
            />
          );
        }
        // `sizes`/`lineHeights` (docs/49): valores responsive por breakpoint,
        // control con dots en vez del `ScalarGroup` plano.
        const entries = filterResponsiveEntries(
          (tokens?.typography?.[sub] ?? {}) as Record<string, ResponsiveTokenValue>,
        );
        if (q !== "" && Object.keys(entries).length === 0) return null;
        return (
          <ResponsiveScalarGroup
            key={sub}
            title={t(`typography.${sub}`)}
            groupId={`typography.${sub}`}
            entries={entries}
            placeholder={t(`typographyPlaceholders.${sub}`)}
            units={unitsByTypographyGroup[sub]}
            defaultUnit={defaultUnitByTypographyGroup[sub]}
            onSet={(k, v, bp) => setTypographyToken(sub, k, v, bp)}
            onRemove={(k, bp) => removeTypographyToken(sub, k, bp)}
          />
        );
      })}
    </div>
  );
}
