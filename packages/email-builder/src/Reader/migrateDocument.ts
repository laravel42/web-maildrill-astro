import { TReaderDocument } from './core';

/**
 * Migra un bloque Html retirado al bloque NotionText equivalente.
 * `props.contents` (HTML crudo) → `props.html`. El style coincide con el
 * de NotionText, por lo que se conserva tal cual. Texto plano se envuelve
 * en `<p>` para que TipTap pueda hidratarlo sin errores.
 */
function migrateHtmlBlock(block: any): any {
  const data = block.data ?? {};
  const style = data.style ?? {};
  const props = data.props ?? {};
  const rawContents = typeof props.contents === 'string' ? props.contents : '';
  const trimmed = rawContents.trim();
  const html =
    trimmed.length === 0
      ? '<p></p>'
      : /^<[a-zA-Z]/.test(trimmed)
        ? rawContents
        : `<p>${rawContents}</p>`;
  return {
    ...block,
    type: 'NotionText',
    data: {
      ...data,
      style,
      props: { html },
    },
  };
}

function escapeHeadingText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Migra un bloque Heading retirado al bloque NotionText equivalente
 * para el Reader. `props.{level,text}` → `props.html = '<hN>...</hN>'`,
 * `style` se preserva (campos compatibles con NotionText).
 */
function migrateHeadingBlock(block: any): any {
  const data = block.data ?? {};
  const style = data.style ?? {};
  const props = data.props ?? {};
  const rawLevel = typeof props.level === 'string' ? props.level : 'h2';
  const level = rawLevel === 'h1' || rawLevel === 'h2' || rawLevel === 'h3' ? rawLevel : 'h2';
  const rawText = typeof props.text === 'string' ? props.text : '';
  const html = `<${level}>${escapeHeadingText(rawText)}</${level}>`;
  return {
    ...block,
    type: 'NotionText',
    data: {
      ...data,
      style,
      props: { html },
    },
  };
}

/**
 * Migra bloques legacy a sus equivalentes actuales para el Reader:
 *
 * - `CustomEditor` → `NotionText` (rename de tipo, datos compatibles).
 * - `Wysiwyg`      → `NotionText` (rename de tipo, mismo shape de data).
 * - `Html`         → `NotionText` (envoltura de `props.contents` en `props.html`).
 * - `Heading`      → `NotionText` (envoltura de `props.text` en
 *                    `<hN>...</hN>` dentro de `props.html`).
 *
 * Otros tipos quedan intactos. Los migrators se mantienen activos para
 * que documentos antiguos sigan renderizándose sin pérdida de contenido.
 */
export function migrateReaderDocument(document: TReaderDocument): TReaderDocument {
  let result: TReaderDocument | null = null;

  for (const [blockId, block] of Object.entries(document)) {
    const blockType = (block as { type?: string }).type;
    if (blockType === 'CustomEditor' || blockType === 'Wysiwyg') {
      if (!result) result = { ...document };
      result[blockId] = { ...block, type: 'NotionText' as any } as any;
    } else if (blockType === 'Html') {
      if (!result) result = { ...document };
      result[blockId] = migrateHtmlBlock(block) as any;
    } else if (blockType === 'Heading') {
      if (!result) result = { ...document };
      result[blockId] = migrateHeadingBlock(block) as any;
    }
  }

  return result ?? document;
}
