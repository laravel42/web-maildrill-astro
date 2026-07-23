import { useMemo, useState } from 'react';
import Icon from '../Icon';
import {
  formatScheduleTimeLabel,
  isScheduleTimeSlotDisabled,
  scheduleTimeOptions,
  type ScheduleDate,
  type ScheduleTime,
} from '@/lib/app/schedule';
import styles from './TimePicker.module.css';

export default function TimePicker({
  id,
  label,
  value,
  onChange,
  referenceDate,
  inline = false,
}: {
  id: string;
  label: string;
  value: ScheduleTime;
  onChange: (time: ScheduleTime) => void;
  /** Selected calendar date — past slots for this date are disabled. */
  referenceDate?: ScheduleDate;
  /** Always show the time slot list (no trigger/popover). */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const labelId = `${id}-label`;
  const options = useMemo(() => {
    const base = scheduleTimeOptions();
    if (!base.includes(value)) return [value, ...base].sort();
    return base;
  }, [value]);

  const pick = (time: ScheduleTime) => {
    onChange(time);
    if (!inline) setOpen(false);
  };

  const slots = options.map((t) => {
    const selected = t === value;
    const disabled = referenceDate ? isScheduleTimeSlotDisabled(referenceDate, t) : false;
    const className = [
      styles.slot,
      selected ? styles.slotSelected : '',
      disabled ? styles.slotDisabled : '',
      'tnum',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={t}
        type="button"
        role="radio"
        aria-checked={selected}
        className={className}
        disabled={disabled}
        onClick={() => pick(t)}
      >
        {formatScheduleTimeLabel(t)}
      </button>
    );
  });

  const timeGrid = inline ? (
    <div className={styles.panelInline} id={id}>
      <div
        className={styles.gridInline}
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {slots}
      </div>
    </div>
  ) : (
    <div
      className={styles.pop}
      role="radiogroup"
      aria-label={`Choose ${label.toLowerCase()}`}
      id={id}
    >
      {slots}
    </div>
  );

  return (
    <div className={`${styles.wrap}${inline ? ` ${styles.wrapInline}` : ''}`}>
      <label
        id={inline ? labelId : undefined}
        htmlFor={inline ? undefined : id}
        className={styles.label}
      >
        {label}
      </label>
      {!inline && (
        <button
          id={id}
          type="button"
          className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ''}`}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`${label}: ${formatScheduleTimeLabel(value)}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`${styles.triggerLabel} tnum`}>{formatScheduleTimeLabel(value)}</span>
          <Icon name="clock" size={15} />
        </button>
      )}
      {inline ? (
        timeGrid
      ) : (
        open && (
          <>
            <button type="button" className={styles.scrim} aria-label="Close time picker" onClick={() => setOpen(false)} />
            {timeGrid}
          </>
        )
      )}
    </div>
  );
}
