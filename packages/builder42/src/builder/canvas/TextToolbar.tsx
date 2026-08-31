/**
 * TextToolbar — toolbar flotante de formato para el bloque `text` en edición
 * (docs/12 §B.11). Se posiciona ENCIMA del bloque (o debajo si no hay espacio
 * arriba dentro del frame), sin empujar el layout de los demás componentes —
 * es chrome de edición, nunca sale al HTML exportado (P8), igual que
 * `SelectionHandle`.
 *
 * Mismo patrón de medición que `dnd/SelectionHandle.tsx`: mide el rect del
 * nodo en edición (`data-node-id`) contra el `frameRef` del Canvas con
 * `ResizeObserver`, y se reposiciona en cada resize/cambio de breakpoint.
 *
 * No conoce a `TextEditingView` directamente: lee `activeTiptapEditor` del
 * store (publicado por `Text.stub.tsx` vía `onReady`/`onDestroy` de
 * `TiptapEditor`) y ejecuta comandos sobre esa instancia
 * (`editor.chain().focus().toggleBold().run()`). Los botones reflejan el
 * estado activo de la selección (`editor.isActive('bold')`) vía
 * `useEditorState` para no re-renderizar en cada tecleo salvo que el estado
 * relevante cambie.
 *
 * Botón de idioma (docs/12 §B, Fase 19.g/19.j): reutiliza
 * `LocaleQuickAccess` TAL CUAL (mismo componente que usa `PropField`) — es
 * autocontenido (lee `editingLocale`/`site.meta.i18n` del store por su
 * cuenta, sin props) y ya se auto-oculta si el sitio no es multilingüe, así
 * que no hace falta duplicar esa lógica ni extraer un hook. Se monta DENTRO
 * del contenedor `data-text-toolbar` (separado visualmente con un separador
 * y `margin-left:auto`, "fuera de la caja del texto" pero no fuera del
 * marcador que ya excluye clicks del listener global de "click fuera cierra
 * edición", `Text.stub.tsx` `TextEditingView`) — evita extender ese
 * `closest()` con un segundo marcador. La única adaptación es visual: el CSS
 * de `.pbx-locale-quick` asume el panel claro del Inspector; dentro de la
 * toolbar oscura flotante se sobreescriben sus tokens de color (ver
 * `chrome/canvas-nodes.css`), el componente en sí no cambia.
 */

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useEditorState } from "@tiptap/react";
import { useDocumentStore } from "../store/documentStore";
import { LocaleQuickAccess } from "../inspector/controls/LocaleQuickAccess";

interface TextToolbarProps {
  /** Frame del canvas: sistema de coordenadas y `offsetParent` de la toolbar. */
  frameRef: RefObject<HTMLElement | null>;
}

interface Box {
  top: number;
  left: number;
  /** true = la toolbar se posiciona DEBAJO del bloque (no cupo arriba). */
  below: boolean;
}

/** Subconjunto de `editor.isActive(...)` que la toolbar necesita reflejar. */
interface EditorFormatState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  link: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  bulletList: boolean;
  orderedList: boolean;
}

const TOOLBAR_HEIGHT_ESTIMATE = 40; // px — suficiente para decidir arriba/abajo antes de medir la toolbar en sí.

export function TextToolbar({ frameRef }: TextToolbarProps) {
  const { t } = useTranslation("canvas");
  const editingTextNodeId = useDocumentStore((s) => s.editingTextNodeId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const editor = useDocumentStore((s) => s.activeTiptapEditor);
  // Mismo criterio de auto-ocultado que `LocaleQuickAccess` (sitio
  // monolingüe = sin selector) — se consulta aquí también, y no solo dentro
  // de `LocaleQuickAccess`, únicamente para decidir si el separador visual
  // se muestra (el propio componente ya retorna `null` sin él).
  const i18n = useDocumentStore((s) => s.site.meta.i18n);
  const isMultilingual = !!i18n && i18n.locales.length > 1;

  const [box, setBox] = useState<Box | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editorState = useEditorState({
    editor: editor ?? null,
    selector: (ctx): EditorFormatState | null => {
      const e = ctx.editor;
      if (!e) return null;
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        strike: e.isActive("strike"),
        link: e.isActive("link"),
        heading1: e.isActive("heading", { level: 1 }),
        heading2: e.isActive("heading", { level: 2 }),
        heading3: e.isActive("heading", { level: 3 }),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
      };
    },
  });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!editingTextNodeId || !frame) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = frame.querySelector<HTMLElement>(`[data-node-id="${editingTextNodeId}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const nr = el.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const spaceAbove = nr.top - fr.top;
      const below = spaceAbove < TOOLBAR_HEIGHT_ESTIMATE;
      setBox({
        top: below ? nr.bottom - fr.top : nr.top - fr.top,
        left: nr.left - fr.left,
        below,
      });
    };
    measure();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(frame);
    const el = frame.querySelector<HTMLElement>(`[data-node-id="${editingTextNodeId}"]`);
    if (el) ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [editingTextNodeId, activeBreakpoint, frameRef]);

  if (!editingTextNodeId || !editor || !box) return null;

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    // No perder el foco del editor al clickear un botón de la toolbar.
    e.preventDefault();
    fn();
  };

  const btn = (
    active: boolean,
    label: string,
    onClick: () => void,
    content: React.ReactNode,
  ) => (
    <button
      type="button"
      className={["pbx-text-toolbar__btn", active ? "pbx-text-toolbar__btn--active" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={run(onClick)}
    >
      {content}
    </button>
  );

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    // eslint-disable-next-line no-alert -- editor placeholder simple; sin modal propio en este MVP.
    const url = window.prompt(t("textToolbar.linkPrompt"), previous ?? "https://");
    if (url === null) return; // cancelado
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url === "") chain.unsetLink().run();
    else chain.setLink({ href: url }).run();
  };

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t("textToolbar.ariaLabel")}
      data-text-toolbar
      className={[
        "pbx-text-toolbar",
        box.below ? "pbx-text-toolbar--below" : "pbx-text-toolbar--above",
      ].join(" ")}
      style={{ top: box.top, left: box.left }}
      // La toolbar vive fuera del nodo `text` (montada en Canvas junto al
      // frame): un click aquí no debe burbujear al `onClick` de deselección
      // del Canvas ni perder el foco del editor.
      onMouseDown={(e) => e.stopPropagation()}
    >
      {btn(!!editorState?.bold, t("textToolbar.bold"), () => editor.chain().focus().toggleBold().run(), (
        <strong>B</strong>
      ))}
      {btn(!!editorState?.italic, t("textToolbar.italic"), () => editor.chain().focus().toggleItalic().run(), (
        <em>I</em>
      ))}
      {btn(!!editorState?.strike, t("textToolbar.strike"), () => editor.chain().focus().toggleStrike().run(), (
        <s>S</s>
      ))}
      {btn(!!editorState?.link, t("textToolbar.link"), setLink, "🔗")}

      <span className="pbx-text-toolbar__sep" aria-hidden="true" />

      {btn(
        !!editorState?.heading1,
        t("textToolbar.heading1"),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        "H1",
      )}
      {btn(
        !!editorState?.heading2,
        t("textToolbar.heading2"),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        "H2",
      )}
      {btn(
        !!editorState?.heading3,
        t("textToolbar.heading3"),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        "H3",
      )}

      <span className="pbx-text-toolbar__sep" aria-hidden="true" />

      {btn(
        !!editorState?.bulletList,
        t("textToolbar.bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "•",
      )}
      {btn(
        !!editorState?.orderedList,
        t("textToolbar.orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        "1.",
      )}

      {/* Botón de idioma flotante (docs/12 §B, Fase 19.g/19.j): anclado a la
          derecha de la MISMA toolbar, separado visualmente con un separador
          — sigue dentro de `data-text-toolbar` (ver comentario del módulo),
          así que un click aquí no dispara "click fuera cierra edición".
          Solo si el sitio es multilingüe (mismo check que `LocaleQuickAccess`
          hace internamente para auto-ocultarse). */}
      {isMultilingual ? (
        <>
          <span className="pbx-text-toolbar__sep" aria-hidden="true" />
          <span className="pbx-text-toolbar__locale">
            <LocaleQuickAccess />
          </span>
        </>
      ) : null}
    </div>
  );
}
