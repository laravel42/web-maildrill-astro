/**
 * Everything countable about a template, computed once.
 *
 * Rules read these rather than re-walking the document, which keeps rule
 * bodies to the actual judgement ("is this ratio too high?") and means the
 * numbers quoted in a finding are guaranteed to match the numbers in the
 * report's metrics block.
 */
import {
  buttonText,
  countWords,
  extractInlineColors,
  extractInlineFontSizes,
  extractLinks,
  htmlToText,
  isHex,
  type ResolvedBlock,
  type ResolvedDocument,
} from './model.js';
import type { TemplateMetrics } from './types.js';

/** Words per minute for the reading-time estimate. */
const READING_WPM = 240;

const UNSUBSCRIBE_PATTERN = /unsubscribe|opt[\s-]?out|manage\s+(?:your\s+)?preferences|email\s+preferences/i;

/**
 * Context that lives outside the document but changes the verdict.
 *
 * The subject line and preheader are campaign fields, not blocks, so the
 * audit cannot see them unless the caller passes them. Rules distinguish
 * "absent" from "not supplied" and stay quiet about what they were not given.
 */
export type EnvelopeContext = {
  /** Subject line, when the caller has one. Audited only if provided. */
  subject?: string;
  /** Preheader text. Lives outside the document, so it must be passed in. */
  preheader?: string;
  /** Exact size of the rendered HTML, when the caller has already rendered it. */
  renderedHtmlBytes?: number;
  /**
   * What is being audited.
   *
   * A reusable gallery *template* is supposed to contain `#` hrefs and no
   * unsubscribe link — those are the author's job at send time, and reporting
   * them as blocking makes the whole report cry wolf. A *campaign* about to
   * go out has no such excuse. Defaults to `campaign`, the stricter reading.
   */
  intent?: 'template' | 'campaign';
};

export type CollectedText = {
  block: ResolvedBlock;
  html: string;
  text: string;
};

export type DocumentFacts = {
  metrics: TemplateMetrics;
  texts: CollectedText[];
  links: { href: string; text: string; blockId: string; kind: 'button' | 'text' | 'image' | 'social' }[];
  colors: Set<string>;
  envelope: EnvelopeContext;
};

/** Every visible string in the document, with its owning block. */
export function collectTexts(doc: ResolvedDocument): CollectedText[] {
  const out: CollectedText[] = [];
  for (const block of doc.blocks) {
    if (block.type !== 'NotionText') continue;
    const html = typeof block.props.html === 'string' ? block.props.html : '';
    out.push({ block, html, text: htmlToText(html) });
  }
  return out;
}

/** Every outbound link, tagged by what carries it. */
export function collectLinks(
  doc: ResolvedDocument,
): { href: string; text: string; blockId: string; kind: 'button' | 'text' | 'image' | 'social' }[] {
  const out: { href: string; text: string; blockId: string; kind: 'button' | 'text' | 'image' | 'social' }[] = [];
  for (const block of doc.blocks) {
    switch (block.type) {
      case 'Button': {
        const href = typeof block.props.url === 'string' ? block.props.url : '';
        out.push({ href, text: buttonText(block), blockId: block.id, kind: 'button' });
        break;
      }
      case 'NotionText': {
        const html = typeof block.props.html === 'string' ? block.props.html : '';
        for (const link of extractLinks(html)) {
          out.push({ ...link, blockId: block.id, kind: 'text' });
        }
        break;
      }
      case 'Image': {
        const href = typeof block.props.linkHref === 'string' ? block.props.linkHref : '';
        if (href) out.push({ href, text: '', blockId: block.id, kind: 'image' });
        break;
      }
      case 'SocialMedia': {
        const items = Array.isArray(block.data.items) ? (block.data.items as Record<string, unknown>[]) : [];
        for (const item of items) {
          const href = typeof item.url === 'string' ? item.url : typeof item.href === 'string' ? item.href : '';
          const label = typeof item.label === 'string' ? item.label : '';
          out.push({ href, text: label, blockId: block.id, kind: 'social' });
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** Distinct hex colours across text, backgrounds, buttons, and inline spans. */
export function collectColors(doc: ResolvedDocument): Set<string> {
  const colors = new Set<string>();
  const add = (value: unknown) => {
    if (isHex(value)) colors.add(value.toUpperCase());
  };

  add(doc.canvasColor);
  add(doc.layoutTextColor);

  for (const block of doc.blocks) {
    add(block.style.backgroundColor);
    add(block.style.color);
    add(block.style.borderColor);
    add(block.props.buttonBackgroundColor);
    add(block.props.buttonTextColor);
    add(block.style.buttonBackgroundColor);
    add(block.style.buttonTextColor);
    if (block.type === 'NotionText' && typeof block.props.html === 'string') {
      for (const c of extractInlineColors(block.props.html)) colors.add(c);
    }
  }
  return colors;
}

export function computeFacts(doc: ResolvedDocument, envelope: EnvelopeContext = {}): DocumentFacts {
  const texts = collectTexts(doc);
  const links = collectLinks(doc);
  const colors = collectColors(doc);

  const blockTypeCounts: Record<string, number> = {};
  for (const block of doc.blocks) {
    blockTypeCounts[block.type] = (blockTypeCounts[block.type] ?? 0) + 1;
  }

  const wordCount =
    texts.reduce((sum, t) => sum + countWords(t.text), 0) +
    doc.blocks.filter((b) => b.type === 'Button').reduce((sum, b) => sum + countWords(buttonText(b)), 0);

  const images = doc.blocks.filter((b) => b.type === 'Image');
  const imageHeight = images.reduce((sum, b) => sum + b.estimatedHeight, 0);
  const imageToTextRatio = doc.estimatedHeight > 0 ? imageHeight / doc.estimatedHeight : 0;

  const fontFamilies = new Set<string>();
  if (doc.layoutFontFamily) fontFamilies.add(doc.layoutFontFamily);
  const fontSizes = new Set<number>();
  for (const block of doc.blocks) {
    if (typeof block.style.fontFamily === 'string') fontFamilies.add(block.style.fontFamily);
    if (typeof block.style.fontSize === 'number') fontSizes.add(block.style.fontSize);
    if (block.type === 'NotionText' && typeof block.props.html === 'string') {
      for (const size of extractInlineFontSizes(block.props.html)) fontSizes.add(size);
    }
  }

  const maxNestingDepth = doc.blocks.reduce((max, b) => Math.max(max, b.depth), 0);

  const hasUnsubscribe =
    links.some((l) => UNSUBSCRIBE_PATTERN.test(l.text) || UNSUBSCRIBE_PATTERN.test(l.href)) ||
    texts.some((t) => UNSUBSCRIBE_PATTERN.test(t.text));

  const metrics: TemplateMetrics = {
    blockCount: doc.blocks.length,
    blockTypeCounts,
    wordCount,
    readingTimeSeconds: Math.round((wordCount / READING_WPM) * 60),
    imageCount: images.length,
    imageToTextRatio: Math.round(imageToTextRatio * 1000) / 1000,
    linkCount: links.filter((l) => l.href).length,
    ctaCount: blockTypeCounts.Button ?? 0,
    paletteSize: colors.size,
    fontFamilies: [...fontFamilies],
    fontSizes: [...fontSizes].sort((a, b) => a - b),
    estimatedHeightPx: doc.estimatedHeight,
    maxNestingDepth,
    hasPreheader: typeof envelope.preheader === 'string' && envelope.preheader.trim().length > 0,
    hasUnsubscribe,
  };

  return { metrics, texts, links, colors, envelope };
}
