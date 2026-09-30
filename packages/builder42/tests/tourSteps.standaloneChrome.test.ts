/**
 * tourSteps.standaloneChrome.test.ts — D49 / D-F19.1: `pbx.pages.breadcrumb`
 * (`PageBreadcrumb.tsx`) y `pbx.profileMenu` (`ProfileMenu.tsx`) dejaron de compartir
 * un único flag. Hasta D-F19.1, ambas anclas se gateaban con `standaloneChrome`
 * sobre la premisa de que ninguna de las dos existe en el DOM fuera del shell
 * standalone (`app/App.tsx`) — el embed (`Builder42Editor.tsx`) nunca monta
 * `Header`. La portada de `PageBreadcrumb` dentro del header del HOST cuando este
 * presta un slot de página (`pagesSlotId` / `HostPagesPortal`) hizo falsa esa
 * premisa para la mitad del breadcrumb: `.pbx-breadcrumb` puede existir con
 * `standaloneChrome: false`. D-F19.1 narrowed `standaloneChrome` a gatear SOLO
 * `pbx.profileMenu` (que sigue sin equivalente embebido) y añadió
 * `pagesBreadcrumbAvailable` como el flag independiente para el breadcrumb.
 *
 * Antes de este archivo, la aserción "con standaloneChrome: true, AMBAS anclas se
 * emiten" / "con standaloneChrome: false, NI ... NI ... se emiten" trataba las dos
 * anclas como un solo bloque — ahora las cuatro combinaciones de los dos booleans
 * se prueban por separado, para dejar constancia de que cada ancla depende
 * exclusivamente de su propio flag y de que ninguna OTRA ancla del registro se ve
 * afectada por ninguno de los dos.
 *
 * Mismo idioma de test que `tourSteps.flags.test.ts` usa para `publishAvailable` —
 * este archivo cubre específicamente estos dos campos, sin duplicar las demás
 * invariantes (nodo seleccionado, experienceLevel, etc.) que ya viven allí.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildBuilder42TourSteps,
  type Builder42TourStepsConfig,
} from "@/app/tour/tourSteps";
import { BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";
import { useDocumentStore } from "@/builder/store/documentStore";
import { createEditorI18n } from "@/i18n";

/** F19.2: `buildBuilder42TourSteps` ya no lee el singleton global — este archivo
 * cubre el filtrado por `standaloneChrome`/`pagesBreadcrumbAvailable`, no copy, así
 * que el idioma es irrelevante para las aserciones. */
const TEST_I18N = createEditorI18n("en");

const BASE_CONFIG: Omit<Builder42TourStepsConfig, "standaloneChrome" | "pagesBreadcrumbAvailable"> = {
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

/** Anclas del registro que NO son `pagesBreadcrumb` ni `profileMenu` — la garantía
 * de "ninguna otra ancla cambia" se comprueba contra este conjunto. */
const OTHER_ANCHORS = Object.values(BUILDER42_TOUR_ANCHORS).filter(
  (a) => a !== BUILDER42_TOUR_ANCHORS.pagesBreadcrumb && a !== BUILDER42_TOUR_ANCHORS.profileMenu,
);

describe("buildBuilder42TourSteps — standaloneChrome gatea SOLO pbx.profileMenu, pagesBreadcrumbAvailable gatea SOLO pbx.pages.breadcrumb (D-F19.1)", () => {
  it.each([
    { standaloneChrome: false, pagesBreadcrumbAvailable: false, expectBreadcrumb: false, expectProfileMenu: false },
    { standaloneChrome: false, pagesBreadcrumbAvailable: true, expectBreadcrumb: true, expectProfileMenu: false },
    { standaloneChrome: true, pagesBreadcrumbAvailable: false, expectBreadcrumb: false, expectProfileMenu: true },
    { standaloneChrome: true, pagesBreadcrumbAvailable: true, expectBreadcrumb: true, expectProfileMenu: true },
  ])(
    "standaloneChrome=%s, pagesBreadcrumbAvailable=%s → breadcrumb=$expectBreadcrumb, profileMenu=$expectProfileMenu",
    ({ standaloneChrome, pagesBreadcrumbAvailable, expectBreadcrumb, expectProfileMenu }) => {
      const steps = buildBuilder42TourSteps(
        { ...BASE_CONFIG, standaloneChrome, pagesBreadcrumbAvailable },
        TEST_I18N,
      );
      const anchors = steps.map((s) => s.anchorKey);

      if (expectBreadcrumb) {
        expect(anchors).toContain(BUILDER42_TOUR_ANCHORS.pagesBreadcrumb);
      } else {
        expect(anchors).not.toContain(BUILDER42_TOUR_ANCHORS.pagesBreadcrumb);
      }

      if (expectProfileMenu) {
        expect(anchors).toContain(BUILDER42_TOUR_ANCHORS.profileMenu);
      } else {
        expect(anchors).not.toContain(BUILDER42_TOUR_ANCHORS.profileMenu);
      }

      // Ninguna OTRA ancla del registro se ve afectada por estos dos flags.
      for (const otherAnchor of OTHER_ANCHORS) {
        expect(anchors).toContain(otherAnchor);
      }
    },
  );

  it("when() de pbx.pages.breadcrumb refleja pagesBreadcrumbAvailable en runtime (guardia redundante, mismo idioma que pbx.publish)", () => {
    const steps = buildBuilder42TourSteps(
      { ...BASE_CONFIG, standaloneChrome: false, pagesBreadcrumbAvailable: true },
      TEST_I18N,
    );
    const breadcrumbStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.pagesBreadcrumb);
    expect(breadcrumbStep).toBeDefined();
    expect(breadcrumbStep!.when?.()).toBe(true);
  });

  it("when() de pbx.profileMenu refleja standaloneChrome en runtime (guardia redundante, mismo idioma que pbx.publish)", () => {
    const steps = buildBuilder42TourSteps(
      { ...BASE_CONFIG, standaloneChrome: true, pagesBreadcrumbAvailable: false },
      TEST_I18N,
    );
    const profileMenuStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.profileMenu);
    expect(profileMenuStep).toBeDefined();
    expect(profileMenuStep!.when?.()).toBe(true);
  });
});
