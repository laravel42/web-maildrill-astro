import React from 'react';

import { MAX_WIDTH_DESKTOP, MAX_WIDTH_MOBILE } from '../../../constants';
import ClientOnly from '../../editor/ClientOnly';
import { useCurrentBlockId } from '../../editor/EditorBlock';
import { insertChildAndUpdateParent, setSelectedBlockId, useSelectedScreenSize } from '../../editor/EditorContext';
import EditorChildrenIds from '../helpers/EditorChildrenIds';
import { getFontFamily } from '../helpers/fontFamily';

import { EmailLayoutProps } from './EmailLayoutPropsSchema';

export default function EmailLayoutEditor(props: EmailLayoutProps) {
  const childrenIds = props.childrenIds ?? [];
  const currentBlockId = useCurrentBlockId();
  const selectedScreenSize = useSelectedScreenSize();
  return (
    <div
      onClick={() => {
        setSelectedBlockId(null);
      }}
      style={{
        backgroundColor: props.backdropColor ?? '#F5F5F5',
        color: props.textColor ?? '#262626',
        fontFamily: getFontFamily((props?.fontFamily as any) || 'OPEN_SANS'),
        fontSize: '16px',
        fontWeight: '400',
        letterSpacing: '0.15008px',
        lineHeight: '1.5',
        margin: '0',
        width: '100%',
      }}
    >
      <table
        role="presentation"
        align="center"
        width="100%"
        style={{
          margin: '0 auto',
          maxWidth: selectedScreenSize === 'desktop' ? MAX_WIDTH_DESKTOP : MAX_WIDTH_MOBILE,
          backgroundColor: props.canvasColor ?? '#FFFFFF',
          borderRadius: props.borderRadius ?? undefined,
          border: (() => {
            const v = props.borderColor;
            if (!v) {
              return undefined;
            }
            return `1px solid ${v}`;
          })(),
        }}
        cellSpacing="0"
        cellPadding="0"
        border={0}
      >
        <tbody>
          <tr style={{ width: '100%' }}>
            <td data-value="__content">
              <ClientOnly>
                <EditorChildrenIds
                  listEndPolicy="root"
                  parentId={currentBlockId}
                  childrenIds={childrenIds}
                  onChange={({ block, blockId, childrenIds }) => {
                    insertChildAndUpdateParent(currentBlockId, blockId, block, childrenIds);
                    setSelectedBlockId(blockId);
                  }}
                />
              </ClientOnly>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
