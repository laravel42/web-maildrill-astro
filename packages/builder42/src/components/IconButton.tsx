/**
 * IconButton — primitivo compartido de botón-icono del CHROME del editor
 * (Fase 19.a, docs/19). Unifica los botones-icono que antes tenían estilo
 * propio divergente (colores/forma/tamaño) por panel.
 *
 * - Icono vía Lucide (prop `icon`, una fachada de `@/components` — nunca
 *   `lucide-react` directo, AGENTS.md §5.2) o `children` para casos especiales.
 * - `label` es obligatorio: estos botones no tienen texto visible, así que el
 *   `aria-label`/`title` es la única etiqueta accesible.
 * - Toda la lógica de color/hover vive en `.pbx-icon-btn` (chrome.css), aquí solo
 *   se componen las clases de tamaño/intent/estado.
 *
 * Regla dura (P8): chrome del editor. Nunca se importa desde
 * `registry/components/` ni `export/`.
 */

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";

/** Firma mínima compatible con los iconos Lucide re-exportados por `@/components`. */
type IconComponent = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

export type IconButtonSize = "sm" | "md";
export type IconButtonIntent = "ghost" | "danger" | "accent";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Icono Lucide a renderizar. Alternativa: `children`. */
  icon?: IconComponent;
  /** Contenido alternativo si no se pasa `icon` (p. ej. un glifo o SVG propio). */
  children?: ReactNode;
  /** Etiqueta accesible (aria-label + title). Obligatoria. */
  label: string;
  /** Tamaño de la caja: `sm` 22×22 (default), `md` 26×26. */
  size?: IconButtonSize;
  /** Semántica de color en hover/activo. */
  intent?: IconButtonIntent;
  /** Estado activo (toggle encendido): resalta con la capa de acento. */
  active?: boolean;
}

const ICON_PX: Record<IconButtonSize, number> = { sm: 14, md: 16 };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      children,
      label,
      size = "sm",
      intent = "ghost",
      active = false,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const classes = [
      "pbx-icon-btn",
      `pbx-icon-btn--${size}`,
      `pbx-icon-btn--${intent}`,
      active ? "pbx-icon-btn--active" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        aria-label={label}
        title={label}
        aria-pressed={active ? true : undefined}
        {...rest}
      >
        {Icon ? <Icon size={ICON_PX[size]} strokeWidth={2} aria-hidden /> : children}
      </button>
    );
  },
);
