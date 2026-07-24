import { alpha, createTheme, darken, getContrastRatio, getLuminance, hexToRgb, lighten } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    input?: string;
    /** Área de trabajo del editor (canvas), distinta de paper/default */
    canvas?: string;
  }
}

const BRAND_NAVY = '#212443';
const BRAND_BLUE = '#4F46E5';
const BRAND_GREEN = '#1F8466';
const BRAND_RED = '#E81212';
const BRAND_YELLOW = '#F6DC9F';
const BRAND_PURPLE = '#6C0E7C';
const BRAND_BROWN = '#CC996C';

/** Figtree — primary UI sans for the entire editor interface */
/**
 * UI typeface for the editor chrome — matched to the host app's stack
 * (--font-sans in its design tokens) so panels and menus read as the same
 * product. This never touches the email being composed: document text picks
 * its family from the font catalogue.
 */
/**
 * The host app's interactive accent and its focus tint (--accent /
 * --accent-tint). Distinct from the editor's primary on purpose: the app uses
 * orange for identity and indigo for interaction, and focus is interaction.
 */
const APP_ACCENT = '#4f46e5';
const APP_ACCENT_TINT = '#eef0ff';

const UI_FONT_FAMILY =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Newsreader — serif display, used only for landing/marketing headings */
export const NEWSREADER_FAMILY = '"Newsreader", "Georgia", "Times New Roman", serif';

const getDarkModeColor = (color: string, darkMode: boolean) => {
  if (!darkMode) {
    try {
      let rgbColor;
      if (color.startsWith('#')) {
        const rgb = hexToRgb(color);
        rgbColor = rgb;
      } else {
        rgbColor = color;
      }

      return rgbColor;
    } catch {
      return 'rgb(0, 123, 255)'; // BRAND_BLUE en RGB
    }
  }

  // Safely handle invalid colors
  try {
    if (color === BRAND_NAVY) return lighten(color, 0.3);
    if (color === BRAND_PURPLE) return lighten(color, 0.4);
    if (color === BRAND_YELLOW) return darken(color, 0.2);
    return lighten(color, 0.1);
  } catch {
    return BRAND_BLUE; // Fallback to valid color
  }
};
const CANVAS_BG_LIGHT = '#F5F5F5';
const CANVAS_BG_DARK = '#434955';

const BASE_THEME = createTheme({
  palette: {
    background: {
      default: '#FAFAF8',
      paper: '#FFFFFF',
      canvas: CANVAS_BG_LIGHT,
    },
    text: {
      primary: '#18181B',
      secondary: '#71717A',
    },
  },
  typography: {
    fontFamily: UI_FONT_FAMILY,
  },
});

const getTheme = (
  mainColor: string = BRAND_BLUE,
  secondaryColor: string = BRAND_BLUE,
  darkMode: boolean = false,
  portalContainer?: HTMLElement
) => {
  // Validate color inputs with fallback
  const isValidColor = (c: any) => typeof c === 'string' && c.startsWith('#');
  const mainColorBase = isValidColor(mainColor) ? mainColor : BRAND_BLUE;
  const secondaryColorBase = isValidColor(secondaryColor) ? secondaryColor : BRAND_BLUE;

  const adjustedMainColor = getDarkModeColor(mainColorBase, darkMode);
  const adjustedSecondaryColor = getDarkModeColor(secondaryColorBase, darkMode);

  // Helper with robust error handling
  const createColorPalette = (color: string) => {
    try {
      // Pick a label colour that stays legible on top of the fill. Use the
      // fill's luminance instead of a white-only contrast check: saturated
      // brand colours like the orange #ff441f land in a band where the old
      // `getContrastRatio(color,'#fff') > 4.5` check fell back to dark text,
      // which reads poorly on the vivid fill — e.g. selected toggle pills
      // showed near-black text/icons on orange. Below the mid-luminance cutoff
      // we use white; genuinely light fills (pale yellow) keep dark text.
      const contrastText = getLuminance(color) < 0.45 ? '#ffffff' : '#111111';

      return {
        main: color,
        light: lighten(color, 0.2),
        dark: darken(color, 0.2),
        contrastText,
      };
    } catch (_error) {
      return BASE_THEME.palette.primary; // Fallback to MUI default
    }
  };

  // Light-mode neutrals mirror the host app's design tokens (see
  // src/styles/tokens.css) so the editor reads as part of the same product
  // rather than an embedded third-party tool. The ramp is a warm cream
  // neutral, not MUI's cool grey. Dark mode keeps the editor's own values.
  const backgroundColors = {
    default: darkMode ? '#121212' : '#f6f5f2', // --bg
    paper: darkMode ? '#1e1e1e' : '#ffffff', // --surface
    // Contrasts with paper: inputs, selects, dropdowns (grey[100])
    input: darkMode ? '#2c2c2c' : '#f3f2ee', // --surface2
    canvas: darkMode ? CANVAS_BG_DARK : CANVAS_BG_LIGHT,
  };

  const textColors = {
    primary: darkMode ? '#FAFAFA' : '#1f1e1b', // --text
    secondary: darkMode ? '#A1A1AA' : '#57554e', // --text3
    disabled: darkMode ? '#52525B' : '#a5a39a', // --muted
  };
  const greyColors = {
    100: darkMode ? '#27272A' : '#f3f2ee', // --surface2
    200: darkMode ? '#3F3F46' : '#ecebe6', // --border
    300: darkMode ? '#52525B' : '#e4e2da', // --border2
    400: darkMode ? '#71717A' : '#a5a39a', // --muted
    500: darkMode ? '#A1A1AA' : '#77756c', // --text4
  };

  // Helper function to

  const THEME = createTheme(BASE_THEME, {
    shape: {
      // --radius-btn from the host app's tokens; its cards/controls are
      // noticeably rounder than the MUI default this used to carry.
      borderRadius: 10,
    },
    palette: {
      mode: darkMode ? 'dark' : 'light',
      background: backgroundColors,
      text: textColors,
      primary: createColorPalette(adjustedMainColor),
      secondary: createColorPalette(adjustedSecondaryColor),
      // Custom palette colors - properly structured
      mainColor: {
        main: adjustedMainColor,
        light: alpha(adjustedMainColor, darkMode ? 0.7 : 0.5),
        dark: alpha(adjustedMainColor, darkMode ? 1 : 0.9),
        contrastText:
          getContrastRatio(adjustedMainColor, darkMode ? '#000' : '#fff') > 4.5
            ? darkMode
              ? '#000'
              : '#fff'
            : darkMode
              ? '#fff'
              : '#111',
      },
      secondaryColor: {
        main: adjustedSecondaryColor,
        light: alpha(adjustedSecondaryColor, darkMode ? 0.7 : 0.5),
        dark: alpha(adjustedSecondaryColor, darkMode ? 1 : 0.9),
        contrastText:
          getContrastRatio(adjustedSecondaryColor, darkMode ? '#000' : '#fff') > 4.5
            ? darkMode
              ? '#000'
              : '#fff'
            : darkMode
              ? '#fff'
              : '#111',
      },
      brand: {
        navy: getDarkModeColor(BRAND_NAVY, darkMode),
        blue: adjustedMainColor,
        red: getDarkModeColor(BRAND_RED, darkMode),
        green: getDarkModeColor(BRAND_GREEN, darkMode),
        yellow: getDarkModeColor(BRAND_YELLOW, darkMode),
        purple: getDarkModeColor(BRAND_PURPLE, darkMode),
        brown: getDarkModeColor(BRAND_BROWN, darkMode),
      },
      success: {
        main: getDarkModeColor(BRAND_GREEN, darkMode),
        light: lighten(getDarkModeColor(BRAND_GREEN, darkMode), 0.15),
        dark: darken(getDarkModeColor(BRAND_GREEN, darkMode), 0.15),
        contrastText:
          getContrastRatio(getDarkModeColor(BRAND_GREEN, darkMode), darkMode ? '#000' : '#fff') > 4.5
            ? darkMode
              ? '#000'
              : '#fff'
            : darkMode
              ? '#fff'
              : '#111',
      },
      error: {
        main: getDarkModeColor(BRAND_RED, darkMode),
        light: lighten(getDarkModeColor(BRAND_RED, darkMode), 0.15),
        dark: darken(getDarkModeColor(BRAND_RED, darkMode), 0.15),
        contrastText:
          getContrastRatio(getDarkModeColor(BRAND_RED, darkMode), darkMode ? '#000' : '#fff') > 4.5
            ? darkMode
              ? '#000'
              : '#fff'
            : darkMode
              ? '#fff'
              : '#111',
      },
      warning: {
        main: getDarkModeColor(BRAND_YELLOW, darkMode),
        light: lighten(getDarkModeColor(BRAND_YELLOW, darkMode), 0.15),
        dark: darken(getDarkModeColor(BRAND_YELLOW, darkMode), 0.15),
        contrastText:
          getContrastRatio(getDarkModeColor(BRAND_YELLOW, darkMode), darkMode ? '#000' : '#fff') > 4.5
            ? darkMode
              ? '#000'
              : '#fff'
            : darkMode
              ? '#fff'
              : '#111',
      },
      info: {
        main: adjustedMainColor,
        light: lighten(adjustedMainColor, 0.15),
        dark: darken(adjustedMainColor, 0.15),
        contrastText:
          getContrastRatio(adjustedMainColor, darkMode ? '#000' : '#fff') > 4.5
            ? darkMode
              ? '#000'
              : '#fff'
            : darkMode
              ? '#fff'
              : '#111',
      },
      cadet: {
        100: greyColors[100],
        200: greyColors[200],
        300: greyColors[300],
        400: greyColors[400],
        500: greyColors[500],
      },
      highlight: {
        100: lighten(getDarkModeColor(BRAND_YELLOW, darkMode), darkMode ? 0.6 : 0.8),
        200: lighten(getDarkModeColor(BRAND_YELLOW, darkMode), darkMode ? 0.4 : 0.6),
        300: lighten(getDarkModeColor(BRAND_YELLOW, darkMode), darkMode ? 0.2 : 0.4),
        400: lighten(getDarkModeColor(BRAND_YELLOW, darkMode), darkMode ? 0.1 : 0.2),
        500: getDarkModeColor(BRAND_YELLOW, darkMode),
      },
      divider: darkMode ? '#3F3F46' : '#E7E5E4',
      grey: {
        50: darkMode ? '#18181B' : '#FAFAF8',
        100: greyColors[100],
        200: greyColors[200],
        300: greyColors[300],
        400: greyColors[400],
        500: greyColors[500],
        600: darkMode ? '#D4D4D8' : '#52525B',
        700: darkMode ? '#E4E4E7' : '#3F3F46',
        800: darkMode ? '#F4F4F5' : '#27272A',
        900: darkMode ? '#FAFAFA' : '#18181B',
      },
    },
    components: {
      MuiAlert: {
        styleOverrides: {
          root: {
            fontSize: BASE_THEME.typography.pxToRem(14),
            '&.MuiAlert-colorWarning': {
              borderColor: darkMode ? '#332f29' : '#FFFBEB',
              backgroundColor: `${darkMode ? '#f1be50' : '#FEF3C7'} !important`,
              color: darkMode ? '#2f2f2f' : '#78350f',
              borderRadius: '8px',
              '& .MuiAlert-icon': {
                color: darkMode ? '#78350f' : '#78350f',
              },
            },
            '&.MuiAlert-colorError': {
              borderColor: darkMode ? '#4a1f1f' : '#FEE2E2',
              backgroundColor: `${darkMode ? '#5b2323' : '#FEE2E2'} !important`,
              color: darkMode ? '#ffffff' : '#7F1D1D',
              borderRadius: '8px',
              '& .MuiAlert-icon': {
                color: darkMode ? '#ffffff' : '#7F1D1D',
              },
              '& .MuiAlert-message': {
                color: darkMode ? '#ffffff' : '#7F1D1D',
              },
            },
          },
          action: {
            paddingTop: 0,
            marginRight: 0,
          },
          filledSuccess: {
            backgroundColor: getDarkModeColor(BRAND_GREEN, darkMode),
          },
        },
      },
      MuiStepLabel: {
        styleOverrides: {
          label: {
            fontWeight: BASE_THEME.typography.fontWeightMedium,
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          fullWidth: true,
        },
        styleOverrides: {
          paper: {
            borderRadius: '10px',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            paddingTop: BASE_THEME.spacing(2),
            paddingBottom: BASE_THEME.spacing(3),
          },
        },
      },
      MuiDialogTitle: {
        defaultProps: {
          variant: 'h4',
        },
        styleOverrides: {
          root: {
            paddingTop: BASE_THEME.spacing(3),
            paddingBottom: BASE_THEME.spacing(1.5),
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            borderTop: '1px solid',
            borderTopColor: darkMode ? '#3F3F46' : '#E7E5E4',
            marginTop: BASE_THEME.spacing(1),
            padding: `${BASE_THEME.spacing(2)} ${BASE_THEME.spacing(3)}`,
          },
        },
      },
      MuiSnackbar: {
        styleOverrides: {
          root: {
            position: 'absolute',
            zIndex: 9999,
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            // Configuración base
            borderRadius: '8px',
            boxShadow: darkMode ? '0 1px 3px rgba(0, 0, 0, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.06)',
            fontWeight: BASE_THEME.typography.fontWeightMedium,
            fontSize: BASE_THEME.typography.pxToRem(14),
            minWidth: '288px',
            maxWidth: '568px',

            // Colores por defecto (info) - usando variables del tema
            backgroundColor: backgroundColors.default,
            color: textColors.primary,
            border: `1px solid ${alpha(adjustedMainColor, darkMode ? 0.3 : 0.2)}`,

            '&.MuiSnackbarContent-success': {
              backgroundColor: darkMode
                ? alpha(getDarkModeColor(BRAND_GREEN, darkMode), 0.15)
                : alpha(getDarkModeColor(BRAND_GREEN, darkMode), 0.1),
              color: darkMode ? textColors.primary : getDarkModeColor(BRAND_GREEN, darkMode),
              border: `1px solid ${alpha(getDarkModeColor(BRAND_GREEN, darkMode), darkMode ? 0.3 : 0.2)}`,
            },

            '&.MuiSnackbarContent-error': {
              backgroundColor: darkMode
                ? alpha(getDarkModeColor(BRAND_RED, darkMode), 0.15)
                : alpha(getDarkModeColor(BRAND_RED, darkMode), 0.1),
              color: darkMode ? textColors.primary : getDarkModeColor(BRAND_RED, darkMode),
              border: `1px solid ${alpha(getDarkModeColor(BRAND_RED, darkMode), darkMode ? 0.3 : 0.2)}`,
            },

            '&.MuiSnackbarContent-warning': {
              backgroundColor: darkMode
                ? alpha(getDarkModeColor(BRAND_YELLOW, darkMode), 0.15)
                : alpha(getDarkModeColor(BRAND_YELLOW, darkMode), 0.1),
              color: darkMode ? textColors.primary : darken(getDarkModeColor(BRAND_YELLOW, darkMode), 0.6),
              border: `1px solid ${alpha(getDarkModeColor(BRAND_YELLOW, darkMode), darkMode ? 0.3 : 0.2)}`,
            },

            '&.MuiSnackbarContent-info': {
              backgroundColor: darkMode ? alpha(adjustedMainColor, 0.15) : alpha(adjustedMainColor, 0.1),
              color: darkMode ? textColors.primary : adjustedMainColor,
              border: `1px solid ${alpha(adjustedMainColor, darkMode ? 0.3 : 0.2)}`,
            },
          },

          message: {
            padding: '6px 0',
            display: 'flex',
            alignItems: 'center',
            gap: BASE_THEME.spacing(1),
          },

          action: {
            paddingLeft: BASE_THEME.spacing(2),
            marginRight: BASE_THEME.spacing(-1),

            '& .MuiButton-root': {
              color: 'inherit',
              fontWeight: BASE_THEME.typography.fontWeightMedium,
              textTransform: 'none',
              minWidth: 'auto',
              padding: `${BASE_THEME.spacing(0.5)} ${BASE_THEME.spacing(1)}`,

              '&:hover': {
                backgroundColor: alpha(textColors.primary, darkMode ? 0.08 : 0.04),
              },
            },

            '& .MuiIconButton-root': {
              color: 'inherit',
              padding: BASE_THEME.spacing(0.5),

              '&:hover': {
                backgroundColor: alpha(textColors.primary, darkMode ? 0.08 : 0.04),
              },
            },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            ...BASE_THEME.typography.body2,
            borderColor: greyColors[200],
            color: textColors.primary,
          },
          head: {
            ...BASE_THEME.typography.overline,
            fontWeight: BASE_THEME.typography.fontWeightMedium,
            letterSpacing: '0.075em',
            color: textColors.secondary,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child td': {
              borderBottom: 0,
            },
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            textTransform: 'uppercase',
            fontSize: BASE_THEME.typography.pxToRem(14),
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            '&.MuiChip-filledWarning': {
              backgroundColor: darkMode ? getDarkModeColor('#d18829', darkMode) : getDarkModeColor('#bead4a', darkMode),
              color: '#ffffff',
              '& .MuiChip-icon': {
                color: '#ffffff',
              },
            },
            '&.MuiChip-filledError': {
              color: '#ffffff',
              '& .MuiChip-label': {
                color: '#ffffff',
              },
              '& .MuiChip-icon': {
                color: '#ffffff',
              },
            },
          },
          '&.MuiChip-colorError .MuiChip-label': {
            color: '#ffffff',
          },

          sizeSmall: {
            borderRadius: BASE_THEME.spacing(0.5),
            fontSize: 12,
          },
          iconSmall: {
            fontSize: 14,
            marginLeft: BASE_THEME.spacing(1),
          },
          colorSecondary: {
            borderColor: greyColors[400],
            color: textColors.primary,
          },
          label: {
            fontWeight: BASE_THEME.typography.fontWeightMedium,
          },
        },
      },
      MuiDrawer: {
        defaultProps: {
          PaperProps: {
            elevation: 0,
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
          disableInteractive: true,
        },
        styleOverrides: {
          tooltip: {
            fontSize: BASE_THEME.typography.pxToRem(12),
            backgroundColor: darkMode
              ? alpha(greyColors[500], 0.95) // Más oscuro en dark mode
              : alpha('#2c2c2c', 0.9), // Fondo oscuro en light mode
            color: '#ffffff', // Texto blanco para contraste
            border: darkMode ? `1px solid ${alpha(greyColors[400], 0.2)}` : `1px solid ${alpha('#000000', 0.1)}`,
            boxShadow: darkMode ? `0px 4px 12px ${alpha('#000000', 0.6)}` : `0px 4px 12px ${alpha('#000000', 0.25)}`,
            borderRadius: '6px',
          },
          arrow: {
            color: darkMode ? alpha(greyColors[500], 0.95) : alpha('#2c2c2c', 0.9),
            '&::before': {
              border: darkMode ? `1px solid ${alpha(greyColors[400], 0.2)}` : `1px solid ${alpha('#000000', 0.1)}`,
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
          square: true,
        },
        styleOverrides: {
          root: {
            backgroundColor: backgroundColors.paper,
          },
        },
      },
      MuiToggleButtonGroup: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: ({ theme }) => ({
            display: 'flex',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '6px',
            overflow: 'hidden',
            padding: 0,
            gap: 0,
            '& .MuiToggleButtonGroup-grouped': {
              flex: 1,
              border: 0,
              borderRadius: 0,
              margin: 0,
              paddingTop: theme.spacing(1),
              paddingBottom: theme.spacing(1),
              paddingLeft: theme.spacing(1.25),
              paddingRight: theme.spacing(1.25),
              textTransform: 'none',
              fontWeight: 500,
              '&:not(:first-of-type)': {
                borderLeft: `1px solid ${theme.palette.divider}`,
              },
            },
          }),
        },
      },
      MuiToggleButton: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: ({ theme }) => ({
            paddingLeft: theme.spacing(1.25),
            paddingRight: theme.spacing(1.25),
            color: theme.palette.text.secondary,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            // Override SvgIcon `fontSize="small"` (~1.25rem) so inspector toggles stay at 1rem
            '& .MuiSvgIcon-root': {
              fontSize: '1rem !important',
              color: theme.palette.text.secondary,
            },
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              '& .MuiSvgIcon-root': {
                fontSize: '1rem !important',
                color: theme.palette.text.secondary,
              },
            },
            '&.Mui-selected': {
              color: `${theme.palette.primary.contrastText} !important`,
              backgroundColor: `${theme.palette.primary.main} !important`,
              borderColor: 'transparent',
              '&:hover': {
                backgroundColor: `${theme.palette.primary.main} !important`,
                color: `${theme.palette.primary.contrastText} !important`,
              },
              '& .MuiSvgIcon-root': {
                fontSize: '1rem !important',
                color: 'inherit !important',
              },
            },
            '&.Mui-disabled': {
              color: theme.palette.text.disabled,
              borderColor: 'transparent',
            },
          }),
        },
      },
      MuiButtonBase: {
        defaultProps: {},
        styleOverrides: {
          root: {
            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },
            '&:focus-visible': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&.MuiButton-outlinedIndigo': {
              border: `2px solid ${adjustedMainColor}`,
              borderRadius: '6px',
              fontWeight: 'bold',
              padding: '5px 0',
              color: adjustedMainColor,
              backgroundColor: 'transparent',
              '&:hover': {
                borderWidth: '2px',
                backgroundColor: alpha(adjustedMainColor, 0.05),
                borderColor: getDarkModeColor(adjustedMainColor, darkMode),
              },
              '&:active': {
                backgroundColor: alpha(adjustedMainColor, 0.1),
              },
              '&.Mui-disabled': {
                border: `2px solid ${greyColors[300]}`,
                color: textColors.disabled,
                backgroundColor: 'transparent',
                cursor: 'not-allowed',
              },
              '&:focus': {
                outline: 'none',
                boxShadow: 'none',
              },
            },

            '&.MuiButton-contained': {
              borderRadius: '6px',
              fontWeight: 'bold',
              border: '2px solid transparent',
              backgroundColor: adjustedMainColor,
              color: '#FFFFFF',
              '& .MuiSvgIcon-root': {
                color: 'inherit',
              },
              '&:hover': {
                backgroundColor: getDarkModeColor(adjustedMainColor, darkMode),
                boxShadow: 'none',
              },
              '&:active': {
                backgroundColor: darkMode ? darken(adjustedMainColor, 0.1) : darken(adjustedMainColor, 0.2),
              },
              '&.Mui-disabled': {
                backgroundColor: greyColors[200],
                color: textColors.disabled,
                border: '2px solid transparent',
                boxShadow: 'none',
                cursor: 'not-allowed',
              },
              '&:focus': {
                outline: 'none',
                boxShadow: 'none',
              },
            },

            '&.MuiButton-text.primary': {
              color: adjustedMainColor,
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: alpha(adjustedMainColor, 0.08),
                color: getDarkModeColor(adjustedMainColor, darkMode),
              },
              '&.Mui-disabled': {
                color: textColors.disabled,
                backgroundColor: 'transparent',
                cursor: 'not-allowed',
              },
              '&:focus': {
                outline: 'none',
                boxShadow: 'none',
              },
            },

            '&.MuiButton-containedSecondary.Mui-disabled': {
              backgroundColor: greyColors[200],
              color: textColors.disabled,
              border: '2px solid transparent',
              boxShadow: 'none',
              cursor: 'not-allowed',
            },

            '&.MuiButton-outlined.Mui-disabled': {
              border: `2px solid ${greyColors[300]}`,
              color: textColors.disabled,
              backgroundColor: 'transparent',
              cursor: 'not-allowed',
            },

            '&.MuiButton-text.Mui-disabled': {
              color: textColors.disabled,
              backgroundColor: 'transparent',
              cursor: 'not-allowed',
            },

            '&.Mui-disabled': {
              opacity: darkMode ? 0.5 : 0.6,
              cursor: 'not-allowed',
              '&:hover': {
                backgroundColor: 'inherit',
                boxShadow: 'none',
                transform: 'none',
                borderColor: 'inherit',
              },
              '&:active': {
                backgroundColor: 'inherit',
                transform: 'none',
              },
              '&:focus': {
                outline: 'none',
                boxShadow: 'none',
              },
            },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            color: adjustedMainColor,
            height: 6,
            padding: '15px 0',
            '& .MuiSlider-rail': {
              backgroundColor: greyColors[300],
              opacity: 1,
              height: 2,
            },
            '& .MuiSlider-track': {
              backgroundColor: adjustedMainColor,
              height: 2,
              border: 'none',
            },
            '& .MuiSlider-thumb': {
              backgroundColor: adjustedMainColor,
              border: `2px solid ${backgroundColors.paper}`,
              width: 16,
              height: 16,
              boxShadow: `0 2px 6px ${alpha('#000000', 0.2)}`,
              '&:hover': {
                boxShadow: `0 0 0 8px ${alpha(adjustedMainColor, 0.16)}`,
              },
              '&:focus': {
                boxShadow: `0 0 0 8px ${alpha(adjustedMainColor, 0.16)}`,
              },
              '&.Mui-active': {
                boxShadow: `0 0 0 14px ${alpha(adjustedMainColor, 0.16)}`,
              },
              '&.Mui-disabled': {
                backgroundColor: textColors.disabled,
                border: `2px solid ${greyColors[200]}`,
              },
            },
            '& .MuiSlider-valueLabel': {
              backgroundColor: darkMode ? alpha(greyColors[500], 0.95) : alpha('#2c2c2c', 0.9),
              color: '#ffffff',
              fontSize: BASE_THEME.typography.pxToRem(12),
              borderRadius: '6px',
              padding: '6px 8px',
              '&::before': {
                borderTopColor: darkMode ? alpha(greyColors[500], 0.95) : alpha('#2c2c2c', 0.9),
              },
            },
            '& .MuiSlider-mark': {
              // Variante del primary con ligera transparencia para no competir visualmente
              backgroundColor: alpha(adjustedMainColor, darkMode ? 0.6 : 0.4),
              height: 6,
              width: 1,
              '&.MuiSlider-markActive': {
                // Un poco más opaco al activarse para destacar
                backgroundColor: alpha(adjustedMainColor, darkMode ? 0.9 : 0.7),
              },
            },
            '& .MuiSlider-markLabel': {
              color: textColors.secondary,
              fontSize: BASE_THEME.typography.pxToRem(12),
              '&.MuiSlider-markLabelActive': {
                color: adjustedMainColor,
              },
            },
          },
          colorSecondary: {
            color: adjustedSecondaryColor,
            '& .MuiSlider-track': {
              backgroundColor: adjustedSecondaryColor,
            },
            '& .MuiSlider-thumb': {
              backgroundColor: adjustedSecondaryColor,
              '&:hover': {
                boxShadow: `0 0 0 8px ${alpha(adjustedSecondaryColor, 0.16)}`,
              },
              '&:focus': {
                boxShadow: `0 0 0 8px ${alpha(adjustedSecondaryColor, 0.16)}`,
              },
              '&.Mui-active': {
                boxShadow: `0 0 0 14px ${alpha(adjustedSecondaryColor, 0.16)}`,
              },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: textColors.primary,
            borderRadius: '6px',
            padding: '8px',
            transition: BASE_THEME.transitions.create(['background-color', 'box-shadow', 'color'], {
              duration: BASE_THEME.transitions.duration.short,
            }),

            '&:hover': {
              backgroundColor: alpha(textColors.primary, 0.04),
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
              backgroundColor: 'transparent',
              cursor: 'not-allowed',
            },
          },

          // Tamaños
          sizeSmall: {
            padding: '6px',
            fontSize: BASE_THEME.typography.pxToRem(18),
          },
          sizeMedium: {
            padding: '8px',
            fontSize: BASE_THEME.typography.pxToRem(20),
          },
          sizeLarge: {
            padding: '12px',
            fontSize: BASE_THEME.typography.pxToRem(24),
          },

          // Color Primary
          colorPrimary: {
            color: getDarkModeColor(adjustedMainColor, darkMode),

            '&:hover': {
              backgroundColor: alpha(adjustedMainColor, 0.08),
              color: getDarkModeColor(adjustedMainColor, darkMode),
            },

            '&:active': {
              backgroundColor: alpha(adjustedMainColor, 0.12),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },
          },

          // Color Secondary
          colorSecondary: {
            color: getDarkModeColor(adjustedSecondaryColor, darkMode),

            '&:hover': {
              backgroundColor: alpha(adjustedSecondaryColor, 0.08),
              color: getDarkModeColor(adjustedSecondaryColor, darkMode),
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              backgroundColor: alpha(adjustedSecondaryColor, 0.12),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },
          },

          // Color Error
          colorError: {
            color: darkMode ? '#f87171' : '#dc2626', // red-400 : red-600

            '&:hover': {
              backgroundColor: alpha(darkMode ? '#f87171' : '#dc2626', 0.08),
              color: darkMode ? '#fca5a5' : '#b91c1c', // red-300 : red-700
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              backgroundColor: alpha(darkMode ? '#f87171' : '#dc2626', 0.12),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },
          },

          // Color Warning
          colorWarning: {
            color: darkMode ? '#fbbf24' : '#d97706', // amber-400 : amber-600

            '&:hover': {
              backgroundColor: alpha(darkMode ? '#fbbf24' : '#d97706', 0.08),
              color: darkMode ? '#fcd34d' : '#b45309', // amber-300 : amber-700
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              backgroundColor: alpha(darkMode ? '#fbbf24' : '#d97706', 0.12),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },
          },

          // Color Info
          colorInfo: {
            color: darkMode ? '#60a5fa' : '#2563eb', // blue-400 : blue-600

            '&:hover': {
              backgroundColor: alpha(darkMode ? '#60a5fa' : '#2563eb', 0.08),
              color: darkMode ? '#93c5fd' : '#1d4ed8', // blue-300 : blue-700
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              backgroundColor: alpha(darkMode ? '#60a5fa' : '#2563eb', 0.12),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },
          },

          // Color Success
          colorSuccess: {
            color: darkMode ? '#4ade80' : '#16a34a', // green-400 : green-600

            '&:hover': {
              backgroundColor: alpha(darkMode ? '#4ade80' : '#16a34a', 0.08),
              color: darkMode ? '#86efac' : '#15803d', // green-300 : green-700
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              backgroundColor: alpha(darkMode ? '#4ade80' : '#16a34a', 0.12),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },
          },

          // Color Inherit
          colorInherit: {
            color: textColors.primary,

            '&:hover': {
              backgroundColor: alpha(textColors.primary, 0.04),
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              backgroundColor: alpha(textColors.primary, 0.08),
            },

            '&.Mui-disabled': {
              color: textColors.disabled,
            },
          },

          // Variante de botón contenido (cuando se usa dentro de otros componentes)
          contained: {
            backgroundColor: backgroundColors.paper,
            boxShadow: `0 1px 3px ${alpha('#000000', 0.12)}`,

            '&:hover': {
              backgroundColor: greyColors[100],
              boxShadow: `0 2px 6px ${alpha('#000000', 0.15)}`,
            },

            '&:focus': {
              outline: 'none',
              boxShadow: 'none',
            },

            '&:active': {
              boxShadow: `0 1px 2px ${alpha('#000000', 0.2)}`,
            },

            '&.Mui-disabled': {
              backgroundColor: greyColors[100],
              boxShadow: 'none',
              color: textColors.disabled,
            },
          },

          // Estilos especiales para botones en toolbars o headers
          edge: {
            '&.MuiIconButton-edgeStart': {
              marginLeft: '-12px',
            },
            '&.MuiIconButton-edgeEnd': {
              marginRight: '-12px',
            },
          },
        },

        // Variantes personalizadas que puedes usar
        variants: [
          {
            props: { variant: 'soft' },
            style: {
              backgroundColor: alpha(adjustedMainColor, 0.08),
              color: getDarkModeColor(adjustedMainColor, darkMode),

              '&:hover': {
                backgroundColor: alpha(adjustedMainColor, 0.12),
              },

              '&:focus': {
                backgroundColor: alpha(adjustedMainColor, 0.12),
                boxShadow: `0 0 0 2px ${alpha(adjustedMainColor, 0.3)}`,
              },

              '&:active': {
                backgroundColor: alpha(adjustedMainColor, 0.16),
              },
            },
          },
          {
            props: { variant: 'outlined' },
            style: {
              border: `1px solid ${alpha(adjustedMainColor, 0.3)}`,
              color: getDarkModeColor(adjustedMainColor, darkMode),

              '&:hover': {
                backgroundColor: alpha(adjustedMainColor, 0.04),
                borderColor: getDarkModeColor(adjustedMainColor, darkMode),
              },

              '&:focus': {
                backgroundColor: alpha(adjustedMainColor, 0.04),
                borderColor: getDarkModeColor(adjustedMainColor, darkMode),
                boxShadow: `0 0 0 2px ${alpha(adjustedMainColor, 0.2)}`,
              },

              '&:active': {
                backgroundColor: alpha(adjustedMainColor, 0.08),
              },
            },
          },
        ],
      },
      MuiButtonGroup: {
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            border: '2px solid transparent',
          },
          contained: {
            '&:hover': {
              backgroundColor: alpha(adjustedMainColor, 0.8),
            },
          },
          textPrimary: {
            color: textColors.primary,
          },
          textSecondary: {
            color: textColors.secondary,
          },
          outlinedPrimary: {
            borderColor: greyColors[300],
            color: textColors.primary,
            '&:hover, &:active, &:focus': {
              borderColor: greyColors[500],
              color: textColors.primary,
            },
          },
          containedSecondary: {
            backgroundColor: backgroundColors.paper,
            border: `2px solid ${greyColors[300]}`,
            color: textColors.primary,
            '&:hover, &:active, &:focus': {
              backgroundColor: backgroundColors.paper,
              borderColor: greyColors[500],
              color: textColors.primary,
            },
          },
        },
      },

      MuiInputBase: {
        styleOverrides: {
          root: {
            '&:not(.Mui-disabled, .Mui-error):before': {
              borderBottom: `1px solid ${greyColors[400]}`,
            },
            '&:hover:not(.Mui-disabled, .Mui-error):before': {
              borderBottom: `1px solid ${greyColors[500]} !important`,
            },
            '&:after': {
              borderBottom: `1px solid ${textColors.primary} !important`,
            },
            '&.MuiOutlinedInput-root:not(.Mui-error)': {
              '& fieldset': {
                borderColor: greyColors[300],
                transition: 'border-color 0.2s',
              },
            },
            '&.MuiOutlinedInput-root:not(.Mui-disabled, .Mui-error)': {
              '&:hover fieldset': {
                borderColor: greyColors[400],
              },
              '&.Mui-focused fieldset': {
                borderColor: APP_ACCENT,
                borderWidth: 1,
              },
              // Focus parity with the host app: a 1px accent border plus a 3px
              // tint ring. The app splits its accents deliberately — orange is
              // identity, indigo is interactive — so focus is indigo even
              // though this editor's primary is orange.
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${APP_ACCENT_TINT}`,
              },
            },
            '.MuiSelect-icon': {
              fill: textColors.primary,
            },
          },
          input: {
            // 13.5px + 10/12 padding mirrors the app's form controls.
            fontSize: '13.5px',
            padding: '10px 12px',
            color: textColors.primary,
            '&.Mui-disabled': {
              WebkitTextFillColor: 'inherit',
              color: textColors.secondary,
            },
          },
          inputSizeSmall: {
            padding: '4px 12px !important',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            // Set explicitly rather than relying on shape.borderRadius: the
            // panel's inputs otherwise render at MUI's tighter default and
            // read noticeably squarer than the app's controls.
            borderRadius: '10px',
            input: {
              padding: '10px 12px',
            },
          },
          notchedOutline: {
            // The visible border lives on the fieldset, and it does not inherit
            // the root's radius — setting it here is what actually rounds the
            // control to match the app's 10px.
            borderRadius: '10px',
            '& legend': {
              fontSize: '0.85em',
              maxWidth: '100%',
            },
          },
        },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: {
            '& .MuiTypography-root': {
              fontSize: BASE_THEME.typography.pxToRem(14),
              color: textColors.secondary,
            },
            '& .MuiSvgIcon-root': {
              color: textColors.secondary,
            },
          },
        },
      },
      MuiInputLabel: {
        defaultProps: {
          shrink: true,
        },
        styleOverrides: {
          shrink: {
            transform: 'scale(0.85)',
            fontWeight: BASE_THEME.typography.fontWeightMedium,
            color: textColors.secondary,
            '&.Mui-focused': {
              color: textColors.primary,
            },
            '&.MuiInputLabel-standard': {
              transform: 'translate(0, -4px) scale(0.85)',
              color: textColors.secondary,
            },
            '&.MuiInputLabel-outlined': {
              transform: 'translate(15px, -8px) scale(0.85)',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            '&.MuiSelect-nativeInput': {
              padding: 0,
            },
          },
        },
        defaultProps: {
          MenuProps: {
            PaperProps: {
              sx: {
                borderRadius: '4px',
                boxShadow: darkMode ? '0 4px 10px rgba(0, 0, 0, 0.6)' : '0 4px 10px rgba(0, 0, 0, 0.3)',
                backgroundColor: backgroundColors.paper,
              },
            },
          },
        },
      },
      MuiTabs: {
        defaultProps: {
          variant: 'scrollable',
        },
        styleOverrides: {
          indicator: {
            height: 1,
            backgroundColor: adjustedMainColor,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            minWidth: BASE_THEME.spacing(2),
            paddingLeft: BASE_THEME.spacing(1.5),
            paddingRight: BASE_THEME.spacing(1.5),
            fontSize: BASE_THEME.typography.pxToRem(14),
            fontFamily: UI_FONT_FAMILY,
            lineHeight: 1.5,
            fontWeight: 500,
            transition: 'color 0.2s, stroke 0.2s',
            stroke: textColors.secondary,
            color: textColors.secondary,
            '&.Mui-selected': {
              color: adjustedMainColor,
              stroke: adjustedMainColor,
            },
            '&:hover:not(.Mui-selected)': {
              color: textColors.primary,
              stroke: textColors.primary,
              backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            backgroundColor: backgroundColors.paper,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            // MUI dark mode applies an elevation overlay via backgroundImage
            // that makes Accordion rows appear lighter than background.paper.
            // Override both to keep accordion rows flush with the panel bg.
            backgroundColor: backgroundColors.paper,
            backgroundImage: 'none',
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          title: {
            fontSize: BASE_THEME.typography.pxToRem(18),
            fontWeight: BASE_THEME.typography.fontWeightMedium,
            color: textColors.primary,
          },
        },
      },
      MuiStack: {
        defaultProps: {
          spacing: 2,
        },
        styleOverrides: {
          root: {
            '& > :not(style) ~ :not(style)': {
              marginTop: '0px !important',
              marginLeft: '0px !important',
            },
          },
        },
      },
      // Portal container for Shadow DOM encapsulation
      ...(portalContainer && {
        MuiPopover: { defaultProps: { container: portalContainer } },
        MuiPopper: { defaultProps: { container: portalContainer } },
        MuiModal: { defaultProps: { container: portalContainer } },
      }),
    },
    typography: {
      fontFamily: UI_FONT_FAMILY,
      h1: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: BASE_THEME.typography.pxToRem(36),
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
        fontWeight: 600,
        color: textColors.primary,
      },
      h2: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: BASE_THEME.typography.pxToRem(28),
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
        fontWeight: 600,
        color: textColors.primary,
      },
      h3: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: BASE_THEME.typography.pxToRem(22),
        lineHeight: 1.5,
        letterSpacing: '-0.005em',
        fontWeight: 600,
        color: textColors.primary,
      },
      h4: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: BASE_THEME.typography.pxToRem(18),
        lineHeight: 1.5,
        letterSpacing: '-0.005em',
        fontWeight: 600,
        color: textColors.primary,
      },
      h5: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: BASE_THEME.typography.pxToRem(16),
        lineHeight: 1.5,
        letterSpacing: 'normal',
        fontWeight: 600,
        color: textColors.primary,
      },
      h6: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: BASE_THEME.typography.pxToRem(14),
        lineHeight: 1.5,
        letterSpacing: 'normal',
        fontWeight: 600,
        color: textColors.primary,
      },
      body1: {
        fontSize: BASE_THEME.typography.pxToRem(14),
        lineHeight: 1.6,
        fontWeight: 400,
        color: textColors.primary,
      },
      body2: {
        fontSize: BASE_THEME.typography.pxToRem(12),
        lineHeight: 1.5,
        fontWeight: 400,
        color: textColors.primary,
      },
      overline: {
        fontWeight: 500,
        letterSpacing: '0.04em',
        fontSize: BASE_THEME.typography.pxToRem(11),
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: 'normal',
      },
      caption: {
        letterSpacing: 'normal',
        lineHeight: 1.5,
        fontSize: BASE_THEME.typography.pxToRem(12),
      },
    },
    shadows: darkMode
      ? [
          'none',
          '0 1px 2px rgba(0, 0, 0, 0.1)',
          '0 1px 3px rgba(0, 0, 0, 0.12)',
          '0 2px 4px rgba(0, 0, 0, 0.14)',
          '0 2px 6px rgba(0, 0, 0, 0.16)',
          ...Array(20).fill('none'),
        ]
      : [
          'none',
          '0 1px 2px rgba(0, 0, 0, 0.04)',
          '0 1px 3px rgba(0, 0, 0, 0.06)',
          '0 2px 4px rgba(0, 0, 0, 0.06)',
          '0 2px 6px rgba(0, 0, 0, 0.08)',
          ...Array(20).fill('none'),
        ],
  });

  return THEME;
};

export default getTheme;
