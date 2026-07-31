import React, { CSSProperties } from 'react';

import Wrapper from '../../email-builder/src/blocks/helpers/Wrapper';
import { useFontFamily } from '../../email-builder/src/helpers/fontFamily';
import { getPadding } from '../../email-builder/src/helpers/getCssProperties';
import { shortCssId } from '../../email-builder/src/helpers/utils';
import { useRootData } from '../../email-builder/src/Reader/renderContext';
import { useViewport } from '../../email-builder/src/Reader/viewport';

import { getFormattedHtmlCached, normalizeNotionTextHtml } from './helper-notion-text';
import { NotionTextProps, NotionTextPropsDefaults } from './NotionTextPropsSchema';

export type NotionTextReaderProps = {
  blockId?: string;
  style?: NotionTextProps['style'];
  props?: NotionTextProps['props'];
};

/**
 * Static reader for NotionText blocks. Used by `<Reader>` from
 * `@eb/email-builder` for both the Preview tab and the HTML export.
 *
 * Mirrors the `isNotClient` render path of the editor `NotionText`
 * component — typography (color, fontSize, fontFamily, fontWeight,
 * lineHeight) is written inline, padding is emitted via `Wrapper`'s
 * 3×3 table, and the `nt<id>` class on the inner content div lets
 * `cleanDocument`'s `@media (max-width: 640px)` rules target this
 * output for mobile font-size overrides.
 *
 * Why inline? `cleanDocument`'s base CSS pass is intentionally dropped
 * (only the `@media` block reaches the final `<style>`), and the
 * Preview tab in the playground does not inject the cleanDocument
 * stylesheet at all — it just renders the React tree. Inline styles
 * are therefore the single source of truth for desktop styling, and
 * `cleanDocument`'s `<style>` handles mobile `@media` overrides on top.
 */
export function NotionTextReader({ blockId, style, props }: NotionTextReaderProps) {
  const selectedScreenSize = useViewport();

  // `linkGlobal` lives on the root EmailLayout block. Read it once so
  // anchor rendering inside `getFormattedHtmlCached` can apply the
  // workspace-wide link color / underline.
  const rootData = useRootData<any>();
  const linkGlobal = rootData?.linkGlobal ?? null;

  // Resolve HTML, falling back to the schema default when the block
  // body collapses to whitespace after stripping markup.
  let html = props?.html || NotionTextPropsDefaults.html;

  let strippedHtml = '';
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      inTag = true;
    } else if (html[i] === '>') {
      inTag = false;
    } else if (!inTag) {
      strippedHtml += html[i];
    }
  }
  if (strippedHtml.replace(/&nbsp;/g, '').trim() === '') {
    html = NotionTextPropsDefaults.html;
  }

  html = normalizeNotionTextHtml(html);

  const classId = shortCssId(blockId || 'reader');
  const formattedHtml = getFormattedHtmlCached(blockId || 'reader', html, linkGlobal);

  // Padding follows the editor's `mobilePadding ?? padding` fallback so
  // a theme override on mobilePadding only surfaces on mobile and the
  // desktop value remains otherwise. The resolver chain has already
  // populated `style.padding` with the schema default at this point.
  const padding = getPadding(
    selectedScreenSize === 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding),
  );

  const textAlign = style?.textAlign ?? undefined;

  const border = {
    color: style?.borderColor ?? undefined,
    top: style?.borderTop ?? undefined,
    bottom: style?.borderBottom ?? undefined,
    left: style?.borderLeft ?? undefined,
    right: style?.borderRight ?? undefined,
  };

  const fontSize =
    selectedScreenSize === 'desktop'
      ? (style?.fontSize ?? undefined)
      : (style?.fontSizeMobile ?? style?.fontSize ?? undefined);

  const wStyle: CSSProperties = {
    color: style?.color ?? undefined,
    fontSize,
    fontFamily: useFontFamily(style?.fontFamily),
    fontWeight: style?.fontWeight ?? undefined,
    lineHeight: style?.lineHeight ?? 'inherit',
    maxWidth: '100%',
    wordBreak: 'break-word',
  };

  const containerStyle = linkGlobal
    ? ({
        '--global-link-color': linkGlobal.linkColor || 'inherit',
        '--global-link-text-decoration': linkGlobal.underline ? 'underline' : 'none',
      } as CSSProperties)
    : undefined;

  return (
    <div style={containerStyle}>
      <Wrapper
        className={classId}
        padding={padding}
        backgroundColor={style?.backgroundColor ?? undefined}
        align={textAlign}
        width="100%"
        border={border}
      >
        <div
          className={`eb-notion-content nt${classId}`}
          style={{ ...wStyle, minHeight: '20px' }}
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      </Wrapper>
    </div>
  );
}
