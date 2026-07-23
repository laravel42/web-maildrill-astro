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
}

function ModeCard({ icon, title, description, onClick }: ModeCardProps) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Stack spacing={1} sx={{ alignItems: 'center' }}>
            <Box sx={{ fontSize: 40, lineHeight: 1, color: 'primary.main' }}>{icon}</Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
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
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('entry.title')}
      </Typography>
      <Stack direction="row" spacing={2}>
        <ModeCard
          icon={<EditNote fontSize="inherit" />}
          title={t('entry.directCard.title')}
          description={t('entry.directCard.description')}
          onClick={() => onSelect('direct')}
        />
        <ModeCard
          icon={<AiSparkleIcon fontSize="inherit" />}
          title={t('entry.wizardCard.title')}
          description={t('entry.wizardCard.description')}
          onClick={() => onSelect('wizard')}
        />
      </Stack>
    </Box>
  );
}
