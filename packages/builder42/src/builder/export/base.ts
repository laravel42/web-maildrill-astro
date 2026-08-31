/** Capa base compartida: reset + tipografía por defecto (docs/07 §3). */
export function baseCss(): string {
  return [
    "*, *::before, *::after { box-sizing: border-box; }",
    "body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }",
    // Reset de margin de bloques tipográficos (P6/AGENTS.md §5): el
    // componente `text` (rich text vía Tiptap, docs/12 §B.11) puede producir
    // p/h1-h6/blockquote/ul/ol/li al insertar saltos de línea. El navegador
    // les aplica un margin de user-agent por defecto (ej. `p { margin: 1em 0 }`)
    // que NUNCA se declaró en ningún `defaultStyle` — se colaba igual en
    // export, canvas estático y edición, rompiendo WYSIWYG y violando P6 (todo
    // estilo de presentación vive en `defaultStyle`, nunca en un default
    // implícito del navegador). Se resetea a 0 aquí: el usuario separa
    // párrafos con líneas vacías o, para un ajuste fino, con el grupo
    // `spacing` del Inspector — nunca queda un margin "gratis" sin declarar.
    "p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, li { margin: 0; padding: 0; }",
    "img { max-width: 100%; display: block; }",
    // Scrollbars finas del sitio exportado (T6). Personalizables por tema con
    // las variables --scrollbar-* (el theme las reasigna vía tokens
    // `scrollbar.thumb`/`scrollbar.track`/`scrollbar.size` → cssVarName); por
    // defecto se derivan del token de color de texto para adaptarse al tema
    // activo. Firefox solo respeta `scrollbar-width`/`scrollbar-color`; los
    // pseudo ::-webkit-scrollbar afinan en Chromium/WebKit.
    "html { scrollbar-width: var(--scrollbar-ff-width, thin); scrollbar-color: var(--scrollbar-thumb, color-mix(in srgb, var(--colors-text, #111827) 28%, transparent)) var(--scrollbar-track, transparent); }",
    "::-webkit-scrollbar { width: var(--scrollbar-size, 10px); height: var(--scrollbar-size, 10px); }",
    "::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); }",
    "::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, color-mix(in srgb, var(--colors-text, #111827) 28%, transparent)); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }",
    "::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb, color-mix(in srgb, var(--colors-text, #111827) 45%, transparent)); background-clip: padding-box; }",
    // Select component — fallback <details>/<summary> + combobox ARIA (docs/14 §1, docs/15 tier 1)
    // Igual que LanguageNav: CSS puro abre/cierra sin JS; con ui.js el enhancer activa el combobox ARIA.
    ".pb-select { position: relative; display: block; transition: border-color 0.2s, box-shadow 0.2s; }",
    ".pb-select[open] .pb-select__arrow svg { transform: rotate(180deg); }",
    ".pb-select:focus-within { border-color: var(--colors-primary-default); box-shadow: 0 0 0 3px color-mix(in srgb, var(--colors-primary-default) 12%, transparent); }",
    // Summary (trigger)
    ".pb-select__summary { display: flex; align-items: center; justify-content: space-between; padding: 0 12px; width: 100%; min-height: 44px; list-style: none; cursor: pointer; user-select: none; }",
    ".pb-select__summary::-webkit-details-marker { display: none; }",
    ".pb-select__summary:hover { background: color-mix(in srgb, var(--colors-primary-default) 6%, transparent); }",
    ".pb-select__trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".pb-select__trigger-label--placeholder { color: var(--colors-muted); }",
    // Arrow (chevron)
    ".pb-select__arrow { display: flex; align-items: center; margin-left: 8px; color: var(--colors-muted); flex-shrink: 0; transition: color 0.2s; }",
    ".pb-select__arrow svg { transition: transform 0.2s; }",
    ".pb-select__summary:hover .pb-select__arrow, .pb-select[open] .pb-select__summary .pb-select__arrow { color: var(--colors-primary-default); }",
    // Listbox dropdown
    ".pb-select__listbox { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; margin: 0; padding: 4px; list-style: none; background: var(--colors-surface-default); border: 1px solid var(--colors-border); border-radius: var(--radii-md, 8px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); max-height: 240px; overflow-y: auto; }",
    // Sin JS: visible cuando <details> está abierto
    ".pb-select:not([open]) .pb-select__listbox { display: none; }",
    // Con JS: el enhancer controla visibilidad via hidden
    ".pb-select--enhanced .pb-select__listbox[hidden] { display: none; }",
    ".pb-select--enhanced .pb-select__listbox:not([hidden]) { display: block; }",
    // Opciones
    ".pb-select__option { padding: 8px 12px; border-radius: var(--radii-sm, 4px); color: var(--colors-text); cursor: pointer; transition: background 0.1s; user-select: none; }",
    ".pb-select__option:hover, .pb-select__option--highlighted { background: color-mix(in srgb, var(--colors-primary-default) 8%, var(--colors-surface-default)); }",
    ".pb-select__option[aria-selected='true'] { background: color-mix(in srgb, var(--colors-primary-default) 12%, var(--colors-surface-default)); color: var(--colors-primary-default); font-weight: 500; }",
    // Select nativo siempre oculto (solo para form submit)
    ".pb-select__native { display: none !important; }",
    // Placeholder del trigger (texto atenuado cuando no hay selección)
    ".pb-select__trigger-label--placeholder { color: var(--colors-muted); }",
    // LanguageNav component — dropdown <details>/<summary> (docs/14 §2)
    ".pb-language-nav { position: relative; }",
    ".pb-language-nav__trigger { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; padding: 6px 10px; border-radius: 6px; user-select: none; color: inherit; }",
    ".pb-language-nav__trigger::-webkit-details-marker { display: none; }",
    ".pb-language-nav__trigger:hover { background: color-mix(in srgb, var(--colors-text) 8%, transparent); }",
    ".pb-language-nav__globe { display: block; }",
    ".pb-language-nav__current { font-weight: 500; }",
    ".pb-language-nav__chevron { display: inline-flex; color: currentColor; opacity: 0.6; transition: transform 0.2s; }",
    ".pb-language-nav[open] .pb-language-nav__chevron { transform: rotate(180deg); }",
    ".pb-language-nav__menu { position: absolute; top: calc(100% + 4px); left: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; min-width: 140px; background: var(--colors-surface-default); border: 1px solid var(--colors-border); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }",
    ".pb-language-nav__item { display: block; }",
    ".pb-language-nav__link { display: block; padding: 8px 12px; border-radius: 5px; color: inherit; text-decoration: none; white-space: nowrap; transition: background 0.12s; }",
    ".pb-language-nav__link:hover { background: color-mix(in srgb, var(--colors-text) 8%, transparent); }",
    ".pb-language-nav__link--current { font-weight: 600; background: color-mix(in srgb, var(--colors-primary-default) 8%, transparent); color: var(--colors-primary-default); }",
  ].join("\n");
}
