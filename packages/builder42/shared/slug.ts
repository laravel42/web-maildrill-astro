/**
 * Slugificación segura de un `siteId` a un subdominio DNS-safe (docs/33 §7.0.3,
 * docs/36 §4 F1.1).
 *
 * Función pura, sin dependencias de disco/red — se testea sin mocks. Vive en
 * `shared/` porque el cliente la necesita para validar en vivo el campo de
 * subdominio del `PublishPanel` con EXACTAMENTE las mismas reglas que el
 * servidor (docs/36 B3), sin round-trip.
 */

/** Longitud máxima de una etiqueta DNS (RFC 1035). */
const MAX_LABEL_LENGTH = 63;

/**
 * Convierte un `siteId` arbitrario en un subdominio válido: minúsculas, `[a-z0-9-]`,
 * sin guiones al inicio/final, máximo 63 caracteres.
 *
 * Devuelve `null` si el resultado queda vacío (el input no tenía ningún caracter
 * alfanumérico usable) — el caller debe rechazar con 422 en ese caso.
 */
export function slugifySiteId(siteId: string): string | null {
  const slug = siteId
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos (á → a)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LABEL_LENGTH)
    .replace(/-+$/g, ""); // el slice pudo dejar un guion colgando al final

  return slug.length > 0 ? slug : null;
}

/**
 * Verifica si un string es un subdominio DNS-safe válido (ya slugificado).
 * Usado para validar `target.domain` cuando el caller provee un slug explícito.
 */
export function isValidSubdomain(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LABEL_LENGTH) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value);
}
