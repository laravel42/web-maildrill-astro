/**
 * BehaviorsSection — contenido de la tab "Interactividad" del Inspector
 * (Z1). Un único `PbxSelect` — mismo control y mismo patrón que
 * `NodeClickActionSection` — lista "ninguno" más cada behavior aplicable al
 * nodo (`behaviorsForNode`, sin agrupar por categoría: con un solo choice
 * visible a la vez, el acordeón por categoría de Fase 3 dejó de tener
 * trabajo que hacer). Elegir uno reemplaza lo que hubiera; elegir "ninguno"
 * lo quita.
 *
 * DECISIÓN 1 (contrato Z1): el límite es solo de UI. `behaviors` en
 * `model/types.ts` sigue siendo un array — no migra. Se mide 3 nodos reales
 * (de 150 con al menos un behavior, en los 18 templates) con más de uno:
 * `sticky + scroll-spy` en las navs de `architecture-studio-page` y
 * `law-firm-page`, y `navbar + scroll-progress` en `portfolio`. El select
 * muestra y edita solo el primero del array; para que ese recorte no borre
 * el resto en silencio (regla de este repo), cuando `node.behaviors.length
 * > 1` se renderiza un aviso plano (misma clase que el de
 * `NodeClickActionSection`, `pbx-click-action__warning`) explicando que hay
 * más behaviors aplicados que este control no muestra y que elegir aquí los
 * reemplaza a todos. Si el usuario más adelante quiere mostrar varios a la
 * vez, esto se revierte en este único archivo (palabras del usuario:
 * "Solo limitamos la UI si despues vemos una mejor manera de presentarlo al
 * usuario lo revertimos solo ahí").
 *
 * Escritura: cada cambio de selección es una sola llamada a
 * `setNodeBehavior(nodeId, type | null)` (store `slices/behaviors.ts`), que
 * reemplaza todo `node.behaviors` dentro de un único `set()` — una sola
 * escritura por cambio (un paso de undo), igual que el `<select>` de acción
 * de click hace un solo `setNodeAction` por cambio. Si el tipo elegido ya
 * estaba activo, `setNodeBehavior` conserva esa instancia (con sus opciones
 * ya editadas) en vez de reconstruirla desde `defaultOptions`.
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { behaviorsForNode, getBehaviorDefinition } from "@/builder/registry/behaviorRegistry";
import type { BuilderNode } from "@/builder/model/types";
import { PbxSelect } from "@/components";
import { OptionsSchemaField } from "./controls/OptionsSchemaField";

const NONE = "__none__";

function BehaviorOptionField({
  nodeId,
  behaviorType,
  field,
  value,
}: {
  nodeId: string;
  behaviorType: string;
  field: import("@/builder/registry/types").FieldSchema;
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

export function BehaviorsSection({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const setNodeBehavior = useDocumentStore((s) => s.setNodeBehavior);

  const applicable = behaviorsForNode(node);

  // El nodo no admite ningún behavior: estado "no disponible" (la tab existe
  // siempre, pero su contenido comunica que aquí no hay nada que activar).
  if (applicable.length === 0) {
    return <p className="pbx-behaviors-empty">{t("behaviors.notAvailable")}</p>;
  }

  const active = node.behaviors ?? [];
  // El select solo puede mostrar/editar uno: el primero del array (decisión 1).
  const current = active[0];
  const currentType = current?.type ?? NONE;
  const currentDef = currentType === NONE ? undefined : getBehaviorDefinition(currentType);
  const hasExtra = active.length > 1;

  const nameFor = (type: string) =>
    t(`behaviors.name.${type}`, { defaultValue: getBehaviorDefinition(type)?.label ?? type });

  const handleChange = (type: string) => {
    // Una sola escritura por cambio (un paso de undo): `setNodeBehavior`
    // reemplaza todo `node.behaviors` dentro de un único `set()`, igual
    // que el select de acción de click hace un solo `setNodeAction`.
    setNodeBehavior(node.id, type === NONE ? null : type);
  };

  return (
    <div className="pbx-behaviors">
      <p className="pbx-behaviors__hint">{t("behaviors.hint")}</p>

      <PbxSelect
        value={currentType}
        ariaLabel={t("behaviors.title")}
        onChange={handleChange}
        options={[
          { value: NONE, label: t("behaviors.none") },
          ...applicable.map((def) => ({ value: def.type, label: nameFor(def.type) })),
        ]}
      />

      {hasExtra ? <p className="pbx-click-action__warning">{t("behaviors.hasMoreWarning")}</p> : null}

      {currentDef?.optionsSchema && currentDef.optionsSchema.fields.length > 0 ? (
        <div className="pbx-behavior-card__options">
          {currentDef.optionsSchema.fields.map((field) => (
            <BehaviorOptionField
              key={field.key}
              nodeId={node.id}
              behaviorType={currentDef.type}
              field={field}
              value={current?.options?.[field.key]}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
