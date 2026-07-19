/**
 * Image Upload & AI Generation Simulator
 *
 * Simula los handlers externos que normalmente provee el servidor/API:
 * - Subida de archivos (email-builder-upload-image → email-builder-upload-image-receive)
 * - Generación AI (request-ai-image → generated-image)
 * - Almacenamiento AI (store-ai-image → email-builder-upload-image-receive)
 */

/// <reference lib="dom" />

interface SimulatorConfig {
  /** Delay en ms para simular subida de archivo. Default: 1500 */
  uploadDelayMs?: number;
  /** Delay en ms para simular generación AI. Default: 3000 */
  aiGenerationDelayMs?: number;
  /** Probabilidad de fallo (0-1). Default: 0 */
  failRate?: number;
}

interface UploadImageDetail {
  images: string[]; // base64 strings
  id: string;
}

// Imágenes placeholder para generación AI (picsum.photos con seeds fijos)
const AI_PLACEHOLDER_IMAGES = [
  'https://picsum.photos/seed/ai-gen-1/800/600',
  'https://picsum.photos/seed/ai-gen-2/800/600',
  'https://picsum.photos/seed/ai-gen-3/800/600',
  'https://picsum.photos/seed/ai-gen-4/800/600',
  'https://picsum.photos/seed/ai-gen-5/800/600',
];

/**
 * Convierte un string base64 (data URL) a un blob URL local.
 * Esto simula lo que haría un servidor: recibir el archivo y devolver una URL accesible.
 */
const base64ToBlobUrl = (base64: string): string => {
  try {
    const [header, data] = base64.split(',');
    const mimeMatch = header.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    // Si falla la conversión, devolver la misma base64 como fallback
    return base64;
  }
};

const shouldFail = (failRate: number): boolean => Math.random() < failRate;

export const initImageUploadSimulator = (config: SimulatorConfig = {}) => {
  const { uploadDelayMs = 1500, aiGenerationDelayMs = 3000, failRate = 0 } = config;

  console.log(
    '[ImageSimulator] Inicializado — upload:',
    uploadDelayMs,
    'ms, AI:',
    aiGenerationDelayMs,
    'ms, failRate:',
    failRate
  );

  /**
   * Handler: Subida de archivo
   * Escucha: email-builder-upload-image
   * Responde: email-builder-upload-image-receive
   */
  const handleFileUpload = (event: Event) => {
    const { detail } = event as CustomEvent<UploadImageDetail>;
    const { images, id } = detail;

    console.log(`[ImageSimulator] Upload recibido — blockId: ${id}, archivos: ${images.length}`);

    setTimeout(() => {
      if (shouldFail(failRate)) {
        console.warn('[ImageSimulator] Upload simuló fallo');
        // Desactivar el estado de uploading para que no quede colgado
        window.dispatchEvent(
          new CustomEvent('email-builder-toggle-upload-file', {
            detail: { uploading: false, id },
          })
        );
        return;
      }

      // Tomar la primera imagen y convertirla a blob URL
      const url = images[0]
        ? base64ToBlobUrl(images[0])
        : 'https://placehold.co/600x400/EEE/31343C?text=Upload+Simulado';

      console.log(`[ImageSimulator] Upload completado — blockId: ${id}, url: ${url.substring(0, 60)}...`);

      window.dispatchEvent(
        new CustomEvent('email-builder-upload-image-receive', {
          detail: { id, url, data: null },
        })
      );
    }, uploadDelayMs);
  };

  /**
   * Handler: Generación AI
   * Escucha: request-ai-image
   * Responde: generated-image
   */
  const handleAIGeneration = (event: Event) => {
    const { detail: prompt } = event as CustomEvent<string>;

    console.log(`[ImageSimulator] AI generation solicitada — prompt: "${prompt?.substring(0, 50)}..."`);

    setTimeout(() => {
      if (shouldFail(failRate)) {
        console.warn('[ImageSimulator] AI generation simuló fallo');
        window.dispatchEvent(
          new CustomEvent('generated-image', {
            detail: {
              url: null,
              success: false,
              error: { code: 500, message: 'Simulated AI generation failure' },
            },
          })
        );
        return;
      }

      // Seleccionar imagen placeholder aleatoria
      const randomIndex = Math.floor(Math.random() * AI_PLACEHOLDER_IMAGES.length);
      const url = AI_PLACEHOLDER_IMAGES[randomIndex];

      console.log(`[ImageSimulator] AI generation completada — url: ${url}`);

      window.dispatchEvent(
        new CustomEvent('generated-image', {
          detail: { url, success: true },
        })
      );
    }, aiGenerationDelayMs);
  };

  /**
   * Handler: Almacenamiento de imagen AI
   * Escucha: store-ai-image
   * Responde: email-builder-upload-image-receive
   *
   * Este es el paso crítico que faltaba: cuando el usuario hace "Insert Image"
   * en el diálogo AI, se despacha store-ai-image con la URL.
   * El sistema externo debe almacenarla y responder para que se inserte en el bloque.
   */
  const handleAIStore = (event: Event) => {
    const { detail: imageUrl } = event as CustomEvent<string>;

    console.log(`[ImageSimulator] AI store solicitado — url: ${imageUrl?.substring(0, 60)}...`);

    // Para store, usamos la URL directamente (ya fue generada)
    // En producción, el servidor la almacenaría en S3/CDN y devolvería URL permanente
    setTimeout(() => {
      // Necesitamos el blockId del bloque seleccionado actualmente
      // Despachamos email-builder-set-image que ImageInput ya escucha
      window.dispatchEvent(
        new CustomEvent('email-builder-set-image', {
          detail: imageUrl,
        })
      );

      console.log(`[ImageSimulator] AI store completado — imagen insertada via email-builder-set-image`);
    }, 500);
  };

  // Registrar listeners
  window.addEventListener('email-builder-upload-image', handleFileUpload);
  window.addEventListener('request-ai-image', handleAIGeneration);
  window.addEventListener('store-ai-image', handleAIStore);

  // Cleanup
  return () => {
    window.removeEventListener('email-builder-upload-image', handleFileUpload);
    window.removeEventListener('request-ai-image', handleAIGeneration);
    window.removeEventListener('store-ai-image', handleAIStore);
  };
};
