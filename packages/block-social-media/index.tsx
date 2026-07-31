import React, { Fragment } from 'react';

import { type SocialMediaProps, SocialMediaPropsSchema } from '@eb/document-core';

import Wrapper from '../email-builder/src/blocks/helpers/Wrapper';
import { getCleanURL } from '../email-builder/src/helpers/formatting';
import { getPadding } from '../email-builder/src/helpers/getCssProperties';
import { shortCssId } from '../email-builder/src/helpers/utils';
import { useDisableEdition } from '../email-builder/src/Reader/renderContext';
import { useViewport } from '../email-builder/src/Reader/viewport';

import { IconOptions } from './utils/icons';

/** Re-export as BlockSocialMediaPropsScheme for backward compatibility. */
export const BlockSocialMediaPropsScheme = SocialMediaPropsSchema;
export type { SocialMediaProps };

type SocialWrapperLayout = {
  background: string;
  backgroundColor?: string | null;
  textAlign?: 'left' | 'center' | 'right';
  padding: { top: number; right: number; bottom: number; left: number };
};

export function BlockSocialMedia({
  style,
  items,
  blockId,
  gap = 1,
  gapMobile,
  isNotClient = false,
}: SocialMediaProps & { isNotClient?: boolean }) {
  const selectedScreenSize = useViewport();

  const background = style?.background ?? '';

  const textAlign: 'left' | 'center' | 'right' | undefined =
    (selectedScreenSize === 'desktop'
      ? style?.textAlign
      : (style?.textAlignMobile ?? style?.textAlign)) ?? undefined;

  const wStyle: SocialWrapperLayout = {
    background,
    backgroundColor: style?.backgroundColor,
    textAlign,
    padding: getPadding(
      selectedScreenSize === 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding),
    ),
  };
  const localGap = selectedScreenSize === 'desktop' ? gap : (gapMobile ?? gap);
  const sid = shortCssId(blockId as any);
  const disableEdition = useDisableEdition();
  /** Only on the editing canvas; preview/export (isNotClient) must emit real links. */
  const guardLinksWhileEditingOnCanvas = !disableEdition && !isNotClient;
  return (
    <SocialContainer
      blockId={`${sid}`}
      items={items as IconOptions[]}
      wStyle={wStyle}
      gap={localGap}
      guardLinksWhileEditingOnCanvas={guardLinksWhileEditingOnCanvas}
    />
  );
}

const SocialContainer = ({
  items,
  blockId,
  wStyle,
  gap,
  guardLinksWhileEditingOnCanvas,
}: {
  items: IconOptions[];
  blockId: string;
  wStyle: SocialWrapperLayout;
  gap: number;
  guardLinksWhileEditingOnCanvas: boolean;
}) => {
  const gapPerItem = (idx: number) => {
    switch (idx) {
      case 0:
        return 'first';
      case items.length - 1:
        return 'last';
      default:
        return 'inside';
    }
  };
  return (
    <Wrapper
      className={blockId}
      background={wStyle.background}
      backgroundColor={wStyle.backgroundColor}
      padding={wStyle?.padding}
      align={wStyle.textAlign}
      width={'100%'}
    >
      <table
        className="sm-icons-table"
        style={{
          borderCollapse: 'collapse',
          display: 'inline-block',
          lineHeight: 0,
          verticalAlign: 'top',
        }}
        border={0}
        cellSpacing="0"
        cellPadding="0"
      >
        <tbody>
          <tr style={{ verticalAlign: 'top' }}>
            {items.map((item, index) => {
              const position = gapPerItem(index);
              return (
                <Fragment key={item.id}>
                  {position !== 'first' && (
                    <td
                      className={`gap-${blockId}`}
                      width={Math.ceil(gap / 2)}
                      style={{ lineHeight: 0, verticalAlign: 'top' }}
                    />
                  )}
                  <td
                    key={`${item.id}-${item.url}`}
                    id={`${item.id}-${item.url}`}
                    width={item.sizePx}
                    style={{
                      lineHeight: 0,
                      textAlign: 'center',
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <a
                      key={`item_${index}`}
                      target="_blank"
                      href={guardLinksWhileEditingOnCanvas ? undefined : getCleanURL(item.href)}
                      onClick={
                        guardLinksWhileEditingOnCanvas
                          ? (e: React.MouseEvent) => e.preventDefault()
                          : undefined
                      }
                      style={{
                        display: 'block',
                        lineHeight: 0,
                        textDecoration: 'none',
                        pointerEvents: guardLinksWhileEditingOnCanvas ? 'none' : undefined,
                      }}
                    >
                      <img
                        src={item.url}
                        alt={item.key}
                        style={{
                          width: item.sizePx || 36,
                          height: item.sizePx || 36,
                          display: 'block',
                        }}
                      />
                    </a>
                  </td>
                  {position !== 'last' && (
                    <td
                      className={`gap-${blockId}`}
                      width={Math.ceil(gap / 2)}
                      style={{ lineHeight: 0, verticalAlign: 'top' }}
                    />
                  )}
                </Fragment>
              );
            })}
          </tr>
        </tbody>
      </table>
    </Wrapper>
  );
};
