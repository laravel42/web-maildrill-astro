/**
 * Deliverability and inbox hygiene.
 *
 * These rules cover the things that decide whether the email arrives, is
 * legal to send, and reads correctly in the inbox list before it is opened.
 * They are the cheapest failures to fix and the most expensive to ship.
 */
import { clientNames, SUPPORT, THRESHOLDS } from '../client-matrix.js';
import type { Finding } from '../types.js';

import { excerpt, finding, listPhrase, type RuleContext } from './context.js';

/** Hrefs that were never filled in. */
const PLACEHOLDER_URL = /^(?:#|about:blank|https?:\/\/(?:example\.(?:com|org)|localhost|your-?(?:site|domain|company)))/i;

/**
 * Phrases with a long history in spam corpora. Presence is a nudge, not a
 * verdict — filters score holistically — so this only ever fires as P2.
 */
const SPAM_PHRASES = [
  'act now',
  'buy now',
  'cash bonus',
  'click below',
  'congratulations you',
  'credit card offer',
  'dear friend',
  'double your',
  'earn extra cash',
  'free access',
  'free gift',
  'free money',
  'guaranteed',
  'limited time only',
  'lowest price',
  'make money fast',
  'no credit check',
  'no obligation',
  'risk free',
  'satisfaction guaranteed',
  'this is not spam',
  'urgent',
  'winner',
  'you have been selected',
];

export function deliverabilityRules(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const { facts } = ctx;
  const { metrics, envelope } = facts;
  const isTemplate = envelope.intent === 'template';

  /* --- an email has to have words --------------------------------------- */

  if (metrics.wordCount === 0) {
    out.push(
      finding({
        ruleId: 'deliver/no-text-content',
        severity: 'P0',
        dimension: 'deliverability',
        title: 'The email contains no text',
        detail: 'No readable words were found in any text block or button label.',
        impact:
          'An image-only message is treated as a strong spam signal, and with images blocked the recipient sees an entirely blank email.',
        fix: 'Add real copy. Every message needs at least a headline and a sentence that stands on its own with images off.',
      }),
    );
  }

  if (metrics.imageToTextRatio > THRESHOLDS.maxImageAreaRatio && metrics.imageCount > 0) {
    out.push(
      finding({
        ruleId: 'deliver/image-heavy',
        severity: 'P1',
        dimension: 'deliverability',
        title: `Images occupy about ${Math.round(metrics.imageToTextRatio * 100)}% of the email`,
        detail: `${metrics.imageCount} image${metrics.imageCount === 1 ? '' : 's'} against ${metrics.wordCount} words, over the ${Math.round(THRESHOLDS.maxImageAreaRatio * 100)}% guideline.`,
        impact: `${SUPPORT.imagesOffByDefault.effect} A message that is mostly image is also a long-standing spam heuristic.`,
        fix: 'Move key messages into live text, and keep imagery supporting rather than carrying the content.',
        clients: clientNames(SUPPORT.imagesOffByDefault.failsIn),
      }),
    );
  }

  /* --- legal and list hygiene ------------------------------------------- */

  if (!metrics.hasUnsubscribe) {
    out.push(
      finding({
        ruleId: 'deliver/no-unsubscribe',
        severity: isTemplate ? 'P2' : 'P1',
        dimension: 'deliverability',
        title: 'No unsubscribe link found',
        detail: 'No link or text in the document matches an unsubscribe or preference-centre pattern.',
        impact:
          'Commercial email without a working opt-out breaches CAN-SPAM and GDPR, and recipients who cannot unsubscribe mark the mail as spam instead — which damages sending reputation far more.',
        fix: `Add an unsubscribe link to the footer.${isTemplate ? ' If the sending platform injects one, this is fine to leave out of the template itself.' : ''}`,
      }),
    );
  }

  /* --- links -------------------------------------------------------------- */

  const linked = facts.links.filter((l) => l.kind === 'button' || l.href);
  const emptyHref = linked.filter((l) => !l.href.trim());
  if (emptyHref.length > 0) {
    out.push(
      finding({
        ruleId: 'deliver/empty-href',
        severity: 'P0',
        dimension: 'deliverability',
        title: `${emptyHref.length} link${emptyHref.length === 1 ? '' : 's'} have no destination`,
        detail: `Including ${listPhrase(emptyHref.slice(0, 3).map((l) => (l.text ? `"${excerpt(l.text, 24)}"` : `a ${l.kind}`)))}.`,
        impact: 'The primary action does nothing when clicked. This is the most damaging bug an email can ship with.',
        fix: 'Set a destination URL on every button and link.',
        blocks: [...new Set(emptyHref.map((l) => l.blockId))],
      }),
    );
  }

  const placeholderHref = linked.filter((l) => l.href.trim() && PLACEHOLDER_URL.test(l.href.trim()));
  if (placeholderHref.length > 0) {
    out.push(
      finding({
        ruleId: 'deliver/placeholder-href',
        // In a reusable template an unset href is the expected starting state,
        // not a defect — it only becomes blocking once a send is imminent.
        severity: isTemplate ? 'P2' : 'P0',
        dimension: 'deliverability',
        title: `${placeholderHref.length} link${placeholderHref.length === 1 ? '' : 's'} still point at a placeholder`,
        detail: `Found: ${listPhrase([...new Set(placeholderHref.map((l) => `\`${excerpt(l.href, 36)}\``))].slice(0, 3))}.`,
        impact: isTemplate
          ? 'Expected in a gallery template, but every one of these must be filled in before the template is sent.'
          : 'The recipient clicks and lands nowhere, and the click is still counted as engagement, so the failure is invisible in reporting.',
        fix: 'Replace every placeholder with the real destination.',
        blocks: [...new Set(placeholderHref.map((l) => l.blockId))],
      }),
    );
  }

  const relativeHref = linked.filter((l) => {
    const href = l.href.trim();
    if (!href || PLACEHOLDER_URL.test(href)) return false;
    return !/^(?:https?:|mailto:|tel:|\{\{|%%|\[%)/i.test(href);
  });
  if (relativeHref.length > 0) {
    out.push(
      finding({
        ruleId: 'deliver/relative-href',
        severity: 'P1',
        dimension: 'deliverability',
        title: `${relativeHref.length} link${relativeHref.length === 1 ? '' : 's'} are not absolute URLs`,
        detail: `Including \`${excerpt(relativeHref[0].href, 40)}\`.`,
        impact: 'An email has no base URL, so a relative link cannot resolve and will fail in every client.',
        fix: 'Use fully-qualified `https://` URLs, or a merge tag your sending platform expands into one.',
        blocks: [...new Set(relativeHref.map((l) => l.blockId))],
      }),
    );
  }

  const insecure = linked.filter((l) => /^http:\/\//i.test(l.href.trim()));
  if (insecure.length > 0) {
    out.push(
      finding({
        ruleId: 'deliver/insecure-href',
        severity: 'P2',
        dimension: 'deliverability',
        title: `${insecure.length} link${insecure.length === 1 ? '' : 's'} use plain http`,
        detail: `Including \`${excerpt(insecure[0].href, 40)}\`.`,
        impact: 'Mixed or insecure links lower reputation scores and can trigger browser interstitials that lose the click.',
        fix: 'Switch to `https://`.',
        blocks: [...new Set(insecure.map((l) => l.blockId))],
        autoFixable: true,
      }),
    );
  }

  /* --- preheader and subject -------------------------------------------- */

  // A preheader that was never supplied is a gap in the audit, not a defect
  // in the template — the engine records it under `notChecked` instead of
  // manufacturing a finding the author cannot act on from here.
  if (envelope.preheader !== undefined) {
    const preheader = envelope.preheader.trim();
    if (preheader === '') {
      out.push(
        finding({
          ruleId: 'deliver/preheader-empty',
          severity: 'P2',
          dimension: 'deliverability',
          title: 'Preheader is empty',
          detail: 'No preheader text is set on the campaign.',
          impact: 'Clients fall back to scraping the first text in the body, which is often a logo alt or "View in browser".',
          fix: 'Write 40-90 characters that continue the subject line and give a reason to open.',
        }),
      );
    } else if (preheader.length > 110) {
      out.push(
        finding({
          ruleId: 'deliver/preheader-too-long',
          severity: 'P3',
          dimension: 'deliverability',
          title: `Preheader is ${preheader.length} characters`,
          detail: `"${excerpt(preheader, 70)}"`,
          impact: 'Most clients truncate around 90 characters, so the end of the sentence is never seen.',
          fix: 'Trim to about 90 characters and front-load the point.',
        }),
      );
    }
  }

  if (typeof envelope.subject === 'string') {
    const subject = envelope.subject.trim();
    if (subject === '') {
      out.push(
        finding({
          ruleId: 'deliver/subject-empty',
          severity: 'P0',
          dimension: 'deliverability',
          title: 'Subject line is empty',
          detail: 'No subject was set.',
          impact: 'An empty subject is both a strong spam signal and an immediate reason not to open.',
          fix: 'Write a subject of roughly 30-50 characters.',
        }),
      );
    } else {
      if (subject.length > 60) {
        out.push(
          finding({
            ruleId: 'deliver/subject-too-long',
            severity: 'P3',
            dimension: 'deliverability',
            title: `Subject line is ${subject.length} characters`,
            detail: `"${excerpt(subject, 70)}"`,
            impact: 'Mobile inbox lists cut off around 35-45 characters, so the tail is lost where most mail is triaged.',
            fix: 'Trim toward 40 characters and put the distinguishing word first.',
          }),
        );
      }
      const shouty = subject === subject.toUpperCase() && /[A-Z]{4,}/.test(subject);
      const excessivePunctuation = /[!?]{2,}/.test(subject) || (subject.match(/!/g) ?? []).length > 1;
      if (shouty || excessivePunctuation) {
        out.push(
          finding({
            ruleId: 'deliver/subject-shouty',
            severity: 'P2',
            dimension: 'deliverability',
            title: 'Subject line uses spam-adjacent formatting',
            detail: `${shouty ? 'The subject is entirely uppercase.' : ''}${shouty && excessivePunctuation ? ' ' : ''}${excessivePunctuation ? 'It contains repeated exclamation or question marks.' : ''}`,
            impact: 'Both patterns are weighted by content filters and read as pushy to recipients.',
            fix: 'Use sentence case and at most one exclamation mark.',
          }),
        );
      }
    }
  }

  /* --- content filters ---------------------------------------------------- */

  const haystack = [
    ...facts.texts.map((t) => t.text),
    envelope.subject ?? '',
    envelope.preheader ?? '',
  ]
    .join(' ')
    .toLowerCase();
  const hits = SPAM_PHRASES.filter((phrase) => haystack.includes(phrase));
  if (hits.length >= 2) {
    out.push(
      finding({
        ruleId: 'deliver/spam-phrases',
        severity: 'P2',
        dimension: 'deliverability',
        title: `${hits.length} spam-associated phrases in the copy`,
        detail: `Found: ${listPhrase(hits.slice(0, 5).map((h) => `"${h}"`))}${hits.length > 5 ? `, +${hits.length - 5} more` : ''}.`,
        impact:
          'No single phrase gets an email filtered, but several together raise the content score enough to matter on a cold list.',
        fix: 'Rewrite in plainer language — say what the offer is rather than how urgent it is.',
      }),
    );
  }

  return out;
}
