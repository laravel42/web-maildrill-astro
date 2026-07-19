import React from 'react';

import { MAX_WIDTH_DESKTOP, MAX_WIDTH_MOBILE } from '../../constants';
import { useFontFamily } from '../../helpers/fontFamily';
import { ReaderBlock } from '../../Reader/core';
import { useViewport } from '../../Reader/viewport';

import { EmailLayoutProps } from './EmailLayoutPropsSchema';

function getBorder({ borderColor }: EmailLayoutProps) {
  if (!borderColor) {
    return undefined;
  }
  return `1px solid ${borderColor}`;
}

/**
 * `EmailLayoutReader` produces the chrome around every rendered email
 * (outer wrapper + canvas table). It is the chrome consumed by:
 *
 *   - `AIPreviewPanel` (the streaming preview in the AI dialog).
 *   - The Preview tab in `TemplatePanel` (after L42-312 Phase 5).
 *   - `renderToStaticMarkup` for the HTML export tab and `getHtml()`
 *     (after L42-312 Phase 5).
 *
 * Behaviour is intentionally aligned with the chrome `CustomReader`
 * produces today so the Phase 5 migration is a no-op visually:
 *
 *   - `padding: 0` on the outer wrapper (no phantom 32px around the
 *     canvas; consumers that want spacing wrap `<Reader>` themselves).
 *   - Inner table capped at `MAX_WIDTH_DESKTOP` on desktop, `100%` on
 *     mobile (matches the previous `CustomReader` rule).
 *   - `overflow: hidden` on the table to clip rounded-corner backgrounds.
 *   - `.main-table-container` className on outer div, table, and `<tr>`.
 *     `cleanDocument` (in the standalone editor) emits a
 *     `@media (max-width:640px) .main-table-container { width: 100% !important }`
 *     rule that targets these elements.
 *
 * Anything UI-shell-specific that `CustomReader` carried — `pointerEvents`
 * for the disabled-interaction overlay, `onRendered` callbacks — lives
 * OUTSIDE this component. Wrap `<Reader>` with a plain `<div>` from the
 * call site.
 */
export default function EmailLayoutReader(props: EmailLayoutProps) {
  const childrenIds = props.childrenIds ?? [];
  const selectedScreenSize = useViewport();
  return (
    <div
      className="main-table-container"
      style={{
        backgroundColor: props.backdropColor ?? '#F5F5F5',
        color: props.textColor ?? '#262626',
        fontFamily: useFontFamily(props.fontFamily as any),
        fontSize: '16px',
        fontWeight: '400',
        letterSpacing: '0.15008px',
        lineHeight: '1.5',
        margin: '0',
        padding: '0',
        borderRadius: props.borderRadius || 0,
      }}
    >
      <table
        align="center"
        role="presentation"
        className="main-table-container"
        style={{
          margin: '0 auto',
          maxWidth: selectedScreenSize === 'desktop' ? MAX_WIDTH_DESKTOP : MAX_WIDTH_MOBILE,
          width: selectedScreenSize === 'desktop' ? MAX_WIDTH_DESKTOP : '100%',
          backgroundColor: props.canvasColor ?? '#FFFFFF',
          borderRadius: props.borderRadius ?? undefined,
          border: getBorder(props),
          overflow: 'hidden',
        }}
        cellSpacing="0"
        cellPadding="0"
        border={0}
      >
        <tbody>
          <tr className="main-table-container">
            <td>
              {childrenIds.map((childId) => (
                <React.Fragment key={childId}>
                  <ReaderBlock id={childId} />
                </React.Fragment>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
