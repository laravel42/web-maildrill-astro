/**
 * Receipt PDFs, written by hand.
 *
 * No dependency: a one-page receipt needs text, rules and a table, all of
 * which PDF gives you directly, and the base-14 fonts (Helvetica here) are
 * guaranteed present in every reader with no embedding. Adding pdfkit or
 * puppeteer to render a page this simple would pull a rendering engine — or a
 * whole browser — into the API image to lay out thirty lines of text.
 *
 * The trade is that offsets are our problem: a PDF's trailer points at a
 * cross-reference table of byte offsets, and if one is wrong the file opens
 * blank rather than erroring. `buildPdf` therefore measures the objects it has
 * actually serialised instead of predicting where they will land.
 */

/** Placeholder issuer details — replace with the real entity before going live. */
export const ISSUER = {
  name: 'Maildrill',
  legalName: 'Maildrill Ltd. (placeholder)',
  addressLines: ['123 Example Street', '00000 Placeholder City', 'Country'],
  vatId: 'VAT000000000 (placeholder)',
  email: 'billing@maildrill.net',
} as const;

export interface ReceiptInput {
  /** Human receipt number, e.g. `MD-2026-0007`. */
  number: string;
  issuedAt: Date;
  workspaceName: string;
  /** Buyer details. Placeholder until workspaces carry billing addresses. */
  billTo: string[];
  currency: string;
  lines: Array<{ description: string; amount: number }>;
  total: number;
  /** Printed under the total — e.g. what the credit has been spent on. */
  notes?: string[];
}

// --- PDF primitives --------------------------------------------------------

/**
 * Typographic characters that Latin-1 lacks but WinAnsiEncoding provides in
 * the 0x80-0x9F range. Without this table an em dash is simply dropped, and
 * `Prepaid credit — purchase` prints as `Prepaid credit  purchase` with a
 * double space where the punctuation was — which is exactly what the first
 * generated receipt did.
 */
const WIN_ANSI: Record<string, string> = {
  '\u20AC': '\x80', // euro
  '\u201A': '\x82',
  '\u2013': '\x96', // en dash
  '\u2014': '\x97', // em dash
  '\u2018': '\x91',
  '\u2019': '\x92', // curly apostrophe
  '\u201C': '\x93',
  '\u201D': '\x94',
  '\u2022': '\x95', // bullet
  '\u2026': '\x85', // ellipsis
};

/**
 * Escape for a PDF literal string: backslash and both parens are delimiters.
 *
 * Runs the WinAnsi table first, then drops anything still outside the
 * encoding. Dropping is deliberate for the remainder — a receipt missing a
 * glyph is legible, a mojibake one is not — but the characters this codebase
 * actually writes (em dashes in every description, curly apostrophes in
 * campaign names) are translated rather than lost.
 */
function pdfString(text: string): string {
  return text
    .replace(/[\u20AC\u201A\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,
      (c) => WIN_ANSI[c] ?? '')
    .replace(/[\\()]/g, (c) => `\\${c}`)
    .replace(/[^\x20-\x7E\x80-\xFF]/g, '');
}

type Font = 'F1' | 'F2';

class Page {
  private ops: string[] = [];

  text(x: number, y: number, size: number, font: Font, value: string): void {
    this.ops.push(
      `BT /${font} ${size} Tf ${x} ${y} Td (${pdfString(value)}) Tj ET`,
    );
  }

  /** Right-aligned at `x`. Helvetica widths are ~0.5em averaged over digits and
   *  currency glyphs, which is exact enough for a money column that only ever
   *  holds digits, separators and a currency symbol. */
  textRight(x: number, y: number, size: number, font: Font, value: string): void {
    const width = value.length * size * 0.5;
    this.text(x - width, y, size, font, value);
  }

  rule(x1: number, y: number, x2: number, gray = 0.8): void {
    this.ops.push(`q ${gray} G 0.5 w ${x1} ${y} m ${x2} ${y} l S Q`);
  }

  build(): string {
    return this.ops.join('\n');
  }
}

/**
 * Assemble numbered objects into a valid PDF.
 *
 * Offsets are captured as each object is appended, so the xref table describes
 * the bytes that exist rather than the bytes we intended to write.
 */
function buildPdf(objects: string[]): Buffer {
  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [];
  let position = chunks[0]!.length;

  objects.forEach((body, i) => {
    offsets.push(position);
    const obj = `${i + 1} 0 obj\n${body}\nendobj\n`;
    chunks.push(obj);
    position += Buffer.byteLength(obj, 'latin1');
  });

  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(xref);

  return Buffer.from(chunks.join(''), 'latin1');
}

function money(amount: number, currency: string): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

// --- Receipt ---------------------------------------------------------------

/** A4 in points. */
const WIDTH = 595;
const HEIGHT = 842;
const MARGIN = 56;
const RIGHT = WIDTH - MARGIN;

export function renderReceiptPdf(input: ReceiptInput): Buffer {
  const page = new Page();
  let y = HEIGHT - MARGIN;

  page.text(MARGIN, y, 20, 'F2', ISSUER.name);
  page.textRight(RIGHT, y, 20, 'F2', 'Receipt');
  y -= 14;
  page.textRight(RIGHT, y, 9, 'F1', input.number);
  y -= 26;
  page.rule(MARGIN, y, RIGHT);
  y -= 26;

  // Issuer (left) and buyer (right), top-aligned on the same baseline.
  const blockTop = y;
  page.text(MARGIN, y, 8, 'F1', 'FROM');
  let leftY = y - 14;
  page.text(MARGIN, leftY, 10, 'F2', ISSUER.legalName);
  for (const line of [...ISSUER.addressLines, ISSUER.vatId, ISSUER.email]) {
    leftY -= 12;
    page.text(MARGIN, leftY, 9, 'F1', line);
  }

  const midpoint = MARGIN + 250;
  page.text(midpoint, blockTop, 8, 'F1', 'BILL TO');
  let rightY = blockTop - 14;
  page.text(midpoint, rightY, 10, 'F2', input.workspaceName);
  for (const line of input.billTo) {
    rightY -= 12;
    page.text(midpoint, rightY, 9, 'F1', line);
  }

  y = Math.min(leftY, rightY) - 30;
  page.text(MARGIN, y, 9, 'F1', `Issued ${input.issuedAt.toISOString().slice(0, 10)}`);
  y -= 26;

  // Line items.
  page.rule(MARGIN, y, RIGHT);
  y -= 14;
  page.text(MARGIN, y, 8, 'F1', 'DESCRIPTION');
  page.textRight(RIGHT, y, 8, 'F1', 'AMOUNT');
  y -= 8;
  page.rule(MARGIN, y, RIGHT);
  y -= 18;

  for (const line of input.lines) {
    page.text(MARGIN, y, 10, 'F1', line.description);
    page.textRight(RIGHT, y, 10, 'F1', money(line.amount, input.currency));
    y -= 18;
  }

  y -= 4;
  page.rule(MARGIN, y, RIGHT);
  y -= 20;
  page.text(MARGIN, y, 11, 'F2', 'Total');
  page.textRight(RIGHT, y, 11, 'F2', money(input.total, input.currency));

  if (input.notes?.length) {
    y -= 34;
    page.text(MARGIN, y, 8, 'F1', 'NOTES');
    for (const note of input.notes) {
      y -= 13;
      page.text(MARGIN, y, 9, 'F1', note);
    }
  }

  page.text(
    MARGIN,
    MARGIN,
    8,
    'F1',
    'Prepaid credit. Amounts shown in the currency of the original purchase.',
  );

  const content = page.build();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] ` +
      `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  return buildPdf(objects);
}

/**
 * Stable, human-quotable receipt number: year of purchase plus a short slice of
 * the recharge id. Derived rather than sequential on purpose — a counter would
 * need its own locked table, and gaps in a sequence read as lost invoices.
 */
export function receiptNumber(id: string, issuedAt: Date): string {
  return `MD-${issuedAt.getUTCFullYear()}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
