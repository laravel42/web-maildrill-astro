/**
 * Navbar — barra de navegación con logo + enlaces + hamburguesa móvil (Bloque
 * D, docs/16 §12.4 #20). Interactivo: trae de fábrica el behavior `navbar`
 * (`defaultBehaviors`) que añade el menú hamburguesa móvil animado (runtime
 * opt-in, docs/10).
 *
 * **Vinculado al sistema de páginas (rework, feedback de usuario):** los
 * enlaces YA NO son texto+href libres que el usuario escribe a mano
 * (`props.links`, formato anterior). Se generan automáticamente desde
 * `ctx.pagesInfo` (todas las páginas del sitio, en `pageOrder`, con su ruta
 * ya resuelta — lo construyen `NodeRenderer` en canvas y `resolversFor` en
 * export con el mismo `buildPathMap`, P3, con el título ya resuelto en el
 * locale activo vía `resolveMetaForLocale`, docs/12 §B.9). Agregar una página
 * nueva al sitio la hace aparecer aquí sin tocar el navbar; el usuario decide
 * qué páginas ocultar con `props.hiddenPageIds` (checklist en el Inspector) —
 * el resto se muestra. Sin `ctx.pagesInfo` (fallback defensivo, no debería
 * pasar en canvas/export reales) no se pinta ningún enlace.
 *
 * **Logo como slot de contenido puro (rework, feedback de usuario):**
 * `acceptsChildren: true` — el usuario arrastra dentro `image`/`text`/`icon`
 * (o cualquier combinación); NO hay ningún fallback de texto propio del
 * componente ("Mi Marca"/"Marca"). Mismo patrón que `modal` (`ModalChrome` +
 * `children`, docs/20): la raíz combina chrome fijo (toggle + menú,
 * generados) con un slot libre (`children`, pintado en `.pb-navbar__brand`).
 * Sin contenido, el slot queda vacío (solo el hint de canvas, nunca en export).
 *
 * Render puro (P3): raíz `<nav>` con `rootRef`/`rootProps`; en `exportMode` sin
 * estilo inline en la raíz (AGENTS.md §5); el `data-pb-behavior` lo añade el
 * export desde `node.behaviors` (docs/10 §4).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const NAVBAR_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex" },
    size: { width: "100%" },
    spacing: { padding: "12px 20px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
    },
    appearance: {
      color: { token: "colors.text" },
      background: { token: "colors.surface.default" },
    },
  },
};

/**
 * Layout base del `<nav>`, IDÉNTICO al que declara `NAVBAR_CSS` (más abajo en
 * este archivo, migrado desde `registry/behaviors/navbar.ts` en T10). Se
 * fuerza EXPLÍCITO aquí (no basta con que `ComponentsStyle` inyecte esa regla)
 * porque el `@media` del comportamiento móvil nunca se dispara en Edit: el
 * canvas simula el breakpoint achicando el ANCHO del `.pbx-canvas__frame`
 * (`Canvas.tsx`), no el viewport real del navegador — un `@media (max-width)`
 * evalúa contra ESE viewport real, que sigue siendo ancho en desktop aunque
 * el frame se vea angosto. Por eso el estado móvil completo (logo a la
 * izquierda + hamburguesa a la derecha, en la MISMA línea; menú colapsado
 * debajo) se fuerza vía `style` inline condicionado a `previewMobile`, en vez
 * de depender del `@media` real.
 */
const NAV_BASE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
};

function NavbarRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps, pagesInfo } = ctx;
  const resolvedStyle: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  // El layout base (flex/justify/gap) es chrome ESTRUCTURAL, no una elección
  // del usuario: se aplica primero y el estilo resuelto del nodo puede
  // sobreescribirlo si el usuario edita `gap`/`alignItems` desde el
  // Inspector — el resto de grupos (`size`/`spacing`/`appearance`/
  // `typography`) sigue completamente editable.
  const style: CSSProperties | undefined = exportMode ? undefined : { ...NAV_BASE_STYLE, ...resolvedStyle };

  const hasLogoContent = (node.children?.length ?? 0) > 0;
  const hiddenPageIds = new Set(
    Array.isArray(node.props.hiddenPageIds) ? (node.props.hiddenPageIds as string[]) : [],
  );
  const links = (pagesInfo ?? []).filter((p) => !hiddenPageIds.has(p.pageId));
  const menuId = `pb-navbar-${node.id}-menu`;

  // Chrome fantasma en Edit (mismo criterio que `carouselEditPreviewChrome`,
  // docs/10 §5): el runtime real (`enhanceNavbar`) NUNCA corre en modo Edit
  // (pelearía con selección/DnD), así que sin esto el usuario jamás ve la
  // hamburguesa aunque el behavior esté activo — solo se revela en Preview o
  // en el sitio exportado. Simula el estado "móvil con JS" (`pb-navbar--js`,
  // el mismo umbral que `MOBILE_BREAKPOINT` del behavior, docs/16 §12.4 #20)
  // cuando el breakpoint activo del canvas es `base`/`sm` (< 768px), para que
  // el usuario pueda ver y diseñar el estado colapsado. Nunca se emite en
  // export/Preview reales (ahí el runtime real decide con media queries).
  const previewMobile = !exportMode && (breakpoint === "base" || breakpoint === "sm");

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [
    "pb-navbar",
    previewMobile ? "pb-navbar--js" : null,
    className,
    rootClassName,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <nav
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      aria-label="Principal"
      {...restRootProps}
    >
      <div
        className="pb-navbar__brand"
        {...(!exportMode
          ? { style: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 } as CSSProperties }
          : {})}
      >
        {children}
        {!exportMode && !hasLogoContent ? (
          <span className="pbx-empty-hint pbx-navbar__brand-hint" data-empty-hint>
            Suelta una imagen, texto o icono para el logo
          </span>
        ) : null}
      </div>
      <button
        className="pb-navbar__toggle"
        type="button"
        aria-controls={menuId}
        aria-expanded="false"
        aria-label="Abrir menú"
        {...(previewMobile
          ? {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "5px",
                width: "40px",
                height: "40px",
                padding: "8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "inherit",
              } as CSSProperties,
            }
          : {})}
      >
        <span className="pb-navbar__burger" aria-hidden="true" />
      </button>
      <ul
        className="pb-navbar__menu"
        id={menuId}
        {...(previewMobile
          ? {
              style: {
                display: "none",
                flexBasis: "100%",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "4px",
                listStyle: "none",
                margin: 0,
                padding: 0,
              } as CSSProperties,
            }
          : {})}
      >
        {links.map((link) => (
          <li key={link.pageId}>
            <a href={link.href} aria-current={link.isCurrent ? "page" : undefined}>
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Punto de corte del menú móvil (px). Debe coincidir en el media query del
// CSS y en `previewMobile` (arriba, simulación del canvas). Migrado desde
// `registry/behaviors/navbar.ts` (T10, AGENTS.md).
const MOBILE_BREAKPOINT = 768;

/**
 * CSS estático presentacional (T10, AGENTS.md): barra flex, slot de marca,
 * menú de enlaces, botón hamburguesa (oculto por defecto — sin JS el menú
 * queda visible sin hamburger, degradación accesible) y el `@media` que
 * colapsa a menú móvil SOLO cuando el behavior está adjunto (`.pb-navbar--js`,
 * que el runtime añade al hidratar). Nada de esto depende de que el behavior
 * `navbar` esté adjunto salvo la clase `--js`/`--open` en sí (que solo el
 * runtime puede setear) — sin behavior, el navbar sigue viéndose como una
 * barra completa con todos los enlaces visibles.
 */
const NAVBAR_CSS = [
  ".pb-navbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }",
  // `.pb-navbar__brand` es un CONTENEDOR (slot de logo, docs/16 §12.4 rework):
  // el usuario arrastra dentro `image`/`text`/`icon`; el `<a>` de fallback
  // (sitios sin contenido arrastrado, retrocompat con `props.brand`) hereda
  // el mismo estilo tipográfico que tenía la marca antes.
  ".pb-navbar__brand { display: flex; align-items: center; gap: 8px; min-width: 0; }",
  ".pb-navbar__brand a { font-weight: 700; font-size: 1.125rem; text-decoration: none; color: inherit; }",
  ".pb-navbar__menu { display: flex; align-items: center; gap: 20px; list-style: none; margin: 0; padding: 0; overflow: hidden; }",
  ".pb-navbar__menu a { text-decoration: none; color: inherit; padding: 6px 0; display: inline-block; }",
  ".pb-navbar__menu a:hover { color: var(--colors-primary-default, #2563eb); }",
  // Botón hamburguesa: oculto por defecto (sin JS). 3 líneas con currentColor.
  ".pb-navbar__toggle { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 40px; height: 40px; padding: 8px; border: none; background: transparent; cursor: pointer; color: inherit; }",
  ".pb-navbar__toggle:focus-visible { outline: 2px solid var(--colors-primary-default, #2563eb); outline-offset: 2px; border-radius: 8px; }",
  ".pb-navbar__burger, .pb-navbar__burger::before, .pb-navbar__burger::after { content: ''; display: block; height: 2px; width: 24px; background: currentColor; border-radius: 2px; transition: transform 0.25s ease, opacity 0.25s ease; }",
  ".pb-navbar__burger { position: relative; }",
  ".pb-navbar__burger::before { position: absolute; top: -7px; }",
  ".pb-navbar__burger::after { position: absolute; top: 7px; }",
  // Hamburguesa → X al abrir.
  ".pb-navbar--open .pb-navbar__burger { background: transparent; }",
  ".pb-navbar--open .pb-navbar__burger::before { transform: translateY(7px) rotate(45deg); }",
  ".pb-navbar--open .pb-navbar__burger::after { transform: translateY(-7px) rotate(-45deg); }",
  // Móvil CON JS: se muestra la hamburguesa y el menú colapsa a columna.
  `@media (max-width: ${MOBILE_BREAKPOINT - 1}px) {`,
  "  .pb-navbar--js .pb-navbar__toggle { display: flex; }",
  "  .pb-navbar--js .pb-navbar__menu { display: none; flex-basis: 100%; flex-direction: column; align-items: flex-start; gap: 4px; }",
  "  .pb-navbar--js.pb-navbar--open .pb-navbar__menu { display: flex; }",
  "}",
  "@media (prefers-reduced-motion: reduce) { .pb-navbar__burger, .pb-navbar__burger::before, .pb-navbar__burger::after { transition: none; } }",
].join("\n");

export const navbarDefinition: ComponentDefinition = {
  type: "navbar",
  label: "Barra de navegación",
  category: "navigation",
  acceptsChildren: true,
  defaultProps: {
    hiddenPageIds: [],
  },
  defaultStyle: structuredClone(NAVBAR_DEFAULT_STYLE),
  css: NAVBAR_CSS,
  defaultBehaviors: [{ type: "navbar", options: { duration: 240 } }],
  propsSchema: {
    fields: [
      { key: "hiddenPageIds", label: "Páginas visibles en el menú", control: "page-visibility-list", group: "Contenido" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: NavbarRender,
};
