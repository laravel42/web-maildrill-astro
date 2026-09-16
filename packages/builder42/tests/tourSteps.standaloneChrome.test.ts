/**
 * tourSteps.standaloneChrome.test.ts — D49: `pbx.pages.breadcrumb` (`PageBreadcrumb.tsx`)
 * y `pbx.profileMenu` (`ProfileMenu.tsx`) solo existen en el DOM cuando el editor
 * renderiza su propio `Header` (el shell standalone, `app/App.tsx`) — el embed
 * (`Builder42Editor.tsx`) nunca monta `Header`, así que esas dos anclas nunca están
 * presentes ahí. Antes de D49 el motor del tour (`@md/product-tour`) toleraba esto
 * saltando el paso en runtime; ahora ese salto cuesta una espera acotada por ancla
 * (`waitForElementMs`), así que la exclusión debe ser estructural: `tourSteps.ts` deja
 * de emitir esos dos pasos por completo cuando `standaloneChrome` es `false`.
 *
 * Mismo idioma de test que `tourSteps.flags.test.ts` usa para `publishAvailable` —
 * este archivo cubre específicamente el nuevo campo, sin duplicar las demás
 * invariantes (nodo seleccionado, experienceLevel, etc.) que ya viven allí.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildBuilder42TourSteps,
  type Builder42TourStepsConfig,
} from "@/app/tour/tourSteps";
import { BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";
import { useDocumentStore } from "@/builder/store/documentStore";

const BASE_CONFIG: Omit<Builder42TourStepsConfig, "standaloneChrome"> = {
  experienceLevel: "advanced",
  publishAvailable: true,
};

function resetDocumentState() {
  const { select, setView } = useDocumentStore.getState();
  select(null);
  setView("edit");
  useDocumentStore.setState((s) => {
    const rootId = s.document.rootId;
    const root = s.document.nodes[rootId]!;
    root.children = [];
    for (const key of Object.keys(s.document.nodes)) {
      if (key !== rootId) delete s.document.nodes[key];
    }
  });
}

beforeEach(() => {
  resetDocumentState();
});

afterEach(() => {
  resetDocumentState();
});

describe("buildBuilder42TourSteps — standaloneChrome gates pbx.pages.breadcrumb / pbx.profileMenu (D49)", () => {
  it("con standaloneChrome: false, NI pbx.pages.breadcrumb NI pbx.profileMenu se emiten", () => {
    const steps = buildBuilder42TourSteps({ ...BASE_CONFIG, standaloneChrome: false });
    const anchors = steps.map((s) => s.anchorKey);
    expect(anchors).not.toContain(BUILDER42_TOUR_ANCHORS.pagesBreadcrumb);
    expect(anchors).not.toContain(BUILDER42_TOUR_ANCHORS.profileMenu);
  });

  it("con standaloneChrome: true, AMBAS anclas se emiten", () => {
    const steps = buildBuilder42TourSteps({ ...BASE_CONFIG, standaloneChrome: true });
    const anchors = steps.map((s) => s.anchorKey);
    expect(anchors).toContain(BUILDER42_TOUR_ANCHORS.pagesBreadcrumb);
    expect(anchors).toContain(BUILDER42_TOUR_ANCHORS.profileMenu);
  });

  it("ninguna otra clave de ancla cambia entre standaloneChrome: true y false — la diferencia es exactamente esas dos", () => {
    const anchorsFalse = buildBuilder42TourSteps({ ...BASE_CONFIG, standaloneChrome: false }).map(
      (s) => s.anchorKey,
    );
    const anchorsTrue = buildBuilder42TourSteps({ ...BASE_CONFIG, standaloneChrome: true }).map(
      (s) => s.anchorKey,
    );

    const onlyInTrue = anchorsTrue.filter((a) => !anchorsFalse.includes(a));
    const onlyInFalse = anchorsFalse.filter((a) => !anchorsTrue.includes(a));

    expect(onlyInFalse).toEqual([]);
    expect(onlyInTrue.sort()).toEqual(
      [BUILDER42_TOUR_ANCHORS.pagesBreadcrumb, BUILDER42_TOUR_ANCHORS.profileMenu].sort(),
    );
  });

  it("when() de pbx.pages.breadcrumb y pbx.profileMenu refleja standaloneChrome en runtime (guardia redundante, mismo idioma que pbx.publish)", () => {
    const steps = buildBuilder42TourSteps({ ...BASE_CONFIG, standaloneChrome: true });
    const breadcrumbStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.pagesBreadcrumb);
    const profileMenuStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.profileMenu);

    expect(breadcrumbStep).toBeDefined();
    expect(profileMenuStep).toBeDefined();
    expect(breadcrumbStep!.when?.()).toBe(true);
    expect(profileMenuStep!.when?.()).toBe(true);
  });
});
