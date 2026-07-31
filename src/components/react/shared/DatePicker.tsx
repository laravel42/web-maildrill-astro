import { useMemo, useState } from 'react';
import Icon from '../Icon';
import {
  calendarCells,
  formatScheduleDateLabel,
  isDateBefore,
  monthLabel,
  partsFromDateString,
  todayScheduleDate,
  type ScheduleDate,
} from '@/lib/app/schedule';
import styles from './DatePicker.module.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export default function DatePicker({
  id,
  label,
  value,
  onChange,
  minDate,
  inline = false,
}: {
  id: string;
  label: string;
  value: ScheduleDate;
  onChange: (date: ScheduleDate) => void;
  /** Earliest selectable date (typically today). */
  minDate?: ScheduleDate;
  /** Always show the calendar panel (no trigger/popover). */
  inline?: boolean;
}) {
  const min = minDate ?? todayScheduleDate();
  const { year: initYear, month: initMonth } = partsFromDateString(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  const today = todayScheduleDate();
  const cells = useMemo(() => calendarCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const labelId = `${id}-label`;

  const canPrev =
    viewYear > partsFromDateString(min).year ||
    (viewYear === partsFromDateString(min).year && viewMonth > partsFromDateString(min).month);

  const goPrev = () => {
    if (!canPrev) return;
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNext = () => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const pick = (date: ScheduleDate) => {
    if (isDateBefore(date, min)) return;
    onChange(date);
    if (!inline) setOpen(false);
    const { year, month } = partsFromDateString(date);
    setViewYear(year);
    setViewMonth(month);
  };

  const calendarPanel = (
    <div
      className={inline ? styles.panelInline : styles.pop}
      role={inline ? 'group' : 'dialog'}
      aria-label={inline ? undefined : `Choose ${label.toLowerCase()}`}
      aria-labelledby={inline ? labelId : undefined}
      id={inline ? id : undefined}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navBtn}
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={goPrev}
        >
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }} aria-hidden="true">
            <Icon name="chevron-right" size={14} />
          </span>
        </button>
        <div className={styles.monthLabel}>{monthLabel(viewYear, viewMonth)}</div>
        <button type="button" className={styles.navBtn} aria-label="Next month" onClick={goNext}>
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.weekday}>
            {d}
          </span>
        ))}
      </div>
      <div className={styles.grid} role="grid" aria-label="Calendar days">
        {cells.map(({ date, inMonth }) => {
          const disabled = isDateBefore(date, min);
          const selected = date === value;
          const isToday = date === today;
          const dayNum = Number(date.slice(-2));
          const className = [
            styles.day,
            inline ? styles.dayInline : '',
            !inMonth ? styles.dayOutside : '',
            isToday ? styles.dayToday : '',
            selected ? styles.daySelected : '',
            disabled ? styles.dayDisabled : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className={className}
              disabled={disabled}
              aria-selected={selected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={formatScheduleDateLabel(date)}
              onClick={() => pick(date)}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
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
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${formatScheduleDateLabel(value)}`}
          onClick={() => {
            const { year, month } = partsFromDateString(value);
            setViewYear(year);
            setViewMonth(month);
            setOpen((o) => !o);
          }}
        >
          <span className={styles.triggerLabel}>{formatScheduleDateLabel(value)}</span>
          <Icon name="chevron-down" size={14} />
        </button>
      )}
      {inline
        ? calendarPanel
        : open && (
            <>
              <button
                type="button"
                className={styles.scrim}
                aria-label="Close calendar"
                onClick={() => setOpen(false)}
              />
              {calendarPanel}
            </>
          )}
    </div>
  );
}
