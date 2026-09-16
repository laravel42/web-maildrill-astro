/**
 * tourSteps.flags.test.ts — verifica que `buildBuilder42TourSteps` (F3b) filtra por
 * las condiciones externas reales del embed (§1.4.6 y §4 F3b de
 * docs/product-tour-driverjs-plan.md): `pbx.publish` solo aparece si el adapter de
 * publicación está disponible, `pbx.canvas.nodeActions`/`pbx.inspector.tabs`/
 * `pbx.inspector.breakpoints` solo si hay un nodo que seleccionar, y ningún paso
 * referencia una superficie apagada en el embed `experienceLevel = "simple"`
 * (Tokens, Código, export zip, JSON — ninguna tiene ancla propia en el registro).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildBuilder42TourSteps,
  getBuilder42TourLabels,
  type Builder42TourStepsConfig,
} from "@/app/tour/tourSteps";
import { BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";
import { useDocumentStore } from "@/builder/store/documentStore";
import { readConfig, writeConfig, subscribeConfig } from "@/hooks/useLocalConfig";

/** Anclas de superficies apagadas en el embed simple (§3.2 "Excluidos") — ninguna
 * existe en `BUILDER42_TOUR_ANCHORS`, así que la garantía real es que el registro
 * de anclas en sí no las incluye (comprobado aquí de forma explícita en vez de
 * depender solo de la ausencia de un símbolo). */
const SIMPLE_EMBED_EXCLUDED_LITERALS = ["tokens", "code", "zip", "json"];

/** Inserta un nodo hijo mínimo bajo el root del documento activo (helper de test). */
function insertChildUnderRoot(childId: string): void {
  useDocumentStore.setState((s) => {
    const rootId = s.document.rootId;
    const root = s.document.nodes[rootId]!;
    s.document.nodes[childId] = { id: childId, type: "text", props: {}, style: {} };
    root.children = [...(root.children ?? []), childId];
  });
}

const ADVANCED_CONFIG: Builder42TourStepsConfig = {
  experienceLevel: "advanced",
  publishAvailable: true,
};

const SIMPLE_CONFIG: Builder42TourStepsConfig = {
  experienceLevel: "simple",
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

describe("buildBuilder42TourSteps — registro de anclas no incluye superficies apagadas en simple", () => {
  it("ninguna clave de BUILDER42_TOUR_ANCHORS referencia tokens/code/zip/json", () => {
    const anchorValues = Object.values(BUILDER42_TOUR_ANCHORS);
    for (const literal of SIMPLE_EMBED_EXCLUDED_LITERALS) {
      const offending = anchorValues.filter((v) => v.toLowerCase().includes(literal));
      expect(offending, `ancla(s) referenciando "${literal}"`).toEqual([]);
    }
  });
});

describe("buildBuilder42TourSteps — filtrado por experienceLevel (§1.4.6)", () => {
  it("emite el mismo conjunto de anclas base en simple y advanced (sin paso hoy gateado por nivel)", () => {
    const simpleAnchors = buildBuilder42TourSteps(SIMPLE_CONFIG).map((s) => s.anchorKey);
    const advancedAnchors = buildBuilder42TourSteps(ADVANCED_CONFIG).map((s) => s.anchorKey);
    expect(simpleAnchors).toEqual(advancedAnchors);
  });
});

describe("buildBuilder42TourSteps — pbx.publish depende del adapter de publicación (§3.2)", () => {
  it("se omite por completo cuando publishAvailable es false", () => {
    const steps = buildBuilder42TourSteps({ ...ADVANCED_CONFIG, publishAvailable: false });
    const anchors = steps.map((s) => s.anchorKey);
    expect(anchors).not.toContain(BUILDER42_TOUR_ANCHORS.publish);
  });

  it("se incluye cuando publishAvailable es true", () => {
    const steps = buildBuilder42TourSteps({ ...ADVANCED_CONFIG, publishAvailable: true });
    const anchors = steps.map((s) => s.anchorKey);
    expect(anchors).toContain(BUILDER42_TOUR_ANCHORS.publish);
  });
});

describe("buildBuilder42TourSteps — pasos dependientes de nodo seleccionado (§1.4.5)", () => {
  it("omite canvasNodeActions/inspectorTabs/inspectorBreakpoints (when === false) con el lienzo vacío", () => {
    resetDocumentState();
    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    for (const anchorKey of [
      BUILDER42_TOUR_ANCHORS.canvasNodeActions,
      BUILDER42_TOUR_ANCHORS.inspectorTabs,
      BUILDER42_TOUR_ANCHORS.inspectorBreakpoints,
    ]) {
      const step = steps.find((s) => s.anchorKey === anchorKey);
      expect(step, `debería existir un paso para "${anchorKey}"`).toBeDefined();
      expect(step!.when?.(), `when() de "${anchorKey}" debería ser false sin nodos`).toBe(false);
    }
  });

  it("cuando el documento tiene un nodo hijo del root, when() es true y before() lo selecciona", () => {
    insertChildUnderRoot("child-1");

    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    const nodeActionsStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.canvasNodeActions);
    expect(nodeActionsStep).toBeDefined();
    expect(nodeActionsStep!.when?.()).toBe(true);

    nodeActionsStep!.before?.();
    expect(useDocumentStore.getState().selectedId).toBe("child-1");
  });
});

describe("buildBuilder42TourSteps — pbx.toolbar.views fuerza view === 'edit' (§1.4.2)", () => {
  it("before() cambia a 'edit' si el editor estaba en preview", () => {
    useDocumentStore.getState().setView("preview");
    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    const viewsStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.toolbarViews);
    expect(viewsStep).toBeDefined();
    viewsStep!.before?.();
    expect(useDocumentStore.getState().view).toBe("edit");
  });
});

describe("buildBuilder42TourSteps — siempre emite las anclas sin precondición", () => {
  it("incluye header identity, toolbar views/history, sidebar tabs/palette, canvas frame, breadcrumb, profile menu", () => {
    const anchors = buildBuilder42TourSteps(ADVANCED_CONFIG).map((s) => s.anchorKey);
    expect(anchors).toEqual(
      expect.arrayContaining([
        BUILDER42_TOUR_ANCHORS.headerIdentity,
        BUILDER42_TOUR_ANCHORS.toolbarViews,
        BUILDER42_TOUR_ANCHORS.toolbarHistory,
        BUILDER42_TOUR_ANCHORS.sidebarTabs,
        BUILDER42_TOUR_ANCHORS.sidebarPalette,
        BUILDER42_TOUR_ANCHORS.canvasFrame,
        BUILDER42_TOUR_ANCHORS.pagesBreadcrumb,
        BUILDER42_TOUR_ANCHORS.profileMenu,
      ]),
    );
  });

  it("emite exactamente las 18 anclas del registro cuando todo está disponible y hay un nodo seleccionable", () => {
    insertChildUnderRoot("child-1");

    const anchors = buildBuilder42TourSteps(ADVANCED_CONFIG).map((s) => s.anchorKey);
    expect(anchors.sort()).toEqual([...Object.values(BUILDER42_TOUR_ANCHORS)].sort());
  });

  it("pbx.toolbar.views y pbx.toolbar.viewport son anclas distintas y consecutivas, en ese orden (D37)", () => {
    const anchors = buildBuilder42TourSteps(ADVANCED_CONFIG).map((s) => s.anchorKey);
    const viewsIndex = anchors.indexOf(BUILDER42_TOUR_ANCHORS.toolbarViews);
    const viewportIndex = anchors.indexOf(BUILDER42_TOUR_ANCHORS.toolbarViewport);
    expect(viewsIndex).toBeGreaterThanOrEqual(0);
    expect(viewportIndex).toBe(viewsIndex + 1);
  });
});

describe("getBuilder42TourLabels", () => {
  it("devuelve los 4 textos de botones/progreso, no vacíos", () => {
    const labels = getBuilder42TourLabels();
    expect(labels.nextBtnText).toBeTruthy();
    expect(labels.prevBtnText).toBeTruthy();
    expect(labels.doneBtnText).toBeTruthy();
    expect(labels.progressText).toBeTruthy();
  });
});

describe("buildBuilder42TourSteps — pbx.sidebar.palette pins the components tab (D38)", () => {
  it("before() leaves sidebarTab === 'components' even if templates was active", () => {
    useDocumentStore.getState().setSidebarTab("templates");
    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    const paletteStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.sidebarPalette);
    expect(paletteStep).toBeDefined();
    paletteStep!.before?.();
    expect(useDocumentStore.getState().sidebarTab).toBe("components");
  });
});

describe("buildBuilder42TourSteps — pbx.sidebar.templates opens the Templates tab and restores it (D38/D40)", () => {
  it.each(["components", "tokens"] as const)(
    "before() switches sidebarTab to 'templates' and after() restores it from '%s'",
    (previousTab) => {
      useDocumentStore.getState().setSidebarTab(previousTab);

      const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
      const templatesStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.sidebarTemplates);
      expect(templatesStep).toBeDefined();

      templatesStep!.before?.();
      expect(useDocumentStore.getState().sidebarTab).toBe("templates");

      templatesStep!.after?.();
      expect(useDocumentStore.getState().sidebarTab).toBe(previousTab);
    },
  );
});


describe("buildBuilder42TourSteps — pbx.settings.* section steps open their own tab (D39/D41)", () => {
  it.each([
    ["settingsLayers", BUILDER42_TOUR_ANCHORS.settingsLayers, "layers"] as const,
    ["settingsPages", BUILDER42_TOUR_ANCHORS.settingsPages, "pages"] as const,
    ["settingsLanguages", BUILDER42_TOUR_ANCHORS.settingsLanguages, "languages"] as const,
  ])(
    "before() of %s leaves requestedSiteTab === '%s' and selectedId === null, even with a node selected",
    (_label, anchorKey, tab) => {
      insertChildUnderRoot("child-1");
      useDocumentStore.getState().select("child-1");
      expect(useDocumentStore.getState().selectedId).toBe("child-1");

      const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
      const step = steps.find((s) => s.anchorKey === anchorKey);
      expect(step).toBeDefined();

      step!.before?.();
      expect(useDocumentStore.getState().requestedSiteTab).toBe(tab);
      expect(useDocumentStore.getState().selectedId).toBeNull();
    },
  );

  it("before() of pbx.publish leaves requestedSiteTab === 'publish'", () => {
    insertChildUnderRoot("child-1");
    useDocumentStore.getState().select("child-1");

    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    const publishStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.publish);
    expect(publishStep).toBeDefined();

    publishStep!.before?.();
    expect(useDocumentStore.getState().requestedSiteTab).toBe("publish");
    expect(useDocumentStore.getState().selectedId).toBeNull();
  });
});

describe("buildBuilder42TourSteps — D40 correction: inspector expansion notifies subscribers, not just localStorage", () => {
  // Este paquete corre los tests con `environment: "node"` (sin jsdom/happy-dom,
  // ver la nota de cabecera de `tour-anchors-coverage.test.ts`): Node no expone
  // `localStorage` por defecto, así que `readConfig`/`writeConfig` necesitan un
  // polyfill mínimo — mismo patrón (`MemoryStorage`, sin dependencia nueva) que
  // `useBuilder42Tour.persistence.test.ts` ya usa para el mismo problema.
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage();
  });

  it("before() of pbx.inspector.tabs notifies inspectorCollapsed listeners", () => {
    writeConfig("inspectorCollapsed", true);
    expect(readConfig("inspectorCollapsed")).toBe(true);

    const listener = vi.fn();
    const unsubscribe = subscribeConfig("inspectorCollapsed", listener);

    insertChildUnderRoot("child-1");
    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    const inspectorTabsStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.inspectorTabs);
    expect(inspectorTabsStep).toBeDefined();

    inspectorTabsStep!.before?.();

    expect(listener).toHaveBeenCalled();
    expect(readConfig("inspectorCollapsed")).toBe(false);

    unsubscribe();
    writeConfig("inspectorCollapsed", false);
  });

  it("before() of a section step (pbx.settings.layers) notifies inspectorCollapsed listeners", () => {
    writeConfig("inspectorCollapsed", true);
    expect(readConfig("inspectorCollapsed")).toBe(true);

    const listener = vi.fn();
    const unsubscribe = subscribeConfig("inspectorCollapsed", listener);

    const steps = buildBuilder42TourSteps(ADVANCED_CONFIG);
    const layersStep = steps.find((s) => s.anchorKey === BUILDER42_TOUR_ANCHORS.settingsLayers);
    expect(layersStep).toBeDefined();

    layersStep!.before?.();

    expect(listener).toHaveBeenCalled();
    expect(readConfig("inspectorCollapsed")).toBe(false);

    unsubscribe();
    writeConfig("inspectorCollapsed", false);
  });
});
