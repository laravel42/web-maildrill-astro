import React, { CSSProperties } from 'react';

import { type ImageProps, ImagePropsSchema, type UnsplashMetadata, UnsplashMetadataSchema } from '@eb/document-core';

import Wrapper from '../../email-builder/src/blocks/helpers/Wrapper';
import { getCleanURL } from '../../email-builder/src/helpers/formatting';
import { getPadding } from '../../email-builder/src/helpers/getCssProperties';
import { getRoundedCorners, shortCssId, updateHexColorInBackgroundString } from '../../email-builder/src/helpers/utils';
import { useDisableEdition, useImageAutoWidth, useImageUploading } from '../../email-builder/src/Reader/renderContext';
import { useViewport } from '../../email-builder/src/Reader/viewport';

export { ImagePropsSchema, UnsplashMetadataSchema, type ImageProps, type UnsplashMetadata };

export const ImagePropsDefaults = {
  shape: 'rectangle',
} as const;

export function Image({ style, props, blockId, isNotClient = false }: ImageProps & { isNotClient?: boolean }) {
  const selectedScreenSize = useViewport();
  const imageUploading = useImageUploading();
  const disableEdition = useDisableEdition();
  const reportImageAutoWidth = useImageAutoWidth();
  /** Only on the editing canvas; preview/export (isNotClient) must emit real links. */
  const guardLinksWhileEditingOnCanvas = !disableEdition && !isNotClient;

  const sectionStyle = {
    padding: getPadding(selectedScreenSize == 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding)),
    backgroundColor: style?.backgroundColor ?? undefined,
    textAlign:
      selectedScreenSize == 'desktop'
        ? (style?.textAlign ?? undefined)
        : (style?.textAlignMobile ?? style?.textAlign ?? undefined),
    position: 'relative',
  };

  const getWidth = (size?: string | null, scale?: number | null, fallbackPx?: number | null) => {
    if (size === 'fill') {
      return '100%';
    }
    if (size === 'scale') {
      return `${scale}%`;
    }
    // Pixel / original mode: prefer the explicit per-viewport pixel
    // value when one is provided so a user-set `widthMobile` actually
    // surfaces. Falls through to the desktop width when no mobile
    // value exists (mobile inherits desktop).
    return fallbackPx ?? undefined;
  };

  const linkHref = props?.linkHref ?? null;

  const width =
    (selectedScreenSize == 'desktop'
      ? getWidth(props?.size, props?.scale, props?.width)
      : getWidth(props?.sizeMobile, props?.scaleMobile, props?.widthMobile ?? props?.width)) ?? undefined;

  /**
   * `style.height` (and `style.heightMobile`) is the user-defined fixed-height
   * box for the image. When set, we apply `object-fit`/`object-position` so
   * the image is contained/covered inside that box. Outlook desktop ignores
   * `object-fit` but does honor the HTML `height` attribute, so the picture
   * still occupies the requested space (stretched).
   */
  const heightPx =
    (selectedScreenSize == 'desktop' ? style?.height : (style?.heightMobile ?? style?.height)) ?? undefined;
  /* Object-fit and object-position are per-viewport so a tall mobile
   * crop can use 'cover' while desktop keeps 'contain' (or vice versa).
   * Mobile inherits desktop when the *Mobile counterpart is missing. */
  const objectFitResolved =
    selectedScreenSize === 'desktop'
      ? (style?.objectFit ?? null)
      : (style?.objectFitMobile ?? style?.objectFit ?? null);
  const objectPositionResolved =
    selectedScreenSize === 'desktop'
      ? (style?.objectPosition ?? null)
      : (style?.objectPositionMobile ?? style?.objectPosition ?? null);
  const fit = heightPx != null ? (objectFitResolved ?? 'cover') : undefined;
  const fitPosition = heightPx != null ? (objectPositionResolved ?? 'center') : undefined;

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

  const background = style?.background ?? '';
  const backgroundColor = style?.backgroundColor;

  const backgroundString = backgroundColor ? updateHexColorInBackgroundString(background, backgroundColor) : background;

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const imgElement = event.currentTarget;

    setTimeout(() => {
      if (!props?.width && imgElement.offsetWidth) {
        const newWidth = imgElement.offsetWidth;
        reportImageAutoWidth(blockId as string, newWidth);
      }
    }, 100);
  };

  const imageElement = (
    <>
      <img
        alt={props?.alt ?? ''}
        src={props?.url ?? ''}
        width={width}
        height={heightPx}
        onLoad={handleImageLoad}
        style={{
          width,
          height: heightPx != null ? `${heightPx}px` : 'auto',
          objectFit: fit,
          objectPosition: fitPosition,
          outline: 'none',
          border: 'none',
          textDecoration: 'none',
          verticalAlign: props?.contentAlignment ?? 'middle',
          display: 'inline-block',
          maxWidth: '100%',
          opacity: imageUploading.uploading && imageUploading.id === blockId ? 0.5 : 1,
          transition: 'opacity 0.2s ease-in-out',
          borderRadius: getRoundedCorners(style),
        }}
      />
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
    </>
  );

  const sid = shortCssId(blockId as any);
  if (!linkHref) {
    return (
      <Wrapper
        className={`${sid}`}
        padding={sectionStyle.padding}
        background={backgroundString}
        align={sectionStyle.textAlign}
        width={'100%'}
      >
        {imageElement}
      </Wrapper>
    );
  }

  return (
    <Wrapper
      className={`${sid}`}
      padding={sectionStyle.padding}
      background={backgroundString}
      align={sectionStyle.textAlign}
      width={'100%'}
    >
      <a
        href={guardLinksWhileEditingOnCanvas ? undefined : getCleanURL(linkHref)}
        style={{
          textDecoration: 'none',
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: guardLinksWhileEditingOnCanvas ? 'none' : undefined,
        }}
        target={guardLinksWhileEditingOnCanvas ? undefined : '_blank'}
        onClick={guardLinksWhileEditingOnCanvas ? (e: React.MouseEvent) => e.preventDefault() : undefined}
      >
        {imageElement}
      </a>
    </Wrapper>
  );
}

export default Image;
