/**
 * Accessibility: can everyone actually read and act on this email?
 *
 * Email accessibility is narrower than web accessibility — there is no focus
 * management, no live regions, no keyboard traps — but the parts that do
 * apply matter more, because a recipient cannot zoom a broken layout back
 * into readability the way they can on a page they chose to visit.
 */
import { THRESHOLDS } from '../client-matrix.js';
import {
  buttonColors,
  buttonText,
  countWords,
  extractHeadingLevels,
  extractInlineColors,
  extractInlineFontSizes,
  isHex,
  type ResolvedBlock,
} from '../model.js';
import type { Finding } from '../types.js';

import { contrastRequirement, excerpt, finding, listPhrase, round, safeContrast, type RuleContext } from './context.js';

/**
 * Link text that tells a screen-reader user nothing when read out of
 * context. Screen readers can list every link in a message; "click here"
 * three times is a dead end.
 */
const VAGUE_LINK_TEXT = /^(?:click here|here|read more|learn more|more|this|link|details|go|tap here|find out more)$/i;

/** Alt text that is really a filename or URL, which is worse than none. */
const FILENAME_ALT = /^(?:https?:\/\/|\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?|$)|img[\s_-]?\d*$|image[\s_-]?\d*$|untitled)/i;

/** Button labels that describe the widget rather than the outcome. */
const GENERIC_BUTTON_TEXT = /^(?:submit|click here|click|here|button|go|ok|next|continue|learn more|read more)$/i;

function isBold(block: ResolvedBlock): boolean {
  return block.style.fontWeight === 'bold';
}

export function accessibilityRules(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const { doc, facts } = ctx;

  /* --- contrast: body copy ------------------------------------------- */

  type ContrastMiss = { block: ResolvedBlock; ratio: number; required: number; fg: string; bg: string };
  const textMisses: ContrastMiss[] = [];

  for (const { block, html, text } of facts.texts) {
    if (!text) continue;
    const background = block.background;
    // The block colour plus any inline overrides; each is read against the
    // same background, so each has to clear the threshold independently.
    const candidates = new Set<string>();
    candidates.add(block.textColor);
    for (const c of extractInlineColors(html)) candidates.add(c);

    const inlineSizes = extractInlineFontSizes(html);
    const size = inlineSizes.length > 0 ? Math.min(block.fontSize, ...inlineSizes) : block.fontSize;
    const required = contrastRequirement(size, isBold(block));

    for (const fg of candidates) {
      if (!isHex(fg) || !isHex(background)) continue;
      const ratio = safeContrast(fg, background);
      if (ratio !== null && ratio < required) {
        textMisses.push({ block, ratio, required, fg, bg: background });
      }
    }
  }

  if (textMisses.length > 0) {
    const worst = textMisses.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    // Below 3:1 text is not merely hard to read, it is illegible for a large
    // share of readers — that is a different severity of problem.
    const severity = worst.ratio < 3 ? 'P0' : 'P1';
    out.push(
      finding({
        ruleId: 'a11y/text-contrast',
        severity,
        dimension: 'accessibility',
        title: `Text contrast below WCAG AA in ${textMisses.length} place${textMisses.length === 1 ? '' : 's'}`,
        detail: `Worst case ${worst.fg} on ${worst.bg} measures ${round(worst.ratio)}:1, below the required ${worst.required}:1.`,
        impact:
          'Readers with low vision, and anyone reading on a phone in daylight, cannot make out the text. It is the single most common accessibility failure in email.',
        fix: `Darken the text or lighten the background until the pair reaches ${worst.required}:1.`,
        blocks: [...new Set(textMisses.map((m) => m.block))],
        standard: 'WCAG 2.1 SC 1.4.3 Contrast (Minimum)',
      }),
    );
  }

  /* --- contrast: buttons --------------------------------------------- */

  const buttonMisses: { block: ResolvedBlock; ratio: number; required: number; fg: string; bg: string }[] = [];
  for (const block of doc.blocks.filter((b) => b.type === 'Button')) {
    const { background, text } = buttonColors(block);
    if (!background || !text) continue;
    const size = typeof block.style.fontSize === 'number' ? block.style.fontSize : 16;
    const required = contrastRequirement(size, block.style.fontWeight !== 'normal');
    const ratio = safeContrast(text, background);
    if (ratio !== null && ratio < required) {
      buttonMisses.push({ block, ratio, required, fg: text, bg: background });
    }
  }

  if (buttonMisses.length > 0) {
    const worst = buttonMisses.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    out.push(
      finding({
        ruleId: 'a11y/button-contrast',
        severity: 'P1',
        dimension: 'accessibility',
        title: `Button label contrast below WCAG AA on ${buttonMisses.length} button${buttonMisses.length === 1 ? '' : 's'}`,
        detail: `Worst case "${excerpt(buttonText(worst.block), 30)}" uses ${worst.fg} on ${worst.bg} — ${round(worst.ratio)}:1 against a required ${worst.required}:1.`,
        impact: 'The call to action is the one element that must be readable; a low-contrast button loses the click the whole email was sent to get.',
        fix: `Switch the label to the higher-contrast of white or near-black against ${worst.bg}, or darken the button fill.`,
        blocks: buttonMisses.map((m) => m.block),
        standard: 'WCAG 2.1 SC 1.4.3 Contrast (Minimum)',
      }),
    );
  }

  /* --- images --------------------------------------------------------- */

  const images = doc.blocks.filter((b) => b.type === 'Image');
  const missingAlt = images.filter((b) => {
    const alt = typeof b.props.alt === 'string' ? b.props.alt.trim() : '';
    return alt === '';
  });
  if (missingAlt.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/image-alt-missing',
        severity: 'P1',
        dimension: 'accessibility',
        title: `${missingAlt.length} of ${images.length} image${images.length === 1 ? '' : 's'} have no alt text`,
        detail: 'These `Image` blocks have an empty or absent `alt`.',
        impact:
          'Most clients block images until the recipient opts in, so alt text is what the majority of readers see first — not a screen-reader-only concern.',
        fix: 'Describe what the image communicates, not what it depicts. Use an empty alt only for purely decorative rules and spacers.',
        blocks: missingAlt,
        standard: 'WCAG 2.1 SC 1.1.1 Non-text Content',
      }),
    );
  }

  const filenameAlt = images.filter((b) => {
    const alt = typeof b.props.alt === 'string' ? b.props.alt.trim() : '';
    return alt !== '' && FILENAME_ALT.test(alt);
  });
  if (filenameAlt.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/image-alt-filename',
        severity: 'P2',
        dimension: 'accessibility',
        title: `${filenameAlt.length} image${filenameAlt.length === 1 ? '' : 's'} use a filename as alt text`,
        detail: `For example: "${excerpt(String(filenameAlt[0].props.alt), 40)}".`,
        impact: 'A filename read aloud, or shown in place of a blocked image, carries no meaning and adds noise.',
        fix: 'Replace with a short description of what the image says to the reader.',
        blocks: filenameAlt,
        standard: 'WCAG 2.1 SC 1.1.1 Non-text Content',
      }),
    );
  }

  /* --- type size ------------------------------------------------------ */

  // Small type is only a real problem where there is something to read. A
  // 12px footnote or a caption is a long-standing email convention; 12px
  // running copy is not. Below 11px nothing is defensible at any length.
  const sizeOf = (block: ResolvedBlock, html: string): number => {
    const inline = extractInlineFontSizes(html);
    return inline.length > 0 ? Math.min(block.fontSize, ...inline) : block.fontSize;
  };

  const smallBody = facts.texts.filter(
    ({ block, html, text }) => sizeOf(block, html) < THRESHOLDS.minBodyFontSizePx && countWords(text) >= 25,
  );
  const tinyAnywhere = facts.texts.filter(({ block, html, text }) => sizeOf(block, html) < 11 && text.length > 0);

  if (tinyAnywhere.length > 0) {
    const smallest = Math.min(...tinyAnywhere.map((t) => sizeOf(t.block, t.html)));
    out.push(
      finding({
        ruleId: 'a11y/text-tiny',
        severity: 'P1',
        dimension: 'accessibility',
        title: `Text as small as ${smallest}px`,
        detail: `${tinyAnywhere.length} block${tinyAnywhere.length === 1 ? '' : 's'} render below 11px.`,
        impact: 'This is unreadable on a phone without pinch-zooming, and several clients will not reflow after a zoom.',
        fix: `Raise to at least ${THRESHOLDS.minBodyFontSizePx}px, even for legal and footnote copy.`,
        blocks: tinyAnywhere.map((t) => t.block),
        standard: 'WCAG 2.1 SC 1.4.4 Resize Text',
      }),
    );
  }

  if (smallBody.length > 0) {
    const smallest = Math.min(...smallBody.map((t) => sizeOf(t.block, t.html)));
    out.push(
      finding({
        ruleId: 'a11y/body-text-small',
        severity: 'P2',
        dimension: 'accessibility',
        title: `Running copy set at ${smallest}px`,
        detail: `${smallBody.length} block${smallBody.length === 1 ? '' : 's'} of 25+ words sit below the ${THRESHOLDS.minBodyFontSizePx}px floor for sustained reading.`,
        impact: 'Short labels get away with small type; paragraphs do not. Readers over 40 will skip these blocks entirely.',
        fix: `Raise body copy to ${THRESHOLDS.comfortableBodyFontSizePx}px and reserve smaller sizes for captions and legal lines.`,
        blocks: smallBody.map((t) => t.block),
        standard: 'WCAG 2.1 SC 1.4.4 Resize Text',
      }),
    );
  }

  /* --- tap targets ---------------------------------------------------- */

  // Two thresholds, both from the spec rather than invented: 24px is the AA
  // floor (WCAG 2.2 SC 2.5.8) and failing it is a real conformance problem;
  // 44px is the AAA target (SC 2.5.5) and missing it is a polish note. A
  // single 44px cutoff would report a 43px button as loudly as a 20px one.
  const buttonsWithHeight = doc.blocks.filter((b) => b.type === 'Button');
  const failsMinimum = buttonsWithHeight.filter((b) => b.estimatedHeight < 24);
  const missesTarget = buttonsWithHeight.filter(
    (b) => b.estimatedHeight >= 24 && b.estimatedHeight < THRESHOLDS.minTapTargetPx,
  );

  if (failsMinimum.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/tap-target-fails-minimum',
        severity: 'P1',
        dimension: 'accessibility',
        title: `${failsMinimum.length} button${failsMinimum.length === 1 ? '' : 's'} below the 24px minimum target size`,
        detail: `Smallest renders about ${Math.round(Math.min(...failsMinimum.map((b) => b.estimatedHeight)))}px tall including padding.`,
        impact: 'Targets this small are genuinely hard to hit one-handed and disproportionately affect readers with motor impairments.',
        fix: "Increase the button's vertical padding.",
        blocks: failsMinimum,
        standard: 'WCAG 2.2 SC 2.5.8 Target Size (Minimum)',
      }),
    );
  }

  if (missesTarget.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/tap-target-below-target',
        severity: 'P3',
        dimension: 'accessibility',
        title: `${missesTarget.length} button${missesTarget.length === 1 ? '' : 's'} under the ${THRESHOLDS.minTapTargetPx}px comfortable target`,
        detail: `Smallest is about ${Math.round(Math.min(...missesTarget.map((b) => b.estimatedHeight)))}px tall — above the 24px conformance floor but below the recommended size.`,
        impact: 'Usable, but fiddly on a phone held one-handed.',
        fix: `Add a few pixels of vertical padding to reach ${THRESHOLDS.minTapTargetPx}px.`,
        blocks: missesTarget,
        standard: 'WCAG 2.1 SC 2.5.5 Target Size (Enhanced)',
      }),
    );
  }

  /* --- link and button copy ------------------------------------------- */

  const vagueLinks = facts.links.filter((l) => l.kind === 'text' && l.text && VAGUE_LINK_TEXT.test(l.text.trim()));
  if (vagueLinks.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/vague-link-text',
        severity: 'P2',
        dimension: 'accessibility',
        title: `${vagueLinks.length} link${vagueLinks.length === 1 ? '' : 's'} with non-descriptive text`,
        detail: `Found: ${listPhrase([...new Set(vagueLinks.map((l) => `"${l.text}"`))].slice(0, 4))}.`,
        impact: 'Screen readers can list links out of context; a list of "click here" gives the reader no way to choose.',
        fix: 'Make the link text name its destination — "See the March invoice" rather than "click here".',
        blocks: [...new Set(vagueLinks.map((l) => l.blockId))],
        standard: 'WCAG 2.1 SC 2.4.4 Link Purpose (In Context)',
      }),
    );
  }

  const genericButtons = doc.blocks.filter((b) => b.type === 'Button' && GENERIC_BUTTON_TEXT.test(buttonText(b)));
  if (genericButtons.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/generic-button-text',
        severity: 'P2',
        dimension: 'ctaClarity',
        title: `${genericButtons.length} button${genericButtons.length === 1 ? '' : 's'} labelled generically`,
        detail: `Labels: ${listPhrase([...new Set(genericButtons.map((b) => `"${buttonText(b)}"`))])}.`,
        impact: 'A label that names the widget instead of the outcome makes the reader work out what happens next, and measurably lowers click-through.',
        fix: 'Lead with the verb and the object — "Start your trial", "Download the report".',
        blocks: genericButtons,
      }),
    );
  }

  /* --- semantics ------------------------------------------------------ */

  const headingLevels = facts.texts.flatMap((t) => extractHeadingLevels(t.html));
  if (headingLevels.length === 0 && facts.metrics.wordCount > 40) {
    out.push(
      finding({
        ruleId: 'a11y/no-semantic-headings',
        severity: 'P2',
        dimension: 'accessibility',
        title: 'No semantic headings in the document',
        detail: 'Every text block uses paragraphs; there is no `<h1>`-`<h6>` anywhere.',
        impact: 'Screen-reader users navigate long messages by heading. Without them the only way through is to read linearly from the top.',
        fix: 'Mark the main headline as `<h1>` and section titles as `<h2>` in the rich-text content, rather than only enlarging the font.',
        blocks: facts.texts.slice(0, 1).map((t) => t.block),
        standard: 'WCAG 2.1 SC 1.3.1 Info and Relationships',
      }),
    );
  } else if (headingLevels.length > 0) {
    const first = headingLevels[0];
    if (first > 2) {
      out.push(
        finding({
          ruleId: 'a11y/heading-starts-deep',
          severity: 'P3',
          dimension: 'accessibility',
          title: `Heading structure starts at <h${first}>`,
          detail: 'The first heading in the document is not an `<h1>` or `<h2>`.',
          impact: 'The outline reads as though content above it is missing.',
          fix: 'Promote the main headline to `<h1>`.',
          blocks: facts.texts.slice(0, 1).map((t) => t.block),
          standard: 'WCAG 2.1 SC 1.3.1 Info and Relationships',
        }),
      );
    }
  }

  const socialBlocks = doc.blocks.filter((b) => b.type === 'SocialMedia');
  const unlabelledSocial = socialBlocks.filter((b) => {
    const items = Array.isArray(b.data.items) ? (b.data.items as Record<string, unknown>[]) : [];
    return items.some((i) => typeof i.label !== 'string' || i.label.trim() === '');
  });
  if (unlabelledSocial.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/social-icons-unlabelled',
        severity: 'P2',
        dimension: 'accessibility',
        title: 'Social icons without labels',
        detail: 'One or more `SocialMedia` items have an empty `label`, which is what becomes the icon\'s alt text.',
        impact: 'With images off — the default in most clients — an unlabelled row of social links is a row of empty boxes.',
        fix: 'Give every social item a label naming the network, e.g. "Follow us on Instagram".',
        blocks: unlabelledSocial,
        standard: 'WCAG 2.1 SC 1.1.1 Non-text Content',
      }),
    );
  }

  const justified = facts.texts.filter((t) => t.block.style.textAlign === 'justify');
  if (justified.length > 0) {
    out.push(
      finding({
        ruleId: 'a11y/justified-text',
        severity: 'P3',
        dimension: 'accessibility',
        title: `${justified.length} justified text block${justified.length === 1 ? '' : 's'}`,
        detail: 'These blocks set `textAlign: justify`.',
        impact: 'Justification opens uneven "rivers" of whitespace that are disorienting for dyslexic readers, and email clients cannot hyphenate to soften it.',
        fix: 'Use left alignment for body copy.',
        blocks: justified.map((t) => t.block),
      }),
    );
  }

  return out;
}
