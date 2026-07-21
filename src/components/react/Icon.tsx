import { iconPaths, filledIcons, type IconName } from '@/lib/icons';

type Props = {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  title?: string;
};

/** React counterpart of the Astro Icon — same data, for use inside islands. */
export default function Icon({ name, size = 20, stroke = 2, className, title }: Props) {
  const isFilled = filledIcons.has(name);
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    role: title ? ('img' as const) : undefined,
    'aria-hidden': title ? undefined : true,
    'aria-label': title,
    // Explicit width/height + max-width:none so the global `svg { max-width:100% }`
    // reset can't collapse the icon inside small flex containers (e.g. checkboxes).
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      maxWidth: 'none',
      flexShrink: 0,
      verticalAlign: 'middle',
    } as const,
  };
  return isFilled ? (
    <svg {...shared} fill="currentColor" dangerouslySetInnerHTML={{ __html: iconPaths[name] }} />
  ) : (
    <svg
      {...shared}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  );
}
