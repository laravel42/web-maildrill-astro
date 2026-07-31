import React, { CSSProperties } from 'react';
import { z } from 'zod';

import { type ButtonProps, ButtonPropsSchema, type EmailLayoutProps, PADDING_SCHEMA } from '@eb/document-core';

import Wrapper from '../../email-builder/src/blocks/helpers/Wrapper';
import { useFontFamily } from '../../email-builder/src/helpers/fontFamily';
import { getCleanURL } from '../../email-builder/src/helpers/formatting';
import { getRoundedCorners, shortCssId, updateHexColorInBackgroundString } from '../../email-builder/src/helpers/utils';
import { useDisableEdition, useRootData } from '../../email-builder/src/Reader/renderContext';
import { useViewport } from '../../email-builder/src/Reader/viewport';

export { ButtonPropsSchema, type ButtonProps };

const getPadding = (padding: z.infer<typeof PADDING_SCHEMA>) => {
  return {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };
};

type ButtonSizeProp = NonNullable<NonNullable<ButtonProps['props']>['size']>;

function getButtonSizePadding(size: ButtonSizeProp | undefined | null): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (size != null && typeof size !== 'string') {
    return {
      top: size.top ?? 0,
      right: size.right ?? 0,
      bottom: size.bottom ?? 0,
      left: size.left ?? 0,
    };
  }
  switch (size) {
    case 'x-small':
      return {
        top: 4,
        bottom: 4,
        right: 8,
        left: 8,
      };
    case 'small':
      return {
        top: 8,
        bottom: 8,
        right: 12,
        left: 12,
      };
    case 'medium':
    default:
      return {
        top: 12,
        bottom: 12,
        left: 20,
        right: 20,
      };
  }
}

export const ButtonPropsDefaults = {
  text: '',
  url: '',
  fullWidth: false,
  fullWidthMobile: false,
  size: 'medium',
  sizeMobile: 'medium',
  shape: 'rounded',
  buttonTextColor: '#FFFFFF',
  buttonBackgroundColor: '#999999',
} as const;

export function Button({ style, props, blockId, isNotClient = false }: ButtonProps & { isNotClient?: boolean }) {
  const root = useRootData<EmailLayoutProps>();
  const selectedScreenSize = useViewport();
  const disableEdition = useDisableEdition();
  /** Only on the editing canvas; preview/export (isNotClient) must allow real link navigation. */
  const guardLinksWhileEditingOnCanvas = !disableEdition && !isNotClient;
  const text = props?.text ?? ButtonPropsDefaults.text;
  const url = props?.url ?? ButtonPropsDefaults.url;
  const fullWidth =
    selectedScreenSize === 'desktop'
      ? (props?.fullWidth ?? false)
      : (props?.fullWidthMobile ?? props?.fullWidth ?? false);
  const buttonTextColor = style?.buttonTextColor ?? props?.buttonTextColor ?? root?.textColor ?? undefined;
  const buttonBackgroundColor =
    style?.buttonBackgroundColor ?? props?.buttonBackgroundColor ?? ButtonPropsDefaults.buttonBackgroundColor;

  const wrapperStyle = {
    backgroundColor: style?.backgroundColor ?? undefined,
    textAlign:
      (selectedScreenSize == 'desktop' ? style?.textAlign : (style?.textAlignMobile ?? style?.textAlign)) ?? undefined,
    padding: getPadding(selectedScreenSize == 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding)),
  };
  const linkStyle: CSSProperties = {
    color: buttonTextColor,
    fontSize:
      (selectedScreenSize == 'desktop' ? style?.fontSize : (style?.fontSizeMobile ?? style?.fontSize)) ?? undefined,
    fontFamily: useFontFamily(style?.fontFamily),
    fontWeight: style?.fontWeight ?? undefined,
    lineHeight: style?.lineHeight ?? undefined,
    display: 'inline-block',
    textDecoration: 'none',
  };
  const border = {
    color: style?.borderColor as string | undefined,
    top: (selectedScreenSize == 'desktop'
      ? (style?.borderTop ?? undefined)
      : (style?.borderTopMobile ?? style?.borderTop)) as number | undefined,
    bottom: (selectedScreenSize == 'desktop'
      ? (style?.borderBottom ?? undefined)
      : (style?.borderBottomMobile ?? style?.borderBottom)) as number | undefined,
    left: (selectedScreenSize == 'desktop'
      ? (style?.borderLeft ?? undefined)
      : (style?.borderLeftMobile ?? style?.borderLeft)) as number | undefined,
    right: (selectedScreenSize == 'desktop'
      ? (style?.borderRight ?? undefined)
      : (style?.borderRightMobile ?? style?.borderRight)) as number | undefined,
  };

  const background = style?.background ?? '';
  const backgroundColor = style?.backgroundColor;

  const backgroundString = backgroundColor ? updateHexColorInBackgroundString(background, backgroundColor) : background;

  const buttonBorderRadius = getRoundedCorners(style);

  const sid = shortCssId(blockId as string);
  /** Outer table stays full width so block alignment (e.g. center) works; inner pill toggles width. */
  return (
    <Wrapper
      background={backgroundString}
      backgroundColor={backgroundColor}
      padding={wrapperStyle.padding}
      align={wrapperStyle.textAlign}
      width="100%"
      className={`c${sid}`}
    >
      <a
        href={getCleanURL(url)}
        target="_blank"
        className={`abtn-${sid}`}
        onClick={guardLinksWhileEditingOnCanvas ? (e: React.MouseEvent) => e.preventDefault() : undefined}
      >
        <Wrapper
          className={sid}
          padding={
            selectedScreenSize == 'desktop'
              ? getButtonSizePadding(props?.size)
              : getButtonSizePadding(props?.sizeMobile ?? props?.size)
          }
          borderRadius={buttonBorderRadius}
          background={buttonBackgroundColor}
          backgroundColor={buttonBackgroundColor}
          isParent={false}
          align={'center'}
          width={fullWidth ? '100%' : undefined}
          display={fullWidth ? 'block' : 'inline-block'}
          border={border}
          /* The cell's own strut sizes the line box, so the label's leading
             has to reach the wrapper too — not just the span. */
          lineHeight={style?.lineHeight ?? undefined}
        >
          <span className={`btn${sid}`} style={linkStyle}>
            {text}
          </span>
        </Wrapper>
      </a>
    </Wrapper>
  );
}
