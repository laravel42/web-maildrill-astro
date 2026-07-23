import type { TWhatsAppConfiguration } from '../documents/schemas';

/**
 * Empty-document seed. Ships a bare root plus an empty Body — Body is
 * the one section WhatsApp requires, so unlike the email builder's
 * fully blank canvas we pre-add it (removing it is a validation error
 * anyway, and the placeholder invites typing).
 */
export function getEmptyWhatsAppMessage(): TWhatsAppConfiguration {
  return {
    root: {
      type: 'WhatsAppMessage',
      data: { language: 'en', category: 'MARKETING', childrenIds: ['block-body-seed'] },
    },
    'block-body-seed': {
      type: 'Body',
      data: { props: { text: '' } },
    },
  };
}
