import { useState } from 'react';
import Icon from './Icon';
import Modal from './shared/Modal';
import { COLORS } from './ListEditorModal.logic';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import type { ChannelType } from '@/types/app';
import type { ListEditorValues } from './ListEditorModal.types';
import styles from './ListEditorModal.module.css';

/*
 * List editor — the centered "Create list / Edit list" modal (App.dc.html §NEW LIST).
 * Client-side only: on save it hands the parent the edited values via `onSave`,
 * which shows a toast. The parent gates mounting, so this renders open.
 */

export type { ListEditorValues } from './ListEditorModal.types';

type Props = {
  mode: 'create' | 'edit';
  initialName?: string;
  initialNotes?: string;
  initialColor?: string;
  initialChannels?: ChannelType[];
  initialGdprConsent?: boolean;
  onClose: () => void;
  onSave: (values: ListEditorValues) => void;
};

export default function ListEditorModal({
  mode,
  initialName = '',
  initialNotes = '',
  initialColor = COLORS[0],
  initialChannels = ['email'],
  initialGdprConsent = false,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [color, setColor] = useState(COLORS.includes(initialColor) ? initialColor : COLORS[0]);
  const [channels, setChannels] = useState<ChannelType[]>(
    initialChannels.length > 0 ? initialChannels : ['email'],
  );
  const [gdprConsent, setGdprConsent] = useState(initialGdprConsent);

  const isEdit = mode === 'edit';
  // A list with no channel cannot be sent to, so saving is blocked rather than
  // silently defaulted — the same rule the API enforces.
  const canSave = name.trim().length > 0 && channels.length > 0;

  const toggleChannel = (ch: ChannelType) =>
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));

  const submit = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), notes: notes.trim(), color, channels, gdprConsent });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit list' : 'Create list'}
      panelClassName={styles.lem}
    >
      <div className={styles.head}>
        <span className={styles.title}>{isEdit ? 'Edit list' : 'Create list'}</span>
        <button type="button" className={styles.x} onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className={styles.body}>
          <label className={styles.label} htmlFor="lem-name">
            List name
          </label>
          <input
            id="lem-name"
            className={styles.input}
            value={name}
            autoFocus
            placeholder="e.g. Autumn newsletter"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />

          <label className={styles.label} htmlFor="lem-notes">
            Notes <span className={styles.opt}>(optional)</span>
          </label>
          <textarea
            id="lem-notes"
            className={styles.textarea}
            value={notes}
            placeholder="Add a note about this list…"
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className={styles.field}>
            <label className={styles.label} id="lem-channels">
              Channels
            </label>
            <div className={styles.channels} role="group" aria-labelledby="lem-channels">
              {CHANNEL_ORDER.map((ch) => {
                const m = CHANNEL[ch];
                const on = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`${styles.channel}${on ? ' is-on' : ''}`}
                    style={
                      on ? { background: m.tint, color: m.color, borderColor: m.color } : undefined
                    }
                    onClick={() => toggleChannel(ch)}
                  >
                    <Icon name={m.icon} size={13} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            {channels.length === 0 && <p className={styles.hint}>Pick at least one channel.</p>}
          </div>

          <div className={styles.setting}>
            <div>
              <span className={styles.settingTitle}>GDPR consent</span>
              <span className={styles.settingDesc}>
                Mark this list as requiring or recording GDPR consent.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={gdprConsent}
              aria-label="Require GDPR consent"
              className={`atoggle${gdprConsent ? ' is-on' : ''}`}
              onClick={() => setGdprConsent((on) => !on)}
            >
              <span />
            </button>
          </div>

          <label className={styles.label}>Color label</label>
          <div className={styles.swatches}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.swatch}${c === color ? ' is-on' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.save} onClick={submit} disabled={!canSave}>
          {isEdit ? 'Save changes' : 'Create list'}
        </button>
      </div>
    </Modal>
  );
}
