import { TEditorConfiguration } from './core';

/**
 * Migra un bloque Html retirado al bloque NotionText equivalente:
 *
 * - `props.contents` (HTML crudo) → `props.html`. Cuando el contenido es
 *   solo texto plano o está vacío se envuelve en `<p>` para que TipTap lo
 *   pueda parsear sin perder estructura.
 * - El `style` de Html (color, backgroundColor, fontFamily, fontSize,
 *   textAlign, padding) coincide con campos válidos del style de
 *   NotionText, por lo que se reutiliza tal cual.
 */
function migrateHtmlBlock(block: any): any {
  const data = block.data ?? {};
  const style = data.style ?? {};
  const props = data.props ?? {};
  const rawContents = typeof props.contents === 'string' ? props.contents : '';
  const trimmed = rawContents.trim();
  // TipTap requires at least one block-level element. Wrap bare text in
  // a paragraph so the editor can hydrate without errors. Empty payloads
  // collapse to `<p></p>` (the NotionText empty-document baseline).
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

/**
 * Escape HTML special characters in a heading text payload before
 * embedding it in the NotionText `html` field. Matches the migration
 * applied to `getConfiguration/sample/*.ts` so behaviour is consistent
 * across in-memory documents and saved JSON.
 */
function escapeHeadingText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Migra un bloque Heading retirado al bloque NotionText equivalente.
 * `props.{level,text}` se traduce a `props.html = '<hN>...</hN>'`. El
 * `style` (color, backgroundColor, fontFamily, fontWeight, textAlign,
 * padding) se preserva tal cual porque coincide con los campos válidos
 * del style de NotionText. Niveles fuera de h1/h2/h3 caen a h2 — el
 * default histórico del bloque Heading.
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
 * Migra bloques legacy a sus equivalentes actuales:
 *
 * - `CustomEditor` → `NotionText` (rename de tipo, datos compatibles).
 * - `Html` → `NotionText` (envoltura de `props.contents` en `props.html`).
 * - `Heading` → `NotionText` (envoltura de `props.text` en
 *   `<hN>...</hN>` dentro de `props.html`).
 *
 * Otros tipos quedan intactos. Los migrators se mantienen activos para
 * que documentos guardados antes de la baja del bloque sigan abriéndose
 * sin pérdida de contenido.
 */
export function migrateDocument(document: TEditorConfiguration): TEditorConfiguration {
  const migratedDocument = { ...document };

  for (const [blockId, block] of Object.entries(migratedDocument)) {
    const blockType = (block as { type?: string }).type;
    if (blockType === 'CustomEditor') {
      migratedDocument[blockId] = {
        ...block,
        type: 'NotionText' as any,
      } as any;
    } else if (blockType === 'Html') {
      migratedDocument[blockId] = migrateHtmlBlock(block);
    } else if (blockType === 'Heading') {
      migratedDocument[blockId] = migrateHeadingBlock(block);
    }
  }

  return migratedDocument;
}
