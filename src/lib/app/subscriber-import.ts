import type { CustomField } from '@/lib/app/custom-fields';

/**
 * File-import pipeline for the subscribers screen: parse a CSV/TSV/Excel file
 * into a headered grid, guess a column → field mapping, then build the rows
 * the `subscribers/import` endpoint accepts. Pure logic — the modal owns all
 * UI state; XLSX decoding lives behind a dynamic import so the SheetJS bundle
 * only loads when an Excel file is actually dropped.
 */

export type ParsedSheet = { headers: string[]; rows: string[][] };

/** Where one file column lands. `attr:` = existing custom field, `new:` = create. */
export type MapTarget =
  | 'skip'
  | 'email'
  | 'name'
  | 'phone'
  | 'status'
  | 'tags'
  | `attr:${string}`
  | `new:${string}`;

export type ImportStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained';

export type ImportRow = {
  email: string;
  name?: string;
  phone?: string;
  status?: ImportStatus;
  attributes?: Record<string, unknown>;
};

export type BuiltRows = {
  rows: ImportRow[];
  /** 1-based file line numbers (header = line 1) whose email failed validation. */
  invalid: { line: number; value: string }[];
  /** Fully-empty lines silently dropped. */
  emptySkipped: number;
};

/** Hard cap — beyond this the file is cut and the modal says so. */
export const MAX_IMPORT_ROWS = 10_000;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EXCEL_EXT_RE = /\.(xlsx|xls)$/i;

/** Sniff the delimiter from the first line: whichever splits it the most. */
function sniffDelimiter(firstLine: string): string {
  let best = ',';
  let bestCount = 0;
  for (const d of [',', ';', '\t']) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC-4180-ish CSV: quoted fields, doubled quotes, CRLF, sniffed delimiter. */
export function parseCsv(text: string): ParsedSheet {
  const delimiter = sniffDelimiter(text.slice(0, text.indexOf('\n') + 1 || text.length));
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      grid.push(row);
      row = [];
      if (grid.length > MAX_IMPORT_ROWS) break;
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    grid.push(row);
  }
  return toSheet(grid);
}

function toSheet(grid: string[][]): ParsedSheet {
  const first = grid.find((r) => r.some((c) => c.trim() !== ''));
  if (!first) return { headers: [], rows: [] };
  const headers = first.map((h, i) => h.trim() || `Column ${i + 1}`);
  const start = grid.indexOf(first) + 1;
  const rows = grid
    .slice(start, start + MAX_IMPORT_ROWS)
    .map((r) => headers.map((_, i) => (r[i] ?? '').trim()));
  return { headers, rows };
}

export function isExcelFile(file: File): boolean {
  return EXCEL_EXT_RE.test(file.name);
}

/** Parse whatever was dropped; Excel loads SheetJS on demand (first sheet). */
export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  if (isExcelFile(file)) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheet) return { headers: [], rows: [] };
    const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    return toSheet(grid.map((r) => r.map((c) => String(c ?? ''))));
  }
  return parseCsv(await file.text());
}

const HEADER_GUESSES: [RegExp, MapTarget][] = [
  [/^e[-_ ]?mail( address)?$/, 'email'],
  [/^(full[-_ ]?)?name$/, 'name'],
  [/^(phone|mobile|tel|telephone|whatsapp)([-_ ]?(number|no))?$/, 'phone'],
  [/^(status|subscription([-_ ]?status)?)$/, 'status'],
  [/^(tags?|labels?)$/, 'tags'],
];

/**
 * Guess where a column lands from its header: the singleton fields first
 * (each claimed once), then existing custom fields by key or label.
 */
export function guessTarget(
  header: string,
  customFields: CustomField[],
  taken: Set<MapTarget>,
): MapTarget {
  const h = header.trim().toLowerCase();
  for (const [re, target] of HEADER_GUESSES) {
    if (re.test(h) && !taken.has(target)) return target;
  }
  const field = customFields.find(
    (f) => f.key.toLowerCase() === h || f.label.trim().toLowerCase() === h,
  );
  if (field && !taken.has(`attr:${field.key}`)) return `attr:${field.key}`;
  return 'skip';
}

const STATUS_ALIASES: Record<string, ImportStatus> = {
  active: 'active',
  subscribed: 'active',
  subscribe: 'active',
  yes: 'active',
  unsubscribed: 'unsubscribed',
  unsubscribe: 'unsubscribed',
  unsub: 'unsubscribed',
  optout: 'unsubscribed',
  'opt-out': 'unsubscribed',
  'opted out': 'unsubscribed',
  bounced: 'bounced',
  bounce: 'bounced',
  complained: 'complained',
  complaint: 'complained',
  spam: 'complained',
  abuse: 'complained',
};

export function normalizeStatus(value: string): ImportStatus | undefined {
  return STATUS_ALIASES[value.trim().toLowerCase()];
}

/** Split a tags cell on commas/semicolons into unique, non-empty names. */
export function splitTags(value: string): string[] {
  return [...new Set(value.split(/[,;]+/).map((t) => t.trim()).filter(Boolean))];
}

/**
 * Apply the chosen mapping to the parsed grid. Rows without any content are
 * dropped silently; rows whose email cell fails validation are reported with
 * their 1-based file line number. Unknown statuses fall back to the server
 * default rather than failing the row.
 */
export function buildImportRows(sheet: ParsedSheet, mapping: MapTarget[]): BuiltRows {
  const emailCol = mapping.indexOf('email');
  const out: BuiltRows = { rows: [], invalid: [], emptySkipped: 0 };
  if (emailCol === -1) return out;

  sheet.rows.forEach((cells, i) => {
    const line = i + 2; // 1-based, after the header line
    if (cells.every((c) => c === '')) {
      out.emptySkipped += 1;
      return;
    }
    const email = (cells[emailCol] ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      out.invalid.push({ line, value: cells[emailCol] ?? '' });
      return;
    }

    const row: ImportRow = { email };
    const attributes: Record<string, unknown> = {};
    mapping.forEach((target, col) => {
      const value = (cells[col] ?? '').trim();
      if (!value || target === 'skip' || target === 'email') return;
      if (target === 'name') row.name = value;
      else if (target === 'phone') row.phone = value;
      else if (target === 'status') row.status = normalizeStatus(value);
      else if (target === 'tags') {
        const tags = splitTags(value);
        if (tags.length) {
          const prev = Array.isArray(attributes.tags) ? (attributes.tags as string[]) : [];
          attributes.tags = [...new Set([...prev, ...tags])];
        }
      } else {
        attributes[target.slice(target.indexOf(':') + 1)] = value;
      }
    });
    if (Object.keys(attributes).length) row.attributes = attributes;
    out.rows.push(row);
  });
  return out;
}
