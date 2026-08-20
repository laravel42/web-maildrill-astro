/** Local calendar date as YYYY-MM-DD (no timezone shift). */
export type ScheduleDate = `${number}-${string}-${string}`;

/** Local time as HH:mm (24-hour). */
export type ScheduleTime = `${string}:${string}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Pad to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD for a local Date (midnight local). */
export function toScheduleDate(d: Date): ScheduleDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` as ScheduleDate;
}

/** HH:mm for a local Date. */
export function toScheduleTime(d: Date): ScheduleTime {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` as ScheduleTime;
}

/** Default when the user picks "Schedule for later": tomorrow at 9:00 AM local. */
export function defaultScheduledParts(now = new Date()): {
  date: ScheduleDate;
  time: ScheduleTime;
} {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return { date: toScheduleDate(d), time: toScheduleTime(d) };
}

/** Parse an ISO timestamp into local date/time parts. */
export function partsFromScheduledAt(
  iso: string | null | undefined,
): { date: ScheduleDate; time: ScheduleTime } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { date: toScheduleDate(d), time: toScheduleTime(d) };
}

/** Combine local date + time into an ISO string (UTC). */
export function combineScheduledParts(date: ScheduleDate, time: ScheduleTime): string {
  const [y, m, day] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, day, h, min, 0, 0).toISOString();
}

/** Local Date from schedule parts. */
export function localDateFromParts(date: ScheduleDate, time: ScheduleTime): Date {
  const [y, m, day] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, day, h, min, 0, 0);
}

/** True when the combined local date/time is strictly after `now`. */
export function isScheduledInFuture(
  date: ScheduleDate,
  time: ScheduleTime,
  now = new Date(),
): boolean {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return false;
  return localDateFromParts(date, time).getTime() > now.getTime();
}

/** "Jul 15, 2026" for the date trigger and review row. */
export function formatScheduleDateLabel(date: ScheduleDate): string {
  const [y, m, day] = date.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "09:00 AM" for the time trigger and review row. */
export function formatScheduleTimeLabel(time: ScheduleTime): string {
  const [h, min] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, min);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Review-step delivery label. */
export function formatScheduleSummary(date: ScheduleDate, time: ScheduleTime): string {
  return `${formatScheduleDateLabel(date)} · ${formatScheduleTimeLabel(time)}`;
}

/** Calendar grid helpers — month view starting Sunday. */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function calendarCells(
  year: number,
  month: number,
): Array<{ date: ScheduleDate; inMonth: boolean }> {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const cells: Array<{ date: ScheduleDate; inMonth: boolean }> = [];
  const gridStart = new Date(year, month, 1 - startPad);
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: toScheduleDate(d), inMonth: d.getMonth() === month });
  }
  return cells;
}

export function partsFromDateString(date: ScheduleDate): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Every 30 minutes from 08:00 through 22:00 — campaign send window. */
export function scheduleTimeOptions(): ScheduleTime[] {
  const out: ScheduleTime[] = [];
  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 30]) {
      out.push(`${pad2(h)}:${pad2(m)}` as ScheduleTime);
    }
  }
  out.push('22:00' as ScheduleTime);
  return out;
}

/** Compare YYYY-MM-DD strings (lexicographic works). */
export function isDateBefore(a: ScheduleDate, b: ScheduleDate): boolean {
  return a < b;
}

export function todayScheduleDate(now = new Date()): ScheduleDate {
  return toScheduleDate(now);
}

/** True when the time slot cannot be chosen for `date` (combined local datetime is not in the future). */
export function isScheduleTimeSlotDisabled(
  date: ScheduleDate,
  time: ScheduleTime,
  now = new Date(),
): boolean {
  return !isScheduledInFuture(date, time, now);
}

/** First send-window slot strictly after `now` for `date`, or null when none remain. */
export function nextValidScheduleTime(date: ScheduleDate, now = new Date()): ScheduleTime | null {
  for (const slot of scheduleTimeOptions()) {
    if (isScheduledInFuture(date, slot, now)) return slot;
  }
  return null;
}

/** Earliest selectable slot for `date` (today → next future slot; future date → first window slot). */
export function minScheduleTimeForDate(date: ScheduleDate, now = new Date()): ScheduleTime | null {
  const today = todayScheduleDate(now);
  if (isDateBefore(date, today)) return null;
  if (date === today) return nextValidScheduleTime(date, now);
  return scheduleTimeOptions()[0] ?? null;
}
