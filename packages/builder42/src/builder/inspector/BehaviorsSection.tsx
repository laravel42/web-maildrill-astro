/**
 * BehaviorsSection — contenido de la tab "Interactividad" del Inspector
 * (Fase 11.c). Los behaviors aplicables al nodo se agrupan por categoría
 * (docs/46 §3 Fase 3, H3) en un acordeón — antes era un grid plano de hasta
 * 17 cards, por encima del techo de 4 opciones simultáneas del criterio de
 * aceptación #5. Dentro de cada categoría, el grid de cards se mantiene:
 *  - Card **disponible**: un `<button>` que añade el behavior al hacer click
 *    (icono + nombre + descripción corta + indicador "+").
 *  - Card **activa**: resaltada (borde/fondo acento), con las opciones del
 *    behavior (`optionsSchema`) desplegadas y un botón para quitarlo.
 *  - Si el nodo no admite ningún behavior: estado "no disponible" claro.
 *
 * Sin cambios de lógica de store: sigue usando addBehavior/removeBehavior/
 * setBehaviorOption. El contador de behaviors activos se muestra ahora como
 * badge de la tab (InspectorForm), no aquí.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useDocumentStore } from "@/builder/store/documentStore";
import { behaviorsForNodeByCategory } from "@/builder/registry/behaviorRegistry";
import type { BuilderNode } from "@/builder/model/types";
import type { BehaviorDefinition, FieldSchema } from "@/builder/registry/types";
import {
  IconButton,
  GalleryHorizontal,
  Eye,
  SunMoon,
  Zap,
  Plus,
  CloseIcon,
  ChevronDown,
} from "@/components";
import { OptionsSchemaField } from "./controls/OptionsSchemaField";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

// Icono por tipo de behavior (interactividad) — Lucide (Fase 11.f)
const BEHAVIOR_ICONS: Record<string, ComponentType<LucideProps>> = {
  carousel: GalleryHorizontal,
  "reveal-on-scroll": Eye,
  "theme-toggle": SunMoon,
};

function BehaviorIcon({ type }: { type: string }) {
  const Cmp = BEHAVIOR_ICONS[type] ?? Zap;
  return <Cmp size={16} aria-hidden="true" />;
}

/**
 * Acordeón de categoría de behaviors — mismo patrón visual (clases
 * `pbx-style-group*`, ya existentes en `inspector-controls.css`) que
 * `CategoryAccordion` de `Sidebar.tsx` y `TokenGroupAccordion` de
 * `TokensEditor.tsx`: reutiliza el chrome ya construido en vez de declarar
 * CSS nueva. No se extrae a un componente compartido porque cada uno vive en
 * un dominio distinto del Inspector con su propio dato de "count" (docs/46
 * §3 Fase 3 solo pide agrupar `BehaviorsSection` y `Sidebar`, no unificar el
 * primitivo).
 */
function BehaviorCategoryAccordion({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`pbx-style-group${open ? " pbx-style-group--open" : " pbx-style-group--collapsed"}`}>
      <button
        type="button"
        className="pbx-style-group__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="pbx-style-group__name">
          {title} ({count})
        </span>
        <motion.span
          className="pbx-palette__accordion-chevron"
          aria-hidden="true"
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="pbx-palette__accordion-body-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="pbx-style-group__body">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BehaviorOptionField({
  nodeId,
  behaviorType,
  field,
  value,
}: {
  nodeId: string;
  behaviorType: string;
  field: FieldSchema;
  value: unknown;
}) {
  const { t } = useTranslation("inspector");
  const setBehaviorOption = useDocumentStore((s) => s.setBehaviorOption);

  // Label traducido: clave `behaviors.fields.<type>.<key>` con fallback al
  // `field.label` hardcodeado del behavior (P9 sin romper behaviors sin clave).
  const fieldLabel = t(`behaviors.fields.${behaviorType}.${field.key}`, {
    defaultValue: field.label,
  });

  return (
    <OptionsSchemaField
      field={field}
      value={value}
      label={fieldLabel}
      optionKeyPrefix={`behaviors.fields.${behaviorType}.${field.key}`}
      onChange={(v) => setBehaviorOption(nodeId, behaviorType, field.key, v)}
    />
  );
}

/**
 * Una card de behavior (disponible o activa). Extraído para reutilizarse
 * dentro de cada grupo de categoría sin duplicar el JSX.
 */
function BehaviorCard({ node, def }: { node: BuilderNode; def: BehaviorDefinition }) {
  const { t } = useTranslation("inspector");
  const addBehavior = useDocumentStore((s) => s.addBehavior);
  const removeBehavior = useDocumentStore((s) => s.removeBehavior);
  const active = node.behaviors ?? [];
  const isActive = active.some((b) => b.type === def.type);
  const desc = t(`behaviors.desc.${def.type}`, { defaultValue: "" });
  // Nombre traducido: clave `behaviors.name.<type>` con fallback al
  // `def.label` hardcodeado del registro (P9, mismo patrón que `desc`).
  const name = t(`behaviors.name.${def.type}`, { defaultValue: def.label });

  // ---- Card disponible (inactiva): botón que añade el behavior ----
  if (!isActive) {
    return (
      <motion.button
        type="button"
        className="pbx-behavior-card pbx-behavior-card--available"
        onClick={() => addBehavior(node.id, def.type)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <span className="pbx-behavior-card__head">
          <span className="pbx-behavior-card__icon">
            <BehaviorIcon type={def.type} />
          </span>
          <span className="pbx-behavior-card__name">{name}</span>
          <span className="pbx-behavior-card__plus" aria-hidden="true">
            <Plus size={10} strokeWidth={2} />
          </span>
        </span>
        {desc && <span className="pbx-behavior-card__desc">{desc}</span>}
      </motion.button>
    );
  }

  // ---- Card activa: opciones + botón quitar ----
  const instance = active.find((b) => b.type === def.type);
  return (
    <div className="pbx-behavior-card pbx-behavior-card--active">
      <div className="pbx-behavior-card__head">
        <span className="pbx-behavior-card__icon">
          <BehaviorIcon type={def.type} />
        </span>
        <span className="pbx-behavior-card__name">{name}</span>
        <IconButton
          icon={CloseIcon}
          intent="danger"
          onClick={() => removeBehavior(node.id, def.type)}
          label={`${t("behaviors.remove")} ${name}`}
        />
      </div>

      {def.optionsSchema && def.optionsSchema.fields.length > 0 && (
        <div className="pbx-behavior-card__options">
          {def.optionsSchema.fields.map((field) => (
            <BehaviorOptionField
              key={field.key}
              nodeId={node.id}
              behaviorType={def.type}
              field={field}
              value={instance?.options?.[field.key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BehaviorsSection({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");

  const groups = behaviorsForNodeByCategory(node);

  // El nodo no admite ningún behavior: estado "no disponible" (la tab existe
  // siempre, pero su contenido comunica que aquí no hay nada que activar).
  if (groups.length === 0) {
    return <p className="pbx-behaviors-empty">{t("behaviors.notAvailable")}</p>;
  }

  const active = node.behaviors ?? [];
  const activeTypes = new Set(active.map((b) => b.type));

  return (
    <div className="pbx-behaviors">
      <p className="pbx-behaviors__hint">{t("behaviors.hint")}</p>
      {groups.map((group, idx) => {
        const hasActiveInGroup = group.definitions.some((def) => activeTypes.has(def.type));
        return (
          <BehaviorCategoryAccordion
            key={group.category}
            title={t(`behaviors.categories.${group.category}`)}
            count={group.definitions.length}
            // Abierto por defecto si ya tiene algo activo, o es el primer
            // grupo con contenido (evita que el catálogo se vea vacío en el
            // primer render de un nodo sin ningún behavior aplicado todavía).
            defaultOpen={hasActiveInGroup || idx === 0}
          >
            <div className="pbx-behaviors-grid">
              {group.definitions.map((def) => (
                <BehaviorCard key={def.type} node={node} def={def} />
              ))}
            </div>
          </BehaviorCategoryAccordion>
        );
      })}
    </div>
  );
}
