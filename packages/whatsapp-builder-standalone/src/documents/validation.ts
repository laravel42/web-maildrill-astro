import { collectSections } from './components';
import type { TWhatsAppConfiguration } from './schemas';
import { extractVariables, LIMITS, maxForButtonType, type WaButtonType } from './whatsapp';

/**
 * Validate a document against WhatsApp Business template rules. Returns
 * i18n keys (waInspector namespace) plus optional interpolation params,
 * so the inspector can render them localized. Non-blocking: the builder
 * surfaces issues but never refuses to save a draft.
 */

export type ValidationIssue = {
  /** Section the issue belongs to, for grouping in the panel. */
  section: 'header' | 'body' | 'footer' | 'buttons' | 'message';
  /** i18n key under `validation.` in the waInspector namespace. */
  key: string;
  params?: Record<string, string | number>;
};

export function validateWhatsAppDocument(document: TWhatsAppConfiguration): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { header, body, footer, buttons } = collectSections(document);

  // Body is the only required section.
  const bodyText = body?.props?.text ?? '';
  if (!bodyText.trim()) {
    issues.push({ section: 'body', key: 'bodyRequired' });
  } else if (bodyText.length > LIMITS.BODY_TEXT_MAX) {
    issues.push({ section: 'body', key: 'bodyTooLong', params: { max: LIMITS.BODY_TEXT_MAX } });
  }

  // Variables must be sequential starting at {{1}} ({{1}},{{2}},… no gaps).
  const vars = extractVariables(bodyText);
  if (vars.length > 0) {
    const unique = [...new Set(vars)].sort((a, b) => a - b);
    const sequential = unique.every((n, i) => n === i + 1);
    if (!sequential) issues.push({ section: 'body', key: 'variablesNotSequential' });
  }

  if (header) {
    const p = header.props ?? {};
    const headerText = p.text ?? '';
    if ((p.format ?? 'text') === 'text') {
      if (!headerText.trim()) issues.push({ section: 'header', key: 'headerTextEmpty' });
      else if (headerText.length > LIMITS.HEADER_TEXT_MAX)
        issues.push({ section: 'header', key: 'headerTooLong', params: { max: LIMITS.HEADER_TEXT_MAX } });
      const headerVars = extractVariables(headerText);
      if (headerVars.length > 1 || (headerVars.length === 1 && headerVars[0] !== 1)) {
        issues.push({ section: 'header', key: 'headerVariableLimit' });
      }
    } else if (['image', 'video', 'document'].includes(p.format ?? '') && !(p.mediaUrl ?? '').trim()) {
      issues.push({ section: 'header', key: 'headerMediaMissing' });
    }
  }

  const footerText = footer?.props?.text ?? '';
  if (footer && footerText.length > LIMITS.FOOTER_TEXT_MAX) {
    issues.push({ section: 'footer', key: 'footerTooLong', params: { max: LIMITS.FOOTER_TEXT_MAX } });
  }

  if (buttons) {
    const list = buttons.props?.buttons ?? [];
    if (list.length > LIMITS.MAX_BUTTONS) {
      issues.push({ section: 'buttons', key: 'tooManyButtons', params: { max: LIMITS.MAX_BUTTONS } });
    }
    const counts = new Map<WaButtonType, number>();
    for (const b of list) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
    for (const [type, count] of counts) {
      if (type !== 'QUICK_REPLY' && count > maxForButtonType(type)) {
        issues.push({ section: 'buttons', key: 'tooManyOfType', params: { type, max: maxForButtonType(type) } });
      }
    }
    list.forEach((b, i) => {
      const n = i + 1;
      const text = b.text ?? '';
      if (b.type !== 'COPY_CODE' && !text.trim())
        issues.push({ section: 'buttons', key: 'buttonTextEmpty', params: { n } });
      if (text.length > LIMITS.BUTTON_TEXT_MAX)
        issues.push({ section: 'buttons', key: 'buttonTextTooLong', params: { n, max: LIMITS.BUTTON_TEXT_MAX } });
      if (b.type === 'URL' && !(b.url ?? '').trim())
        issues.push({ section: 'buttons', key: 'buttonUrlEmpty', params: { n } });
      if (b.type === 'PHONE_NUMBER' && !(b.phoneNumber ?? '').trim())
        issues.push({ section: 'buttons', key: 'buttonPhoneEmpty', params: { n } });
      if (b.type === 'COPY_CODE' && !(b.couponCode ?? '').trim())
        issues.push({ section: 'buttons', key: 'buttonCodeEmpty', params: { n } });
    });
  }

  return issues;
}
