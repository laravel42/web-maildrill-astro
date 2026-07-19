/**
 * URL sanitizer shared by block renderers (Button, Image, SocialMedia).
 * Pure string logic — Node-safe, lives in `@eb/email-builder` so blocks
 * don't import the editor app.
 */
export const getCleanURL = (url: string | undefined | null) => {
  if (!url) return '#';

  // Protocolos válidos que no necesitan modificación
  const validProtocols = ['http', 'mailto:', 'tel:', 'sms:', 'whatsapp:'];

  if (validProtocols.some((protocol) => url.startsWith(protocol))) return url;

  return `//${url}`;
};
