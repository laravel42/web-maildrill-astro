import React from 'react';

import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import { Avatar, Box, Typography } from '@mui/material';
import CallOutlined from '@mui/icons-material/CallOutlined';

import { useBusinessName, useDarkMode } from '../../documents/editor/EditorContext';

/**
 * The WhatsApp chat chrome around the canvas: conversation header bar
 * and the tiled chat backdrop, with light/dark palettes matching the
 * real client. Exposes the WA color system as CSS vars consumed by the
 * message blocks — the single source of the "allowed style".
 */

const LIGHT = {
  '--wa-chat-bg': '#efeae2',
  '--wa-chat-pattern': 'rgba(0,0,0,0.04)',
  '--wa-bubble': '#ffffff',
  '--wa-text': '#111b21',
  '--wa-muted': '#667781',
  '--wa-action': '#00a5f4',
  '--wa-divider': 'rgba(17,27,33,0.12)',
  '--wa-media-bg': '#f0f2f5',
  '--wa-header-bg': '#008069',
  '--wa-header-fg': '#ffffff',
  '--wa-variable-bg': '#d9fdd3',
  '--wa-variable-fg': '#0b6156',
} as const;

const DARK = {
  '--wa-chat-bg': '#0b141a',
  '--wa-chat-pattern': 'rgba(255,255,255,0.03)',
  '--wa-bubble': '#202c33',
  '--wa-text': '#e9edef',
  '--wa-muted': '#8696a0',
  '--wa-action': '#53bdeb',
  '--wa-divider': 'rgba(233,237,239,0.12)',
  '--wa-media-bg': '#2a3942',
  '--wa-header-bg': '#202c33',
  '--wa-header-fg': '#e9edef',
  '--wa-variable-bg': '#005c4b',
  '--wa-variable-fg': '#d9fdd3',
} as const;

export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  const darkMode = useDarkMode();
  const businessName = useBusinessName();
  const vars = darkMode ? DARK : LIGHT;

  return (
    <Box
      sx={{
        ...vars,
        width: '100%',
        maxWidth: 420,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(11,20,26,0.18)',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 480,
      }}
    >
      {/* Conversation header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 1,
          bgcolor: 'var(--wa-header-bg)',
          color: 'var(--wa-header-fg)',
        }}
      >
        <ArrowBackOutlined sx={{ fontSize: 20, opacity: 0.9 }} />
        <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'rgba(255,255,255,0.25)' }}>
          {businessName.slice(0, 1).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.2, color: 'inherit' }} noWrap>
            {businessName}
          </Typography>
          <Typography sx={{ fontSize: 11.5, opacity: 0.8, lineHeight: 1.2, color: 'inherit' }}>WhatsApp Business</Typography>
        </Box>
        <VideocamOutlined sx={{ fontSize: 20, opacity: 0.9 }} />
        <CallOutlined sx={{ fontSize: 18, opacity: 0.9 }} />
        <MoreVertOutlined sx={{ fontSize: 20, opacity: 0.9 }} />
      </Box>

      {/* Chat backdrop */}
      <Box
        sx={{
          flex: 1,
          bgcolor: 'var(--wa-chat-bg)',
          backgroundImage:
            'radial-gradient(var(--wa-chat-pattern) 1.2px, transparent 1.2px)',
          backgroundSize: '18px 18px',
          p: 2,
          pt: 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
