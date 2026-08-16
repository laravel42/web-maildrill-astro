import React, { type CSSProperties } from 'react';
import { z } from 'zod';

import { ColumnsContainerPropsSchema, PADDING_SCHEMA } from '@eb/document-core';

import Wrapper from '../../email-builder/src/blocks/helpers/Wrapper';
import { getPadding } from '../../email-builder/src/helpers/getCssProperties';
import {
  shortCssId,
  updateHexColorInBackgroundString,
} from '../../email-builder/src/helpers/utils';
import { useImageUploading } from '../../email-builder/src/Reader/renderContext';
import { useViewport } from '../../email-builder/src/Reader/viewport';

export { ColumnsContainerPropsSchema };

const loaderContainerStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

type TColumn = React.ReactElement | React.ReactElement[] | null;
export type ColumnsContainerProps = z.infer<typeof ColumnsContainerPropsSchema> & {
  columns?: TColumn[];
};

const ColumnsContainerPropsDefaults = {
  columnsCount: 2,
  contentAlignment: 'middle',
  columnsGap: 0,
} as const;

export function ColumnsContainer({ style, columns, props, blockId }: ColumnsContainerProps) {
  const selectedScreenSize = useViewport();
  const imageUploading = useImageUploading();

  const wStyle: CSSProperties = {
    padding: getPadding(
      selectedScreenSize == 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding),
    ) as any,
  };
  const blockProps = {
    columnsCount: props?.columnsCount ?? ColumnsContainerPropsDefaults.columnsCount,
    contentAlignment:
      selectedScreenSize == 'desktop'
        ? (props?.contentAlignment ?? ColumnsContainerPropsDefaults.contentAlignment)
        : (props?.contentAlignmentMobile ??
          props?.contentAlignment ??
          ColumnsContainerPropsDefaults.contentAlignment),
    fixedWidths: props?.fixedWidths,
    columnsGap: props?.columnsGap ?? ColumnsContainerPropsDefaults.columnsGap,
    blockId,
  };

  const background = style?.background ?? '';
  const backgroundColor = style?.backgroundColor;

  const backgroundString = backgroundColor
    ? updateHexColorInBackgroundString(background, backgroundColor)
    : background;

  const sid = shortCssId(blockId as any);
  const stackMobilePreview =
    selectedScreenSize === 'mobile' && Boolean(props?.stackColumnsOnMobile);
  const rowStackStyle: CSSProperties | undefined = stackMobilePreview
    ? { display: 'block', width: '100%' }
    : undefined;

  return (
    <Wrapper
      background={backgroundString}
      backgroundColor={backgroundColor}
      className={`${sid}`}
      padding={wStyle.padding as any}
      width={`100%`}
    >
      {imageUploading.uploading && imageUploading.id === blockId ? (
        <div style={loaderContainerStyle}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-loader-circle"
            style={{
              width: '32px',
              height: '32px',
              animation: '1s linear infinite spin',
              stroke: 'currentColor',
            }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </div>
      ) : (
        <></>
      )}
      <table border={0} cellSpacing="0" cellPadding="0" style={{ width: '100%', ...rowStackStyle }}>
        <tbody style={{ width: '100%', ...rowStackStyle }}>
          <tr style={{ width: '100%', ...rowStackStyle }}>
            <TableCell
              index={0}
              props={blockProps as any}
              columns={columns}
              stackMobilePreview={stackMobilePreview}
            />
            <TableCell
              index={1}
              props={blockProps as any}
              columns={columns}
              stackMobilePreview={stackMobilePreview}
            />
            {blockProps.columnsCount === 3 && (
              <TableCell
                index={2}
                props={blockProps as any}
                columns={columns}
                stackMobilePreview={stackMobilePreview}
              />
            )}
          </tr>
        </tbody>
      </table>
    </Wrapper>
  );
}

type Props = {
  props: {
    padding: z.infer<typeof PADDING_SCHEMA>;
    fixedWidths:
      | [number | null | undefined, number | null | undefined, number | null | undefined]
      | null
      | undefined;
    columnsCount: 2 | 3;
    contentAlignment: 'top' | 'middle' | 'bottom';
    columnsGap?: number | null;
    blockId?: string;
  };
  index: number;
  columns?: TColumn[];
  stackMobilePreview?: boolean;
};
function TableCell({ index, props, columns, stackMobilePreview }: Props) {
  const contentAlignment =
    props?.contentAlignment ?? ColumnsContainerPropsDefaults.contentAlignment;
  const columnsCount = props?.columnsCount ?? ColumnsContainerPropsDefaults.columnsCount;

  const fixedWidthPct = props.fixedWidths?.[index];

  // Auto-distribute width when no fixed widths are set
  const autoWidth = fixedWidthPct == null ? `${100 / columnsCount}%` : undefined;

  // The gap is carried as padding on the facing edges of adjacent cells, half
  // on each, so the outer edges stay flush with the block and the column
  // percentages still add up to the full width. Stacked cells are full width,
  // so the horizontal inset would only shrink them — the export sheet drops it
  // in the mobile media query for the same reason.
  const gap = Math.max(0, props.columnsGap ?? ColumnsContainerPropsDefaults.columnsGap);
  const gapStyle: CSSProperties =
    gap > 0 && !stackMobilePreview
      ? {
          paddingLeft: index === 0 ? 0 : gap / 2,
          paddingRight: index === columnsCount - 1 ? 0 : gap / 2,
        }
      : {};

  const style: CSSProperties = {
    boxSizing: 'border-box',
    verticalAlign: contentAlignment,
    width: fixedWidthPct != null ? `${fixedWidthPct}%` : autoWidth,
    ...gapStyle,
    ...(stackMobilePreview ? { display: 'block', width: '100%' } : {}),
  };
  const children = (columns && columns[index]) ?? null;
  const sid = props.blockId ? shortCssId(props.blockId) : '';
  return (
    <td className={`col${sid}`} style={style}>
      {children}
    </td>
  );
}
