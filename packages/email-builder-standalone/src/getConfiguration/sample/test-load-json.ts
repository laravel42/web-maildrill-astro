import { TEditorConfiguration } from '../../documents/editor/core';

/**
 * Simple test document for testing the JSON load functionality
 * This can be copied and pasted into the "Load JSON" dialog
 */
export const TEST_LOAD_JSON: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      backdropColor: '#e3f2fd',
      canvasColor: '#ffffff',
      textColor: '#1a1a1a',
      fontFamily: 'MODERN_SANS',
      linkGlobal: {
        linkColor: '#1976d2',
        underline: true,
      },
      childrenIds: ['container-1', 'container-2'],
    },
  },
  'container-1': {
    type: 'Container',
    data: {
      style: {
        backgroundColor: '#1976d2',
        padding: {
          top: 40,
          right: 20,
          bottom: 40,
          left: 20,
        },
      },
      props: {
        childrenIds: ['heading-1'],
      },
    },
  },
  'heading-1': {
    type: 'NotionText',
    data: {
      style: {
        color: '#ffffff',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
        },
      },
      props: {
        html: '<h1>¡Documento cargado exitosamente! 🎉</h1>',
      },
    },
  },
  'container-2': {
    type: 'Container',
    data: {
      style: {
        backgroundColor: '#ffffff',
        padding: {
          top: 30,
          right: 20,
          bottom: 30,
          left: 20,
        },
      },
      props: {
        childrenIds: ['text-1', 'button-1'],
      },
    },
  },
  'text-1': {
    type: 'NotionText',
    data: {
      props: {
        html: '<p>Este documento fue cargado usando el evento custom <code>email-builder:load-document</code>. Puedes editar este contenido y probar todas las funcionalidades del editor.</p>',
      },
      style: {
        fontSize: 16,
        padding: {
          top: 10,
          right: 10,
          bottom: 20,
          left: 10,
        },
      },
    },
  },
  'button-1': {
    type: 'Button',
    data: {
      style: {
        textAlign: 'center',
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
        },
      },
      props: {
        buttonBackgroundColor: '#1976d2',
        buttonTextColor: '#ffffff',
        text: '¡Funciona perfectamente!',
        fullWidth: false,
      },
    },
  },
};

// Export as JSON string for easy copy-paste
export const TEST_LOAD_JSON_STRING = JSON.stringify(TEST_LOAD_JSON, null, 2);
