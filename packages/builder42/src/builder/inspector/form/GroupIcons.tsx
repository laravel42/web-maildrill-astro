import { SlidersHorizontal } from "@/components";
import type { StyleGroup } from "@/builder/model/types";
import { STYLE_GROUP_ICONS } from "./constants";

export function GroupIcon({ group }: { group: StyleGroup }) {
  const Cmp = STYLE_GROUP_ICONS[group];
  return Cmp ? <Cmp size={12} aria-hidden="true" /> : null;
}

// Icono genérico para grupos de props (mismo tamaño que GroupIcon de estilo)
export function PropGroupIcon() {
  return <SlidersHorizontal size={12} aria-hidden="true" />;
}
