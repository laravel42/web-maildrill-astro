import React from 'react';

type Padding = {
  top: string | number | undefined;
  right: string | number | undefined;
  bottom: string | number | undefined;
  left: string | number | undefined;
};

type Border = {
  color?: string;
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
};

type Props = {
  className?: string;
  background?: string | null;
  backgroundColor?: string | null;
  padding?: Padding;
  width?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactElement | React.ReactElement[];
  childrenWidth?: string | number;
  border?: Border;
  borderRadius?: number | string | null;
  isParent?: boolean;
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto' | 'inherit' | 'initial' | 'unset';
  display?: 'block' | 'inline-block';
  /** When set (e.g. 0 for Divider), avoids inherited layout line-height inflating table cell height. */
  lineHeight?: React.CSSProperties['lineHeight'];
  /** When set (e.g. 0 for Divider with lineHeight 0), removes font-metrics strut so 1px lines stay 1px. */
  fontSize?: React.CSSProperties['fontSize'];
};

function getBorder(
  border: Border | undefined,
  side: 'top' | 'bottom' | 'left' | 'right',
): string | undefined {
  if (!border || (border && border[side] === 0)) {
    return 'initial';
  }

  return border[side] !== undefined
    ? `${border[side]}px solid ${border?.color ?? 'black'}`
    : 'initial';
}

/**
 * Pure presentational table wrapper shared by block renderers. Lives in
 * `@eb/email-builder` (not the editor app) so blocks render in a
 * Node-safe context. No store, no DOM, no editor deps.
 */
export default function Wrapper({
  className,
  background,
  backgroundColor,
  padding = { top: 0, right: 0, bottom: 0, left: 0 },
  width,
  align,
  children,
  border,
  borderRadius,
  isParent = true,
  overflow = 'visible',
  display,
  lineHeight,
  fontSize,
}: Props) {
  const alignClassName = className ? `a${className}` : '';

  // Para evitar conflictos entre la propiedad shorthand `background` y `backgroundColor`,
  // solo aplicamos una de ellas en el style final:
  // - Si `background` está definido (por ejemplo, degradados o imágenes), se usa exclusivamente.
  // - Si no hay `background`, se usa `backgroundColor` como color de fondo.
  const tableStyle: React.CSSProperties = {
    width: width,
    minWidth: width,
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(lineHeight !== undefined ? { lineHeight } : {}),
    ...(display !== undefined ? { display } : {}),
    borderRadius: borderRadius ?? 'initial',
    borderTop: getBorder(border, 'top'),
    borderBottom: getBorder(border, 'bottom'),
    borderLeft: getBorder(border, 'left'),
    borderRight: getBorder(border, 'right'),
    overflow: overflow,
    borderCollapse: 'initial',
  };

  if (background && String(background).trim() !== '') {
    (tableStyle as any).background = background;
  } else if (backgroundColor) {
    (tableStyle as any).backgroundColor = backgroundColor;
  }

  const padLeft = Math.max(0, Number(padding.left) || 0);
  const padRight = Math.max(0, Number(padding.right) || 0);
  const leftColStyle: React.CSSProperties = { width: `${padLeft}px` };
  const rightColStyle: React.CSSProperties = { width: `${padRight}px` };
  const centerTdMetrics: React.CSSProperties | undefined =
    fontSize !== undefined || lineHeight !== undefined
      ? {
          ...(fontSize !== undefined ? { fontSize } : {}),
          ...(lineHeight !== undefined ? { lineHeight } : {}),
        }
      : undefined;

  return (
    <table
      className={className}
      width={width}
      border={0}
      cellSpacing="0"
      cellPadding="0"
      style={{ ...tableStyle, tableLayout: 'fixed' }}
    >
      {/* Omit colgroup: with fixed layout on narrow widths it starved the center column; tds set side widths. */}
      <tbody>
        <tr
          style={{ height: `${padding.top}px` }}
          className={isParent ? `t${className}` : `it${className}`}
        >
          <td style={leftColStyle} className={isParent ? `l${className}` : `il${className}`}></td>
          <td style={{ width: '100%' }} />
          <td style={rightColStyle} className={isParent ? `r${className}` : `ir${className}`}></td>
        </tr>
        <tr>
          <td style={leftColStyle} className={isParent ? `l${className}` : `il${className}`}></td>
          <td
            className={alignClassName}
            align={align}
            style={{ width: '100%', ...centerTdMetrics }}
          >
            {children}
          </td>
          <td style={rightColStyle} className={isParent ? `r${className}` : `ir${className}`}></td>
        </tr>
        <tr
          style={{ height: `${padding.bottom}px` }}
          className={isParent ? `b${className}` : `ib${className}`}
        >
          <td style={leftColStyle} className={isParent ? `l${className}` : `il${className}`}></td>
          <td style={{ width: '100%' }} />
          <td style={rightColStyle} className={isParent ? `r${className}` : `ir${className}`}></td>
        </tr>
      </tbody>
    </table>
  );
}
