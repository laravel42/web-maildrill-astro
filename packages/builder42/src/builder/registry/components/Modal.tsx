/**
 * Modal — ventana emergente como ELEMENTO NO-VISIBLE + container (docs/20).
 *
 * Es un **container** cuyo contenido son nodos hijos, y un **elemento
 * no-visible** que no ocupa espacio de layout: su raíz es el `<dialog>` nativo,
 * cerrado = `display:none` (cero espacio); abierto (runtime `showModal()`) es un
 * overlay `position:fixed` en el top-layer. Se dispara desde elementos EXTERNOS
 * con `data-pb-modal-target="<id>"` (acción `onClick` universal, docs/20 §3).
 *
 * Cuatro contextos de render:
 *  - **export** (`exportMode`): `<dialog>` real con los hijos.
 *  - **overlay de edición** (`overlayEditing`): caja editable con el estilo del
 *    nodo (padding/bg/… editables desde el Inspector) + los hijos; superficie
 *    de drop del canvas (docs/20 §4.2).
 *  - **Edit** (`interactive`): marcador `display:none` — NO ocupa layout; se
 *    accede/edita por la burbuja + el overlay.
 *  - **Preview** (`!interactive && !exportMode`): `<dialog>` real (cerrado) para
 *    poder PROBAR el disparo desde un trigger vinculado (WYSIWYG).
 *
 * El estilo editable del nodo (padding, fondo, radio, ancho) vive en
 * `defaultStyle` — así es editable y coherente entre overlay y export; el
 * `runtime.css` solo aporta lo estructural (reset del dialog, cierre, backdrop).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const MODAL_DEFAULT_STYLE: NodeStyle = {
  base: {
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
    },
    appearance: {
      color: { token: "colors.text" },
      background: { token: "colors.surface.default" },
      borderRadius: { token: "radii.lg" },
    },
    spacing: { padding: "24px" },
    size: { width: "440px", maxWidth: "90vw" },
  },
};

/**
 * CSS estático presentacional (T10, AGENTS.md): el diálogo, el backdrop
 * nativo (`::backdrop`, solo con `showModal()`), el botón de cierre y el
 * FALLBACK sin JS vía `:target` (overlay fijo centrado) — nada de esto
 * depende de que el behavior `modal` esté adjunto; sin él, el disparador
 * `href="#pb-modal-<id>"` sigue mostrando el diálogo por CSS puro
 * (progressive enhancement).
 */
const MODAL_CSS = [
  ".pb-modal__dialog { position: relative; border: none; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); }",
  ".pb-modal__dialog::backdrop { background: rgba(0, 0, 0, 0.5); }",
  ".pb-modal__title { margin: 0 0 12px; font-size: 1.25rem; color: inherit; }",
  ".pb-modal__content { margin: 0; }",
  ".pb-modal__close { position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent; cursor: pointer; color: inherit; }",
  ".pb-modal__close:hover { background: rgba(0, 0, 0, 0.06); }",
  ".pb-modal__close:focus-visible { outline: 2px solid var(--colors-primary-default, #2563eb); outline-offset: 2px; }",
  // Fallback sin JS (docs/20 §3.3): un disparador-ancla `href="#pb-modal-<id>"`
  // muestra el diálogo como overlay fijo centrado vía `:target`.
  ".pb-modal__dialog:target { display: block; position: fixed; inset: 0; margin: auto; }",
].join("\n");

/** Chrome interno del modal (botón cerrar + título), común a export/overlay/preview. */
function ModalChrome({ title, titleId }: { title: string; titleId?: string }) {
  return (
    <>
      <button className="pb-modal__close" type="button" aria-label="Cerrar" data-pb-modal-close>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      {title !== "" ? (
        <h2 className="pb-modal__title" id={titleId}>
          {title}
        </h2>
      ) : null}
    </>
  );
}

function ModalRender(ctx: RenderContext) {
  const { node, children, exportMode, interactive, overlayEditing, className, breakpoint, rootRef, rootProps } = ctx;
  const title = typeof node.props.title === "string" ? node.props.title : "";
  const dialogId = `pb-modal-${node.id}`;
  const titleId = title !== "" ? `${dialogId}-title` : undefined;
  const { className: rootClassName, ...restRootProps } = rootProps ?? {};

  // Overlay de edición del canvas (docs/20 §4.2): caja editable con el estilo
  // del nodo aplicado inline (padding/bg/radio… editables desde el Inspector) +
  // los hijos como superficie de drop. Sin la clase `pb-modal__dialog` para no
  // heredar el reset del diálogo (chrome limpio y editable, feedback de usuario).
  if (!exportMode && overlayEditing) {
    const inlineStyle = stylePropertiesToCSSObject(
      resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS),
    ) as CSSProperties;
    const editorClass = ["pb-modal__editor", className, rootClassName].filter(Boolean).join(" ") || undefined;
    const isEmpty = !node.children || node.children.length === 0;
    return (
      <div
        ref={rootRef as Ref<HTMLDivElement> | undefined}
        className={editorClass}
        style={inlineStyle}
        {...restRootProps}
      >
        <ModalChrome title={title} titleId={titleId} />
        {/* Área de contenido claramente droppable en edición (feedback de
            usuario): `pbx-modal-dropzone` le da un mínimo alto y, cuando está
            vacía, un hint punteado "suelta aquí". Es chrome (`pbx-`), no sale al
            export — el output usa solo `.pb-modal__content`. */}
        <div className={`pb-modal__content pbx-modal-dropzone${isEmpty ? " pbx-modal-dropzone--empty" : ""}`}>
          {children}
          {isEmpty ? (
            <span className="pbx-empty-hint" data-empty-hint>
              Modal vacío — suelta componentes aquí
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // Edit (interactive): marcador invisible, NO ocupa layout (docs/20 §2.2). Se
  // accede/edita por la burbuja + overlay. `rootRef`/`rootProps` para DnD/React.
  if (!exportMode && interactive) {
    const canvasClass = [className, rootClassName].filter(Boolean).join(" ") || undefined;
    return (
      <div
        ref={rootRef as Ref<HTMLDivElement> | undefined}
        className={canvasClass}
        data-pb-invisible="modal"
        style={{ display: "none" }}
        {...restRootProps}
      >
        <span className="pb-modal__placeholder" aria-hidden="true">{title !== "" ? title : "Modal"}</span>
      </div>
    );
  }

  // Export y Preview: el `<dialog>` real (cerrado = cero espacio). El estilo del
  // nodo aplica por clase (export: `.n-id` de cssSerializer) o inline (preview).
  const dialogClass = ["pb-modal__dialog", className, rootClassName].filter(Boolean).join(" ") || undefined;
  const dialogStyle: CSSProperties | undefined = exportMode
    ? undefined
    : (stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS)) as CSSProperties);

  return (
    <dialog
      ref={rootRef as Ref<HTMLDialogElement> | undefined}
      className={dialogClass}
      style={dialogStyle}
      id={dialogId}
      data-pb-modal-id={node.id}
      aria-labelledby={titleId}
      {...restRootProps}
    >
      <ModalChrome title={title} titleId={titleId} />
      <div className="pb-modal__content">{children}</div>
    </dialog>
  );
}

export const modalDefinition: ComponentDefinition = {
  type: "modal",
  label: "Modal",
  category: "content",
  acceptsChildren: true,
  editsInOverlay: true,
  defaultProps: {
    title: "Únete a nuestra newsletter",
  },
  defaultStyle: structuredClone(MODAL_DEFAULT_STYLE),
  css: MODAL_CSS,
  defaultBehaviors: [{ type: "modal", options: { closeOnBackdrop: true, duration: 200 } }],
  propsSchema: {
    fields: [{ key: "title", label: "Título", control: "text", group: "Contenido", translatable: true }],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: ModalRender,
};
