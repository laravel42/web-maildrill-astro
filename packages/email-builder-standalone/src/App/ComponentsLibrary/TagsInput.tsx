/**
 * TagsInput — shared free-text tag entry used by the save/rename
 * dialogs. Wraps a MUI `Autocomplete` (multiple, freeSolo) and applies
 * the same normalisation the backend enforces (trim, lowercase,
 * de-duplicate, cap at MAX_TAGS) so what the user sees matches what is
 * persisted.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Autocomplete, TextField } from '@mui/material';

import { BORDER_RADIUS } from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';
import LabelProperty from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

const MAX_TAGS = 12;
const TAG_MAX_LENGTH = 32;

function normalize(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, TAG_MAX_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export default function TagsInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('inspector');
  return (
    <div>
      <LabelProperty label={t('componentsLibrary.save.tagsLabel', 'Tags (optional)')} />
      <Autocomplete
        multiple
        freeSolo
        options={[] as string[]}
        value={value}
        disabled={disabled}
        onChange={(_, next) => onChange(normalize(next as string[]))}
        slotProps={{ chip: { size: 'small' } }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t('componentsLibrary.save.tagsPlaceholder', 'Add tag…')}
            helperText={t('componentsLibrary.save.tagsHelp', 'Press Enter to add. Up to 12 tags.')}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${BORDER_RADIUS}px` } }}
          />
        )}
      />
    </div>
  );
}
