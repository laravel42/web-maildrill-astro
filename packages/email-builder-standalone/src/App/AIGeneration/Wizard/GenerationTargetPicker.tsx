import React from 'react';
import { useTranslation } from 'react-i18next';

import { Brush, Dashboard, Email } from '@mui/icons-material';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';

export type GenerationTarget = 'template' | 'component' | 'theme';

interface Props {
  onSelect: (target: GenerationTarget) => void;
}

interface TargetCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function TargetCard({ icon, title, description, onClick }: TargetCardProps) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ py: 1.5, px: 1.5 }}>
          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ fontSize: 32, lineHeight: 1, color: 'primary.main' }}>{icon}</Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center' }}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              {description}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function GenerationTargetPicker({ onSelect }: Props) {
  const { t } = useTranslation('aiWizard');

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        {t('target.title')}
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <TargetCard
          icon={<Email fontSize="inherit" />}
          title={t('target.template.title')}
          description={t('target.template.description')}
          onClick={() => onSelect('template')}
        />
        <TargetCard
          icon={<Dashboard fontSize="inherit" />}
          title={t('target.component.title')}
          description={t('target.component.description')}
          onClick={() => onSelect('component')}
        />
        <TargetCard
          icon={<Brush fontSize="inherit" />}
          title={t('target.theme.title')}
          description={t('target.theme.description')}
          onClick={() => onSelect('theme')}
        />
      </Stack>
    </Box>
  );
}
