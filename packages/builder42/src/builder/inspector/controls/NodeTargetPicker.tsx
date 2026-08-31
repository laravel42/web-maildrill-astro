/**
 * NodeTargetPicker — selector de un nodo cualquiera del documento como
 * objetivo de una acción con `targetKind: "node"` (docs/44 Fase 2, `scroll-to`
 * es el primer caso). Adapta el patrón de listado+búsqueda de
 * `ModalTriggersSection.tsx` (label legible por nodo, filtro por texto), sin
 * duplicar su lógica de "disparadores" — este componente solo lista y filtra,
 * no gestiona vínculos.
 *
 * Excluye el propio nodo (no puede apuntarse a sí mismo) y los nodos cuyo
 * tipo no acepta razonablemente ser un ancla de scroll (hoy: ninguna
 * exclusión adicional — cualquier nodo del árbol es un target válido).
 *
 * Preset "inicio de página" (`topPresetLabel`, docs/44 §4 fila P2,
 * `scroll-to-top`): opcional, ausente = el picker se comporta exactamente
 * como antes (solo nodos). Cuando está presente, agrega una opción especial
 * al principio del `<select>`; elegirla llama `onChange` con el sentinel de
 * UI `TOP_PRESET_VALUE` en vez de un `NodeId` real — el llamador
 * (`NodeClickActionSection.tsx`) es quien decide qué significa ese valor
 * (`params: { preset: "top" }` en vez de `target`), este picker solo lo
 * transporta sin conocer "scroll-to" (P4 aplicado también al Inspector).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDefinition } from "@/builder/registry/componentRegistry";
import type { BuilderDocument, BuilderNode, NodeId } from "@/builder/model/types";

const NONE = "__none__";

/** Sentinel de UI para la opción "inicio de página" — no es un `NodeId` real. */
export const TOP_PRESET_VALUE = "__top__";

/** Etiqueta legible de un nodo candidato a objetivo (mismo criterio que `ModalTriggersSection`). */
function nodeLabel(node: BuilderNode, typeLabel: string): string {
  const label = node.props.label;
  if (typeof label === "string" && label.trim() !== "") return label;
  const text = node.props.content;
  if (typeof text === "string" && text.trim() !== "") return text.replace(/<[^>]+>/g, "").slice(0, 40);
  return typeLabel;
}

export function NodeTargetPicker({
  document,
  excludeNodeId,
  value,
  onChange,
  topPresetLabel,
}: {
  document: BuilderDocument;
  excludeNodeId: NodeId;
  value: NodeId | undefined;
  onChange: (nodeId: string) => void;
  /** Label de la opción "inicio de página" (docs/44 §4 fila P2). Ausente = sin preset, comportamiento previo. */
  topPresetLabel?: string;
}) {
  const { t } = useTranslation("inspector");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    return Object.values(document.nodes)
      .filter((n) => n.id !== excludeNodeId && n.id !== document.rootId)
      .map((n) => {
        const def = getDefinition(n.type);
        const typeLabel = tc(`components.${n.type}`, { defaultValue: def?.label ?? n.type });
        return { id: n.id, typeLabel, label: nodeLabel(n, typeLabel) };
      });
  }, [document, excludeNodeId, tc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return candidates;
    return candidates.filter(
      (c) => c.label.toLowerCase().includes(q) || c.typeLabel.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  return (
    <div className="pbx-node-target-picker">
      <input
        type="search"
        className="pbx-node-target-picker__search"
        placeholder={t("clickAction.searchNodePlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("clickAction.searchNodePlaceholder")}
      />
      <select
        className="pbx-control__input pbx-control__input--select"
        value={value ?? NONE}
        aria-label={t("clickAction.targetNode")}
        onChange={(e) => {
          if (e.target.value !== NONE) onChange(e.target.value);
        }}
      >
        <option value={NONE}>{t("clickAction.chooseNode")}</option>
        {topPresetLabel ? <option value={TOP_PRESET_VALUE}>{topPresetLabel}</option> : null}
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label} · {c.typeLabel}
          </option>
        ))}
      </select>
      {candidates.length > 0 && filtered.length === 0 ? (
        <p className="pbx-node-target-picker__empty">{t("clickAction.noNodesMatch")}</p>
      ) : null}
    </div>
  );
}
