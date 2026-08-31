/**
 * SocialLinks — fila de iconos enlazados a redes sociales (docs/16 §12.1 #18).
 *
 * Componente `navigation` atómico. Lista editable con `options-list`: `label` =
 * red social (elige icono + `aria-label`), `value` = URL del perfil.
 *
 * Los iconos provienen de dos fuentes:
 *  1. `simple-icons` (3450 marcas, `fill`, sólidas) — TODO el catálogo se
 *     indexa dinámicamente por `slug` (mismo patrón que `IconComponent` con
 *     `lucide`, docs/26 #11): nada de mapear networks a mano una por una.
 *  2. Fallback hardcodeado (stroke, line-icon) solo para lo que `simple-icons`
 *     NO cubre por guidelines de marca (LinkedIn, Twitter clásico) o por no
 *     ser una marca (Email es un concepto genérico, no un logo).
 *
 * Cero-JS en el output (P8): los SVG son estáticos, `renderToStaticMarkup` los
 * serializa sin React.
 *
 * Render puro (P3): raíz `<nav>` con `rootRef`/`rootProps` sin wrapper.
 */

import type { CSSProperties, ReactElement, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";
import { simpleIconsCatalog } from "../catalogs/simpleIcons.catalog";
import { SIMPLE_ICON_ENTRIES } from "../catalogs/generated/simpleIcons.names";

interface SocialLink {
  label: string;
  value: string;
}

type IconSource = { kind: "simple-icons"; path: string } | { kind: "hardcoded"; glyph: ReactElement };

/**
 * Fallback hardcodeado (stroke, line-icon) SOLO para lo que `simple-icons` no
 * cubre: LinkedIn y el Twitter "pájaro" clásico fueron retirados del paquete
 * por guidelines de marca; "mail" no es una marca, es un concepto genérico.
 */
const HARDCODED_ICONS: Record<string, ReactElement> = {
  twitter: <path d="M22 5.9c-.7.3-1.5.5-2.3.6a4 4 0 0 0 1.8-2.2c-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.8 3.6A11.3 11.3 0 0 1 3.7 4.6a4 4 0 0 0 1.2 5.3c-.6 0-1.2-.2-1.7-.5a4 4 0 0 0 3.2 3.9c-.5.2-1.1.2-1.7.1a4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18.6a11.3 11.3 0 0 0 6.1 1.8c7.3 0 11.4-6.1 11.4-11.4v-.5c.8-.6 1.5-1.3 2-2.1z" />,
  linkedin: <path d="M4 9h3v11H4zM5.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM10 9h3v1.6c.5-.9 1.6-1.8 3.3-1.8 3 0 3.7 1.9 3.7 4.6V20h-3v-5.2c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20h-3z" />,
  mail: <path d="M3 5h18v14H3zM3 6l9 7 9-7" />,
};
const HARDCODED_LABELS: Record<string, string> = {
  twitter: "Twitter (clásico)",
  linkedin: "LinkedIn",
  mail: "Email",
};

const GENERIC_ICON: ReactElement = (
  <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
);

/** Lista de redes reconocidas (todo simple-icons + el fallback hardcodeado). */
export const SOCIAL_NETWORKS = [...SIMPLE_ICON_ENTRIES.map((e) => e.slug), ...Object.keys(HARDCODED_ICONS)];

/** Catálogo de sugerencias para el picker de red social del Inspector (labelOptions). */
const NETWORK_OPTIONS = [
  ...SIMPLE_ICON_ENTRIES.map((icon) => ({ label: icon.title, value: icon.slug })),
  ...Object.entries(HARDCODED_LABELS).map(([value, label]) => ({ label, value })),
].sort((a, b) => a.label.localeCompare(b.label));

/** Preview en miniatura del glifo de marca para el picker de red social del Inspector. */
function renderNetworkPreview(label: string): ReactElement | null {
  const source = resolveIcon(label);
  if (!source) return null;
  if (source.kind === "simple-icons") {
    return (
      <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
        <path d={source.path} />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {source.glyph}
    </svg>
  );
}

function resolveIcon(label: string): IconSource | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;

  const si = simpleIconsCatalog.get(key);
  if (si) return { kind: "simple-icons", path: si.path };

  const hc = HARDCODED_ICONS[key];
  if (hc) return { kind: "hardcoded", glyph: hc };

  return null;
}

/**
 * El tamaño de cada icono se gobierna con `typography.fontSize` (grupo
 * habilitado en `styleSchema`, docs/08 §6) en vez de `size.width/height`: el
 * grupo `size` siempre se aplica al elemento RAÍZ del nodo (`<nav>`, un bloque
 * de layout cuyo ancho/alto no tiene relación visual con el glifo), mientras
 * que `font-size` es una propiedad CSS heredable — cascada de forma nativa a
 * TODOS los `<a>`/`<svg>` hijos sin necesitar un selector nuevo en
 * `cssSerializer` (que solo sabe emitir declaraciones sobre la clase del nodo
 * raíz, docs/01 §5). Los iconos se dimensionan en `em` relativo a ese
 * `font-size` heredado, así que ajustar "Tamaño" en el grupo Tipografía del
 * Inspector escala el glifo real, no solo la caja de `<nav>` (bug real:
 * antes el `width/height` fijos en `LINK_STYLE`/`<svg>` ignoraban por
 * completo cualquier valor de `size`, solo crecía el contenedor).
 */
export const SOCIAL_LINKS_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    appearance: { color: { token: "colors.text" } },
    typography: { fontSize: "24px" },
  },
};

const LIST_STYLE: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
};
const LINK_STYLE: CSSProperties = {
  display: "inline-flex",
  color: "inherit",
  width: "1em",
  height: "1em",
};
const ICON_STYLE: CSSProperties = { width: "1em", height: "1em" };

function SocialLinksRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const links: SocialLink[] = Array.isArray(node.props.links) ? (node.props.links as SocialLink[]) : [];

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <nav
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      aria-label="Redes sociales"
      {...restRootProps}
    >
      <ul style={LIST_STYLE}>
        {links.map((l, i) => {
          const label = typeof l?.label === "string" ? l.label.trim() : "";
          const value = typeof l?.value === "string" ? l.value : "";
          const source = resolveIcon(label);
          const glyph = source?.kind === "hardcoded" ? source.glyph : GENERIC_ICON;

          return (
            <li key={i}>
              <a
                href={value !== "" ? value : "#"}
                style={LINK_STYLE}
                aria-label={label !== "" ? label : "Red social"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source?.kind === "simple-icons" ? (
                  <svg
                    viewBox="0 0 24 24"
                    style={ICON_STYLE}
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d={source.path} />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    style={ICON_STYLE}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {source ? glyph : GENERIC_ICON}
                  </svg>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const socialLinksDefinition: ComponentDefinition = {
  type: "social-links",
  label: "Redes sociales",
  category: "navigation",
  acceptsChildren: false,
  defaultProps: {
    links: [
      { label: "x", value: "https://x.com/" },
      { label: "github", value: "https://github.com/" },
      { label: "linkedin", value: "https://linkedin.com/" },
    ],
  },
  defaultStyle: structuredClone(SOCIAL_LINKS_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      {
        key: "links",
        label: "Redes (nombre + URL)",
        control: "options-list",
        group: "Contenido",
        placeholder: "github, linkedin, x, facebook, instagram…",
        labelOptions: NETWORK_OPTIONS,
        renderLabelPreview: renderNetworkPreview,
      },
    ],
  },
  styleSchema: { enabledGroups: ["size", "spacing", "appearance", "typography"] },
  render: SocialLinksRender,
};
