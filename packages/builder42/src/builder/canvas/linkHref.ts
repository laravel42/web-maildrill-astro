/**
 * linkHref.ts — validación/normalización PURA del valor que el popover de
 * enlace de `TextToolbar.tsx` va a mandar a `editor.chain()...setLink(...)`
 * (D-F21.4).
 *
 * Por qué este módulo vive SOLO, sin importar nada (ni de React, ni de
 * Tiptap, ni de otro archivo del propio paquete): es la ÚNICA forma de que
 * esta lógica se pueda testear aquí. `vitest.config` de este paquete corre
 * con `environment: "node"`, sin jsdom y sin `@testing-library/react` (ver
 * el comentario largo en `tests/tour-anchors-coverage.test.ts`) — un
 * componente de React no se puede montar en un test. Convertir "¿esta URL
 * se puede aplicar, y si no, por qué?" en una función total sin
 * dependencias es lo que permite escribir `tests/textToolbarLink.test.ts`
 * sin jsdom.
 *
 * Este módulo NO reemplaza el guard que ya trae `@tiptap/extension-link`
 * (`isAllowedUri`, que ya descarta `javascript:` a nivel de mark — verificado
 * en `node_modules/@tiptap/extension-link`); lo que aporta es la explicación
 * que `window.prompt` nunca dio (D-F21.4: "refused with a visible, localised
 * message"), y una normalización de conveniencia (dominio sin esquema →
 * `https://`) que Tiptap no hace por sí solo.
 */

/** Resultado total: nunca lanza, nunca devuelve `undefined`. */
export type NormalizeLinkHrefResult =
  | { ok: true; href: string }
  | { ok: false; reason: "empty" | "unsupported" };

/** Esquemas aceptados tal cual, sin reescritura (D-F21.4). */
const ALLOWED_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

/**
 * Reconoce un prefijo `esquema:` en minúsculas al inicio del string, sin usar
 * `new URL(...)` (que exige un esquema http(s) o falla en Node para
 * `mailto:`/`tel:` sin más contexto, y trata `example.com` como ruta
 * relativa en vez de "dominio sin esquema" — no distingue los dos casos que
 * D-F21.4 sí necesita distinguir).
 */
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** Dominio "pelado" simplón: `algo.algo` (con o sin subdominios/puerto/ruta
 * detrás), sin espacios y sin esquema — lo suficiente para decidir si
 * antepone `https://` en vez de rechazarlo (D-F21.4: "a bare domain typed
 * without a scheme … should be normalised to https:// rather than
 * rejected"). No es una validación de RFC de dominios; es el criterio
 * mínimo para no confundir "example.com" con basura.
 */
const BARE_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[:/?#].*)?$/i;

/**
 * Normaliza/valida el valor tecleado en el campo del popover. Es total:
 * para cualquier `string` de entrada devuelve un resultado, nunca lanza.
 *
 * Reglas (D-F21.4):
 * - vacío (tras recortar espacios) → `{ ok: false, reason: "empty" }`, la
 *   llamada de "quitar el enlace" en `TextToolbar.tsx` decide qué hacer con
 *   eso (no es un error, pero tampoco es una URL a aplicar).
 * - `http:`, `https:`, `mailto:`, `tel:` → aceptado tal cual (recortado).
 * - relativo al sitio (`/...`) o fragmento (`#...`) → aceptado tal cual.
 * - dominio pelado sin esquema (`example.com`, `www.example.com/x`) →
 *   normalizado antes con `https://`.
 * - cualquier otro esquema (`javascript:`, `ftp:`, uno inventado) o
 *   cualquier otra cosa que no matchee ninguna regla anterior →
 *   `{ ok: false, reason: "unsupported" }`.
 */
export function normalizeLinkHref(input: string): NormalizeLinkHrefResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return { ok: true, href: trimmed };
  }

  const schemeMatch = SCHEME_RE.exec(trimmed);
  if (schemeMatch && schemeMatch[1]) {
    const scheme = schemeMatch[1].toLowerCase() + ":";
    if (ALLOWED_SCHEMES.includes(scheme)) {
      return { ok: true, href: trimmed };
    }
    return { ok: false, reason: "unsupported" };
  }

  // Sin esquema y sin ser relativo/fragmento: solo se acepta si parece un
  // dominio pelado, y en ese caso se le antepone `https://` (D-F21.4).
  if (BARE_DOMAIN_RE.test(trimmed)) {
    return { ok: true, href: `https://${trimmed}` };
  }

  return { ok: false, reason: "unsupported" };
}
