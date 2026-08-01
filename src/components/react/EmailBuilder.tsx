import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import { CHANNEL } from './shared/channels';
import { formatDuration, smsSegments, voiceSeconds } from './shared/messaging';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  BLOCKS,
  PLACEHOLDER,
  PREVIEW_FALLBACK,
  SPEED_OPTS,
  TIPS,
  truncatePreview,
  voicesForLanguage,
} from './EmailBuilder.logic';
import type { Props } from './EmailBuilder.types';
import { api } from '@/lib/app/api';
import { buildPersonalizationTokens, type CustomField } from '@/lib/app/custom-fields';
import { defaultTemplateCategory, templateCategoriesForChannel } from '@/lib/app/templates-data';
import {
  normalizeTemplateLanguageCode,
  TEMPLATE_LANGUAGE_OPTIONS,
  templateLanguageFlagSrc,
} from '@/lib/app/template-language';
import ChannelEditorShell, { shellStyles } from './shared/ChannelEditorShell';
import { useAutosave } from './shared/useAutosave';
import { useToast } from './shared/useToast';
import { useVoicePreview } from './shared/useVoicePreview';
import styles from './EmailBuilder.module.css';

/* ------------------------------------------------------------------ *
 * EmailBuilder — full-screen template / message builder overlay.
 * React port of the "BUILDER" overlay in design/project/App.dc.html.
 * The parent gates mounting, so this renders its overlay immediately.
 * ------------------------------------------------------------------ */

function StatusBar({ color }: { color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 18px 3px',
        fontSize: 11,
        fontWeight: 600,
        color,
      }}
    >
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
          <rect x="0" y="6" width="2" height="4" rx=".5" />
          <rect x="4" y="4" width="2" height="6" rx=".5" />
          <rect x="8" y="2" width="2" height="8" rx=".5" />
          <rect x="12" y="0" width="2" height="10" rx=".5" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" />
          <rect x="2" y="2" width="13" height="7" rx="1" fill="currentColor" />
          <rect x="19" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

const labelCap: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
  marginBottom: 10,
};

const fieldLabel: CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 600,
  marginBottom: 6,
};

const fauxField: CSSProperties = {
  border: '1px solid var(--border2)',
  borderRadius: 9,
  padding: '8px 11px',
  fontSize: 12.5,
  color: 'var(--text2)',
};

/** Sample values spoken in place of {{tokens}} during the voice preview. */
const TOKEN_SAMPLES: Record<string, string> = {
  name: 'Alex',
  first_name: 'Alex',
  last_name: 'Rivera',
  email: 'alex at example dot com',
  phone: '5 5 5, 0 1 0 0',
};

const PREVIEW_RATES: Record<string, number> = { Slow: 0.85, Normal: 1, Fast: 1.15 };

export default function EmailBuilder({
  channel: initialChannel,
  name = null,
  kind = 'template',
  initialCategory,
  initialLanguage,
  initialMessage,
  initialBuilderDoc,
  onClose,
  onSave,
}: Props) {
  const [channel] = useState<ChannelType>(initialChannel);
  const [message, setMessage] = useState(initialMessage ?? '');
  const [previewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [quickReplies, setQuickReplies] = useState<string[]>(['Yes, count me in', 'Maybe later']);
  const [voice, setVoice] = useState<string>(() => {
    const savedDoc = initialBuilderDoc as { voice?: { label?: unknown } } | null | undefined;
    const saved = typeof savedDoc?.voice?.label === 'string' ? savedDoc.voice.label : null;
    const opts = voicesForLanguage(initialLanguage);
    return saved && opts.some((o) => o.label === saved)
      ? saved
      : (opts[0] ?? voicesForLanguage('en_US')[0]).label;
  });
  const [speed, setSpeed] = useState<string>(() => {
    const saved = (initialBuilderDoc as { speed?: unknown } | null | undefined)?.speed;
    return typeof saved === 'string' && SPEED_OPTS.includes(saved) ? saved : SPEED_OPTS[1];
  });
  const [templateName, setTemplateName] = useState(name ?? '');
  const [category, setCategory] = useState(() => defaultTemplateCategory(channel, initialCategory));
  const [language, setLanguage] = useState(() => normalizeTemplateLanguageCode(initialLanguage));
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const { toast, show } = useToast();

  const personalizationTokens = useMemo(
    () => buildPersonalizationTokens(customFields),
    [customFields],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<{ data: CustomField[] }>('custom-fields');
        if (alive) setCustomFields(res.data);
      } catch {
        // No session or API unreachable — keep core name/email/phone chips.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEscapeClose(onClose);

  const meta = CHANNEL[channel];
  const isEmail = channel === 'email';

  const len = message.length;
  const isVoice = channel === 'voice';
  const voiceOptions = useMemo(
    () => (isVoice ? voicesForLanguage(language) : []),
    [isVoice, language],
  );

  useEffect(() => {
    if (!isVoice || voiceOptions.length === 0) return;
    if (!voiceOptions.some((o) => o.label === voice)) setVoice(voiceOptions[0].label);
  }, [isVoice, voice, voiceOptions]);
  const count2 = isVoice ? voiceSeconds(message) : smsSegments(len);
  const count2Label = isVoice ? 'sec (est.)' : 'segment(s)';
  const msgPreview = message.trim() ? message : PREVIEW_FALLBACK[channel];
  const msgPreviewDisplay = truncatePreview(msgPreview);

  // Voice review playback — the real Infobip TTS voice over a silent WebRTC
  // call (see useVoicePreview). {{tokens}} are spoken as sample values.
  const preview = useVoicePreview();
  const selectedVoice = voiceOptions.find((o) => o.label === voice);

  const togglePreviewPlayback = () => {
    if (preview.state !== 'idle') {
      preview.stop();
      return;
    }
    if (!selectedVoice) return;
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

  const insertVariable = (token: string) => setMessage((m) => (m ? `${m} ${token}` : token));

  const canvasWidth = previewMode === 'desktop' ? 600 : 390;

  // Autosave the draft every 5s once the user starts editing.
  const persist = async () => {
    await onSave({
      channel,
      name: templateName.trim() || 'Untitled',
      message,
      category,
      language,
      // Voice templates persist their TTS selection so delivery speaks the
      // authored voice (mirrored by resolveMessageContent in workers).
      ...(isVoice && selectedVoice
        ? {
            builderDoc: {
              voice: {
                label: selectedVoice.label,
                name: selectedVoice.name,
                gender: selectedVoice.gender,
                sayLanguage: selectedVoice.sayLanguage,
              },
              speed,
              speechRate: PREVIEW_RATES[speed] ?? 1,
            },
          }
        : {}),
    });
  };
  const { status, markDirty, flush } = useAutosave(persist);
  const dirtyInit = useRef(false);
  useEffect(() => {
    if (!dirtyInit.current) {
      dirtyInit.current = true;
      return;
    }
    markDirty();
  }, [message, templateName, category, language, voice, speed, markDirty]);
  const handleSaveDraft = async () => {
    const ok = await flush();
    show(ok ? `“${templateName.trim() || 'Untitled template'}” saved` : 'Could not save.');
  };

  return (
    <ChannelEditorShell
      channel={channel}
      name={templateName}
      onNameChange={setTemplateName}
      kind={kind}
      status={status}
      category={category}
      categories={kind === 'template' ? templateCategoriesForChannel(channel) : undefined}
      onCategoryChange={kind === 'template' ? setCategory : undefined}
      language={kind === 'template' ? language : undefined}
      languageOptions={kind === 'template' ? TEMPLATE_LANGUAGE_OPTIONS : undefined}
      getLanguageFlagSrc={kind === 'template' ? templateLanguageFlagSrc : undefined}
      onLanguageChange={
        kind === 'template' ? (v) => setLanguage(normalizeTemplateLanguageCode(v)) : undefined
      }
      onBack={onClose}
      onSaveDraft={() => void handleSaveDraft()}
      className={styles.overlayFade}
      toast={
        toast ? (
          <div
            className={shellStyles.toast}
            role="status"
            style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
          >
            <span className={shellStyles.toastIcon}>
              <Icon name="check" size={13} stroke={3} />
            </span>
            {toast}
          </div>
        ) : null
      }
    >
      {isEmail ? (
        <div className={styles.grid} style={{ gridTemplateColumns: '250px 1fr 268px' }}>
          {/* Blocks palette */}
          <aside className={styles.panel} style={{ borderRight: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                gap: 14,
                borderBottom: '1px solid var(--divider)',
                marginBottom: 15,
              }}
            >
              <div
                style={{
                  paddingBottom: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#4f46e5',
                  borderBottom: '2px solid #4f46e5',
                }}
              >
                Content
              </div>
              <div
                style={{ paddingBottom: 9, fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}
              >
                Blocks
              </div>
            </div>

            <div style={labelCap}>Structure</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {BLOCKS.map((b) => (
                <div key={b.label} className={styles.block}>
                  <span style={{ color: 'var(--text3)' }}>
                    <Icon name={b.icon} size={16} stroke={1.9} />
                  </span>
                  <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{b.label}</span>
                </div>
              ))}
            </div>

            <div style={labelCap}>Saved blocks</div>
            <div className={styles.saved}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: 'var(--accent-tint)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4f46e5',
                }}
              >
                <Icon name="layers" size={14} stroke={2} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Product highlight</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>3 blocks</div>
              </div>
            </div>
            <div className={styles.saved} style={{ marginBottom: 0 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: 'var(--warning-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--warning-strong)',
                }}
              >
                <Icon name="star" size={14} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Promo banner</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>2 blocks</div>
              </div>
            </div>
          </aside>

          {/* Canvas — faux email (kept light like a real email, colors literal) */}
          <div
            style={{
              overflowY: 'auto',
              padding: 34,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: canvasWidth,
                maxWidth: '100%',
                background: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 4px 22px rgba(28,25,23,.08)',
                overflow: 'hidden',
                height: 'fit-content',
                transition: 'width .2s',
              }}
            >
              <div
                style={{
                  background: '#c9b79c',
                  padding: '30px 28px',
                  textAlign: 'center',
                  color: '#3f2f1c',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '1px' }}>
                  MEET THE TEACHER!
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Introducing Our Dedicated Educator: El Gwero
                </div>
              </div>
              <div
                style={{
                  padding: '26px 28px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.1fr',
                  gap: 20,
                  alignItems: 'center',
                  border: '2px solid #4f46e5',
                  margin: 16,
                  borderRadius: 9,
                }}
              >
                <div
                  style={{
                    aspectRatio: '1',
                    background: '#f1f0fb',
                    borderRadius: 7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9b96b0',
                    fontSize: 12,
                  }}
                >
                  Image Placeholder
                </div>
                <div>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: '#1f1e1b' }}
                  >
                    Breaking Barriers Building Minds
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6b675e', lineHeight: 1.5, marginTop: 8 }}>
                    Lorem ipsum is simply dummy text of the printing and typesetting industry.
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 12,
                      background: '#f6b8a0',
                      color: '#7c2d12',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '7px 15px',
                      borderRadius: 6,
                    }}
                  >
                    READ MORE
                  </div>
                </div>
              </div>
              <div style={{ padding: '8px 28px 30px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: '#1f1e1b' }}>
                  DISCOVERING THE MAGIC OF EDUCATION
                </div>
                <div style={{ fontSize: 11.5, color: '#8b8778', lineHeight: 1.6, marginTop: 10 }}>
                  Lorem ipsum is simply dummy text of the printing and typesetting industry.
                </div>
              </div>
            </div>
          </div>

          {/* Inspector */}
          <aside className={styles.panel} style={{ borderLeft: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 17,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Image</span>
              <span style={{ color: 'var(--muted2)', display: 'inline-flex' }}>
                <Icon name="x" size={14} stroke={2.1} />
              </span>
            </div>
            <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 56,
                  height: 42,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
                }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>teacher-portrait.png</div>
                <div className={styles.tnum} style={{ fontSize: 11, color: 'var(--muted)' }}>
                  1200 × 800
                </div>
              </div>
            </div>

            <label style={fieldLabel}>Alt text</label>
            <div style={{ ...fauxField, marginBottom: 16 }}>Teacher portrait</div>

            <label style={fieldLabel}>Link</label>
            <div style={{ ...fauxField, marginBottom: 14 }}>https://maildrill.net</div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Open in new tab</span>
              <div
                style={{
                  width: 34,
                  height: 20,
                  background: '#4f46e5',
                  borderRadius: 20,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: 2,
                    top: 2,
                    width: 16,
                    height: 16,
                    background: 'var(--surface)',
                    borderRadius: '50%',
                  }}
                />
              </div>
            </div>

            <label style={{ ...fieldLabel, marginBottom: 8 }}>Alignment</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {(['⬅', '⬍', '➡'] as const).map((sym, i) => {
                const on = i === 1;
                return (
                  <div
                    key={sym}
                    style={{
                      flex: 1,
                      height: 32,
                      border: `1px solid ${on ? '#4f46e5' : 'var(--border2)'}`,
                      background: on ? 'var(--accent-tint)' : 'transparent',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: on ? '#4f46e5' : 'var(--text4)',
                    }}
                  >
                    {sym}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--danger)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Icon name="trash" size={14} stroke={2} />
              Delete block
            </div>
          </aside>
        </div>
      ) : (
        /* -------------------------- Non-email layout -------------------------- */
        <div className={styles.grid} style={{ gridTemplateColumns: '250px 1fr 300px' }}>
          {/* Personalize + tips */}
          <aside className={styles.panel} style={{ borderRight: '1px solid var(--border)' }}>
            <div style={labelCap}>Personalize</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
              {personalizationTokens.map(({ label, token }) => (
                <button
                  key={token}
                  type="button"
                  className={styles.varchip}
                  onClick={() => insertVariable(token)}
                >
                  <span style={{ color: meta.color }}>+</span>
                  {label}
                </button>
              ))}
            </div>
            <div style={labelCap}>Best practices</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TIPS[channel].map((t) => (
                <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: meta.color,
                      marginTop: 6,
                      flex: 'none',
                    }}
                  />
                  <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text4)' }}>{t}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Editor card */}
          <div
            style={{
              overflowY: 'auto',
              padding: '32px 40px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 560,
                height: 'fit-content',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '26px 28px',
                boxShadow: '0 1px 2px rgba(30,27,22,.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                <span style={{ display: 'flex', color: meta.color }}>
                  <Icon name={meta.icon} size={15} stroke={2} />
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>
                  {meta.label} message
                </h3>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text4)' }}>
                Use the variables on the left to personalize. Changes autosave.
              </p>
              <textarea
                className={styles.ta}
                value={message}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                placeholder={PLACEHOLDER[channel]}
                style={{
                  width: '100%',
                  minHeight: 150,
                  resize: 'vertical',
                  border: '1px solid var(--border2)',
                  borderRadius: 10,
                  padding: '14px 15px',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text2)',
                  background: 'var(--surface2)',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: '1px solid var(--divider)',
                  fontSize: 11.5,
                  color: 'var(--muted)',
                }}
              >
                <span className={styles.tnum}>{len} characters</span>
                <span
                  className={`${styles.tnum} ${styles.metricBadge}`}
                  style={{ background: meta.tint, color: meta.color }}
                >
                  {count2} {count2Label}
                </span>
              </div>

              {channel === 'whatsapp' ? (
                <div
                  style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--divider)' }}
                >
                  <label
                    style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 11 }}
                  >
                    Quick reply buttons
                  </label>
                  {quickReplies.map((q, i) => (
                    <div
                      key={`${q}-${i}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                    >
                      <div
                        style={{
                          flex: 1,
                          border: '1px solid var(--border2)',
                          borderRadius: 9,
                          padding: '9px 12px',
                          fontSize: 12.5,
                          color: 'var(--text2)',
                          background: 'var(--surface2)',
                        }}
                      >
                        {q}
                      </div>
                      <button
                        type="button"
                        className={styles.qrRemove}
                        aria-label="Remove quick reply"
                        onClick={() => setQuickReplies((qs) => qs.filter((_, idx) => idx !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addbtn}
                    onClick={() => setQuickReplies((qs) => [...qs, `Button ${qs.length + 1}`])}
                  >
                    + Add button
                  </button>
                </div>
              ) : null}

              {channel === 'voice' ? (
                <>
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
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12.5,
                          fontWeight: 600,
                          marginBottom: 9,
                        }}
                      >
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
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12.5,
                          fontWeight: 600,
                          marginBottom: 9,
                        }}
                      >
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
                    aria-pressed={preview.state === 'playing'}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: `1.5px solid ${meta.color}`,
                      background: preview.state === 'idle' ? meta.tint : meta.color,
                      color: preview.state === 'idle' ? meta.color : '#fff',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: preview.state === 'connecting' ? 0.75 : 1,
                      transition: 'background-color 150ms ease, color 150ms ease',
                    }}
                  >
                    {preview.state === 'idle' ? (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M2.5 1.2v9.6L11 6z" />
                      </svg>
                    ) : (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <rect x="1" y="1" width="10" height="10" rx="2" />
                      </svg>
                    )}
                    {preview.state === 'idle'
                      ? 'Play preview'
                      : preview.state === 'connecting'
                        ? 'Connecting…'
                        : 'Stop preview'}
                  </button>
                  <p
                    style={{
                      margin: '7px 0 0',
                      fontSize: 11,
                      color: preview.error ? 'var(--danger)' : 'var(--muted)',
                      textAlign: 'center',
                    }}
                  >
                    {preview.error ??
                      `Plays the real Infobip voice (${voice}) over a silent WebRTC call.`}
                  </p>
                </>
              ) : null}
            </div>
          </div>

          {/* Phone live preview */}
          <aside className={styles.panel} style={{ borderLeft: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 17,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Live preview</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
            </div>
            <div
              style={{
                maxWidth: 236,
                margin: '0 auto',
                background: '#0b0b0f',
                borderRadius: 34,
                padding: 9,
                boxShadow: '0 10px 30px rgba(28,25,23,.22)',
              }}
            >
              <div
                style={{
                  background:
                    channel === 'sms' ? '#f6f6f7' : channel === 'whatsapp' ? '#075e54' : '#0b0b0f',
                  borderRadius: 26,
                  overflow: 'hidden',
                  minHeight: 420,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 70,
                    height: 18,
                    background: '#000',
                    borderRadius: '0 0 10px 10px',
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2,
                  }}
                />
                <StatusBar color={channel === 'sms' ? '#0b0b0f' : '#fff'} />

                {/* Voice — incoming call */}
                {channel === 'voice' ? (
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
                        {formatDuration(count2)} · calling…
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
                        {msgPreviewDisplay}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 20,
                        }}
                      >
                        <div
                          className={styles.callbtn}
                          style={{ background: 'rgba(255,255,255,.12)' }}
                        >
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
                        <div
                          className={styles.callbtn}
                          style={{ background: 'rgba(255,255,255,.12)' }}
                        >
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
                ) : null}

                {/* SMS — iMessage-style grey bubble */}
                {channel === 'sms' ? (
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
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0b0b0f' }}>
                        Maildrill
                      </div>
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
                        {msgPreviewDisplay}
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
                ) : null}

                {/* WhatsApp — green header + chat bubble */}
                {channel === 'whatsapp' ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#e5ddd0',
                      backgroundImage: 'radial-gradient(rgba(0,0,0,.04) 1px, transparent 1px)',
                      backgroundSize: '13px 13px',
                    }}
                  >
                    <div
                      style={{
                        background: '#075e54',
                        color: '#fff',
                        padding: '10px 13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth={2.4}
                      >
                        <path d="M15 6l-6 6 6 6" />
                      </svg>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,.22)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        M
                      </div>
                      <div style={{ lineHeight: 1.15 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>Maildrill</div>
                        <div style={{ fontSize: 9, opacity: 0.8 }}>online</div>
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: '14px 11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          maxWidth: '82%',
                          background: '#fff',
                          borderRadius: '2px 12px 12px 12px',
                          padding: '9px 12px 15px',
                          fontSize: 12,
                          lineHeight: 1.45,
                          color: '#111',
                          boxShadow: '0 1px 1px rgba(0,0,0,.1)',
                          position: 'relative',
                        }}
                      >
                        {msgPreviewDisplay}
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 5,
                            right: 10,
                            fontSize: 9,
                            color: '#8a8a8e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          9:41
                          <svg
                            width="13"
                            height="9"
                            viewBox="0 0 16 11"
                            fill="none"
                            stroke="#53bdeb"
                            strokeWidth={1.6}
                          >
                            <path d="M1 6l3.5 3.5L11 2" />
                            <path d="M6 6l3.5 3.5L16 2" />
                          </svg>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {quickReplies.map((q, i) => (
                          <div
                            key={`${q}-${i}`}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 16,
                              background: '#fff',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#075e54',
                              boxShadow: '0 1px 1px rgba(0,0,0,.08)',
                            }}
                          >
                            {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      )}
    </ChannelEditorShell>
  );
}
