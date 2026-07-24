# Presets

## Purpose

The preset system provides 16 schema-valid, full-template anchors that are injected into the AI system prompt as a `# PRESETS` section. Each preset is a complete email document (NDJSON) representing a distinct use case, giving the LLM concrete references for tone, structure, palette, and font pairing so it can generate templates that match real-world design patterns without hallucinating block structures.

## Slot Matrix

| Slot | Slug | Source File | fontFamily | Blocks | Description |
|------|------|-------------|------------|--------|-------------|
| 1 | saas-onboarding | `skills/email-builder/references/json/01.json` | MONTSERRAT | 25 | SaaS / onboarding — multi-section with feature card and footer. |
| 2 | editorial-newsletter | `skills/email-builder/references/json/02.json` | PLAYFAIR | 31 | Editorial newsletter — feature story, section dividers, editorial footer. |
| 3 | ecommerce-flash-sale | `skills/email-builder/references/json/03.json` | OSWALD | 32 | E-commerce flash sale — bold hero banner, discount code, product grid. |
| 4 | event-celebration | `skills/email-builder/references/json/04.json` | OSWALD | 30 | Event / celebration announcement — full-bleed hero, date callout, CTA. |
| 5 | non-profit-cause | `skills/email-builder/references/json/05.json` | MERRIWEATHER | 22 | Non-profit / cause — awareness header, story body, donation CTA. |
| 6 | receipt-otp-minimal | `skills/email-builder/references/json/06.json` | LATO | 28 | Receipt / OTP minimal — single-column transactional, code highlight, footer. |
| 7 | friendly-consumer | `skills/email-builder/references/json/07.json` | OPEN_SANS | 39 | Friendly consumer — warm palette, illustration area, lifestyle copy. |
| 8 | travel-hospitality | `skills/email-builder/references/json/08.json` | PLAYFAIR | 31 | Travel / hospitality — destination hero, itinerary highlights, booking CTA. |
| 9 | wellness-mindful | `skills/email-builder/references/json/09.json` | MERRIWEATHER | 51 | Wellness / mindfulness — soft palette, service tiles, gentle CTA. |
| 10 | real-estate | `skills/email-builder/references/json/10.json` | PLAYFAIR | 41 | Real estate / B2B partnership — property image, key stats, contact block. |
| 11 | fintech-data | `skills/email-builder/references/json/11.json` | MONTSERRAT | 28 | Fintech / data report — KPI summary table, chart placeholder, update footer. |
| 12 | education-coaching | `skills/email-builder/references/json/12.json` | MERRIWEATHER | 27 | Education / coaching — instructor intro, course highlights, enroll CTA. |
| 13 | product-launch-saas | `skills/email-builder/references/json/13.json` | MONTSERRAT | 36 | Product launch (SaaS / app) — feature showcase, screenshots row, download CTA. |
| 14 | confirmation-reservation | `skills/email-builder/references/json/14.json` | LATO | 33 | Confirmation / reservation — details summary card, next-steps list, contact link. |
| 15 | abandoned-cart | `skills/email-builder/references/json/15.json` | MODERN_SANS | 37 | Abandoned cart — product thumbnail, price, urgency copy, checkout CTA. |
| 16 | activation-reengagement | `skills/email-builder/references/json/16.json` | MONTSERRAT | 35 | Activation / re-engagement — prize/reward reveal, CTA, social links. |

## How to Add a New Preset

1. Drop a candidate JSON into `skills/email-builder/references/json/{NN}.json` (use the next available number, e.g. `17.json`).
2. Add an entry to `packages/backend/scripts/curate-presets/manifest.ts` with `slug`, `sourceFile`, `fontFamily`, and `description`.
3. Run `pnpm -F @eb/backend curate-presets`.
4. Verify the slot generated cleanly: `pnpm -F @eb/backend curate-presets --dry-run` should print 0 errors.

## How to Regenerate After Editing a Source JSON

1. Edit the source at `skills/email-builder/references/json/{NN}.json`.
2. Run `pnpm -F @eb/backend curate-presets`.

NDJSON output files and `index.json` are regenerated in place.

## Schema Rules Summary

Cheat-sheet for producing valid editor documents without re-reading the source:

| Rule | Constraint |
|------|-----------|
| Hex colors | 6-digit only (`#RRGGBB`). 3-digit shorthand fails validation. |
| Padding | Object must have all four sides (`top`, `bottom`, `right`, `left`) as numbers, or be `null`/`undefined`. |
| fontSize | Must be a number. String values like `'13px'` fail. |
| ColumnsContainer.props.fixedWidths | Tuple length exactly 3 (pad with `null`). |
| ColumnsContainer.props.columns | Tuple length exactly 3 (pad with `{ childrenIds: [] }`). |
| ColumnsContainer.props.columnsCount | `2` or `3` only. |
| Container.style.shape / Button.style.shape | `'rectangle' \| 'pill'` or `{ topLeft, topRight, bottomLeft, bottomRight }`. Legacy `'rounded'` / `'squared'` fail. |
| SocialMedia.data.theme (block-level) | `'light' \| 'dark' \| 'colored'` only — legacy values fail. |
| SocialMedia items | Each requires `{ id, key, label, iconName, theme, size, sizePx, url }`. |
| Block types | Legacy `CustomEditor` is migrated to `NotionText` (only remaining migrator); `Wysiwyg` / `Text` / `Avatar` were fully retired. |

## Sanitizer Pipeline Overview

The sanitizer (`packages/backend/scripts/curate-presets/sanitize.ts`) applies 8 ordered per-block rules followed by 3 document-level passes:

### Per-block rules (applied in order)

| # | Rule ID | Action |
|---|---------|--------|
| 1 | `legacy_block_type` | Rewrite `CustomEditor` → `NotionText`. |
| 2 | `color_normalize` | Expand 3-char hex to 6-char; uppercase normalize all color fields. |
| 3 | `padding_complete` | Ensure `padding`/`mobilePadding` objects have all 4 sides as numbers. |
| 4 | `fontSize_coerce` | Parse string fontSize (e.g. `'13px'`) to number; drop if NaN. |
| 5 | `shape_legacy` | Map `'rounded'`/`'squared'` → `'rectangle'`. |
| 6 | `columns_normalize` | Fix `fixedWidths` to length 3, `columns` to length 3, validate `columnsCount`. |
| 7 | `socialmedia_normalize` | Remap legacy item themes, regenerate icon URLs, fill required field fallbacks. |
| 8 | `fontFamily_root_override` | Override `root.data.fontFamily` with the manifest's target value. |

### Document-level post-passes

| Pass | Action |
|------|--------|
| `cleanDangling` | Remove child IDs that reference non-existent blocks from all parent arrays. |
| `removeOrphans` | Delete blocks not reachable from `root` via BFS over childrenIds. |
| `pruneEmptyContainers` | Remove Container/ColumnsContainer with 0 children, cascading up to 10 iterations. |

## Notes

- **`removeOrphans` vs editor's `repairOrphanedBlocks`**: The sanitizer's `removeOrphans` *deletes* blocks not reachable from `root`. The editor's `repairOrphanedBlocks` does the OPPOSITE — it *reattaches* unreferenced blocks to root. Don't confuse them.
- **`pruneEmptyContainers`** removes Container/ColumnsContainer blocks with 0 children and cascades: removing an empty container may leave its parent empty, triggering another pass (up to 10 iterations).
- **Candidate root path**: Defaults to `/tmp/eb-candidates` for legacy entries. New entries should always live under `skills/email-builder/references/json/`.
