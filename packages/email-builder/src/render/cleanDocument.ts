import { minify as cssoMinify } from 'csso';

import {
  type ResolvableBlock,
  resolveBlockData,
  type ThemeJson,
  type Viewport,
} from '@eb/document-core';

import { getFontFamily } from '../helpers/fontFamily';
import { shortCssId } from '../helpers/utils';
import { READER_SCHEMA_DEFAULTS_BY_TYPE } from '../Reader/core';

// Umbral conservador para el tamaño del CSS en la cabecera (Android puede truncar estilos grandes)
// Ajusta este valor según tu tolerancia o datos de QA.
const CSS_HEADER_CHAR_LIMIT = 16350; // ~8 KB

interface PaddingConfig {
  top: number;
  bottom: number;
  right: number;
  left: number;
}

interface StyleData {
  fontWeight?: string;
  fontSize?: number;
  mobilePadding?: PaddingConfig;
  padding?: PaddingConfig;
  borderBottomMobile?: string;
  borderLeftMobile?: string;
  borderRightMobile?: string;
  borderTopMobile?: string;
  borderColor?: string;
  fontSizeMobile?: number;
  textAlignMobile?: string;
  widthMobile?: string;
  heightMobile?: string;
  objectFitMobile?: string;
  objectPositionMobile?: string;
  // Propiedades de NotionText
  fontFamily?: string;
  color?: string;
  lineHeight?: string;
  textAlign?: string;
  backgroundColor?: string;
}

interface PropsData {
  scaleMobile?: number;
  stackColumnsOnMobile?: boolean;
  fullWidth?: boolean;
  fullWidthMobile?: boolean;
}

interface BlockData {
  type: string;
  data: {
    style: StyleData;
    props: PropsData;
  };
  gapMobile?: number;
  gap?: number;
}

interface TReaderDocument {
  [key: string]: any;
}

const minifyCSS = (css: string): string => {
  try {
    return cssoMinify(css, { restructure: false }).css;
  } catch {
    // En caso de cualquier error, devolver el CSS tal cual (o con trim)
    return css.trim();
  }
};

const splitMobileRules = (css: string): { base: string; mobile: string } => {
  let base = '';
  let mobile = '';
  let i = 0;
  const headerPattern = /^@media\s+(?:screen\s+and\s*)?\(max-width:\s*640px\)\s*\{/;

  while (i < css.length) {
    const atIndex = css.indexOf('@media', i);
    if (atIndex === -1) {
      base += css.slice(i);
      break;
    }

    base += css.slice(i, atIndex);

    const rest = css.slice(atIndex);
    const headerMatch = headerPattern.exec(rest);
    if (!headerMatch) {
      base += '@media';
      i = atIndex + 6;
      continue;
    }

    let j = atIndex + headerMatch[0].length;
    let depth = 1;

    while (j < css.length && depth > 0) {
      const ch = css[j];

      if (ch === '/' && j + 1 < css.length && css[j + 1] === '*') {
        j += 2;
        while (j < css.length && !(css[j] === '*' && css[j + 1] === '/')) j++;
        j += 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        j++;
        while (j < css.length) {
          if (css[j] === '\\') {
            j += 2;
            continue;
          }
          if (css[j] === quote) {
            j++;
            break;
          }
          j++;
        }
        continue;
      }
      if (ch === '{') {
        depth++;
        j++;
        continue;
      }
      if (ch === '}') {
        depth--;
        j++;
        continue;
      }
      j++;
    }

    const innerStart = atIndex + headerMatch[0].length;
    const innerEnd = j - 1;
    if (innerEnd >= innerStart) {
      mobile += css.slice(innerStart, innerEnd);
    }
    i = j;
  }

  return { base, mobile };
};

// Función para determinar qué tipos de bloque usan container- como prefijo
const usesContainerPrefix = (blockType: string): boolean => {
  const containerTypes = ['Button', 'Divider']; // Agrega aquí los tipos que usan container-
  return containerTypes.includes(blockType);
};

// Función para generar el identificador correcto para las clases de padding
const getPaddingClassId = (blockId: string, blockType: string): string => {
  const id = shortCssId(blockId);
  if (usesContainerPrefix(blockType)) {
    return `c${id}`;
  }
  return id;
};

// Normaliza tamaños (e.g. '0', '0px', 0, '12', '12px') a número en px
const normalizeSize = (v: string | number | undefined | null): number | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === 'auto') return null;
  if (s === '0' || s === '0px') return 0;
  const m = s.match(/^(-?\d+(?:\.\d+)?)(px)?$/);
  if (m) return parseFloat(m[1]);
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
};

// Función corregida para generar CSS de padding
const generatePaddingCSS = (
  blockId: string,
  padding: PaddingConfig,
  blockType: string,
  isMobile = false,
): string => {
  if (!padding) {
    return '';
  }

  const paddingClassId = getPaddingClassId(blockId, blockType);

  const top = normalizeSize(padding.top) ?? 0;
  const bottom = normalizeSize(padding.bottom) ?? 0;
  const left = normalizeSize(padding.left) ?? 0;
  const right = normalizeSize(padding.right) ?? 0;

  const px = (n: number) => (n === 0 ? '0' : `${n}px`);

  const parts: string[] = [];

  if (top === bottom) {
    parts.push(`.t${paddingClassId},.b${paddingClassId}{height:${px(top)} !important;}`);
  } else {
    parts.push(`.t${paddingClassId}{height:${px(top)} !important;}`);
    parts.push(`.b${paddingClassId}{height:${px(bottom)} !important;}`);
  }

  if (left === right) {
    parts.push(`.l${paddingClassId},.r${paddingClassId}{width:${px(left)} !important;}`);
  } else {
    parts.push(`.l${paddingClassId}{width:${px(left)} !important;}`);
    parts.push(`.r${paddingClassId}{width:${px(right)} !important;}`);
  }

  const cssRules = parts.join('');

  if (isMobile) {
    return `
@media (max-width: 640px) {
  ${cssRules}
}`;
  }

  return `
  ${cssRules}
  `;
};

const generateBorderMobileCSS = (
  blockId: string,
  borderData: {
    borderBottomMobile?: string;
    borderLeftMobile?: string;
    borderRightMobile?: string;
    borderTopMobile?: string;
    borderColor?: string;
  },
  _blockType: string,
): string => {
  const {
    borderBottomMobile,
    borderLeftMobile,
    borderRightMobile,
    borderTopMobile,
    borderColor = '#000',
  } = borderData;

  const t = normalizeSize(borderTopMobile);
  const r = normalizeSize(borderRightMobile);
  const b = normalizeSize(borderBottomMobile);
  const l = normalizeSize(borderLeftMobile);

  if (t === null && r === null && b === null && l === null) return '';

  const classId = shortCssId(blockId);

  const ruleFor = (side: 'top' | 'right' | 'bottom' | 'left', val: number | null): string => {
    if (val === null) return '';
    if (val === 0) return `border-${side}:0 !important;`;
    return `border-${side}:${val}px solid ${borderColor} !important;`;
  };

  const allDefined = [t, r, b, l].every((v) => v !== null);
  if (allDefined && t === r && r === b && b === l) {
    const v = t as number;
    const body =
      v === 0 ? 'border:0 !important;' : `border:${v}px solid ${borderColor} !important;`;
    return `
@media (max-width: 640px) {
  .${classId}{${body}}
}`;
  }

  const parts = [ruleFor('top', t), ruleFor('right', r), ruleFor('bottom', b), ruleFor('left', l)]
    .filter(Boolean)
    .join('');

  return parts
    ? `
@media (max-width: 640px) {
  .${classId}{${parts}}
}`
    : '';
};

type ButtonPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const generateInnerPaddingMobileCSS = (
  size: string | ButtonPadding,
  blockId: string,
  blockType: string,
): string => {
  const paddingClassId = getPaddingClassId(blockId, blockType);

  if (typeof size !== 'string') {
    const top = normalizeSize(size.top) ?? 0;
    const bottom = normalizeSize(size.bottom) ?? 0;
    const left = normalizeSize(size.left) ?? 0;
    const right = normalizeSize(size.right) ?? 0;
    const px = (n: number) => (n === 0 ? '0' : `${n}px`);

    const parts: string[] = [];
    if (left === right) {
      parts.push(`.il${paddingClassId},.ir${paddingClassId}{width:${px(left)} !important;}`);
    } else {
      parts.push(`.il${paddingClassId}{width:${px(left)} !important;}`);
      parts.push(`.ir${paddingClassId}{width:${px(right)} !important;}`);
    }
    if (top === bottom) {
      parts.push(`.it${paddingClassId},.ib${paddingClassId}{height:${px(top)} !important;}`);
    } else {
      parts.push(`.it${paddingClassId}{height:${px(top)} !important;}`);
      parts.push(`.ib${paddingClassId}{height:${px(bottom)} !important;}`);
    }

    return `
@media (max-width: 640px) {
  ${parts.join('')}
}`;
  }

  let paddingRules: string;
  switch (size) {
    case 'x-small':
      paddingRules = `
  .il${paddingClassId},.ir${paddingClassId}{width:8px !important;}
  .it${paddingClassId},.ib${paddingClassId}{height:4px !important;}`;
      break;
    case 'small':
      paddingRules = `
  .il${paddingClassId},.ir${paddingClassId}{width:12px !important;}
  .it${paddingClassId},.ib${paddingClassId}{height:8px !important;}`;
      break;
    case 'large':
      paddingRules = `
  .il${paddingClassId},.ir${paddingClassId}{width:24px !important;}
  .it${paddingClassId},.ib${paddingClassId}{height:16px !important;}`;
      break;
    case 'medium':
    default:
      paddingRules = `
  .il${paddingClassId},.ir${paddingClassId}{width:20px !important;}
  .it${paddingClassId},.ib${paddingClassId}{height:12px !important;}`;
      break;
  }

  return `
@media (max-width: 640px) {
  ${paddingRules}
}`;
};

const cleanDocument = (
  document: TReaderDocument,
  options: { viewport?: Viewport } = {},
): { cleanedDocument: TReaderDocument; css: string } => {
  const cleanedDocument = JSON.parse(JSON.stringify(document));

  // Theme is shared across all blocks; read once. Used as level 2 of
  // the resolution chain so per-block-type theme overrides surface in
  // the emitted CSS without each generator needing to know about the
  // theme.
  const themeRoot = (cleanedDocument as { root?: { data?: { theme?: ThemeJson } } }).root;
  const theme: ThemeJson | null = themeRoot?.data?.theme ?? null;

  // The base CSS rules emitted by `cleanDocument` accompany the inline
  // styles produced by the renderer (`Reader` after L42-312 Phase 5).
  // They MUST resolve to the same viewport the renderer is rendering
  // for, otherwise the `!important` rules emitted here override the
  // inline values and the user sees stale styles. The export pipeline
  // (`renderToStaticMarkup`) forces `'desktop'` so the produced HTML
  // works in clients that strip `<style>` blocks (Outlook desktop).
  const baseViewport: Viewport = options.viewport ?? 'desktop';

  const styleProperties: Array<{
    property: keyof StyleData;
    cssGenerator: (blockId: string, value: any, type: string) => string;
  }> = [
    {
      property: 'padding',
      cssGenerator: (blockId: string, value: PaddingConfig, type: string) =>
        generatePaddingCSS(blockId, value, type, false),
    },
    {
      property: 'mobilePadding',
      cssGenerator: (blockId: string, value: PaddingConfig, type: string) =>
        generatePaddingCSS(blockId, value, type, true),
    },
    {
      property: 'fontSizeMobile',
      cssGenerator: (blockId: string, value: number, type?: string) => {
        const id = shortCssId(blockId);
        if (type === 'Button') {
          return `
@media (max-width: 640px) {
  .${id} span.btn${id} {
    font-size: ${value}px !important;
  }
}`;
        }
        if (type === 'NotionText') {
          return `
@media (max-width: 640px) {
  .nt${id} p, .nt${id} li { font-size: ${value}px !important; }
  .nt${id} h1 { font-size: ${value * 2}px !important; }
  .nt${id} h2 { font-size: ${value * 1.5}px !important; }
  .nt${id} h3 { font-size: ${value * 1.17}px !important; }
}`;
        }
        return `
@media (max-width: 640px) {
  .${id} {
    font-size: ${value}px !important;
  }
}`;
      },
    },
    {
      property: 'widthMobile',
      cssGenerator: (blockId: string, value: string, _type: string) => {
        const id = shortCssId(blockId);

        return `
@media (max-width: 640px) {
  .${id} {
    width: ${value}% !important;
  }
}`;
      },
    },
    {
      property: 'heightMobile',
      cssGenerator: (blockId: string, value: string, type: string) => {
        const id = shortCssId(blockId);
        if (type === 'Divider' || type === 'Spacer') {
          return `
@media (max-width: 640px) {
  .${id} .it${id} {
    height: ${value}px !important;
  }
}`;
        }
        if (type === 'Image') {
          /* Image renderer emits its desktop height inline on the
           * `<img>` itself (`height: 320px`). The wrapper table
           * doesn't constrain image height — we must target the
           * `<img>` so the mobile override actually shrinks/grows
           * the picture. */
          return `
@media (max-width: 640px) {
  .${id} img {
    height: ${value}px !important;
  }
}`;
        }
        return `
@media (max-width: 640px) {
  .${id} {
    height: ${value}px !important;
  }
}`;
      },
    },
    {
      property: 'objectFitMobile',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'Image') return '';
        const id = shortCssId(blockId);
        return `
@media (max-width: 640px) {
  .${id} img {
    object-fit: ${value} !important;
  }
}`;
      },
    },
    {
      property: 'objectPositionMobile',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'Image') return '';
        const id = shortCssId(blockId);
        return `
@media (max-width: 640px) {
  .${id} img {
    object-position: ${value} !important;
  }
}`;
      },
    },
    {
      property: 'textAlignMobile',
      cssGenerator: (blockId: string, value: string, type: string) => {
        const id = shortCssId(blockId);
        if (type === 'Button') {
          /* Only text-align; avoid width/display on td (breaks shrink-to-content + center). */
          return `
@media (max-width: 640px) {
  .c${id} .ac${id} {
    text-align: ${value} ;
  }          
}`;
        }
        if (type === 'SocialMedia') {
          const margin =
            value === 'center'
              ? 'margin-left: auto !important; margin-right: auto !important;'
              : value === 'right'
                ? 'margin-left: auto !important; margin-right: 0 !important;'
                : '';
          return `
@media (max-width: 640px) {
  .${id} .a${id} {
    text-align: ${value} !important;
  }${margin ? `\n  .${id} .sm-icons-table {\n    ${margin}\n  }` : ''}
}`;
        }
        if (type === 'Divider') {
          return `
@media (max-width: 640px) {
  .c${id} .ac${id} {
    text-align: ${value} ;
  }     
  .c${id} .${id} {
    display: inline-block ;
  } 
}`;
        }
        return `
@media (max-width: 640px) {
  .${id} .a${id} {
    text-align: ${value} ;
  }
}`;
      },
    },

    // ========== NUEVAS PROPIEDADES PARA NOTIONTEXT ==========

    {
      property: 'fontFamily',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'NotionText') return '';
        // Solo generar CSS si NO es 'INHERIT' (valor por defecto que hereda del EmailLayout)
        if (value === 'INHERIT' || !value) return '';
        const id = shortCssId(blockId);
        // Resolver el valor real de la fuente usando getFontFamily
        const fontValue = getFontFamily(value as any);
        return `.nt${id} { font-family: ${fontValue}; }`;
      },
    },

    {
      property: 'fontSize',
      cssGenerator: (blockId: string, value: number, type: string) => {
        if (type !== 'NotionText') return '';
        const id = shortCssId(blockId);
        return `
.nt${id} p, .nt${id} li { font-size: ${value}px; margin: 0; }
.nt${id} h1 { font-size: ${value * 2}px; font-weight: bold; margin: 0; }
.nt${id} h2 { font-size: ${value * 1.5}px; font-weight: bold; margin: 0; }
.nt${id} h3 { font-size: ${value * 1.17}px; font-weight: bold; margin: 0; }
.nt${id} ul, .nt${id} ol { list-style-position: inside; margin: 0; padding-left: 1.5em; }`;
      },
    },

    {
      property: 'color',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'NotionText') return '';
        // Solo generar CSS si el color está definido (no null/undefined)
        // Si no está definido, heredará el color del EmailLayout
        if (!value) return '';
        const id = shortCssId(blockId);
        return `.nt${id} { color: ${value}; }`;
      },
    },

    {
      property: 'lineHeight',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'NotionText') return '';
        const id = shortCssId(blockId);
        return `.nt${id} { line-height: ${value}; }`;
      },
    },

    {
      property: 'fontWeight',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'NotionText') return '';
        const id = shortCssId(blockId);
        return `.nt${id} { font-weight: ${value}; }`;
      },
    },

    {
      property: 'textAlign',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'NotionText') return '';
        const id = shortCssId(blockId);
        return `.nt${id} { text-align: ${value}; }`;
      },
    },

    {
      property: 'backgroundColor',
      cssGenerator: (blockId: string, value: string, type: string) => {
        if (type !== 'NotionText') return '';
        const id = shortCssId(blockId);
        return `.nt${id} { background-color: ${value}; }`;
      },
    },
  ];

  const propsProperties: Array<{
    property: string;
    cssGenerator: (blockId: string, value: any, blockType: string, allProps?: PropsData) => string;
  }> = [
    {
      property: 'scaleMobile',
      cssGenerator: (blockId: string, value: number, blockType: string) => {
        const id = shortCssId(blockId);
        if (blockType === 'Image') {
          return `
@media (max-width: 640px) {
  .${id} img {
    width: ${value}% !important;
  }
}`;
        }
        return '';
      },
    },
    {
      property: 'gapMobile',
      cssGenerator: (blockId: string, value: number, blockType: string) => {
        const id = shortCssId(blockId);
        if (blockType === 'SocialMedia') {
          return `
@media (max-width: 640px) {
  .${id} .gap-${id} {
    width: ${value}px ;
  }
}`;
        }
        return '';
      },
    },
    {
      property: 'fullWidthMobile',
      cssGenerator: (blockId: string, value: boolean, type: string) => {
        const id = shortCssId(blockId);
        if (type === 'Button') {
          /* Export render uses desktop breakpoints for inline width; override on small screens. */
          if (value) {
            /* Inner table is emitted with inline display:inline-block when desktop fullWidth is false; that beats non-!important width in many clients. Force block + 100% in the mobile sheet. */
            /* Outer content cell .c${id} .ac${id}: nested Wrapper (e.g. inside Container) often shrink-wraps this td without width="100%" in the markup — reinforce in CSS for small viewports. */
            return `
@media (max-width: 640px) {
  .c${id} .ac${id} {
    width: 100% !important;
    max-width: 100% !important;
  }
  .abtn-${id} {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .${id} {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
}`;
          }
          return `
@media (max-width: 640px) {
  .abtn-${id} {
    display: inline-block !important;
    width: auto !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .${id} {
    width: auto !important;
    max-width: 100% !important;
    display: inline-block !important;
    box-sizing: border-box !important;
  }
}`;
        }
        return '';
      },
    },
    {
      property: 'sizeMobile',
      cssGenerator: (blockId: string, value: string | ButtonPadding, type: string) => {
        if (type === 'Button') {
          return generateInnerPaddingMobileCSS(value, blockId, type);
        }
        if (type === 'Image' && value === 'fill') {
          /* Mobile resizing semantics: when the user picks "fill" for
           * mobile (sizeMobile='fill'), the inline desktop width
           * (which can be a fixed `getWidth(size, scale)` result like
           * 25%) needs to be overridden so the picture stretches to
           * the column. Pair with `scaleMobile` (handled separately)
           * and `widthMobile` (pixel mode below) to cover all sizing
           * modes. We deliberately do NOT touch height here — height
           * is owned by `style.height` / `style.heightMobile`. An
           * earlier version emitted `height: auto !important` which
           * fired LATER than `heightMobile` in the @media block and
           * silently clobbered an explicit mobile height. */
          const id = shortCssId(blockId);
          return `
@media (max-width: 640px) {
  .${id} img {
    width: 100% !important;
  }
}`;
        }
        return '';
      },
    },
    {
      property: 'widthMobile',
      cssGenerator: (
        blockId: string,
        value: number | string | null | undefined,
        type: string,
        allProps?: PropsData,
      ) => {
        if (type !== 'Image') return '';
        if (value === null || value === undefined) return '';
        // Pixel rule only applies in original / pixel modes. Fill and
        // scale handle their own widths (`sizeMobile==='fill'` rule
        // above + `scaleMobile` rule near the top). Without this
        // guard, the px rule would override a scale percentage and
        // pin the image to a fixed width on mobile.
        const sm = (allProps as Record<string, unknown> | undefined)?.sizeMobile;
        if (sm === 'fill' || sm === 'scale') return '';
        const id = shortCssId(blockId);
        return `
@media (max-width: 640px) {
  .${id} img {
    width: ${value}px !important;
  }
}`;
      },
    },
    {
      property: 'contentAlignmentMobile',
      cssGenerator: (blockId: string, value: string, type: string) => {
        const id = shortCssId(blockId);
        if (type === 'ColumnsContainer') {
          return `
@media (max-width: 640px) {
  .${id} .col${id} {
    vertical-align: ${value} ;
  }
}`;
        }
        return '';
      },
    },
    {
      property: 'stackColumnsOnMobile',
      cssGenerator: (blockId: string, value: boolean, type: string) => {
        if (type !== 'ColumnsContainer' || !value) return '';
        const id = shortCssId(blockId);
        /* Scope to the columns layout table only (direct child of Wrapper center td)
         * AND its direct tbody / tr. Without the explicit `>` combinators the
         * descendant selectors `... > table tbody` / `... > table tr` matched
         * EVERY nested tbody/tr — in particular each Image wrapper's 3x3 padding
         * table — and `display:block` on those broke the picture's row layout.
         * The image's `<td class="a${imgId}" style="width:100%">` cell stopped
         * being rendered as a table-cell and the picture stayed at the desktop
         * column width on mobile. Direct-child combinators keep the rule
         * scoped to the columns layout.
         *
         * The horizontal padding reset drops `props.columnsGap`: once stacked,
         * the cells are full width and the inset would just narrow them. */
        return `
@media (max-width: 640px) {
  .${id} td.a${id} > table,
  .${id} td.a${id} > table > tbody,
  .${id} td.a${id} > table > tbody > tr {
    display: block !important;
    width: 100% !important;
  }
  .col${id} {
    display: block !important;
    width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
}`;
      },
    },
  ];

  // Acumuladores separados
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let baseCss = '';
  let mobileCss = `
  .main-table-container {
    width: 100% !important;
  }
`;

  Object.entries(cleanedDocument).forEach(([blockId, block]) => {
    if (blockId === 'root') return;

    const rawBlock = block as BlockData;

    // Resolve the block once for the base viewport (used by base CSS
    // rules) and once for mobile (used by the `@media (max-width:640px)`
    // sheet). Each pass walks the resolution chain:
    //   1. block.data.<section>.<key>            (explicit on the block)
    //   2. theme.blocks[type].<section>.<key>    (theme override)
    //   3. schemaDefaults.<section>.<key>        (block schema default)
    // — so any value that lives only in a Zod `.default(...)` (level 3)
    // surfaces here too. Without this, the cleanDocument-emitted
    // `!important` rules drift from the inline styles produced by the
    // renderer and the inline values get overridden. See L42-312.
    const schemaDefaults = READER_SCHEMA_DEFAULTS_BY_TYPE[rawBlock.type];
    const baseBlock = resolveBlockData(
      rawBlock as unknown as ResolvableBlock,
      theme,
      baseViewport,
      schemaDefaults,
    );
    const mobileBlock = resolveBlockData(
      rawBlock as unknown as ResolvableBlock,
      theme,
      'mobile',
      schemaDefaults,
    );
    const baseStyle = (baseBlock.data?.style ?? {}) as StyleData;
    const mobileStyle = (mobileBlock.data?.style ?? {}) as StyleData;
    const mobileProps = (mobileBlock.data?.props ?? {}) as PropsData;

    // Border mobile rules are an `@media`-only override; pull values
    // from the mobile-resolved block. `borderColor` has no mobile
    // variant in the schema, but we coalesce defensively in case a
    // theme override only sets it on one viewport.
    const borderData = {
      borderBottomMobile: mobileStyle.borderBottomMobile,
      borderLeftMobile: mobileStyle.borderLeftMobile,
      borderRightMobile: mobileStyle.borderRightMobile,
      borderTopMobile: mobileStyle.borderTopMobile,
      borderColor: mobileStyle.borderColor ?? baseStyle.borderColor,
    };
    const borderCSS = generateBorderMobileCSS(blockId, borderData, rawBlock.type);
    if (borderCSS) {
      const { base, mobile } = splitMobileRules(borderCSS);
      baseCss += base;
      mobileCss += mobile;
    }

    // For each style property, route through the mobile-resolved block
    // when the property name implies a mobile-only override
    // (`mobilePadding` or any `*Mobile` suffix); otherwise read from
    // the base-viewport-resolved block. This preserves today's
    // semantics (mobile inherits from desktop via the `mobilePadding ??
    // padding` fallback in block components) while surfacing schema
    // defaults and theme overrides at both layers.
    styleProperties.forEach(({ property, cssGenerator }) => {
      const isMobileProperty = property === 'mobilePadding' || property.endsWith('Mobile');
      const sourceStyle = isMobileProperty ? mobileStyle : baseStyle;
      const value = sourceStyle[property as keyof StyleData];
      if (value !== undefined) {
        const snippet = cssGenerator(blockId, value, rawBlock.type);
        const { base, mobile } = splitMobileRules(snippet);
        baseCss += base;
        mobileCss += mobile;
      }
    });

    // Every entry in `propsProperties` is a `*Mobile`-suffixed property
    // (mobile-only overrides), so they all read from the mobile-resolved
    // props block. Generators that need adjacent props (e.g.
    // `fullWidthMobile` interacting with `fullWidth`) receive the full
    // resolved props bag.
    propsProperties.forEach(({ property, cssGenerator }) => {
      const value = mobileProps[property as keyof PropsData];
      if (value !== undefined) {
        const snippet = cssGenerator(blockId, value, rawBlock.type, mobileProps);
        const { base, mobile } = splitMobileRules(snippet);
        baseCss += base;
        mobileCss += mobile;
      }
    });

    // SocialMedia stores `gap` / `gapMobile` at `data.<top-level>`
    // (legacy shape), not under `data.props`. The resolver only walks
    // `data.style` and `data.props`, so this branch keeps reading the
    // raw block. Migrating the SocialMedia schema to nest these under
    // `data.props` is a separate cleanup, out of scope for L42-312.
    if (rawBlock.type === 'SocialMedia') {
      propsProperties.forEach(({ property, cssGenerator }) => {
        const value = (rawBlock.data as Record<string, unknown>)[property];
        if (value !== undefined) {
          const snippet = cssGenerator(blockId, value, rawBlock.type, undefined);
          const { base, mobile } = splitMobileRules(snippet);
          baseCss += base;
          mobileCss += mobile;
        }
      });
    }
  });

  // Ensamblar: primero base, luego un único bloque @media con todas las reglas móviles
  let cssString = '';
  if (mobileCss.trim()) {
    cssString += `\n@media screen and (max-width: 640px) {\n${mobileCss}\n}`;
  }

  // Minificar y contar caracteres del CSS final que irá en <head>
  const minified = minifyCSS(cssString);

  try {
    const length = minified.length;
    // Log informativo siempre
    // Advertencia cuando se supera el umbral
    if (length > CSS_HEADER_CHAR_LIMIT) {
      console.warn(
        `[EmailBuilder] El CSS de cabecera supera el umbral de ${CSS_HEADER_CHAR_LIMIT} caracteres. ` +
          `Algunas plataformas Android pueden no aplicar correctamente los estilos.`,
      );
    }
  } catch {
    // Silencioso: si algo fallara al loguear, no bloquear el flujo
  }

  return {
    cleanedDocument,
    css: minified,
  };
};

export default cleanDocument;
