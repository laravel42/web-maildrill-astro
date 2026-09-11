/**
 * ComponentsLibraryDrawer — left-side persistent drawer that lists
 * every item across the Components Library taxonomy plus the Themes
 * gallery:
 *
 *   Blocks (incl. Sections at the bottom) / Templates / Themes
 *
 * Blocks is synthetic (built-in factories, see `builtInBlocks.tsx` /
 * `BlocksCategoryContent.tsx`) — no listing endpoint, no storage.
 * Sections and Templates are saved components fetched by id. Sections
 * no longer has its own Tab (point 7, EMAIL_BUILDER_TASKS.md) — its
 * search/sort toolbar and listing render inside the Blocks tab body,
 * below the built-in block tiles.
 *
 * Each card is a `react-dnd` drag source of type
 * `library-component`. Dropping it onto a block in the canvas (handled
 * by `EditorBlockWrapper`) or on the trailing area of a children list
 * (`EditorChildrenIds`) inserts the saved subtree (or a fresh built-in
 * block) at that position. Templates have a separate apply path
 * (replaces the entire document with a confirmation modal).
 *
 * Each per-category section component fetches its own listing endpoint
 * and renders cards via the shared `LibraryCard` component. The DnD
 * payload carries `category` and `axis` so drop targets can branch.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import {
  Alert,
  Box,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';

import EmptyState from '../../components/EmptyState';
import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import {
  getComponentsStorageMode,
  useComponentsLibraryDrawerOpen,
  useComponentsLibraryEnabled,
  useComponentsLibraryRefreshNonce,
  useSelectedMainTab,
  useTemplateLibrary,
} from '../../documents/editor/EditorContext';

import ApplyTemplateConfirmDialog from './ApplyTemplateConfirmDialog';
import BlocksCategoryContent from './BlocksCategoryContent';
import { SubcategoryAccordion } from './CategoryAccordion';
import CompactBlocksList from './CompactBlocksList';
import {
  type FetchableLibraryCategory,
  LIBRARY_COMPONENT_DND_TYPE,
  type LibraryComponentDragItem,
} from './dnd';
import { requestHoverEnter, requestHoverLeave, resetHoverPreview } from './hoverPreviewStore';
import LibraryHoverPreviewPortal, { clearHoverPreviewCache } from './LibraryHoverPreviewPortal';
import { filterLibraryItems, type LibrarySortKey, sortLibraryItems } from './librarySearch';
import LibrarySkeletonGrid from './LibrarySkeletonGrid';
import {
  getLocalThumbnail,
  localDeleteSavedComponent,
  localDeleteTemplate,
  localListSavedComponents,
  localListTemplates,
} from './localLibraryStore';
import RenameSubtreeDialog, { type RenameSubtreeTarget } from './RenameSubtreeDialog';
import { isThumbnailPending, useThumbnailStatusVersion } from './thumbnailStatus';
import LibraryCardPrimitiveRender from './thumbnail/LibraryCardPrimitiveRender';
import LibraryCardThumbnail from './thumbnail/LibraryCardThumbnail';
import { resolveThumbnailUrl } from './thumbnail/thumbnailUrl';

/** Width (in px) when the drawer is open. Collapses to 0 when closed. */
export const COMPONENTS_LIBRARY_DRAWER_WIDTH = 380;

/** Width (in px) when the drawer is collapsed to its compact base-blocks rail. */
export const COMPACT_LIBRARY_DRAWER_WIDTH = 164;

/** Card axis is per-category: role | type | shape | none. */
type LibraryItem = {
  id: string;
  axis: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  /** Optional, normalised free-text tags used by the search/filter toolbar. */
  tags?: string[];
  /**
   * True when the listing endpoint reports a sibling thumbnail file
   * exists. Sections, Layouts and Templates use this to decide
   * whether to render an `<img>` or a placeholder. Primitives ignore
   * it (they render inline via mini iframe). Themes have their own
   * card type.
   */
  hasThumbnail?: boolean;
  /**
   * Inlined block payload for primitives. The /dev/primitives listing
   * embeds each primitive's full block here so `LibraryCardPrimitiveRender`
   * can render a live preview without an extra fetch per card.
   * Undefined for non-primitive categories.
   */
  block?: unknown;
};
/** Ordered list of all known Section roles so the Sections tab can render
 * every role group (even empty ones), not just roles with saved content.
 * Mirrors ROLE_VALUES in the backend dev-save-section route. */
/** Sentinel axis for templates that carry no `usage` value. */
const TEMPLATE_USAGE_OTHER = '__other__';

// Point 7 (EMAIL_BUILDER_TASKS.md) removed the standalone "Sections" tab —
// its content (search/sort toolbar + SectionsCategoryContent) now renders
// at the bottom of the "Blocks" tab body instead of its own Tab entry.
const CATEGORIES: ReadonlyArray<{ key: string; labelKey: string; enabled: boolean }> = [
  { key: 'blocks', labelKey: 'componentsLibrary.drawer.category.blocks', enabled: true },
  { key: 'templates', labelKey: 'componentsLibrary.drawer.category.templates', enabled: true },
];

/**
 * Single draggable card. The drag item carries `(category, axis, id)`;
 * the drop handler fetches the actual NDJSON lazily so we never carry
 * the full subtree across the DnD boundary (keeps the drag preview
 * cheap).
 */
function LibraryCard({
  item,
  category,
  onClick,
}: {
  item: LibraryItem;
  category: FetchableLibraryCategory;
  /** Optional body-click handler; used by Templates to open the apply dialog. */
  onClick?: (item: LibraryItem) => void;
  onRename?: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
}) {
  const { t } = useTranslation('inspector');
  const theme = useTheme();
  // Templates are click-to-apply (they REPLACE the whole document via
  // ApplyTemplateConfirmDialog) and cannot be inline-dropped — every
  // drop target rejects them and warns. Skip wiring useDrag entirely
  // so the gesture isn't even captured: the card looks like a button
  // (no drag handle, no grab cursor) and click-to-open works without
  // competing with a drag start. Mirrors what ThemesList already does
  // for theme cards.
  const isDraggable = category !== 'template';
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: LIBRARY_COMPONENT_DND_TYPE,
      item: (): LibraryComponentDragItem => ({
        kind: LIBRARY_COMPONENT_DND_TYPE,
        category,
        axis: item.axis,
        id: item.id,
      }),
      canDrag: () => isDraggable,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [category, item.axis, item.id, isDraggable],
  );

  // While dragging, dismiss any open/pending hover preview — on narrow
  // screens the 640px popper covers the canvas and blocks the drop.
  useEffect(() => {
    if (isDragging) resetHoverPreview();
  }, [isDragging]);

  // Routing for the visual preview at the top of each card:
  //   - section/layout/template: static PNG/WebP thumbnail (capture
  //     done at save time, served by /dev/{category}/.../thumbnail).
  //   - primitive: inline live mini iframe rendered from the block
  //     payload that the listing endpoint embeds. NO static file.
  //   - theme: own card type (LibraryCardThemeSwatch) — handled by
  //     ThemesList, never reaches this LibraryCard.
  // Subscribe to incremental thumbnail-generation status so this card
  // re-renders (skeleton → image) as the lazy generator finishes each one.
  useThumbnailStatusVersion();
  const isLocalStorage = getComponentsStorageMode() === 'local';

  const showThumbnail = category === 'section' || category === 'layout' || category === 'template';
  const showPrimitiveRender = category === 'primitive' && item.block !== undefined;
  // In local mode read the data URL straight from the store — the listing's
  // `hasThumbnail` is a stale snapshot taken before incremental generation
  // fills them in. In backend mode fall back to the served endpoint, gated
  // by the listing's `hasThumbnail`.
  const thumbnailUrl = !showThumbnail
    ? null
    : isLocalStorage
      ? getLocalThumbnail(item.id)
      : item.hasThumbnail
        ? resolveThumbnailUrl(category, category === 'template' ? null : item.axis, item.id)
        : null;
  // Only sections/layouts/templates get generated previews; while queued and
  // not yet captured, the card shows a skeleton instead of "No preview".
  const thumbnailPending =
    showThumbnail && isLocalStorage && thumbnailUrl === null && isThumbnailPending(item.id);

  // Hover preview is rendered by a singleton at the drawer level — the
  // card just dispatches `(category, axis, id, name)` to the central
  // store on enter/leave. See `LibraryHoverPreviewPortal.tsx`.

  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      requestHoverEnter({
        anchor: e.currentTarget,
        category,
        axis: item.axis,
        id: item.id,
        name: item.name,
        primitiveBlock: category === 'primitive' ? item.block : undefined,
      }),
    onMouseLeave: requestHoverLeave,
  };

  if (category === 'template') {
    return (
      <div
        className="eb-template-card eb-template-card--page"
        {...hoverHandlers}
      >
        <div className="eb-template-card__body">
          <div className="eb-template-card__preview">
            {thumbnailPending ? (
              <Skeleton variant="rectangular" animation="wave" height="100%" width="100%" />
            ) : thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <div className="eb-template-card__preview--empty">
                {t('componentsLibrary.thumbnail.placeholder', 'No preview')}
              </div>
            )}
          </div>
          <span className="eb-template-card__label-row">
            <span className="eb-template-card__label">{item.name}</span>
          </span>
        </div>
        <button
          type="button"
          className="eb-template-card__action"
          aria-label={item.name}
          onClick={onClick ? () => onClick(item) : undefined}
        />
      </div>
    );
  }

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        // react-dnd's connector accepts a HTMLElement | null callback
        // ref. We don't need to compose with anything else here — the
        // anchor for the hover popper is captured from the mouse-enter
        // event target, not from this ref.
        if (isDraggable && node) (dragRef as unknown as (n: HTMLElement) => void)(node);
      }}
      {...hoverHandlers}
      onClick={onClick ? () => onClick(item) : undefined}
      sx={{
        p: 1,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: theme.palette.divider,
        cursor: onClick ? 'pointer' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        transition: 'background-color 120ms ease, border-color 120ms ease',
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
          borderColor: theme.palette.secondary.main,
        },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      {showPrimitiveRender && (
        <LibraryCardPrimitiveRender id={item.id} block={item.block} alt={item.name} />
      )}
      {showThumbnail && (
        <LibraryCardThumbnail
          src={thumbnailUrl}
          alt={item.name}
          loading={thumbnailPending}
          // Point 8 (EMAIL_BUILDER_TASKS.md): Templates previews were too
          // small — double the default 120px height for that category only.
          height={category === 'template' ? 240 : undefined}
          placeholderText={t('componentsLibrary.thumbnail.placeholder', 'No preview')}
          // Draft icon review (COMPONENT_ICONS_PLAN.md, Tanda 1) — only
          // renders when this item's id has a hand-designed icon; falls
          // back to the existing PNG/placeholder otherwise.
          iconId={item.id}
        />
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <DragIndicatorIcon
          sx={{
            fontSize: 16,
            color: 'text.secondary',
            flexShrink: 0,
            // Templates are click-only — hide the drag affordance so the
            // card doesn't look draggable.
            display: isDraggable ? 'inline-flex' : 'none',
          }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item.name}
          >
            {item.name}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Incrementally-rendered grid used by the Templates tab. Mounts the
 * first `VIRTUAL_PAGE_SIZE` cards and grows the window as a trailing
 * sentinel scrolls into view, so we never mount all ~460 template
 * cards (with their thumbnails) at once. Reverts the count whenever the
 * item list identity changes (search / filter / refresh).
 */
const VIRTUAL_PAGE_SIZE = 24;

function VirtualizedGrid({
  items,
  columns,
  className,
  renderItem,
}: {
  items: LibraryItem[];
  columns: number;
  className?: string;
  renderItem: (item: LibraryItem) => React.ReactNode;
}) {
  const [count, setCount] = useState(VIRTUAL_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCount(VIRTUAL_PAGE_SIZE);
  }, [items]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => (c < items.length ? Math.min(items.length, c + VIRTUAL_PAGE_SIZE) : c));
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, count]);

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        className={className}
        sx={
          className
            ? undefined
            : {
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: 0.5,
              }
        }
      >
        {items.slice(0, count).map((it) => renderItem(it))}
      </Box>
      {count < items.length && <Box ref={sentinelRef} sx={{ height: 1 }} />}
    </Box>
  );
}

/**
 * Generic listing renderer. Per-category content components fetch
 * their listing, transform it into `LibraryItem[]`, and pass it here
 * with the matching `category` so card payloads are correct.
 */
function CategoryListingBody({
  items,
  category,
  loading,
  error,
  groupLabelKey,
  columns,
  virtualize,
  search,
  sort,
  onClick,
  onRename,
  onDelete,
}: {
  items: LibraryItem[];
  category: FetchableLibraryCategory;
  loading: boolean;
  error: string | null;
  /** i18n prefix used to translate axis chip labels (e.g. section roles). */
  groupLabelKey?: string;
  /** When set, render a multi-column grid instead of a single column. */
  columns?: number;
  /** When true, render the flat list via the incremental VirtualizedGrid. */
  virtualize?: boolean;
  /** Global free-text search (shared across all categories). */
  search: string;
  /** Global sort key (shared across all categories). */
  sort: LibrarySortKey;
  onClick?: (item: LibraryItem) => void;
  onRename?: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
}) {
  const { t } = useTranslation('inspector');
  // Tag filter is LOCAL to each category and crosses axis groups. Axis
  // subdivisions are rendered as nested sub-accordions instead of a
  // filter. Search + sort come from the drawer.
  const [tags] = useState<string[]>([]);
  const [expandedAxes, setExpandedAxes] = useState<Record<string, boolean>>({});

  const query = useMemo(() => ({ search, axes: [], tags, sort }), [search, tags, sort]);
  const visible = useMemo(
    () => sortLibraryItems(filterLibraryItems(items, query), sort),
    [items, query, sort],
  );

  // Group the visible items by axis. Axes are sorted alphabetically so
  // the order is stable regardless of item sort; the "Other" sentinel
  // (templates with no usage) always sinks to the bottom.
  const axisGroups = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    for (const it of visible) {
      const bucket = map.get(it.axis) ?? [];
      bucket.push(it);
      map.set(it.axis, bucket);
    }
    const order = Array.from(map.keys()).sort((a, b) => {
      if (a === TEMPLATE_USAGE_OTHER) return 1;
      if (b === TEMPLATE_USAGE_OTHER) return -1;
      return a.localeCompare(b);
    });
    return order.map((axis) => ({ axis, items: map.get(axis) ?? [] }));
  }, [visible]);

  // A category is "flat" when every item shares an empty axis (e.g.
  // Templates) — render a single grid, no sub-accordions.
  const isFlat = axisGroups.length === 0 || (axisGroups.length === 1 && axisGroups[0].axis === '');

  const axisLabel = (axis: string) => {
    if (axis === TEMPLATE_USAGE_OTHER) return t('componentsLibrary.drawer.usageOther', 'Other');
    return groupLabelKey ? t(`${groupLabelKey}.${axis}`, axis) : axis;
  };

  const renderGrid = (list: LibraryItem[], keyPrefix: string) =>
    virtualize ? (
      <VirtualizedGrid
        items={list}
        columns={columns ?? 2}
        className={category === 'template' ? 'eb-template-grid' : undefined}
        renderItem={(it) => (
          <LibraryCard
            key={it.id}
            item={it}
            category={category}
            onClick={onClick}
            onRename={onRename}
            onDelete={onDelete}
          />
        )}
      />
    ) : (
      <Box
        className={category === 'template' ? 'eb-template-grid' : undefined}
        sx={
          category === 'template'
            ? undefined
            : {
                display: 'grid',
                gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : '1fr',
                gap: 0.5,
              }
        }
      >
        {list.map((it) => (
          <LibraryCard
            key={`${keyPrefix}/${it.id}`}
            item={it}
            category={category}
            onClick={onClick}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </Box>
    );

  const body = () => {
    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      );
    }
    if (loading && items.length === 0) {
      return (
        <LibrarySkeletonGrid
          columns={columns ?? 2}
          count={4}
          thumbnailHeight={category === 'template' ? 168 : 120}
        />
      );
    }
    if (!loading && items.length === 0) {
      return (
        <EmptyState
          icon={<Inventory2Outlined />}
          title={t('componentsLibrary.drawer.emptyTitle', 'Your library is empty')}
          description={t('componentsLibrary.drawer.empty')}
        />
      );
    }
    return (
      <Stack spacing={1} sx={{ pt: 0.5 }}>
        {visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('componentsLibrary.drawer.noResults', 'No components match your search.')}
          </Typography>
        ) : isFlat ? (
          renderGrid(visible, 'flat')
        ) : (
          <Box>
            {axisGroups.map((group) => (
              <SubcategoryAccordion
                key={group.axis}
                title={axisLabel(group.axis)}
                count={group.items.length}
                // All groups start collapsed; opening one collapses the rest
                // (single-open accordion) so the Blocks tab stays compact.
                expanded={expandedAxes[group.axis] ?? false}
                onToggle={(isExpanded) => setExpandedAxes(isExpanded ? { [group.axis]: true } : {})}
              >
                {renderGrid(group.items, group.axis)}
              </SubcategoryAccordion>
            ))}
          </Box>
        )}
      </Stack>
    );
  };

  return <>{body()}</>;
}

/** Generic fetch for a category listing endpoint. */
async function fetchListing<TItem>(url: string, collectionKey: string): Promise<TItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      hint?: string;
    } | null;
    if (response.status === 403) {
      throw new Error(body?.hint ?? 'Endpoint disabled in this environment.');
    }
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  const result = (await response.json()) as Record<string, TItem[]>;
  return result[collectionKey] ?? [];
}

/**
 * Props shared by every per-category content component. The drawer
 * owns the global search + sort and the per-category expanded state,
 * and threads them down so each accordion stays in sync.
 */
type CategoryContentProps = {
  refreshKey: number;
  search: string;
  sort: LibrarySortKey;
  onRename: (target: RenameSubtreeTarget) => void;
  onChange: () => void;
};

/** Sections — axis = role, supports rename + delete. */
function SectionsCategoryContent({
  refreshKey,
  search,
  sort,
  onRename,
  onChange,
}: CategoryContentProps) {
  const { t } = useTranslation('inspector');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Local storage mode reads saved sections from localStorage.
      if (getComponentsStorageMode() === 'local') {
        setItems(localListSavedComponents('section'));
        return;
      }
      const list = await fetchListing<{
        id: string;
        role: string;
        name: string;
        description?: string;
        createdAt: string;
        updatedAt: string;
        blockCount: number;
        sizeBytes: number;
        hasThumbnail?: boolean;
        tags?: string[];
      }>(`${resolveBackendUrl()}/dev/sections`, 'sections');
      setItems(list.map((s) => ({ ...s, axis: s.role })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const handleDelete = useCallback(
    async (item: LibraryItem) => {
      const confirmed = window.confirm(
        t(
          'componentsLibrary.drawer.deleteConfirm',
          'Delete component "{{name}}"? This cannot be undone.',
          {
            name: item.name,
          },
        ),
      );
      if (!confirmed) return;
      try {
        if (getComponentsStorageMode() === 'local') {
          localDeleteSavedComponent('section', item.id);
        } else {
          const response = await fetch(
            `${resolveBackendUrl()}/dev/sections/${encodeURIComponent(item.axis)}/${encodeURIComponent(item.id)}`,
            { method: 'DELETE' },
          );
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? `HTTP ${response.status}`);
          }
        }
        setItems((prev) => prev.filter((c) => !(c.axis === item.axis && c.id === item.id)));
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [t, onChange],
  );

  return (
    <CategoryListingBody
      items={items}
      category="section"
      loading={loading}
      error={error}
      columns={2}
      groupLabelKey="componentsLibrary.sectionRole"
      search={search}
      sort={sort}
      onRename={(item) =>
        onRename({
          category: 'section',
          axis: item.axis,
          id: item.id,
          name: item.name,
          description: item.description,
          tags: item.tags,
        })
      }
      onDelete={handleDelete}
    />
  );
}

/** Templates — no axis (flat). Click-to-apply replaces the document. Rename + delete. */
function TemplatesCategoryContent({
  refreshKey,
  search,
  sort,
  onRename,
  onChange,
}: CategoryContentProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<LibraryItem | null>(null);
  const { t } = useTranslation('inspector');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (getComponentsStorageMode() === 'local') {
        // Few local templates — render them as a single flat grid (empty
        // axis makes the shared body treat the category as flat, no usage
        // sub-accordion).
        setItems(localListTemplates().map((tpl) => ({ ...tpl, axis: '' })));
        return;
      }
      const list = await fetchListing<{
        id: string;
        name: string;
        description?: string;
        usage?: string | null;
        createdAt: string;
        updatedAt: string;
        blockCount: number;
        sizeBytes: number;
        hasThumbnail?: boolean;
        tags?: string[];
      }>(`${resolveBackendUrl()}/dev/templates`, 'templates');
      // Map the `usage` field onto `axis` so the shared CategoryListingBody
      // subdivides templates into per-usage sub-accordions. Templates
      // without a usage fall back to the "Other" group.
      setItems(list.map((tpl) => ({ ...tpl, axis: tpl.usage || TEMPLATE_USAGE_OTHER })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const handleDelete = useCallback(
    async (item: LibraryItem) => {
      if (
        !window.confirm(t('componentsLibrary.drawer.deleteConfirm', 'Delete?', { name: item.name }))
      ) {
        return;
      }
      try {
        if (getComponentsStorageMode() === 'local') {
          localDeleteTemplate(item.id);
        } else {
          const response = await fetch(
            `${resolveBackendUrl()}/dev/templates/${encodeURIComponent(item.id)}`,
            {
              method: 'DELETE',
            },
          );
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? `HTTP ${response.status}`);
          }
        }
        setItems((prev) => prev.filter((c) => c.id !== item.id));
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [t, onChange],
  );

  return (
    <>
      <CategoryListingBody
        items={items}
        category="template"
        loading={loading}
        error={error}
        columns={2}
        virtualize
        search={search}
        sort={sort}
        onClick={setApplyTarget}
        onRename={(item) =>
          onRename({
            category: 'template',
            axis: '',
            id: item.id,
            name: item.name,
            description: item.description,
            tags: item.tags,
          })
        }
        onDelete={handleDelete}
      />
      <ApplyTemplateConfirmDialog
        templateId={applyTarget?.id ?? null}
        templateName={applyTarget?.name ?? ''}
        onClose={() => setApplyTarget(null)}
        onApplied={() => setApplyTarget(null)}
      />
    </>
  );
}

/**
 * The drawer body. Mounted as a flex sibling of the canvas (left of
 * the editor) so its width can transition smoothly. When closed the
 * box collapses to width 0; the toggle handle (rendered separately)
 * brings it back into view.
 */
export default function ComponentsLibraryDrawer() {
  const open = useComponentsLibraryDrawerOpen();
  // Two states only: closed = compact base-blocks rail, open = full
  // Components Library. The rail is always visible (never collapses to
  // 0) so base blocks stay one click/drag away even when "closed".
  const drawerWidth = open ? COMPONENTS_LIBRARY_DRAWER_WIDTH : COMPACT_LIBRARY_DRAWER_WIDTH;
  const enabled = useComponentsLibraryEnabled();
  const selectedMainTab = useSelectedMainTab();
  const templateLibrary = useTemplateLibrary();
  const libraryRefreshNonce = useComponentsLibraryRefreshNonce();
  const { t } = useTranslation('inspector');
  const theme = useTheme();
  // Local storage mode persists Sections / Templates in localStorage, so
  // both tabs are available. Blocks is always available (client-side
  // factories, no storage). When templateLibrary is disabled, hide only
  // the Templates tab.
  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter((c) => {
        if (!templateLibrary && c.key === 'templates') return false;
        return true;
      }),
    [templateLibrary],
  );
  const [sectionsRefreshKey, setSectionsRefreshKey] = useState(0);
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);
  const [renameTarget, setRenameTarget] = useState<RenameSubtreeTarget | null>(null);

  // Sections (bottom of the Blocks tab, per Point 7) and Templates render
  // as plain listings: unfiltered and sorted newest-first. The former
  // shared search/sort state was left without any writer after Point 7
  // removed the toolbars, so it could only ever hold these defaults —
  // keeping it as mutable state was dead code AND a latent cross-tab leak
  // (a future writer on one tab would silently reorder the other). Pass
  // explicit constants instead. (Restoring a per-tab search/sort toolbar
  // is a separate task; when added it MUST be local per listing, never a
  // single shared value across tabs.)
  const SEARCH_UNFILTERED = '';
  const SORT_DEFAULT: LibrarySortKey = 'updatedDesc';
  // Active category tab. Defaults to the first visible category.
  const [activeTab, setActiveTab] = useState<string>(() => visibleCategories[0]?.key ?? 'blocks');

  // Keep the active tab valid when the visible set changes (disabling
  // templateLibrary hides Templates).
  useEffect(() => {
    if (!visibleCategories.some((c) => c.key === activeTab)) {
      setActiveTab(visibleCategories[0]?.key ?? 'blocks');
    }
  }, [visibleCategories, activeTab]);

  // External mutations to localStorage (the seeder / lazy thumbnail
  // generator) bump the global nonce; refetch every tab in response.
  // Skip the initial 0 so we don't double-fetch on mount.
  useEffect(() => {
    if (libraryRefreshNonce === 0) return;
    setSectionsRefreshKey((k) => k + 1);
    setTemplatesRefreshKey((k) => k + 1);
    clearHoverPreviewCache();
  }, [libraryRefreshNonce]);

  /** When rename succeeds, bump the matching category so its listing refetches. */
  const bumpAfterRename = useCallback((category: FetchableLibraryCategory) => {
    switch (category) {
      case 'section':
        setSectionsRefreshKey((k) => k + 1);
        break;
      case 'template':
        setTemplatesRefreshKey((k) => k + 1);
        break;
    }
  }, []);

  // Render nothing when the library is disabled — gated by dev mode OR
  // an explicit local storage mode (e.g. a backend-less landing page).
  // The left panel only exists in the editor: never in preview / html /
  // json views.
  if (!enabled || selectedMainTab !== 'editor') return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 10,
        width: drawerWidth,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        backgroundColor: theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
      }}
    >
      <Box
        sx={{
          width: drawerWidth,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {open ? (
          <>
            <Box className="eb-side-tabs">
              <Tabs
                value={activeTab}
                onChange={(_, v: string) => setActiveTab(v)}
                variant="fullWidth"
                aria-label={t('componentsLibrary.drawer.title')}
              >
                {visibleCategories.map((c) => (
                  <Tab
                    key={c.key}
                    value={c.key}
                    label={t(c.labelKey)}
                    disableRipple
                  />
                ))}
              </Tabs>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pb: 2, pt: 1 }}>
              {activeTab === 'blocks' && (
                <>
                  <BlocksCategoryContent />
                  {/* Point 7 (EMAIL_BUILDER_TASKS.md): the former standalone
                      "Sections" tab now lives at the bottom of the Blocks
                      tab instead of its own Tab entry. No title/search/sort
                      toolbar — just the listing, grouped by role. */}
                  <Box
                    sx={{
                      mt: 2,
                      pt: 1.5,
                      borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <SectionsCategoryContent
                      search={SEARCH_UNFILTERED}
                      sort={SORT_DEFAULT}
                      onRename={setRenameTarget}
                      refreshKey={sectionsRefreshKey}
                      onChange={() => setSectionsRefreshKey((k) => k + 1)}
                    />
                  </Box>
                </>
              )}
              {activeTab === 'templates' && (
                <TemplatesCategoryContent
                  search={SEARCH_UNFILTERED}
                  sort={SORT_DEFAULT}
                  onRename={setRenameTarget}
                  refreshKey={templatesRefreshKey}
                  onChange={() => setTemplatesRefreshKey((k) => k + 1)}
                />
              )}
            </Box>
          </>
        ) : (
          <CompactBlocksList />
        )}
      </Box>

      <RenameSubtreeDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => {
          if (renameTarget) bumpAfterRename(renameTarget.category);
          setRenameTarget(null);
        }}
      />
      {/* Singleton hover preview — one iframe + one React portal for
          the entire drawer. Cards dispatch (category, axis, id, name)
          to `hoverPreviewStore` on mouse enter / leave; this component
          is the sole consumer. See `LibraryHoverPreviewPortal.tsx`. */}
      <LibraryHoverPreviewPortal />
    </Box>
  );
}
