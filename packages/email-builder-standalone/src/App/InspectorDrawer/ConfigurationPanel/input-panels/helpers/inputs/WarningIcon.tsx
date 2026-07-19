import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Custom warning triangle icon for inspector labels and tooltips.
 * Uses `currentColor` so parent `color` / theme (e.g. `warning.main`) controls the stroke.
 */
export function WarningIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 18 18" fontSize="small" {...props}>
      <path
        d="M9.00015 6.75V8.25M9.00015 11.25H9.00765M3.804 14.25H14.1963C15.351 14.25 16.0727 13 15.4953 12L10.2992 3C9.72184 2 8.27846 2 7.70111 3L2.50496 12C1.92761 13 2.6493 14.25 3.804 14.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </SvgIcon>
  );
}
