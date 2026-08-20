import type { ChannelType } from '@/types/app';
import Icon from '../Icon';
import { CHANNEL } from './channels';
import styles from './GalleryPreview.module.css';

/** Decorative fields used by the faux-email / chat / voice card mockups. */
export type GalleryPreviewData = {
  thumb: string;
  fg?: string;
  accent?: string;
  title?: string;
  kicker?: string;
  cta?: string;
  name: string;
};

const VOICE_WAVE = [38, 62, 48, 88, 56, 30, 72, 46, 82, 40, 64, 34, 70, 44];

/** Recreated faux-email preview — pure CSS blocks, never a real image. */
export function FauxEmail({ t, variant }: { t: GalleryPreviewData; variant: 'card' | 'drawer' }) {
  const lg = variant === 'drawer';
  const fg = t.fg ?? '#fff';
  const accent = t.accent ?? '#4f46e5';
  return (
    <div className={`${styles.mail}${lg ? ` ${styles.mailLg}` : ''}`} aria-hidden="true">
      <div className={styles.mailBand} style={{ background: t.thumb }}>
        <div className={styles.mailKicker} style={{ color: fg }}>
          {t.kicker ?? ''}
        </div>
        <div className={styles.mailTitle} style={{ color: fg }}>
          {t.title ?? t.name}
        </div>
      </div>
      <div className={styles.mailBody}>
        <span className={styles.mailBar} style={{ width: '80%', background: '#e7e5e4' }} />
        <span className={styles.mailBar} style={{ width: '95%', background: '#efedec' }} />
        <span className={styles.mailBar} style={{ width: '60%', background: '#efedec' }} />
        <span className={styles.mailCta} style={{ background: accent }}>
          {t.cta ?? 'View'}
        </span>
      </div>
    </div>
  );
}

/** Chat-bubble preview for the text channels (SMS, WhatsApp). */
function FauxChat({ t, channel }: { t: GalleryPreviewData; channel: ChannelType }) {
  const m = CHANNEL[channel];
  const wa = channel === 'whatsapp';
  return (
    <div className={`${styles.chat}${wa ? ` ${styles.chatWa}` : ''}`} aria-hidden="true">
      <div className={styles.chatHead}>
        <span className={styles.chatAvatar} style={{ background: m.color }}>
          <Icon name={m.icon} size={11} />
        </span>
        <span className={styles.chatName}>{t.kicker ?? t.name}</span>
      </div>
      <div className={styles.chatBubbleOut} style={{ background: m.color }}>
        {t.title ?? t.name}
      </div>
      <div className={styles.chatBubbleIn} aria-label="Awaiting reply">
        <span className={styles.chatDot} />
        <span className={styles.chatDot} />
        <span className={styles.chatDot} />
      </div>
    </div>
  );
}

/** Voice-note card preview for the Voice channel. */
function FauxVoice({ t, channel }: { t: GalleryPreviewData; channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <div className={styles.voice} aria-hidden="true">
      <span className={styles.voicePlay} style={{ background: m.color }}>
        <Icon name={m.icon} size={13} />
      </span>
      <div className={styles.voiceMain}>
        <span className={styles.voiceName}>{t.title ?? t.name}</span>
        <div className={styles.voiceWave}>
          {VOICE_WAVE.map((h, i) => (
            <span
              key={i}
              className={styles.voiceBar}
              style={{ height: `${h}%`, background: m.color }}
            />
          ))}
        </div>
      </div>
      <span className={`${styles.voiceTime} tnum`}>0:14</span>
    </div>
  );
}

/** Gallery thumbnail, chosen by channel: an email mock, a chat, or a voice note. */
export default function GalleryPreview({
  channel,
  t,
}: {
  channel: ChannelType;
  t: GalleryPreviewData;
}) {
  if (channel === 'email') return <FauxEmail t={t} variant="card" />;
  if (channel === 'voice') return <FauxVoice t={t} channel={channel} />;
  return <FauxChat t={t} channel={channel} />;
}
