import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import { CHANNEL, CHANNEL_ORDER, channelLabel } from './shared/channels';
import { formatDuration, smsSegments, voiceSeconds } from './shared/messaging';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  audienceLabelOf,
  buildReviewRows,
  buildStepDefs,
  CONTENT_SUB,
  SENDER,
  templateCard,
  TEMPLATES,
} from './CampaignWizard.logic';
import type { Props, Schedule, Step, Template } from './CampaignWizard.types';
import styles from './CampaignWizard.module.css';

export type { Props };

/* ---------------------------------------------------------------------------
 * CampaignWizard — faithful React port of the 5-step campaign wizard modal.
 * The parent gates mounting (renders this only when open), so the modal shows
 * immediately. Logical step order is 1..5: Basics, Audience, Content, Schedule,
 * Review (matching `stepDefs` in the design).
 * ------------------------------------------------------------------------- */

const INDIGO = '#4f46e5';

/* Read-only phone status bar (signal + battery), shared by every phone mock. */
function PhoneStatusBar({ color }: { color: string }) {
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
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor" aria-hidden="true">
          <rect x="0" y="6" width="2" height="4" rx=".5" />
          <rect x="4" y="4" width="2" height="6" rx=".5" />
          <rect x="8" y="2" width="2" height="8" rx=".5" />
          <rect x="12" y="0" width="2" height="10" rx=".5" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" />
          <rect x="2" y="2" width="13" height="7" rx="1" fill="currentColor" />
          <rect x="19" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

/* Selectable radio card used for Audience (step 2) and Schedule (step 4). */
function RadioCard({
  selected,
  onSelect,
  title,
  sub,
  right,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub: string;
  right?: ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: `1.5px solid ${selected ? INDIGO : 'var(--border2)'}`,
        background: selected ? 'var(--accent-tint)' : 'var(--surface)',
        borderRadius: 12,
        padding: '13px 15px',
        marginBottom: 11,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          flex: 'none',
          borderRadius: '50%',
          border: `1.6px solid ${selected ? INDIGO : 'var(--muted2)'}`,
          background: selected ? INDIGO : 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--surface)',
            opacity: selected ? 1 : 0,
          }}
        />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

export default function CampaignWizard({
  mode,
  initialChannel = 'email',
  initialName = '',
  audiences,
  templates: templateChoices,
  onClose,
  onDone,
  onOpenBuilder,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [channel, setChannel] = useState<ChannelType>(initialChannel);
  const [name, setName] = useState<string>(initialName);
  const [audienceId, setAudienceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule>('now');
  const [replyTo, setReplyTo] = useState<string>('');

  // Escape closes the modal.
  useEscapeClose(onClose);

  const isEmail = channel === 'email';

  /* Live workspace data when the caller supplied it, else the preview fixtures —
     the same fallback the campaigns board uses when it has no session. */
  const live = audiences !== undefined || templateChoices !== undefined;
  const audienceList = audiences ?? [];
  const selectedAudience = audienceList.find((a) => a.id === audienceId) ?? null;
  const audienceLabel = live
    ? audienceLabelOf(selectedAudience)
    : 'Preview audience';

  const templates: Template[] = live
    ? (templateChoices ?? []).filter((t) => t.channel === channel).map(templateCard)
    : TEMPLATES[channel];
  const selTpl = templates.find((t) => t.name === selectedTemplate) ?? null;

  // Non-email content metrics.
  const messageLen = message.length;
  const voiceSecs = voiceSeconds(message);
  const segments = smsSegments(messageLen);
  const count2 = channel === 'voice' ? voiceSecs : segments;
  const count2Label = channel === 'voice' ? 'sec (est.)' : 'segment(s)';
  const callDuration = formatDuration(voiceSecs);
  const msgPreview = message || 'Hi Andrea, your message preview will appear here as you type…';

  // Email live-preview values.
  const prevHeaderBg = selTpl ? selTpl.thumb : 'linear-gradient(150deg,#4f46e5,#6d28d9)';
  const prevHeaderFg = selTpl ? (selTpl.fg ?? '#fff') : '#fff';
  const prevTitle = selTpl ? (selTpl.title ?? selTpl.name) : 'SUMMER SALE';
  const prevKicker = selTpl ? (selTpl.kicker ?? '') : 'UP TO 50% OFF';
  const prevCta = selTpl ? (selTpl.cta ?? 'Shop now') : 'SHOP NOW';
  const prevSubject = selTpl ? selTpl.name : 'Discover our best sellers this season';

  // Phone mock chrome.
  const statusBg = channel === 'voice' ? '#26221d' : channel === 'whatsapp' ? '#075e54' : '#f6f6f7';
  const statusColor = channel === 'sms' ? '#0b0b0f' : '#fff';

  const contentSub = CONTENT_SUB[channel];
  const stepDefs = buildStepDefs(contentSub);

  const title = mode === 'edit' ? 'Edit campaign' : 'New campaign';
  const nextLabel =
    step === 5
      ? mode === 'edit'
        ? 'Save changes'
        : 'Schedule campaign'
      : step === 4
        ? 'Continue to review →'
        : 'Continue →';

  /* The caller reports the outcome of an actual send, so this only covers the
     cases where nothing is dispatched. */
  const doneMsg =
    mode === 'edit'
      ? `Campaign "${name || 'Untitled'}" updated`
      : 'Campaign scheduled';

  /* Email sends a saved template; the other channels send the typed message. */
  const draftContent = isEmail ? undefined : message.trim() ? { text: message } : undefined;

  /* Why this campaign cannot be sent yet, or null when it can. Checked up front
     so the wizard explains the problem instead of the send failing afterwards. */
  const blockedReason =
    !live || mode === 'edit'
      ? null
      : !selectedAudience
        ? 'Pick an audience before sending.'
        : !selTpl?.id && !draftContent
          ? isEmail
            ? 'Choose a template — an email campaign needs content to send.'
            : 'Write a message before sending.'
          : null;

  const handlePrimary = () => {
    if (step < 5) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    if (blockedReason) return;
    onDone(doneMsg, {
      name,
      channel,
      listId: selectedAudience?.kind === 'list' ? selectedAudience.id : undefined,
      segmentId: selectedAudience?.kind === 'segment' ? selectedAudience.id : undefined,
      templateId: selTpl?.id,
      content: draftContent,
      audienceLabel,
      schedule,
    });
  };

  const handleBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const selectTemplate = (t: Template) => {
    setSelectedTemplate(t.name);
    if (channel !== 'email') {
      setMessage(`Hi [first_name], ${t.name} — ${t.cta ?? 'take a look'}. mldr.io/go`);
    }
  };

  const blankLabel = `Blank ${isEmail ? 'email' : channelLabel(channel)}`;

  const reviewRows = buildReviewRows(name, channel, audienceLabel, selectedTemplate, schedule);

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 6,
  };
  const h3Style: CSSProperties = {
    margin: '0 0 5px',
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: '-0.3px',
  };
  const pStyle: CSSProperties = { margin: '0 0 22px', fontSize: 13, color: 'var(--text4)' };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        background: 'rgba(28,25,23,.4)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        animation: 'fade .16s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 960,
          maxWidth: '100%',
          height: 600,
          maxHeight: '100%',
          background: 'var(--surface)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(28,25,23,.28)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'pop .2s ease',
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 25px',
            borderBottom: '1px solid var(--divider)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
            <div className="tnum" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              Step {step} of 5
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sbtn"
            aria-label="Close"
            style={{
              width: 31,
              height: 31,
              border: 'none',
              background: 'var(--surface2)',
              borderRadius: 9,
              cursor: 'pointer',
              color: 'var(--text4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* body */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 300px', flex: 1, minHeight: 0 }}>
          {/* left step rail */}
          <div
            style={{
              padding: '26px 21px',
              borderRight: '1px solid var(--divider)',
              background: 'var(--surface2)',
              overflowY: 'auto',
            }}
          >
            {stepDefs.map(([sTitle, sSub], i) => {
              const n = (i + 1) as Step;
              const done = n < step;
              const active = n === step;
              return (
                <div
                  key={sTitle}
                  onClick={() => setStep(n)}
                  style={{ display: 'flex', gap: 11, marginBottom: 22, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      width: 25,
                      height: 25,
                      flex: 'none',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      background: active ? INDIGO : done ? '#e7f6ec' : 'var(--surface)',
                      color: active ? '#fff' : done ? '#15803d' : 'var(--muted)',
                      border: `1.5px solid ${active ? INDIGO : done ? '#bbe6c8' : 'var(--border2)'}`,
                    }}
                  >
                    {done ? '✓' : String(n)}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: active || done ? 'var(--text)' : 'var(--text4)',
                      }}
                    >
                      {sTitle}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{sSub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* center step form */}
          <div style={{ padding: '28px 30px', overflowY: 'auto' }}>
            {step === 1 && (
              <>
                <h3 style={h3Style}>Let&rsquo;s start with the basics</h3>
                <p style={{ ...pStyle, margin: '0 0 24px' }}>
                  Choose a channel, name your campaign and set the sender.
                </p>
                <label style={labelStyle}>Channel</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 18,
                  }}
                >
                  {CHANNEL_ORDER.map((c) => {
                    const on = channel === c;
                    return (
                      <div
                        key={c}
                        onClick={() => setChannel(c)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          border: `1.5px solid ${on ? `var(--ch-${c})` : 'var(--border2)'}`,
                          background: on ? `var(--ch-${c}-tint)` : 'var(--surface)',
                          color: on ? `var(--ch-${c})` : 'var(--text3)',
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 13,
                          fontWeight: on ? 600 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Icon name={CHANNEL[c].icon} size={15} stroke={2.2} />
                        {channelLabel(c)}
                      </div>
                    );
                  })}
                </div>
                <label style={labelStyle}>Campaign name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Summer Sale 2026"
                  style={{
                    width: '100%',
                    border: '1px solid var(--border2)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13.5,
                    marginBottom: 18,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
                <label style={labelStyle}>{SENDER[channel].label}</label>
                <div
                  style={{
                    border: '1px solid var(--border2)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13.5,
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'var(--text2)',
                  }}
                >
                  {SENDER[channel].value}
                  <span style={{ color: 'var(--muted)' }}>▾</span>
                </div>
                {isEmail && (
                  <>
                    <label style={labelStyle}>
                      Reply-to{' '}
                      <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="hello@maildrill.app"
                      style={{
                        width: '100%',
                        border: '1px solid var(--border2)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13.5,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h3 style={h3Style}>Choose your audience</h3>
                <p style={pStyle}>Pick the list or segment to send to.</p>
                {audienceList.length === 0 ? (
                  <p
                    style={{
                      ...pStyle,
                      padding: '14px 16px',
                      border: '1px dashed var(--border2)',
                      borderRadius: 12,
                      margin: 0,
                    }}
                  >
                    No lists or segments yet. Create one under Audience first — a campaign
                    with no list or segment reaches nobody.
                  </p>
                ) : (
                  audienceList.map((a) => (
                    <RadioCard
                      key={a.id}
                      selected={audienceId === a.id}
                      onSelect={() => setAudienceId(a.id)}
                      title={a.name}
                      sub={a.desc}
                      right={
                        <span
                          className="tnum"
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}
                        >
                          {a.count == null ? '—' : a.count.toLocaleString()}
                        </span>
                      }
                    />
                  ))
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h3 style={h3Style}>{contentSub}</h3>
                <p style={{ ...pStyle, margin: '0 0 18px' }}>
                  Start from a template or build from scratch.
                </p>
                <label style={{ ...labelStyle, marginBottom: 8 }}>{channelLabel(channel)} templates</label>
                {templates.length === 0 && (
                  <p
                    style={{
                      ...pStyle,
                      padding: '14px 16px',
                      border: '1px dashed var(--border2)',
                      borderRadius: 12,
                      margin: '0 0 16px',
                    }}
                  >
                    No saved {channelLabel(channel)} templates yet. Create one under Templates,
                    or write the message below.
                  </p>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {templates.map((t) => {
                    const sel = selectedTemplate === t.name;
                    return (
                      <div
                        key={t.name}
                        onClick={() => selectTemplate(t)}
                        className={styles.cwCrd}
                        style={{
                          border: `1.5px solid ${sel ? INDIGO : 'var(--border2)'}`,
                          background: sel ? 'var(--accent-tint)' : 'var(--surface)',
                          borderRadius: 12,
                          padding: 16,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            height: 56,
                            borderRadius: 8,
                            background: t.thumb,
                            marginBottom: 11,
                          }}
                        />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {sel ? 'Selected' : t.cat}
                        </div>
                      </div>
                    );
                  })}
                  <div
                    onClick={() => setSelectedTemplate(null)}
                    className={styles.cwCrd}
                    style={{
                      border: '1.5px dashed var(--border2)',
                      borderRadius: 12,
                      padding: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: 'var(--surface2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 9,
                        color: 'var(--muted)',
                      }}
                    >
                      <Icon name="plus" size={16} stroke={2.2} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text4)' }}>
                      {blankLabel}
                    </div>
                  </div>
                </div>

                {isEmail ? (
                  <button
                    type="button"
                    onClick={() => onOpenBuilder?.(channel, name || 'Untitled')}
                    className="sbtn"
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: '1px solid var(--border2)',
                      padding: 10,
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--text2)',
                      cursor: 'pointer',
                    }}
                  >
                    Open in builder →
                  </button>
                ) : (
                  <>
                    <label style={labelStyle}>Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Hi [first_name], our flash sale ends tonight — 50% off everything. Shop now: mldr.io/sale"
                      style={{
                        width: '100%',
                        minHeight: 120,
                        resize: 'vertical',
                        border: '1px solid var(--border2)',
                        borderRadius: 10,
                        padding: '11px 12px',
                        fontSize: 13.5,
                        fontFamily: "'Geist', system-ui, sans-serif",
                        lineHeight: 1.5,
                        color: 'var(--text2)',
                        background: 'var(--surface)',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 8,
                        fontSize: 11.5,
                        color: 'var(--muted)',
                      }}
                    >
                      <span className="tnum">{messageLen} characters</span>
                      <span className="tnum">
                        {count2} {count2Label}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <h3 style={h3Style}>When should this send?</h3>
                <p style={pStyle}>Send immediately or schedule for later.</p>
                <RadioCard
                  selected={schedule === 'now'}
                  onSelect={() => setSchedule('now')}
                  title="Send now"
                  sub="Delivery starts immediately"
                />
                <RadioCard
                  selected={schedule === 'later'}
                  onSelect={() => setSchedule('later')}
                  title="Schedule for later"
                  sub="Pick a date and time"
                />
                {schedule === 'later' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      marginTop: 14,
                    }}
                  >
                    <div>
                      <label style={{ ...labelStyle, fontSize: 12 }}>Date</label>
                      <div
                        style={{
                          border: '1px solid var(--border2)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          fontSize: 13,
                        }}
                      >
                        Jul 15, 2026
                      </div>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 12 }}>Time</label>
                      <div
                        style={{
                          border: '1px solid var(--border2)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          fontSize: 13,
                        }}
                      >
                        09:00 AM
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 5 && (
              <>
                <h3 style={h3Style}>Review your campaign</h3>
                <p style={pStyle}>Double-check everything before you send.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {reviewRows.map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '13px 0',
                        borderBottom: '1px solid var(--surface2)',
                        gap: 16,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginTop: 18,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: '#e7f6ec',
                    color: '#15803d',
                    fontSize: 12.5,
                    fontWeight: 500,
                  }}
                >
                  <Icon name="check" size={16} stroke={2.2} />
                  All checks passed. Ready to schedule.
                </div>
              </>
            )}
          </div>

          {/* right live preview */}
          <div
            style={{
              padding: 22,
              background: 'var(--surface2)',
              borderLeft: '1px solid var(--divider)',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Live preview
            </div>

            {isEmail ? (
              /* Email card preview — kept intentionally light (like a mail client). */
              <div
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(28,25,23,.12)',
                }}
              >
                <div
                  style={{
                    background: prevHeaderBg,
                    padding: '34px 22px',
                    textAlign: 'center',
                    color: prevHeaderFg,
                  }}
                >
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.5px' }}>
                    {prevTitle}
                  </div>
                  {prevKicker && (
                    <div style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>{prevKicker}</div>
                  )}
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 16,
                      background: '#f6b8a0',
                      color: '#7c2d12',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '7px 16px',
                      borderRadius: 6,
                    }}
                  >
                    {prevCta}
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#1c1917' }}>
                    {prevSubject}
                  </div>
                  <div style={{ fontSize: 11, color: '#78716c', lineHeight: 1.5 }}>
                    Lorem ipsum is simply dummy text of the printing and typesetting industry.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <div style={{ flex: 1, height: 44, background: '#f1f0fb', borderRadius: 7 }} />
                    <div style={{ flex: 1, height: 44, background: '#f1f0fb', borderRadius: 7 }} />
                    <div style={{ flex: 1, height: 44, background: '#f1f0fb', borderRadius: 7 }} />
                  </div>
                </div>
              </div>
            ) : (
              /* Phone mock preview for SMS / WhatsApp / Voice. */
              <div
                style={{
                  maxWidth: 256,
                  margin: '0 auto',
                  background: '#0b0b0f',
                  borderRadius: 34,
                  padding: 10,
                  boxShadow: '0 10px 30px rgba(28,25,23,.22)',
                }}
              >
                <div
                  style={{
                    background: statusBg,
                    borderRadius: 26,
                    overflow: 'hidden',
                    minHeight: 360,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: 72,
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
                  <PhoneStatusBar color={statusColor} />

                  {channel === 'voice' && (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '18px 18px 24px',
                        background: 'linear-gradient(180deg,#26221d,#0b0b0f)',
                        color: '#fff',
                      }}
                    >
                      <div style={{ textAlign: 'center', marginTop: 12 }}>
                        <div
                          style={{
                            fontSize: 10.5,
                            color: 'rgba(255,255,255,.5)',
                            fontWeight: 600,
                            letterSpacing: '0.4px',
                            marginBottom: 9,
                          }}
                        >
                          INCOMING CALL
                        </div>
                        <div
                          style={{
                            width: 70,
                            height: 70,
                            borderRadius: '50%',
                            background: 'var(--ch-voice)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            fontWeight: 700,
                            margin: '0 auto',
                          }}
                        >
                          M
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 13 }}>Maildrill</div>
                        <div
                          className="tnum"
                          style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', marginTop: 4 }}
                        >
                          {callDuration} · calling…
                        </div>
                      </div>
                      <div style={{ width: '100%' }}>
                        <div
                          style={{
                            maxWidth: 180,
                            margin: '0 auto 18px',
                            background: 'rgba(255,255,255,.08)',
                            borderRadius: 12,
                            padding: '10px 12px',
                            fontSize: 11,
                            lineHeight: 1.5,
                            color: 'rgba(255,255,255,.85)',
                          }}
                        >
                          {msgPreview}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 18,
                          }}
                        >
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0" />
                              <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                              <line x1="3" y1="3" x2="21" y2="21" />
                            </svg>
                          </div>
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: '50%',
                              background: '#e11d48',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: 'rotate(135deg)',
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1z" />
                            </svg>
                          </div>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
                  )}

                  {channel === 'sms' && (
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
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#c7c9cc',
                            margin: '0 auto 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
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
                            fontSize: 11.5,
                            lineHeight: 1.45,
                            color: '#0b0b0f',
                            boxShadow: '0 1px 1px rgba(0,0,0,.05)',
                          }}
                        >
                          {msgPreview}
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
                  )}

                  {channel === 'whatsapp' && (
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
                          <path d="M15 6l-6 6 6 6" />
                        </svg>
                        <div
                          style={{
                            width: 25,
                            height: 25,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,.22)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          M
                        </div>
                        <div style={{ lineHeight: 1.15 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700 }}>Maildrill</div>
                          <div style={{ fontSize: 9, opacity: 0.8 }}>online</div>
                        </div>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: '14px 11px',
                          display: 'flex',
                          flexDirection: 'column',
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
                            fontSize: 11.5,
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
                            <svg width="13" height="9" viewBox="0 0 16 11" fill="none" stroke="#53bdeb" strokeWidth="1.6" aria-hidden="true">
                              <path d="M1 6l3.5 3.5L11 2" />
                              <path d="M6 6l3.5 3.5L16 2" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 25px',
            borderTop: '1px solid var(--divider)',
            background: 'var(--surface)',
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            className="sbtn"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--text2)',
              cursor: 'pointer',
              visibility: step === 1 ? 'hidden' : 'visible',
            }}
          >
            ← Back
          </button>
          {/* On the final step an incomplete campaign explains itself rather
              than failing on the server after the user commits. */}
          {step === 5 && blockedReason && (
            <span style={{ fontSize: 12.5, color: 'var(--text3)', marginRight: 'auto', paddingLeft: 12 }}>
              {blockedReason}
            </span>
          )}
          <button
            type="button"
            onClick={handlePrimary}
            className="pbtn"
            disabled={step === 5 && blockedReason !== null}
            title={step === 5 && blockedReason ? blockedReason : undefined}
            style={{
              background: INDIGO,
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              cursor: step === 5 && blockedReason ? 'not-allowed' : 'pointer',
              opacity: step === 5 && blockedReason ? 0.5 : 1,
              boxShadow: '0 1px 2px rgba(79,70,229,.35), inset 0 1px 0 rgba(255,255,255,.16)',
            }}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
