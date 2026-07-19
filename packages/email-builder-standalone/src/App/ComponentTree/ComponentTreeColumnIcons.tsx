import React from 'react';

import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

const VIEW_BOX = '0 0 67 67';

/** Two-column row container — paths from `src/assets/columns-2.svg`. */
export function Columns2TreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M30.71,50.25H11.16V16.75h19.55v33.5ZM36.3,50.25V16.75h19.54v33.5h-19.54Z"
      />
    </SvgIcon>
  );
}

/** Left slot in a 2-column row — paths from `src/assets/columns-2-left.svg`. */
export function Columns2LeftSlotTreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M30.71,50.25H11.16V16.75h19.55v33.5Z"
      />
    </SvgIcon>
  );
}

/** Right slot in a 2-column row — paths from `src/assets/columns-2-right.svg`. */
export function Columns2RightSlotTreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M36.3,50.25V16.75h19.54v33.5h-19.54Z"
      />
    </SvgIcon>
  );
}

/** Three equal columns (container with 3-column layout). */
export function ColumnsTreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M22.33,50.25h-11.17V16.75h11.17v33.5ZM39.08,50.25h-11.17V16.75h11.17v33.5ZM55.83,50.25h-11.17V16.75h11.17v33.5Z"
      />
    </SvgIcon>
  );
}

/** Narrow left column in a 2-column row. */
export function LeftColumnTreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M39.08,50.25h-11.17V16.75h11.17v33.5ZM55.83,50.25h-11.17V16.75h11.17v33.5Z"
      />
    </SvgIcon>
  );
}

/** Center column in a 3-column row. */
export function CenterColumnTreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M22.33,50.25h-11.17V16.75h11.17v33.5ZM55.83,50.25h-11.17V16.75h11.17v33.5Z"
      />
    </SvgIcon>
  );
}

/** Narrow right column in a 2-column row. */
export function RightColumnTreeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox={VIEW_BOX}>
      <path
        fill="currentColor"
        d="M55.83,11.17H11.17c-3.07,0-5.58,2.51-5.58,5.58v33.5c0,3.07,2.51,5.58,5.58,5.58h44.67c3.07,0,5.58-2.51,5.58-5.58V16.75c0-3.07-2.51-5.58-5.58-5.58M22.33,50.25h-11.17V16.75h11.17v33.5ZM39.08,50.25h-11.17V16.75h11.17v33.5Z"
      />
    </SvgIcon>
  );
}

export type ColumnTreeIconComponent = React.ComponentType<SvgIconProps>;

export function selectSlotColumnIconComponent(columnsCount: 2 | 3, columnIndex: number): ColumnTreeIconComponent {
  if (columnsCount === 2) {
    return columnIndex === 0 ? Columns2LeftSlotTreeIcon : Columns2RightSlotTreeIcon;
  }
  if (columnIndex === 0) return LeftColumnTreeIcon;
  if (columnIndex === 1) return CenterColumnTreeIcon;
  return RightColumnTreeIcon;
}
