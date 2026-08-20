import React, { useEffect, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import {
  getIconUrl,
  getSize,
  IconOptions,
  options,
  optionsSizes,
  optionsThemes,
  SizeType,
  ThemeType,
  ValidSize,
  ValidTheme,
} from '@eb/block-social-media/utils/icons';
import { Add, DeleteOutlined, DragIndicator } from '@mui/icons-material';
import { Button, IconButton, MenuItem, Stack, TextField, Tooltip, useTheme } from '@mui/material';

import { generateUUID } from '../../../../../TemplatePanel/helper/extraFunctions';

import FieldContainer from './components/FieldContainer';
import { INPUT_TEXTFIELD_SX } from './components/inputStyles';
import Select from './components/Select';
import LabelProperty from './LabelProperty';

interface SocialMediaInputProps {
  items?: IconOptions[];
  onChange?: (items: IconOptions[]) => void;
}

interface DraggableItemProps {
  element: IconOptions;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  onSelectChange: (index: number, selectedKey: string, element: IconOptions) => void;
  onUrlChange: (index: number, newUrl: string, element: IconOptions) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  canRemove: boolean;
  theme: any;
}

const DraggableItem: React.FC<DraggableItemProps> = ({
  element,
  index,
  moveItem,
  onSelectChange,
  onUrlChange,
  onRemove,
  onDuplicate,
  canRemove,
  theme,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [dropPosition, setDropPosition] = useState<'up' | 'down' | null>(null);
  const { t } = useTranslation('inspector');
  const getPosition = (monitor: any) => {
    const clientOffset = monitor.getClientOffset();
    const hoverBoundingRect = ref.current?.getBoundingClientRect();
    if (!clientOffset || !hoverBoundingRect) {
      return null;
    }
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;
    return hoverClientY < hoverMiddleY ? 'up' : 'down';
  };

  const [{ handlerId, isOver }, drop] = useDrop(
    () => ({
      accept: 'social-media-item',
      collect(monitor) {
        return {
          handlerId: monitor.getHandlerId(),
          isOver: monitor.isOver({ shallow: true }),
        };
      },
      hover(item: any, monitor) {
        if (!ref.current) {
          return;
        }
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) {
          setDropPosition(null);
          return;
        }

        if (!monitor.isOver({ shallow: true })) {
          setDropPosition(null);
          return;
        }
        const position = getPosition(monitor);
        setDropPosition(position);
      },
      drop(item: any, monitor) {
        setDropPosition(null);

        if (!ref.current) {
          return;
        }
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) {
          return;
        }
        const position = getPosition(monitor);
        let targetIndex = hoverIndex;
        if (position === 'down') {
          targetIndex = hoverIndex + 1;
        }
        if (dragIndex < targetIndex) {
          targetIndex = targetIndex - 1;
        }

        // Usar setTimeout para diferir la llamada y evitar problemas con hooks
        setTimeout(() => {
          moveItem(dragIndex, targetIndex);
        }, 0);

        item.index = targetIndex;
      },
      end: () => {
        setDropPosition(null);
      },
    }),
    [element.id, index, moveItem],
  );

  // Configurar useDrag - sin funciones memoizadas
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'social-media-item',
      item: () => {
        return { id: element.id, index };
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      end: () => {
        setDropPosition(null);
      },
    }),
    [element.id, index],
  );

  // Efecto para limpiar el dropPosition cuando no estamos sobre el elemento
  useEffect(() => {
    if (!isOver) {
      setDropPosition(null);
    }
  }, [isOver]);

  const opacity = isDragging ? 0.4 : 1;

  // Conectar las refs de forma segura
  useEffect(() => {
    if (ref.current && drag && drop) {
      const element = ref.current;
      drag(element);
      drop(element);
    }
  }, [drag, drop]);

  // Handlers simples sin memoización para evitar problemas con hooks
  const handleRemove = () => {
    setTimeout(() => onRemove(index), 0);
  };

  const handleDuplicate = () => {
    setTimeout(() => onDuplicate(index), 0);
  };

  const handleSelectChange = (e: any) => {
    const value = e.target.value as string;
    setTimeout(() => onSelectChange(index, value, element), 0);
  };

  const handleUrlChange = (e: any) => {
    const value = e.target.value as string;
    setTimeout(() => onUrlChange(index, value, element), 0);
  };

  const InsertIndicator = () => (
    <div
      style={{
        height: '3px',
        background: theme.palette.secondary.main,
        position: 'relative',
        color: theme.palette.secondary.main,
        margin: '4px 0',
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: '-25px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        width="20"
        height="20"
        viewBox="0 0 32 32"
      >
        <path
          fill="currentColor"
          d="M28 12H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M10 4v6h18V4zm18 26H10a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2m-18-8v6h18v-6zm-1-6l-5.586-5.586L2 11.828L6.172 16L2 20.172l1.414 1.414z"
        />
      </svg>
      <svg
        style={{
          position: 'absolute',
          right: '-25px',
          top: '50%',
          transform: 'translateY(-50%) scaleX(-1)',
        }}
        width="20"
        height="20"
        viewBox="0 0 32 32"
      >
        <path
          fill="currentColor"
          d="M28 12H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M10 4v6h18V4zm18 26H10a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2m-18-8v6h18v-6zm-1-6l-5.586-5.586L2 11.828L6.172 16L2 20.172l1.414 1.414z"
        />
      </svg>
    </div>
  );

  return (
    <>
      {dropPosition === 'up' && <InsertIndicator />}
      <Stack
        ref={ref}
        data-handler-id={handlerId}
        sx={{
          border: 1,
          borderColor: 'divider',
          padding: 1,
          paddingTop: 0,
          borderRadius: 1,
          backgroundColor: 'background.paper',
          marginBottom: 1.5,
          opacity,
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: isDragging ? theme.shadows[3] : 'none',
        }}
        spacing={1}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <DragIndicator
              sx={{
                color: isDragging ? 'primary.main' : 'text.secondary',
                cursor: 'grab',
                marginLeft: -0.9,
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            />
          </div>
          <div>
            <Tooltip title="Duplicate" placement="left">
              <IconButton color="primary" size="small" onClick={handleDuplicate}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 25"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 2.5H9C7.9 2.5 7 3.4 7 4.5V16.5C7 17.6 7.9 18.5 9 18.5H18C19.1 18.5 20 17.6 20 16.5V4.5C20 3.4 19.1 2.5 18 2.5ZM18 16.5H9V4.5H18V16.5ZM3 15.5V13.5H5V15.5H3ZM3 10H5V12H3V10ZM10 20.5H12V22.5H10V20.5ZM3 19V17H5V19H3ZM5 22.5C3.9 22.5 3 21.6 3 20.5H5V22.5ZM8.5 22.5H6.5V20.5H8.5V22.5ZM13.5 22.5V20.5H15.5C15.5 21.6 14.6 22.5 13.5 22.5ZM5 6.5V8.5H3C3 7.4 3.9 6.5 5 6.5Z"
                    fill="currentColor"
                  />
                </svg>
              </IconButton>
            </Tooltip>
            {canRemove && (
              <Tooltip title="Remove" placement="left">
                <IconButton color="error" size="small" onClick={handleRemove}>
                  <DeleteOutlined sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        </div>
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px auto',
              gap: '4px',
              alignItems: 'center',
            }}
          >
            <LabelProperty label={t('inputs.social.icon')} />
            <Select
              fullWidth
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={element.key}
              size="small"
              onChange={handleSelectChange}
            >
              {options.map((opt) => (
                <MenuItem value={opt.key} key={`${element.id}_${opt.key}`}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px auto',
              gap: '4px',
              alignItems: 'center',
            }}
          >
            <LabelProperty label={t('inputs.social.url')} />
            <TextField
              size="small"
              fullWidth
              value={element.href ?? ''}
              onChange={handleUrlChange}
              variant="outlined"
              placeholder="https://your-website.com"
              sx={INPUT_TEXTFIELD_SX}
            />
          </div>
        </div>
      </Stack>
      {dropPosition === 'down' && <InsertIndicator />}
    </>
  );
};

export function SocialMediaInput({ items = [], onChange }: SocialMediaInputProps) {
  const { t } = useTranslation('inspector');
  const theme = useTheme();

  // Add a unique identifier to each element for stable keys
  const [elements, setElements] = useState<IconOptions[]>(() =>
    items.map((item) => ({ ...item, id: item.id || generateUUID() })),
  );
  const [iconTheme, setIconTheme] = useState<ThemeType>(
    (items[0]?.theme as ThemeType) || 'positive',
  );
  const [size, setSize] = useState<SizeType>((items[0]?.size as SizeType) || 'medium');

  useEffect(() => {
    if (items.length > 0) {
      setIconTheme(items[0].theme as ThemeType);
      setSize(items[0].size as SizeType);
      setElements(items.map((item) => ({ ...item, id: item.id || generateUUID() })));
    }
  }, [items]);

  // Funciones sin memoización para evitar problemas con hooks
  const moveItem = (dragIndex: number, hoverIndex: number) => {
    setElements((prevElements) => {
      const updatedElements = [...prevElements];
      const [removed] = updatedElements.splice(dragIndex, 1);
      updatedElements.splice(hoverIndex, 0, removed);

      if (onChange) {
        // Usar setTimeout para diferir la llamada
        setTimeout(() => onChange(updatedElements), 0);
      }
      return updatedElements;
    });
  };

  const addElement = () => {
    setElements((prevState) => {
      const newElement: IconOptions = {
        ...options[0],
        theme: iconTheme,
        size,
        sizePx: getSize(size),
        url: getIconUrl(options[0].iconName, iconTheme, size),
        id: generateUUID(),
      };
      const updatedItems = [...prevState, newElement];
      if (onChange) {
        setTimeout(() => onChange(updatedItems), 0);
      }
      return updatedItems;
    });
  };

  const removeElement = (index: number) => {
    setElements((prevState) => {
      const updatedItems = prevState.filter((_, idx) => idx !== index);
      if (onChange) {
        setTimeout(() => onChange(updatedItems), 0);
      }
      return updatedItems;
    });
  };

  const handleSelectChange = (
    index: number | null,
    selectedKey: string,
    element: IconOptions | null,
  ) => {
    let updatedElements = [...elements];
    if (selectedKey in ValidTheme) {
      setIconTheme(selectedKey as ThemeType);
      updatedElements = updatedElements.map((el) => {
        const newURL = getIconUrl(el.iconName, selectedKey as ThemeType, el.size as SizeType);
        return { ...el, theme: selectedKey as ThemeType, url: newURL };
      });
    } else if (selectedKey in ValidSize) {
      setSize(selectedKey as SizeType);
      updatedElements = updatedElements.map((el) => {
        const newURL = getIconUrl(el.iconName, el.theme as ThemeType, selectedKey as SizeType);
        const realSize = getSize(selectedKey);
        return { ...el, size: selectedKey as SizeType, sizePx: realSize, url: newURL };
      });
    }
    if (index !== null && element) {
      const selectedOption = options.find((opt) => opt.key === selectedKey);
      if (selectedOption) {
        updatedElements = updatedElements.map((el, idx) => {
          const newSocial = {
            key: selectedOption.key,
            label: selectedOption.label,
            iconName: selectedOption.iconName,
            href: selectedOption.href,
          };
          const newUrl = getIconUrl(
            newSocial.iconName,
            element.theme as ThemeType,
            element.size as SizeType,
          );
          return idx === index ? { ...el, ...newSocial, url: newUrl, id: element.id } : el;
        });
      }
    }
    setElements(updatedElements);
    if (onChange) {
      setTimeout(() => onChange(updatedElements), 0);
    }
  };

  const handleUrlChange = (index: number, newUrl: string, element: IconOptions) => {
    const updatedElements = elements.map((el, idx) =>
      idx === index ? { ...element, href: newUrl } : el,
    );
    setElements(updatedElements);
    if (onChange) {
      setTimeout(() => onChange(updatedElements), 0);
    }
  };

  const duplicateElement = (index: number) => {
    setElements((prevState) => {
      const newElement = {
        ...JSON.parse(JSON.stringify(prevState[index])),
        id: generateUUID(),
      };
      const updatedItems = [
        ...prevState.slice(0, index + 1),
        newElement,
        ...prevState.slice(index + 1),
      ];
      if (onChange) {
        setTimeout(() => onChange(updatedItems), 0);
      }
      return updatedItems;
    });
  };

  return (
    <>
      <div
        style={{
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2,1fr)',
          gap: '1rem',
        }}
      >
        <FieldContainer>
          <LabelProperty label={t('inputs.social.theme')} />
          <Select
            fullWidth
            labelId="theme-selector"
            id="theme-selector"
            value={iconTheme}
            size="small"
            onChange={(e) => handleSelectChange(null, e.target.value as string, null)}
          >
            {optionsThemes.map((opt) => (
              <MenuItem value={opt.key} key={`${opt.key}`}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FieldContainer>
        <FieldContainer>
          <LabelProperty label={t('inputs.social.size')} />
          <Select
            fullWidth
            labelId="size-selector"
            id="size-selector"
            value={size}
            size="small"
            onChange={(e) => handleSelectChange(null, e.target.value as string, null)}
          >
            {optionsSizes.map((opt) => (
              <MenuItem value={opt.key} key={`${opt.key}`}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FieldContainer>
      </div>

      {elements?.map((el, index) => (
        <DraggableItem
          key={el.id}
          element={el}
          index={index}
          moveItem={moveItem}
          onSelectChange={handleSelectChange}
          onUrlChange={handleUrlChange}
          onRemove={removeElement}
          onDuplicate={duplicateElement}
          canRemove={elements.length > 1}
          theme={theme}
        />
      ))}
      <Button onClick={addElement} sx={{ borderRadius: 1 }} variant="contained" endIcon={<Add />}>
        Add
      </Button>
    </>
  );
}
