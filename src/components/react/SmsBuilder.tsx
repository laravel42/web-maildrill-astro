import { CHANNEL } from './shared/channels';
import { smsSegments } from './shared/messaging';
import {
  ComposerCard,
  ComposerShell,
  PersonalizeRail,
  PhonePreview,
  truncatePreview,
} from './shared/MessageComposer';
import { useMessageDraft, type ComposerProps } from './shared/useMessageDraft';

/* ------------------------------------------------------------------ *
 * SmsBuilder — the SMS template tool: text composer with segment
 * counting and an iMessage-style live preview.
 * ------------------------------------------------------------------ */

const PLACEHOLDER = 'Type your SMS… keep it short — 160 characters fit a single segment.';

const TIPS = [
  'Keep it under 160 characters to fit one segment.',
  'Always include a clear opt-out such as “Reply STOP”.',
  'Use a short branded link instead of a long URL.',
] as const;

const PREVIEW_FALLBACK = 'Hi {{name}}, your order is on its way! Track it here: mldr.io/go';

export default function SmsBuilder(props: ComposerProps) {
  const draft = useMessageDraft({ channel: 'sms', ...props });
  const meta = CHANNEL.sms;
  const preview = truncatePreview(draft.message.trim() ? draft.message : PREVIEW_FALLBACK);

  return (
    <ComposerShell channel="sms" draft={draft} onClose={props.onClose}>
      <PersonalizeRail
        tokens={draft.personalizationTokens}
        tips={TIPS}
        color={meta.color}
        onInsert={draft.insertVariable}
      />

      <ComposerCard
        channel="sms"
        draft={draft}
        placeholder={PLACEHOLDER}
        count={smsSegments(draft.message.length)}
        countLabel="segment(s)"
        emoji
      />

      {/* iMessage-style grey bubble */}
      <PhonePreview accent={meta.color} screenBackground="#f6f6f7" statusBarColor="#0b0b0f">
        <div
          style={{
            flex: 1,
            background: '#e9eaec',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 14px 9px',
              textAlign: 'center',
              background: '#f6f6f7',
              borderBottom: '1px solid rgba(0,0,0,.06)',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#c7c9cc',
                margin: '0 auto 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              M
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#0b0b0f' }}>Maildrill</div>
          </div>
          <div
            style={{
              flex: 1,
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '82%',
                background: '#fff',
                borderRadius: '16px 16px 16px 4px',
                padding: '9px 13px',
                fontSize: 12,
                lineHeight: 1.45,
                color: '#0b0b0f',
                boxShadow: '0 1px 1px rgba(0,0,0,.05)',
              }}
            >
              {preview}
            </div>
            <div
              style={{
                alignSelf: 'flex-start',
                fontSize: 9,
                color: '#9a9a9e',
                margin: '2px 6px 0',
              }}
            >
              Delivered
            </div>
          </div>
        </div>
      </PhonePreview>
    </ComposerShell>
  );
}
