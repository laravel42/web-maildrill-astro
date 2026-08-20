/**
 * LibrarySearchToolbar — compact search + filter + sort controls shown
 * above each category listing in the Components Library drawer. Purely
 * controlled: it reads `query` and emits the next query via `onChange`.
 * Filter option lists (`availableAxes` / `availableTags`) are derived
 * by the parent from the current listing so they always reflect the
 * real corpus.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import SearchOutlined from '@mui/icons-material/SearchOutlined';
import {
  Autocomplete,
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { INPUT_TEXTFIELD_SX } from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';
import CustomSelect from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/Select';
import LabelProperty from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

import { isLibraryQueryActive, LIBRARY_SORT_KEYS, type LibraryQuery } from './librarySearch';

export default function LibrarySearchToolbar({
  query,
  onChange,
  availableAxes,
  availableTags,
  resultCount,
  totalCount,
}: {
  query: LibraryQuery;
  onChange: (next: LibraryQuery) => void;
  availableAxes: string[];
  availableTags: string[];
  resultCount: number;
  totalCount: number;
}) {
  const { t } = useTranslation('inspector');
  const active = isLibraryQueryActive(query);

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <TextField
        size="small"
        value={query.search}
        onChange={(e) => onChange({ ...query, search: e.target.value })}
        placeholder={t('componentsLibrary.search.placeholder', 'Search…')}
        sx={INPUT_TEXTFIELD_SX}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack direction="row" spacing={1}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LabelProperty label={t('componentsLibrary.search.sortLabel', 'Sort')} />
          <CustomSelect
            value={query.sort}
            onChange={(e) => onChange({ ...query, sort: e.target.value as LibraryQuery['sort'] })}
            size="small"
          >
            {LIBRARY_SORT_KEYS.map((key) => (
              <MenuItem key={key} value={key} sx={{ fontSize: '0.8rem' }}>
                {t(`componentsLibrary.search.sort.${key}`, key)}
              </MenuItem>
            ))}
          </CustomSelect>
        </div>

        {availableAxes.length > 1 && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <LabelProperty label={t('componentsLibrary.search.axisLabel', 'Filter')} />
            <CustomSelect
              multiple
              value={query.axes}
              onChange={(e) =>
                onChange({
                  ...query,
                  axes:
                    typeof e.target.value === 'string'
                      ? [e.target.value]
                      : (e.target.value as string[]),
                })
              }
              renderValue={(selected) => (selected as string[]).join(', ')}
              size="small"
            >
              {availableAxes.map((axis) => (
                <MenuItem key={axis} value={axis} sx={{ fontSize: '0.8rem' }}>
                  {axis}
                </MenuItem>
              ))}
            </CustomSelect>
          </div>
        )}
      </Stack>

      {availableTags.length > 0 && (
        <Autocomplete
          multiple
          size="small"
          options={availableTags}
          value={query.tags}
          onChange={(_, value) => onChange({ ...query, tags: value })}
          slotProps={{ chip: { size: 'small' } }}
          renderInput={(params) => (
            <TextField {...params} placeholder={t('componentsLibrary.search.tagsLabel', 'Tags')} />
          )}
        />
      )}

      {active && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {t('componentsLibrary.search.results', '{{count}} of {{total}}', {
              count: resultCount,
              total: totalCount,
            })}
          </Typography>
          <Button
            size="small"
            onClick={() => onChange({ ...query, search: '', axes: [], tags: [] })}
            sx={{ fontSize: '0.7rem', minWidth: 0, textTransform: 'none' }}
          >
            {t('componentsLibrary.search.clear', 'Clear')}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
