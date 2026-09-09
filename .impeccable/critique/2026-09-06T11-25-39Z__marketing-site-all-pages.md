---
target: marketing site (all pages)
total_score: 28
max_score: 36
na_heuristics: 7
p0_count: 1
p1_count: 3
timestamp: 2026-09-06T11-25-39Z
slug: marketing-site-all-pages
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Contact form fakes a "Message sent" success state with no real backend wired |
| 2 | Match System / Real World | 4 | Channel metaphors and plain-English pricing units land clearly |
| 3 | User Control and Freedom | 3 | No dead-ends, but pricing estimator/promo toggles have no obvious reset |
| 4 | Consistency and Standards | 3 | Per-page accent colors vary without a stated system; nav/footer/buttons otherwise consistent |
| 5 | Error Prevention | 3 | Contact form validates required fields but gives no inline format hints |
| 6 | Recognition Rather Than Recall | 4 | Sticky nav, eyebrows, and dropdown previews carry context well |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode marketing site — no repeat-user power features apply here |
| 8 | Aesthetic and Minimalist Design | 3 | `/pricing` stacks six distinct data structures with no progressive disclosure |
| 9 | Error Recovery | 3 | Errors shown but not field-specific ("Please complete all fields") |
| 10 | Help and Documentation | 2 | `/support` advertises specific article counts ("22 articles") that don't resolve to real article lists |
| **Total** | | **28/36** (78%) | **Good** |

*Heuristic 7 scored n/a as genuinely inapplicable to a Persuade-mode marketing surface; total renormalized to /36.*

## Design Specificity Verdict

**LLM assessment**: The site clears the "generic SaaS template" bar. Channel-tinted iconography (consistent color per channel across nav, product, pricing, support), terminal-style mono headings, a hand-coded (not stock) dashboard mockup, and a pricing page with real per-message rates and named competitors (Twilio, Sinch, Vonage, Brevo, Telnyx) all read as authored for Maildrill specifically. It slips into template territory in one place: every page ends with the byte-identical "Start sending in minutes." black CTA band — same headline, same mailto, same layout, on all seven live pages. Seen once it's confident; seen five times in one session it reads as a CMS partial rather than a considered close.

**Deterministic scan**: `detect.mjs` found zero findings against all 8 marketing page files directly (exit 0). A broader scan of shared layouts/components (179 files) returned one advisory-only finding — `codex-grid-background` in `src/layouts/AuthLayout.astro:87` — which is the authenticated app's layout, not used by any marketing page, so it's out of scope. No detector findings apply to the marketing surface itself. (The detector returned exit code 2 despite an advisory-only result, which contradicts its own documented behavior — worth a look if this gates CI, but not a site defect.)

**Visual overlays**: Not available this run — non-interactive session, no [Human] browser tab to inject into. Instead, Assessment B ran real Playwright screenshots (desktop 1440×900 and mobile 390×844) across all 8 routes with real incremental scrolling (to avoid false positives from lazy-loaded images and scroll-reveal animations). One confirmed, reproducible bug surfaced: **mobile horizontal overflow on `/deliverability` and `/about`** — a decorative hero "glow" blob (`.dl-hero__glow`, `.about-hero__glow`) bleeds past the 390px viewport edge because its parent section lacks `overflow-x: clip`/`hidden`. The identical bug was already fixed on the homepage hero (with an explicit code comment about it) and on `/support`, but the fix was never applied to `/deliverability`, `/about`, or `/developers`.

## Overall Impression

This is a well-crafted, product-specific marketing site with real design intent — not a template. The single biggest opportunity is closing the gap between the site's confident, transparent front half (pricing, deliverability trust signals, product mockups) and two spots where it quietly lies to the visitor: a contact form that always reports success without sending anything, and a support page advertising article counts that don't exist. Those two issues do more damage to trust than any visual polish item on this list.

## What's Working

- **Home hero product mockup** — a live-styled "Spring Launch" campaign card with SMS/WhatsApp notification chips, built from real DOM rather than a stock screenshot. Concrete and channel-specific.
- **Deliverability trust signal** (99.2% delivery, SPF/DKIM/DMARC) reused consistently across `/`, `/product`, and `/deliverability` — repetition here reads as confidence, not drift.
- **Pricing transparency** — per-unit rates, a live bill estimator, and a named-competitor comparison table are unusually confident for a SaaS pricing page.

## Priority Issues

**[P0] Contact form always reports success without sending anything**
Why it matters: `ContactForm.tsx` calls a placeholder `mockContactSubmit` and shows "Message sent... we'll get back to you within one business day" regardless of what's submitted. Every lead from `/contact` is silently dropped, and the site is actively telling visitors it received something it didn't.
Fix: wire the form to a real endpoint before shipping it live, or replace it with a mailto/calendar link until it's connected — a fake success state is a trust violation, not a missing feature.
Suggested command: `/impeccable harden`

**[P1] `/support` advertises article counts that don't exist**
Why it matters: category cards claim "14 articles," "22 articles," "31 articles," etc., but every link resolves to a single existing marketing/guide page, not a browsable article index. A visitor expecting a knowledge base hits a dead end immediately.
Fix: either build real article indexes to back the counts, or drop the numbers and relabel cards as topic links.
Suggested command: `/impeccable clarify`

**[P1] Mobile horizontal overflow on `/deliverability` and `/about`**
Why it matters: a 30px decorative glow-blob overflow at 390px width is a real, reproducible layout bug — the exact class of bug already fixed (with a code comment explaining it) on the homepage hero and `/support`, but never propagated to these two pages.
Fix: add `overflow-x: clip` (or `overflow: hidden`) to `.dl-hero` and `.about-hero`, matching the existing `.hero` fix.
Suggested command: `/impeccable adapt`

**[P1] `/pricing` stacks six dense data structures with no progressive disclosure**
Why it matters: rate card, live estimator, prepay-tier grid, competitor comparison table, regional tier table, and a 12-item checklist all appear in one vertical scroll with no narrative break — the page's densest, most cognitively loaded stretch, and on mobile it runs roughly 9,200px tall, meaning distracted visitors likely bail before reaching the FAQ or final CTA.
Fix: collapse the comparison and regional tables behind a toggle/tab, keyed off the region selector that already exists in the hero rate card.
Suggested command: `/impeccable distill`

**[P2] "Launch promo" isn't time-limited in any visible way**
Why it matters: `PROMO.endsAt` is set to `2027-01-01` — 16 months out from today — while the UI presents it as an urgent, time-boxed discount. This reads as manufactured urgency against an otherwise non-gimmicky, transparent pricing page.
Fix: either shorten the window to something genuinely time-boxed, or drop the "promo" framing entirely and present it as the current rate.
Suggested command: `/impeccable clarify`

**[P2] Every page ends with the identical CTA band**
Why it matters: "Start sending in minutes." repeats verbatim, same headline/mailto/layout, on all seven live marketing pages. Within one page it lands as a strong close; across a multi-page session it flattens what should be an escalating close into a repeated CMS partial.
Fix: vary the closing headline per page context (e.g. pricing's could reference the estimator total, about's could reference the team).
Suggested command: `/impeccable clarify`

## Persona Red Flags

**Jordan (First-Timer)**: The "Channels" nav dropdown shows 4 distinct tiles implying 4 destinations, but all four anchor to the same `/product#channels` section — mildly disorienting once noticed. On `/pricing`, the "Launch promo" ribbons appear on 3 of 4 prepay cards with the expiration only in fine print, so Jordan reads it as a permanent discount rather than a limited-time one.

**Riley (Stress Tester)**: Filling the contact form with garbage-but-valid data still returns a confident "we'll respond within one business day" — there's no way for a careful user to tell the message was never sent. This is the site's clearest example of an interaction that "appears to work but silently fails."

**Casey (Distracted Mobile User)**: `/pricing` is ~9,200px tall on mobile — a long scroll for a one-handed, interruption-prone session; Casey likely never reaches the FAQ or closing CTA. Separately, `/deliverability` and `/about` have a genuine 30px horizontal overflow at 390px width, which on some phones causes a visible sideways nudge/scroll on page load.

## Minor Observations

- `/developers` correctly redirects to `/` by design (`HIDDEN = true` flag, matches PRODUCT.md's note) and is excluded from the sitemap — not a bug.
- Global `:focus-visible` styling exists as a single rule; worth spot-checking that no component-level override suppresses it.
- About page's timeline lists "2026 — Voice & scale" as a past milestone while the current date is September 2026 — a minor tense mismatch, not a fatal error.
- The footer's "Crafted by Laravel42" credit line uses a distinct `--font-hand` cursive not used anywhere else on the page — a nice personal touch, but a one-off typographic outlier.
- `src/pages/channels/[channel].astro` exists with no `index.astro`; a bare `/channels` URL 404s even though nav never links there directly — low risk, but worth a redirect if any external link ever points to it bare.

## Questions to Consider

1. If the contact form has been silently dropping every submission since it shipped, how many real leads has this cost so far?
2. Is "Launch promo" honestly time-limited, or is it just the price with a red badge attached — and if the latter, why not say so plainly?
3. Does `/pricing` need to show every competitor and every region on one page, or would most visitors be better served by their own region/plan surfaced first and the rest behind a toggle?
