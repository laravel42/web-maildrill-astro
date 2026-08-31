/**
 * ComponentTypeIcon — micro-icono por tipo de componente del registry.
 *
 * Fase 11.f (docs/18): fachada estable sobre iconos **Lucide**. Mantiene la
 * misma API `{ type, className }` que la versión de SVG inline previa — los
 * consumidores (paleta del Sidebar, header compacto del Inspector) no cambian.
 *
 * Chrome del editor (P8): no importa nada de `registry/components/` ni de
 * `export/` (AGENTS.md §5.2). El sizing/color lo controla el consumidor vía
 * `className` (los iconos Lucide usan `currentColor`; el ancho/alto CSS de la
 * clase gana sobre los atributos por defecto del SVG).
 */

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Square,
  Type,
  ImageIcon,
  RectangleHorizontal,
  ChevronsUpDown,
  TextCursorInput,
  SquarePen,
  Tag,
  ClipboardList,
  SendHorizontal,
  Languages,
  Minus,
  MoveVertical,
  Frame,
  Badge,
  Shapes,
  Quote,
  TrendingUp,
  UserRound,
  Video,
  SquareStack,
  PanelTop,
  MessageSquareQuote,
  BadgeDollarSign,
  Images,
  CircleAlert,
  PanelBottom,
  Menu,
  Share2,
  ChevronsRight,
  ChevronsDownUp,
  AppWindow,
  PanelsTopLeft,
  SquareMenu,
  Box,
} from "./Icon";

const TYPE_ICONS: Record<string, ComponentType<LucideProps>> = {
  container: Square,
  text: Type,
  image: ImageIcon,
  button: RectangleHorizontal,
  select: ChevronsUpDown,
  input: TextCursorInput,
  textarea: SquarePen,
  label: Tag,
  form: ClipboardList,
  "button-submit": SendHorizontal,
  "language-nav": Languages,
  divider: Minus,
  spacer: MoveVertical,
  section: Frame,
  badge: Badge,
  icon: Shapes,
  quote: Quote,
  stat: TrendingUp,
  avatar: UserRound,
  video: Video,
  card: SquareStack,
  hero: PanelTop,
  testimonial: MessageSquareQuote,
  "pricing-card": BadgeDollarSign,
  "logo-cloud": Images,
  alert: CircleAlert,
  footer: PanelBottom,
  "nav-menu": Menu,
  "social-links": Share2,
  breadcrumb: ChevronsRight,
  accordion: ChevronsDownUp,
  modal: AppWindow,
  tabs: PanelsTopLeft,
  navbar: SquareMenu,
};

export function ComponentTypeIcon({
  type,
  className = "pbx-palette__icon",
}: {
  type: string;
  className?: string;
}) {
  const IconCmp = TYPE_ICONS[type] ?? Box;
  return <IconCmp className={className} aria-hidden="true" />;
}
