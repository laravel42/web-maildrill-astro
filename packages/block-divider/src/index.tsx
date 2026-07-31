import React from 'react';

import { type DividerProps, DividerPropsSchema } from '@eb/document-core';

import Wrapper from '../../email-builder/src/blocks/helpers/Wrapper';
import { getPadding } from '../../email-builder/src/helpers/getCssProperties';
import {
  shortCssId,
  updateHexColorInBackgroundString,
} from '../../email-builder/src/helpers/utils';
import { useViewport } from '../../email-builder/src/Reader/viewport';

export { DividerPropsSchema, type DividerProps };

export const DividerPropsDefaults = {
  height: 1,
  color: '#333333',
  width: 100,
  textAlign: 'left',
};

export function Divider({ style, blockId }: DividerProps) {
  const selectedScreenSize = useViewport();
  const padding = getPadding(
    selectedScreenSize === 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding),
  );
  const height =
    selectedScreenSize === 'desktop' ? style?.height : (style?.heightMobile ?? style?.height);
  const color = style?.color;
  const widthValue =
    selectedScreenSize === 'desktop' ? style?.width : (style?.widthMobile ?? style?.width);
  const width = widthValue == null ? undefined : `${widthValue}%`;
  const align =
    selectedScreenSize === 'desktop'
      ? style?.textAlign
      : (style?.textAlignMobile ?? style?.textAlign);
  const background = style?.background ?? '';
  const backgroundColor = style?.backgroundColor ?? '';

  const backgroundString = backgroundColor
    ? updateHexColorInBackgroundString(background, backgroundColor)
    : background;

  const sid = shortCssId(blockId as any);
  return (
    <Wrapper
      className={`c${sid}`}
      background={backgroundString}
      backgroundColor={backgroundColor}
      width={'100%'}
      padding={padding}
      align={align as any}
      lineHeight={0}
      fontSize={0}
    >
      <Wrapper
        display={'inline-block'}
        className={`${sid}`}
        background={color}
        backgroundColor={backgroundColor}
        width={width}
        padding={{ top: height ?? 0, bottom: 0, left: 0, right: 0 }}
        isParent={false}
        lineHeight={0}
        fontSize={0}
      >
        <div
          style={{
            margin: 0,
            padding: 0,
            height: 0,
            overflow: 'hidden',
            fontSize: 0,
            lineHeight: 0,
          }}
        />
      </Wrapper>
    </Wrapper>
  );
}
