import React, { CSSProperties } from 'react';

import { type SpacerProps, SpacerPropsSchema } from '@eb/document-core';

import { shortCssId, updateHexColorInBackgroundString } from '../../email-builder/src/helpers/utils';
import { useViewport } from '../../email-builder/src/Reader/viewport';

export { SpacerPropsSchema, type SpacerProps };

export const SpacerPropsDefaults = {
  height: 16,
  backgroundColor: 'transparent',
};

export function Spacer({ style, blockId }: SpacerProps & { blockId?: string }) {
  const selectedScreenSize = useViewport();
  const height =
    (selectedScreenSize === 'desktop' ? style?.height : (style?.heightMobile ?? style?.height)) ?? undefined;

  const background = style?.background ?? '';
  const backgroundColor = style?.backgroundColor ?? '';
  const backgroundString = backgroundColor ? updateHexColorInBackgroundString(background, backgroundColor) : background;

  const wStyle: CSSProperties = {
    width: '100%',
    minWidth: '100%',
    backgroundColor: backgroundColor || undefined,
    background: backgroundString || undefined,
  };
  const cid = shortCssId(blockId as any);
  return (
    <table className={cid} width={'100%'} style={wStyle}>
      <tbody>
        <tr className={`it${cid}`} style={{ height }}>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}
