import React from 'react';
import { useTranslation } from 'react-i18next';

import { EditNote } from '@mui/icons-material';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';

import AiSparkleIcon from '../AiSparkleIcon';

interface Props {
  onSelect: (mode: 'direct' | 'wizard') => void;
}

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  iconFontSize?: number;
}

function ModeCard({ icon, title, description, onClick, iconFontSize = 36 }: ModeCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: 160,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        borderWidth: 2,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background-color 0.2s ease',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
          boxShadow: (theme) => `0 12px 28px ${theme.palette.primary.main}33`,
          transform: 'translateY(-6px)',
        },
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          p: 3,
        }}
      >
        <CardContent sx={{ width: '100%' }}>
          <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 72,
                height: 72,
                borderRadius: '50%',
                fontSize: iconFontSize,
                lineHeight: 1,
                color: 'primary.main',
                bgcolor: (theme) => `${theme.palette.primary.main}14`,
                transition: 'background-color 0.2s ease, transform 0.2s ease',
                '.MuiCard-root:hover &': {
                  bgcolor: (theme) => `${theme.palette.primary.main}24`,
                  transform: 'scale(1.08)',
                },
              }}
            >
              {icon}
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 220 }}>
              {description}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function EntryPicker({ onSelect }: Props) {
  const { t } = useTranslation('aiWizard');

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
        {t('entry.title')}
      </Typography>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0, pb: 1 }}>
        <Stack
          direction="row"
          sx={{ width: '100%', height: '92%', minHeight: 220, maxHeight: 420, gap: 1 }}
        >
          <ModeCard
            icon={<EditNote fontSize="inherit" />}
            iconFontSize={60}
            title={t('entry.directCard.title')}
            description={t('entry.directCard.description')}
            onClick={() => onSelect('direct')}
          />
          <ModeCard
            icon={<AiSparkleIcon fontSize="inherit" />}
            iconFontSize={44}
            title={t('entry.wizardCard.title')}
            description={t('entry.wizardCard.description')}
            onClick={() => onSelect('wizard')}
          />
        </Stack>
      </Box>
    </Box>
  );
}
