import React, { useEffect, useState } from 'react';

import { ImageOutlined } from '@mui/icons-material';
import { Box, Chip, Paper, Typography } from '@mui/material';

// Sample images for demonstration
const SAMPLE_IMAGES = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400',
    thumbnail: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=150',
    title: 'Gradient 1',
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400',
    thumbnail: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150',
    title: 'Gradient 2',
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400',
    thumbnail: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=150',
    title: 'Gradient 3',
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400',
    thumbnail: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=150',
    title: 'Gradient 4',
  },
  {
    id: '5',
    url: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=400',
    thumbnail: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=150',
    title: 'Gradient 5',
  },
  {
    id: '6',
    url: 'https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=400',
    thumbnail: 'https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=150',
    title: 'Gradient 6',
  },
];

interface ImagePanelOpenedDetail {
  blockId: string;
  currentImageUrl: string | null;
  alt: string | null;
}

export default function SampleImageGallery() {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [currentAlt, setCurrentAlt] = useState<string | null>(null);

  useEffect(() => {
    const handlePanelOpened = (event: Event) => {
      const customEvent = event as CustomEvent<ImagePanelOpenedDetail>;
      const { blockId, currentImageUrl, alt } = customEvent.detail;

      setCurrentBlockId(blockId);
      setCurrentImageUrl(currentImageUrl);
      setCurrentAlt(alt);
    };

    window.addEventListener('email-builder-image-panel-opened', handlePanelOpened);

    return () => {
      window.removeEventListener('email-builder-image-panel-opened', handlePanelOpened);
    };
  }, []);

  const handleImageClick = (imageUrl: string) => {
    // Dispatch event to set the image immediately
    window.dispatchEvent(
      new CustomEvent('email-builder-set-image', {
        detail: imageUrl,
      })
    );

    // Update local state
    setCurrentImageUrl(imageUrl);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: 'background.default',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ImageOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Custom Image Gallery
        </Typography>
      </Box>

      {currentBlockId && (
        <Box sx={{ mb: 2 }}>
          <Chip
            label={`Block: ${currentBlockId.substring(0, 8)}...`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        </Box>
      )}

      {/* Current Image Preview */}
      {currentBlockId && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            border: '2px solid',
            borderColor: 'primary.main',
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600, color: 'primary.main' }}>
            {currentImageUrl ? 'Current Image' : 'No Image Selected'}
          </Typography>

          <Box
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: 1,
              overflow: 'hidden',
              backgroundColor: '#f5f5f5',
              backgroundImage: `linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%), 
                               linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={currentAlt || 'Current image'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No image selected
              </Typography>
            )}
          </Box>

          {currentImageUrl && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                mt: 1,
                wordBreak: 'break-all',
                fontSize: '0.7rem',
              }}
            >
              {currentImageUrl.length > 70 ? `${currentImageUrl.substring(0, 70)}...` : currentImageUrl}
            </Typography>
          )}
        </Box>
      )}

      {/* Gallery Grid */}
      <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontWeight: 500 }}>
        Select an image:
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          maxHeight: '300px',
          overflowY: 'auto',
        }}
      >
        {SAMPLE_IMAGES.map((image) => {
          const isSelected = currentImageUrl === image.url;

          return (
            <Box
              key={image.id}
              onClick={() => handleImageClick(image.url)}
              sx={{
                cursor: 'pointer',
                borderRadius: 1,
                overflow: 'hidden',
                border: '2px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                transition: 'all 0.2s ease',
                position: 'relative',
                aspectRatio: '1',
                '&:hover': {
                  borderColor: 'primary.light',
                  transform: 'scale(1.05)',
                  boxShadow: 2,
                },
              }}
            >
              <img
                src={image.thumbnail}
                alt={image.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {isSelected && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: 'primary.main',
                    color: 'white',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                  }}
                >
                  ✓
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 2,
          color: 'text.secondary',
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        Click on any image to select it
      </Typography>
    </Paper>
  );
}
