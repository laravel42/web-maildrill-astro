Maildrill — 20 email templates
==============================

Files: 01-business.html … 20-holidays.html (one per gallery category), index.html to browse them.

Built for email clients, not browsers:
- Nested <table role="presentation"> layout, single column, fixed 600px wrapper with explicit widths.
- Every style inlined on the element; the <style> block only carries the mobile media query.
- Bulletproof buttons (padded <td bgcolor> + display:block <a>), no image buttons.
- Hidden preheader as the first element in <body>.
- MSO conditional wrapper + PixelsPerInch 96 for Outlook's Word engine; mso-line-height-rule:exactly on text.
- Email-safe font stacks only (Georgia / Helvetica / Verdana / Tahoma) — no web fonts.
- <meta name="color-scheme" content="light dark"> and no pure #000/#fff fills, so dark-mode inversion stays legible.
- alt text on every image; real hrefs; compliance footer with postal address and unsubscribe link.
- Each file is a few tens of KB, far below Gmail's ~100KB clipping threshold.

Before sending
--------------
1. Replace the [ LOGO ] / [ WORDMARK ] text cell with your hosted logo <img> (max 200px wide, alt text).
2. Repoint every https://example.com href and the unsubscribe link to your real URLs.
3. Images are hosted on images.unsplash.com (Unsplash free licence). Swap them for your own hosted
   assets if you want full control of delivery and caching.
4. Sample recipient data (Elena Marsh, elena.marsh@fieldnote.co, account 4821, booking MRD-48213 …)
   is literal copy — replace with your merge fields.
5. Test in Gmail, Outlook (Windows), Apple Mail and one mobile client before a real send.
