/**
 * Button y ButtonSubmit — variantes del componente botón (PLAN §3, docs/06 §4,
 * docs/16 §10.1 decisión D2).
 *
 * **`button`**: enlace `<a>` con apariencia de botón. Soporta `LinkTarget`
 * (interno/externo/ancla), `newTab`. Comparte `defaultStyle` con `button-submit`.
 *
 * **`button-submit`**: `<button type="submit">` para envío de formularios. Mismos
 * tokens y estilos base; sin prop `link`/`newTab`. Variante del mismo componente
 * (mismo archivo, comparten constante de estilos), no un componente arquitectónico
 * separado. Sigue P3 (un solo render cada uno), P4 (dos entradas distintas en el
 * registry — el core no los distingue), P8 (HTML puro sin runtime).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type LinkTarget, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

/** Lee un `LinkTarget` de props.link si tiene forma válida (docs/06 §4). */
function readLink(value: unknown): LinkTarget | null {
  if (typeof value !== "object" || value === null) return null;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "internal" || kind === "external" || kind === "anchor") {
    return value as LinkTarget;
  }
  return null;
}

/**
 * Fallback local cuando la pipeline no inyecta `resolveLink` (canvas, docs
 * types.ts): externo/ancla se resuelven sin path map (igual que
 * `export/links.ts`); interno necesita el mapa `PageId→ruta`, así que cae a "#".
 */
function localResolve(link: LinkTarget): string {
  if (link.kind === "external") return link.href;
  if (link.kind === "anchor") return `#${link.nodeId}`;
  return "#";
}

/**
 * Estilos base compartidos por `button` y `button-submit`. Cambiar un token
 * aquí propaga a ambas variantes. El usuario puede desvincular por-nodo desde
 * el Inspector (docs/08 §5). No contiene valores hardcodeados — solo tokens
 * de BASE_TOKENS (AGENTS-COMPONENTS.md §2).
 */
export const BUTTON_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "inline-block" },
    spacing: { padding: "8px 16px" },
    appearance: {
      background: { token: "colors.primary.default" },
      color: { token: "colors.primary.on" },
      borderRadius: { token: "radii.md" },
    },
    typography: { textDecoration: "none" },
  },
};

// ---------------------------------------------------------------------------
// Button — <a> con apariencia de botón
// ---------------------------------------------------------------------------

function ButtonRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, resolveLink } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const label = typeof node.props.label === "string" ? node.props.label : "Button";

  // Preferimos props.link (LinkTarget); la pipeline lo resuelve a URL real, y
  // sin pipeline (canvas) usamos el fallback local. Si no hay link, el href
  // legacy; en último caso "#".
  const link = readLink(node.props.link);
  const href = link
    ? (resolveLink?.(link) ?? localResolve(link))
    : typeof node.props.href === "string"
      ? node.props.href
      : "#";

  // Abrir en pestaña nueva (opcional). `rel` con noopener/noreferrer por
  // seguridad (evita acceso a window.opener y fuga de referrer).
  const newTab = node.props.newTab === true;
  const target = newTab ? "_blank" : undefined;
  const rel = newTab ? "noopener noreferrer" : undefined;

  return (
    <a
      ref={rootRef as Ref<HTMLAnchorElement> | undefined}
      className={className}
      style={style}
      href={href}
      target={target}
      rel={rel}
      {...rootProps}
    >
      {label}
    </a>
  );
}

export const buttonDefinition: ComponentDefinition = {
  type: "button",
  label: "Button",
  category: "content",
  acceptsChildren: false,
  defaultProps: { label: "Button", link: { kind: "external", href: "#" }, newTab: false },
  defaultStyle: structuredClone(BUTTON_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "label", label: "Texto", control: "text", group: "Contenido", translatable: true },
      { key: "link", label: "Enlace", control: "link", group: "Acción" },
      { key: "newTab", label: "Abrir en pestaña nueva", control: "toggle", group: "Acción" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: ButtonRender,
};

// ---------------------------------------------------------------------------
// ButtonSubmit — <button type="submit"> variante para formularios
// ---------------------------------------------------------------------------

function ButtonSubmitRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const label = typeof node.props.label === "string" ? node.props.label : "Submit";
  const disabled = node.props.disabled === true;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <button
      ref={rootRef as Ref<HTMLButtonElement> | undefined}
      type="submit"
      className={mergedClassName}
      style={style}
      disabled={disabled || undefined}
      {...restRootProps}
    >
      {label}
    </button>
  );
}

export const buttonSubmitDefinition: ComponentDefinition = {
  type: "button-submit",
  label: "Enviar (submit)",
  category: "form",
  acceptsChildren: false,
  // El click nativo de `<button type="submit">` ya dispara el envío del
  // `<form>` (P8, sin JS). El runtime de `open-modal` hace `event.preventDefault()`
  // sobre el mismo evento click (`runtime/behaviors/modal.ts`), lo que
  // CANCELARÍA el submit — el botón dejaría de enviar el formulario para solo
  // abrir el modal. No comparte campo con `link` (no lo tiene en su schema),
  // pero su click ya tiene un propósito propio incompatible con una acción
  // adicional (misma razón que `text`/`input`/`textarea`/`select`).
  disallowsClickAction: true,
  defaultProps: {
    label: "Submit",
    disabled: false,
  },
  defaultStyle: structuredClone(BUTTON_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "label", label: "Texto", control: "text", group: "Contenido", translatable: true },
      { key: "disabled", label: "Deshabilitado", control: "toggle", group: "Estado" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: ButtonSubmitRender,
};
