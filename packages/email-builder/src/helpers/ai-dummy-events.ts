/**
 * AI Dummy Events for Local Testing
 *
 * Este archivo simula las respuestas de una API de IA para testing local.
 * Los eventos dummy procesan el texto de forma simple sin llamar a ninguna API real.
 */

import { initImageUploadSimulator } from './image-upload-simulator';

/// <reference lib="dom" />

export type AIAction =
  | 'rewrite'
  | 'grammar_check'
  | 'continue_writing'
  | 'shorter'
  | 'descriptive'
  | 'detailed'
  | 'friendly'
  | 'professional';

interface AIFeatureRequest {
  text: string;
  content: string;
  action: AIAction;
  replaceSelection?: boolean;
  selectionFrom?: number;
  selectionTo?: number;
}

interface AIFeatureResponse {
  processedContent: string;
  replaceSelection?: boolean;
  selectionFrom?: number;
  selectionTo?: number;
}

/**
 * Simula el procesamiento de texto por IA
 */
const processDummyAI = (text: string, content: string, action: AIAction): string => {
  let processedText: string;

  switch (action) {
    case 'rewrite':
      // Simular reescritura: agregar sinónimos básicos
      processedText = text
        .replace(/\bgood\b/gi, 'excellent')
        .replace(/\bbad\b/gi, 'poor')
        .replace(/\bnice\b/gi, 'pleasant')
        .replace(/\bvery\b/gi, 'extremely')
        .replace(/\bbueno\b/gi, 'excelente')
        .replace(/\bmalo\b/gi, 'deficiente');
      processedText = `<p><strong>[AI: Rewrite]</strong> ${processedText}</p>`;
      break;

    case 'grammar_check':
      // Simular corrección gramatical: capitalizar primera letra
      processedText = text.charAt(0).toUpperCase() + text.slice(1);
      // Asegurar punto final
      if (!processedText.match(/[.!?]$/)) {
        processedText += '.';
      }
      processedText = `<p><strong>[AI: Grammar Check]</strong> ${processedText}</p>`;
      break;

    case 'continue_writing':
      // Simular continuación: agregar texto adicional
      processedText = `<p>${text}</p><p><em>[AI: Continue Writing] Además, es importante considerar que este tema tiene múltiples perspectivas y aspectos relevantes que vale la pena explorar en mayor profundidad.</em></p>`;
      break;

    case 'shorter': {
      // Simular acortamiento: tomar primeras 30 palabras
      const words = text.split(' ');
      processedText = words.slice(0, Math.min(30, words.length)).join(' ');
      if (words.length > 30) {
        processedText += '...';
      }
      processedText = `<p><strong>[AI: Shorter]</strong> ${processedText}</p>`;
      break;
    }

    case 'descriptive':
      // Simular descripción: agregar adjetivos
      processedText = text
        .replace(/\b(the|a|an)\s+(\w+)\b/gi, '$1 detailed $2')
        .replace(/\b(is|are|was|were)\s+(\w+)\b/gi, '$1 remarkably $2');
      processedText = `<p><strong>[AI: Descriptive]</strong> ${processedText}</p>`;
      break;

    case 'detailed':
      // Simular expansión detallada: agregar texto adicional
      processedText = `<p><strong>[AI: Detailed]</strong> ${text}</p><p><em>Para profundizar en este punto, es fundamental analizar los diferentes aspectos que lo componen. Cada elemento juega un rol crucial en el contexto general, y su comprensión permite una visión más completa del tema.</em></p>`;
      break;

    case 'friendly':
      // Simular tono amigable: agregar emojis y lenguaje casual
      processedText = `<p><strong>[AI: Friendly]</strong> 😊 ${text} ✨</p><p><em>¡Espero que esto te sea útil!</em> 👍</p>`;
      break;

    case 'professional':
      // Simular tono profesional: reemplazar contracciones y lenguaje informal
      processedText = text
        .replace(/\bdon't\b/gi, 'do not')
        .replace(/\bcan't\b/gi, 'cannot')
        .replace(/\bwon't\b/gi, 'will not')
        .replace(/\bI'm\b/gi, 'I am')
        .replace(/\byou're\b/gi, 'you are')
        .replace(/\bhey\b/gi, 'Hello')
        .replace(/\byeah\b/gi, 'yes')
        .replace(/\bnope\b/gi, 'no');
      processedText = `<p><strong>[AI: Professional]</strong> ${processedText}</p>`;
      break;

    default:
      processedText = `<p><strong>[AI: Unknown]</strong> ${text}</p>`;
  }

  // Retornar directamente el HTML procesado sin intentar preservar estructura
  // Tiptap maneja su propia estructura interna
  return processedText;
};

/**
 * Inicializa los event listeners dummy para testing local
 */
export const initDummyAIEvents = () => {
  // Listener para solicitudes de IA
  const handleAIRequest = async (event: Event) => {
    const customEvent = event as CustomEvent<AIFeatureRequest>;
    const { text, content, action, replaceSelection, selectionFrom, selectionTo } = customEvent.detail;
    // Simular delay de API
    const delay = Math.random() * 1000 + 500;

    setTimeout(() => {
      // Procesar el texto
      const processedContent = processDummyAI(text, content, action);

      // Disparar evento de respuesta con información de selección
      const response: AIFeatureResponse = {
        processedContent,
        replaceSelection,
        selectionFrom,
        selectionTo,
      };

      const responseEvent = new CustomEvent('text-ai-processed', {
        detail: response,
      });
      window.dispatchEvent(responseEvent);
    }, delay);
  };

  // Registrar listener
  window.addEventListener('ai-request', handleAIRequest);

  // Inicializar simulador de upload/generación de imágenes
  const cleanupImageSimulator = initImageUploadSimulator();

  // Retornar función de cleanup
  return () => {
    window.removeEventListener('ai-request', handleAIRequest);
    cleanupImageSimulator();
  };
};

/**
 * Hook para usar en componentes React
 */
export const useDummyAIEvents = () => {
  if (typeof window === 'undefined') return;

  const cleanup = initDummyAIEvents();

  // Cleanup al desmontar
  return cleanup;
};
