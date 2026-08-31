/**
 * Catálogo de códigos de idioma ISO 639-1 (2 letras) para el picker con
 * búsqueda de `I18nSettings.tsx` (docs/17.c). Reemplaza el `<input>` de texto
 * libre validado solo por regex (`/^[a-z]{2}$/`), que aceptaba cualquier
 * combinación de 2 letras — incluida un typo real como código válido
 * (`"xx"`, `"zz"`, etc. pasaban la validación sin ser idiomas reales).
 *
 * Es SOLO la lista de códigos (dato estático, ~180 entradas, ~1 KB) — el
 * NOMBRE visible de cada idioma se resuelve en runtime vía
 * `Intl.DisplayNames` (API nativa del navegador, mismo patrón ya usado en
 * `registry/components/LanguageNav.tsx`), así que este módulo no necesita
 * traer ninguna librería de datos de idiomas ni generarse por codegen (a
 * diferencia de los catálogos de iconos/fuentes, docs/34 — esos sí son
 * miles de entradas con datos propios).
 */

/** Códigos ISO 639-1 (2 letras) de los idiomas más comunes, orden alfabético por código. */
export const ISO_639_1_CODES: readonly string[] = [
  "aa", "ab", "ae", "af", "ak", "am", "an", "ar", "as", "av",
  "ay", "az", "ba", "be", "bg", "bh", "bi", "bm", "bn", "bo",
  "br", "bs", "ca", "ce", "ch", "co", "cr", "cs", "cu", "cv",
  "cy", "da", "de", "dv", "dz", "ee", "el", "en", "eo", "es",
  "et", "eu", "fa", "ff", "fi", "fj", "fo", "fr", "fy", "ga",
  "gd", "gl", "gn", "gu", "gv", "ha", "he", "hi", "ho", "hr",
  "ht", "hu", "hy", "hz", "ia", "id", "ie", "ig", "ii", "ik",
  "io", "is", "it", "iu", "ja", "jv", "ka", "kg", "ki", "kj",
  "kk", "kl", "km", "kn", "ko", "kr", "ks", "ku", "kv", "kw",
  "ky", "la", "lb", "lg", "li", "ln", "lo", "lt", "lu", "lv",
  "mg", "mh", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my",
  "na", "nb", "nd", "ne", "ng", "nl", "nn", "no", "nr", "nv",
  "ny", "oc", "oj", "om", "or", "os", "pa", "pi", "pl", "ps",
  "pt", "qu", "rm", "rn", "ro", "ru", "rw", "sa", "sc", "sd",
  "se", "sg", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr",
  "ss", "st", "su", "sv", "sw", "ta", "te", "tg", "th", "ti",
  "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty", "ug",
  "uk", "ur", "uz", "ve", "vi", "vo", "wa", "wo", "xh", "yi",
  "yo", "za", "zh", "zu",
];

/** Idioma resuelto: código + nombre visible en el idioma de la UI del editor. */
export interface LocaleOption {
  code: string;
  /** Nombre del idioma en `displayLocale` (ej. "Español" si `displayLocale` es "es"). */
  name: string;
}

/**
 * Resuelve el nombre visible de cada código del catálogo en `displayLocale`
 * vía `Intl.DisplayNames`. Si la API no está disponible (entorno sin
 * soporte) o un código puntual no resuelve nombre, cae al código en
 * mayúsculas — nunca lanza ni deja una entrada sin label.
 */
export function getLocaleOptions(displayLocale: string): LocaleOption[] {
  let dn: Intl.DisplayNames | undefined;
  try {
    dn = new Intl.DisplayNames([displayLocale], { type: "language" });
  } catch {
    dn = undefined;
  }
  return ISO_639_1_CODES.map((code) => {
    let name = code.toUpperCase();
    try {
      const resolved = dn?.of(code);
      if (resolved) name = resolved.charAt(0).toUpperCase() + resolved.slice(1);
    } catch {
      // se queda con el fallback (código en mayúsculas)
    }
    return { code, name };
  });
}

/** `true` si `code` (normalizado a minúsculas) es un código ISO 639-1 reconocido del catálogo. */
export function isKnownLocaleCode(code: string): boolean {
  return ISO_639_1_CODES.includes(code.trim().toLowerCase());
}
