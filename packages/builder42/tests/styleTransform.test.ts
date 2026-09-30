import { describe, expect, it } from "vitest";
import { serializeDeclarations, serializeNodeCss } from "@/builder/export/cssSerializer";
import { stylePropertiesToCSSObject } from "@/builder/registry/styleToCss";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "@/builder/model/types";

/**
 * T1 — `rotate`, `scale` y `transition` de punta a punta.
 *
 * Por qué este archivo existe: mismo motivo que `typographyTracking.test.ts`
 * (F23a) para `letterSpacing`/`textTransform` — las tres propiedades se
 * añadieron a `AppearanceStyle` y NADA más en `serializeDeclarations`
 * (export) ni en `stylePropertiesToCSSObject` (canvas) tuvo que cambiar,
 * porque los dos recorren `Object.entries()` del grupo en vez de enumerar
 * propiedades. Un futuro refactor que cambiara cualquiera de los dos por una
 * lista explícita las dejaría fuera EN SILENCIO: el tipo seguiría
 * compilando y el valor simplemente no llegaría al CSS. Estas aserciones son
 * el detector de eso.
 *
 * También cubren la decisión de no-shorthand: el CSS emitido debe usar
 * `rotate:`/`scale:` (propiedades individuales, CSS Transforms 2) y nunca
 * `transform:` — un `transform` a nivel de modelo pisaría el `transform`
 * inline que `registry/components/Sticker.tsx` escribe por su cuenta.
 */

const TRANSFORM_KEYS = ["rotate", "scale"] as const;

describe("T1 — rotate/scale/transition en el CSS exportado", () => {
  it("serializa las tres propiedades en kebab-case en la capa base", () => {
    const css = serializeDeclarations({
      appearance: {
        rotate: "-2deg",
        scale: "1.05",
        transition: "transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1)",
      },
    });
    expect(css).toContain("rotate: -2deg;");
    expect(css).toContain("scale: 1.05;");
    expect(css).toContain(
      "transition: transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1);",
    );
  });

  it("nunca emite el shorthand transform — las propiedades individuales componen con el transform inline de Sticker", () => {
    const css = serializeDeclarations({
      appearance: { rotate: "1deg", scale: "1.05" },
    });
    expect(css).not.toMatch(/(?<!-)\btransform:/);
  });

  it("las emite también dentro del @media de un override (overrides.md), no solo en base", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg" } },
      overrides: { md: { appearance: { rotate: "0deg", scale: "1.05" } } },
    };
    const css = serializeNodeCss("n-x", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain(".n-x { rotate: -2deg; }");
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toMatch(/@media \(min-width: 768px\) \{ \.n-x \{ [^}]*rotate: 0deg;/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{ \.n-x \{ [^}]*scale: 1\.05;/);
  });

  it("rotate/scale se emiten dentro de un estado (hover), que usa el mismo serializador", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg" } },
      states: { hover: { appearance: { rotate: "0deg", scale: "1.05" } } },
    };
    const css = serializeNodeCss("n-y", style, DEFAULT_BREAKPOINTS);
    expect(css).toMatch(/\.n-y:hover \{ [^}]*rotate: 0deg;/);
    expect(css).toMatch(/\.n-y:hover \{ [^}]*scale: 1\.05;/);
  });

  it("el canvas recibe las mismas tres propiedades (paridad WYSIWYG con el export)", () => {
    const obj = stylePropertiesToCSSObject({
      appearance: {
        rotate: "-2deg",
        scale: "1.05",
        transition: "transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1)",
      },
    });
    expect(obj).toMatchObject({
      rotate: "-2deg",
      scale: "1.05",
      transition: "transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1)",
    });
  });

  it("no emite nada cuando el valor está ausente (sigue heredando)", () => {
    expect(serializeDeclarations({ appearance: {} })).toBe("");
    expect(
      serializeDeclarations({ appearance: { rotate: undefined, scale: undefined, transition: undefined } }),
    ).toBe("");
  });

  for (const key of TRANSFORM_KEYS) {
    it(`${key} sobrevive el resolver de tokens igual que cualquier otro StyleValue (raw string)`, () => {
      const css = serializeDeclarations({ appearance: { [key]: "1.1" } });
      expect(css).toContain(`${key}: 1.1;`);
    });
  }
});

describe("T1 — reduced motion (export)", () => {
  it("un nodo con transition en base recibe la neutralización en prefers-reduced-motion", () => {
    const style: NodeStyle = {
      base: {
        appearance: {
          rotate: "-2deg",
          transition: "transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1)",
        },
      },
    };
    const css = serializeNodeCss("n-a", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .n-a { transition: none; } }");
    // Nunca !important (docs T1 — la regla gana por cascada, no por especificidad).
    expect(css).not.toContain("!important");
  });

  it("un nodo con transition solo en un estado (hover) también recibe la regla — anclada al selector del estado (T1b)", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg" } },
      states: { hover: { appearance: { rotate: "0deg", scale: "1.05", transition: "rotate 0.2s ease" } } },
    };
    const css = serializeNodeCss("n-b", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .n-b:hover { transition: none; } }");
  });

  it("un nodo con transition solo en un override de breakpoint también recibe la regla", () => {
    const style: NodeStyle = {
      base: {},
      overrides: { lg: { appearance: { transition: "rotate 0.2s ease" } } },
    };
    const css = serializeNodeCss("n-c", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .n-c { transition: none; } }");
  });

  it("un nodo SIN transition en ninguna capa no recibe la regla — nunca una regla general para todos", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg", scale: "1.05" } },
      states: { hover: { appearance: { rotate: "0deg" } } },
    };
    const css = serializeNodeCss("n-d", style, DEFAULT_BREAKPOINTS);
    expect(css).not.toContain("prefers-reduced-motion");
  });

  it("un nodo completamente sin estilo no recibe la regla", () => {
    const style: NodeStyle = { base: {} };
    const css = serializeNodeCss("n-e", style, DEFAULT_BREAKPOINTS);
    expect(css).not.toContain("prefers-reduced-motion");
  });
});

describe("T1b — reduced motion también neutraliza la transición de un estado", () => {
  it("un nodo con transition SOLO en states.hover recibe una regla anclada a .n-id:hover, al menos tan específica como la que neutraliza", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg" } },
      states: { hover: { appearance: { transition: "rotate .2s", rotate: "0deg" } } },
    };
    const css = serializeNodeCss("n-b", style, DEFAULT_BREAKPOINTS);
    expect(css).toContain(
      "@media (prefers-reduced-motion: reduce) { .n-b:hover { transition: none; } }",
    );
    expect(css).not.toContain("!important");
    // No hay transition en base ni en overrides: no debe emitirse el guard
    // anclado a `.n-b` (que no neutralizaría nada y sería ruido).
    expect(css).not.toContain(".n-b { transition: none; }");
  });

  it("un nodo con transition SOLO en base sigue comportándose exactamente igual que antes de T1b", () => {
    const style: NodeStyle = {
      base: {
        appearance: {
          rotate: "-2deg",
          transition: "transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1)",
        },
      },
    };
    const css = serializeNodeCss("n-a", style, DEFAULT_BREAKPOINTS);
    expect(css).toBe(
      ".n-a { rotate: -2deg; transition: transform, translate, scale, rotate 0.2s cubic-bezier(0, 0, 0.2, 1); }\n" +
        "@media (prefers-reduced-motion: reduce) { .n-a { transition: none; } }",
    );
  });

  it("un nodo SIN transition en ninguna capa (ni base, ni override, ni estado) sigue sin recibir ninguna regla", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg", scale: "1.05" } },
      states: { hover: { appearance: { rotate: "0deg" } } },
    };
    const css = serializeNodeCss("n-d", style, DEFAULT_BREAKPOINTS);
    expect(css).not.toContain("prefers-reduced-motion");
  });

  it("un nodo con transition en base Y en un estado recibe las dos neutralizaciones, dentro del mismo media query", () => {
    const style: NodeStyle = {
      base: { appearance: { rotate: "-2deg", transition: "rotate .2s ease" } },
      states: { hover: { appearance: { transition: "rotate .2s ease", rotate: "0deg" } } },
    };
    const css = serializeNodeCss("n-f", style, DEFAULT_BREAKPOINTS);
    const guardBlocks = css.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\}[^}]*\}/g) ?? [];
    // Ambas reglas viven en el mismo bloque (decisión de implementación: un
    // solo @media, no uno por selector).
    expect(guardBlocks.length).toBe(1);
    expect(css).toContain(".n-f { transition: none; }");
    expect(css).toContain(".n-f:hover { transition: none; }");
  });

  it("con statesClassName (p. ej. el botón de un tab), la neutralización del estado se ancla a esa clase, igual que su regla normal", () => {
    const style: NodeStyle = {
      base: {},
      states: { selected: { appearance: { transition: "background .15s ease" } } },
    };
    const css = serializeNodeCss("n-tabs", style, DEFAULT_BREAKPOINTS, "n-tabs--tab");
    expect(css).toContain(
      '@media (prefers-reduced-motion: reduce) { .n-tabs--tab[aria-selected="true"] { transition: none; } }',
    );
    expect(css).not.toContain(".n-tabs { transition: none; }");
  });
});
