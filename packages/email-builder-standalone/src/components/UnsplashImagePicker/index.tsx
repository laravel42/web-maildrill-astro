import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Search } from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import { atomicUpdateBlockProps } from '../../documents/editor/granular';
import { setUnsplashCredit } from '../../documents/editor/unsplashCreditsStore';

import {
  buildEmailImageUrl,
  resolveBackendUrl,
  type SearchErrorKind,
  searchUnsplash,
  trackUnsplashDownload,
  type UnsplashPhoto,
  UnsplashSearchError,
} from './unsplash-api';

const SEARCH_DEBOUNCE_MS = 350;
const PER_PAGE = 20;
const LOW_QUOTA_THRESHOLD = 10;

type Orientation = 'any' | 'landscape' | 'portrait' | 'squarish';
const ORIENTATIONS: Orientation[] = ['any', 'landscape', 'portrait', 'squarish'];

/**
 * Module-level cache so the picker retains its last search when the user
 * switches tabs and comes back. Never exported — purely internal.
 */
const _cache: {
  query: string;
  orientation: Orientation;
  photos: UnsplashPhoto[];
  page: number;
  totalPages: number;
  selectedPhoto: UnsplashPhoto | null;
} = { query: '', orientation: 'any', photos: [], page: 0, totalPages: 0, selectedPhoto: null };

/**
 * Where the picker is rendered. `image` goes through the granular API
 * (surgical prop update, no Zod strip); `background` dispatches the event
 * so `BackgroundImageInput` can preserve the existing CSS shorthand
 * (size/position/repeat/color) while swapping only the URL.
 */
type PanelSource = 'image' | 'background';

interface UnsplashImagePickerProps {
  /** Overrides `VITE_AI_BACKEND_URL`. Defaults to `http://localhost:3100`. */
  backendUrl?: string;
  /** Block ID to update. When provided, skips the global event listener. */
  blockId?: string | null;
  /** Panel source override. Defaults to listening via the global event. */
  source?: PanelSource;
}

interface ImagePanelOpenedDetail {
  blockId: string;
  currentImageUrl: string | null;
  alt: string | null;
  source?: PanelSource;
}

/**
 * Unsplash-backed image picker. Designed to live inside an `ImageSourceTabs`
 * tab — no Paper/title/subtitle of its own. Compliance matrix for the API
 * Terms is documented in `docs/unsplash-gallery-plan.md`.
 */
const UnsplashImagePicker: React.FC<UnsplashImagePickerProps> = ({
  backendUrl,
  blockId: blockIdProp,
  source: sourceProp,
}) => {
  const { t } = useTranslation('inspector');
  const resolvedBackendUrl = useMemo(() => resolveBackendUrl(backendUrl), [backendUrl]);

  const [currentBlockId, setCurrentBlockId] = useState<string | null>(blockIdProp ?? null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [source, setSource] = useState<PanelSource>(sourceProp ?? 'image');

  // Sync with prop changes (e.g. when parent re-renders with a new blockId)
  useEffect(() => {
    if (blockIdProp != null) setCurrentBlockId(blockIdProp);
  }, [blockIdProp]);
  useEffect(() => {
    if (sourceProp != null) setSource(sourceProp);
  }, [sourceProp]);

  const [query, setQuery] = useState(_cache.query);
  const [orientation, setOrientation] = useState<Orientation>(_cache.orientation);

  const [photos, setPhotos] = useState<UnsplashPhoto[]>(_cache.photos);
  const [page, setPage] = useState(_cache.page);
  const [totalPages, setTotalPages] = useState(_cache.totalPages);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  // The committed photo is shown by `SourceImagePreview` (mounted by the
  // parent picker), so this state is only kept as an in-memory cache so that
  // re-mounting the gallery doesn't lose track of the last selection.
  const [, setSelectedPhoto] = useState<UnsplashPhoto | null>(_cache.selectedPhoto);

  const [loading, setLoading] = useState(false);
  const [errorKind, setErrorKind] = useState<SearchErrorKind | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onPanelOpen = (event: Event) => {
      const { detail } = event as CustomEvent<ImagePanelOpenedDetail>;
      setCurrentBlockId(detail.blockId);
      setCurrentImageUrl(detail.currentImageUrl);
      setSource(detail.source ?? 'image');
    };
    window.addEventListener('email-builder-image-panel-opened', onPanelOpen);
    return () => window.removeEventListener('email-builder-image-panel-opened', onPanelOpen);
  }, []);

  const runSearch = useCallback(
    async (nextQuery: string, nextOrientation: Orientation, nextPage: number, append: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErrorKind(null);
      try {
        const res = await searchUnsplash(resolvedBackendUrl, {
          query: nextQuery,
          page: nextPage,
          perPage: PER_PAGE,
          orientation: nextOrientation === 'any' ? undefined : nextOrientation,
          signal: controller.signal,
        });
        setRateLimitRemaining(res.rateLimitRemaining);
        setTotalPages(res.totalPages);
        setPage(nextPage);
        setPhotos((prev) => {
          const next = append ? [...prev, ...res.results] : res.results;
          _cache.photos = next;
          _cache.page = nextPage;
          _cache.totalPages = res.totalPages;
          return next;
        });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setErrorKind(err instanceof UnsplashSearchError ? err.kind : 'unknown');
        if (!append) setPhotos([]);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    [resolvedBackendUrl]
  );

  useEffect(() => {
    _cache.query = query;
    _cache.orientation = orientation;
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      abortRef.current?.abort();
      setPhotos([]);
      setPage(0);
      setTotalPages(0);
      setErrorKind(null);
      _cache.photos = [];
      _cache.page = 0;
      _cache.totalPages = 0;
      return;
    }
    const handle = window.setTimeout(() => {
      void runSearch(trimmed, orientation, 1, false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, orientation, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canLoadMore = page > 0 && page < totalPages && !loading;

  const handleLoadMore = (): void => {
    const trimmed = query.trim();
    if (!trimmed || !canLoadMore) return;
    void runSearch(trimmed, orientation, page + 1, true);
  };

  const handlePick = (photo: UnsplashPhoto): void => {
    if (!currentBlockId) return;
    const url = buildEmailImageUrl(photo);

    if (source === 'image') {
      atomicUpdateBlockProps(currentBlockId, { url, alt: photo.attribution });
    } else {
      window.dispatchEvent(new CustomEvent('email-builder-set-image', { detail: { url } }));
    }

    setSelectedPhoto(photo);
    _cache.selectedPhoto = photo;

    setUnsplashCredit(currentBlockId, {
      photoId: photo.id,
      photographerName: photo.user.name,
      photographerUrl: photo.user.profileUrl,
      unsplashUrl: photo.unsplashUrl,
    });

    trackUnsplashDownload(resolvedBackendUrl, photo.links.downloadLocation);
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('inputs.unsplash.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start" sx={{ mr: 0.5, ml: 0 }}>
                  <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              pl: 0.75,
            },
            '& .MuiOutlinedInput-input': {
              pl: 0,
            },
          }}
        />
        {rateLimitRemaining !== null && rateLimitRemaining <= LOW_QUOTA_THRESHOLD && (
          <Chip
            label={t('inputs.unsplash.quotaLow', { remaining: rateLimitRemaining })}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Stack>

      <Tabs
        value={orientation}
        onChange={(_, v: Orientation) => setOrientation(v)}
        variant="fullWidth"
        sx={{
          minHeight: 30,
          mb: 1.5,
          '& .MuiTabs-flexContainer': { gap: 0 },
          '& .MuiTab-root': {
            minHeight: 30,
            minWidth: 0,
            flex: 1,
            px: 0.5,
            py: 0.25,
            fontSize: '0.7rem',
            textTransform: 'none',
            color: 'text.secondary',
            '&.Mui-selected': { color: 'primary.main' },
          },
        }}
      >
        {ORIENTATIONS.map((o) => (
          <Tab key={o} value={o} label={t(`inputs.unsplash.orientation.${o}`)} disableRipple />
        ))}
      </Tabs>

      {errorKind && (
        <Alert severity={errorKind === 'not_configured' ? 'warning' : 'error'} sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          {t(`inputs.unsplash.error.${errorKind}`)}
        </Alert>
      )}

      {loading && photos.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={22} />
        </Box>
      )}

      {!loading && !errorKind && photos.length === 0 && query.trim().length === 0 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="caption" color="text.secondary">
            {t('inputs.unsplash.emptyInitial')}
          </Typography>
        </Box>
      )}

      {!loading && !errorKind && photos.length === 0 && query.trim().length > 0 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="caption" color="text.secondary">
            {t('inputs.unsplash.emptyNoResults', { query: query.trim() })}
          </Typography>
        </Box>
      )}

      {photos.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
            maxHeight: 380,
            overflowY: 'auto',
          }}
        >
          {photos.map((photo) => {
            const selected = currentImageUrl?.includes(photo.id) ?? false;
            return <UnsplashTile key={photo.id} photo={photo} selected={selected} onPick={() => handlePick(photo)} />;
          })}
        </Box>
      )}

      {canLoadMore && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link component="button" variant="caption" onClick={handleLoadMore} sx={{ cursor: 'pointer' }}>
            {t('inputs.unsplash.loadMore')}
          </Link>
        </Box>
      )}

      {/* §10 — keep the Unsplash mark visible in the Developer App. */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 1.5,
          color: 'text.secondary',
          textAlign: 'center',
          fontSize: '0.65rem',
        }}
      >
        {t('inputs.unsplash.poweredBy')}{' '}
        <Link
          href="https://unsplash.com/?utm_source=email-builder-online&utm_medium=referral"
          target="_blank"
          rel="noreferrer noopener"
          underline="hover"
          color="inherit"
        >
          Unsplash
        </Link>
      </Typography>
    </Box>
  );
};

interface UnsplashTileProps {
  photo: UnsplashPhoto;
  selected: boolean;
  onPick: () => void;
}

/**
 * Single photo tile. Renders an always-visible credit line below the image
 * with photographer name linked to their profile and "Unsplash" linked to
 * the homepage — both with UTMs per API Terms §9.
 */
const UnsplashTile: React.FC<UnsplashTileProps> = ({ photo, selected, onPick }) => {
  const { t } = useTranslation('inspector');
  const placeholder = photo.color ?? undefined;
  return (
    <Box
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        cursor: 'pointer',
        backgroundColor: placeholder ?? 'action.hover',
        transition: 'border-color 0.15s ease',
        '&:hover': { borderColor: 'primary.light' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}>
        <img
          src={photo.urls.thumb}
          alt={photo.alt}
          loading="lazy"
          onClick={onPick}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </Box>
      <Box
        sx={{
          px: 0.75,
          py: 0.5,
          fontSize: '0.6rem',
          lineHeight: 1.3,
          bgcolor: '#1a1a1a',
          color: '#ccc',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        <Trans
          t={t}
          i18nKey="inputs.unsplash.creditLine"
          values={{ author: photo.user.name }}
          components={{
            authorLink: (
              <Link
                href={photo.user.profileUrl}
                target="_blank"
                rel="noreferrer noopener"
                underline="hover"
                onClick={(e) => e.stopPropagation()}
                sx={{
                  color: '#fff',
                  fontSize: 'inherit',
                  fontWeight: 500,
                  '&:hover': { textShadow: '0 0 6px rgba(255,255,255,0.6)' },
                }}
              />
            ),
            unsplashLink: (
              <Link
                href={photo.unsplashUrl}
                target="_blank"
                rel="noreferrer noopener"
                underline="hover"
                onClick={(e) => e.stopPropagation()}
                sx={{
                  color: '#fff',
                  fontSize: 'inherit',
                  fontWeight: 500,
                  '&:hover': { textShadow: '0 0 6px rgba(255,255,255,0.6)' },
                }}
              />
            ),
          }}
        />
      </Box>
    </Box>
  );
};

export default UnsplashImagePicker;
