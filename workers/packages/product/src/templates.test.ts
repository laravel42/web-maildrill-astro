import { describe, expect, it } from "vitest";
import type { Subscriber, TemplateRow } from "@maildrill/database";
import { renderTemplate } from "./templates";

// renderTemplate is pure (no DB); build just the fields it reads.
function tpl(parts: Partial<TemplateRow>): TemplateRow {
  return { subject: null, html: null, text: null, ...parts } as TemplateRow;
}
function sub(parts: Partial<Subscriber>): Subscriber {
  return {
    email: "a@b.co",
    name: null,
    phone: null,
    attributes: {},
    ...parts,
  } as Subscriber;
}

describe("renderTemplate merge tags", () => {
  it("substitutes {{email}}, {{name}} and {{phone}} from the record", () => {
    const out = renderTemplate(
      tpl({ html: "{{name}} <{{email}}> {{phone}}" }),
      sub({ email: "jane@acme.io", name: "Jane", phone: "+1 555 0100" }),
    );
    expect(out.html).toBe("Jane <jane@acme.io> +1 555 0100");
  });

  it("renders {{attributes.key}} and bare {{key}} from attributes", () => {
    const out = renderTemplate(
      tpl({ html: "{{attributes.plan}}/{{plan}}" }),
      sub({ attributes: { plan: "pro" } }),
    );
    expect(out.html).toBe("pro/pro");
  });

  it("renders a missing phone or attribute as empty, not the token", () => {
    const out = renderTemplate(
      tpl({ subject: "Hi {{name}}", html: "{{phone}}|{{attributes.city}}" }),
      sub({ name: "Sam" }),
    );
    expect(out.subject).toBe("Hi Sam");
    expect(out.html).toBe("|");
  });
});
