import type { TFunction } from "i18next";
import type { BuilderNode } from "@/builder/model/types";
import type { FieldSchema } from "@/builder/registry/types";

export interface PropControlContext {
  node: BuilderNode;
  field: FieldSchema;
  /** Valor crudo de la prop (puede ser boolean, array, etc.). */
  raw: unknown;
  /** Representación string para inputs de texto/select. */
  value: string;
  commit: (v: string) => void;
  setProp: (nodeId: string, key: string, value: unknown) => void;
  t: TFunction<"inspector">;
}
