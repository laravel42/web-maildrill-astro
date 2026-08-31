/**
 * Vocabulario del registry derivado por código (docs/33 §6.3, C1 de docs/32).
 *
 * Genera una descripción machine-readable del componentRegistry para inyectar
 * en el prompt del LLM. Nunca se mantiene a mano: agregar un componente al
 * registry actualiza el vocabulario automáticamente (P4).
 *
 * Módulo PURO (P7): testeable sin DOM ni React. No importa React (solo tipos).
 * La descripción resultante es texto compacto que cabe en el context del LLM.
 */

import { listDefinitions } from "./componentRegistry";
import { resolveOptions } from "./types";
import type { FieldSchema } from "./types";

// ─── Tipos del vocabulario ────────────────────────────────────────────────────

/** Descripción de un campo de prop para el LLM. */
export interface VocabField {
  key: string;
  label: string;
  control: string;
  /** Opciones válidas si el control es select/searchable-select. Truncado a 20 para brevedad. */
  options?: string[];
  required?: boolean;
}

/** Descripción de un componente para el LLM. */
export interface VocabComponent {
  type: string;
  label: string;
  category: string;
  acceptsChildren: boolean;
  /** IDs de los grupos de estilo disponibles (layout, typography, appearance, etc.). */
  styleGroups: string[];
  /** Descripción de las props del componente. */
  props: VocabField[];
}

/** Vocabulario completo del registry. */
export interface RegistryVocabulary {
  version: 1;
  /** Descripción de todos los componentes registrados. */
  components: VocabComponent[];
  /**
   * Grupos de estilo disponibles para todos los componentes.
   * Cada componente puede restringirlos via `styleSchema.enabledGroups`.
   */
  allStyleGroups: string[];
}

const ALL_STYLE_GROUPS = [
  "layout",
  "size",
  "spacing",
  "typography",
  "appearance",
  "border",
  "effects",
] as const;

function fieldToVocab(field: FieldSchema): VocabField {
  const result: VocabField = {
    key: field.key,
    label: field.label,
    control: field.control,
  };

  // Incluir opciones válidas para campos de selección (truncado a 20 para brevedad)
  if (
    (field.control === "select" || field.control === "searchable-select") &&
    field.options
  ) {
    const opts = resolveOptions(field.options);
    result.options = opts.slice(0, 20).map((o) => o.value);
    if (opts.length > 20) result.options.push(`…(${opts.length - 20} más)`);
  }

  return result;
}

/**
 * Genera el vocabulario del registry.
 * Se invoca una vez al construir el prompt del LLM (docs/33 §6.3, `prompt.ts`).
 */
export function buildVocabulary(): RegistryVocabulary {
  const components: VocabComponent[] = listDefinitions().map((def) => {
    const enabledGroups =
      def.styleSchema?.enabledGroups ?? [...ALL_STYLE_GROUPS];

    return {
      type: def.type,
      label: def.label,
      category: def.category ?? "content",
      acceptsChildren: def.acceptsChildren ?? false,
      styleGroups: enabledGroups,
      props: (def.propsSchema?.fields ?? []).map(fieldToVocab),
    };
  });

  return {
    version: 1,
    components,
    allStyleGroups: [...ALL_STYLE_GROUPS],
  };
}

/**
 * Serializa el vocabulario como texto compacto para el prompt del LLM.
 * Formato: una línea por componente con sus props más relevantes.
 */
export function vocabularyToPromptText(vocab: RegistryVocabulary): string {
  const lines: string[] = [
    `## Componentes disponibles (${vocab.components.length} total)`,
    "",
  ];

  for (const comp of vocab.components) {
    lines.push(`### ${comp.type} (${comp.label}, categoría: ${comp.category})`);
    lines.push(`- acceptsChildren: ${comp.acceptsChildren}`);
    lines.push(`- styleGroups: ${comp.styleGroups.join(", ")}`);
    if (comp.props.length > 0) {
      lines.push("- props:");
      for (const p of comp.props) {
        const optStr = p.options ? ` [${p.options.slice(0, 5).join(", ")}${p.options.length > 5 ? "…" : ""}]` : "";
        lines.push(`  - ${p.key} (${p.control})${optStr}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
