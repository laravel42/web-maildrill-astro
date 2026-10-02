import { describe, expect, it } from "vitest";
import { serializeDeclarations, serializeNodeCss } from "@/builder/export/cssSerializer";
import { stylePropertiesToCSSObject } from "@/builder/registry/styleToCss";
import { STYLE_FIELDS } from "@/builder/inspector/styleFields";
import { PANEL_SECTIONS, rowIsRenderable } from "@/builder/inspector/panel/sections";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "@/builder/model/types";
import enCommon from "../src/i18n/locales/en/common.json";
import esCommon from "../src/i18n/locales/es/common.json";
import itCommon from "../src/i18n/locales/it/common.json";
import enInspector from "../src/i18n/locales/en/inspector.json";
import esInspector from "../src/i18n/locales/es/inspector.json";
import itInspector from "../src/i18n/locales/it/inspector.json";

/**
 * F23a — `letterSpacing` y `textTransform` de punta a punta.
 *
 * Por qué este archivo existe: las dos propiedades se añadieron a
 * `TypographyStyle` y NADA más en la cadena de serialización tuvo que cambiar,
 * porque `serializeDeclarations` (export) y `stylePropertiesToCSSObject`
 * (canvas) recorren `Object.entries()` del grupo en vez de enumerar
 * propiedades. Eso es justo lo que hace frágil la situación: un futuro
 * refactor que cambie cualquiera de los dos por una lista explícita las
 * dejaría fuera EN SILENCIO — el tipo seguiría compilando, el Inspector
 * seguiría ofreciendo el control, y el valor simplemente no llegaría al CSS.
 * Estas aserciones son el detector de eso.
 *
 * También cubren el kebab-case: `letterSpacing` → `letter-spacing` sale de un
 * `camelToKebab` genérico, no de un mapa, así que conviene tener escrito el
 * resultado esperado.
 */

const TRACKING_KEYS = ["letterSpacing", "textTransform"] as const;

describe("F23a — tracking y caja de letra en el CSS exportado", () => {
  it("serializa ambas propiedades en kebab-case en la capa base", () => {
    const css = serializeDeclarations({
      typography: { letterSpacing: "-0.02em", textTransform: "uppercase" },
    });
    expect(css).toContain("letter-spacing: -0.02em;");
    expect(css).toContain("text-transform: uppercase;");
  });

  it("las emite también dentro del @media de un override, no solo en base", () => {
    const style: NodeStyle = {
      base: { typography: { letterSpacing: "0.08em" } },
      overrides: { md: { typography: { letterSpacing: "-0.03em", textTransform: "none" } } },
    };
    const css = serializeNodeCss("n-x", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain(".n-x { letter-spacing: 0.08em; }");
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toMatch(/@media \(min-width: 768px\) \{ \.n-x \{ [^}]*letter-spacing: -0\.03em;/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{ \.n-x \{ [^}]*text-transform: none;/);
  });

  it("las emite en un estado (hover), que usa el mismo serializador", () => {
    const style: NodeStyle = {
      base: {},
      states: { hover: { typography: { letterSpacing: "0.12em" } } },
    };
    const css = serializeNodeCss("n-y", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain("letter-spacing: 0.12em;");
    expect(css).toContain(":hover");
  });

  it("el canvas recibe las mismas dos propiedades (paridad WYSIWYG con el export)", () => {
    const obj = stylePropertiesToCSSObject({
      typography: { letterSpacing: "-0.02em", textTransform: "capitalize" },
    });
    // En el canvas viajan en camelCase: es un objeto `CSSProperties` de React,
    // que hace la conversión a kebab-case por su cuenta.
    expect(obj).toMatchObject({ letterSpacing: "-0.02em", textTransform: "capitalize" });
  });

  it("no emite nada cuando el valor está ausente (sigue heredando)", () => {
    expect(serializeDeclarations({ typography: {} })).toBe("");
    expect(serializeDeclarations({ typography: { letterSpacing: undefined } })).toBe("");
  });
});

describe("F23a — cableado del Inspector", () => {
  it("declara un campo en STYLE_FIELDS para cada propiedad, en el grupo typography", () => {
    for (const key of TRACKING_KEYS) {
      const field = STYLE_FIELDS.find((f) => f.key === key);
      expect(field, `STYLE_FIELDS no declara ${key}`).toBeDefined();
      expect(field!.group).toBe("typography");
    }
  });

  it("letterSpacing tiene unidad por defecto: unitless no es válido en CSS para esta propiedad", () => {
    const field = STYLE_FIELDS.find((f) => f.key === "letterSpacing")!;
    expect(field.control).toBe("numeric");
    expect(field.defaultUnit).toBe("em");
    expect(field.units).toContain("em");
    // A diferencia de `lineHeight`, que sí admite el ratio sin unidad.
    expect(STYLE_FIELDS.find((f) => f.key === "lineHeight")!.units).toContain("");
  });

  it("textTransform ofrece exactamente los cuatro valores CSS que tienen sentido", () => {
    const field = STYLE_FIELDS.find((f) => f.key === "textTransform")!;
    expect(field.options?.map((o) => o.value)).toEqual(["none", "uppercase", "lowercase", "capitalize"]);
  });

  it("la sección de tipografía del panel tiene una fila renderizable por propiedad", () => {
    const typography = PANEL_SECTIONS.find((s) => s.id === "typography")!;
    const rowsByField = new Map(
      typography.rows.flatMap((row) => row.fields.map(([, key]) => [key, row] as const)),
    );
    for (const key of TRACKING_KEYS) {
      const row = rowsByField.get(key);
      expect(row, `PANEL_SECTIONS no tiene fila para typography.${key}`).toBeDefined();
      expect(rowIsRenderable(row!)).toBe(true);
    }
  });
});

describe("F23a — etiquetas en los tres idiomas", () => {
  // `i18n-chrome-coverage.test.ts` solo valida `en`. Estas dos propiedades se
  // añaden con su traducción en los tres bundles, y esto lo mantiene así: una
  // etiqueta que falte en `es` o `it` cae al `defaultValue` (el label español
  // hardcodeado en `styleFields.ts`) y pasa desapercibida en inglés.
  const commons = { en: enCommon, es: esCommon, it: itCommon };
  const inspectors = { en: enInspector, es: esInspector, it: itInspector };

  for (const [lang, bundle] of Object.entries(commons)) {
    it(`common.json (${lang}) tiene styleLabels para ambas`, () => {
      const labels = (bundle as { styleLabels: Record<string, string> }).styleLabels;
      for (const key of TRACKING_KEYS) {
        expect(typeof labels[key], `styleLabels.${key} falta en ${lang}`).toBe("string");
      }
    });
  }

  for (const [lang, bundle] of Object.entries(inspectors)) {
    it(`inspector.json (${lang}) tiene panel.rows para ambas`, () => {
      const rows = (bundle as { panel: { rows: Record<string, string> } }).panel.rows;
      for (const key of TRACKING_KEYS) {
        expect(typeof rows[key], `panel.rows.${key} falta en ${lang}`).toBe("string");
      }
    });
  }
});
