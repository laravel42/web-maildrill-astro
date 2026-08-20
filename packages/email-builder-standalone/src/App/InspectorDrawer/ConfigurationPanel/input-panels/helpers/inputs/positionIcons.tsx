import React from 'react';

/**
 * Shared helpers for the 9-position picker used by both the Background image
 * picker (`BackgroundImageInput`) and the Image block inspector
 * (`ImageSidebarPanel`). Both render the same `<Select>` of nine compass
 * positions with a small SVG arrow icon next to each label.
 *
 * Keeping the SVGs here removes ~200 lines of duplication and guarantees
 * the two pickers stay visually identical.
 */

export type PositionValue =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center center'
  | 'center'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right';

/** All nine positions, in the order they should appear in the dropdown. */
export const POSITIONS_NINE: PositionValue[] = [
  'top left',
  'top center',
  'top right',
  'center left',
  'center center',
  'center right',
  'bottom left',
  'bottom center',
  'bottom right',
];

const SVG_PROPS = {
  style: { color: 'currentColor' as const },
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none' as const,
  xmlns: 'http://www.w3.org/2000/svg',
};

const STROKE_PROPS = {
  stroke: 'currentColor',
  strokeWidth: '1.67',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const CENTER_ICON = (
  <svg {...SVG_PROPS}>
    <path
      d="M2.40039 5.20039V2.40039M2.40039 2.40039H5.20039M2.40039 2.40039L5.90039 5.90039M13.6004 5.20039V2.40039M13.6004 2.40039H10.8004M13.6004 2.40039L10.1004 5.90039M2.40039 10.8004V13.6004M2.40039 13.6004H5.20039M2.40039 13.6004L5.90039 10.1004M13.6004 13.6004L10.1004 10.1004M13.6004 13.6004V10.8004M13.6004 13.6004H10.8004"
      {...STROKE_PROPS}
    />
  </svg>
);

/** Returns the SVG icon for a CSS background/object-position keyword. */
export function getPositionIcon(position: string): React.ReactElement {
  switch (position) {
    case 'top left':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M5.26523 9.79159L5.17094 5.17183M5.17094 5.17183L9.79071 5.26611M5.17094 5.17183L10.8278 10.8287"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'top center':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M4.7998 7.33333L7.9998 4M7.9998 4L11.1998 7.33333M7.9998 4V12"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'top right':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M6.20841 5.2662L10.8282 5.17192M10.8282 5.17192L10.7339 9.79169M10.8282 5.17192L5.17132 10.8288"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'center left':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M7.33333 11.2002L4 8.00019M4 8.00019L7.33333 4.8002M4 8.00019L12 8.0002"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'center':
    case 'center center':
      return CENTER_ICON;
    case 'center right':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M8.66667 4.7998L12 7.9998M12 7.9998L8.66667 11.1998M12 7.9998L4 7.9998"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'bottom left':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M9.79062 10.7348L5.17085 10.8291M5.17085 10.8291L5.26513 6.20929M5.17085 10.8291L10.8277 5.1722"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'bottom center':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M11.1998 8.66667L7.9998 12M7.9998 12L4.7998 8.66667M7.9998 12L7.99981 4"
            {...STROKE_PROPS}
          />
        </svg>
      );
    case 'bottom right':
      return (
        <svg {...SVG_PROPS}>
          <path
            d="M10.7338 6.20938L10.8281 10.8291M10.8281 10.8291L6.20831 10.7349M10.8281 10.8291L5.17122 5.17229"
            {...STROKE_PROPS}
          />
        </svg>
      );
    default:
      return CENTER_ICON;
  }
}

/**
 * Maps a position keyword to the i18n key suffix under
 * `inputs.backgroundImage.positions.<key>`. The translation lookup is
 * performed by the consumer so this helper stays decoupled from i18n.
 */
export function getPositionI18nKey(position: string): string {
  switch (position) {
    case 'top left':
      return 'topLeft';
    case 'top center':
      return 'topCenter';
    case 'top right':
      return 'topRight';
    case 'center left':
      return 'centerLeft';
    case 'center':
    case 'center center':
      return 'center';
    case 'center right':
      return 'centerRight';
    case 'bottom left':
      return 'bottomLeft';
    case 'bottom center':
      return 'bottomCenter';
    case 'bottom right':
      return 'bottomRight';
    default:
      return 'center';
  }
}
