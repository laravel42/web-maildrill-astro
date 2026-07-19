import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import data from '@emoji-mart/data';
import { ChevronRight } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Popover,
  useTheme,
} from '@mui/material';
import type { SuggestionProps } from '@tiptap/suggestion';

import { type AIAction, requestAIFeature } from './ai-features-config';
import SafeEmojiMartPicker from './SafeEmojiMartPicker';
import { getFilteredSlashMenuItems, type SlashMenuItem, type SlashSubmenuItem } from './slash-menu-items';

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashMenu = forwardRef<SlashMenuRef, SuggestionProps>((props, ref) => {
  const theme = useTheme();
  const [enableAI, setEnableAI] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allItems, setAllItems] = useState<SlashMenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<SlashMenuItem[]>([]);
  const [submenuAnchor, setSubmenuAnchor] = useState<{
    element: HTMLElement;
    item: SlashMenuItem;
  } | null>(null);
  const [submenuSelectedIndex, setSubmenuSelectedIndex] = useState(0);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiAnchorPosition, setEmojiAnchorPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [aiLoading, setAiLoading] = useState<AIAction | null>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const MAX_HEIGHT_MENUS = 150;

  // Ref para trackear la inserción de emojis desde el slash menu
  const emojiInsertionRef = useRef<{
    isFirstEmoji: boolean;
    insertPosition: number;
    slashRange: { from: number; to: number };
  } | null>(null);

  // Check for AI configuration
  useEffect(() => {
    const aiEnabled = (window as any).__emailBuilderEnableAI;
    setEnableAI(Boolean(aiEnabled));

    const handleAIToggle = (event: Event) => {
      const { detail } = event as CustomEvent<boolean>;
      setEnableAI(Boolean(detail));
    };

    window.addEventListener('email-builder-ai-generation', handleAIToggle);
    return () => {
      window.removeEventListener('email-builder-ai-generation', handleAIToggle);
    };
  }, []);

  // Obtener items filtrados según enableAI
  useEffect(() => {
    const items = getFilteredSlashMenuItems(enableAI);
    setAllItems(items);
  }, [enableAI]);

  // Filtrar ítems basado en query
  useEffect(() => {
    const query = props.query.toLowerCase();
    const filtered = allItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      const matchKeywords = item.keywords?.some((k) => k.includes(query));
      return matchTitle || matchDesc || matchKeywords;
    });
    setFilteredItems(filtered);
    setSelectedIndex(0);
  }, [props.query, allItems]);

  // Auto-scroll para mantener el item seleccionado visible en el menú principal
  useEffect(() => {
    if (mainMenuRef.current) {
      const selectedElement = mainMenuRef.current.querySelector(`[data-slash-menu-item="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  // Auto-scroll para mantener el item seleccionado visible en el submenú
  useEffect(() => {
    if (submenuRef.current && submenuAnchor) {
      const selectedElement = submenuRef.current.querySelector(`[data-submenu-item="${submenuSelectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [submenuSelectedIndex, submenuAnchor]);

  const selectItem = (index: number) => {
    const item = filteredItems[index];
    if (item) {
      // Si tiene submenu, no ejecutar comando
      if (item.submenu && item.submenu.length > 0) {
        return;
      }

      // Si es el item de emoji, abrir el emoji picker
      if (item.title === 'Emoji') {
        const element = document.querySelector(`[data-slash-menu-item="${index}"]`) as HTMLElement;
        if (element) {
          emojiInsertionRef.current = {
            isFirstEmoji: true,
            insertPosition: props.range.from,
            slashRange: { from: props.range.from, to: props.range.to },
          };

          const PICKER_HEIGHT = 435;
          const PICKER_WIDTH = 352;
          const MARGIN = 8;
          const GAP = 4;

          const rect = element.getBoundingClientRect();
          const vh = window.innerHeight;
          const vw = window.innerWidth;

          let left = rect.right + GAP;
          if (left + PICKER_WIDTH + MARGIN > vw) {
            left = Math.max(MARGIN, rect.left - PICKER_WIDTH - GAP);
          }

          let top: number;
          if (rect.top + PICKER_HEIGHT + MARGIN <= vh) {
            top = rect.top;
          } else {
            top = Math.max(MARGIN, vh - PICKER_HEIGHT - MARGIN);
          }

          setEmojiAnchorPosition({ top, left });
          setEmojiPickerOpen(true);
        }
        return;
      }

      if (item.command) {
        item.command(props);
        // Asegurar que el editor mantenga el foco después de ejecutar el comando
        setTimeout(() => {
          props.editor.commands.focus();
        }, 0);
      }
    }
  };

  const selectSubmenuItem = (submenuItem: SlashSubmenuItem) => {
    if (submenuItem.type === 'divider') return;

    // Verificar si es un AI Feature
    const parentItem = submenuAnchor?.item;
    if (parentItem?.title === 'AI Features') {
      // Procesar AI Feature con todo el contenido del texto
      const content = props.editor.getHTML();
      const text = props.editor.getText();

      if (!text.trim()) {
        console.warn('⚠️ [SlashMenu] No hay texto para procesar');
        setSubmenuAnchor(null);
        return;
      }

      // Marcar como loading
      setAiLoading(submenuItem.value as AIAction);

      // Solicitar la acción de IA (reemplaza todo el contenido)
      requestAIFeature({
        text,
        content,
        action: submenuItem.value as AIAction,
        replaceSelection: false, // Slash menu reemplaza todo el contenido
      });

      // Cerrar el slash menu
      props.editor.chain().focus().deleteRange(props.range).run();
      setSubmenuAnchor(null);
      return;
    }

    // Insertar el merge tag
    props.editor.chain().focus().deleteRange(props.range).insertContent(submenuItem.value).run();

    // Cerrar submenu
    setSubmenuAnchor(null);
  };

  const handleItemMouseEnter = (event: React.MouseEvent<HTMLElement>, item: SlashMenuItem) => {
    if (item.submenu && item.submenu.length > 0) {
      setSubmenuAnchor({ element: event.currentTarget, item });
      setSubmenuSelectedIndex(0);
    } else {
      setSubmenuAnchor(null);
    }
  };

  const handleMouseLeave = () => {
    // No cerrar inmediatamente para permitir mover el mouse al submenu
    setTimeout(() => {
      if (!document.querySelector('[data-submenu]:hover')) {
        setSubmenuAnchor(null);
      }
    }, 100);
  };

  const handleEmojiSelect = useCallback(
    (emoji: { native: string }) => {
      if (!emojiInsertionRef.current) return;

      const emojiLength = emoji.native.length;

      if (emojiInsertionRef.current.isFirstEmoji) {
        // Primer emoji: reemplazar el slash command (/)
        const { from, to } = emojiInsertionRef.current.slashRange;
        props.editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, emoji.native).run();

        // Actualizar la posición para el siguiente emoji (después del emoji insertado)
        emojiInsertionRef.current.insertPosition = from + emojiLength;
        emojiInsertionRef.current.isFirstEmoji = false;
      } else {
        // Emojis subsecuentes: insertar a la derecha del último emoji
        const insertPos = emojiInsertionRef.current.insertPosition;
        props.editor.chain().insertContentAt(insertPos, emoji.native).run();

        // Actualizar la posición para el siguiente emoji
        emojiInsertionRef.current.insertPosition = insertPos + emojiLength;
      }

      // NO cerrar el emoji picker - permitir seleccionar múltiples emojis
      // El picker se cerrará cuando el usuario haga clic fuera o presione Escape
    },
    [props]
  );

  const handleEmojiPickerClose = useCallback(() => {
    setEmojiPickerOpen(false);
    emojiInsertionRef.current = null;
  }, []);

  // Resetear loading cuando se recibe respuesta (el componente padre maneja el contenido)
  useEffect(() => {
    const handleAIProcessed = () => {
      // Solo resetear el estado de loading
      setAiLoading(null);
    };

    window.addEventListener('text-ai-processed', handleAIProcessed);

    return () => {
      window.removeEventListener('text-ai-processed', handleAIProcessed);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // Si hay submenu abierto, manejar navegación del submenu
      if (submenuAnchor && submenuAnchor.item.submenu) {
        const submenuItems = submenuAnchor.item.submenu.filter((item) => item.type !== 'divider');

        if (event.key === 'ArrowUp') {
          setSubmenuSelectedIndex((submenuSelectedIndex + submenuItems.length - 1) % submenuItems.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSubmenuSelectedIndex((submenuSelectedIndex + 1) % submenuItems.length);
          return true;
        }

        if (event.key === 'Enter') {
          const selectedSubmenuItem = submenuItems[submenuSelectedIndex];
          if (selectedSubmenuItem) {
            selectSubmenuItem(selectedSubmenuItem);
          }
          return true;
        }

        if (event.key === 'ArrowLeft' || event.key === 'Escape') {
          setSubmenuAnchor(null);
          return true;
        }

        return false;
      }

      // Navegación del menu principal
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + filteredItems.length - 1) % filteredItems.length);
        setSubmenuAnchor(null);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % filteredItems.length);
        setSubmenuAnchor(null);
        return true;
      }

      if (event.key === 'ArrowRight') {
        const item = filteredItems[selectedIndex];
        if (item?.submenu && item.submenu.length > 0) {
          // Simular hover para abrir submenu
          const element = document.querySelector(`[data-slash-menu-item="${selectedIndex}"]`) as HTMLElement;
          if (element) {
            setSubmenuAnchor({ element, item });
            setSubmenuSelectedIndex(0);
          }
          return true;
        }
        return false;
      }

      if (event.key === 'Enter') {
        const item = filteredItems[selectedIndex];
        if (item?.submenu && item.submenu.length > 0) {
          // Abrir submenu en lugar de ejecutar
          const element = document.querySelector(`[data-slash-menu-item="${selectedIndex}"]`) as HTMLElement;
          if (element) {
            setSubmenuAnchor({ element, item });
            setSubmenuSelectedIndex(0);
          }
          return true;
        }
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  if (filteredItems.length === 0 && !emojiPickerOpen) {
    return null;
  }

  return (
    <>
      <Paper
        elevation={3}
        ref={mainMenuRef}
        sx={{
          maxWidth: 280,
          maxHeight: MAX_HEIGHT_MENUS,
          overflow: 'auto',
          backgroundColor: theme.palette.background.paper,
          borderRadius: '12px',
          boxShadow: theme.palette.mode === 'dark' ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.divider,
            borderRadius: '2px',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          },

          scrollbarWidth: 'thin',
          scrollbarColor: `${theme.palette.divider} transparent`,
          // Ocultar el Paper cuando el emoji picker está abierto y no hay items
          display: emojiPickerOpen && filteredItems.length === 0 ? 'none' : 'block',
        }}
        data-slash-menu
        onMouseLeave={handleMouseLeave}
      >
        <List dense sx={{ p: '0' }}>
          {filteredItems.map((item, index) => (
            <ListItem key={item.title} disablePadding>
              <ListItemButton
                data-slash-menu-item={index}
                selected={index === selectedIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!item.submenu || item.submenu.length === 0) {
                    selectItem(index);
                  }
                }}
                onMouseEnter={(e) => {
                  setSelectedIndex(index);
                  handleItemMouseEnter(e, item);
                }}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: index === selectedIndex ? theme.palette.action.selected : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  transition: 'all 150ms ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: theme.palette.text.secondary }}>
                    {item.icon}
                  </Box>
                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      fontSize: '12px',
                      color: theme.palette.text.primary,
                    }}
                  />
                </Box>
                {item.submenu && item.submenu.length > 0 && (
                  <ChevronRight fontSize="small" sx={{ ml: 4, color: theme.palette.text.disabled }} />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Submenu Popover */}
      {submenuAnchor && submenuAnchor.item.submenu && (
        <Popover
          open={Boolean(submenuAnchor)}
          anchorEl={submenuAnchor.element}
          onClose={() => setSubmenuAnchor(null)}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          disableRestoreFocus
          disableAutoFocus
          disableEnforceFocus
          sx={{
            pointerEvents: 'none',
            '& .MuiPaper-root': {
              pointerEvents: 'auto',
              ml: 1, // Mover el submenú 8px a la derecha
            },
          }}
          slotProps={{
            paper: {
              'data-submenu': true,
              onMouseLeave: () => setSubmenuAnchor(null),
              sx: {
                backgroundColor: theme.palette.background.paper,
                borderRadius: '12px',
                boxShadow:
                  theme.palette.mode === 'dark' ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
              },
            } as any,
          }}
        >
          <Paper
            elevation={3}
            ref={submenuRef}
            sx={{
              maxWidth: 280,
              maxHeight: MAX_HEIGHT_MENUS,
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.divider,
                borderRadius: '2px',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
              scrollbarWidth: 'thin',
              scrollbarColor: `${theme.palette.divider} transparent`,
            }}
          >
            <List dense sx={{ p: '8px 4px' }}>
              {submenuAnchor.item.submenu.map((submenuItem, idx) => {
                if (submenuItem.type === 'divider') {
                  return <Divider key={idx} sx={{ my: 0.5, backgroundColor: theme.palette.divider }} />;
                }

                // Check if this is a section header (uppercase label)
                const isSectionHeader =
                  submenuItem.title === submenuItem.title.toUpperCase() && submenuItem.title.length > 3;

                if (isSectionHeader) {
                  return (
                    <Box
                      key={idx}
                      sx={{
                        px: '10px',
                        py: '6px',
                        mt: idx > 0 ? 0.5 : 0,
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          fontSize: '10px',
                          color: theme.palette.text.disabled,
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {submenuItem.title}
                      </Box>
                    </Box>
                  );
                }

                const nonDividerItems = submenuAnchor.item.submenu!.filter(
                  (item) =>
                    item.type !== 'divider' && !(item.title === item.title.toUpperCase() && item.title.length > 3)
                );
                const actualIndex = nonDividerItems.indexOf(submenuItem);

                // Check if item has emoji (for Friendly/Professional)
                const hasEmoji = submenuItem.title === 'Friendly' || submenuItem.title === 'Professional';
                const emoji =
                  submenuItem.title === 'Friendly' ? '😊' : submenuItem.title === 'Professional' ? '💼' : null;

                return (
                  <ListItem key={idx} disablePadding>
                    <ListItemButton
                      data-submenu-item={actualIndex}
                      selected={actualIndex === submenuSelectedIndex}
                      disabled={aiLoading !== null}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSubmenuItem(submenuItem);
                      }}
                      onMouseEnter={() => setSubmenuSelectedIndex(actualIndex)}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        p: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor:
                          actualIndex === submenuSelectedIndex ? theme.palette.action.selected : 'transparent',
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        transition: 'all 150ms ease',
                        opacity: aiLoading !== null ? 0.5 : 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        {hasEmoji && emoji ? (
                          <Box sx={{ mr: 1.5, fontSize: '16px', display: 'flex', alignItems: 'center' }}>{emoji}</Box>
                        ) : submenuItem.icon ? (
                          <Box
                            sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: theme.palette.text.secondary }}
                          >
                            {aiLoading === submenuItem.value ? (
                              <CircularProgress size={20} sx={{ color: theme.palette.text.secondary }} />
                            ) : (
                              submenuItem.icon
                            )}
                          </Box>
                        ) : null}
                        <ListItemText
                          primary={submenuItem.title}
                          primaryTypographyProps={{
                            fontSize: '12px',
                            color: theme.palette.text.primary,
                          }}
                        />
                      </Box>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Popover>
      )}

      {/* Emoji Picker Popover */}
      {emojiPickerOpen && (
        <Popover
          open={emojiPickerOpen}
          anchorReference="anchorPosition"
          anchorPosition={emojiAnchorPosition}
          onClose={(_event, reason) => {
            if (reason === 'escapeKeyDown' || reason === 'backdropClick') {
              handleEmojiPickerClose();
            }
          }}
          disableRestoreFocus
          disableAutoFocus
          disableEnforceFocus
        >
          <SafeEmojiMartPicker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            }
          />
        </Popover>
      )}
    </>
  );
});

SlashMenu.displayName = 'SlashMenu';
