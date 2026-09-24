/**
 * textToolbarLink.test.ts — F21-T3.
 *
 * Dos guardias, mismo espíritu que `simpleIconsCatalog.lazy.test.ts` (c) y
 * `tourSteps.i18nInstance.test.ts` (a):
 *
 * (a) `normalizeLinkHref` (el módulo puro `linkHref.ts`, D-F21.4): todos los
 *     esquemas aceptados, la normalización de un dominio pelado, los
 *     valores relativos/fragmento, los casos rechazados (`javascript:`, un
 *     esquema inventado), el vacío y los espacios envolventes.
 * (b) escaneo estático de `TextToolbar.tsx`: cero `window.prompt` y cero
 *     `eslint-disable ... no-alert` (D-F21.2) — el prompt no puede volver
 *     por una regresión silenciosa.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLinkHref } from "@/builder/canvas/linkHref";

// -----------------------------------------------------------------------
// (a) normalizeLinkHref
// -----------------------------------------------------------------------

describe("normalizeLinkHref — esquemas aceptados tal cual (D-F21.4)", () => {
  it.each([
    "http://example.com",
    "https://example.com",
    "https://example.com/path?query=1#frag",
    "mailto:hello@example.com",
    "tel:+1234567890",
  ])("acepta %s sin modificarlo", (input) => {
    expect(normalizeLinkHref(input)).toEqual({ ok: true, href: input });
  });

  it("es insensible a mayúsculas en el esquema (HTTPS://... sigue siendo válido)", () => {
    const result = normalizeLinkHref("HTTPS://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.href).toBe("HTTPS://example.com");
  });
});

describe("normalizeLinkHref — relativo al sitio y fragmento (D-F21.4)", () => {
  it.each(["/", "/about", "/about/team?x=1", "#pricing", "#"])(
    "acepta %s tal cual",
    (input) => {
      expect(normalizeLinkHref(input)).toEqual({ ok: true, href: input });
    },
  );
});

describe("normalizeLinkHref — dominio pelado sin esquema se normaliza a https:// (D-F21.4)", () => {
  it.each([
    ["example.com", "https://example.com"],
    ["www.example.com", "https://www.example.com"],
    ["example.com/path", "https://example.com/path"],
    ["sub.example.co.uk", "https://sub.example.co.uk"],
  ])("normaliza %s a %s", (input, expected) => {
    expect(normalizeLinkHref(input)).toEqual({ ok: true, href: expected });
  });
});

describe("normalizeLinkHref — rechazados con motivo (D-F21.4)", () => {
  it.each(["javascript:alert(1)", "javascript:void(0)"])(
    "rechaza %s como unsupported (el mark ya lo descarta también vía isAllowedUri de Tiptap)",
    (input) => {
      expect(normalizeLinkHref(input)).toEqual({ ok: false, reason: "unsupported" });
    },
  );

  it.each(["ftp://example.com", "file:///etc/passwd", "notascheme:whatever", "totally not a url"])(
    "rechaza el esquema/valor inválido %s como unsupported",
    (input) => {
      expect(normalizeLinkHref(input)).toEqual({ ok: false, reason: "unsupported" });
    },
  );

  it("rechaza una cadena vacía como empty, no como unsupported", () => {
    expect(normalizeLinkHref("")).toEqual({ ok: false, reason: "empty" });
  });

  it("rechaza una cadena de solo espacios como empty (tras recortar)", () => {
    expect(normalizeLinkHref("   ")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("normalizeLinkHref — espacios envolventes se recortan antes de decidir (D-F21.4)", () => {
  it("recorta espacios alrededor de una URL con esquema", () => {
    expect(normalizeLinkHref("  https://example.com  ")).toEqual({
      ok: true,
      href: "https://example.com",
    });
  });

  it("recorta espacios alrededor de un dominio pelado antes de normalizar", () => {
    expect(normalizeLinkHref("  example.com  ")).toEqual({
      ok: true,
      href: "https://example.com",
    });
  });

  it("recorta espacios alrededor de un valor relativo", () => {
    expect(normalizeLinkHref("  /about  ")).toEqual({ ok: true, href: "/about" });
  });
});

describe("normalizeLinkHref — es total (nunca lanza) para entradas arbitrarias", () => {
  it.each(["://", "http:", ":", "  ", "\t\n"])("no lanza con %j", (input) => {
    expect(() => normalizeLinkHref(input)).not.toThrow();
  });
});

// -----------------------------------------------------------------------
// (b) escaneo estático: TextToolbar.tsx no puede volver a usar window.prompt
// -----------------------------------------------------------------------

describe("TextToolbar.tsx — window.prompt no puede volver (D-F21.2)", () => {
  function stripComments(contents: string): string {
    return contents.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it("el código fuente (sin comentarios) no contiene window.prompt ni el disable de no-alert", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(here, "..", "src", "builder", "canvas", "TextToolbar.tsx");
    const raw = readFileSync(filePath, "utf8");
    const code = stripComments(raw);

    expect(code.includes("window.prompt")).toBe(false);
    // El disable vivía como comentario, así que se busca en el RAW (sin
    // stripComments) para que esta assert no dependa de que stripComments
    // lo haya quitado correctamente — si el disable volviera, en cualquier
    // forma, esto debe fallar.
    expect(raw.includes("no-alert")).toBe(false);
  });
});
