// Print the block tree of a converted template so structural regressions
// (collapsed columns, orphaned spacers, lost padding) are visible at a glance.
//
//   node scripts/dump-template-tree.mjs 01-business

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = path.join(ROOT, 'packages/email-builder-standalone/src/App/ComponentsLibrary/templates/json');

const slug = process.argv[2] ?? '01-business';
const doc = JSON.parse(fs.readFileSync(path.join(JSON_DIR, `${slug}.json`), 'utf8'));

const pad = (p) => (p ? `p[${p.top},${p.right},${p.bottom},${p.left}]` : '');
const label = (b) => {
  const s = b.data?.style ?? {};
  switch (b.type) {
    case 'NotionText':
      return `${s.fontSize}px/${s.fontWeight} ${s.color} ${JSON.stringify(
        (b.data.props?.html || '').replace(/<[^>]+>/g, '').slice(0, 46)
      )}`;
    case 'Image':
      return `size=${b.data.props?.size} scale=${b.data.props?.scale} w=${b.data.props?.width}`;
    case 'Button':
      return `${JSON.stringify(b.data.props?.text)} bg=${b.data.props?.buttonBackgroundColor}`;
    case 'Divider':
      return `${s.color} h=${s.height} w=${s.width}%`;
    case 'Spacer':
      return `h=${s.height}`;
    case 'ColumnsContainer':
      return `count=${b.data.props?.columnsCount} widths=${JSON.stringify(b.data.props?.fixedWidths)}`;
    case 'Container':
      return `bg=${s.backgroundColor} border=${s.borderColor}/${s.borderTop}${s.borderBottom}`;
    default:
      return '';
  }
};

const walk = (id, depth = 0) => {
  const b = doc[id];
  if (!b) return console.log(`${'  '.repeat(depth)}!! missing ${id}`);
  console.log(`${'  '.repeat(depth)}${b.type} ${pad(b.data?.style?.padding)} ${label(b)}`);
  if (b.type === 'EmailLayout') (b.data.childrenIds || []).forEach((c) => walk(c, depth + 1));
  else if (b.type === 'Container') (b.data.props?.childrenIds || []).forEach((c) => walk(c, depth + 1));
  else if (b.type === 'ColumnsContainer')
    (b.data.props?.columns || []).forEach((col, i) => {
      if (!col.childrenIds?.length) return;
      console.log(`${'  '.repeat(depth + 1)}· col${i}`);
      col.childrenIds.forEach((c) => walk(c, depth + 2));
    });
};

walk('root');
console.log(`\n${Object.keys(doc).length} blocks`);
