# Recipes

## Purpose

Recipes are reusable section-level NDJSON snippets that the LLM splices into preset skeletons to compose richer email templates. Each recipe represents a common content pattern (stats row, pricing comparison, testimonial card, etc.) and is injected into the `# RECIPES` section of the system prompt. When the user's prompt mentions a content pattern, the LLM uses the matching recipe instead of inventing the structure from scratch.

## Recipe Inventory

| Slot | Slug | Blocks | When to Use |
|------|------|--------|-------------|
| 1 | stat-row-3col | 8 | Prompt mentions stats, metrics, or quantitative social proof. |
| 2 | feature-icon-row-3col | 11 | Prompt mentions features, benefits, value-props, or capabilities in a grid. |
| 3 | quote-card | 4 | Prompt mentions a testimonial, customer quote, or social proof quote. |
| 4 | article-preview-row | 17 | Prompt mentions newsletter digest, blog roundup, or article links. |
| 5 | cta-card-bordered | 4 | Prompt needs a secondary call-to-action, upgrade prompt, or "ready to start?" card. |
| 6 | pricing-card-2col | 22 | Prompt mentions pricing tiers, plan comparison, or subscription options. |
| 7 | step-list-vertical | 16 | Prompt mentions how-it-works, get started steps, or numbered onboarding. |
| 8 | hero-split-2col | 7 | Prompt wants an alternative hero layout with side-by-side text and image. |
| 9 | discount-banner-strip | 3 | Prompt mentions discounts, promo codes, percentage off, or flash deals. |
| 10 | testimonial-2col | 12 | Prompt mentions multiple testimonials or customer quotes side by side. |
| 11 | logo-bar-trusted-by | 8 | Prompt mentions trust signals, "trusted by", "as seen in", or partner logos. |
| 12 | announcement-banner-thin | 2 | Prompt mentions urgent announcements, limited-time banners, or top-bar alerts. |
| 13 | event-info-grid-2col | 13 | Prompt mentions event details, date/time + location, conference info, meetup logistics. |
| 14 | data-summary-card | 12 | Prompt mentions data summary, weekly digest, dashboard stats, KPI overview, analytics recap. |

## How to Add a New Recipe

1. Create an author file at `packages/backend/scripts/curate-recipes/author/{NN}-{slug}.ts`.
2. Export `slug`, `description`, `whenToUse`, and `buildRecipe()` from the file.
3. Add an entry to `packages/backend/scripts/curate-recipes/manifest.ts`.
4. Run `pnpm -F @eb/backend curate-recipes`.
5. Verify: `pnpm -F @eb/backend curate-recipes --dry-run` should print 0 errors.

## Palette Token Reference

Recipes use palette placeholders so they adapt to any preset's color scheme:

| Token | Replaced With |
|-------|--------------|
| `{{ACCENT}}` | Preset's primary accent color |
| `{{ACCENT_TEXT}}` | Text color readable on accent background (white or canvas) |
| `{{TEXT}}` | Preset's body text color |
| `{{MUTED_TEXT}}` | Preset's secondary/muted text color |
| `{{CANVAS}}` | Preset's canvas background color |
| `{{BORDER}}` | Preset's border color (often muted accent) |

The LLM substitutes these tokens with the chosen preset's actual hex values when composing a template.

## Image URL Placeholder Convention

All image URLs in recipes use the pattern:

```
https://picsum.photos/seed/REPLACE-WITH-SEMANTIC-SLUG/{width}/{height}
```

The LLM replaces `REPLACE-WITH-SEMANTIC-SLUG` with a meaningful seed slug derived from the user's prompt (e.g. `saas-team-collab`, `ecommerce-product-hero`, `editorial-feature-news`).

## ID Convention

- Each recipe uses IDs `recipe-{slug}-{n}` (e.g. `recipe-stat-row-1`, `recipe-stat-row-2`, ...).
- The first ID is always the section anchor: `recipe-{slug}-1`.
- IDs are sequential with no gaps.
- When the LLM inserts a recipe, it renumbers all IDs to its monotonic `block-{n}` counter and updates all `childrenIds` references accordingly.

## Schema Rules

The same schema rules that apply to presets apply to recipes. See the [presets README](../presets/README.md) for the full cheat-sheet (hex 6-digit colors, padding with all 4 sides, fontSize as number, ColumnsContainer 3-tuple columns, etc.).

Key recipe-specific constraints:
- First block must be `Container` or `ColumnsContainer` (the section anchor).
- No `EmailLayout` block allowed.
- All `childrenIds` must reference IDs within the recipe.
- All IDs must start with `recipe-` prefix.
