import { useEffect, useState } from 'react';
import Icon from './Icon';

/*
 * List editor — the centered "Create list / Edit list" modal (App.dc.html §NEW LIST).
 * Client-side only: on save it hands the parent the edited values via `onSave`,
 * which shows a toast. The parent gates mounting, so this renders open.
 */

export type ListEditorValues = { name: string; description: string; color: string };

const COLORS = [
  '#4f46e5',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
];

type Props = {
  mode: 'create' | 'edit';
  initialName?: string;
  initialDescription?: string;
  initialColor?: string;
  onClose: () => void;
  onSave: (values: ListEditorValues) => void;
};

export default function ListEditorModal({
  mode,
  initialName = '',
  initialDescription = '',
  initialColor = COLORS[0],
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [color, setColor] = useState(
    COLORS.includes(initialColor) ? initialColor : COLORS[0],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isEdit = mode === 'edit';
  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), description: description.trim(), color });
  };

  return (
    <div className="lem-overlay" onClick={onClose}>
      <div
        className="lem"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit list' : 'Create list'}
      >
        <div className="lem__head">
          <span className="lem__title">{isEdit ? 'Edit list' : 'Create list'}</span>
          <button type="button" className="lem__x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="lem__body">
          <label className="lem__label" htmlFor="lem-name">
            List name
          </label>
          <input
            id="lem-name"
            className="lem__input"
            value={name}
            autoFocus
            placeholder="e.g. Autumn newsletter"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />

          <label className="lem__label" htmlFor="lem-desc">
            Description <span className="lem__opt">(optional)</span>
          </label>
          <textarea
            id="lem-desc"
            className="lem__textarea"
            value={description}
            placeholder="What is this list for?"
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="lem__label">Color label</label>
          <div className="lem__swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`lem__swatch${c === color ? ' is-on' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="lem__foot">
          <button type="button" className="lem__cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lem__save" onClick={submit} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Create list'}
          </button>
        </div>

        <style>{`
          .lem-overlay {
            position: fixed; inset: 0; z-index: var(--z-modal);
            background: rgba(28,25,23,.4); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center; padding: 32px;
            animation: ovfade .18s var(--ease-out);
          }
          .lem {
            width: 460px; max-width: 100%; background: var(--surface); border-radius: 20px;
            box-shadow: 0 24px 60px rgba(28,25,23,.28); overflow: hidden; animation: pop .18s ease;
          }
          .lem__head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 22px; border-bottom: 1px solid var(--divider);
          }
          .lem__title { font-weight: 600; font-size: 15px; }
          .lem__x {
            width: 30px; height: 30px; border: none; background: var(--surface2);
            border-radius: 9px; cursor: pointer; color: var(--text4);
            display: flex; align-items: center; justify-content: center;
          }
          .lem__x:hover { color: var(--text2); background: var(--border2); }
          .lem__body { padding: 22px; }
          .lem__label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 6px; color: var(--text2); }
          .lem__opt { color: var(--muted); font-weight: 400; }
          .lem__input, .lem__textarea {
            width: 100%; border: 1px solid var(--border2); border-radius: 10px;
            padding: 10px 12px; font-size: 13.5px; color: var(--text); background: transparent;
            margin-bottom: 18px; font-family: inherit;
            transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
          }
          .lem__textarea { height: 64px; resize: none; margin-bottom: 18px; }
          .lem__input:focus, .lem__textarea:focus {
            outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint);
          }
          .lem__swatches { display: flex; gap: 11px; flex-wrap: wrap; }
          .lem__swatch {
            width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: none;
            box-shadow: 0 0 0 1px rgba(0,0,0,.06); transition: box-shadow .12s var(--ease-out), transform .12s var(--ease-out);
          }
          .lem__swatch:hover { transform: scale(1.08); }
          .lem__swatch.is-on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px currentColor; color: inherit; }
          .lem__foot {
            display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px;
            border-top: 1px solid var(--divider); background: var(--surface2);
          }
          .lem__cancel, .lem__save {
            padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer;
          }
          .lem__cancel { background: var(--surface); border: 1px solid var(--border2); color: var(--text2); }
          .lem__cancel:hover { background: var(--surface2); }
          .lem__save {
            background: var(--accent); color: #fff; border: none; padding: 9px 18px;
            box-shadow: 0 1px 2px rgba(79,70,229,.35), inset 0 1px 0 rgba(255,255,255,.16);
          }
          .lem__save:disabled { opacity: .55; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
