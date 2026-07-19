/**
 * ThemesList — gallery of saved theme bundles, surfaced as a tab in
 * `ComponentsLibraryDrawer`. Each card represents one theme bundle:
 *
 *   - clicking the card body → opens `ApplyThemeConfirmDialog`
 *     (overwrite root globals + theme.blocks atomically)
 *   - the pencil icon → opens `RenameThemeDialog`
 *     (PUT /dev/themes/:id with new name / description)
 *   - the trash icon  → confirm + DELETE /dev/themes/:id
 *
 * Themes do NOT participate in DnD — they apply globally, not per drop
 * target. Hence no `useDrag` here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import CheckOutlined from '@mui/icons-material/CheckOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import { Alert, Box, Chip, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';

import EmptyState from '../../components/EmptyState';
import { useAppliedThemeId } from '../../documents/editor/EditorContext';
import ApplyThemeConfirmDialog from '../TemplatePanel/ThemePanel/ApplyThemeConfirmDialog';
import RenameThemeDialog from '../TemplatePanel/ThemePanel/RenameThemeDialog';

import { deleteTheme, listThemes, type ThemeListing } from './fetchTheme';
import { requestHoverEnter, requestHoverLeave } from './hoverPreviewStore';
import LibrarySkeletonGrid from './LibrarySkeletonGrid';
import LibraryCardThemeSwatch from './thumbnail/LibraryCardThemeSwatch';

/**
 * Per-card sub-component. Defining it at module scope (not inline
 * inside `ThemesList`) avoids re-creating the component identity on
 * every parent render — which would unmount + remount each card and
 * destroy the hover state mid-interaction. See AGENTS.md performance
 * rules: "NEVER define React components inside other components".
 */
function ThemeCard({
  item,
  selected,
  onApply,
  onRename,
  onDelete,
  t,
  themeBorder,
  themeHoverBg,
  themeHoverBorder,
  themeSelectedBorder,
}: {
  item: ThemeListing;
  selected: boolean;
  onApply: (item: ThemeListing) => void;
  onRename: (item: ThemeListing) => void;
  onDelete: (item: ThemeListing) => void;
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string;
  themeBorder: string;
  themeHoverBg: string;
  themeHoverBorder: string;
  themeSelectedBorder: string;
}) {
  return (
    <Box
      onMouseEnter={(e) =>
        requestHoverEnter({
          anchor: e.currentTarget,
          category: 'theme',
          axis: '',
          id: item.id,
          name: item.name,
          themeBundle: {
            globals: item.globals as Record<string, unknown> | undefined,
            blocks: item.blocks,
          },
        })
      }
      onMouseLeave={requestHoverLeave}
      onClick={() => onApply(item)}
      sx={{
        p: 1,
        borderRadius: 1,
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? themeSelectedBorder : themeBorder,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        transition: 'background-color 120ms ease, border-color 120ms ease',
        '&:hover': {
          backgroundColor: themeHoverBg,
          borderColor: selected ? themeSelectedBorder : themeHoverBorder,
        },
      }}
    >
      <LibraryCardThemeSwatch globals={item.globals} alt={item.name} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={item.name}
            >
              {item.name}
            </Typography>
            {selected && (
              <Chip
                size="small"
                color="primary"
                icon={<CheckOutlined />}
                label={t('theme.applied.badge', 'Selected')}
                sx={{ height: 18, flexShrink: 0, '& .MuiChip-label': { px: 0.5, fontSize: 11 } }}
              />
            )}
          </Box>
          {item.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
          <Tooltip title={t('componentsLibrary.drawer.themes.rename', 'Rename theme')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onRename(item);
              }}
            >
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('componentsLibrary.drawer.themes.delete', 'Delete theme')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
            >
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

type ThemesListProps = {
  /**
   * Bumped by `ComponentsLibraryDrawer` after a save / apply event so
   * the list re-fetches and surfaces the latest entries. Wired through
   * a number rather than a callback to keep the component stateless.
   */
  refreshKey: number;
  /** Tells the parent to re-list (e.g. after we delete an entry). */
  onChange: () => void;
  /** Global free-text search shared across the drawer. */
  search?: string;
  /** Reports (filtered, total) counts so the accordion header badge updates. */
  onCounts?: (filtered: number, total: number) => void;
};

export default function ThemesList({ refreshKey, onChange, search = '', onCounts }: ThemesListProps) {
  const { t } = useTranslation('inspector');
  const theme = useTheme();
  const appliedThemeId = useAppliedThemeId();
  const [items, setItems] = useState<ThemeListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<ThemeListing | null>(null);
  const [renameTarget, setRenameTarget] = useState<ThemeListing | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listThemes();
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  // Free-text filter over name + description (themes have no axis/tags).
  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => `${it.name} ${it.description ?? ''}`.toLowerCase().includes(q));
  }, [items, search]);

  useEffect(() => {
    onCounts?.(visible.length, items.length);
  }, [visible.length, items.length, onCounts]);

  const handleDelete = useCallback(
    async (item: ThemeListing) => {
      const confirmed = window.confirm(
        t('componentsLibrary.drawer.themes.deleteConfirm', 'Delete theme "{{name}}"? This cannot be undone.', {
          name: item.name,
        })
      );
      if (!confirmed) return;
      try {
        await deleteTheme(item.id);
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [t, onChange]
  );

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        {error}
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return <LibrarySkeletonGrid columns={1} count={3} thumbnailHeight={64} />;
  }

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        icon={<PaletteOutlined />}
        title={t('componentsLibrary.drawer.themes.emptyTitle', 'No themes yet')}
        description={t('componentsLibrary.drawer.themes.empty', 'No themes saved yet.')}
      />
    );
  }

  return (
    <>
      {visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('componentsLibrary.drawer.noResults', 'No components match your search.')}
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {visible.map((item) => (
            <ThemeCard
              key={item.id}
              item={item}
              selected={appliedThemeId === item.id}
              onApply={setApplyTarget}
              onRename={setRenameTarget}
              onDelete={handleDelete}
              t={t}
              themeBorder={theme.palette.divider}
              themeHoverBg={theme.palette.action.hover}
              themeHoverBorder={theme.palette.secondary.main}
              themeSelectedBorder={theme.palette.primary.main}
            />
          ))}
        </Stack>
      )}

      <ApplyThemeConfirmDialog
        themeId={applyTarget?.id ?? null}
        themeName={applyTarget?.name ?? ''}
        onClose={() => setApplyTarget(null)}
        onApplied={() => {
          setApplyTarget(null);
          onChange();
        }}
      />

      <RenameThemeDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => {
          setRenameTarget(null);
          onChange();
        }}
      />
    </>
  );
}
