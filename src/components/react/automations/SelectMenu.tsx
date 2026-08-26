import { useEffect, useId, useState } from 'react';
import Icon from '../Icon';
import styles from './SelectMenu.module.css';

export type SelectMenuOption = {
  value: string;
  label: string;
};

/**
 * Single-select dropdown — same trigger + scrim + pop pattern as `ColFilter`,
 * sized to match the inspector's outlined inputs. Native `<select>` is avoided
 * so the menu can share the app's option rows and close-on-scrim behaviour.
 */
export default function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  disabled = false,
  invalid,
  describedBy,
  label,
}: {
  value: string;
  options: readonly SelectMenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Accessible name when the visible field label is a separate element. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger}${invalid ? ` ${styles.triggerInvalid}` : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className={`${styles.caret}${open ? ` ${styles.caretOpen}` : ''}`}
        />
      </button>
      {open ? (
        <>
          <button type="button" className={styles.scrim} aria-label="Close" onClick={close} />
          <div
            id={listId}
            className={styles.pop}
            role="listbox"
            aria-label={label}
            style={{ animation: 'pop .14s ease' }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!selected}
              className={`${styles.opt}${!selected ? ` ${styles.optOn}` : ''}`}
              onClick={() => {
                onChange('');
                close();
              }}
            >
              <span className={styles.optLabel}>{placeholder}</span>
              {!selected ? <Icon name="check" size={14} stroke={3} /> : null}
            </button>
            {options.map((option) => {
              const on = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`${styles.opt}${on ? ` ${styles.optOn}` : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                >
                  <span className={styles.optLabel}>{option.label}</span>
                  {on ? <Icon name="check" size={14} stroke={3} /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
