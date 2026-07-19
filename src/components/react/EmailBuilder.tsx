import { useState, type ChangeEvent, type CSSProperties } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { formatDuration, smsSegments, voiceSeconds } from './shared/messaging';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  BLOCKS,
  PLACEHOLDER,
  PREVIEW_FALLBACK,
  SPEED_OPTS,
  TIPS,
  VARIABLES,
  VOICE_OPTS,
} from './EmailBuilder.logic';
import type { Props } from './EmailBuilder.types';
import styles from './EmailBuilder.module.css';

/* ------------------------------------------------------------------ *
 * EmailBuilder — full-screen template / message builder overlay.
 * React port of the "BUILDER" overlay in design/project/App.dc.html.
 * The parent gates mounting, so this renders its overlay immediately.
 * ------------------------------------------------------------------ */

/* Small inline icons the shared Icon set doesn't cover (match the design). */
function BackArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

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

export default function EmailBuilder({
  channel: initialChannel,
  name = null,
  kind = 'template',
  lockChannel = false,
  onClose,
  onSave,
}: Props) {
  const [channel, setChannel] = useState<ChannelType>(initialChannel);
  const [message, setMessage] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [quickReplies, setQuickReplies] = useState<string[]>(['Yes, count me in', 'Maybe later']);
  const [voice, setVoice] = useState<string>(VOICE_OPTS[0]);
  const [speed, setSpeed] = useState<string>(SPEED_OPTS[1]);

  useEscapeClose(onClose);

  const meta = CHANNEL[channel];
  const isEmail = channel === 'email';

  const len = message.length;
  const isVoice = channel === 'voice';
  const count2 = isVoice ? voiceSeconds(message) : smsSegments(len);
  const count2Label = isVoice ? 'sec (est.)' : 'segment(s)';
  const msgPreview = message.trim() ? message : PREVIEW_FALLBACK[channel];

  const handleSave = () => onSave({ channel, name: name ?? 'Untitled', message });
  const insertVariable = (token: string) =>
    setMessage((m) => (m ? `${m} ${token}` : token));

  const title = name ?? 'Untitled template';
  const crumb = `${kind === 'campaign' ? 'Campaigns' : 'Templates'} / Draft`;

  const canvasWidth = previewMode === 'desktop' ? 600 : 390;
  const deskActive = previewMode === 'desktop';

  return (
    <div className={styles.overlay} style={{ animation: 'fade .2s ease' }}>
      {/* ------------------------------- Top bar ------------------------------- */}
      <div className={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <button className={styles.back} type="button" onClick={onClose} aria-label="Back">
            <BackArrow />
          </button>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <span style={{ display: 'flex', color: meta.color }}>
                <Icon name={meta.icon} size={13} stroke={2} />
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{crumb}</div>
          </div>
        </div>

        {/* Channel switcher — hidden when the channel is locked (chosen up front). */}
        {!lockChannel && (
        <div className={styles.seg}>
          {CHANNEL_ORDER.map((k) => {
            const on = channel === k;
            const m = CHANNEL[k];
            return (
              <button
                key={k}
                type="button"
                className={styles.pill}
                onClick={() => setChannel(k)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 11px',
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: on ? 'var(--surface)' : 'transparent',
                  color: on ? m.color : 'var(--muted)',
                  boxShadow: on ? '0 1px 2px rgba(28,25,23,.08)' : 'none',
                }}
              >
                <Icon name={m.icon} size={12} stroke={2} />
                {m.label}
              </button>
            );
          })}
        </div>
        )}

        {/* Email-only preview controls */}
        {isEmail ? (
          <div className={styles.seg}>
            <span className={styles.hist} aria-hidden>
              ↺
            </span>
            <span className={styles.hist} aria-hidden>
              ↻
            </span>
            <div
              style={{ width: 1, height: 18, background: 'var(--border2)', margin: '0 3px' }}
            />
            <button
              type="button"
              className={styles.view}
              onClick={() => setPreviewMode('desktop')}
              aria-label="Desktop preview"
              style={{
                background: deskActive ? 'var(--surface)' : 'transparent',
                boxShadow: deskActive ? '0 1px 2px rgba(28,25,23,.1)' : 'none',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke={deskActive ? 'var(--text)' : 'var(--muted)'}
                strokeWidth={1.9}
              >
                <rect x="2" y="4" width="20" height="14" rx="2" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.view}
              onClick={() => setPreviewMode('mobile')}
              aria-label="Mobile preview"
              style={{
                background: !deskActive ? 'var(--surface)' : 'transparent',
                boxShadow: !deskActive ? '0 1px 2px rgba(28,25,23,.1)' : 'none',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={!deskActive ? 'var(--text)' : 'var(--muted)'}
                strokeWidth={1.9}
              >
                <rect x="6" y="2" width="12" height="20" rx="2" />
              </svg>
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--success-strong)',
              }}
            />
            Autosaved
          </span>
          <button type="button" className={styles.sbtn}>
            Send test
          </button>
          <button type="button" className={styles.sbtn} style={{ fontWeight: 600 }} onClick={handleSave}>
            Save draft
          </button>
          <button type="button" className={styles.pbtn}>
            Next step →
          </button>
        </div>
      </div>

      {/* ------------------------------- Body ------------------------------- */}
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
              <div style={{ paddingBottom: 9, fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>
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
              <div style={{ background: '#c9b79c', padding: '30px 28px', textAlign: 'center', color: '#3f2f1c' }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '1px' }}>MEET THE TEACHER!</div>
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
                  <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: '#1f1e1b' }}>
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
            <div style={{ ...fauxField, marginBottom: 14 }}>https://maildrill.app</div>

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
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={styles.varchip}
                  onClick={() => insertVariable(v)}
                >
                  <span style={{ color: meta.color }}>+</span>
                  {v}
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
          <div style={{ overflowY: 'auto', padding: '32px 40px', display: 'flex', justifyContent: 'center' }}>
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
                <span className={styles.tnum} style={{ fontWeight: 600, color: meta.color }}>
                  {count2} {count2Label}
                </span>
              </div>

              {channel === 'whatsapp' ? (
                <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--divider)' }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 11 }}>
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
                      {VOICE_OPTS.map((vo) => {
                        const on = voice === vo;
                        return (
                          <button
                            key={vo}
                            type="button"
                            className={styles.opt}
                            onClick={() => setVoice(vo)}
                            style={{
                              border: `1.5px solid ${on ? meta.color : 'var(--border2)'}`,
                              background: on ? meta.tint : 'transparent',
                              color: on ? meta.color : 'var(--text3)',
                            }}
                          >
                            {vo}
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
              <span
                style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }}
              />
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
                        {msgPreview}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                        <div className={styles.callbtn} style={{ background: 'rgba(255,255,255,.12)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
                            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0" />
                            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                            <line x1="3" y1="3" x2="21" y2="21" />
                          </svg>
                        </div>
                        <div
                          className={styles.callbtn}
                          style={{ width: 54, height: 54, background: '#e11d48', transform: 'rotate(135deg)' }}
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
                ) : null}

                {/* SMS — iMessage-style grey bubble */}
                {channel === 'sms' ? (
                  <div style={{ flex: 1, background: '#e9eaec', display: 'flex', flexDirection: 'column' }}>
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
                        {msgPreview}
                      </div>
                      <div style={{ alignSelf: 'flex-start', fontSize: 9, color: '#9a9a9e', margin: '2px 6px 0' }}>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}>
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
                        {msgPreview}
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
                          <svg width="13" height="9" viewBox="0 0 16 11" fill="none" stroke="#53bdeb" strokeWidth={1.6}>
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
    </div>
  );
}
