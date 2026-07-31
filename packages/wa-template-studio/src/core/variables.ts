import type { TemplateDoc } from './types';

/**
 * Variable engine — everything about {{n}} placeholders: extraction,
 * per-variable metadata (name + example), analysis (unused/duplicated/
 * invalid/non-sequential), renumbering and example payload generation.
 *
 * Variable metadata lives on the doc's body/header data via the
 * `VariableMap` shape (keyed by number as string, so it survives JSON
 * round-trips), owned by whichever block declares variables.
 */

export const VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** Anything brace-like that is NOT a valid {{n}} — flagged invalid. */
export const MALFORMED_VARIABLE_RE = /\{\{(?!\s*\d+\s*\}\})[^}]*\}\}|\{(?!\{)[^{}]*\}(?!\})/g;

export interface VariableMeta {
  /** Friendly label, e.g. "Customer name". */
  name?: string;
  /** Example value required by Meta review. */
  example?: string;
  /** Merge tag for send-time mapping, e.g. `{{name}}` or `{{attributes.company}}`. */
  source?: string;
}

/** Keyed by variable number as a string ('1', '2', …). */
export type VariableMap = Record<string, VariableMeta>;

/** Ordered occurrences of {{n}} in a text (duplicates preserved). */
export function extractVariables(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(VARIABLE_RE)) out.push(Number(m[1]));
  return out;
}

/** Unique variable numbers, ascending. */
export function uniqueVariables(text: string): number[] {
  return [...new Set(extractVariables(text))].sort((a, b) => a - b);
}

export interface VariableAnalysis {
  /** Unique numbers used, ascending. */
  used: number[];
  /** Numbers used more than once (legal but highlighted). */
  duplicated: number[];
  /** True when used numbers are exactly 1..n with no gaps. */
  sequential: boolean;
  /** Declared in the VariableMap but absent from the text. */
  unused: number[];
  /** Malformed brace syntax snippets, e.g. '{{name}}' or '{1}'. */
  malformed: string[];
}

export function analyzeVariables(text: string, map: VariableMap = {}): VariableAnalysis {
  const all = extractVariables(text);
  const used = [...new Set(all)].sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const n of all) counts.set(n, (counts.get(n) ?? 0) + 1);

  return {
    used,
    duplicated: [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n),
    sequential: used.every((n, i) => n === i + 1),
    unused: Object.keys(map)
      .map(Number)
      .filter((n) => !used.includes(n))
      .sort((a, b) => a - b),
    malformed: [...text.matchAll(MALFORMED_VARIABLE_RE)].map((m) => m[0]),
  };
}

/**
 * Renumber variables so they become sequential 1..n in order of first
 * appearance, remapping the metadata map alongside. Returns the new
 * text + map + the applied mapping (old → new).
 */
export function renumberVariables(
  text: string,
  map: VariableMap = {},
): { text: string; map: VariableMap; mapping: Record<number, number> } {
  const order: number[] = [];
  for (const n of extractVariables(text)) {
    if (!order.includes(n)) order.push(n);
  }
  const mapping: Record<number, number> = {};
  order.forEach((n, i) => {
    mapping[n] = i + 1;
  });

  const nextText = text.replace(VARIABLE_RE, (_m, d: string) => {
    const mapped = mapping[Number(d)];
    return mapped ? `{{${mapped}}}` : `{{${d}}}`;
  });

  const nextMap: VariableMap = {};
  for (const [k, v] of Object.entries(map)) {
    const mapped = mapping[Number(k)];
    if (mapped) nextMap[String(mapped)] = v;
  }

  return { text: nextText, map: nextMap, mapping };
}

/** Substitute example values into a text for preview rendering. */
export function substituteExamples(text: string, resolve: (n: number) => string): string {
  return text.replace(VARIABLE_RE, (m, d: string) => {
    const value = resolve(Number(d));
    return value || m;
  });
}

/** Meta `example.body_text` payload row for a text's variables. */
export function exampleRow(text: string, map: VariableMap): string[] {
  return uniqueVariables(text).map((n) => map[String(n)]?.example ?? `Sample ${n}`);
}

/** The next free variable number for an "insert variable" affordance. */
export function nextVariableNumber(text: string): number {
  const used = uniqueVariables(text);
  return used.length > 0 ? Math.max(...used) + 1 : 1;
}

/**
 * Insert a brand-new variable into `text` at the caret (or replacing the
 * selection `[start, end)`), then renumber every placeholder so the series
 * stays sequential 1..n in order of appearance. The inserted placeholder
 * therefore takes the number matching its position (e.g. inserting between
 * {{1}} and {{2}} yields a new {{2}} and pushes the old one to {{3}}).
 *
 * Returns the new text, the remapped metadata map (examples/labels follow
 * their variable), and the caret index just after the inserted placeholder so
 * the editor can keep typing inline.
 */
export function insertVariableAt(
  text: string,
  map: VariableMap = {},
  start: number = text.length,
  end: number = start,
): { text: string; map: VariableMap; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(end);
  // A guaranteed-unique temporary number keeps the inserted placeholder a
  // distinct variable (never merged with an existing duplicate) until the
  // renumber pass assigns its final, position-based number.
  const tempNum = nextVariableNumber(text);
  const {
    text: nextText,
    map: nextMap,
    mapping,
  } = renumberVariables(`${before}{{${tempNum}}}${after}`, map);
  // The renumber only rewrites {{n}} digit runs, so applying the same mapping
  // to the prefix alone gives its post-renumber length — hence the caret.
  const remappedBefore = before.replace(VARIABLE_RE, (_m, d: string) => {
    const mapped = mapping[Number(d)];
    return mapped ? `{{${mapped}}}` : `{{${d}}}`;
  });
  const caret = remappedBefore.length + `{{${mapping[tempNum] ?? tempNum}}}`.length;
  return { text: nextText, map: nextMap, caret };
}

/**
 * Example JSON payload (what a send-time API call would look like) for
 * the whole doc — shown in the variables panel.
 */
export function examplePayload(doc: TemplateDoc): Record<string, unknown> {
  const body = doc.blocks.body.data as { text?: string; variables?: VariableMap };
  const bodyVars = uniqueVariables(body.text ?? '');
  const parameters = bodyVars.map((n) => ({
    type: 'text',
    text: (body.variables ?? {})[String(n)]?.example ?? `Sample ${n}`,
  }));

  return {
    messaging_product: 'whatsapp',
    to: '{{recipient}}',
    type: 'template',
    template: {
      name: doc.name || 'template_name',
      language: { code: doc.language },
      ...(parameters.length > 0 ? { components: [{ type: 'body', parameters }] } : {}),
    },
  };
}
