import { defineAction, definePiece, Property } from '@maildrill/activepieces-core';
import type { MaildrillPieceContext } from './context';
import { sendThroughMaildrill } from './send';

/**
 * Channel pieces. Each is a thin adapter onto `sendThroughMaildrill` → `submitMessage`;
 * no provider logic lives here, by design (see the architecture note, §"No
 * reimplementation of Maildrill sending logic").
 */

const subscriberProp = Property.ShortText({
  displayName: 'Subscriber',
  description: 'The subscriber to message. Usually the one the trigger produced.',
  required: true,
  placeholder: '{{trigger.subscriber.id}}',
});

const SAMPLE_SEND = {
  sent: true,
  messageId: '9a7c1d2e-3f4b-4c5d-8e9f-0a1b2c3d4e5f',
  channel: 'email',
  to: 'ada@example.com',
  deduplicated: false,
};

export const emailPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/email',
  displayName: 'Email',
  description: 'Send email through the workspace’s configured sender.',
  version: '1.0.0',
  accent: '--ch-email',
  triggers: [],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'send_email',
      displayName: 'Send email',
      description: 'Compose and send a one-off email.',
      category: 'Email',
      accent: '--ch-email',
      props: {
        subscriberId: subscriberProp,
        subject: Property.ShortText({ displayName: 'Subject', required: true }),
        html: Property.LongText({
          displayName: 'Body (HTML)',
          description: 'Merge tags such as {{name}} are resolved per recipient.',
        }),
        text: Property.LongText({ displayName: 'Body (plain text)' }),
      },
      sampleOutput: SAMPLE_SEND,
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'email',
          subscriberId: propsValue.subscriberId,
          content: {
            subject: propsValue.subject,
            html: propsValue.html,
            text: propsValue.text,
          },
        }),
    }),
    defineAction<MaildrillPieceContext>({
      name: 'send_email_template',
      displayName: 'Send email template',
      description: 'Send a saved email template, personalised for the subscriber.',
      category: 'Email',
      accent: '--ch-email',
      props: {
        subscriberId: subscriberProp,
        templateId: Property.DynamicDropdown({
          displayName: 'Template',
          source: 'templates:email',
          required: true,
        }),
        subject: Property.ShortText({
          displayName: 'Subject',
          description: 'Templates carry the body; the subject is set per send.',
          required: true,
        }),
      },
      sampleOutput: SAMPLE_SEND,
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'email',
          subscriberId: propsValue.subscriberId,
          templateId: propsValue.templateId,
          content: { subject: propsValue.subject },
        }),
    }),
  ],
});

export const smsPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/sms',
  displayName: 'SMS',
  description: 'Send SMS to a subscriber’s phone number.',
  version: '1.0.0',
  accent: '--ch-sms',
  triggers: [],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'send_sms',
      displayName: 'Send SMS',
      description: 'Send a text message.',
      category: 'SMS',
      accent: '--ch-sms',
      props: {
        subscriberId: subscriberProp,
        text: Property.LongText({ displayName: 'Message', required: true }),
      },
      sampleOutput: { ...SAMPLE_SEND, channel: 'sms', to: '+15551234567' },
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'sms',
          subscriberId: propsValue.subscriberId,
          content: { text: propsValue.text },
        }),
    }),
    defineAction<MaildrillPieceContext>({
      name: 'send_sms_template',
      displayName: 'Send SMS template',
      description: 'Send a saved SMS template.',
      category: 'SMS',
      accent: '--ch-sms',
      props: {
        subscriberId: subscriberProp,
        templateId: Property.DynamicDropdown({
          displayName: 'Template',
          source: 'templates:sms',
          required: true,
        }),
      },
      sampleOutput: { ...SAMPLE_SEND, channel: 'sms' },
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'sms',
          subscriberId: propsValue.subscriberId,
          templateId: propsValue.templateId,
        }),
    }),
  ],
});

export const whatsappPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/whatsapp',
  displayName: 'WhatsApp',
  description: 'Send Meta-approved WhatsApp templates.',
  version: '1.0.0',
  accent: '--ch-whatsapp',
  triggers: [],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'send_whatsapp_template',
      displayName: 'Send WhatsApp template',
      description: 'Send a Meta-approved WhatsApp template.',
      category: 'WhatsApp',
      accent: '--ch-whatsapp',
      props: {
        subscriberId: subscriberProp,
        templateId: Property.DynamicDropdown({
          displayName: 'Template',
          description: 'Only approved templates can be sent.',
          source: 'templates:whatsapp',
          required: true,
        }),
      },
      sampleOutput: { ...SAMPLE_SEND, channel: 'whatsapp' },
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'whatsapp',
          subscriberId: propsValue.subscriberId,
          templateId: propsValue.templateId,
        }),
    }),
  ],
});

export const voicePiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/voice',
  displayName: 'Voice',
  description: 'Place an automated voice call.',
  version: '1.0.0',
  accent: '--ch-voice',
  triggers: [],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'send_voice',
      displayName: 'Place voice call',
      description: 'Call the subscriber and read a script aloud.',
      category: 'Voice',
      accent: '--ch-voice',
      props: {
        subscriberId: subscriberProp,
        text: Property.LongText({ displayName: 'Script', required: true }),
      },
      sampleOutput: { ...SAMPLE_SEND, channel: 'voice' },
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'voice',
          subscriberId: propsValue.subscriberId,
          content: { text: propsValue.text },
        }),
    }),
    defineAction<MaildrillPieceContext>({
      name: 'send_voice_template',
      displayName: 'Play voice template',
      description: 'Call the subscriber and play a saved voice template.',
      category: 'Voice',
      accent: '--ch-voice',
      props: {
        subscriberId: subscriberProp,
        templateId: Property.DynamicDropdown({
          displayName: 'Template',
          source: 'templates:voice',
          required: true,
        }),
      },
      sampleOutput: { ...SAMPLE_SEND, channel: 'voice' },
      run: ({ propsValue, ctx }) =>
        sendThroughMaildrill({
          ctx,
          channel: 'voice',
          subscriberId: propsValue.subscriberId,
          templateId: propsValue.templateId,
        }),
    }),
  ],
});
