/**
 * Alert — mensaje destacado con variante (info/success/warning/error) + icono
 * (docs/16 §12.1 #15).
 *
 * Componente `content` atómico. La estructura (layout, padding, radio, tipografía)
 * vive en `defaultStyle` por tokens (clase en export / inline en canvas). Los
 * COLORES de la variante (fondo tintado + barra de acento a la izquierda + color
 * del icono) van como estilo inline con `var(--colors-*)` en AMBOS modos: esas
 * custom properties las define el sistema de tokens en canvas (frame) y export
 * (`:root`), así que el color es coherente con el tema sin depender del `style`
 * gateado de la raíz (AGENTS.md §5). Por eso la variante ES una prop viable aquí
 * (a diferencia de badge, cuyo color va por `node.style`): no se emite por
 * `node.style` sino por vars, y no colisiona porque el grupo `appearance` NO se
 * expone en el Inspector (el usuario cambia la variante, no el fondo crudo).
 *
 * `warning` usa `var(--colors-warning, #d97706)`: si el usuario define un token
 * `colors.warning` se usa; si no, cae al ámbar por defecto (no hay token de
 * warning en `BASE_TOKENS`). Render puro (P3), HTML puro sin runtime (P8).
 */

import type { CSSProperties, ReactElement, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

/** Color de acento por variante (custom property de token, con fallback). */
const VARIANT_ACCENT: Record<string, string> = {
  info: "var(--colors-primary-default, #2563eb)",
  success: "var(--colors-success, #16a34a)",
  warning: "var(--colors-warning, #d97706)",
  error: "var(--colors-error-default, #dc2626)",
};

/** Glifo por variante (SVG inline, stroke currentColor → hereda el acento). */
const VARIANT_ICON: Record<string, ReactElement> = {
  info: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v5M12 7.5h.01" />,
  success: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l2.5 2.5L16 9" />,
  warning: <path d="M12 3 2 20h20zM12 10v4M12 17.5h.01" />,
  error: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6" />,
};

export const ALERT_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", alignItems: "flex-start", gap: "12px" },
    spacing: { padding: "12px 16px" },
    size: { width: "100%" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: {
      color: { token: "colors.text" },
      borderRadius: { token: "radii.md" },
    },
  },
};

const ICON_STYLE: CSSProperties = { flexShrink: 0, width: "20px", height: "20px", marginTop: "1px" };

function AlertRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;

  const variant = typeof node.props.variant === "string" && node.props.variant in VARIANT_ACCENT
    ? node.props.variant
    : "info";
  const accent = VARIANT_ACCENT[variant] as string;
  const message = typeof node.props.message === "string" && node.props.message !== "" ? node.props.message : "Mensaje";
  const showIcon = node.props.showIcon !== false;

  // Colores de la variante — inline en AMBOS modos (via var de token).
  const variantStyle: CSSProperties = {
    background: `color-mix(in srgb, ${accent} 12%, var(--colors-surface-default, #fff))`,
    borderLeft: `4px solid ${accent}`,
  };
  const resolvedInline = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const style: CSSProperties = { ...(resolvedInline ?? {}), ...variantStyle };

  const { className: rootClassName, style: rootStyle, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={{ ...style, ...rootStyle }}
      role="note"
      {...restRootProps}
    >
      {showIcon ? (
        <svg
          style={{ ...ICON_STYLE, color: accent }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {VARIANT_ICON[variant]}
        </svg>
      ) : null}
      <span>{message}</span>
    </div>
  );
}

export const alertDefinition: ComponentDefinition = {
  type: "alert",
  label: "Alerta",
  category: "content",
  acceptsChildren: false,
  defaultProps: { message: "This is an important message.", variant: "info", showIcon: true },
  defaultStyle: structuredClone(ALERT_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "message", label: "Mensaje", control: "text", group: "Contenido", translatable: true },
      {
        key: "variant",
        label: "Variante",
        control: "select",
        group: "Contenido",
        options: [
          { label: "Información", value: "info" },
          { label: "Éxito", value: "success" },
          { label: "Advertencia", value: "warning" },
          { label: "Error", value: "error" },
        ],
      },
      { key: "showIcon", label: "Mostrar icono", control: "toggle", group: "Contenido" },
    ],
  },
  // `appearance` NO se expone: el color lo decide la variante (evita conflicto
  // entre el fondo por variante inline y un fondo por clase del Inspector).
  styleSchema: { enabledGroups: ["typography", "spacing", "size"] },
  render: AlertRender,
};
