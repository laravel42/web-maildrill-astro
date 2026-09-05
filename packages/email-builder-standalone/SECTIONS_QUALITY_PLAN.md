# Sections quality improvement plan

Plan to raise the visual and structural quality of the pre-made **sections**
in the Components Library. Living document — check items off as they land.

> Context: sections are now rendered in previews AND inserted **as-created**
> (no document theme applied — see `feat(library): render and insert pre-made
> blocks exactly as created`). The document root also ships **without** a baked
> theme. Consequence: each section's own styling is now what the user sees and
> gets. Their intrinsic quality matters directly — there is no theme layer to
> "fix them up" anymore. This plan is about making them look polished and
> edit-ready on their own.

---

## 1. Current state (measured)

Source: `src/App/ComponentsLibrary/localPresets.data.json` (`sections` array),
catalog `version: 1782169900953`.

- **85 sections**, evenly spread over **17 roles × 5 each**: banner, comparison,
  cta, faq, features, footer, gallery, header, hero, logo, nav, pricing,
  social_proof, stats, steps, team, testimonial.
- **839 blocks** total (avg 9.9/section). Type mix:
  - `NotionText` 448 · `Container` 163 · `ColumnsContainer` 70 · `Image` 67 ·
    `Button` 49 · `Divider` 22 · `Spacer` 19 · `SocialMedia` 1.
- **Images: 67, all remote** — 66 from `ddc4vowthkjlv.cloudfront.net`, 1 from
  `placehold.co`. All have `alt` text (good). None are self-hosted/inline.
- **Palette: only 8 distinct colours**, near-monochrome:
  `#111827 #FFFFFF #D1D5DB #6B7280 #F9FAFB #F5F5F7 #E5E7EB` + one green `#4C6353`.
  This neutral palette was chosen so a theme could recolour them — but with
  as-created rendering it reads as flat/grey out of the box.
- **`mobilePadding` set on ~164 blocks** — a meaningful share of the 233
  containers/columns has no explicit mobile padding.
- **No block-level `fontFamily`** anywhere — typography leans entirely on
  document defaults.
- Block-count outliers: thinnest are 2-block bars (Announcement bar, Wordmark);
  heaviest are 21–23-block grids (testimonial/team/steps).

## 2. Quality gaps (prioritised)

1. **P0 — Flat/grey look now that theme is gone.** The neutral palette was a
   theming crutch. As-created, most sections lack accent colour, depth, and
   contrast. Highest-impact issue.
2. **P0 — External image dependency.** 100% of images are remote. Risks: broken
   previews if the CDN changes, slow/offline loads, CORS taint on client-side
   thumbnail capture (`captureSubtreeThumbnail` skips tainted images), and the
   stray `placehold.co` outlier that looks unfinished.
3. **P1 — Incomplete mobile responsiveness.** ~30% of containers lack
   `mobilePadding`; need to confirm `stackColumnsOnMobile` and mobile font sizes
   across multi-column sections.
4. **P1 — No shared design system.** Spacing, type scale, button shape/size,
   divider weight and border-radius are ad hoc across 85 sections → inconsistent
   feel. Now that previews render corners faithfully (radius fix), inconsistent
   radii are visible.
5. **P2 — Accessibility.** Verify text/background contrast (WCAG AA), link
   semantics, and tap-target sizes; alt text already present.
6. **P2 — Placeholder copy.** Audit for realistic, on-brand sample copy and
   correct merge-tag usage where relevant.
7. **P2 — Preview/thumbnail fidelity.** After edits, thumbnails must regenerate
   (bump catalog `version` to invalidate `eb:lib:thumbnails`).

## 3. Design system to define first (blocks the rest)

Author a short spec these sections must conform to (add to this doc):

- **Spacing scale**: section padding (desktop/mobile), inter-block spacing.
  Standardise on a small set (e.g. 16/24/32/48).
- **Type scale**: eyebrow / heading / subheading / body / caption sizes +
  weights + mobile sizes.
- **Colour roles**: a small, tasteful palette with real accent(s) + neutral
  surfaces, chosen to look good self-contained AND survive recolouring. Keep
  contrast AA.
- **Buttons**: canonical shape (radius), size, padding, and 1–2 variants.
- **Dividers/rules**: single weight + colour.
- **Radius**: one container radius value (or intentionally 0) used consistently.

## 4. Image strategy

- Replace the lone `placehold.co` image with a real asset.
- Decide a durable source for the 66 CDN images: (a) keep CloudFront but pin a
  stable path + set `crossorigin="anonymous"` so thumbnail capture doesn't
  taint, or (b) self-host a curated set under `public/`/S3 we control.
- Prefer lightweight, on-theme imagery; add graceful fallbacks (background
  colour behind images) so a failed load still looks intentional.
- Keep `alt` on every image (already 100%).

## 5. Execution phases

- [ ] **Phase 0 — Audit & spec.** Finalise §3 design system + §4 image decision.
      Build a per-section scorecard (role, blocks, colours, images, mobile
      padding, issues).
- [ ] **Phase 1 — Fix outliers/reliability.** Replace `placehold.co`; add
      `crossorigin`/fallbacks; fix any broken image refs.
- [ ] **Phase 2 — Responsive pass.** Add missing `mobilePadding`, verify
      `stackColumnsOnMobile` + mobile font sizes on every multi-column section.
- [ ] **Phase 3 — Visual polish, role by role.** Apply the design system;
      introduce tasteful accent colour, hierarchy and depth. Do it one role
      (5 sections) at a time; keep each section internally consistent.
- [ ] **Phase 4 — Accessibility + copy.** Contrast checks, link/tap-target
      review, sample-copy polish, merge-tag correctness.
- [ ] **Phase 5 — Regenerate previews.** Bump catalog `version` so
      `seedLocalLibrary` clears `eb:lib:thumbnails`; verify thumbnails, hover
      previews and inserted output all match.

## 6. Acceptance criteria

- Every section looks polished and on-brand **without** any theme applied.
- No section depends on a remote placeholder; images are stable + `crossorigin`
  safe for thumbnail capture, with a colour fallback.
- Every multi-column section stacks and pads correctly on mobile.
- Consistent spacing/type/button/radius across all 85 per the §3 spec.
- Text/background contrast meets WCAG AA.
- Card thumbnail == hover preview == inserted result (all as-created, square).
- `npm run check` = 0 errors and `npm run build` green after data edits.

## 7. Risks & notes

- **Do not reintroduce theme coupling.** Sections must look good self-contained,
  not rely on a document theme (that model was intentionally removed).
- **Thumbnail cache is version-gated.** Any section edit needs a `version` bump
  or previews go stale.
- **Editing 85 sections is large.** Work role-by-role; keep edits to the JSON
  data + (if needed) the seeders — no rendering-pipeline changes.
- **Keep it data-only where possible.** Prefer editing `localPresets.data.json`
  (and the `devSeed*`/recapture dev tools) over touching component code.

## 8. Open questions (for product)

- Target aesthetic: keep neutral/minimal, or lean into a branded palette?
- Image licensing/source of record for the curated set?
- Are all 17 roles × 5 needed, or should we deepen fewer, higher-quality ones?
