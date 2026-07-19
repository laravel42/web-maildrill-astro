import React from 'react';

import {
  Archive,
  CalendarToday as CalendarDay,
  Cancel,
  DateRange as CalendarMonth,
  Email as Envelope,
  Event as CalendarYear,
  Language as Web,
  Link,
  Person as User,
} from '@mui/icons-material';

export interface MergeTag {
  label?: string;
  value?: string;
  icon?: React.ReactNode;
  type?: 'divider';
}

export interface MergeTagGroup {
  label: string;
  icon?: React.ReactNode;
  children: MergeTag[];
}

/**
 * Obtiene los merge tags desde window (custom) o retorna los por defecto
 */
export const getMergeTags = (): MergeTagGroup => {
  // Verificar si hay merge tags personalizados en window
  const customMergeTags = (window as any).__emailBuilderCustomMergeTags;

  if (customMergeTags) {
    // Si ya es un grupo con label y children, retornarlo
    if (customMergeTags.label && customMergeTags.children) {
      return customMergeTags;
    }

    // Si es un array de tags, envolverlo en un grupo
    if (Array.isArray(customMergeTags)) {
      return {
        label: 'Merge Tags',
        children: customMergeTags,
      };
    }
  }

  // Retornar merge tags por defecto
  return defaultMergeTags;
};

/**
 * Merge tags por defecto
 */
export const defaultMergeTags: MergeTagGroup = {
  label: 'Merge Tags',
  children: [
    {
      label: 'Confirmation link',
      icon: <Link fontSize="small" />,
      value: '{confirmation}Confirm subscription here{/confirmation}',
    },
    {
      label: 'View web version',
      icon: <Web fontSize="small" />,
      value: '{webversion}View web version{/webversion}',
    },
    {
      label: 'Archive',
      icon: <Archive fontSize="small" />,
      value: '{archive}Archive{/archive}',
    },
    {
      label: 'Unsubscribe here',
      icon: <Cancel fontSize="small" />,
      value: '{unsubscribe}Unsubscribe here{/unsubscribe}',
    },
    {
      type: 'divider',
    },
    {
      label: 'Name',
      icon: <User fontSize="small" />,
      value: '[name]',
    },
    {
      label: 'Email',
      icon: <Envelope fontSize="small" />,
      value: '[email]',
    },
    {
      type: 'divider',
    },
    {
      label: 'Day of the month (ex: 25)',
      icon: <CalendarDay fontSize="small" />,
      value: '[currentdaynumber]',
    },
    {
      label: 'Current month (ex: 10)',
      icon: <CalendarMonth fontSize="small" />,
      value: '[currentmonth]',
    },
    {
      label: 'Year (ex: 2022)',
      icon: <CalendarYear fontSize="small" />,
      value: '[currentyear]',
    },
  ],
};
