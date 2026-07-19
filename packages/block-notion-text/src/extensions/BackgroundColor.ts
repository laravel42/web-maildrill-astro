import '@tiptap/extension-text-style';

import { Extension } from '@tiptap/core';

export type BackgroundColorOptions = {
  types: string[];
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    backgroundColor: {
      /**
       * Set the background color
       */
      setBackgroundColor: (color: string) => ReturnType;
      /**
       * Unset the background color
       */
      unsetBackgroundColor: () => ReturnType;
    };
  }
}

/**
 * Extensión personalizada para color de fondo compatible con clientes de email.
 * Usa <span> con style="background-color: X" en lugar de <mark> para máxima compatibilidad.
 */
export const BackgroundColor = Extension.create<BackgroundColorOptions>({
  name: 'backgroundColor',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor?.replace(/['"]+/g, '') || null,
            renderHTML: (attributes) => {
              if (!attributes.backgroundColor) {
                return {};
              }

              return {
                style: `background-color: ${attributes.backgroundColor}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBackgroundColor:
        (color: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { backgroundColor: color }).run();
        },
      unsetBackgroundColor:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { backgroundColor: null }).run();
        },
    };
  },
});
