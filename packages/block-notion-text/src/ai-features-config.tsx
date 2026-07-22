import React from 'react';

import { AutoAwesome, CheckCircle, Description, Edit, Refresh, ShortText, Subject } from '@mui/icons-material';

export type AIAction =
  | 'rewrite'
  | 'grammar_check'
  | 'continue_writing'
  | 'shorter'
  | 'descriptive'
  | 'detailed'
  | 'friendly'
  | 'professional';

export interface AIFeature {
  label: string;
  icon: React.ReactNode;
  value: AIAction;
  loading?: boolean;
  disabled?: boolean;
  type?: 'item' | 'section-header';
  emoji?: string;
}

export interface AIFeatureGroup {
  label: string;
  icon: React.ReactNode;
  children: AIFeature[];
}

export interface AIFeatureRequest {
  text: string;
  content: string;
  action: AIAction;
  replaceSelection?: boolean; // true = reemplazar solo selección, false = reemplazar todo
  selectionFrom?: number; // posición inicial de la selección
  selectionTo?: number; // posición final de la selección
}

/**
 * Configuración de AI Features con secciones
 */
export const aiFeatures: AIFeatureGroup = {
  label: 'AI Features',
  icon: <AutoAwesome fontSize="small" />,
  children: [
    // Opciones principales (sin categoría)
    {
      label: 'Rewrite',
      icon: <Refresh fontSize="small" />,
      value: 'rewrite',
      loading: false,
      disabled: false,
      type: 'item',
    },
    {
      label: 'Check grammar',
      icon: <CheckCircle fontSize="small" />,
      value: 'grammar_check',
      loading: false,
      disabled: false,
      type: 'item',
    },
    {
      label: 'Continue writing',
      icon: <Edit fontSize="small" />,
      value: 'continue_writing',
      loading: false,
      disabled: false,
      type: 'item',
    },
    // Sección "MAKE IT"
    {
      label: 'MAKE IT',
      icon: <></>,
      value: 'rewrite', // dummy value
      type: 'section-header',
    },
    {
      label: 'Shorter',
      icon: <ShortText fontSize="small" />,
      value: 'shorter',
      loading: false,
      disabled: false,
      type: 'item',
    },
    {
      label: 'Descriptive',
      icon: <Description fontSize="small" />,
      value: 'descriptive',
      loading: false,
      disabled: false,
      type: 'item',
    },
    {
      label: 'Detailed',
      icon: <Subject fontSize="small" />,
      value: 'detailed',
      loading: false,
      disabled: false,
      type: 'item',
    },
    // Sección "CHANGE TONE TO"
    {
      label: 'CHANGE TONE TO',
      icon: <></>,
      value: 'rewrite', // dummy value
      type: 'section-header',
    },
    {
      label: 'Friendly',
      icon: <></>,
      value: 'friendly',
      loading: false,
      disabled: false,
      type: 'item',
      emoji: '😊',
    },
    {
      label: 'Professional',
      icon: <></>,
      value: 'professional',
      loading: false,
      disabled: false,
      type: 'item',
      emoji: '💼',
    },
  ],
};

/**
 * Dispara un evento personalizado para solicitar una acción de IA
 */
export const requestAIFeature = (request: AIFeatureRequest) => {
  const event = new CustomEvent('ai-request', { detail: request });
  window.dispatchEvent(event);
};
