/**
 * The rule catalogue: one authoring-time instruction per audit rule.
 *
 * A `Finding` tells you what went wrong *after* the fact, in prose aimed at a
 * human reading a report. This table is the other direction — what the model
 * should do *before* generating so the finding never fires. Keeping the two
 * next to each other is the point: when a rule's threshold moves, the guidance
 * the generator was given moves with it, and `catalog.test.ts` fails the build
 * if a rule is added without a matching entry.
 *
 * `preventable` marks the rules the generator can actually act on. Some
 * findings (`engine/*-failed`, `structure/dangling-reference`) describe a
 * malformed document rather than a design choice, so putting them in the
 * generator's prompt would only spend tokens.
 */

import { THRESHOLDS } from './client-matrix.js';
import type { AuditDimensionId, CritiqueDimensionId } from './types.js';

export type RuleDoc = {
  /** Which score this rule moves. */
  dimension: AuditDimensionId | CritiqueDimensionId;
  /** Imperative instruction, written for the generator rather than a reviewer. */
  guidance: string;
  /**
   * False for rules that describe a broken document rather than a choice —
   * excluded from the prompt, still reported.
   */
  preventable?: false;
};

const T = THRESHOLDS;

export const RULE_CATALOG: Record<string, RuleDoc> = {
  /* --- structure ------------------------------------------------------ */

  'structure/missing-root': {
    dimension: 'structuralIntegrity',
    guidance: 'Emit the `root` EmailLayout line first, before any block that references it.',
    preventable: false,
  },
  'structure/root-wrong-type': {
    dimension: 'structuralIntegrity',
    guidance: 'The `root` block is always `EmailLayout`. No other type may occupy it.',
    preventable: false,
  },
  'structure/empty-document': {
    dimension: 'structuralIntegrity',
    guidance: "Give `EmailLayout.data.childrenIds` at least one entry — a root with no children renders a blank email.",
  },
  'structure/dangling-reference': {
    dimension: 'structuralIntegrity',
    guidance: 'Every id in a `childrenIds` array needs its own line later in the stream.',
    preventable: false,
  },
  'structure/duplicate-reference': {
    dimension: 'structuralIntegrity',
    guidance: 'A block has exactly one parent. Never list the same id in two `childrenIds` arrays.',
  },
  'structure/orphan-blocks': {
    dimension: 'structuralIntegrity',
    guidance: 'Attach every block you emit to a parent; an unreferenced block is invisible but still costs bytes.',
  },
  'structure/unknown-block-type': {
    dimension: 'structuralIntegrity',
    guidance: 'Use only the documented block types. Invented types are dropped by the validator.',
    preventable: false,
  },
  'structure/placeholder-content': {
    dimension: 'structuralIntegrity',
    guidance:
      'Write real copy. Never ship "Lorem ipsum", "Double click to edit", "Your text here", or an unsubstituted `{{TOKEN}}` — substitute palette tokens with the actual hex before emitting.',
  },
  'structure/empty-text-block': {
    dimension: 'structuralIntegrity',
    guidance: 'Delete text blocks you have nothing to put in; use a Spacer when you want vertical room.',
  },
  'structure/empty-column': {
    dimension: 'structuralIntegrity',
    guidance:
      'Fill every column you declare. For a 2-column row set `columnsCount: 2` and leave the third `columns` entry as `{"childrenIds": []}` — do not declare 3 and leave one visibly blank.',
  },
  'structure/excessive-nesting': {
    dimension: 'structuralIntegrity',
    guidance: `Keep nesting under ${T.maxNestingDepth} levels; deep wrappers rarely survive Outlook's table model intact.`,
  },
  'structure/thin-template': {
    dimension: 'structuralIntegrity',
    guidance: `A marketing email needs at least ${T.minBlockCount} blocks. Below that it reads as a prototype — add trust microcopy, a feature row, or a secondary CTA card.`,
  },
  'structure/bloated-template': {
    dimension: 'structuralIntegrity',
    guidance: `Stay under ${T.maxBlockCount} blocks. Past that it is a landing page and Gmail will clip it.`,
  },

  /* --- accessibility -------------------------------------------------- */

  'a11y/text-contrast': {
    dimension: 'accessibility',
    guidance:
      'Every text colour must clear 4.5:1 against the background it actually lands on (3:1 at 18px+, or 14px+ bold). Resolve the inherited background first — text inside a coloured Container is not on the canvas colour.',
  },
  'a11y/button-contrast': {
    dimension: 'accessibility',
    guidance: 'Check `buttonTextColor` against `buttonBackgroundColor` for 4.5:1, not against the page.',
  },
  'a11y/image-alt-missing': {
    dimension: 'accessibility',
    guidance:
      'Give every Image an `alt` that describes what it shows. Most clients block images by default, so alt text is the first thing many readers see. Use `alt: ""` only for purely decorative images.',
  },
  'a11y/image-alt-filename': {
    dimension: 'accessibility',
    guidance: 'Alt text is a description, not a filename — "Team reviewing quarterly numbers", never "hero-2.png".',
  },
  'a11y/text-tiny': {
    dimension: 'accessibility',
    guidance: 'Never set text below 11px; it is illegible on a phone and some clients will scale the whole email to compensate.',
  },
  'a11y/body-text-small': {
    dimension: 'accessibility',
    guidance: `Body copy sits at ${T.comfortableBodyFontSizePx}px, never under ${T.minBodyFontSizePx}px. Reserve 11–13px for legal and captions.`,
  },
  'a11y/tap-target-fails-minimum': {
    dimension: 'accessibility',
    guidance: 'Buttons need at least 12px of vertical padding so the tap target clears 24px.',
  },
  'a11y/tap-target-below-target': {
    dimension: 'accessibility',
    guidance: `Aim for a ${T.minTapTargetPx}px-tall button — roughly 14px vertical padding at 16px text.`,
  },
  'a11y/vague-link-text': {
    dimension: 'accessibility',
    guidance:
      'Link text should say where it goes. "Read the March report" over "click here" — screen-reader users navigate by link list, out of context.',
  },
  'a11y/generic-button-text': {
    dimension: 'accessibility',
    guidance: 'Label buttons with the action and its object: "Start your trial", not "Submit" or "Go".',
  },
  'a11y/no-semantic-headings': {
    dimension: 'accessibility',
    guidance:
      'Wrap the main title in `<h1>` and section titles in `<h2>` inside `props.html`. A large `fontSize` looks like a heading but is not one.',
  },
  'a11y/heading-starts-deep': {
    dimension: 'accessibility',
    guidance: 'Start the heading outline at `<h1>` and step down one level at a time.',
  },
  'a11y/social-icons-unlabelled': {
    dimension: 'accessibility',
    guidance: 'Give every SocialMedia item a `title`, so the icon announces as "Instagram" rather than "link".',
  },
  'a11y/justified-text': {
    dimension: 'accessibility',
    guidance:
      'Do not justify text. Email has no hyphenation engine, so justification opens rivers of whitespace that are hardest on dyslexic readers.',
  },

  /* --- client compatibility ------------------------------------------- */

  'compat/web-font-no-fallback': {
    dimension: 'clientCompatibility',
    guidance:
      'Web fonts do not load in Outlook desktop, Gmail webmail, or Yahoo. Pick a font whose stack names a real fallback, and never let a display face carry text the reader must be able to read.',
  },
  'compat/web-font-generic-fallback': {
    dimension: 'clientCompatibility',
    guidance: 'A stack ending in bare `sans-serif` gives Outlook nothing to work with — name a concrete fallback family.',
  },
  'compat/border-radius': {
    dimension: 'clientCompatibility',
    guidance:
      'Rounded corners square off in Outlook desktop. That is an acceptable, graceful loss — just never rely on radius to carry meaning, such as a pill shape being the only cue that something is a button.',
  },
  'compat/object-fit': {
    dimension: 'clientCompatibility',
    guidance:
      '`object-fit` is ignored in Outlook and Gmail, which stretch the image instead. Crop to the aspect ratio you need rather than fitting in CSS.',
  },
  'compat/css-gradient': {
    dimension: 'clientCompatibility',
    guidance:
      'Always pair `style.background` gradients with a solid `backgroundColor` fallback — Outlook renders the fallback, and if you omit it the section goes transparent and light text vanishes.',
  },
  'compat/image-no-explicit-width': {
    dimension: 'clientCompatibility',
    guidance: 'Set an explicit pixel `width` on every Image. Outlook does not infer intrinsic size and will render it full-bleed.',
  },
  'compat/three-column-no-stack': {
    dimension: 'clientCompatibility',
    guidance:
      'Three columns cannot stack where `<style>` is stripped, so each cell renders about a third of 600px on a phone. Prefer two columns, or accept the squeeze only for short items like icons.',
  },
  'compat/stacking-disabled': {
    dimension: 'clientCompatibility',
    guidance: 'Leave mobile stacking on for any column holding a paragraph.',
  },
  'compat/gmail-clipping': {
    dimension: 'clientCompatibility',
    guidance: `Keep rendered HTML under ${Math.round(T.gmailClipBytes / 1024)}KB. Past it Gmail truncates the message — usually eating the footer and the unsubscribe link, which is a compliance problem, not just a visual one.`,
  },

  /* --- responsive ------------------------------------------------------ */

  'responsive/column-too-narrow': {
    dimension: 'responsive',
    guidance: `A column carrying text needs at least ${T.minColumnWidthPx}px. Narrower is fine only for a divider or spacer.`,
  },
  'responsive/fixed-width-exceeds-mobile': {
    dimension: 'responsive',
    guidance: 'Keep fixed widths under the 370px mobile canvas, or the reader gets a horizontal scrollbar.',
  },
  'responsive/image-wider-than-mobile': {
    dimension: 'responsive',
    guidance: 'Set `widthMobile` on any image wider than 370px, or use `size: "fill"` so it scales with its container.',
  },
  'responsive/padding-crowds-mobile': {
    dimension: 'responsive',
    guidance:
      'Give generous desktop padding a smaller `mobilePadding` counterpart — 80px each side leaves almost no room on a 370px canvas.',
  },
  'responsive/line-length-long': {
    dimension: 'responsive',
    guidance: `Keep measure near ${T.maxLineLengthChars} characters. Full-bleed text at 600px with no horizontal padding overshoots it.`,
  },

  /* --- deliverability -------------------------------------------------- */

  'deliver/no-text-content': {
    dimension: 'deliverability',
    guidance: 'Never build an email out of one big image. Filters read text, and image blocking leaves the reader nothing.',
  },
  'deliver/image-heavy': {
    dimension: 'deliverability',
    guidance: `Keep images under ${Math.round(T.maxImageAreaRatio * 100)}% of the email's area — real text alongside them.`,
  },
  'deliver/no-unsubscribe': {
    dimension: 'deliverability',
    guidance:
      'Every marketing email needs a visible unsubscribe link in the footer. It is a legal requirement under CAN-SPAM and GDPR, not a courtesy.',
  },
  'deliver/placeholder-href': {
    dimension: 'deliverability',
    guidance: 'Give every link a real destination or a merge tag. `#` and `https://example.com` must not survive to send.',
  },
  'deliver/empty-href': {
    dimension: 'deliverability',
    guidance: 'A link or button with no `url` is a dead end — set one or drop the element.',
  },
  'deliver/relative-href': {
    dimension: 'deliverability',
    guidance: 'Email has no base URL. Every href must be absolute, starting `https://`.',
  },
  'deliver/insecure-href': {
    dimension: 'deliverability',
    guidance: 'Use `https://`. Plain `http://` links trip security warnings and depress click rates.',
  },
  'deliver/spam-phrases': {
    dimension: 'deliverability',
    guidance: 'Avoid "act now", "risk free", "100% free", "limited time only" and their neighbours — they score against you at the filter.',
  },
  'deliver/subject-empty': {
    dimension: 'deliverability',
    guidance: 'Write a subject line whenever one is asked for.',
  },
  'deliver/subject-too-long': {
    dimension: 'deliverability',
    guidance: 'Keep the subject under about 60 characters; mobile inboxes truncate past that.',
  },
  'deliver/subject-shouty': {
    dimension: 'deliverability',
    guidance: 'No all-caps and no multiple exclamation marks in the subject.',
  },
  'deliver/preheader-empty': {
    dimension: 'deliverability',
    guidance:
      'Write a preheader that extends the subject rather than repeating it. Left empty, the inbox scrapes the first text in the email, which is usually "View in browser".',
  },
  'deliver/preheader-too-long': {
    dimension: 'deliverability',
    guidance: 'Keep the preheader under about 100 characters — the rest is never shown.',
  },

  /* --- design ---------------------------------------------------------- */

  'design/flat-type-scale': {
    dimension: 'hierarchy',
    guidance:
      'The largest text should be at least twice the body size. A hero at 32–56px over 16px body is what makes the email scannable in the two seconds it actually gets.',
  },
  'design/single-type-size': {
    dimension: 'hierarchy',
    guidance: 'Use at least three sizes — display, body, and caption — so the eye has somewhere to land.',
  },
  'design/too-many-type-sizes': {
    dimension: 'typography',
    guidance: `Keep to ${T.maxFontSizes} sizes or fewer, drawn from one scale. Sizes that differ by 1–2px read as mistakes rather than intent.`,
  },
  'design/too-many-fonts': {
    dimension: 'typography',
    guidance: `At most ${T.maxFontFamilies} families: one for display, one for text, and only then a third.`,
  },
  'design/palette-sprawl': {
    dimension: 'color',
    guidance: `Hold the palette to about ${T.maxPaletteSize} colours. Reuse one accent across buttons, links, and rules instead of inventing a new hex per section.`,
  },
  'design/no-accent-colour': {
    dimension: 'color',
    guidance: 'Choose one accent and let it own the CTA. An all-grey email has nothing for the eye to catch on.',
  },
  'design/spacing-off-scale': {
    dimension: 'spacing',
    guidance: 'Draw padding from a 4px scale (8/12/16/24/32/40/56/64/80). Arbitrary values like 27 or 43 make the rhythm feel accidental.',
  },
  'design/no-imagery': {
    dimension: 'imagery',
    guidance: 'A long email with no image is a wall. Add a hero, or section imagery that carries meaning rather than filling space.',
  },
  'design/no-call-to-action': {
    dimension: 'ctaClarity',
    guidance: 'Every email wants one thing. Make it a real Button with a verb, not a link buried in a paragraph.',
  },
  'design/competing-ctas': {
    dimension: 'ctaClarity',
    guidance: `At most ${T.maxPrimaryCtas} primary buttons. Beyond that they compete and the reader picks none — style the secondary ones as ghost or text links.`,
  },
  'design/cta-far-down': {
    dimension: 'ctaClarity',
    guidance: 'Put the primary CTA in the first screen as well as the end. Most readers never scroll.',
  },
  'design/wall-of-text': {
    dimension: 'content',
    guidance: 'Break long copy with subheadings, imagery, or rules roughly every 150 words.',
  },
  'design/long-read': {
    dimension: 'content',
    guidance: 'Keep the email near a two-minute read and push the rest to a landing page.',
  },
  'design/no-subheadings': {
    dimension: 'scanability',
    guidance: 'Give each section a short bold subheading so the email survives being skimmed.',
  },
  'design/no-section-breaks': {
    dimension: 'scanability',
    guidance: 'Separate sections with a Divider or a background change, not just more vertical space.',
  },
  'design/inconsistent-buttons': {
    dimension: 'consistency',
    guidance: 'Buttons of the same rank share a shape, colour, and padding. Vary them only to signal a different rank.',
  },
  'design/mixed-text-alignment': {
    dimension: 'consistency',
    guidance:
      'Pick one alignment per section. Centre a hero if you like, but do not alternate centred and left-aligned paragraphs within a block of copy.',
  },
  'design/category-interchangeable': {
    dimension: 'brandSpecificity',
    guidance:
      'Make the design answer to this sender and no other. A default palette, a stock font, and evenly-spaced grey boxes produce an email that would suit any brand in the category — which means it belongs to none.',
  },
};

/** Rule ids the generator can act on, grouped for prompt assembly. */
export function preventableRules(): [string, RuleDoc][] {
  return Object.entries(RULE_CATALOG).filter(([, doc]) => doc.preventable !== false);
}

/** Look up authoring guidance for a finding. Unknown ids return undefined. */
export function guidanceFor(ruleId: string): string | undefined {
  return RULE_CATALOG[ruleId]?.guidance;
}
