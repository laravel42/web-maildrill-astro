/**
 * T2 (F27) — `applyStylePreset` escribe el estilo fusionado en UNA sola
 * llamada de `set()`, así que `zundo` (`documentStore.ts`'s `temporal`)
 * registra exactamente un paso de historial, y un solo `undo()` restaura el
 * `NodeStyle` anterior byte a byte (bitácora, chain F27, "Verificación cada
 * task owes", T2).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { NodeStyle } from "@/builder/model/types";

const CHILD_ID = "t2-chip";

function insertChildUnderRoot(id: string, type: string, style: NodeStyle): void {
  useDocumentStore.setState((s) => {
    const rootId = s.document.rootId;
    const root = s.document.nodes[rootId]!;
    s.document.nodes[id] = { id, type, props: {}, style };
    root.children = [...(root.children ?? []), id];
  });
}

function resetDocumentState(): void {
  useDocumentStore.getState().select(null);
  useDocumentStore.setState((s) => {
    const rootId = s.document.rootId;
    const root = s.document.nodes[rootId]!;
    root.children = [];
    for (const key of Object.keys(s.document.nodes)) {
      if (key !== rootId) delete s.document.nodes[key];
    }
  });
  useDocumentStore.temporal.getState().clear();
}

beforeEach(() => {
  resetDocumentState();
});

describe("applyStylePreset — un solo paso de undo", () => {
  it("aplicar un preset agrega exactamente UN paso a pastStates", () => {
    insertChildUnderRoot(CHILD_ID, "button", { base: {} });
    const before = useDocumentStore.temporal.getState().pastStates.length;

    useDocumentStore.getState().applyStylePreset(CHILD_ID, "chip-solid");

    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(before + 1);
  });

  it("un solo undo() restaura el NodeStyle anterior byte a byte", () => {
    const originalStyle: NodeStyle = { base: { size: { width: "240px" } } };
    insertChildUnderRoot(CHILD_ID, "button", originalStyle);
    const originalSnapshot = JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style);

    useDocumentStore.getState().applyStylePreset(CHILD_ID, "chip-solid");
    // El estilo cambió de verdad — si no, el resto de la aserción es vacua.
    expect(
      JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style),
    ).not.toBe(originalSnapshot);

    useDocumentStore.temporal.getState().undo();

    expect(
      JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style),
    ).toBe(originalSnapshot);
  });

  it("un preset que no aplica al tipo de nodo (container) no toca el estilo ni agrega un paso", () => {
    insertChildUnderRoot(CHILD_ID, "container", { base: {} });
    const beforeSteps = useDocumentStore.temporal.getState().pastStates.length;
    const beforeStyle = JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style);

    useDocumentStore.getState().applyStylePreset(CHILD_ID, "chip-solid");

    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(beforeSteps);
    expect(JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style)).toBe(
      beforeStyle,
    );
  });

  it("un id de preset desconocido no toca el estilo ni agrega un paso", () => {
    insertChildUnderRoot(CHILD_ID, "button", { base: {} });
    const beforeSteps = useDocumentStore.temporal.getState().pastStates.length;

    useDocumentStore.getState().applyStylePreset(CHILD_ID, "does-not-exist");

    expect(useDocumentStore.temporal.getState().pastStates.length).toBe(beforeSteps);
  });

  it("aplicar dos presets distintos en llamadas separadas produce dos pasos, cada uno reversible", () => {
    insertChildUnderRoot(CHILD_ID, "button", { base: {} });

    useDocumentStore.getState().applyStylePreset(CHILD_ID, "chip-outline");
    const afterOutline = JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style);

    useDocumentStore.getState().applyStylePreset(CHILD_ID, "chip-solid");
    const afterSolid = JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style);
    expect(afterSolid).not.toBe(afterOutline);

    useDocumentStore.temporal.getState().undo();
    expect(JSON.stringify(useDocumentStore.getState().document.nodes[CHILD_ID]!.style)).toBe(
      afterOutline,
    );
  });
});
