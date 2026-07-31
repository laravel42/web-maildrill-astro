/**
 * HTML email client compatibility.
 *
 * Every finding here cites the support matrix in `client-matrix.ts` so the
 * claim, the affected engines, the visible effect, and the workaround all
 * come from one reviewed source. A compatibility warning that only says
 * "Outlook may not support this" trains people to ignore the report.
 */
import { clientNames, fontFact, SUPPORT, THRESHOLDS } from '../client-matrix.js';
import type { ResolvedBlock } from '../model.js';
import { columnWidths } from '../model.js';
import type { Finding } from '../types.js';

import { finding, listPhrase, type RuleContext } from './context.js';

/** True when the block asks for rounded corners by any of the routes available. */
function hasRoundedCorners(block: ResolvedBlock): boolean {
  const shape = block.style.shape;
  if (shape === 'pill') return true;
  if (shape && typeof shape === 'object') {
    return Object.values(shape as Record<string, unknown>).some(
      (v) => typeof v === 'number' && v > 0,
    );
  }
  return typeof block.style.borderRadius === 'number' && block.style.borderRadius > 0;
}

function hasGradient(block: ResolvedBlock): boolean {
  const bg = block.style.background;
  return typeof bg === 'string' && /gradient\(/i.test(bg);
}

export function compatibilityRules(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const { doc, facts } = ctx;

  /* --- web fonts ------------------------------------------------------ */

  const usedFonts = [...new Set(facts.metrics.fontFamilies)];
  const risky = usedFonts
    .map((key) => fontFact(key))
    .filter((f): f is NonNullable<typeof f> => f !== null && f.risk !== 'none');
  const highRisk = risky.filter((f) => f.risk === 'high');
  const mediumRisk = risky.filter((f) => f.risk === 'medium');

  if (highRisk.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/web-font-no-fallback',
        severity: 'P1',
        dimension: 'clientCompatibility',
        title: `${listPhrase(highRisk.map((f) => f.label))} falls back to a generic face`,
        detail: `${SUPPORT.webFonts.effect} ${listPhrase(highRisk.map((f) => `${f.label} has no named web-safe fallback in its stack`))}, and ${highRisk.length === 1 ? 'it is' : 'they are'} a display face whose substitute has very different widths.`,
        impact:
          'In the clients that ignore web fonts — which is most of the inbox by volume — headlines re-wrap and can push the layout to a different height than the one that was designed.',
        fix: `${SUPPORT.webFonts.workaround} If the display face is essential to the brand, confine it to a short headline that still fits on one line in Arial.`,
        clients: clientNames(SUPPORT.webFonts.failsIn),
      }),
    );
  }

  if (mediumRisk.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/web-font-generic-fallback',
        severity: 'P3',
        dimension: 'clientCompatibility',
        title: `${listPhrase(mediumRisk.map((f) => f.label))} degrades to the browser default`,
        detail: `${listPhrase(mediumRisk.map((f) => `${f.label}'s stack ends at a bare generic family`))}.`,
        impact:
          'Line breaks shift slightly where the web font does not load. Usually cosmetic, but it will not match the preview.',
        fix: 'Acceptable for body copy. Check the design still reads once the fallback is in play.',
        clients: clientNames(SUPPORT.webFonts.failsIn),
      }),
    );
  }

  if (usedFonts.length > 0 && risky.length === 0) {
    // Nothing to report — recorded as a strength by the report builder.
  }

  /* --- rounded corners ------------------------------------------------ */

  const rounded = doc.blocks.filter(hasRoundedCorners);
  if (rounded.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/border-radius',
        severity: 'P3',
        dimension: 'clientCompatibility',
        title: `${rounded.length} block${rounded.length === 1 ? '' : 's'} rely on rounded corners`,
        detail: SUPPORT.borderRadius.effect,
        impact:
          'Cosmetic. It only becomes a real problem when the radius is what separates an element from its background.',
        fix: SUPPORT.borderRadius.workaround,
        blocks: rounded,
        clients: clientNames(SUPPORT.borderRadius.failsIn),
      }),
    );
  }

  /* --- object-fit ----------------------------------------------------- */

  const objectFit = doc.blocks.filter(
    (b) => b.type === 'Image' && typeof b.style.objectFit === 'string',
  );
  if (objectFit.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/object-fit',
        severity: 'P1',
        dimension: 'clientCompatibility',
        title: `${objectFit.length} image${objectFit.length === 1 ? '' : 's'} depend on object-fit for cropping`,
        detail: SUPPORT.objectFit.effect,
        impact:
          'The image is the most visually dominant element on the screen; stretched instead of cropped, it is immediately and obviously wrong.',
        fix: SUPPORT.objectFit.workaround,
        blocks: objectFit,
        clients: clientNames(SUPPORT.objectFit.failsIn),
      }),
    );
  }

  /* --- gradients ------------------------------------------------------ */

  const gradients = doc.blocks.filter(hasGradient);
  if (gradients.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/css-gradient',
        severity: 'P2',
        dimension: 'clientCompatibility',
        title: `${gradients.length} block${gradients.length === 1 ? '' : 's'} use a CSS gradient background`,
        detail: SUPPORT.backgroundImage.effect,
        impact:
          'If the foreground text was chosen to sit on the gradient, it can land on an unrelated colour and become unreadable rather than merely plainer.',
        fix: SUPPORT.backgroundImage.workaround,
        blocks: gradients,
        clients: clientNames(SUPPORT.backgroundImage.failsIn),
      }),
    );
  }

  /* --- images without an explicit width -------------------------------- */

  const fluidImages = doc.blocks.filter(
    (b) => b.type === 'Image' && b.props.size === 'fill' && typeof b.props.width !== 'number',
  );
  if (fluidImages.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/image-no-explicit-width',
        severity: 'P2',
        dimension: 'clientCompatibility',
        title: `${fluidImages.length} full-width image${fluidImages.length === 1 ? '' : 's'} without an explicit width`,
        detail: `${SUPPORT.maxWidth.effect} A fill-sized image resolves to \`width: 100%\` with no pixel width to fall back on.`,
        impact:
          'The image can render at its intrinsic size instead of the column width, overflowing the canvas.',
        fix: `${SUPPORT.maxWidth.workaround} Set \`props.width\` to the column width the image occupies.`,
        blocks: fluidImages,
        clients: clientNames(SUPPORT.maxWidth.failsIn),
        autoFixable: true,
      }),
    );
  }

  /* --- columns and the stripped-<style> case ---------------------------- */

  const columnBlocks = doc.blocks.filter((b) => b.type === 'ColumnsContainer');
  const threeUp = columnBlocks.filter((b) => b.props.columnsCount === 3);
  if (threeUp.length > 0) {
    const narrowest = Math.min(...threeUp.flatMap((b) => columnWidths(b.props, b.contentWidth)));
    out.push(
      finding({
        ruleId: 'compat/three-column-no-stack',
        severity: 'P1',
        dimension: 'clientCompatibility',
        title: `${threeUp.length} three-column row${threeUp.length === 1 ? '' : 's'} will not stack everywhere`,
        detail: `${SUPPORT.mediaQueries.effect} At three across the narrowest column is about ${Math.round(narrowest)}px, which stays that width on a phone in those clients.`,
        impact:
          'On a 320px screen three unstacked columns leave roughly 100px each — enough for two or three words per line, which is unreadable.',
        fix: `${SUPPORT.mediaQueries.workaround} Prefer two columns, or split the row into stacked pairs.`,
        blocks: threeUp,
        clients: clientNames(SUPPORT.mediaQueries.failsIn),
      }),
    );
  }

  const explicitlyNotStacking = columnBlocks.filter((b) => b.props.stackColumnsOnMobile === false);
  if (explicitlyNotStacking.length > 0) {
    out.push(
      finding({
        ruleId: 'compat/stacking-disabled',
        severity: 'P2',
        dimension: 'clientCompatibility',
        title: `${explicitlyNotStacking.length} column row${explicitlyNotStacking.length === 1 ? '' : 's'} opt out of mobile stacking`,
        detail: '`stackColumnsOnMobile` is false, so these stay side by side at every width.',
        impact:
          'Columns that never stack squeeze to a fraction of the screen on a phone, where most email is read.',
        fix: 'Leave stacking enabled unless the row is a deliberately compact pair such as a label and a value.',
        blocks: explicitlyNotStacking,
      }),
    );
  }

  /* --- Gmail clipping --------------------------------------------------- */

  const measuredBytes = facts.envelope.renderedHtmlBytes;
  // Rendered markup runs several times the document JSON because every block
  // becomes a nested wrapper table. 2.2x matches the preset corpus closely
  // enough to flag the templates that are actually at risk.
  const estimatedBytes = measuredBytes ?? Math.round(JSON.stringify(doc.raw).length * 2.2);
  if (estimatedBytes > THRESHOLDS.gmailClipBytes) {
    out.push(
      finding({
        ruleId: 'compat/gmail-clipping',
        severity: 'P1',
        dimension: 'clientCompatibility',
        title: "Message likely exceeds Gmail's clipping threshold",
        detail: `${measuredBytes ? 'Rendered' : 'Estimated'} HTML is about ${Math.round(estimatedBytes / 1024)}KB against Gmail's ${Math.round(THRESHOLDS.gmailClipBytes / 1024)}KB limit.${measuredBytes ? '' : ' This is an estimate from the document size; render the HTML for an exact figure.'}`,
        impact:
          'Gmail truncates the message and hides the rest behind "View entire message" — which also cuts the tracking pixel, so opens stop being recorded.',
        fix: 'Shorten the email, remove unused blocks, and avoid repeating large inline style bags across many blocks.',
      }),
    );
  }

  return out;
}
