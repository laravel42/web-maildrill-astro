/**
 * ModalTriggersSection — panel "Disparadores" del Inspector cuando el nodo es un
 * `modal` (docs/20 §4.1). Permite ligar/desligar cualquier nodo como disparador
 * del modal (acción `onClick: open-modal`, universal — docs/20 §3) y crear un
 * botón disparador nuevo en el top del root.
 *
 * Lista priorizada: primero los `button`/`button-submit` (lo más probable como
 * trigger), luego un "Mostrar más" que expande a TODOS los nodos. Un input de
 * búsqueda filtra por nombre/tipo. Chrome del editor (P8/P10): usa el store y
 * los primitivos de `@/components`.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { ComponentTypeIcon, Plus, LinkIcon } from "@/components";
import type { BuilderNode, NodeId } from "@/builder/model/types";

// `button-submit` queda fuera a propósito: su click nativo ya dispara el
// submit del form (`disallowsClickAction`, `Button.tsx`) y está excluido de
// `candidates` antes de llegar aquí. Solo `button` es prioritario en la lista.
const BUTTON_TYPES = new Set(["button"]);

/** Etiqueta legible de un nodo candidato a disparador. */
function nodeLabel(node: BuilderNode, typeLabel: string): string {
  const label = node.props.label;
  if (typeof label === "string" && label.trim() !== "") return label;
  const text = node.props.content;
  if (typeof text === "string" && text.trim() !== "") return text.replace(/<[^>]+>/g, "").slice(0, 40);
  return typeLabel;
}

export function ModalTriggersSection({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const { t: tc } = useTranslation("common");
  const nodes = useDocumentStore((s) => s.document.nodes);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const setNodeAction = useDocumentStore((s) => s.setNodeAction);
  const addComponent = useDocumentStore((s) => s.addComponent);
  const select = useDocumentStore((s) => s.select);

  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const modalId = node.id;

  // Candidatos: cualquier nodo excepto el propio modal, el root, otros modales
  // y los tipos cuyo click nativo ya tiene propósito propio (`text` en edición
  // inline, controles de formulario nativos — `ComponentDefinition
  // .disallowsClickAction`, docs/20 §3 / AGENTS §T6).
  const candidates = useMemo(() => {
    const list = Object.values(nodes).filter((n) => {
      if (n.id === modalId || n.id === rootId || n.type === "modal") return false;
      const def = getDefinition(n.type);
      return !def?.disallowsClickAction;
    });
    const enriched = list.map((n) => {
      const def = getDefinition(n.type);
      const typeLabel = tc(`components.${n.type}`, { defaultValue: def?.label ?? n.type });
      return {
        node: n,
        typeLabel,
        label: nodeLabel(n, typeLabel),
        isButton: BUTTON_TYPES.has(n.type),
        linked: n.onClick?.type === "open-modal" && n.onClick.target === modalId,
      };
    });
    // Botones primero, luego el resto; dentro de cada grupo, vinculados arriba.
    enriched.sort((a, b) => {
      if (a.isButton !== b.isButton) return a.isButton ? -1 : 1;
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      return 0;
    });
    return enriched;
  }, [nodes, modalId, rootId, tc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = showAll ? candidates : candidates.filter((c) => c.isButton || c.linked);
    if (q === "") return base;
    return base.filter(
      (c) => c.label.toLowerCase().includes(q) || c.typeLabel.toLowerCase().includes(q),
    );
  }, [candidates, showAll, query]);

  const hiddenNonButtons = candidates.filter((c) => !c.isButton && !c.linked).length;

  const toggleLink = (id: NodeId, linked: boolean) => {
    setNodeAction(id, linked ? null : { type: "open-modal", target: modalId });
  };

  const createTrigger = () => {
    addComponent("button", { parentId: rootId, index: 0 });
    const newId = useDocumentStore.getState().selectedId;
    if (newId) setNodeAction(newId, { type: "open-modal", target: modalId });
    // Volver al modal para seguir en el panel de disparadores.
    select(modalId);
  };

  return (
    <section className="pbx-triggers">
      <h4 className="pbx-triggers__title">{t("triggers.title")}</h4>
      <p className="pbx-triggers__hint">{t("triggers.hint")}</p>

      <button type="button" className="pbx-triggers__create" onClick={createTrigger}>
        <Plus size={14} aria-hidden="true" /> {t("triggers.create")}
      </button>

      <input
        type="search"
        className="pbx-triggers__search"
        placeholder={t("triggers.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("triggers.searchPlaceholder")}
      />

      {filtered.length === 0 ? (
        <p className="pbx-triggers__empty">{t("triggers.empty")}</p>
      ) : (
        <ul className="pbx-triggers__list">
          {filtered.map((c) => (
            <li key={c.node.id} className={"pbx-triggers__row" + (c.linked ? " pbx-triggers__row--linked" : "")}>
              <ComponentTypeIcon type={c.node.type} className="pbx-triggers__icon" />
              <span className="pbx-triggers__label" title={c.label}>
                {c.label}
                <span className="pbx-triggers__type">{c.typeLabel}</span>
              </span>
              <button
                type="button"
                className={"pbx-triggers__toggle" + (c.linked ? " pbx-triggers__toggle--on" : "")}
                onClick={() => toggleLink(c.node.id, c.linked)}
                aria-pressed={c.linked}
              >
                <LinkIcon size={13} aria-hidden="true" />
                {c.linked ? t("triggers.linked") : t("triggers.link")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showAll && hiddenNonButtons > 0 ? (
        <button type="button" className="pbx-triggers__more" onClick={() => setShowAll(true)}>
          {t("triggers.showMore", { count: hiddenNonButtons })}
        </button>
      ) : null}
    </section>
  );
}
