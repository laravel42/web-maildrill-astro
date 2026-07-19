export type TBorderRadius = {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
};

/** Rectangle/pill string, or per-corner radius when "custom" shape is selected. */
export type TShape = 'rectangle' | 'pill' | TBorderRadius;

export type TStyle = {
  backgroundColor?: any;
  borderColor?: any;
  borderRadius?: any;
  color?: any;
  fontFamily?: any;
  fontSize?: any;
  fontSizeMobile?: any;
  fontWeight?: any;
  padding?: any;
  mobilePadding?: any;
  textAlign?: any;
  textAlignMobile?: any;
  shape?: any;
  height?: any;
  heightMobile?: any;
  width?: any;
  border?: any;
  borderTop?: any;
  borderBottom?: any;
  borderLeft?: any;
  borderRight?: any;
  borderMobile?: any;
  borderTopMobile?: any;
  borderBottomMobile?: any;
  borderLeftMobile?: any;
  borderRightMobile?: any;
  lineHeight?: any;
  background?: any;
  widthMobile?: string;
  /** Inspector UI: padding desktop — single slider vs per-side */
  paddingSidesLinked?: boolean;
  /** Inspector UI: padding mobile */
  mobilePaddingSidesLinked?: boolean;
  /** Inspector UI: border desktop — single slider vs per-side */
  borderSidesLinked?: boolean;
  /** Inspector UI: border mobile */
  borderMobileSidesLinked?: boolean;
  /** Inspector UI: custom shape — one radius vs per-corner */
  shapeCornersLinked?: boolean;
};
