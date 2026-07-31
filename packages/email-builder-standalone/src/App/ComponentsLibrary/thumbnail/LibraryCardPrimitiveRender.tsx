/**
 * LibraryCardPrimitiveRender — inline live preview for a saved Primitive.
 *
 * Primitives (Button, Heading, Image, Divider, Spacer, NotionText,
 * SocialMedia) are single-block savings, so we don't capture a static
 * thumbnail at save time. Instead, the listing endpoint inlines the
 * full `block` payload (~1–3 KB each), and this component mounts a
 * mini iframe per card to render the primitive HTML LIVE from that
 * payload.
 *
 * Why an iframe instead of just rendering the JSX inline?
 *   - The Reader from `@eb/email-builder` outputs email-targeted HTML
 *     (table layouts, inline styles, font links) that interferes with
 *     the host React app's CSS if mounted in the same DOM tree.
 *   - The same fonts the editor uses are loaded via Google Fonts
 *     `<link>` — the iframe can include that link without touching
 *     the host page.
 *   - We get visual fidelity matching the editor canvas without
 *     re-implementing the rendering pipeline.
 *
 * Performance:
 *   - `IntersectionObserver` defers iframe mounting until the card
 *     scrolls into view. The drawer can hold 50+ primitives without
 *     hammering the browser on open.
 *   - Once mounted, the iframe stays mounted (no remount on
 *     scroll-out) — cheap memory cost, avoids pop-in flicker.
 *   - Each iframe is sized at logical 240×120 with `pointer-events:
 *     none` so it's purely visual.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Box, useTheme } from '@mui/material';

import { buildPrimitiveHtml } from './buildThumbnailHtml';

const DEFAULT_HEIGHT = 120;
const RENDER_WIDTH = 641;
const RENDER_HEIGHT = 600;

export type LibraryCardPrimitiveRenderProps = {
  /** Stable id for the primitive (used as iframe key for cleanup). */
  id: string;
  /** The actual block payload from the listing endpoint. */
  block: unknown;
  /** CSS height of the preview strip. @default 120 */
  height?: number;
  /** Display name for accessibility. */
  alt: string;
};

export default function LibraryCardPrimitiveRender({
  id,
  block,
  height = DEFAULT_HEIGHT,
  alt,
}: LibraryCardPrimitiveRenderProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Build the HTML lazily — only when the card is first visible. The
  // build itself is synchronous but creates a React Element via
  // renderToStaticMarkup, which has nontrivial cost on a list of 50+
  // primitives. Memo + visibility gate keeps this under control.
  //
  // Rendered VERBATIM (as created) — the project theme is intentionally
  // NOT applied, so the card shows the primitive with its own saved
  // colours, matching the hover preview and the inserted result.
  const html = useMemo(() => {
    if (!isVisible) return null;
    try {
      return buildPrimitiveHtml({ id, block });
    } catch {
      // Defensive: malformed block payloads (e.g. an old version with
      // a removed prop) shouldn't crash the drawer.
      return null;
    }
  }, [isVisible, id, block]);

  // Defer iframe mount until the card scrolls into view. Once visible,
  // we leave the iframe mounted (no toggle on scroll-out) — re-
  // creating the iframe per scroll would cause flicker.
  useEffect(() => {
    if (isVisible) return undefined;
    const node = containerRef.current;
    if (node === null) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      // Older environments (or jsdom in tests) — mount immediately.
      setIsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height,
        borderRadius: 0,
        backgroundColor: theme.palette.action.hover,
        overflow: 'hidden',
        position: 'relative',
        // The iframe content is decorative for the card — don't let
        // it intercept drag / click events on the parent card.
        pointerEvents: 'none',
      }}
      aria-label={alt}
    >
      {html !== null && (
        <iframe
          // The iframe renders at full email width (RENDER_WIDTH) and
          // is then visually scaled down to fit the card's narrow
          // column via CSS transform. We keep the source iframe at
          // RENDER_WIDTH so the email-builder's media queries see a
          // desktop viewport (the @media (max-width: 640px) rule
          // would collapse columns otherwise).
          //
          // Scale = card-width / RENDER_WIDTH. We approximate with
          // a fixed scale chosen so the typical 240 px-wide card
          // shows the centered 600 px content cleanly with a small
          // margin.
          //
          // The container clips overflow via its own
          // `overflow: hidden`, so anything below `height` (after
          // scaling) is hidden.
          srcDoc={html}
          title={alt}
          sandbox="allow-scripts"
          loading="lazy"
          style={{
            width: `${RENDER_WIDTH}px`,
            height: `${RENDER_HEIGHT}px`,
            border: 0,
            transform: 'scale(0.4)',
            transformOrigin: 'top left',
            // Position absolute so the scale doesn't reserve the
            // pre-scale layout box (which would push the parent's
            // height to 600 px).
            position: 'absolute',
            top: 0,
            left: 0,
            // Hide visually if the iframe is still loading content
            // (avoids a flash of empty white).
            backgroundColor: '#ffffff',
          }}
        />
      )}
    </Box>
  );
}
