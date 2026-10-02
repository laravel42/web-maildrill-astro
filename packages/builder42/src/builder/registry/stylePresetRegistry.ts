/**
 * Style Preset Registry (F27) — punto único de extensión para recetas de
 * estilo multi-campo que el usuario del editor puede aplicar y luego editar.
 * Mismo espíritu que el `behaviorRegistry`: el core (Inspector) consulta este
 * mapa con `appliesTo`; NUNCA hace `switch(preset.id)`. Agregar un preset =
 * registrar su `StylePresetDefinition`, sin tocar el core.
 *
 * A diferencia de un behavior, aplicar un preset NO deja rastro en el nodo:
 * no hay `presetId`, no hay campo nuevo en `BuilderNode`, no hay migración.
 * `applyStylePreset` fusiona el `NodeStyle` del preset sobre el del nodo, una
 * sola vez, y desde ese momento cada propiedad escrita es tan editable como
 * cualquiera que el usuario hubiera tocado a mano. No hay "quitar preset" ni
 * round-trip (decisión de la bitácora, chain F27, decisión 2).
 */

import type {
  BuilderNode,
  NodeStyle,
  OverrideBreakpoint,
  StyleProperties,
  StyleState,
  StyleValue,
} from "../model/types";
import { defaultStyleFor } from "../store/exampleSite/styleFor";
import { mergeLayer } from "../model/style";
import type { StylePresetCategory, StylePresetDefinition } from "./types";

const CHIP_BORDER = "rgba(179,49,28,0.22)";

/**
 * Sombra flotante para las pegatinas (T9), derivada del literal
 * `SHADOW_FLOAT` de `pizzeriaPage.ts` (`0 28px 64px rgba(15,23,42,0.22)`).
 * Es un gris-azulado neutro, no un color de marca, así que a diferencia de
 * `CHIP_BORDER` no necesitaba `color-mix()` para ser portable entre temas —
 * revisado explícitamente por decisión 7 de la bitácora antes de copiarlo.
 */
const STICKER_SHADOW_FLOAT = "0 28px 64px rgba(15,23,42,0.22)";

/**
 * Los dos presets de chip, derivados del helper privado `chipButton` de
 * `registry/layouts/pages/pizzeriaPage.ts` (la referencia ya midió y
 * justificó esta combinación en la chain F26: pill radius, micro-label 12px
 * uppercase a 0.12em, hairline de acento, tilt en reposo que se endereza y
 * crece en hover). A diferencia del helper, el color del borde/acento está
 * expresado con `color-mix()` sobre el token de tema en vez del literal
 * `rgba(179,49,28,…)` de `forno` — un preset tiene que ser portable entre
 * temas (decisión 7): el literal solo es correcto en `forno`, en cualquier
 * otro tema pintaría un hairline rojizo fuera de paleta.
 *
 * Reposo sin rotación (`rotate: 0deg`, no un ángulo alternante): el ángulo
 * "chip a chip" de la referencia es una decisión de composición del layout
 * que aplica el propio `pizzeriaPage.ts` (su `restRotate` sigue existiendo
 * ahí, sin cambios), no algo que un preset genérico deba imponer — un preset
 * aplicado a un botón cualquiera no sabe en qué posición del grupo está.
 */
function chipStyle(solid: boolean): (node: BuilderNode) => NodeStyle {
  return (node: BuilderNode): NodeStyle => {
    const buttonBase = defaultStyleFor("button").base;
    return {
      base: {
        ...buttonBase,
        spacing: { padding: "9px 16px" },
        typography: {
          ...buttonBase.typography,
          fontFamily: { token: "typography.families.sans" },
          fontSize: "0.75rem",
          fontWeight: { token: "typography.weights.bold" },
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        },
        appearance: {
          ...buttonBase.appearance,
          background: solid ? { token: "colors.primary.default" } : { token: "colors.surface.default" },
          color: solid ? { token: "colors.primary.on" } : { token: "colors.primary.default" },
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: solid
            ? { token: "colors.primary.default" }
            : "color-mix(in srgb, var(--colors-primary-default) 22%, transparent)",
          borderRadius: "999px",
          rotate: "0deg",
          transition: "rotate 0.2s cubic-bezier(0, 0, 0.2, 1), scale 0.2s cubic-bezier(0, 0, 0.2, 1)",
        },
      },
      states: {
        ...node.style.states,
        hover: solid
          ? {
              appearance: {
                background: { token: "colors.text" },
                borderColor: { token: "colors.text" },
                rotate: "0deg",
                scale: "1.05",
              },
            }
          : {
              appearance: {
                background: { token: "colors.primary.default" },
                color: { token: "colors.primary.on" },
                borderColor: { token: "colors.primary.default" },
                rotate: "0deg",
                scale: "1.05",
              },
            },
      },
    };
  };
}

/**
 * ¿Aplica el preset de chip a este nodo? Solo `button` y `badge` (decisión
 * 6): abrirlo a `container` haría que el filtro coincidiera con casi
 * cualquier nodo del árbol y dejaría de ser un filtro. Consecuencia
 * deliberada: `pizzeria-navbar-brand-chip` es un `container` y no se le
 * ofrece este preset — sigue con su estilo escrito a mano. Ver T10 (bitácora,
 * "Deferred to the END of this feature") para cuándo ampliar esto.
 */
function chipAppliesTo(node: BuilderNode): boolean {
  return node.type === "button" || node.type === "badge";
}

/**
 * ¿Aplica a un nodo de texto? Los tres presets tipográficos (`eyebrow`,
 * `sectionTitle`, `bodyText` — T6-T8) solo tienen sentido sobre `text`.
 */
function textAppliesTo(node: BuilderNode): boolean {
  return node.type === "text";
}

/**
 * ¿Aplica a una pegatina? `stickerBadge`/`stickerRibbon` (T9) son formas de
 * `sticker` únicamente — el mismo contrato que `chipAppliesTo`, restringido
 * al único tipo para el que el helper original existía.
 */
function stickerAppliesTo(node: BuilderNode): boolean {
  return node.type === "sticker";
}

/**
 * Micro-etiqueta uppercase (T6), derivada del helper privado `eyebrow` de
 * `pizzeriaPage.ts`: sans 0.75rem, peso bold, tracking 0.16em. La referencia
 * usa dos roles de color — el de acento sobre papel claro y el de superficie
 * clara sobre una banda oscura (`pizzeria-process-eyebrow` a secas frente al
 * único caso con argumento, la banda del carrusel de proceso) — y un preset
 * no puede tomar un argumento (la firma es `style: (node) => NodeStyle`, sin
 * segundo parámetro), así que se registran DOS entradas en vez de una que
 * "leyera" el contexto: más simple, más descubrible en la lista del
 * Inspector, y evita inventar una convención de "nodo padre" que el resto
 * del registro no tiene. La entrada "on-light" es la que corresponde al
 * valor por defecto del helper original.
 */
function eyebrowStyle(color: StyleValue): (node: BuilderNode) => NodeStyle {
  return (): NodeStyle => ({
    base: {
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "0.75rem",
        fontWeight: { token: "typography.weights.bold" },
        letterSpacing: "0.16em",
        textTransform: "uppercase",
      },
      appearance: { color },
    },
  });
}

/**
 * Título de sección (T7), derivado del helper privado `sectionTitle`:
 * familia display, `clamp(2.5rem, 5.6vw, 5rem)`, `line-height: 1`,
 * `-0.01em`, `maxWidth: 26ch`. Mismo razonamiento de dos entradas que
 * `eyebrowStyle` — la referencia solo varía el color, nunca el resto.
 */
function sectionTitleStyle(color: StyleValue): (node: BuilderNode) => NodeStyle {
  return (): NodeStyle => ({
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(2.5rem, 5.6vw, 5rem)",
        fontWeight: { token: "typography.weights.regular" },
        lineHeight: "1.0",
        letterSpacing: "-0.01em",
      },
      appearance: { color },
    },
  });
}

/**
 * Texto de cuerpo (T8), derivado del helper privado `bodyText`: sans,
 * color apagado, `maxWidth: 62ch`. A diferencia de `eyebrow`/`sectionTitle`,
 * el helper original nunca se llamó con un `color`/`maxWidth` distinto del
 * default en toda la plantilla (verificado: los 4 usos en `pizzeriaPage.ts`
 * son `bodyText()` sin argumentos) — así que aquí SÍ basta una sola entrada,
 * sin la duplicación light/dark que exigen los otros dos.
 */
function bodyTextStyle(): NodeStyle {
  return {
    base: {
      size: { maxWidth: "62ch" },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
        lineHeight: { token: "typography.lineHeights.normal" },
      },
      appearance: { color: { token: "colors.muted" } },
    },
  };
}

/**
 * Pegatina redonda con glifo (T9), derivada de `stickerBadge`: 96×96px,
 * borde de acento translúcido, radio de píldora, sombra flotante. El helper
 * original tomaba `mdOnly` (ocultar hasta el breakpoint `md`) — aquí se
 * registran las dos formas como entradas separadas en vez de un booleano,
 * porque `appliesTo`/`style` no admiten un tercer parámetro y las dos formas
 * son igual de válidas para un usuario que decide desde el Inspector
 * (decisión 7 de la bitácora: el `CHIP_BORDER` literal se reemplaza por
 * `color-mix()` sobre el token de tema — la misma razón de portabilidad que
 * ya aplicó T1 a los chips).
 */
function stickerBadgeStyle(mdOnly: boolean): (node: BuilderNode) => NodeStyle {
  return (node: BuilderNode): NodeStyle => {
    const stickerBase = defaultStyleFor("sticker").base;
    return {
      base: {
        ...stickerBase,
        layout: { ...stickerBase.layout, display: mdOnly ? "none" : "flex" },
        spacing: { padding: "0" },
        size: { width: "96px", height: "96px" },
        appearance: {
          ...stickerBase.appearance,
          background: { token: "colors.surface.default" },
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "color-mix(in srgb, var(--colors-primary-default) 22%, transparent)",
          borderRadius: "999px",
          color: { token: "colors.primary.default" },
          boxShadow: STICKER_SHADOW_FLOAT,
        },
      },
      states: node.style.states,
      ...(mdOnly ? { overrides: { md: { layout: { display: "flex" } } } } : {}),
    };
  };
}

/**
 * Pegatina plana en forma de cinta con micro-etiqueta (T9), derivada de
 * `stickerRibbon`. `solid` decide si el relleno es de acento o de
 * superficie clara — la referencia usa ambas formas (la cinta de precio
 * sólida, la de "recién horneado" en outline), así que se registran las dos
 * como entradas separadas, igual que `stickerBadgeStyle`. `mdOnly` NO se
 * ofrece como una tercera variante: de las dos llamadas reales en
 * `pizzeriaPage.ts`, solo una la usa (`stickerRibbon(false, true)`), y ese
 * `overrides.md` es una decisión de COMPOSICIÓN del layout (qué pegatina se
 * oculta en móvil para no saturar la foto), no del preset — el mismo
 * argumento que ya dejó `restRotate` fuera de `chipStyle`.
 */
function stickerRibbonStyle(solid: boolean): (node: BuilderNode) => NodeStyle {
  return (node: BuilderNode): NodeStyle => {
    const stickerBase = defaultStyleFor("sticker").base;
    return {
      base: {
        ...stickerBase,
        layout: { ...stickerBase.layout, display: "flex" },
        spacing: { padding: "10px 18px" },
        appearance: {
          ...stickerBase.appearance,
          background: solid ? { token: "colors.primary.default" } : { token: "colors.surface.default" },
          color: solid ? { token: "colors.primary.on" } : { token: "colors.primary.default" },
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: solid
            ? { token: "colors.primary.default" }
            : "color-mix(in srgb, var(--colors-primary-default) 22%, transparent)",
          borderRadius: "999px",
          boxShadow: STICKER_SHADOW_FLOAT,
        },
      },
      states: node.style.states,
    };
  };
}

const DEFINITIONS: StylePresetDefinition[] = [
  {
    id: "chip-outline",
    labelKey: "stylePresets.chipOutline",
    category: "chip",
    appliesTo: chipAppliesTo,
    style: chipStyle(false),
  },
  {
    id: "chip-solid",
    labelKey: "stylePresets.chipSolid",
    category: "chip",
    appliesTo: chipAppliesTo,
    style: chipStyle(true),
  },
  {
    id: "eyebrow-on-light",
    labelKey: "stylePresets.eyebrowOnLight",
    category: "text",
    appliesTo: textAppliesTo,
    style: eyebrowStyle({ token: "colors.primary.default" }),
  },
  {
    id: "eyebrow-on-dark",
    labelKey: "stylePresets.eyebrowOnDark",
    category: "text",
    appliesTo: textAppliesTo,
    style: eyebrowStyle({ token: "colors.surface.alt" }),
  },
  {
    id: "section-title-on-light",
    labelKey: "stylePresets.sectionTitleOnLight",
    category: "text",
    appliesTo: textAppliesTo,
    style: sectionTitleStyle({ token: "colors.text" }),
  },
  {
    id: "section-title-on-dark",
    labelKey: "stylePresets.sectionTitleOnDark",
    category: "text",
    appliesTo: textAppliesTo,
    style: sectionTitleStyle({ token: "colors.surface.default" }),
  },
  {
    id: "body-text",
    labelKey: "stylePresets.bodyText",
    category: "text",
    appliesTo: textAppliesTo,
    style: bodyTextStyle,
  },
  {
    id: "sticker-badge",
    labelKey: "stylePresets.stickerBadge",
    category: "sticker",
    appliesTo: stickerAppliesTo,
    style: stickerBadgeStyle(false),
  },
  {
    id: "sticker-ribbon-outline",
    labelKey: "stylePresets.stickerRibbonOutline",
    category: "sticker",
    appliesTo: stickerAppliesTo,
    style: stickerRibbonStyle(false),
  },
  {
    id: "sticker-ribbon-solid",
    labelKey: "stylePresets.stickerRibbonSolid",
    category: "sticker",
    appliesTo: stickerAppliesTo,
    style: stickerRibbonStyle(true),
  },
];

export const stylePresetRegistry: Record<string, StylePresetDefinition> = Object.fromEntries(
  DEFINITIONS.map((def) => [def.id, def]),
);

/** Definición por id (o undefined si no está registrado). */
export function getStylePresetDefinition(id: string): StylePresetDefinition | undefined {
  return stylePresetRegistry[id];
}

/** Lista ordenada de definiciones (para el catálogo del Inspector). */
export function listStylePresetDefinitions(): StylePresetDefinition[] {
  return DEFINITIONS;
}

/** Presets que APLICAN a un nodo dado (según `appliesTo`). */
export function stylePresetsForNode(node: BuilderNode): StylePresetDefinition[] {
  return DEFINITIONS.filter((def) => (def.appliesTo ? def.appliesTo(node) : true));
}

/** Orden canónico de categorías para agrupar el catálogo del Inspector. */
export const STYLE_PRESET_CATEGORIES: StylePresetCategory[] = ["chip", "button", "text", "sticker"];

/**
 * Presets aplicables a un nodo (`stylePresetsForNode`), agrupados por
 * `category` en el orden canónico, dentro de cada grupo en orden de
 * registro. Omite categorías vacías — mismo patrón que
 * `behaviorsForNodeByCategory`, para que la sección del Inspector se oculte
 * sola cuando no hay nada que ofrecer (decisión 8).
 */
export function stylePresetsForNodeByCategory(
  node: BuilderNode,
): { category: StylePresetCategory; definitions: StylePresetDefinition[] }[] {
  const applicable = stylePresetsForNode(node);
  return STYLE_PRESET_CATEGORIES.map((category) => ({
    category,
    definitions: applicable.filter((def) => def.category === category),
  })).filter((group) => group.definitions.length > 0);
}

const OVERRIDE_BREAKPOINTS: OverrideBreakpoint[] = ["sm", "md", "lg", "xl"];
const STYLE_STATES: StyleState[] = ["hover", "selected", "pressed"];

/**
 * Fusiona el `NodeStyle` que produce un preset sobre el `NodeStyle` actual
 * de un nodo, capa por capa (`base`, cada breakpoint de `overrides`, cada
 * estado de `states`), reusando `mergeLayer` — el mismo algoritmo de merge
 * por grupo/campo que `resolveStyle`/`resolveStateStyle` usan para cascada
 * (docs/01 §2): el preset gana en los campos que declara, todo lo demás del
 * nodo se conserva intacto. Pura: no muta `current` ni el resultado de
 * `preset.style(node)`; quien llama decide qué hacer con el resultado
 * (T2 lo escribe en UNA sola llamada de store para que sea UN solo paso de
 * undo — ver la bitácora, chain F27, decisión 3).
 */
export function mergeStylePreset(current: NodeStyle, preset: NodeStyle): NodeStyle {
  const result: NodeStyle = {
    base: mergeLayer(current.base, preset.base),
  };

  const overrides: Partial<Record<OverrideBreakpoint, StyleProperties>> = {};
  for (const bp of OVERRIDE_BREAKPOINTS) {
    const currentLayer = current.overrides?.[bp];
    const presetLayer = preset.overrides?.[bp];
    if (!currentLayer && !presetLayer) continue;
    overrides[bp] = mergeLayer(currentLayer ?? {}, presetLayer ?? {});
  }
  if (Object.keys(overrides).length > 0) result.overrides = overrides;

  const states: Partial<Record<StyleState, StyleProperties>> = {};
  for (const state of STYLE_STATES) {
    const currentLayer = current.states?.[state];
    const presetLayer = preset.states?.[state];
    if (!currentLayer && !presetLayer) continue;
    states[state] = mergeLayer(currentLayer ?? {}, presetLayer ?? {});
  }
  if (Object.keys(states).length > 0) result.states = states;

  return result;
}
