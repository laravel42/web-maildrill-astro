import { describe, expect, it } from "vitest";
import enCommon from "../src/i18n/locales/en/common.json";
import enInspector from "../src/i18n/locales/en/inspector.json";
import { listDefinitions } from "@/builder/registry/componentRegistry";
import { behaviorRegistry } from "@/builder/registry/behaviorRegistry";
import { STYLE_FIELDS } from "@/builder/inspector/styleFields";
import { optionKey, propGroupSlug } from "@/builder/inspector/controls/translateField";
import { resolveOptions } from "@/builder/registry/types";

function lookup(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

describe("i18n chrome coverage (en)", () => {
  it("has a components.* key for every registered component type", () => {
    const missing: string[] = [];
    for (const def of listDefinitions()) {
      if (typeof lookup(enCommon, `components.${def.type}`) !== "string") {
        missing.push(def.type);
      }
    }
    expect(missing, `missing common.components keys: ${missing.join(", ")}`).toEqual([]);
  });

  it("has props.<type>.<key> (and option/group keys) for every inspector field", () => {
    const missing: string[] = [];
    for (const def of listDefinitions()) {
      for (const field of def.propsSchema.fields ?? []) {
        const prefix = `props.${def.type}.${field.key}`;
        if (typeof lookup(enCommon, prefix) !== "string") {
          missing.push(prefix);
        }
        if (field.group) {
          const groupPath = `propGroups.${propGroupSlug(field.group)}`;
          if (typeof lookup(enCommon, groupPath) !== "string") {
            missing.push(`${def.type}.${field.key} → ${groupPath}`);
          }
        }
        if (field.placeholder) {
          const ph = `${prefix}Placeholder`;
          if (typeof lookup(enCommon, ph) !== "string") missing.push(ph);
        }
        if (field.options) {
          const options = resolveOptions(field.options);
          if (options.length <= 12) {
            for (const opt of options) {
              const key = `${prefix}Options.${optionKey(opt.value)}`;
              if (typeof lookup(enCommon, key) !== "string") missing.push(key);
            }
          }
        }
        if (field.labelOptions) {
          const options = resolveOptions(field.labelOptions);
          if (options.length <= 12) {
            for (const opt of options) {
              const key = `${prefix}LabelOptions.${optionKey(opt.value)}`;
              if (typeof lookup(enCommon, key) !== "string") missing.push(key);
            }
          }
        }
      }
    }
    expect(missing, `missing common.props keys:\n${missing.join("\n")}`).toEqual([]);
  });

  it("has styleLabels.* for every STYLE_FIELDS entry", () => {
    const missing = STYLE_FIELDS.filter(
      (f) => typeof lookup(enCommon, `styleLabels.${f.key}`) !== "string",
    ).map((f) => f.key);
    expect(missing, `missing styleLabels: ${missing.join(", ")}`).toEqual([]);
  });

  it("has inspector behavior option keys for every behavior optionsSchema field", () => {
    const missing: string[] = [];
    for (const def of Object.values(behaviorRegistry)) {
      for (const field of def.optionsSchema?.fields ?? []) {
        const prefix = `behaviors.fields.${def.type}.${field.key}`;
        if (typeof lookup(enInspector, prefix) !== "string") {
          missing.push(prefix);
        }
        if (field.options) {
          for (const opt of resolveOptions(field.options)) {
            const key = `${prefix}Options.${optionKey(opt.value)}`;
            if (typeof lookup(enInspector, key) !== "string") missing.push(key);
          }
        }
      }
    }
    expect(missing, `missing inspector behavior keys:\n${missing.join("\n")}`).toEqual([]);
  });
});
