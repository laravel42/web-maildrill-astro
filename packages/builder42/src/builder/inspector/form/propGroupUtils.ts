import type { FieldSchema } from "@/builder/registry/types";
import { GENERAL_PROP_GROUP } from "./constants";

/** Agrupa los campos de props por `field.group`, preservando el orden de aparición. */
export function groupPropFields(fields: FieldSchema[]): { name: string; fields: FieldSchema[] }[] {
  const order: string[] = [];
  const map = new Map<string, FieldSchema[]>();
  for (const f of fields) {
    const g = f.group ?? GENERAL_PROP_GROUP;
    let bucket = map.get(g);
    if (!bucket) {
      bucket = [];
      map.set(g, bucket);
      order.push(g);
    }
    bucket.push(f);
  }
  return order.map((g) => ({ name: g, fields: map.get(g)! }));
}
