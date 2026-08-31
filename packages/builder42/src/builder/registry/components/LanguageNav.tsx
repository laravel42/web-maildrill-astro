/**
 * LanguageNav — selector de idioma del sitio publicado (docs/14 §2). Es un
 * dropdown de divulgación (`<details>`/`<summary>`): el trigger (un ícono de
 * globo o el idioma actual como texto) despliega una lista de enlaces `<a>` a
 * las versiones localizadas de la página actual.
 *
 * **Cero-JS (P8):** `<details>` abre/cierra de forma nativa, sin runtime. Los
 * idiomas son enlaces `<a>` reales con `hreflang` → SEO intacto (reemplaza el
 * antiguo plan de behavior `language-switcher`, docs/12 §B.8). Un
 * `ui.js`/behavior podría mejorarlo (cerrar al hacer clic fuera) como
 * progressive enhancement futuro, pero no es necesario para funcionar.
 *
 * Lee `ctx.localeInfo` (presente solo en sitios multilingües). Cumple P3 (un
 * solo render canvas/export), P4 (el core no lo conoce). Estilos a tokens base.
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

type DisplayMode = "native" | "codes" | "labels";
type TriggerMode = "icon" | "text";

/**
 * Etiqueta de un locale:
 * - "native": nombre en su propio idioma (Español, English) vía Intl.DisplayNames.
 * - "labels": nombre en el idioma que se renderiza (Spanish, Inglés…).
 * - "codes": el código en mayúsculas (ES, EN, IT).
 */
function localeLabel(locale: string, mode: DisplayMode, currentLocale: string): string {
  if (mode === "codes") return locale.toUpperCase();
  const inLocale = mode === "native" ? locale : currentLocale;
  try {
    const dn = new Intl.DisplayNames([inLocale], { type: "language" });
    const name = dn.of(locale);
    if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    // Intl.DisplayNames no disponible → fallback al código.
  }
  return locale.toUpperCase();
}

/** Ícono de globo (idioma), inline para no depender de assets externos (P8). */
function GlobeIcon() {
  return (
    <svg
      className="pb-language-nav__globe"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LanguageNavRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, localeInfo } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const mode: DisplayMode =
    node.props.displayMode === "codes" || node.props.displayMode === "labels"
      ? node.props.displayMode
      : "native";
  const triggerMode: TriggerMode = node.props.triggerMode === "text" ? "text" : "icon";
  const showCurrent = node.props.showCurrent !== false; // default true
  const ariaLabel =
    typeof node.props.ariaLabel === "string" && node.props.ariaLabel
      ? node.props.ariaLabel
      : "Language";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName =
    [className, rootClassName, "pb-language-nav"].filter(Boolean).join(" ") || undefined;

  // Sin localeInfo (sitio monolingüe): placeholder en canvas, nada útil en
  // export (P8: no rompe, solo un contenedor vacío con la nota oculta al publicar).
  if (!localeInfo || localeInfo.locales.length === 0) {
    return (
      <div
        ref={rootRef as Ref<HTMLDivElement> | undefined}
        className={mergedClassName}
        style={style}
        {...restRootProps}
      >
        {!exportMode && (
          <span className="pb-language-nav__empty">
            Activa el multilenguaje del sitio para ver los idiomas aquí.
          </span>
        )}
      </div>
    );
  }

  const items = showCurrent
    ? localeInfo.locales
    : localeInfo.locales.filter((l) => l !== localeInfo.currentLocale);

  const currentLabel = localeLabel(localeInfo.currentLocale, mode, localeInfo.currentLocale);

  return (
    <details
      ref={rootRef as Ref<HTMLDetailsElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      <summary className="pb-language-nav__trigger" aria-label={ariaLabel}>
        {triggerMode === "icon" ? (
          <GlobeIcon />
        ) : (
          <span className="pb-language-nav__current">{currentLabel}</span>
        )}
        <span className="pb-language-nav__chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>
      <ul className="pb-language-nav__menu" role="list">
        {items.map((locale) => {
          const isCurrent = locale === localeInfo.currentLocale;
          return (
            <li key={locale} className="pb-language-nav__item">
              <a
                className={
                  "pb-language-nav__link" + (isCurrent ? " pb-language-nav__link--current" : "")
                }
                href={localeInfo.localizedHref(locale)}
                hrefLang={locale}
                aria-current={isCurrent ? "page" : undefined}
              >
                {localeLabel(locale, mode, localeInfo.currentLocale)}
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export const languageNavDefinition: ComponentDefinition = {
  type: "language-nav",
  label: "Language Nav",
  category: "navigation",
  acceptsChildren: false,
  defaultProps: {
    triggerMode: "icon",
    displayMode: "native",
    showCurrent: true,
    ariaLabel: "",
  },
  defaultStyle: {
    base: {
      layout: { display: "inline-block" },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: { token: "typography.sizes.sm" },
      },
      appearance: { color: { token: "colors.text" } },
    },
  },
  propsSchema: {
    fields: [
      {
        key: "triggerMode",
        label: "Disparador",
        control: "select",
        group: "Contenido",
        options: [
          { label: "Ícono (globo)", value: "icon" },
          { label: "Texto (idioma actual)", value: "text" },
        ],
      },
      {
        key: "displayMode",
        label: "Formato",
        control: "select",
        group: "Contenido",
        options: [
          { label: "Nombre nativo (Español)", value: "native" },
          { label: "Código (ES)", value: "codes" },
          { label: "Nombre traducido (Spanish)", value: "labels" },
        ],
      },
      { key: "showCurrent", label: "Incluir idioma actual", control: "toggle", group: "Contenido" },
      { key: "ariaLabel", label: "Aria label", control: "text", group: "Accesibilidad" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance", "layout"] },
  render: LanguageNavRender,
};
