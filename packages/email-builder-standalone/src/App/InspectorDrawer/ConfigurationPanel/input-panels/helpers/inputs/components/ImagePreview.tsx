import React from 'react';

import { Card, CardMedia, CircularProgress, Stack } from '@mui/material';

interface ImagePreviewProps {
  imageUrl: string;
  saving?: boolean;
}

export function ImagePreview({ imageUrl, saving = false }: ImagePreviewProps) {
  return (
    <Card sx={{ position: 'relative' }}>
      {saving && (
        <Stack
          sx={{
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            top: 7,
            left: 0,
            width: '100%',
            height: '314px',
            zIndex: 20,
            backgroundColor: '#212121AA',
            mb: 1,
          }}
        >
          <CircularProgress size={48} thickness={6} color={'inherit'} sx={{ color: 'white' }} />
        </Stack>
      )}
      <CardMedia
        component="img"
        sx={{
          objectFit: 'contain',
          width: '100%',
          height: '326px',
        }}
        image={imageUrl}
        alt="Generated Image"
      />
    </Card>
  );
}
