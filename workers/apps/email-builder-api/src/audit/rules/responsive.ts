/**
 * Responsive behaviour on a phone.
 *
 * Most email is opened on a phone, so "does this survive 320-370px" is not an
 * edge case — it is the primary reading condition. These rules measure the
 * geometry the resolver computed rather than looking for breakpoints, because
 * an email's mobile layout is mostly decided by fixed widths, not media
 * queries.
 */
import { THRESHOLDS } from '../client-matrix.js';
import { columnWidths, MOBILE_WIDTH, type ResolvedBlock } from '../model.js';
import type { Finding } from '../types.js';

import { finding, round, type RuleContext } from './context.js';

export function responsiveRules(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const { doc, facts } = ctx;

  /* --- columns too narrow to hold text --------------------------------- */

  // Only columns that hold something needing width count. Narrow gutter
  // columns containing a spacer, a rule, or an icon are a deliberate and
  // very common layout device, and flagging them buries the real cases.
  const NEEDS_WIDTH = new Set(['NotionText', 'Button']);
  const narrow: { block: ResolvedBlock; width: number }[] = [];
  for (const block of doc.blocks.filter((b) => b.type === 'ColumnsContainer')) {
    const widths = columnWidths(block.props, block.contentWidth);
    const columns = Array.isArray(block.props.columns)
      ? (block.props.columns as Record<string, unknown>[])
      : [];
    widths.forEach((width, index) => {
      const column = columns[index];
      const childIds = Array.isArray(column?.childrenIds) ? (column.childrenIds as string[]) : [];
      const holdsText = childIds.some((id) => {
        const child = doc.byId.get(id);
        return child ? NEEDS_WIDTH.has(child.type) : false;
      });
      if (holdsText && width < THRESHOLDS.minColumnWidthPx) {
        narrow.push({ block, width });
      }
    });
  }
  if (narrow.length > 0) {
    const tightest = narrow.reduce((a, b) => (b.width < a.width ? b : a));
    out.push(
      finding({
        ruleId: 'responsive/column-too-narrow',
        severity: 'P1',
        dimension: 'responsive',
        title: `${narrow.length} column${narrow.length === 1 ? '' : 's'} narrower than ${THRESHOLDS.minColumnWidthPx}px`,
        detail: `Narrowest resolves to about ${Math.round(tightest.width)}px of content width on desktop.`,
        impact:
          'At that width a line of body copy holds two or three words, so text becomes a vertical ribbon that is painful to read.',
        fix: 'Widen the column, reduce the column count, or move the content to its own full-width row.',
        blocks: [...new Set(narrow.map((n) => n.block))],
      }),
    );
  }

  /* --- content that cannot fit a phone --------------------------------- */

  const overflowing = doc.blocks.filter((b) => {
    if (b.type !== 'Image') return false;
    const width = typeof b.props.width === 'number' ? b.props.width : 0;
    return width > MOBILE_WIDTH;
  });
  if (overflowing.length > 0) {
    const widest = Math.max(...overflowing.map((b) => Number(b.props.width)));
    out.push(
      finding({
        ruleId: 'responsive/image-wider-than-mobile',
        severity: 'P1',
        dimension: 'responsive',
        title: `${overflowing.length} image${overflowing.length === 1 ? '' : 's'} are fixed wider than the mobile canvas`,
        detail: `Widest is ${widest}px against a ${MOBILE_WIDTH}px mobile canvas.`,
        impact:
          'A fixed image wider than the canvas forces horizontal scrolling, and in several clients it stretches the whole layout to match.',
        fix: `Set the image to fill its column instead of a fixed pixel width, or cap the width at ${MOBILE_WIDTH}px.`,
        blocks: overflowing,
      }),
    );
  }

  const wideBlocks = doc.blocks.filter((b) => {
    if (b.type === 'Image') return false;
    const explicit = typeof b.style.width === 'number' ? b.style.width : 0;
    return explicit > MOBILE_WIDTH;
  });
  if (wideBlocks.length > 0) {
    out.push(
      finding({
        ruleId: 'responsive/fixed-width-exceeds-mobile',
        severity: 'P2',
        dimension: 'responsive',
        title: `${wideBlocks.length} block${wideBlocks.length === 1 ? '' : 's'} set a fixed width wider than the mobile canvas`,
        detail: `These declare a width above ${MOBILE_WIDTH}px.`,
        impact:
          'Fixed widths do not shrink, so they overflow the canvas and can introduce a horizontal scrollbar.',
        fix: 'Express the width as a percentage, or remove it and let the container size the block.',
        blocks: wideBlocks,
      }),
    );
  }

  /* --- padding that eats the phone screen ------------------------------ */

  const heavyPadding = doc.blocks.filter((b) => {
    const horizontal = b.padding.left + b.padding.right;
    // Anything past a third of the mobile canvas is more gutter than content.
    return horizontal > MOBILE_WIDTH / 3 && b.mobileContentWidth > 0;
  });
  if (heavyPadding.length > 0) {
    const worst = heavyPadding.reduce((a, b) =>
      b.padding.left + b.padding.right > a.padding.left + a.padding.right ? b : a,
    );
    out.push(
      finding({
        ruleId: 'responsive/padding-crowds-mobile',
        severity: 'P2',
        dimension: 'responsive',
        title: `${heavyPadding.length} block${heavyPadding.length === 1 ? '' : 's'} keep desktop side padding on mobile`,
        detail: `Heaviest is ${worst.padding.left + worst.padding.right}px of horizontal padding, leaving about ${Math.round(worst.mobileContentWidth)}px of the ${MOBILE_WIDTH}px mobile canvas for content.`,
        impact:
          'Generous gutters that look composed at 600px squeeze the readable column to a sliver on a phone.',
        fix: 'Set `style.mobilePadding` with tighter side values — 16-24px is usually enough.',
        blocks: heavyPadding,
        autoFixable: true,
      }),
    );
  }

  /* --- line length ------------------------------------------------------ */

  const longLines = facts.texts.filter(({ block, text }) => {
    if (text.length < 120) return false;
    const chars = block.contentWidth / (block.fontSize * 0.5);
    return chars > THRESHOLDS.maxLineLengthChars;
  });
  if (longLines.length > 0) {
    const worst = longLines.reduce((a, b) =>
      b.block.contentWidth / (b.block.fontSize * 0.5) >
      a.block.contentWidth / (a.block.fontSize * 0.5)
        ? b
        : a,
    );
    const chars = Math.round(worst.block.contentWidth / (worst.block.fontSize * 0.5));
    out.push(
      finding({
        ruleId: 'responsive/line-length-long',
        severity: 'P3',
        dimension: 'typography',
        title: `Body copy runs to about ${chars} characters per line`,
        detail: `${longLines.length} block${longLines.length === 1 ? '' : 's'} exceed the ${THRESHOLDS.maxLineLengthChars}-character comfort limit at ${round(worst.block.fontSize)}px in a ${Math.round(worst.block.contentWidth)}px column.`,
        impact:
          'Long measures make it harder to find the start of the next line, so readers lose their place and skim instead.',
        fix: 'Raise the font size or add horizontal padding to bring the measure toward 50-75 characters.',
        blocks: longLines.map((t) => t.block),
      }),
    );
  }

  return out;
}
