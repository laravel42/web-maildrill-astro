import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { BackgroundColor } from './extensions/BackgroundColor';

export function getTiptapExtensions(placeholderText: string): Extensions {
  return [
    StarterKit.configure({
      // Configuración básica para Fase 2
      heading: {
        levels: [1, 2, 3],
        HTMLAttributes: {
          style: null,
        },
      },
      trailingNode: false,
      // Deshabilitar extensiones no compatibles con emails
      codeBlock: false,
      code: false,
      // Preservar párrafos vacíos (saltos de línea en blanco)
      paragraph: {
        HTMLAttributes: {
          style: null,
        },
      },
      horizontalRule: {
        HTMLAttributes: {
          style: null,
        },
      },
      bulletList: {
        HTMLAttributes: {
          style: null,
        },
      },
      orderedList: {
        HTMLAttributes: {
          style: null,
        },
      },
      listItem: {
        HTMLAttributes: {
          style: null,
        },
      },
      blockquote: {
        HTMLAttributes: {
          style: null,
        },
      },
      // Link sin estilos inline por defecto - los estilos se aplican vía linkGlobal (incluido en StarterKit v3)
      link: {
        openOnClick: false,
        // Evita la navegación nativa del <a> en el editor; permite seleccionar/editar el mark.
        enableClickSelection: true,
        HTMLAttributes: {
          // No aplicar estilos inline por defecto; se aplican vía linkGlobal en el helper
        },
      },
    }),
    TextStyle,
    Color.configure({
      types: ['textStyle'],
    }),
    // BackgroundColor personalizado para compatibilidad con email (usa span en lugar de mark)
    BackgroundColor.configure({
      types: ['textStyle'],
    }),
    // TextAlign para alineación de texto
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    // Placeholder con texto dinámico
    Placeholder.configure({
      placeholder: ({ node: _node }) => {
        return placeholderText;
      },
      showOnlyWhenEditable: true,
    }),
  ];
}
