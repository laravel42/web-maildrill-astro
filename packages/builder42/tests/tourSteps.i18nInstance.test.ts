/**
 * tourSteps.i18nInstance.test.ts — D-F19.3: guardia de que `tourSteps.ts` ya no lee
 * el singleton global `@/i18n` y de que el copy que emite viene REALMENTE de la
 * instancia i18next que cada caller le pasa (D-F19.2).
 *
 * Antes de este cambio, `t()` en `tourSteps.ts` llamaba siempre al singleton global
 * (`import i18n from "@/i18n"`) — el mismo que solo `app/App.tsx` (shell standalone)
 * inicializa con el idioma real. `Builder42Editor.tsx` (embed) nunca lo toca: monta
 * su PROPIA instancia con `createEditorI18n(locale)` y se la pasa a
 * `useBuilder42Tour` como `i18nInstance`, pero `tourSteps.ts` la ignoraba por
 * completo. Efecto observado: un `/editor` embebido en inglés mostraba el tour en
 * español ("Nombre y autoguardado", "1 de 15", "Atrás", "Siguiente").
 *
 * Dos garantías, mismo espíritu que el escaneo de fuente de
 * `simpleIconsCatalog.lazy.test.ts` (parte (c) de ese archivo):
 *  (a) escaneo estático de `src/app/tour/tourSteps.ts`: cero imports de `@/i18n`.
 *  (b) prueba de comportamiento: dos instancias DISTINTAS
 *      (`createEditorI18n("en")` y `createEditorI18n("es")`) producen copy
 *      DISTINTO, y cada una coincide con su propio `src/i18n/locales/<lang>/tour.json`
 *      — la instancia en inglés no debe devolver texto en español. Esta segunda
 *      aserción es la que habría atrapado el defecto original: (a) sola solo prueba
 *      que no se IMPORTA el singleton, no que el copy resuelto sea correcto.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildBuilder42TourSteps,
  getBuilder42TourLabels,
  type Builder42TourStepsConfig,
} from "@/app/tour/tourSteps";
import { BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";
import { createEditorI18n } from "@/i18n";

import enTour from "@/i18n/locales/en/tour.json";
import esTour from "@/i18n/locales/es/tour.json";

const CONFIG: Builder42TourStepsConfig = {
  experienceLevel: "advanced",
  publishAvailable: true,
  standaloneChrome: true,
  // Campo requerido de la config (gatea `pbx.pages.breadcrumb`), no algo que este archivo pruebe.
  pagesBreadcrumbAvailable: true,
};

// -----------------------------------------------------------------------
// (a) `tourSteps.ts` no importa el singleton global `@/i18n`.
// -----------------------------------------------------------------------

describe("tourSteps.ts — no importa el singleton global @/i18n (D-F19.2/D-F19.3)", () => {
  function stripComments(contents: string): string {
    return contents.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it("el código fuente (sin comentarios) no contiene ningún import de \"@/i18n\"", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(here, "..", "src", "app", "tour", "tourSteps.ts");
    const code = stripComments(readFileSync(filePath, "utf8"));

    // Cualquier forma de import de ese módulo — estático, con alias, de solo
    // efecto lateral, `export ... from`, etc. — reintroduciría la dependencia al
    // singleton que este cambio elimina.
    const importRe = /\bfrom\s*["']@\/i18n["']|\bimport\s*\(\s*["']@\/i18n["']\s*\)|\brequire\s*\(\s*["']@\/i18n["']\s*\)/g;
    const offenders = code.match(importRe) ?? [];

    expect(offenders, `no debería haber imports de "@/i18n" en tourSteps.ts, se encontró: ${offenders.join(", ")}`).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// (b) Dos instancias distintas producen copy distinto, cada una coincide con su
// propio JSON de locale.
// -----------------------------------------------------------------------

describe("buildBuilder42TourSteps / getBuilder42TourLabels — el copy viene de la instancia recibida, no de un singleton (D-F19.2)", () => {
  it("con createEditorI18n('en'), el título de pbx.header.identity es el inglés de tour.json, no el español", () => {
    const enInstance = createEditorI18n("en");
    const steps = buildBuilder42TourSteps(CONFIG, enInstance);
    const headerIdentityStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.headerIdentity);

    expect(headerIdentityStep).toBeDefined();
    expect(headerIdentityStep!.popover.title).toBe(enTour.steps.headerIdentity.title);
    expect(headerIdentityStep!.popover.description).toBe(enTour.steps.headerIdentity.description);
    // Negativo explícito: el defecto original habría hecho que ESTA instancia en
    // inglés devolviera el copy español.
    expect(headerIdentityStep!.popover.title).not.toBe(esTour.steps.headerIdentity.title);
  });

  it("con createEditorI18n('es'), el título de pbx.header.identity es el español de tour.json", () => {
    const esInstance = createEditorI18n("es");
    const steps = buildBuilder42TourSteps(CONFIG, esInstance);
    const headerIdentityStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.headerIdentity);

    expect(headerIdentityStep).toBeDefined();
    expect(headerIdentityStep!.popover.title).toBe(esTour.steps.headerIdentity.title);
    expect(headerIdentityStep!.popover.description).toBe(esTour.steps.headerIdentity.description);
  });

  it("las dos instancias producen títulos DISTINTOS para el mismo paso (pbx.toolbar.views)", () => {
    const enInstance = createEditorI18n("en");
    const esInstance = createEditorI18n("es");

    const enSteps = buildBuilder42TourSteps(CONFIG, enInstance);
    const esSteps = buildBuilder42TourSteps(CONFIG, esInstance);

    const enStep = enSteps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.toolbarViews);
    const esStep = esSteps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.toolbarViews);

    expect(enStep).toBeDefined();
    expect(esStep).toBeDefined();
    expect(enStep!.popover.title).toBe(enTour.steps.toolbarViews.title);
    expect(esStep!.popover.title).toBe(esTour.steps.toolbarViews.title);
    expect(enStep!.popover.title).not.toBe(esStep!.popover.title);
  });

  it("getBuilder42TourLabels(en) devuelve los 4 textos en inglés de tour.json, distintos de los de es", () => {
    const enInstance = createEditorI18n("en");
    const esInstance = createEditorI18n("es");

    const enLabels = getBuilder42TourLabels(enInstance);
    const esLabels = getBuilder42TourLabels(esInstance);

    expect(enLabels.nextBtnText).toBe(enTour.labels.nextBtnText);
    expect(enLabels.prevBtnText).toBe(enTour.labels.prevBtnText);
    expect(enLabels.doneBtnText).toBe(enTour.labels.doneBtnText);
    expect(enLabels.progressText).toBe(enTour.labels.progressText);

    expect(esLabels.nextBtnText).toBe(esTour.labels.nextBtnText);
    expect(esLabels.prevBtnText).toBe(esTour.labels.prevBtnText);
    expect(esLabels.doneBtnText).toBe(esTour.labels.doneBtnText);
    expect(esLabels.progressText).toBe(esTour.labels.progressText);

    // El defecto observado en producción, reproducido aquí de forma acotada: la
    // instancia en inglés no debe devolver "Atrás"/"Siguiente" (español).
    expect(enLabels.nextBtnText).not.toBe(esLabels.nextBtnText);
    expect(enLabels.prevBtnText).not.toBe(esLabels.prevBtnText);
  });
});
