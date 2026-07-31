import React, { type CSSProperties } from 'react';
import { z } from 'zod';

import { ContainerPropsSchema } from '@eb/document-core';

import Wrapper from '../../email-builder/src/blocks/helpers/Wrapper';
import { getPadding } from '../../email-builder/src/helpers/getCssProperties';
import {
  getRoundedCorners,
  shortCssId,
  updateHexColorInBackgroundString,
} from '../../email-builder/src/helpers/utils';
import { useImageUploading } from '../../email-builder/src/Reader/renderContext';
import { useViewport } from '../../email-builder/src/Reader/viewport';

export { ContainerPropsSchema };

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

export type ContainerProps = {
  style?: z.infer<typeof ContainerPropsSchema>['style'];
  children?: React.ReactElement | React.ReactElement[] | null;
  blockId: string;
};

export function Container({ style, children, blockId }: ContainerProps) {
  const selectedScreenSize = useViewport();
  const imageUploading = useImageUploading();

  const wStyle = {
    border: {
      color: style?.borderColor ?? undefined,
      top:
        (selectedScreenSize == 'desktop'
          ? style?.borderTop
          : (style?.borderTopMobile ?? style?.borderTop)) ?? undefined,
      bottom:
        (selectedScreenSize == 'desktop'
          ? style?.borderBottom
          : (style?.borderBottomMobile ?? style?.borderBottom)) ?? undefined,
      left:
        (selectedScreenSize == 'desktop'
          ? style?.borderLeft
          : (style?.borderLeftMobile ?? style?.borderLeft)) ?? undefined,
      right:
        (selectedScreenSize == 'desktop'
          ? style?.borderRight
          : (style?.borderRightMobile ?? style?.borderRight)) ?? undefined,
    },
    padding: getPadding(
      selectedScreenSize == 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding),
    ),
  };

  const background = style?.background ?? '';
  const backgroundColor = style?.backgroundColor;

  const backgroundString = backgroundColor
    ? updateHexColorInBackgroundString(background, backgroundColor)
    : background;

  const containerBorderRadius = getRoundedCorners(style);

  const sid = shortCssId(blockId);
  if (!children) {
    return (
      <Wrapper
        className={`${sid}`}
        background={backgroundString}
        backgroundColor={backgroundColor}
        borderRadius={containerBorderRadius}
        padding={wStyle.padding}
        width={'100%'}
        border={wStyle.border}
      >
        <div>
          {imageUploading.uploading && imageUploading.id === blockId && (
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
          )}
        </div>
      </Wrapper>
    );
  }
  return (
    <Wrapper
      className={`${sid}`}
      background={backgroundString}
      backgroundColor={style?.backgroundColor}
      borderRadius={containerBorderRadius}
      padding={wStyle.padding}
      width={'100%'}
      border={wStyle.border}
    >
      <>
        {imageUploading.uploading && imageUploading.id === blockId && (
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
        )}
        {children}
      </>
    </Wrapper>
  );
}
