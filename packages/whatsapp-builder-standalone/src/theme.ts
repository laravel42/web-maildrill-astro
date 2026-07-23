import { createTheme, type Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    /** Editor canvas surface, distinct from paper/default. */
    canvas?: string;
  }
}

/** WhatsApp brand green — used for the editor chrome primary. */
const WA_GREEN = '#00a884';
const WA_GREEN_DARK = '#008069';

const UI_FONT_FAMILY =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Editor-chrome MUI theme. Matches the email builder's conventions
 * (same UI font, background.canvas surface) with WhatsApp green as the
 * primary. This styles the EDITOR, never the message — the message's
 * look is fixed by WhatsApp (see PhoneFrame's CSS vars).
 */
export function getTheme(darkMode: boolean, primaryColor?: string): Theme {
  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: primaryColor || (darkMode ? WA_GREEN : WA_GREEN_DARK) },
      background: darkMode
        ? { default: '#111b21', paper: '#1b262c', canvas: '#0b141a' }
        : { default: '#f8fafc', paper: '#ffffff', canvas: '#eef2f6' },
    },
    typography: { fontFamily: UI_FONT_FAMILY },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: true } },
    },
  });
}
