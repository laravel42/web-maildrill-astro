import type { BuilderNode } from "@/builder/model/types";
import type { ComponentDefinition } from "@/builder/registry/types";
import { groupPropFields } from "./propGroupUtils";
import { PropsGroupAccordion } from "./PropsGroupAccordion";

export function PropsSection({ node, def }: { node: BuilderNode; def: ComponentDefinition }) {
  const groups = groupPropFields(def.propsSchema.fields);
  return (
    <div className="pbx-style-groups">
      {groups.map((g) => (
        <PropsGroupAccordion key={g.name} node={node} groupName={g.name} fields={g.fields} />
      ))}
    </div>
  );
}
