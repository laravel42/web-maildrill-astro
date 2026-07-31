/**
 * Design quality — the part a machine can actually measure.
 *
 * These rules deliberately stop short of taste. They count, compare, and
 * measure: how far the largest type is from the smallest, whether the accent
 * colour appears anywhere, how many distinct paddings are in play. Judgement
 * — whether the tone fits the audience, whether the composition has a point
 * of view — is the LLM reviewer's job, layered on top in `critique.ts`.
 *
 * Keeping the split honest matters. A number that is really an opinion
 * ("hierarchy: 2/4") is worse than no number, because it cannot be argued
 * with. Everything scored here cites the measurement behind it.
 */
import { THRESHOLDS } from '../client-matrix.js';
import { buttonColors, buttonText, countWords, extractHeadingLevels, type ResolvedBlock } from '../model.js';
import type { Finding } from '../types.js';

import { excerpt, finding, listPhrase, round, type RuleContext } from './context.js';

/** Near-grey: the channels sit within a few points of each other. */
function isGreyscale(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= 12;
}

/** Padding values that read as a deliberate scale rather than ad-hoc numbers. */
const SPACING_SCALE = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 96]);

export function designRules(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const { doc, facts } = ctx;
  const { metrics } = facts;

  const buttons = doc.blocks.filter((b) => b.type === 'Button');
  const images = doc.blocks.filter((b) => b.type === 'Image');

  /* --- hierarchy --------------------------------------------------------- */

  const sizes = metrics.fontSizes.filter((s) => s > 0);
  if (sizes.length >= 2) {
    const largest = Math.max(...sizes);
    const body = sizes.length > 2 ? sizes[Math.floor(sizes.length / 2)] : Math.min(...sizes);
    const ratio = largest / body;
    if (ratio < 1.5) {
      out.push(
        finding({
          ruleId: 'design/flat-type-scale',
          severity: 'P2',
          dimension: 'hierarchy',
          title: `Type scale is flat — largest text is only ${round(ratio, 1)}× the body size`,
          detail: `Sizes in use: ${sizes.join(', ')}px.`,
          impact:
            'With nothing clearly dominant the reader has no entry point and has to read from the top to work out what the email is about.',
          fix: 'Push the headline to at least 1.8× the body size. A 16px body wants a 28-32px headline.',
        }),
      );
    }
  } else if (sizes.length <= 1 && metrics.wordCount > 60) {
    out.push(
      finding({
        ruleId: 'design/single-type-size',
        severity: 'P2',
        dimension: 'hierarchy',
        title: 'Every text block renders at the same size',
        detail: `${metrics.wordCount} words at a single size.`,
        impact: 'Undifferentiated text gives the eye nowhere to land, so the email reads as a document rather than a message.',
        fix: 'Introduce a headline and subheading size so the structure is visible before it is read.',
      }),
    );
  }

  /* --- typography -------------------------------------------------------- */

  if (metrics.fontFamilies.length > THRESHOLDS.maxFontFamilies) {
    out.push(
      finding({
        ruleId: 'design/too-many-fonts',
        severity: 'P2',
        dimension: 'typography',
        title: `${metrics.fontFamilies.length} font families in one email`,
        detail: `In use: ${listPhrase(metrics.fontFamilies)}.`,
        impact: 'Past two or three families the typography stops reading as a system and starts reading as an accident.',
        fix: 'Reduce to one family for body copy plus at most one display face for headlines.',
      }),
    );
  }

  if (metrics.fontSizes.length > THRESHOLDS.maxFontSizes) {
    out.push(
      finding({
        ruleId: 'design/too-many-type-sizes',
        severity: 'P3',
        dimension: 'typography',
        title: `${metrics.fontSizes.length} distinct type sizes`,
        detail: `Sizes: ${metrics.fontSizes.join(', ')}px.`,
        impact: 'Sizes that differ by one or two pixels look like mistakes rather than levels, and blur the hierarchy they were meant to create.',
        fix: `Collapse to a scale of four or five steps — for example 14, 16, 20, 28, 36.`,
      }),
    );
  }

  /* --- colour ------------------------------------------------------------- */

  const palette = [...facts.colors];
  if (palette.length > THRESHOLDS.maxPaletteSize) {
    out.push(
      finding({
        ruleId: 'design/palette-sprawl',
        severity: 'P2',
        dimension: 'color',
        title: `${palette.length} distinct colours`,
        detail: `Including ${listPhrase(palette.slice(0, 6))}${palette.length > 6 ? `, +${palette.length - 6} more` : ''}.`,
        impact: 'A sprawling palette dilutes the accent colour, so nothing reads as the thing to click.',
        fix: `Cut to a background, two text tones, and one accent — about ${THRESHOLDS.maxPaletteSize} values total.`,
      }),
    );
  }

  const chromatic = palette.filter((c) => !isGreyscale(c));
  if (palette.length > 0 && chromatic.length === 0) {
    out.push(
      finding({
        ruleId: 'design/no-accent-colour',
        severity: 'P2',
        dimension: 'color',
        title: 'The palette is entirely greyscale',
        detail: `All ${palette.length} colours in use are neutral.`,
        impact:
          'Without a single saturated accent the call to action has no visual priority, and the email reads as a system notification rather than something from a brand.',
        fix: 'Introduce one brand colour and spend it only on the primary action.',
      }),
    );
  }

  /* --- spacing ------------------------------------------------------------ */

  const paddings = new Set<number>();
  for (const block of doc.blocks) {
    paddings.add(block.padding.top);
    paddings.add(block.padding.bottom);
    paddings.add(block.padding.left);
    paddings.add(block.padding.right);
  }
  const offScale = [...paddings].filter((p) => !SPACING_SCALE.has(p));
  // A handful of bespoke values is normal — a design is not a spreadsheet.
  // The signal is when off-scale values *dominate*, which is what happens
  // when spacing was transcribed piecemeal rather than designed as a system.
  const offScaleShare = paddings.size > 0 ? offScale.length / paddings.size : 0;
  if (offScale.length > 6 && offScaleShare > 0.5) {
    out.push(
      finding({
        ruleId: 'design/spacing-off-scale',
        severity: 'P3',
        dimension: 'spacing',
        title: `${offScale.length} of ${paddings.size} padding values sit outside a regular spacing scale`,
        detail: `For example ${listPhrase(offScale.slice(0, 6).map((p) => `${p}px`))}.`,
        impact: 'Irregular spacing is felt before it is noticed — the layout reads as slightly unresolved without an obvious cause.',
        fix: 'Snap padding to a 4px or 8px scale so the vertical rhythm repeats.',
      }),
    );
  }

  /* --- imagery ------------------------------------------------------------- */

  if (images.length === 0 && metrics.wordCount > 150) {
    out.push(
      finding({
        ruleId: 'design/no-imagery',
        severity: 'P3',
        dimension: 'imagery',
        title: 'No imagery in a long email',
        detail: `${metrics.wordCount} words with no images.`,
        impact: 'An unbroken column of text is harder to enter and easier to abandon than one with a visual anchor.',
        fix: 'Add one strong image near the top, or use colour blocks and rules to break the column.',
      }),
    );
  }

  /* --- calls to action ------------------------------------------------------ */

  if (buttons.length === 0) {
    const textLinks = facts.links.filter((l) => l.kind === 'text' && l.href);
    out.push(
      finding({
        ruleId: 'design/no-call-to-action',
        severity: textLinks.length > 0 ? 'P2' : 'P1',
        dimension: 'ctaClarity',
        title: 'No button-styled call to action',
        detail:
          textLinks.length > 0
            ? `The email has ${textLinks.length} text link${textLinks.length === 1 ? '' : 's'} but no button.`
            : 'The email has no buttons and no text links.',
        impact:
          'A text link inside a paragraph competes with the paragraph. Without a button there is no unmistakable next step, and click-through drops sharply.',
        fix: 'Add one `Button` with the primary action, placed where the reader finishes the argument for taking it.',
      }),
    );
  } else if (buttons.length > THRESHOLDS.maxPrimaryCtas) {
    out.push(
      finding({
        ruleId: 'design/competing-ctas',
        severity: 'P2',
        dimension: 'ctaClarity',
        title: `${buttons.length} buttons compete for the click`,
        detail: `Labels: ${listPhrase(buttons.slice(0, 5).map((b) => `"${excerpt(buttonText(b), 24)}"`))}${buttons.length > 5 ? `, +${buttons.length - 5} more` : ''}.`,
        impact: 'Every additional equally-weighted action splits attention and lowers the total number of clicks, not just the share each one gets.',
        fix: `Choose one primary action, style the rest as text links, or repeat the same action rather than offering different ones.`,
        blocks: buttons,
      }),
    );
  }

  // A CTA the reader has to scroll a long way to reach.
  if (buttons.length > 0) {
    let offset = 0;
    let firstButtonOffset: number | null = null;
    for (const block of doc.blocks) {
      if (block.parentId !== doc.rootId) continue;
      if (firstButtonOffset === null && containsButton(block, doc.byId)) {
        firstButtonOffset = offset;
      }
      offset += block.estimatedHeight;
    }
    if (firstButtonOffset !== null && firstButtonOffset > 1400) {
      out.push(
        finding({
          ruleId: 'design/cta-far-down',
          severity: 'P2',
          dimension: 'ctaClarity',
          title: `First call to action sits about ${Math.round(firstButtonOffset)}px down`,
          detail: `That is roughly ${Math.max(2, Math.round(firstButtonOffset / 650))} phone screens of scrolling before any button appears.`,
          impact: 'Readers who are already convinced have nothing to click, and most will not scroll to find it.',
          fix: 'Place a button within the first screen, and repeat it at the end for readers who need the full argument.',
          blocks: buttons.slice(0, 1),
        }),
      );
    }
  }

  /* --- content --------------------------------------------------------------- */

  const walls = facts.texts.filter((t) => countWords(t.text) > 120);
  if (walls.length > 0) {
    const worst = walls.reduce((a, b) => (countWords(b.text) > countWords(a.text) ? b : a));
    out.push(
      finding({
        ruleId: 'design/wall-of-text',
        severity: 'P2',
        dimension: 'content',
        title: `${walls.length} text block${walls.length === 1 ? '' : 's'} run past 120 words`,
        detail: `Longest holds ${countWords(worst.text)} words: "${excerpt(worst.text, 60)}"`,
        impact: 'Email is scanned, not read. A dense block is skipped whole, taking whatever it contained with it.',
        fix: 'Break into shorter paragraphs with subheadings, or move the detail to a linked page.',
        blocks: walls.map((t) => t.block),
      }),
    );
  }

  if (metrics.readingTimeSeconds > 180) {
    out.push(
      finding({
        ruleId: 'design/long-read',
        severity: 'P3',
        dimension: 'content',
        title: `About ${Math.round(metrics.readingTimeSeconds / 60)} minutes of reading`,
        detail: `${metrics.wordCount} words.`,
        impact: 'Well past the point where an email holds attention; the ending — usually where the action lives — is rarely reached.',
        fix: 'Cut to the single message this send has to land, and link out for the rest.',
      }),
    );
  }

  /* --- scanability -------------------------------------------------------------- */

  const headingCount = facts.texts.reduce((sum, t) => sum + extractHeadingLevels(t.html).length, 0);
  if (metrics.wordCount > 200 && headingCount < 2) {
    out.push(
      finding({
        ruleId: 'design/no-subheadings',
        severity: 'P2',
        dimension: 'scanability',
        title: 'A long email with almost no subheadings',
        detail: `${metrics.wordCount} words and ${headingCount} heading${headingCount === 1 ? '' : 's'}.`,
        impact: 'Subheadings are what make an email skimmable; without them a reader deciding whether to engage has no summary to skim.',
        fix: 'Add a subheading every two or three paragraphs, each stating its section\'s point rather than labelling it.',
      }),
    );
  }

  const separators = doc.blocks.filter((b) => b.type === 'Divider' || b.type === 'Spacer').length;
  const containers = doc.blocks.filter((b) => b.type === 'Container').length;
  if (metrics.estimatedHeightPx > 2000 && separators + containers < 3) {
    out.push(
      finding({
        ruleId: 'design/no-section-breaks',
        severity: 'P2',
        dimension: 'scanability',
        title: 'Long email with no visible section breaks',
        detail: `About ${Math.round(metrics.estimatedHeightPx)}px tall with only ${separators + containers} structural separator${separators + containers === 1 ? '' : 's'}.`,
        impact: 'Continuous content gives no sense of progress or of how much is left, which pushes readers to abandon early.',
        fix: 'Group related content into `Container` sections with distinct backgrounds, or separate them with dividers.',
      }),
    );
  }

  /* --- consistency ---------------------------------------------------------------- */

  if (buttons.length > 1) {
    const signatures = new Set(
      buttons.map((b) => {
        const { background, text } = buttonColors(b);
        return `${background ?? '-'}|${text ?? '-'}|${JSON.stringify(b.style.shape ?? null)}|${b.style.fontSize ?? '-'}`;
      }),
    );
    if (signatures.size > 2) {
      out.push(
        finding({
          ruleId: 'design/inconsistent-buttons',
          severity: 'P2',
          dimension: 'consistency',
          title: `${signatures.size} different button styles across ${buttons.length} buttons`,
          detail: 'Buttons differ in fill, label colour, shape, or size.',
          impact:
            'Inconsistent buttons stop reading as a system, so the reader cannot tell which action is primary from styling alone.',
          fix: 'Use one primary style and, at most, one secondary style.',
          blocks: buttons,
        }),
      );
    }
  }

  const alignments = new Set(
    facts.texts.map((t) => (typeof t.block.style.textAlign === 'string' ? t.block.style.textAlign : 'left')),
  );
  if (alignments.size > 2 && facts.texts.length > 3) {
    out.push(
      finding({
        ruleId: 'design/mixed-text-alignment',
        severity: 'P3',
        dimension: 'consistency',
        title: `Text alignment switches between ${listPhrase([...alignments])}`,
        detail: `Across ${facts.texts.length} text blocks.`,
        impact: 'Shifting alignment breaks the left edge the eye follows down the page.',
        fix: 'Pick one alignment for body copy and reserve the other for short, deliberate moments such as a centred headline.',
      }),
    );
  }

  /* --- brand specificity ------------------------------------------------------------ */

  const usesDefaultFont = metrics.fontFamilies.length === 0 || metrics.fontFamilies.every((f) => f === 'MODERN_SANS' || f === 'INHERIT');
  if (chromatic.length === 0 && usesDefaultFont && metrics.blockCount > 6) {
    out.push(
      finding({
        ruleId: 'design/category-interchangeable',
        severity: 'P2',
        dimension: 'brandSpecificity',
        title: 'Nothing in the design identifies the sender',
        detail: 'The palette is entirely neutral and the typography is the default system stack.',
        impact:
          'The email could have come from any company. Recipients recognise a sender by look before they read the name, and this forfeits that recognition.',
        fix: 'Commit to a brand colour and a typeface, and apply them to the headline and the primary action at minimum.',
      }),
    );
  }

  return out;
}

/** Whether a subtree contains a button, used to locate the first CTA. */
function containsButton(block: ResolvedBlock, byId: Map<string, ResolvedBlock>): boolean {
  if (block.type === 'Button') return true;
  const childIds: string[] = [];
  if (Array.isArray(block.props.childrenIds)) childIds.push(...(block.props.childrenIds as string[]));
  if (Array.isArray(block.props.columns)) {
    for (const column of block.props.columns as Record<string, unknown>[]) {
      if (Array.isArray(column?.childrenIds)) childIds.push(...(column.childrenIds as string[]));
    }
  }
  return childIds.some((id) => {
    const child = byId.get(id);
    return child ? containsButton(child, byId) : false;
  });
}
