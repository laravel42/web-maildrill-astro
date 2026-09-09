/**
 * Text — componente con edición inline en el canvas (docs/12 §B.11).
 *
 * `props.content` acepta HTML string (legacy) O JSON Tiptap (`TiptapDoc`,
 * docs/13) — `contentToHtml` (`model/richtext.ts`) normaliza ambos a HTML
 * antes de pintarlos, así que el resto de este componente nunca necesita
 * distinguir el formato. En modo estático se pinta con
 * `dangerouslySetInnerHTML` (igual que siempre, y siempre así en
 * `exportMode` — el export nunca importa el editor de Tiptap, P8; solo la
 * conversión pura y server-safe de `richtext.ts`). En el canvas, cuando el
 * nodo está seleccionado Y en modo edición (`editingTextNodeId ===
 * node.id`, activado por un segundo click via `NodeRenderer` +
 * `editableInline: true` abajo), se monta `TiptapEditor` en su lugar con
 * `contentEditable` real.
 *
 * **Storage (sin cambios en esta migración, docs/13 §4.5):** el commit
 * sigue guardando HTML string (`editor.getHTML()`) — la migración de
 * storage a JSON no es obligatoria y no ocurre automáticamente. Lo que sí
 * cambió es la LECTURA: si `props.content` (o una traducción) ya llegó como
 * `TiptapDoc` por cualquier vía (p. ej. una función de merge/traducción
 * futura que trabaje en JSON), este componente lo edita y lo exporta
 * igual de bien, convirtiéndolo a HTML de forma transparente.
 *
 * `editableInline: true` en la definición (declarativo, P4): `NodeRenderer`
 * no conoce el tipo `"text"`, solo consulta este flag para decidir si un
 * segundo click entra en edición y si debe desactivar el `draggable` del nodo.
 *
 * El commit del contenido editado usa `setProp` (la ÚNICA acción de escritura
 * de props, docs/12 §B.6) — respeta `editingLocale` sin acción nueva. Se
 * comitea en cada `onUpdate` de Tiptap (no solo al salir) para no perder
 * cambios si el usuario navega fuera abruptamente; salir de edición (blur,
 * Escape, click fuera) solo desmonta el editor.
 */

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type Ref } from "react";
import type { Editor } from "@tiptap/react";
import { TiptapEditor } from "@/components";
import { useDocumentStore } from "../../store/documentStore";
import { DEFAULT_BREAKPOINTS } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { contentToHtml, type RichTextContent } from "../../model/richtext";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

function TextRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  // `props.content` acepta HTML string legacy O JSON Tiptap (docs/13);
  // `contentToHtml` normaliza ambos a HTML — es la única función que conoce
  // la diferencia, así que el resto de este componente sigue trabajando con
  // HTML puro como siempre (P8 intacto: `contentToHtml` es server-safe, no
  // importa el editor interactivo de Tiptap).
  const rawContent = node.props.content as RichTextContent | undefined;
  const content = rawContent == null ? "" : contentToHtml(rawContent);

  // `exportMode` (P8): `renderNode` en `export/exportToHtml.ts` y
  // `dnd/ghost.tsx` invocan `def.render(ctx)` como función plana FUERA del
  // ciclo de render de React (construyen el árbol antes de pasarlo a
  // `renderToStaticMarkup`) — no es seguro usar hooks ahí (rompe las reglas
  // de hooks, error real detectado con `useDocumentStore`). Esta rama estática
  // no usa ningún hook, igual que el `TextRender` original.
  if (exportMode) {
    return (
      <div
        className={className}
        style={style}
        {...rootProps}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Canvas (siempre dentro del árbol de React real): delega a un componente
  // propio que sí puede usar hooks (suscripción a `editingTextNodeId`, etc.).
  return (
    <TextCanvasView
      node={node}
      content={content}
      className={className}
      style={style}
      rootRef={rootRef}
      rootProps={rootProps}
    />
  );
}

interface TextCanvasViewProps {
  node: RenderContext["node"];
  content: string;
  className: string | undefined;
  style: CSSProperties | undefined;
  rootRef: RenderContext["rootRef"];
  rootProps: RenderContext["rootProps"];
}

function TextCanvasView({ node, content, className, style, rootRef, rootProps }: TextCanvasViewProps) {
  const editingTextNodeId = useDocumentStore((s) => s.editingTextNodeId);
  const stopEditingText = useDocumentStore((s) => s.stopEditingText);
  const setProp = useDocumentStore((s) => s.setProp);
  const setActiveTiptapEditor = useDocumentStore((s) => s.setActiveTiptapEditor);

  const isEditing = editingTextNodeId === node.id;

  if (isEditing) {
    return (
      <TextEditingView
        rootRef={rootRef}
        className={className}
        style={style}
        content={content}
        nodeId={node.id}
        setProp={setProp}
        stopEditingText={stopEditingText}
        setActiveTiptapEditor={setActiveTiptapEditor}
      />
    );
  }

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={className}
      style={style}
      {...rootProps}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

interface TextEditingViewProps {
  rootRef: RenderContext["rootRef"];
  className: string | undefined;
  style: CSSProperties | undefined;
  content: string;
  nodeId: string;
  setProp: (nodeId: string, key: string, value: unknown) => void;
  stopEditingText: () => void;
  setActiveTiptapEditor: (editor: Editor | null) => void;
}

/**
 * Vista de edición: Tiptap montado dentro del mismo elemento raíz (sin
 * wrapper, P3). Clicks internos no deben burbujear al `onClick` de selección
 * del `NodeRenderer` padre (`stopPropagation`) ni desmontar el editor.
 * Blur / Escape / click fuera comitean y salen de edición. La instancia se
 * publica en el store (`setActiveTiptapEditor`) para que `TextToolbar`
 * (montada en `Canvas.tsx`, docs/12 §B.11) pueda leer su estado y ejecutar
 * comandos sin acoplarse directamente a este componente.
 */
function TextEditingView({
  rootRef,
  className,
  style,
  content,
  nodeId,
  setProp,
  stopEditingText,
  setActiveTiptapEditor,
}: TextEditingViewProps) {
  const latestHtml = useRef(content);

  const commitAndExit = () => {
    setProp(nodeId, "content", latestHtml.current);
    stopEditingText();
  };

  // Click fuera del bloque en edición: comitea y sale (igual que un blur).
  // Se registra en document porque el click del Canvas (deseleccionar) vive
  // fuera de este nodo y correría antes de que perdamos el foco de forma
  // confiable en todos los navegadores.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // La toolbar flotante (docs/12 §B.11) vive FUERA de este nodo (montada
      // en Canvas.tsx, no como hijo del bloque `text`) — un click en sus
      // botones no debe contarse como "click fuera" y cerrar la edición.
      const insideToolbar = !!(target as Element).closest?.("[data-text-toolbar]");
      if (containerRef.current && !containerRef.current.contains(target) && !insideToolbar) {
        commitAndExit();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      commitAndExit();
    }
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (typeof rootRef === "function") rootRef(el);
        else if (rootRef && "current" in rootRef) {
          (rootRef as { current: HTMLElement | null }).current = el;
        }
      }}
      className={[className, "pbx-node--editing-text"].filter(Boolean).join(" ")}
      style={style}
      data-node-id={nodeId}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <TiptapEditor
        content={content}
        autoFocus
        onUpdate={(html) => {
          latestHtml.current = html;
          setProp(nodeId, "content", html);
        }}
        onReady={setActiveTiptapEditor}
        onDestroy={() => setActiveTiptapEditor(null)}
      />
    </div>
  );
}

export const textDefinition: ComponentDefinition = {
  type: "text",
  label: "Texto",
  category: "content",
  acceptsChildren: false,
  editableInline: true,
  disallowsClickAction: true,
  defaultProps: { content: "Sample text" },
  defaultStyle: { base: { appearance: { color: { token: "colors.text" } } } },
  propsSchema: {
    fields: [
      { key: "content", label: "Contenido", control: "richtext", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: TextRender,
};
