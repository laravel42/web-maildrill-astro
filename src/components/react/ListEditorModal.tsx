import { useState } from 'react';
import Icon from './Icon';
import { useEscapeClose } from './shared/useEscapeClose';
import { COLORS } from './ListEditorModal.logic';
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
  onClose: () => void;
  onSave: (values: ListEditorValues) => void;
};

export default function ListEditorModal({
  mode,
  initialName = '',
  initialNotes = '',
  initialColor = COLORS[0],
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [color, setColor] = useState(
    COLORS.includes(initialColor) ? initialColor : COLORS[0],
  );

  useEscapeClose(onClose);

  const isEdit = mode === 'edit';
  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), notes: notes.trim(), color });
  };

  return (
    <div className={styles.overlay} onClick={onClose} style={{ animation: 'ovfade .18s var(--ease-out)' }}>
      <div
        className={styles.lem}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit list' : 'Create list'}
        style={{ animation: 'pop .18s ease' }}
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
      </div>
    </div>
  );
}
