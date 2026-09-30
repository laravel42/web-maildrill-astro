import { describe, expect, it } from "vitest";
import type { BuilderNode, NodeStyle } from "@/builder/model/types";
import {
  getStylePresetDefinition,
  listStylePresetDefinitions,
  mergeStylePreset,
  stylePresetsForNode,
  stylePresetsForNodeByCategory,
} from "@/builder/registry/stylePresetRegistry";

/**
 * T1 (F27) — el registro de style presets y su función de merge.
 *
 * Cubre lo que la bitácora (chain F27, "Verificación cada task owes", T1)
 * pide explícitamente: merge sobre un estilo vacío, merge sobre un estilo
 * que ya declara uno de los mismos campos (el preset debe ganar en los
 * campos que declara y dejar el resto intacto), filtrado por `appliesTo`, y
 * que una capa `states.hover` sobreviva el merge.
 */

function makeNode(overrides: Partial<BuilderNode> = {}): BuilderNode {
  return {
    id: "n1" as BuilderNode["id"],
    type: "button",
    props: {},
    style: { base: {} },
    ...overrides,
  };
}

describe("stylePresetRegistry — catálogo", () => {
  it("registra los 10 presets (2 chip + 2 eyebrow + 2 section-title + 1 body-text + 3 sticker)", () => {
    const ids = listStylePresetDefinitions().map((d) => d.id);
    expect(ids).toEqual([
      "chip-outline",
      "chip-solid",
      "eyebrow-on-light",
      "eyebrow-on-dark",
      "section-title-on-light",
      "section-title-on-dark",
      "body-text",
      "sticker-badge",
      "sticker-ribbon-outline",
      "sticker-ribbon-solid",
    ]);
  });

  it("getStylePresetDefinition devuelve undefined para un id no registrado", () => {
    expect(getStylePresetDefinition("does-not-exist")).toBeUndefined();
    expect(getStylePresetDefinition("chip-solid")?.id).toBe("chip-solid");
  });

  it("appliesTo (chip): se ofrece a button y badge, nunca a container", () => {
    const chipIds = ["chip-outline", "chip-solid"];
    expect(stylePresetsForNode(makeNode({ type: "button" })).filter((d) => chipIds.includes(d.id))).toHaveLength(2);
    expect(stylePresetsForNode(makeNode({ type: "badge" })).filter((d) => chipIds.includes(d.id))).toHaveLength(2);
    expect(stylePresetsForNode(makeNode({ type: "container" })).filter((d) => chipIds.includes(d.id))).toHaveLength(
      0,
    );
  });

  it("appliesTo (text): eyebrow/section-title/body-text solo se ofrecen a text (T6-T8)", () => {
    const textIds = [
      "eyebrow-on-light",
      "eyebrow-on-dark",
      "section-title-on-light",
      "section-title-on-dark",
      "body-text",
    ];
    const onText = stylePresetsForNode(makeNode({ type: "text" })).filter((d) => textIds.includes(d.id));
    expect(onText).toHaveLength(5);
    expect(stylePresetsForNode(makeNode({ type: "button" })).filter((d) => textIds.includes(d.id))).toHaveLength(0);
    expect(stylePresetsForNode(makeNode({ type: "container" })).filter((d) => textIds.includes(d.id))).toHaveLength(
      0,
    );
  });

  it("appliesTo (sticker): las tres formas de pegatina solo se ofrecen a sticker (T9)", () => {
    const stickerIds = ["sticker-badge", "sticker-ribbon-outline", "sticker-ribbon-solid"];
    const onSticker = stylePresetsForNode(makeNode({ type: "sticker" })).filter((d) => stickerIds.includes(d.id));
    expect(onSticker).toHaveLength(3);
    expect(stylePresetsForNode(makeNode({ type: "text" })).filter((d) => stickerIds.includes(d.id))).toHaveLength(0);
    expect(
      stylePresetsForNode(makeNode({ type: "container" })).filter((d) => stickerIds.includes(d.id)),
    ).toHaveLength(0);
  });

  it("stylePresetsForNodeByCategory omite categorías vacías (container -> [])", () => {
    expect(stylePresetsForNodeByCategory(makeNode({ type: "container" }))).toEqual([]);

    const onButton = stylePresetsForNodeByCategory(makeNode({ type: "button" }));
    expect(onButton).toHaveLength(1);
    expect(onButton[0]?.category).toBe("chip");
    expect(onButton[0]?.definitions).toHaveLength(2);

    const onText = stylePresetsForNodeByCategory(makeNode({ type: "text" }));
    expect(onText).toHaveLength(1);
    expect(onText[0]?.category).toBe("text");
    expect(onText[0]?.definitions).toHaveLength(5);

    const onSticker = stylePresetsForNodeByCategory(makeNode({ type: "sticker" }));
    expect(onSticker).toHaveLength(1);
    expect(onSticker[0]?.category).toBe("sticker");
    expect(onSticker[0]?.definitions).toHaveLength(3);
  });
});

describe("mergeStylePreset — merge por capa (base/overrides/states)", () => {
  it("aplicado sobre un estilo vacío, produce la capa base y el estado hover del preset", () => {
    const node = makeNode();
    const preset = getStylePresetDefinition("chip-solid")!;
    const presetStyle = preset.style(node);
    const merged = mergeStylePreset(node.style, presetStyle);

    expect(merged.base.appearance?.borderRadius).toBe("999px");
    expect(merged.base.appearance?.rotate).toBe("0deg");
    expect(merged.states?.hover?.appearance?.scale).toBe("1.05");
  });

  it("el preset gana en los campos que declara y deja intacto lo que el nodo ya tenía", () => {
    const current: NodeStyle = {
      base: {
        appearance: { borderRadius: "4px", boxShadow: "0 1px 2px rgba(0,0,0,.2)" },
        size: { width: "240px" },
      },
    };
    const preset = getStylePresetDefinition("chip-outline")!;
    const merged = mergeStylePreset(current, preset.style(makeNode()));

    // El preset declara borderRadius -> gana.
    expect(merged.base.appearance?.borderRadius).toBe("999px");
    // El preset NO declara size.width -> el valor del nodo sobrevive.
    expect(merged.base.size?.width).toBe("240px");
    // El preset NO declara boxShadow -> el valor del nodo sobrevive.
    expect(merged.base.appearance?.boxShadow).toBe("0 1px 2px rgba(0,0,0,.2)");
  });

  it("una capa states.hover ya existente en el nodo se fusiona campo a campo, no se reemplaza entera", () => {
    const current: NodeStyle = {
      base: {},
      states: {
        hover: { appearance: { cursor: "pointer" } },
      },
    };
    const preset = getStylePresetDefinition("chip-solid")!;
    const merged = mergeStylePreset(current, preset.style(makeNode({ style: current })));

    // El campo que ya tenía el nodo en hover sobrevive.
    expect(merged.states?.hover?.appearance?.cursor).toBe("pointer");
    // El campo que aporta el preset también está.
    expect(merged.states?.hover?.appearance?.rotate).toBe("0deg");
    expect(merged.states?.hover?.appearance?.scale).toBe("1.05");
  });

  it("no introduce overrides ni states si ni el nodo ni el preset declaran ninguno", () => {
    const current: NodeStyle = { base: {} };
    const presetStyleNoStates: NodeStyle = { base: { appearance: { borderRadius: "999px" } } };
    const merged = mergeStylePreset(current, presetStyleNoStates);

    expect(merged.overrides).toBeUndefined();
    expect(merged.states).toBeUndefined();
  });

  it("es puro: no muta ni el estilo actual ni el estilo del preset", () => {
    const current: NodeStyle = { base: { appearance: { borderRadius: "4px" } } };
    const preset = getStylePresetDefinition("chip-outline")!;
    const presetStyle = preset.style(makeNode());
    const currentSnapshot = JSON.stringify(current);
    const presetSnapshot = JSON.stringify(presetStyle);

    mergeStylePreset(current, presetStyle);

    expect(JSON.stringify(current)).toBe(currentSnapshot);
    expect(JSON.stringify(presetStyle)).toBe(presetSnapshot);
  });
});

describe("mergeStylePreset — los presets T6-T9 (text, sticker)", () => {
  it("eyebrow-on-light escribe tipografía uppercase y el color de acento", () => {
    const node = makeNode({ type: "text" });
    const preset = getStylePresetDefinition("eyebrow-on-light")!;
    const merged = mergeStylePreset(node.style, preset.style(node));

    expect(merged.base.typography?.textTransform).toBe("uppercase");
    expect(merged.base.typography?.letterSpacing).toBe("0.16em");
    expect(merged.base.appearance?.color).toEqual({ token: "colors.primary.default" });
  });

  it("eyebrow-on-dark difiere de eyebrow-on-light solo en el color", () => {
    const node = makeNode({ type: "text" });
    const light = getStylePresetDefinition("eyebrow-on-light")!.style(node);
    const dark = getStylePresetDefinition("eyebrow-on-dark")!.style(node);

    expect(dark.base.appearance?.color).toEqual({ token: "colors.surface.alt" });
    expect(dark.base.typography).toEqual(light.base.typography);
  });

  it("section-title-on-light fija maxWidth: 26ch y line-height: 1.0", () => {
    const node = makeNode({ type: "text" });
    const preset = getStylePresetDefinition("section-title-on-light")!;
    const merged = mergeStylePreset(node.style, preset.style(node));

    expect(merged.base.size?.maxWidth).toBe("26ch");
    expect(merged.base.typography?.lineHeight).toBe("1.0");
    expect(merged.base.appearance?.color).toEqual({ token: "colors.text" });
  });

  it("body-text fija maxWidth: 62ch y el color apagado, sin tomar argumentos", () => {
    const node = makeNode({ type: "text" });
    const preset = getStylePresetDefinition("body-text")!;
    const merged = mergeStylePreset(node.style, preset.style(node));

    expect(merged.base.size?.maxWidth).toBe("62ch");
    expect(merged.base.appearance?.color).toEqual({ token: "colors.muted" });
  });

  it("sticker-badge escribe 96x96, radio de píldora y un borde portable entre temas (color-mix, no el literal rgba de forno)", () => {
    const node = makeNode({ type: "sticker", style: { base: {} } });
    const preset = getStylePresetDefinition("sticker-badge")!;
    const merged = mergeStylePreset(node.style, preset.style(node));

    expect(merged.base.size?.width).toBe("96px");
    expect(merged.base.size?.height).toBe("96px");
    expect(merged.base.appearance?.borderRadius).toBe("999px");
    expect(merged.base.appearance?.borderColor).toBe(
      "color-mix(in srgb, var(--colors-primary-default) 22%, transparent)",
    );
  });

  it("sticker-ribbon-solid vs. sticker-ribbon-outline: mismo radio, relleno opuesto", () => {
    const node = makeNode({ type: "sticker", style: { base: {} } });
    const solid = getStylePresetDefinition("sticker-ribbon-solid")!.style(node);
    const outline = getStylePresetDefinition("sticker-ribbon-outline")!.style(node);

    expect(solid.base.appearance?.background).toEqual({ token: "colors.primary.default" });
    expect(outline.base.appearance?.background).toEqual({ token: "colors.surface.default" });
    expect(solid.base.appearance?.borderRadius).toBe(outline.base.appearance?.borderRadius);
  });

  it("un sticker con states.hover ya existentes conserva esa capa al aplicar sticker-badge (el preset no toca states)", () => {
    const current: NodeStyle = {
      base: {},
      states: { hover: { appearance: { boxShadow: "0 0 0 2px black" } } },
    };
    const node = makeNode({ type: "sticker", style: current });
    const preset = getStylePresetDefinition("sticker-badge")!;
    const merged = mergeStylePreset(current, preset.style(node));

    expect(merged.states?.hover?.appearance?.boxShadow).toBe("0 0 0 2px black");
  });
});
