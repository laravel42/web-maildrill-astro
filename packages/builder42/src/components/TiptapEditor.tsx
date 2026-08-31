/**
 * TiptapEditor — wrapper headless de Tiptap para edición rich text inline
 * (docs/12 §B.11, excepción documentada a P10). Reemplaza al `<textarea>`
 * plano que antes vivía en el Inspector: ahora la edición ocurre EN EL CANVAS,
 * sobre el propio bloque `text` (docs/03 §9, registry/components/Text.stub.tsx).
 *
 * **Por qué es una excepción a P10:** el resto del chrome del editor (selects,
 * tabs, modales, tooltips) se construye sobre `@josecortez1/c42-core` /
 * `c42-react`. El `RichTextEditor` de c42 es demasiado básico para esto
 * (`contentEditable` + `execCommand`, sin schema de documento ni extensiones)
 * — Tiptap (headless sobre ProseMirror) resuelve paste inteligente, marks,
 * nodos y una API de comandos real que necesita la toolbar flotante.
 *
 * **Contrato:**
 * - `content`: HTML string (idioma/traducción activa ya resuelta por el
 *   caller — igual que `resolvePropsForLocale`, este componente no sabe de
 *   idiomas).
 * - `onUpdate(html)`: se llama en cada cambio de contenido con
 *   `editor.getHTML()`. El caller decide cuándo "comitear" (blur, Escape) —
 *   este wrapper no debounce ni compara con el valor anterior.
 * - `onReady(editor)` / `onDestroy()`: exponen la instancia de Tiptap hacia
 *   afuera para que un componente hermano (la toolbar flotante) pueda leer su
 *   estado (`editor.isActive('bold')`) y ejecutar comandos
 *   (`editor.chain().focus().toggleBold().run()`) sin que este wrapper tenga
 *   que conocer la UI de la toolbar (mantiene la separación toolbar/editor).
 * - `autoFocus`: focus + selección al final del contenido al montar (se entra
 *   en modo edición con un click, conviene que el cursor aparezca de inmediato).
 *
 * **Storage (MVP, docs/12 §B.11):** se guarda HTML (`editor.getHTML()`), no el
 * JSON de Tiptap. El export a HTML estático (`exportToHtml.ts`) sigue leyendo
 * `props.content` como string plano — nunca importa Tiptap (P8 intacto).
 */

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { RICHTEXT_EXTENSIONS } from "@/builder/model/richtext";

export interface TiptapEditorProps {
  /** HTML inicial (idioma/traducción ya resuelta por el caller). */
  content: string;
  /** Se llama con `editor.getHTML()` en cada transacción que cambia el doc. */
  onUpdate: (html: string) => void;
  /** Instancia de Tiptap disponible para la toolbar flotante (docs/12 §B.11). */
  onReady?: (editor: Editor) => void;
  /** Se llama al desmontar el editor (limpieza de la referencia externa). */
  onDestroy?: () => void;
  /** Foco automático al montar (entra en modo edición con un click). */
  autoFocus?: boolean;
  className?: string;
}

export function TiptapEditor({
  content,
  onUpdate,
  onReady,
  onDestroy,
  autoFocus,
  className,
}: TiptapEditorProps) {
  // Snapshot del contenido inicial: Tiptap es el dueño del documento mientras
  // está montado (no se re-sincroniza con `content` en cada render — igual
  // que un <input> no-controlado; el caller lee el valor final en `onUpdate`
  // y desmonta el editor para "salir" de edición, docs/12 §B.11).
  const initialContent = useRef(content).current;

  const editor = useEditor({
    // Misma lista que usa `richtext.ts` (conversión server-safe) — evita que
    // editor y conversor entiendan schemas distintos (docs/13).
    extensions: RICHTEXT_EXTENSIONS,
    content: initialContent,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    return () => onDestroy?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <EditorContent editor={editor} className={className} />;
}
