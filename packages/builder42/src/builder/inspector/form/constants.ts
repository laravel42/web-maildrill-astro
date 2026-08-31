import { LayoutGrid, Move, Ruler, Palette, Type } from "@/components";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { StyleGroup } from "@/builder/model/types";

export const ALL_GROUPS: StyleGroup[] = ["layout", "spacing", "size", "appearance", "typography"];

export const GENERAL_PROP_GROUP = "__general__";

/** Íconos por grupo de estilo — Lucide (Fase 11.f) */
export const STYLE_GROUP_ICONS: Record<StyleGroup, ComponentType<LucideProps>> = {
  layout: LayoutGrid,
  spacing: Move,
  size: Ruler,
  appearance: Palette,
  typography: Type,
};
