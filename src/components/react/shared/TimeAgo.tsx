import { useEffect, useState } from 'react';
import { absUtc, agoNow } from './time';

/**
 * "…ago" against the READER's clock, hydration-safe.
 *
 * Every screen that shows one of these is an Astro island: Astro renders it to
 * HTML on the server, then hydrates it in the browser. Calling `agoNow()`
 * during render would therefore stamp the HTML from the *host* clock and the
 * first client render from the *reader's* — two different strings for the same
 * row whenever the two clocks straddle a rounding boundary, which React
 * resolves by silently repainting the node. So the server ships the instant
 * itself (`absUtc`, a pure function of the timestamp — no clock, no zone, so
 * both sides emit the same bytes) and the relative form arrives on mount. Same
 * device, and the same reason, as the dashboard's greeting.
 *
 * The absolute form is also the right answer with JS off, which is the other
 * thing the old fixture-clock "1m ago" got wrong: it was in the HTML.
 */
export default function TimeAgo({
  at,
  prefix,
  className,
}: {
  /** ISO-8601 instant. Anything unparseable renders "—". */
  at: string | number | Date | null | undefined;
  /** Optional lead-in rendered inside the element, e.g. "Updated ". */
  prefix?: string;
  className?: string;
}) {
  const [rel, setRel] = useState<string | null>(null);

  /* The reader's clock only exists after hydration. Keyed on the instant so a
     re-sorted or re-fetched row relabels itself instead of keeping the
     previous row's age. */
  useEffect(() => {
    setRel(at == null ? '—' : agoNow(at));
  }, [at]);

  if (at == null) return <span className={className}>—</span>;
  const abs = absUtc(at);
  if (abs === '—') return <span className={className}>—</span>;
  const iso = new Date(at).toISOString();
  return (
    <time className={className} dateTime={iso} title={abs}>
      {prefix}
      {rel ?? abs}
    </time>
  );
}
