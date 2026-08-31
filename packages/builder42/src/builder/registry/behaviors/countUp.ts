/**
 * Count-up — anima el número de `stat` de 0 al valor final al entrar en
 * viewport (docs/44 §5 fila P1). Tier 1: sin runtime, `stat` sigue mostrando
 * el `value` completo tal cual (el export nunca lo toca) — degradación
 * perfecta (P8/P9), igual criterio que `reveal-on-scroll`.
 *
 * Aplica solo a `stat` (`registry/components/Stat.tsx`): es el único
 * componente cuyo contenido es un número que tiene sentido animar como KPI.
 *
 * **Sobre no compartir el `IntersectionObserver` con `reveal-on-scroll`:**
 * ambos behaviors usan el mismo patrón (observar hasta que entra en viewport,
 * ejecutar un efecto una vez), pero NO hay un helper compartido hoy en
 * `src/runtime/` para esto — extraer uno solo para dos usos, cuando cada
 * `enhance*` ya es un módulo independiente y tree-shakeado por separado
 * (docs/10 §11.2: cada bundle se emite aislado, sin cruzarse), agregaría una
 * dependencia entre módulos de runtime sin necesidad real: los ~10 líneas de
 * `new IntersectionObserver(...)` no justifican el acoplamiento. Se documenta
 * aquí la decisión (AGENTS.md §5, T-plan Fase 3) para que no se reabra sin
 * un tercer caso que sí lo amerite.
 */

import type { BehaviorDefinition } from "../types";

export const countUpBehavior: BehaviorDefinition = {
  type: "count-up",
  label: "Contador animado",
  category: "content",
  appliesTo: (node) => node.type === "stat",
  defaultOptions: { duration: 1500, threshold: 0.3, once: true },
  optionsSchema: {
    fields: [
      {
        key: "duration",
        label: "Duración (ms)",
        control: "number",
        group: "Contador",
        placeholder: "1500",
      },
      {
        key: "threshold",
        label: "Umbral de visibilidad",
        control: "number",
        group: "Contador",
        placeholder: "0.3",
      },
      { key: "once", label: "Solo una vez", control: "toggle", group: "Contador" },
    ],
  },
  runtime: {
    moduleId: "countUp",
    enhance: "enhanceCountUp",
    loadPreview: async () => (await import("../../../runtime/behaviors/countUp")).enhanceCountUp,
  },
};
