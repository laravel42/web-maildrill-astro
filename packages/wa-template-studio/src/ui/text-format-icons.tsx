import * as React from 'react';

/** Icon size for every control in the text-format bars — 20px, the rendered
 * size of the email bubble menu's `fontSize="small"` MUI icons. */
export const FMT_ICON_CLASS = 'size-5';

export type FormatIconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

/* Glyph paths copied from @mui/icons-material (FormatBold, FormatItalic,
 * StrikethroughS, Code, DataObject, InsertEmoticon) so the format bar shows
 * the exact icons of the email editor's bubble menu without pulling MUI +
 * emotion into this package. */
function glyph(name: string, d: string): FormatIconComponent {
  function Glyph(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
        <path d={d} />
      </svg>
    );
  }
  Glyph.displayName = name;
  return Glyph;
}

export const Bold = glyph(
  'Bold',
  'M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42M10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5',
);

export const Italic = glyph('Italic', 'M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z');

export const Strikethrough = glyph(
  'Strikethrough',
  'M6.85 7.08C6.85 4.37 9.45 3 12.24 3c1.64 0 3 .49 3.9 1.28.77.65 1.46 1.73 1.46 3.24h-3.01c0-.31-.05-.59-.15-.85-.29-.86-1.2-1.28-2.25-1.28-1.86 0-2.34 1.02-2.34 1.7 0 .48.25.88.74 1.21.38.25.77.48 1.41.7H7.39c-.21-.34-.54-.89-.54-1.92M21 12v-2H3v2h9.62c1.15.45 1.96.75 1.96 1.97 0 1-.81 1.67-2.28 1.67-1.54 0-2.93-.54-2.93-2.51H6.4c0 .55.08 1.13.24 1.58.81 2.29 3.29 3.3 5.67 3.3 2.27 0 5.3-.89 5.3-4.05 0-.3-.01-1.16-.48-1.94H21z',
);

export const Code = glyph(
  'Code',
  'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6z',
);

export const Braces = glyph(
  'Braces',
  'M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7m17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4z',
);

export const Smile = glyph(
  'Smile',
  'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5m-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11m3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5',
);

export const Sparkles = glyph(
  'Sparkles',
  'm19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z',
);

export const RemoveFormatting = glyph(
  'RemoveFormatting',
  'M3.27 5 2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5z',
);

/* AI-menu item glyphs (Refresh, CheckCircle, Edit, ShortText, Description,
 * Subject in the Material set — same items as the email AI dropdown). */
export const Refresh = glyph(
  'Refresh',
  'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
);

export const CheckCircle = glyph(
  'CheckCircle',
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z',
);

export const Pencil = glyph(
  'Pencil',
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z',
);

export const ShortText = glyph('ShortText', 'M4 9h16v2H4zm0 4h10v2H4z');

export const Description = glyph(
  'Description',
  'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zm2 16H8v-2h8zm0-4H8v-2h8zm-3-5V3.5L18.5 9z',
);

export const Subject = glyph('Subject', 'M14 17H4v2h10zm6-8H4v2h16zM4 15h16v-2H4zM4 5v2h16V5z');

/** WhatsApp inline markup — the only formatting the client understands. */
export const WA_TEXT_FORMATS: ReadonlyArray<{
  label: string;
  icon: FormatIconComponent;
  before: string;
  after: string;
}> = [
  { label: 'Bold', icon: Bold, before: '*', after: '*' },
  { label: 'Italic', icon: Italic, before: '_', after: '_' },
  { label: 'Strikethrough', icon: Strikethrough, before: '~', after: '~' },
  { label: 'Monospace', icon: Code, before: '```', after: '```' },
];

export function FormatIcon({ icon: Icon }: { icon: FormatIconComponent }) {
  return <Icon className={FMT_ICON_CLASS} aria-hidden="true" />;
}
