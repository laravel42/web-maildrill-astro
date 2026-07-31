import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import type { ImageProps } from '@eb/block-image';
import {
  AlignVerticalCenterOutlined,
  PhoneIphoneOutlined,
  SplitscreenOutlined,
  type SvgIconComponent,
  TableChartOutlined,
  TableRowsOutlined,
  ViewColumnOutlined,
  ViewWeekOutlined,
} from '@mui/icons-material';
import { Box, SvgIcon, type SvgIconProps } from '@mui/material';

import ColumnsContainerPropsSchema, {
  ColumnsContainerProps,
} from '../../../../documents/blocks/ColumnsContainer/ColumnsContainerPropsSchema';
import { changeWidth } from '../../../../documents/blocks/helpers/changeWidth';
import { atomicUpdateBlock } from '../../../../documents/editor/blockUpdaters';
import type { TEditorBlock } from '../../../../documents/editor/core';
import {
  editorStateStore,
  useSelectedScreenSize,
  useSelectedSidebarTab,
} from '../../../../documents/editor/EditorContext';
import { useCompactMode } from '../../CompactModeContext';

import BaseSidebarPanel, { CompactDivider } from './helpers/BaseSidebarPanel';
import CompactableInput from './helpers/inputs/CompactableInput';
import FieldContainer from './helpers/inputs/components/FieldContainer';
import { INPUT_CONTAINER_SX, INPUT_HEIGHT } from './helpers/inputs/components/inputStyles';
import ContentAlignment from './helpers/inputs/ContentAligment';
import InspectorPillToggleGroup from './helpers/inputs/InspectorPillToggleGroup';
import LabelProperty from './helpers/inputs/LabelProperty';
import LayoutSelectorInput from './helpers/inputs/LayoutSelectorInput';
import PropertyLabelWithWarning from './helpers/inputs/PropertyLabelWithWarning';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

const ColumnsCountIcon: SvgIconComponent = ((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M10.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5.5m-6.7 9.1l1-.4M15 3v7.5m.2 6.4l-.9-.3m2.3 5.1l.3-.9m-.1-5.5l-.4-1m2.7.9l.3-.9m.2 7.4l-.4-1m1.5-3.9l1-.4m0 3l-.9-.3M9 3v18" />
      <circle cx="18" cy="18" r="3" />
    </g>
  </SvgIcon>
)) as unknown as SvgIconComponent;
ColumnsCountIcon.muiName = 'ColumnsCountIcon';

type ColumnsContainerPanelProps = {
  data: ColumnsContainerProps;
  setData: (v: ColumnsContainerProps) => void;
};
export default function ColumnsContainerPanel({ data, setData }: ColumnsContainerPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const [columns, setColumns] = useState(data.props?.columnsCount ?? 2);
  const selectedTab = useSelectedSidebarTab();
  const selectedScreen = useSelectedScreenSize();
  const compact = useCompactMode();
  const { t } = useTranslation('inspector');
  const changeChildWidthImage = (childrenIds: string[]) => {
    const document = editorStateStore.getState().document;
    const childImages = childrenIds.filter((id) => document[id]?.type === 'Image');
    if (selectedScreen !== 'desktop') return;
    childImages.forEach((id) => {
      const block = document[id];
      if (block?.type !== 'Image') return;
      const imageData = block.data as ImageProps;
      changeWidth(
        id,
        (newData: ImageProps) => {
          atomicUpdateBlock(id, (b) => {
            if (b.type !== 'Image') return b;
            return { ...b, data: newData } as TEditorBlock;
          });
        },
        imageData,
      );
    });
  };

  const updateData = (d: unknown) => {
    const res = ColumnsContainerPropsSchema.safeParse(d);
    if (res.success) {
      res.data.props.columns.map((column: any) => changeChildWidthImage(column.childrenIds));
      setData(res.data);
      if (columns && res.data.props?.columnsCount !== columns) {
        setColumns(res.data.props?.columnsCount ?? 2);
      }
      setErrors(null);
    } else {
      console.error('Error on columns: ', res.error);
      setErrors(res.error);
    }
  };
  const defaultTwoColumns = {
    layout: 'layout-50-50',
    fixedWidths: [50, 50, null],
    columnsCount: 2,
  };
  const defaultThreeColumns = {
    layout: 'layout-33-34-33',
    fixedWidths: [33, 34, 33],
    columnsCount: 3,
  };

  const getDefaultColumns = (v) => {
    const columnsTemp =
      data.props.columns.length === 2
        ? [...data.props.columns, { childrenIds: [] }]
        : [...data.props.columns];
    const defaultColumns =
      v === '2'
        ? {
            ...defaultTwoColumns,
            columns: columnsTemp,
          }
        : {
            ...defaultThreeColumns,
            columns: columnsTemp,
          };
    return defaultColumns;
  };

  return (
    <BaseSidebarPanel title={t('inputs.panels.columns.title')}>
      {(selectedTab == 'block-configuration' || compact) && (
        <>
          <CompactableInput icon={ColumnsCountIcon} label={t('inputs.panels.columns.countLabel')}>
            <FieldContainer>
              <LabelProperty label={t('inputs.panels.columns.countLabel')} />
              <Box
                sx={{
                  ...INPUT_CONTAINER_SX,
                  paddingLeft: 0,
                  paddingRight: 0,
                  height: 'auto',
                  minHeight: `${INPUT_HEIGHT}px`,
                }}
              >
                <InspectorPillToggleGroup
                  value={data.props?.columnsCount === 2 ? '2' : '3'}
                  onChange={(v) => {
                    const columnsDefault = getDefaultColumns(v);
                    updateData({
                      ...data,
                      props: {
                        ...data.props,
                        ...columnsDefault,
                      },
                    });
                  }}
                  options={[
                    {
                      value: '2',
                      label: '2',
                      icon: <SplitscreenOutlined fontSize="small" />,
                    },
                    {
                      value: '3',
                      label: '3',
                      icon: <ViewWeekOutlined fontSize="small" />,
                    },
                  ]}
                />
              </Box>
            </FieldContainer>
          </CompactableInput>
          <CompactableInput
            icon={TableChartOutlined}
            label={t('inputs.panels.columns.layoutLabel', 'Layout')}
          >
            <LayoutSelectorInput
              columns={data.props?.columnsCount ?? 3}
              defaultValue={data.props?.layout}
              fixedWidths={(data.props?.fixedWidths ?? undefined) as (number | null)[] | undefined}
              onChange={({
                layout,
                fixedWidths,
              }: {
                layout: string;
                fixedWidths: (number | null)[];
              }) => {
                const columnsArray =
                  data.props.columns.length === 2
                    ? [...data.props.columns, { childrenIds: [] }]
                    : data.props.columns;

                updateData({
                  ...data,
                  props: { ...data.props, layout, fixedWidths, columns: columnsArray },
                });
              }}
            />
          </CompactableInput>
        </>
      )}
      {(selectedTab == 'css' || compact) && (
        <>
          <CompactDivider />
          <CompactableInput
            icon={PhoneIphoneOutlined}
            label={t('inputs.panels.columns.stackColumnsOnMobile')}
          >
            <FieldContainer>
              <PropertyLabelWithWarning
                label={t('inputs.panels.columns.stackColumnsOnMobile')}
                tooltipTitle={t('inputs.panels.columns.stackColumnsOnMobileWarning')}
              />
              <Box
                sx={{
                  width: '100%',
                  ...INPUT_CONTAINER_SX,
                  paddingLeft: 0,
                  paddingRight: 0,
                  height: 'auto',
                  minHeight: `${INPUT_HEIGHT}px`,
                }}
              >
                <InspectorPillToggleGroup
                  value={data.props?.stackColumnsOnMobile ? 'stacked' : 'sideBySide'}
                  onChange={(v) => {
                    updateData({
                      ...data,
                      props: { ...data.props, stackColumnsOnMobile: v === 'stacked' },
                    });
                  }}
                  options={[
                    {
                      value: 'sideBySide',
                      label: t('inputs.panels.columns.stackToggleSideBySide'),
                      icon: <ViewColumnOutlined fontSize="small" />,
                    },
                    {
                      value: 'stacked',
                      label: t('inputs.panels.columns.stackToggleStacked'),
                      icon: <TableRowsOutlined fontSize="small" />,
                    },
                  ]}
                />
              </Box>
            </FieldContainer>
          </CompactableInput>
          <CompactableInput icon={AlignVerticalCenterOutlined} label={t('inputs.alignment.label')}>
            <ContentAlignment data={data} updateData={setData} />
          </CompactableInput>

          <MultiStylePropertyPanel
            names={['backgroundColor', 'background', 'padding', 'mobilePadding']}
            value={data.style}
            onChange={(style) => updateData({ ...data, style })}
          />
        </>
      )}
    </BaseSidebarPanel>
  );
}
