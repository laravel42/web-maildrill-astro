import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { behaviorRegistry } from "@/builder/registry/behaviorRegistry";
import { STICKER_DEFAULT_STYLE, numericPropValue } from "@/builder/registry/components/Sticker";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relative: string): string {
  return readFileSync(path.join(packageRoot, relative), "utf8");
}

/** Quita comentarios de bloque y de línea antes de escanear código. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * F23b — pegatina superpuesta y arrastrable.
 *
 * El componente `sticker` se sale de la regla general del catálogo (el estilo
 * lo decide el usuario y sale por clase) en exactamente dos propiedades,
 * `position` y `transform`, que el modelo de estilos no declara y por tanto
 * ninguna clase puede emitir. Estas aserciones fijan ese contrato: si alguien
 * intenta "arreglar" el componente moviendo su geometría al modelo, o quita la
 * regla `:has()` que convierte al padre en bloque contenedor, la pegatina deja
 * de superponerse y pasa a ocupar hueco en el flujo — un fallo visual que
 * ningún otro gate de este paquete detecta.
 */
describe("F23b — componente sticker", () => {
  it("está registrado y acepta hijos (es un contenedor)", () => {
    const def = getDefinition("sticker");
    expect(def).toBeDefined();
    expect(def!.acceptsChildren).toBe(true);
    expect(def!.category).toBe("content");
  });

  it("trae el CSS de salida con la superposición y la regla del padre", () => {
    const def = getDefinition("sticker")!;
    expect(def.css, "el sticker necesita su propio CSS de salida").toBeDefined();
    expect(def.css).toContain(".pb-sticker { position: absolute;");
    // La regla que hace posible todo: sin ella el `absolute` se resuelve contra
    // el viewport (o contra un ancestro cualquiera), no contra la sección.
    expect(def.css).toMatch(/:has\(> \.pb-sticker\) \{ position: relative; \}/);
    // `:where()` mantiene la especificidad en 0 para que el usuario pueda ganar.
    expect(def.css).toContain(":where(");
  });

  it("usa los dos campos tipográficos de F23a en su estilo por defecto", () => {
    // La pegatina es el caso de uso canónico de `letterSpacing`/`textTransform`:
    // si estos dos campos desaparecieran del modelo, este default dejaría de
    // compilar, que es exactamente la alarma que se quiere.
    expect(STICKER_DEFAULT_STYLE.base.typography?.letterSpacing).toBe("0.08em");
    expect(STICKER_DEFAULT_STYLE.base.typography?.textTransform).toBe("uppercase");
  });

  it("declara los tres props que la geometría necesita, con anclajes válidos y steppers numéricos", () => {
    const fields = getDefinition("sticker")!.propsSchema.fields ?? [];
    expect(fields.map((f) => f.key)).toEqual(["anchor", "rotation", "offset"]);
    const anchor = fields.find((f) => f.key === "anchor")!;
    const values = typeof anchor.options === "function" ? anchor.options() : anchor.options;
    expect(values?.map((o) => o.value)).toEqual([
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "center",
    ]);
    // `rotation`/`offset` usan el control numérico propio del proyecto
    // (stepper ▲▼, `NumericUnitInput`), no el `<input type="number">` nativo.
    const rotation = fields.find((f) => f.key === "rotation")!;
    expect(rotation.control).toBe("numeric");
    expect(rotation.units).toEqual(["deg"]);
    const offset = fields.find((f) => f.key === "offset")!;
    expect(offset.control).toBe("numeric");
    expect(offset.units).toEqual(["px"]);
  });

  it("nace con un hijo de texto sembrado, para que no aparezca vacía", () => {
    const def = getDefinition("sticker")!;
    expect(def.defaultChildren).toEqual([{ type: "text", props: { content: "drag me" } }]);
  });

  it("parsea rotation/offset del string CSS que commitea el control numérico", () => {
    // Bug real (feedback de usuario): el control `numeric` (`NumericUnitInput`)
    // SIEMPRE commitea un string con unidad ("5deg", "24px"), nunca un número
    // puro. El primer render leía `typeof … === "number"`, que con un string
    // es siempre `false` — cualquier cambio del usuario caía al fallback y la
    // pegatina parecía "atascada" sin rotar ni moverse.
    expect(numericPropValue("5deg", -8)).toBe(5);
    expect(numericPropValue("-12.5deg", -8)).toBe(-12.5);
    expect(numericPropValue("24px", 24)).toBe(24);
    // Compatibilidad con los `defaultProps` numéricos de fábrica.
    expect(numericPropValue(-8, 0)).toBe(-8);
    // Valor ausente/irreconocible → fallback, nunca NaN en el transform.
    expect(numericPropValue(undefined, -8)).toBe(-8);
    expect(numericPropValue("auto", -8)).toBe(-8);
  });

  it("emite el transform con las dos variables que escribe el runtime, y su fallback", () => {
    // Contrato entre componente y runtime: el runtime NO reconstruye el
    // transform (perdería la rotación y el centrado), solo escribe estas dos
    // variables. El fallback `0px` es lo que deja la pegatina quieta sin JS.
    const source = readSource("src/builder/registry/components/Sticker.tsx");
    expect(source).toContain("var(--pb-sticker-dx, 0px)");
    expect(source).toContain("var(--pb-sticker-dy, 0px)");
  });
});

describe("F23b — behavior sticker-drag", () => {
  it("está registrado, restringido al tipo sticker", () => {
    const def = behaviorRegistry["sticker-drag"];
    expect(def).toBeDefined();
    // `appliesTo` es un predicado sobre el nodo, no una lista de tipos.
    expect(def.appliesTo?.({ type: "sticker" } as never)).toBe(true);
    expect(def.appliesTo?.({ type: "container" } as never)).toBe(false);
  });

  it("no promete el cursor de arrastre en CSS tier 0 (el bundle puede no cargar)", () => {
    const css = behaviorRegistry["sticker-drag"].runtime?.css ?? "";
    // `touch-action` sí debe estar antes del primer gesto; el cursor lo pone el
    // runtime con `pb-sticker--draggable` (mismo criterio que `sticky`).
    expect(css).toContain("touch-action: none");
    expect(css).not.toMatch(/\[data-pb-behavior~="sticker-drag"\][^{]*\{[^}]*cursor: grab/);
    expect(css).toContain(".pb-sticker--draggable { cursor: grab; }");
  });

  it("su runtime no importa nada de src/builder (regla P8)", () => {
    const source = readSource("src/runtime/behaviors/stickerDrag.ts");
    expect(source).not.toMatch(/from\s+["'][^"']*builder\//);
    expect(source).toContain("window.__pbBehaviors.enhanceStickerDrag");
  });

  it("solo escribe las dos variables CSS, nunca el transform entero", () => {
    // Se escanea el código SIN comentarios: la explicación de por qué no se
    // toca `el.style.transform` menciona esa misma expresión, y un escaneo
    // ingenuo se dispararía con su propia documentación.
    const source = stripComments(readSource("src/runtime/behaviors/stickerDrag.ts"));
    expect(source).toContain('setProperty("--pb-sticker-dx"');
    expect(source).toContain('setProperty("--pb-sticker-dy"');
    expect(source).not.toMatch(/style\.transform\s*=/);
  });
});

/**
 * Hueco encontrado al añadir este behavior y cerrado aquí: `build-runtime.mjs`
 * lleva una lista MANUAL (`BEHAVIOR_ENTRIES`) de qué módulo compilar, y nada
 * verificaba que coincidiera con lo que declara el registry. Un behavior nuevo
 * sin su entrada compila el sitio entero sin un solo error y falla solo en
 * runtime, en el navegador del visitante, con el efecto simplemente ausente.
 */
describe("F23b — todo behavior con runtime tiene su bundle declarado", () => {
  const buildRuntime = readSource("scripts/build-runtime.mjs");

  for (const def of Object.values(behaviorRegistry)) {
    const moduleId = def.runtime?.moduleId;
    if (!moduleId) continue;
    it(`${def.type} → BEHAVIOR_ENTRIES.${moduleId}`, () => {
      expect(
        buildRuntime,
        `build-runtime.mjs no compila "${moduleId}": el behavior "${def.type}" no hidrataría en el sitio exportado`,
      ).toMatch(new RegExp(`\\b${moduleId}:\\s*"behaviors/`));
    });
  }
});

describe("F23b — icono de la paleta", () => {
  it("sticker tiene icono en ComponentTypeIcon", () => {
    // No se afirma la regla general "todo tipo tiene icono": `stat-value`,
    // `accordion-item` y `tab` no lo tienen porque son tipos HIJOS que la
    // paleta nunca lista por separado. El sticker sí se arrastra desde la
    // paleta, así que sin icono saldría con el fallback genérico.
    const source = readSource("src/components/ComponentTypeIcon.tsx");
    expect(source).toMatch(/^\s+sticker: Sticker,$/m);
    expect(source).toMatch(/^\s+Sticker,$/m);
  });
});
