/**
 * Structural integrity: is this a well-formed, finished document?
 *
 * These rules run first and are the ones most likely to fire on
 * model-generated output — a dangling `childrenIds` entry or a leftover
 * `{{ACCENT}}` token is invisible in a thumbnail but fatal in an inbox.
 */
import { THRESHOLDS } from '../client-matrix.js';
import { BLOCK_TYPES, countWords, htmlToText } from '../model.js';
import type { Finding } from '../types.js';

import { excerpt, finding, listPhrase, type RuleContext } from './context.js';

/**
 * Strings that mean "nobody finished this". The editor's own empty-state
 * copy and the generator's substitution tokens both count: shipping either
 * is worse than shipping nothing, because it looks like a bug to the
 * recipient rather than an omission.
 */
const PLACEHOLDER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /double click to edit/i, label: "the editor's empty-state copy" },
  { pattern: /lorem ipsum/i, label: 'lorem ipsum filler' },
  { pattern: /\{\{\s*[A-Z_]+\s*\}\}/, label: 'an unsubstituted {{TOKEN}}' },
  { pattern: /REPLACE[- ]WITH/i, label: 'a REPLACE-WITH marker' },
  { pattern: /\byour (?:company|brand|business) name\b/i, label: 'a "Your Company Name" placeholder' },
  { pattern: /\blorem\b/i, label: 'lorem filler' },
  { pattern: /\bTODO\b/, label: 'a TODO marker' },
  { pattern: /\bxxx+\b/i, label: 'an xxx placeholder' },
];

export function structureRules(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const { doc, facts } = ctx;

  if (!doc.root) {
    out.push(
      finding({
        ruleId: 'structure/missing-root',
        severity: 'P0',
        dimension: 'structuralIntegrity',
        title: 'Document has no root block',
        detail: `No block is keyed \`${doc.rootId}\`.`,
        impact: 'Nothing renders. The template cannot be previewed, exported, or sent.',
        fix: `Add an \`EmailLayout\` block under the key \`${doc.rootId}\` and list the top-level sections in its \`childrenIds\`.`,
      }),
    );
    return out;
  }

  if (doc.root.type !== 'EmailLayout') {
    out.push(
      finding({
        ruleId: 'structure/root-wrong-type',
        severity: 'P0',
        dimension: 'structuralIntegrity',
        title: 'Root block is not an EmailLayout',
        detail: `The root is a \`${doc.root.type}\`.`,
        impact: 'The renderer expects EmailLayout at the root to produce the canvas; anything else renders unstyled or not at all.',
        fix: 'Change the root block type to `EmailLayout` and move the current root into its `childrenIds`.',
        blocks: [doc.rootId],
      }),
    );
  }

  if (doc.blocks.length === 0) {
    out.push(
      finding({
        ruleId: 'structure/empty-document',
        severity: 'P0',
        dimension: 'structuralIntegrity',
        title: 'Template is empty',
        detail: 'The root has no reachable children.',
        impact: 'The recipient receives a blank email.',
        fix: 'Add content blocks and reference them from the root `childrenIds`.',
        blocks: [doc.rootId],
      }),
    );
    return out;
  }

  if (doc.danglingRefs.length > 0) {
    const ids = doc.danglingRefs.map((r) => r.missingId);
    out.push(
      finding({
        ruleId: 'structure/dangling-reference',
        severity: 'P0',
        dimension: 'structuralIntegrity',
        title: `${ids.length} child reference${ids.length === 1 ? '' : 's'} point${ids.length === 1 ? 's' : ''} at a missing block`,
        detail: `Referenced but not present: ${listPhrase(ids.slice(0, 5).map((id) => `\`${id}\``))}${ids.length > 5 ? `, +${ids.length - 5} more` : ''}.`,
        impact: 'The renderer skips the missing children, so the email silently loses content between preview and send.',
        fix: 'Add the missing blocks, or remove the stale ids from the parent `childrenIds`.',
        blocks: doc.danglingRefs.map((r) => r.parentId),
        autoFixable: true,
      }),
    );
  }

  if (doc.duplicateRefs.length > 0) {
    out.push(
      finding({
        ruleId: 'structure/duplicate-reference',
        severity: 'P1',
        dimension: 'structuralIntegrity',
        title: 'A block is referenced by more than one parent',
        detail: `Reached more than once: ${listPhrase(doc.duplicateRefs.map((id) => `\`${id}\``))}.`,
        impact: 'Only the first occurrence renders, and editing the block changes it in every place it appears.',
        fix: 'Duplicate the block under a new id so each parent owns its own copy.',
        blocks: doc.duplicateRefs,
      }),
    );
  }

  if (doc.orphanIds.length > 0) {
    out.push(
      finding({
        ruleId: 'structure/orphan-blocks',
        severity: 'P1',
        dimension: 'structuralIntegrity',
        title: `${doc.orphanIds.length} block${doc.orphanIds.length === 1 ? '' : 's'} unreachable from the root`,
        detail: `Present in the document but never referenced: ${listPhrase(doc.orphanIds.slice(0, 5).map((id) => `\`${id}\``))}${doc.orphanIds.length > 5 ? `, +${doc.orphanIds.length - 5} more` : ''}.`,
        impact: 'The content was authored but will not render — usually a generation or drag-and-drop bug rather than an intentional draft.',
        fix: 'Reference the blocks from a parent `childrenIds`, or delete them.',
        blocks: doc.orphanIds,
        autoFixable: true,
      }),
    );
  }

  const unknown = doc.blocks.filter((b) => !BLOCK_TYPES.includes(b.type as never));
  if (unknown.length > 0) {
    const types = [...new Set(unknown.map((b) => b.type))];
    out.push(
      finding({
        ruleId: 'structure/unknown-block-type',
        severity: 'P1',
        dimension: 'structuralIntegrity',
        title: `Unsupported block type${types.length === 1 ? '' : 's'}: ${listPhrase(types)}`,
        detail: `${unknown.length} block${unknown.length === 1 ? '' : 's'} use a type outside the nine the renderer understands.`,
        impact: 'Unsupported blocks render as nothing, leaving a gap where content was intended.',
        fix: `Convert them to one of ${listPhrase([...BLOCK_TYPES])}.`,
        blocks: unknown,
      }),
    );
  }

  // Placeholder copy — check rich text and button labels together.
  const placeholderHits: { blockId: string; label: string; sample: string }[] = [];
  for (const { block, text } of facts.texts) {
    for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        placeholderHits.push({ blockId: block.id, label, sample: excerpt(text) });
        break;
      }
    }
  }
  for (const block of doc.blocks.filter((b) => b.type === 'Button')) {
    const label = typeof block.props.text === 'string' ? block.props.text : '';
    for (const { pattern, label: what } of PLACEHOLDER_PATTERNS) {
      if (pattern.test(label)) {
        placeholderHits.push({ blockId: block.id, label: what, sample: excerpt(label) });
        break;
      }
    }
  }
  if (placeholderHits.length > 0) {
    out.push(
      finding({
        ruleId: 'structure/placeholder-content',
        severity: 'P0',
        dimension: 'structuralIntegrity',
        title: `${placeholderHits.length} block${placeholderHits.length === 1 ? '' : 's'} still contain placeholder text`,
        detail: placeholderHits
          .slice(0, 3)
          .map((h) => `${h.label} — "${h.sample}"`)
          .join('; '),
        impact: 'Placeholder copy reaching an inbox reads as a broken send and costs more trust than the email earns.',
        fix: 'Replace every placeholder with real copy before sending.',
        blocks: placeholderHits.map((h) => h.blockId),
      }),
    );
  }

  const emptyText = facts.texts.filter((t) => countWords(t.text) === 0);
  if (emptyText.length > 0) {
    out.push(
      finding({
        ruleId: 'structure/empty-text-block',
        severity: 'P2',
        dimension: 'structuralIntegrity',
        title: `${emptyText.length} empty text block${emptyText.length === 1 ? '' : 's'}`,
        detail: 'These NotionText blocks contain no readable characters.',
        impact: 'They still contribute padding, so they open unexplained gaps in the vertical rhythm.',
        fix: 'Delete them, or replace them with a `Spacer` if the gap is intentional.',
        blocks: emptyText.map((t) => t.block.id),
        autoFixable: true,
      }),
    );
  }

  // Columns whose declared count disagrees with what is actually populated.
  for (const block of doc.blocks.filter((b) => b.type === 'ColumnsContainer')) {
    const declared = block.props.columnsCount === 3 ? 3 : 2;
    const columns = Array.isArray(block.props.columns) ? (block.props.columns as Record<string, unknown>[]) : [];
    const populated = columns
      .slice(0, declared)
      .filter((c) => Array.isArray(c?.childrenIds) && (c.childrenIds as unknown[]).length > 0).length;
    if (populated < declared) {
      out.push(
        finding({
          ruleId: 'structure/empty-column',
          severity: 'P2',
          dimension: 'structuralIntegrity',
          title: `Columns block declares ${declared} columns but only ${populated} contain content`,
          detail: `\`columnsCount\` is ${declared}; ${declared - populated} column${declared - populated === 1 ? ' is' : 's are'} empty.`,
          impact: 'Empty columns still consume horizontal space, pushing the real content into a narrower area than intended.',
          fix: `Either fill the empty column${declared - populated === 1 ? '' : 's'} or set \`columnsCount\` to ${populated || 2}.`,
          blocks: [block],
        }),
      );
    }
  }

  if (facts.metrics.blockCount < THRESHOLDS.minBlockCount) {
    out.push(
      finding({
        ruleId: 'structure/thin-template',
        severity: 'P2',
        dimension: 'structuralIntegrity',
        title: `Only ${facts.metrics.blockCount} blocks`,
        detail: `A finished template usually runs ${THRESHOLDS.minBlockCount}-${THRESHOLDS.maxBlockCount} blocks; this has ${facts.metrics.blockCount}.`,
        impact: 'The email is likely missing structure a recipient expects — a header, a closing, or a footer.',
        fix: 'Add the missing sections, or confirm this is intentionally a minimal transactional message.',
      }),
    );
  }

  if (facts.metrics.blockCount > THRESHOLDS.maxBlockCount) {
    out.push(
      finding({
        ruleId: 'structure/bloated-template',
        severity: 'P2',
        dimension: 'structuralIntegrity',
        title: `${facts.metrics.blockCount} blocks is unusually many`,
        detail: `Past roughly ${THRESHOLDS.maxBlockCount} blocks a template stops behaving like an email.`,
        impact: 'Long emails get clipped by Gmail, and the extra content dilutes the single action the email should drive.',
        fix: 'Split the content across a shorter email plus a landing page.',
      }),
    );
  }

  if (facts.metrics.maxNestingDepth > THRESHOLDS.maxNestingDepth) {
    const deepest = doc.blocks.reduce((a, b) => (b.depth > a.depth ? b : a), doc.blocks[0]);
    out.push(
      finding({
        ruleId: 'structure/excessive-nesting',
        severity: 'P2',
        dimension: 'structuralIntegrity',
        title: `Blocks nested ${facts.metrics.maxNestingDepth} levels deep`,
        detail: `Deepest path: ${deepest.path}.`,
        impact: 'Each level adds a wrapper table; deep nesting compounds rounding differences between clients and makes the layout fragile.',
        fix: 'Flatten redundant single-child containers.',
        blocks: [deepest],
      }),
    );
  }

  return out;
}

/** Exported for tests and for the generator's self-check. */
export function hasPlaceholderText(value: string): boolean {
  const text = htmlToText(value);
  return PLACEHOLDER_PATTERNS.some(({ pattern }) => pattern.test(text));
}
