import { describe, expect, it } from "vitest";
import type { Subscriber, TemplateRow } from "@maildrill/database";
import { renderTemplate, resolveMessageContent } from "./templates";

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

  it("renders the preheader too", () => {
    const out = renderTemplate(
      tpl({ preheader: "For {{name}}" } as Partial<TemplateRow>),
      sub({ name: "Sam" }),
    );
    expect(out.preheader).toBe("For Sam");
  });
});

describe("resolveMessageContent merge tags", () => {
  const jane = sub({ email: "jane@acme.io", name: "Jane", attributes: { plan: "pro" } });

  it("substitutes tokens in campaign-only content (composer SMS/voice, no template)", () => {
    const out = resolveMessageContent(null, jane, { text: "Hi {{name}}, {{plan}} it is" }, "sms");
    expect(out.text).toBe("Hi Jane, pro it is");
  });

  it("substitutes tokens in the campaign subject alongside a template body", () => {
    const out = resolveMessageContent(
      tpl({ html: "<p>Hello {{name}}</p>" }),
      jane,
      { subject: "{{name}}, your {{plan}} digest" },
      "email",
    );
    expect(out.subject).toBe("Jane, your pro digest");
    expect(out.html).toBe("<p>Hello Jane</p>");
  });

  it("keeps campaign overrides winning over template body, rendered", () => {
    const out = resolveMessageContent(
      tpl({ text: "template {{name}}" }),
      jane,
      { text: "override {{name}}" },
      "sms",
    );
    expect(out.text).toBe("override Jane");
  });

  it("resolves approved WhatsApp template placeholders per recipient", () => {
    const out = resolveMessageContent(
      tpl({
        name: "Order Update",
        approvalStatus: "approved",
        language: "en",
        components: { placeholders: ["name", "attributes.plan"] },
      } as Partial<TemplateRow>),
      jane,
      undefined,
      "whatsapp",
    );
    expect(out.templateName).toBe("order_update");
    expect(out.placeholders).toEqual(["Jane", "pro"]);
  });

  it("falls back to builderDoc variable sources when components.placeholders is absent (studio saves)", () => {
    const out = resolveMessageContent(
      tpl({
        name: "Strategy",
        approvalStatus: "approved",
        language: "it",
        components: {
          body: {
            text: "Ciao {{1}}, lanciato {{2}}!",
            examples: ["Alex Morgan", "Company"],
          },
        },
        builderDoc: {
          blocks: {
            body: {
              data: {
                variables: {
                  "1": { source: "{{name}}", example: "Alex Morgan" },
                  "2": { source: "{{attributes.plan}}", example: "Company" },
                },
              },
            },
          },
        },
      } as Partial<TemplateRow>),
      jane,
      undefined,
      "whatsapp",
    );
    expect(out.placeholders).toEqual(["Jane", "pro"]);
  });

  it("falls back to example values so no placeholder is ever empty (Meta rejects empty args)", () => {
    const noName = sub({ email: "x@y.z", attributes: {} });
    const out = resolveMessageContent(
      tpl({
        name: "Strategy",
        approvalStatus: "approved",
        language: "it",
        components: {
          placeholders: ["name", ""],
          body: {
            text: "Ciao {{1}}, lanciato {{2}}!",
            examples: ["Alex Morgan", "Company"],
          },
        },
      } as Partial<TemplateRow>),
      noName,
      undefined,
      "whatsapp",
    );
    expect(out.placeholders).toEqual(["Alex Morgan", "Company"]);
  });

  it("derives the placeholder count from the body text when no mapping exists at all", () => {
    const out = resolveMessageContent(
      tpl({
        name: "Bare",
        approvalStatus: "approved",
        language: "en",
        components: { body: { text: "Hi {{1}}", examples: ["there"] } },
      } as Partial<TemplateRow>),
      jane,
      undefined,
      "whatsapp",
    );
    expect(out.placeholders).toEqual(["there"]);
  });
});
