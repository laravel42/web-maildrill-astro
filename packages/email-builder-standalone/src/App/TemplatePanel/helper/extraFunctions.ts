import { RefObject } from 'react';

export const setStickyMenu = (
  element: RefObject<HTMLDivElement>,
  reference: RefObject<HTMLDivElement>,
  height?: number
) => {
  if (element.current && reference.current) {
    const anchorRect = reference.current.getBoundingClientRect();

    if (anchorRect.top <= 0) {
      element.current.style.position = 'fixed';
      reference.current.style.height = `${height ? height : element.current.offsetHeight}px`;
    } else {
      element.current.style.position = '';
      reference.current.style.height = '0';
    }
  }
};

/**
 * Genera un UUID v4 compatible con todos los navegadores
 *
 * Utiliza crypto.randomUUID() si está disponible para mayor seguridad,
 * de lo contrario usa Math.random() como respaldo
 *
 * @returns {string} UUID v4 válido
 */
export function generateUUID(): string {
  // Verificar si crypto.randomUUID está disponible (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Respaldo usando Math.random() para navegadores más antiguos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Genera un ID corto aleatorio (útil para keys de React)
 *
 * @param {number} length - Longitud del ID (por defecto 8)
 * @returns {string} ID aleatorio
 */
export function generateShortId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Genera un timestamp único combinado con un número aleatorio
 * Útil cuando necesitas un ID único pero no necesariamente un UUID
 *
 * @returns {string} ID único basado en timestamp
 */
export function generateTimestampId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Verifica si una cadena es un UUID válido
 *
 * @param {string} uuid - Cadena a verificar
 * @returns {boolean} true si es un UUID válido
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
