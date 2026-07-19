import { TEditorConfiguration } from '../../documents/editor/core';

/**
 * Documento de prueba para la funcionalidad de Gallery.
 *
 * Incluye múltiples bloques Image con distintas configuraciones
 * para verificar que el botón "Browse gallery" y el evento
 * `toggle-media-library` funcionan correctamente cuando
 * `galleryImages` está habilitado.
 *
 * Se carga únicamente en ambiente DEV desde main.tsx.
 */
const GALLERY_TEST: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      backdropColor: '#EAEAEA',
      canvasColor: '#FFFFFF',
      textColor: '#1A1A1A',
      fontFamily: 'MODERN_SANS',
      linkGlobal: {
        linkColor: '#4f46e5',
        underline: true,
      },
      childrenIds: [
        'gallery-heading',
        'gallery-img-1',
        'gallery-text-1',
        'gallery-img-2',
        'gallery-text-2',
        'gallery-img-3',
        'gallery-text-3',
        'gallery-divider',
        'gallery-img-placeholder',
        'gallery-footer',
      ],
    },
  },

  // Encabezado
  'gallery-heading': {
    type: 'NotionText',
    data: {
      style: {
        padding: { top: 24, bottom: 8, left: 24, right: 24 },
        textAlign: 'center',
        color: '#4f46e5',
      },

      props: {
        html: '<h2>Gallery Test Document</h2>',
      },
    },
  },

  // Imagen 1 — con URL real, tamaño fill
  'gallery-img-1': {
    type: 'Image',
    data: {
      style: {
        padding: { top: 16, bottom: 8, left: 24, right: 24 },
        textAlign: 'center',
      },
      props: {
        url: 'https://placehold.co/600x300/4f46e5/ffffff?text=Gallery+Image+1',
        alt: 'Gallery test image 1',
        size: 'fill',
        contentAlignment: 'middle',
      },
    },
  },

  'gallery-text-1': {
    type: 'NotionText',
    data: {
      props: {
        html: '<p>Imagen con tamaño <b>fill</b>. Selecciona este bloque y usa "Browse gallery" para reemplazar la imagen.</p>',
      },
      style: {
        padding: { top: 4, bottom: 16, left: 24, right: 24 },
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'center',
        color: '#666666',
      },
    },
  },

  // Imagen 2 — con escala al 60%
  'gallery-img-2': {
    type: 'Image',
    data: {
      style: {
        padding: { top: 16, bottom: 8, left: 24, right: 24 },
        textAlign: 'center',
      },
      props: {
        url: 'https://placehold.co/400x400/10b981/ffffff?text=Gallery+Image+2',
        alt: 'Gallery test image 2',
        size: 'scale',
        scale: 60,
        contentAlignment: 'middle',
      },
    },
  },

  'gallery-text-2': {
    type: 'NotionText',
    data: {
      props: {
        html: '<p>Imagen con <b>scale 60%</b>. Prueba cambiar la imagen desde la galería.</p>',
      },
      style: {
        padding: { top: 4, bottom: 16, left: 24, right: 24 },
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'center',
        color: '#666666',
      },
    },
  },

  // Imagen 3 — con link y border radius
  'gallery-img-3': {
    type: 'Image',
    data: {
      style: {
        padding: { top: 16, bottom: 8, left: 24, right: 24 },
        textAlign: 'center',
        shape: 'pill',
      },
      props: {
        url: 'https://placehold.co/300x300/f59e0b/ffffff?text=Gallery+3',
        alt: 'Gallery test image 3 with link',
        linkHref: 'https://example.com',
        contentAlignment: 'middle',
      },
    },
  },

  'gallery-text-3': {
    type: 'NotionText',
    data: {
      props: {
        html: '<p>Imagen con <b>shape pill</b> y link. Verifica que la galería funcione también con imágenes con link.</p>',
      },
      style: {
        padding: { top: 4, bottom: 16, left: 24, right: 24 },
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'center',
        color: '#666666',
      },
    },
  },

  // Divider
  'gallery-divider': {
    type: 'Divider',
    data: {
      style: {
        padding: { top: 16, bottom: 16, left: 24, right: 24 },
      },
      props: {
        lineColor: '#E0E0E0',
      },
    },
  },

  // Imagen placeholder — sin URL, para probar upload desde galería
  'gallery-img-placeholder': {
    type: 'Image',
    data: {
      style: {
        padding: { top: 16, bottom: 8, left: 24, right: 24 },
        textAlign: 'center',
      },
      props: {
        url: '',
        alt: 'Placeholder - selecciona una imagen desde la galería',
        contentAlignment: 'middle',
      },
    },
  },

  // Footer
  'gallery-footer': {
    type: 'NotionText',
    data: {
      props: {
        html: '<p style="text-align:center">⬆️ Imagen sin URL. Usa <b>Browse gallery</b> para asignar una imagen desde la galería.</p>',
      },
      style: {
        padding: { top: 4, bottom: 24, left: 24, right: 24 },
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'center',
        color: '#999999',
      },
    },
  },
};

export default GALLERY_TEST;
