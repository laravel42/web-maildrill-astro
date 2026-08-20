import type { ApiSubscriber } from './subscriber-map';
import type { CustomField } from './custom-fields';

/**
 * CSV export for the subscribers screen. Pure builders here; the screen owns
 * fetching (paginated — the table only ever holds the first page) and the
 * download trigger wraps the one DOM-touching step.
 */

export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  return `${[headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/**
 * Stable column layout: the built-in fields, then every workspace custom
 * field — so a round-trip through the import mapper lands cleanly.
 */
export function subscribersCsv(subs: ApiSubscriber[], fields: CustomField[]): string {
  const fieldKeys = fields.map((f) => f.key).filter((k) => k !== 'tags');
  const headers = ['email', 'name', 'phone', 'status', 'tags', 'lists', ...fieldKeys];
  const rows = subs.map((s) => {
    const attrs = (s.attributes ?? {}) as Record<string, unknown>;
    const tags =
      s.tagNames && s.tagNames.length > 0
        ? s.tagNames
        : Array.isArray(attrs.tags)
          ? (attrs.tags as string[])
          : [];
    return [
      s.email,
      s.name ?? '',
      s.phone ?? '',
      s.status,
      tags.join('; '),
      (s.lists ?? []).map((l) => l.name).join('; '),
      ...fieldKeys.map((k) => (attrs[k] == null ? '' : String(attrs[k]))),
    ];
  });
  return buildCsv(headers, rows);
}

/** `subscribers-2026-08-06.csv` */
export function exportFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/** Save a CSV client-side; the BOM keeps Excel decoding UTF-8 correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
