import { useEffect, useMemo, useState } from 'react';
import { CHANNEL } from './shared/channels';
import { formatDuration, voiceSeconds } from './shared/messaging';
import {
  ComposerCard,
  ComposerShell,
  PersonalizeRail,
  PhonePreview,
  truncatePreview,
} from './shared/MessageComposer';
import { useMessageDraft, type ComposerProps } from './shared/useMessageDraft';
import { useVoicePreview } from './shared/useVoicePreview';
import { PREVIEW_RATES, SPEED_OPTS, TOKEN_SAMPLES, voicesForLanguage } from './VoiceBuilder.logic';
import styles from './VoiceBuilder.module.css';

/* ------------------------------------------------------------------ *
 * VoiceBuilder — the voice template tool: call-script composer with
 * TTS voice/speed selection, real Infobip playback preview, and an
 * incoming-call live preview.
 * ------------------------------------------------------------------ */

const PLACEHOLDER = 'Write the script your recipients will hear when they answer the call.';

const TIPS = [
  'Write the way people speak — short, plain sentences.',
  'Say who is calling in the first sentence.',
  'Aim to keep the whole call under 30 seconds.',
] as const;

const PREVIEW_FALLBACK =
  'Hello {{name}}, this is a courtesy call from Maildrill about your recent order.';

/** Shortest script worth placing a preview call for. */
const MIN_PREVIEW_CHARS = 10;

export default function VoiceBuilder({
  initialBuilderDoc,
  ...props
}: ComposerProps & {
  /**
   * Saved builderDoc when reopening. Voice templates keep their TTS selection
   * here: `{ voice: { label, name, gender, sayLanguage }, speed, speechRate }`.
   */
  initialBuilderDoc?: Record<string, unknown> | null;
}) {
  const [voice, setVoice] = useState<string>(() => {
    const savedDoc = initialBuilderDoc as { voice?: { label?: unknown } } | null | undefined;
    const saved = typeof savedDoc?.voice?.label === 'string' ? savedDoc.voice.label : null;
    const opts = voicesForLanguage(props.initialLanguage);
    return saved && opts.some((o) => o.label === saved)
      ? saved
      : (opts[0] ?? voicesForLanguage('en_US')[0]).label;
  });
  const [speed, setSpeed] = useState<string>(() => {
    const saved = (initialBuilderDoc as { speed?: unknown } | null | undefined)?.speed;
    return typeof saved === 'string' && SPEED_OPTS.includes(saved) ? saved : SPEED_OPTS[1];
  });

  const draft = useMessageDraft({
    channel: 'voice',
    ...props,
    // Voice templates persist their TTS selection so delivery speaks the
    // authored voice (mirrored by resolveMessageContent in workers).
    extras: ({ language }) => {
      const selected = voicesForLanguage(language).find((o) => o.label === voice);
      return selected
        ? {
            builderDoc: {
              voice: {
                label: selected.label,
                name: selected.name,
                gender: selected.gender,
                sayLanguage: selected.sayLanguage,
              },
              speed,
              speechRate: PREVIEW_RATES[speed] ?? 1,
            },
          }
        : {};
    },
  });

  const meta = CHANNEL.voice;
  const voiceOptions = useMemo(() => voicesForLanguage(draft.language), [draft.language]);
  const selectedVoice = voiceOptions.find((o) => o.label === voice);

  useEffect(() => {
    if (voiceOptions.length === 0) return;
    if (!voiceOptions.some((o) => o.label === voice)) setVoice(voiceOptions[0].label);
  }, [voice, voiceOptions]);

  const { markDirty } = draft;
  useEffect(() => {
    markDirty();
  }, [voice, speed, markDirty]);

  const seconds = voiceSeconds(draft.message);
  const msgPreview = draft.message.trim() ? draft.message : PREVIEW_FALLBACK;

  // Voice review playback — the real Infobip TTS voice over a silent WebRTC
  // call (see useVoicePreview). {{tokens}} are spoken as sample values.
  const preview = useVoicePreview();
  /* A one-word script places a real call to hear nothing useful, so playback
     waits until there is a sentence worth listening to. */
  const scriptTooShort = draft.message.trim().length < MIN_PREVIEW_CHARS;
  const togglePreviewPlayback = () => {
    if (preview.state !== 'idle') {
      preview.stop();
      return;
    }
    if (scriptTooShort || !selectedVoice) return;
    const text = msgPreview.replace(
      /\{\{\s*([\w.]+)\s*\}\}/g,
      (_, key: string) => TOKEN_SAMPLES[key] ?? key.replace(/[_.]+/g, ' '),
    );
    void preview.play({
      text,
      language: selectedVoice.sayLanguage,
      voiceName: selectedVoice.name,
      speechRate: PREVIEW_RATES[speed] ?? 1,
    });
  };

  /* The caption is the only place the transport reports itself, now that the
     button is icon-only — including why it is unavailable. */
  const previewHint = (() => {
    if (preview.state === 'connecting') return 'Connecting…';
    if (preview.state === 'playing') return `Playing the real caller voice (${voice}).`;
    if (scriptTooShort) return `Write at least ${MIN_PREVIEW_CHARS} characters to hear a preview.`;
    return `Plays the real caller voice (${voice}).`;
  })();

  return (
    <ComposerShell channel="voice" draft={draft} onClose={props.onClose}>
      <PersonalizeRail
        tokens={draft.personalizationTokens}
        tips={TIPS}
        color={meta.color}
        onInsert={draft.insertVariable}
      />

      <ComposerCard
        channel="voice"
        draft={draft}
        placeholder={PLACEHOLDER}
        count={seconds}
        countLabel="sec (est.)"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            marginTop: 22,
            paddingTop: 20,
            borderTop: '1px solid var(--divider)',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 9 }}>
              Voice
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {voiceOptions.map((vo) => {
                const on = voice === vo.label;
                return (
                  <button
                    key={vo.label}
                    type="button"
                    className={styles.opt}
                    onClick={() => setVoice(vo.label)}
                    style={{
                      border: `1.5px solid ${on ? meta.color : 'var(--border2)'}`,
                      background: on ? meta.tint : 'transparent',
                      color: on ? meta.color : 'var(--text3)',
                    }}
                  >
                    {vo.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 9 }}>
              Speaking speed
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {SPEED_OPTS.map((sp) => {
                const on = speed === sp;
                return (
                  <button
                    key={sp}
                    type="button"
                    className={styles.opt}
                    onClick={() => setSpeed(sp)}
                    style={{
                      border: `1.5px solid ${on ? meta.color : 'var(--border2)'}`,
                      background: on ? meta.tint : 'transparent',
                      color: on ? meta.color : 'var(--text3)',
                    }}
                  >
                    {sp}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={togglePreviewPlayback}
          /* Stays clickable once playing, so editing the script mid-call can
             never trap the user without a way to stop it. */
          disabled={preview.state === 'idle' && scriptTooShort}
          aria-pressed={preview.state === 'playing'}
          aria-label={preview.state === 'idle' ? 'Play preview' : 'Stop preview'}
          className={styles.play}
          style={{ opacity: preview.state === 'connecting' ? 0.75 : 1 }}
        >
          {preview.state === 'idle' ? (
            <svg width="22" height="22" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              {/* Nudged right so the triangle looks centred in the circle. */}
              <path d="M3.2 1.2v9.6L11 6z" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" rx="2" />
            </svg>
          )}
        </button>
        <p
          style={{
            margin: '9px 0 0',
            fontSize: 11,
            color: preview.error ? 'var(--danger)' : 'var(--muted)',
            textAlign: 'center',
          }}
        >
          {preview.error ?? previewHint}
        </p>
      </ComposerCard>

      {/* Incoming-call live preview */}
      <PhonePreview accent={meta.color} screenBackground="#0b0b0f" statusBarColor="#fff">
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 18px 26px',
            background: 'linear-gradient(180deg, #26221d, #0b0b0f)',
            color: '#fff',
          }}
        >
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <div
              style={{
                fontSize: 10.5,
                color: 'rgba(255,255,255,.5)',
                fontWeight: 600,
                letterSpacing: '0.4px',
                marginBottom: 10,
              }}
            >
              INCOMING CALL
            </div>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: '50%',
                background: meta.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 700,
                margin: '0 auto',
              }}
            >
              M
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 14 }}>Maildrill</div>
            <div
              className={styles.tnum}
              style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 5 }}
            >
              {formatDuration(seconds)} · calling…
            </div>
          </div>
          <div style={{ width: '100%' }}>
            <div
              style={{
                maxWidth: 190,
                margin: '0 auto 20px',
                background: 'rgba(255,255,255,.08)',
                borderRadius: 12,
                padding: '11px 13px',
                fontSize: 11.5,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,.85)',
              }}
            >
              {truncatePreview(msgPreview)}
            </div>
            <div
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}
            >
              <div className={styles.callbtn} style={{ background: 'rgba(255,255,255,.12)' }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0" />
                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                  <line x1="3" y1="3" x2="21" y2="21" />
                </svg>
              </div>
              <div
                className={styles.callbtn}
                style={{
                  width: 54,
                  height: 54,
                  background: '#e11d48',
                  transform: 'rotate(135deg)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1z" />
                </svg>
              </div>
              <div className={styles.callbtn} style={{ background: 'rgba(255,255,255,.12)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="6" cy="6" r="1.6" />
                  <circle cx="12" cy="6" r="1.6" />
                  <circle cx="18" cy="6" r="1.6" />
                  <circle cx="6" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="18" cy="12" r="1.6" />
                  <circle cx="6" cy="18" r="1.6" />
                  <circle cx="12" cy="18" r="1.6" />
                  <circle cx="18" cy="18" r="1.6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </PhonePreview>
    </ComposerShell>
  );
}
