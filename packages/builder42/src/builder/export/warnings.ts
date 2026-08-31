import type { NodeId } from "../model/types";

export interface ExportWarning {
  nodeId: NodeId;
  type: "missing-node" | "unknown-type";
  /** Human-readable fallback; UI resolves via i18n keys. */
  message: string;
  nodeType?: string;
}

export interface ExportWarningsCollector {
  warnings: ExportWarning[];
  push(w: ExportWarning): void;
}

export function createExportWarningsCollector(): ExportWarningsCollector {
  const warnings: ExportWarning[] = [];
  return {
    warnings,
    push(w) {
      warnings.push(w);
    },
  };
}
