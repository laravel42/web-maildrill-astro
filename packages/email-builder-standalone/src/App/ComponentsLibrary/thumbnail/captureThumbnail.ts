/**
 * Client-side thumbnail capture for the Components Library.
 *
 * Mounts a HIDDEN iframe with the rendered email HTML, waits for web
 * fonts and images to settle, then snapshots the iframe body via
 * `html-to-image`. The capture is fully best-effort: any failure
 * (timeout, web font load failure, taint from cross-origin images,
 * etc.) resolves to `null`. The save flow is expected to fall back to
 * "no thumbnail" rather than blocking.
 *
 * Default capture: target the inner email canvas table (the centred
 * 600 px-wide content area) at 600×300 logical px @ 1.0x DPR, output
 * 240×120 (40% scale, 2:1 aspect — exact match to the LibraryCard
 * display size). The thumbnail is just a teaser; the hover Popper
 * (Task 11) shows the full live preview at 640 px wide via a real
 * iframe, so the static capture only needs to convey "this is the
 * hero with green CTA" or similar visual identity. Capturing more
 * than the top 300 px wastes bytes — users only ever see the first
 * 120 px in the card anyway.
 *
 * The iframe itself is sized 641×1200 internally so the email-builder
 * uses desktop styles (escapes the 640 px mobile breakpoint in
 * `cleanDocument.ts`) without including the surrounding backdrop in
 * the capture.
 *
 * To capture in MOBILE mode in a future upgrade, drop the iframe
 * width BELOW 640 (e.g. set IFRAME_WIDTH = 375 to mimic an iPhone
 * viewport). See the commented-out `MOBILE_*` constants below.
 *
 * To capture in MOBILE mode in a future upgrade, drop the width
 * BELOW 640 (e.g. `{ renderWidth: 375, renderHeight: 600 }` mimics
 * iPhone-ish viewports). See the commented-out `MOBILE_*` constants
 * below.
 *
 * The displayed thumbnail in the LibraryCard is 240×120 with
 * `object-fit: cover`, so capture aspect doesn't have to match the
 * card's aspect — we only see the top-centre slice.
 *
 * Backend caps storage at 512 KB; pure-text captures sit at ~30–80 KB,
 * captures with imagery can reach 200–500 KB.
 *
 * Why a hidden iframe and not a detached `Document`? Web fonts loaded
 * via Google Fonts `<link>` only resolve when the document is mounted
 * in the browser tree. Detached documents fall back to system fonts
 * and ruin the capture's typographic fidelity.
 */

import { toBlob } from 'html-to-image';

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * 1×1 transparent GIF used as the fallback for images html-to-image
 * fails to fetch (cross-origin assets without CORS headers). See the
 * `imagePlaceholder` option in `toBlob` below.
 */
const FAILED_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/**
 * Internal iframe sizing — the iframe is just a render host that
 * forces the email-builder to use desktop styles. It is NOT what we
 * capture (we capture the inner canvas table, see `canvasEl` below).
 *
 *   - Width 641 px: the absolute minimum that escapes the
 *     `@media (max-width: 640px)` mobile breakpoint emitted by
 *     `cleanDocument.ts`. The breakpoint is inclusive, so 640
 *     triggers mobile but 641 does not. We use the minimum to
 *     keep the canvas table flush against the iframe edges so
 *     no backdrop bleeds into the rendered output.
 *
 *   - Height 1200 px: tall enough to let any reasonable email
 *     section / hero / template render its full natural height.
 *     The capture target's vertical crop happens via the
 *     `renderHeight` option below — the iframe just provides
 *     enough vertical space for the content to lay out without
 *     forcing internal scroll bars or `100% height` quirks.
 */
const IFRAME_WIDTH = 641;
const IFRAME_HEIGHT = 1200;

/**
 * Capture target dimensions — what we pass to html-to-image as the
 * `width`/`height` of the rasterised area. Applied to the cloned
 * canvas table (the 600 px-wide centered email content), NOT the
 * iframe body. So no backdrop is ever included in the output.
 *
 *   - Width 600 px: the canvas table's natural width
 *     (`max-width: 600px` + `width: 100%` inside a 641 px container).
 *
 *   - Height 300 px: crops the captured email to a 2:1 strip showing
 *     the TOP of the content. The thumbnail is just a teaser — full
 *     fidelity preview happens on hover (Task 11) via a live iframe
 *     that mounts the complete component / template. Capturing more
 *     than the top 300 px is wasted bandwidth because users only see
 *     the first 120 px (50%) in the LibraryCard anyway, and the rest
 *     would still need cropping at display time. Combined with
 *     `overflow: hidden` in the style option, this guarantees the
 *     captured area is exactly `width × height` regardless of how
 *     tall the underlying email is.
 */
const DEFAULT_RENDER_WIDTH = 600;
const DEFAULT_RENDER_HEIGHT = 300;

/**
 * OUTPUT canvas dimensions — what html-to-image rasterises into.
 * 40% scale of the capture dimensions (240×120), giving:
 *
 *   - 16% of source pixel area → ~6× file-size reduction over a
 *     same-quality capture at the source resolution.
 *   - Aspect 240:120 = 2:1 matches the capture aspect 600:300 = 2:1
 *     exactly, AND matches the LibraryCard display aspect 240×120
 *     1:1. So the card renders the thumbnail at native pixel
 *     resolution with `object-fit: cover` becoming a no-op crop —
 *     no upscale, no waste.
 *   - On retina displays this is slightly soft (1× CSS, 0.5× device
 *     pixels), but acceptable: hover preview at 640 px provides the
 *     full-fidelity view.
 *
 * If you need crisper retina output, bump `canvasWidth` to 480 and
 * `canvasHeight` to 240 (matches 2:1 at 2× scale).
 */
const DEFAULT_CANVAS_WIDTH = 240;
const DEFAULT_CANVAS_HEIGHT = 120;

/*
 * --- Mobile capture preset (commented out for a future toggle) ----
 *
 * To preview emails as they look on mobile devices (single-column
 * layout, larger touch targets, smaller fonts), capture below the
 * mobile breakpoint of most email CSS (480 px is the most common
 * cutoff). A typical iPhone-class viewport is 375×667 logical px;
 * we slightly oversample the height for room.
 *
 * const IFRAME_MOBILE_WIDTH = 375;
 * const IFRAME_MOBILE_HEIGHT = 700;
 *
 * Wire it via an extra `viewport: 'desktop' | 'mobile'` option on
 * captureSubtreeThumbnail and a UI toggle in SaveSubtreeDialog.
 * Storage filename could carry an `_m` suffix to keep both side by
 * side: `{uuid}.png` and `{uuid}_m.png`.
 */
/**
 * Default device-pixel-ratio for the capture. Set to 1.0 because:
 *
 *   - The thumbnail is displayed at 240×120 in the LibraryCard, so
 *     capturing 360×480 at 1x already provides ~6× the pixels needed
 *     for the displayed size.
 *   - PNG/WebP file size grows with pixel count. 1.5x DPR multiplies
 *     pixel count by 2.25 and easily blows past the backend's storage
 *     cap for emails with images or rich backgrounds.
 *   - Email screenshots aren't precision graphics — text legibility at
 *     the card size is what matters, and 1x at 360px wide is enough.
 *
 * Callers that want sharper output can override via `options.pixelRatio`,
 * but the default optimises for staying under the cap.
 */
const DEFAULT_PIXEL_RATIO = 1.0;

export type CaptureOptions = {
  /** Capture target width — the canvas table is 600 px naturally. @default 600 */
  renderWidth?: number;
  /** Capture target height — content beyond is cropped via overflow:hidden. @default 300 */
  renderHeight?: number;
  /** Output canvas width (downscale target). @default 240 */
  canvasWidth?: number;
  /** Output canvas height (downscale target). @default 120 */
  canvasHeight?: number;
  /** Device pixel ratio for the capture. @default 1.0 */
  pixelRatio?: number;
  /** Background fill (used when the email body is transparent). @default 'white' */
  backgroundColor?: string;
  /** Wall-clock timeout. After this, the capture is abandoned and resolves to null. @default 8000 */
  timeoutMs?: number;
};

/**
 * Capture a thumbnail PNG for the given HTML document.
 *
 * Returns:
 *   - `Blob` (PNG) on success.
 *   - `null` on timeout, capture error, or cross-origin canvas taint.
 *
 * Caller is expected to:
 *   - Treat `null` as "save without thumbnail" rather than an error.
 *   - Optionally show a toast ("Preview couldn't be generated...")
 *     when the result is null AND a thumbnail was expected.
 */
export async function captureSubtreeThumbnail(html: string, options: CaptureOptions = {}): Promise<Blob | null> {
  const renderWidth = options.renderWidth ?? DEFAULT_RENDER_WIDTH;
  const renderHeight = options.renderHeight ?? DEFAULT_RENDER_HEIGHT;
  const canvasWidth = options.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = options.canvasHeight ?? DEFAULT_CANVAS_HEIGHT;
  const pixelRatio = options.pixelRatio ?? DEFAULT_PIXEL_RATIO;
  const backgroundColor = options.backgroundColor ?? '#ffffff';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let iframe: HTMLIFrameElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<Blob | null>((resolve) => {
      // Race: capture vs. timeout. Whichever resolves first wins; the
      // other branch is a no-op because `resolve` is idempotent in
      // Promise semantics (only the first call counts).
      timer = setTimeout(() => {
        console.warn('[captureSubtreeThumbnail] timeout after', timeoutMs, 'ms');
        resolve(null);
      }, timeoutMs);

      iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.style.position = 'fixed';
      iframe.style.left = '-99999px';
      iframe.style.top = '0';
      iframe.style.width = `${IFRAME_WIDTH}px`;
      iframe.style.height = `${IFRAME_HEIGHT}px`;
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.srcdoc = html;

      iframe.onload = async () => {
        try {
          const win = iframe?.contentWindow;
          const doc = iframe?.contentDocument;
          if (!win || !doc || !doc.body) {
            resolve(null);
            return;
          }

          // Wait for web fonts to finish loading. `document.fonts`
          // is the FontFaceSet API; `.ready` is a Promise that
          // resolves when all in-progress font loads complete.
          if (doc.fonts && typeof doc.fonts.ready === 'object') {
            try {
              await doc.fonts.ready;
            } catch {
              // Continue even if the font set rejects (rare).
            }
          }

          // Wait for all <img> elements to decode. Cross-origin images
          // (e.g. Unsplash) need crossorigin="anonymous" set upstream
          // for the canvas to not taint; if they fail to decode here,
          // html-to-image will skip them.
          const imgs = Array.from(doc.images);
          await Promise.all(
            imgs.map((img) =>
              img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => undefined)
            )
          );

          // Find the inner email "canvas" — the centered 600 px-wide
          // table that wraps the actual email content. Capturing this
          // instead of the body excludes the surrounding backdrop
          // (the small left/right gutter that exists because the
          // iframe must be 641 px wide to escape the mobile media
          // query, while the email content is locked at 600 px
          // max-width).
          //
          // Renderer structure:
          //   body
          //     > table (backdrop, full-width, backdropColor)
          //       > tbody > tr > td (align="center" valign="middle")
          //         > table (CANVAS — max-width: 600px, what we want)
          //           > tbody > tr > td
          //             > <Reader> content
          //
          // If the structure ever changes (e.g. renderToStaticMarkup
          // is rewritten) the selector silently falls back to
          // `doc.body` so the capture still works, just with the
          // backdrop included.
          const canvasEl =
            (doc.querySelector('body > table > tbody > tr > td > table') as HTMLElement | null) ?? doc.body;

          // Capture the iframe body. We pass our pixelRatio so the
          // resulting image is sharp on retina displays.
          //
          // Format choice: WebP (lossy, quality 0.85). WebP is
          // typically 30–50% the size of an equivalent PNG at the
          // same perceived quality, which keeps us comfortably under
          // the backend's 512 KB cap even for emails with imagery.
          // All evergreen browsers support `canvas.toBlob('image/webp')`
          // since ~2020. If a browser doesn't support WebP, the
          // canvas API silently falls back to PNG — the resulting
          // blob's magic bytes are then detected server-side as PNG
          // and stored as `.png` instead, so the back-end is format-
          // agnostic. The `quality: 0.85` knob is ignored for PNG
          // (lossless), so the fallback is harmless.
          //
          // `skipFonts: true` tells html-to-image NOT to fetch and
          // inline Google Fonts CSS into the intermediate SVG. The
          // browser's cross-origin policy blocks reading `cssRules`
          // from `fonts.googleapis.com`, which used to spam the
          // console with `SecurityError: Failed to read the 'cssRules'
          // property`. Skipping is safe because:
          //   - The fonts ARE applied to text in the live iframe (the
          //     `<link>` stylesheet loads and applies normally).
          //   - We capture to a raster image, so the final blob has
          //     fonts already rendered as pixels — no need to embed
          //     the font definitions in any portable form.
          const blob = await toBlob(canvasEl, {
            pixelRatio,
            backgroundColor,
            // Source dimensions: the canvas table is 600 px wide
            // naturally (max-width: 600px + width: 100% in a 641 px
            // td). We cap height so very tall emails don't capture
            // huge SVGs we'd just downscale anyway.
            width: renderWidth,
            height: renderHeight,
            // Output canvas dimensions (downscale during encode).
            // This is the key knob keeping byte counts low: we render
            // at 600×800 for layout fidelity, but only encode 360×480
            // worth of pixels.
            canvasWidth,
            canvasHeight,
            cacheBust: true,
            type: 'image/webp',
            quality: 0.85,
            skipFonts: true,
            // Fallback when an image can't be fetched (e.g. cross-origin
            // assets without CORS headers). Without this, html-to-image
            // sets the failed <img> src to '' which fires an error event
            // and rejects the ENTIRE capture. A 1×1 transparent GIF makes
            // failed images render as a blank gap so the rest of the email
            // (text, layout) still captures successfully.
            imagePlaceholder: FAILED_IMAGE_PLACEHOLDER,
            // Style applied to the cloned capture target. `overflow:
            // hidden` is critical: the canvas table's content can
            // extend well past `renderHeight` (a 1000+ px email
            // section, for example), and without `overflow: hidden`
            // html-to-image would render the overflow into the SVG
            // even though the SVG viewBox crops it — bloating the
            // intermediate SVG without changing the output. Hiding
            // overflow upstream keeps the SVG tight and the encode
            // fast.
            style: {
              margin: '0',
              padding: '0',
              overflow: 'hidden',
            },
          });
          resolve(blob ?? null);
        } catch (err) {
          console.warn('[captureSubtreeThumbnail] capture failed:', err);
          resolve(null);
        }
      };

      iframe.onerror = () => {
        console.warn('[captureSubtreeThumbnail] iframe failed to load');
        resolve(null);
      };

      document.body.appendChild(iframe);
    });
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (iframe !== null && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
