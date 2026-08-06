/**
 * File-import pipeline for the add-subscribers wizard: parse a spreadsheet
 * (CSV hand-rolled; XLS/XLSX/Numbers via lazily-loaded SheetJS), guess a
 * column → field mapping, and build the rows the bulk endpoint accepts.
 */

/** A parsed sheet: header labels plus data rows (both trimmed strings). */
export type ParsedSheet = { headers: string[]; rows: string[][] };

/** What a file column can map to. Custom fields land in `attributes.<key>`. */
export type ImportTarget =
  | { kind: 'email' }
  | { kind: 'name' }
  | { kind: 'phone' }
  | { kind: 'tags' }
  | { kind: 'attribute'; key: string }
  | { kind: 'skip' };

/** One row in the shape POST /v1/subscribers/import accepts. */
export type SubscriberImportRow = {
  email: string;
  name?: string;
  phone?: string;
  attributes?: Record<string, unknown>;
};

export const IMPORT_EXTENSIONS = ['csv', 'xls', 'xlsx', 'numbers'] as const;

export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.map((e) => `.${e}`).join(',');

/** Hard cap mirrored by the API schema (rows per import request). */
export const IMPORT_MAX_ROWS = 5000;

const EMAIL_RE = /.+@.+\..+/;

function extensionOf(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}

/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CR/LF line ends.
 * The delimiter is sniffed from the first line (`;` beats `,` when it wins the
 * count — common in locale-exported CSVs).
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.slice(0, clean.search(/\r?\n|$/));
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * First row is the header unless it already looks like data (contains an
 * email) — headerless files get generated "Column N" labels instead.
 */
function toSheet(grid: string[][]): ParsedSheet {
  if (grid.length === 0) return { headers: [], rows: [] };
  const width = Math.max(...grid.map((r) => r.length));
  const normalized = grid.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()));
  const first = normalized[0]!;
  const headerless = first.some((cell) => EMAIL_RE.test(cell));
  const headers = headerless
    ? first.map((_, i) => `Column ${i + 1}`)
    : first.map((h, i) => h || `Column ${i + 1}`);
  return { headers, rows: headerless ? normalized : normalized.slice(1) };
}

/** Parse a subscriber file. Throws a user-facing Error for unusable input. */
export async function parseImportFile(file: File): Promise<ParsedSheet> {
  const ext = extensionOf(file.name);
  if (!IMPORT_EXTENSIONS.includes(ext as (typeof IMPORT_EXTENSIONS)[number])) {
    throw new Error(`Unsupported file type “.${ext}” — use CSV, Excel, or Numbers.`);
  }

  let grid: string[][];
  if (ext === 'csv') {
    grid = parseCsv(await file.text());
  } else {
    // SheetJS is ~1MB — load it only when a spreadsheet actually arrives.
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { dense: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error('The file has no sheets.');
    grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName]!, {
      header: 1,
      raw: false,
      defval: '',
    });
  }

  const sheet = toSheet(grid);
  if (sheet.rows.length === 0) throw new Error('No rows found in the file.');
  if (sheet.rows.length > IMPORT_MAX_ROWS) {
    throw new Error(
      `${sheet.rows.length.toLocaleString('en-US')} rows — imports are capped at ${IMPORT_MAX_ROWS.toLocaleString('en-US')} per file.`,
    );
  }
  return sheet;
}

/** Column-header heuristics for the initial mapping. */
export function guessTarget(header: string, customFieldKeys: string[] = []): ImportTarget {
  const h = header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  if (/\b(e ?mail|email address)\b/.test(h) || h === 'mail') return { kind: 'email' };
  if (/\b(phone|mobile|cell|tel|telephone|whatsapp)\b/.test(h)) return { kind: 'phone' };
  if (/\b(full name|name|first name|contact)\b/.test(h) && !/company|list|file/.test(h)) {
    return { kind: 'name' };
  }
  if (/\b(tags?|labels?|groups?)\b/.test(h)) return { kind: 'tags' };
  const attr = customFieldKeys.find((k) => k.toLowerCase().replace(/[\s_-]+/g, ' ') === h);
  if (attr) return { kind: 'attribute', key: attr };
  return { kind: 'skip' };
}

export function guessMapping(headers: string[], customFieldKeys: string[] = []): ImportTarget[] {
  const seen = new Set<string>();
  return headers.map((h) => {
    const guess = guessTarget(h, customFieldKeys);
    // Single-valued targets: first matching column wins, duplicates skip.
    if (guess.kind === 'email' || guess.kind === 'name' || guess.kind === 'phone') {
      if (seen.has(guess.kind)) return { kind: 'skip' };
      seen.add(guess.kind);
    }
    return guess;
  });
}

/**
 * Apply a mapping to the parsed rows. Rows without a valid email are counted
 * as skipped; tag cells split on commas/semicolons and merge across columns.
 */
export function buildImportRows(
  sheet: ParsedSheet,
  mapping: ImportTarget[],
): { rows: SubscriberImportRow[]; skipped: number } {
  const rows: SubscriberImportRow[] = [];
  let skipped = 0;
  for (const raw of sheet.rows) {
    let email = '';
    let name = '';
    let phone = '';
    const tags: string[] = [];
    const attributes: Record<string, unknown> = {};
    mapping.forEach((target, col) => {
      const value = (raw[col] ?? '').trim();
      if (!value || target.kind === 'skip') return;
      if (target.kind === 'email') email = value;
      else if (target.kind === 'name') name = name ? `${name} ${value}` : value;
      else if (target.kind === 'phone') phone = value;
      else if (target.kind === 'tags') {
        for (const t of value.split(/[;,]/)) {
          const tag = t.trim();
          if (tag && !tags.some((x) => x.toLowerCase() === tag.toLowerCase())) tags.push(tag);
        }
      } else attributes[target.key] = value;
    });
    if (!EMAIL_RE.test(email)) {
      skipped += 1;
      continue;
    }
    if (tags.length) attributes.tags = tags;
    rows.push({
      email: email.toLowerCase(),
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(Object.keys(attributes).length ? { attributes } : {}),
    });
  }
  return { rows, skipped };
}
