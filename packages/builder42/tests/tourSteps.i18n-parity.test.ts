/**
 * tourSteps.i18n-parity.test.ts — paridad del namespace i18n `tour` entre los tres
 * idiomas de builder42 (F3b, docs/product-tour-driverjs-plan.md §4).
 *
 * Sigue el mismo patrón que `packages/email-builder-standalone/tests/tourSteps.i18n-parity.test.ts`
 * (F3a): verifica que toda clave presente en `en/tour.json` existe también en
 * `es/tour.json` e `it/tour.json` (y viceversa — sin claves huérfanas), incluyendo
 * tanto el copy de cada paso (`steps.<id>.title` / `.description`) como los textos
 * de botones (`labels.nextBtnText`, `prevBtnText`, `doneBtnText`, `progressText`).
 */
import { describe, expect, it } from "vitest";

import enTour from "../src/i18n/locales/en/tour.json";
import esTour from "../src/i18n/locales/es/tour.json";
import itTour from "../src/i18n/locales/it/tour.json";
import { BUILDER42_TOUR_ANCHORS } from "../src/app/tour/tourAnchors";

type Json = Record<string, unknown>;

/** Devuelve todas las rutas "a.b.c" hasta valores string, recorriendo objetos anidados. */
function collectLeafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  if (node === null || typeof node !== "object") return [];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(node as Json)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    paths.push(...collectLeafPaths(value, nextPrefix));
  }
  return paths;
}

const CATALOGS: Record<string, Json> = {
  en: enTour,
  es: esTour,
  it: itTour,
};

describe("builder42 tour i18n — paridad de claves", () => {
  const keysByLocale = Object.fromEntries(
    Object.entries(CATALOGS).map(([locale, catalog]) => [locale, new Set(collectLeafPaths(catalog))]),
  ) as Record<string, Set<string>>;

  const allKeys = new Set<string>();
  for (const keys of Object.values(keysByLocale)) {
    for (const key of keys) allKeys.add(key);
  }

  it('el namespace "tour" no está vacío en ningún idioma', () => {
    for (const [locale, keys] of Object.entries(keysByLocale)) {
      expect(keys.size, `${locale} no tiene claves de copy`).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(CATALOGS))("%s tiene todas las claves del superset", (locale) => {
    const keys = keysByLocale[locale]!;
    const missing = [...allKeys].filter((key) => !keys.has(key));
    expect(missing, `claves ausentes en ${locale}:\n${missing.join("\n")}`).toEqual([]);
  });

  it.each(Object.keys(CATALOGS))("%s no tiene claves huérfanas (fuera del superset)", (locale) => {
    const keys = keysByLocale[locale]!;
    const extra = [...keys].filter((key) => !allKeys.has(key));
    expect(extra, `claves huérfanas en ${locale}:\n${extra.join("\n")}`).toEqual([]);
  });

  it("define los 4 textos de botones/progreso requeridos en los 3 idiomas", () => {
    const requiredLabelKeys = [
      "labels.nextBtnText",
      "labels.prevBtnText",
      "labels.doneBtnText",
      "labels.progressText",
    ];
    for (const locale of Object.keys(CATALOGS)) {
      const keys = keysByLocale[locale]!;
      const missing = requiredLabelKeys.filter((key) => !keys.has(key));
      expect(missing, `${locale} le faltan labels: ${missing.join(", ")}`).toEqual([]);
    }
  });

  it("cada clave de copy tiene un string no vacío en los 3 idiomas", () => {
    const emptyEntries: string[] = [];
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const key of allKeys) {
        const value = key.split(".").reduce<unknown>((node, part) => {
          if (node === null || typeof node !== "object") return undefined;
          return (node as Json)[part];
        }, catalog);
        if (typeof value !== "string" || value.trim().length === 0) {
          emptyEntries.push(`${locale}:${key}`);
        }
      }
    }
    expect(emptyEntries, `valores vacíos o no-string:\n${emptyEntries.join("\n")}`).toEqual([]);
  });

  it("cada ancla del registro tiene un par steps.<id>.title/description en el catálogo en", () => {
    // Mapa clave de ancla -> id de step usado en tourSteps.ts (mismo orden que §3.2).
    const stepIdByAnchor: Record<string, string> = {
      [BUILDER42_TOUR_ANCHORS.headerIdentity]: "headerIdentity",
      [BUILDER42_TOUR_ANCHORS.toolbarViews]: "toolbarViews",
      [BUILDER42_TOUR_ANCHORS.toolbarViewport]: "toolbarViewport",
      [BUILDER42_TOUR_ANCHORS.toolbarHistory]: "toolbarHistory",
      [BUILDER42_TOUR_ANCHORS.sidebarTabs]: "sidebarTabs",
      [BUILDER42_TOUR_ANCHORS.sidebarPalette]: "sidebarPalette",
      [BUILDER42_TOUR_ANCHORS.canvasFrame]: "canvasFrame",
      [BUILDER42_TOUR_ANCHORS.canvasNodeActions]: "canvasNodeActions",
      [BUILDER42_TOUR_ANCHORS.inspectorTabs]: "inspectorTabs",
      [BUILDER42_TOUR_ANCHORS.inspectorBreakpoints]: "inspectorBreakpoints",
      [BUILDER42_TOUR_ANCHORS.pagesBreadcrumb]: "pagesBreadcrumb",
      [BUILDER42_TOUR_ANCHORS.publish]: "publish",
      [BUILDER42_TOUR_ANCHORS.profileMenu]: "profileMenu",
    };
    const missing: string[] = [];
    for (const anchorKey of Object.values(BUILDER42_TOUR_ANCHORS)) {
      const stepId = stepIdByAnchor[anchorKey];
      if (!stepId) {
        missing.push(`${anchorKey} (sin stepId mapeado en este test)`);
        continue;
      }
      if (!allKeys.has(`steps.${stepId}.title`)) missing.push(`steps.${stepId}.title`);
      if (!allKeys.has(`steps.${stepId}.description`)) missing.push(`steps.${stepId}.description`);
    }
    expect(missing, `claves de step ausentes:\n${missing.join("\n")}`).toEqual([]);
  });
});
