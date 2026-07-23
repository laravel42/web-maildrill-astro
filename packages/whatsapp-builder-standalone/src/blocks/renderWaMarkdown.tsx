import React from 'react';

/**
 * Render WhatsApp's own text markup as React nodes:
 *
 *   *bold*   _italic_   ~strikethrough~   ```monospace```   {{n}} variables
 *
 * Deliberately non-nesting (single-level), mirroring how WhatsApp
 * itself treats markers, and newline-preserving. Variables render as
 * small chips so authors can spot them at a glance.
 */

const TOKEN_RE = /(\{\{\s*\d+\s*\}\})|```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

export function renderWaMarkdown(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  const pushPlain = (chunk: string) => {
    if (!chunk) return;
    const lines = chunk.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) out.push(<br key={`br-${key++}`} />);
      if (line) out.push(<React.Fragment key={`t-${key++}`}>{line}</React.Fragment>);
    });
  };

  for (const m of text.matchAll(TOKEN_RE)) {
    pushPlain(text.slice(last, m.index));
    const [, variable, mono, bold, italic, strike] = m;
    if (variable !== undefined) {
      out.push(
        <span key={`v-${key++}`} className="wa-variable">
          {variable.replace(/\s+/g, '')}
        </span>
      );
    } else if (mono !== undefined) {
      out.push(<code key={`m-${key++}`}>{mono}</code>);
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
