import * as React from 'react';

import { VARIABLE_RE } from '../core/variables';

/**
 * WhatsApp text rendering: *bold* _italic_ ~strike~ ```mono``` plus
 * {{n}} variables. Variables render as either their example value
 * (when set) or a highlighted chip — exactly what the real client
 * would show once sent vs. what an author needs while editing.
 */

const TOKEN_RE = /(\{\{\s*\d+\s*\}\})|```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

export function renderWaText(
  text: string,
  resolveVariable: (n: number) => string,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  const pushPlain = (chunk: string) => {
    if (!chunk) return;
    chunk.split('\n').forEach((line, i) => {
      if (i > 0) out.push(<br key={`br-${key++}`} />);
      if (line) out.push(<React.Fragment key={`t-${key++}`}>{line}</React.Fragment>);
    });
  };

  for (const m of text.matchAll(TOKEN_RE)) {
    pushPlain(text.slice(last, m.index));
    const [, variable, mono, bold, italic, strike] = m;
    if (variable !== undefined) {
      const n = Number(variable.replace(/[^\d]/g, ''));
      const example = resolveVariable(n);
      out.push(
        example ? (
          <span key={`v-${key++}`} className="rounded-[3px] bg-emerald-500/15 px-0.5 text-inherit">
            {example}
          </span>
        ) : (
          <span
            key={`v-${key++}`}
            className="mx-px inline-block rounded-[4px] bg-emerald-600/20 px-1 text-[0.85em] font-semibold leading-[1.5] text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300"
          >
            {`{{${n}}}`}
          </span>
        ),
      );
    } else if (mono !== undefined) {
      out.push(
        <code key={`m-${key++}`} className="font-mono text-[0.92em]">
          {mono}
        </code>,
      );
    } else if (bold !== undefined) {
      out.push(<strong key={`b-${key++}`}>{bold}</strong>);
    } else if (italic !== undefined) {
      out.push(<em key={`i-${key++}`}>{italic}</em>);
    } else if (strike !== undefined) {
      out.push(<s key={`s-${key++}`}>{strike}</s>);
    }
    last = (m.index ?? 0) + m[0].length;
  }
  pushPlain(text.slice(last));

  return out;
}

/** Plain-string substitution (for places chips don't make sense). */
export function substituteVariables(text: string, resolveVariable: (n: number) => string): string {
  return text.replace(VARIABLE_RE, (m, d: string) => resolveVariable(Number(d)) || m);
}
