/** Same tokens the preview renders as formatting (renderWaText), minus
 * variables — {{n}} placeholders must survive a "clear formatting". */
const FORMAT_TOKEN_RE = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

/**
 * Strip WhatsApp inline markup (*bold* _italic_ ~strike~ ```mono```) keeping
 * the inner text. Iterates so nested markers (*_both_*) unwrap fully; markers
 * that the preview would show literally (unpaired, empty) are left alone.
 */
export function clearWaFormatting(text: string): string {
  let prev = text;
  for (;;) {
    const next = prev.replace(
      FORMAT_TOKEN_RE,
      (_, mono?: string, bold?: string, italic?: string, strike?: string) =>
        mono ?? bold ?? italic ?? strike ?? '',
    );
    if (next === prev) return next;
    prev = next;
  }
}
