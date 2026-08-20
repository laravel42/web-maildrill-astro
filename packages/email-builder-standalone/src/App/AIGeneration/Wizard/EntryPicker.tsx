import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';

interface Props {
  onSelect: (mode: 'direct' | 'wizard') => void;
}

interface ModeCardProps {
  title: string;
  description: string;
  hint: string;
  /** Wizard is the richer path — slight accent emphasis vs Direct. */
  emphasized?: boolean;
  onClick: () => void;
}

const ACCENT = '#4f46e5';
const ACCENT_TINT = '#eef0ff';

/**
 * One selectable path. Hint leads as a time/effort chip; title + body follow
 * so the two options scan as a quick comparison before the user commits.
 */
function ModeCard({ title, description, hint, emphasized, onClick }: ModeCardProps) {
  return (
    <Card
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 200,
        borderRadius: '14px',
        border: '1px solid',
        borderColor: emphasized ? 'rgba(79, 70, 229, 0.28)' : 'rgba(228, 226, 218, 1)',
        backgroundColor: emphasized ? ACCENT_TINT : '#fff',
        boxShadow: '0 1px 2px rgba(30, 27, 22, 0.04)',
        transition:
          'border-color 140ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 140ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 140ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        '&:hover': {
          borderColor: ACCENT,
          backgroundColor: ACCENT_TINT,
          boxShadow: '0 4px 14px rgba(79, 70, 229, 0.12)',
        },
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          height: '100%',
          p: 2.25,
          borderRadius: 'inherit',
          alignItems: 'stretch',
          '&:hover .MuiCardActionArea-focusHighlight': {
            opacity: 0,
          },
          '&:focus-visible': {
            outline: 'none',
            boxShadow: `inset 0 0 0 3px ${ACCENT_TINT}`,
          },
        }}
      >
        <Stack spacing={1.25} sx={{ alignItems: 'flex-start', textAlign: 'left' }}>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 1,
              py: 0.25,
              borderRadius: '999px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1.35,
              color: emphasized ? '#fff' : ACCENT,
              backgroundColor: emphasized ? ACCENT : ACCENT_TINT,
            }}
          >
            {hint}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="div"
              sx={{
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
                color: '#1f1e1b',
              }}
            >
              {title}
            </Typography>
            <Typography
              component="div"
              sx={{
                mt: 0.5,
                fontSize: 13,
                lineHeight: 1.45,
                color: '#57554e',
              }}
            >
              {description}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export default function EntryPicker({ onSelect }: Props) {
  const { t } = useTranslation('aiWizard');

  return (
    <Box>
      <Typography
        sx={{
          mb: 2,
          fontSize: 13.5,
          lineHeight: 1.45,
          color: '#57554e',
        }}
      >
        {t('entry.title')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <ModeCard
          title={t('entry.directCard.title')}
          description={t('entry.directCard.description')}
          hint={t('entry.directCard.hint')}
          onClick={() => onSelect('direct')}
        />
        <ModeCard
          title={t('entry.wizardCard.title')}
          description={t('entry.wizardCard.description')}
          hint={t('entry.wizardCard.hint')}
          emphasized
          onClick={() => onSelect('wizard')}
        />
      </Stack>
      <Typography
        sx={{
          display: 'block',
          mt: 1.75,
          fontSize: 11.5,
          lineHeight: 1.45,
          color: '#77756c',
        }}
      >
        {t('entry.switchNote')}
      </Typography>
    </Box>
  );
}
