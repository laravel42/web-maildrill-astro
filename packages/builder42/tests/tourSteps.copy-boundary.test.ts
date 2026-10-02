/**
 * tourSteps.copy-boundary.test.ts — verifica el boundary de exportabilidad §0.6 del
 * plan: el copy del tour de Builder42 describe SOLO el editor, sin mencionar
 * `/dashboard/*`, "Maildrill", campañas ni suscriptores — porque este copy viajará
 * literalmente el día en que `packages/builder42` se extraiga como proyecto
 * independiente para una landing demo (§0 del plan).
 *
 * Grep automatizado sobre los 3 catálogos `tour.json` (en/es/it): ningún valor de
 * string puede contener, case-insensitive, "dashboard", "maildrill", "campaign"/
 * "campaña"/"campagna", "subscriber"/"suscriptor"/"iscritto" (formas EN/ES/IT del
 * mismo concepto prohibido), ni la ruta literal "/dashboard".
 */
import { describe, expect, it } from "vitest";

import enTour from "../src/i18n/locales/en/tour.json";
import esTour from "../src/i18n/locales/es/tour.json";
import itTour from "../src/i18n/locales/it/tour.json";

type Json = Record<string, unknown>;

/** Devuelve [{path, value}] para cada hoja string del catálogo. */
function collectLeafEntries(node: unknown, prefix = ""): { path: string; value: string }[] {
  if (typeof node === "string") return [{ path: prefix, value: node }];
  if (node === null || typeof node !== "object") return [];
  const entries: { path: string; value: string }[] = [];
  for (const [key, value] of Object.entries(node as Json)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    entries.push(...collectLeafEntries(value, nextPrefix));
  }
  return entries;
}

const CATALOGS: Record<string, Json> = {
  en: enTour,
  es: esTour,
  it: itTour,
};

/**
 * Términos prohibidos (§0.6): superficies o dominio de Maildrill fuera del propio
 * editor. Cubre las variantes EN/ES/IT del mismo concepto para que el grep sea
 * efectivo sin importar en qué idioma se cuele el texto por error.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /dashboard/i,
  /maildrill/i,
  /\bcampaign\b/i,
  /\bcampaña/i,
  /\bcampagna/i,
  /\bsubscriber/i,
  /\bsuscriptor/i,
  /\biscritt[oi]/i,
  /\bworkspace\b/i,
  /\btu\s+cuenta\b/i,
  /\byour\s+account\b/i,
];

describe("builder42 tour copy — boundary de exportabilidad (§0.6)", () => {
  it.each(Object.keys(CATALOGS))("%s: ningún string de copy menciona una superficie fuera del editor", (locale) => {
    const catalog = CATALOGS[locale]!;
    const entries = collectLeafEntries(catalog);
    const offenders: string[] = [];
    for (const { path, value } of entries) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(value)) {
          offenders.push(`${locale}:${path} matches ${pattern} → "${value}"`);
        }
      }
    }
    expect(offenders, `strings que violan §0.6:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("pbx.pages.breadcrumb transmite el concepto de landing multipágina en los 3 idiomas", () => {
    // §3.2 / entrega F3b: el copy de este paso debe transmitir que una landing es
    // un sitio de varias páginas — se comprueba que mencione "página(s)"/"page(s)"/
    // "pagina/e" en título o descripción, sin exigir una frase exacta.
    const multiPageHints: Record<string, RegExp> = {
      en: /pages?/i,
      es: /p[aá]ginas?/i,
      it: /pagin[ae]/i,
    };
    for (const [locale, hint] of Object.entries(multiPageHints)) {
      const catalog = CATALOGS[locale]!;
      const step = (catalog as { steps?: { pagesBreadcrumb?: { title?: string; description?: string } } })
        .steps?.pagesBreadcrumb;
      expect(step, `${locale} sin steps.pagesBreadcrumb`).toBeDefined();
      const combined = `${step?.title ?? ""} ${step?.description ?? ""}`;
      expect(hint.test(combined), `${locale}: "${combined}" no menciona páginas`).toBe(true);
    }
  });
});
