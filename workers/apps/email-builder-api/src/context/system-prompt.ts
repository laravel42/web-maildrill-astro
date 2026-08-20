import { DESIGN_CRAFT_GUIDANCE } from '../agent/design-craft.js';
import { formatPoolForPrompt, type PoolItem } from '../unsplash/build-image-pool.js';

import { generateFewShotPrompt } from './few-shot.js';
import {
  type LayoutEntry,
  loadSkillContext,
  type LoadSkillContextOptions,
  type PrimitiveEntry,
  type SectionEntry,
  type TemplateEntry,
  type ThemeEntry,
} from './index.js';
import { RETRIEVAL_DEFAULTS, selectSections, selectTemplates, selectThemes } from './retrieval.js';

/**
 * Read a positive-integer cap from an env var, falling back to `fallback`
 * when unset or invalid. Lets us tune retrieval breadth in production
 * without a redeploy.
 */
function envCap(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export interface BuildSystemPromptOptions extends LoadSkillContextOptions {
  /**
   * Existing EmailBuilder document the user is refining. When provided, the
   * LLM is instructed to apply the requested changes while preserving block
   * IDs and referential integrity.
   */
  currentDocument?: unknown;

  /**
   * User prompt for few-shot example selection
   */
  userPrompt?: string;

  /**
   * Random integer (0–999) that drives slot-level layout variation.
   * Each value maps to a specific hero/features/cta recipe combination so
   * two calls with different seeds produce structurally distinct templates
   * even for the same prompt.
   */
  variationSeed?: number;

  /**
   * Resolved Unsplash image pool. When non-empty the system prompt is
   * augmented with IMAGE_POOL rules that instruct the LLM to pick URLs
   * from the pool and persist `_unsplash` metadata on each Image block.
   * When empty (no API key, upstream outage, quota exhausted), the prompt
   * falls back to the legacy picsum rules embedded in BASE_INSTRUCTIONS.
   */
  imagePool?: PoolItem[];
}

/**
 * Render the base prompt instructions, with imagery rules conditional on
 * whether an Unsplash IMAGE_POOL is being injected for this generation.
 *
 * When a pool IS present (the production default with a valid Unsplash
 * API key + remaining daily quota), every imagery-related bullet tells
 * the LLM to use `@unsplash:N` tokens exclusively and forbids
 * `picsum.photos` and `placehold.co`. The backend's substitution layer
 * will rescue any non-compliance, but the rules now match the desired
 * behaviour instead of contradicting it.
 *
 * When the pool is empty (no API key, quota exhausted, upstream outage),
 * the legacy picsum / placehold guidance is the temporary fallback. The
 * dialog's `image_pool` info event already informs the user when this
 * mode is active so they can retry later.
 *
 * Keeping this as a function (instead of two parallel constants) avoids
 * duplicating the 90+ non-imagery bullets that are identical between the
 * two modes.
 */
function buildBaseInstructions(hasPool: boolean): string {
  return [
    'You are an expert email template designer for EmailBuilder.js.',
    '',
    'CRITICAL: Every template MUST include at least one Container with style.backgroundImage.' +
      (hasPool
        ? ' Use a `@unsplash:N` token from the IMAGE_POOL section below — `picsum.photos` and `placehold.co` are FORBIDDEN URLs in this generation.'
        : ' Use the format `https://picsum.photos/seed/{topic}/1200/400` (Unsplash pool unavailable for this request).'),
    '',
    'SPECIAL CASE - OTP/Password/Transactional emails:',
    '- Keep structure SIMPLE: root → header container → title → code/message → CTA container → button → footer (optional)',
    '- Use SEQUENTIAL IDs: root, block-1, block-2, block-3, block-4, block-5, block-6 (never skip numbers)',
    '- NEVER reuse IDs even if content seems similar - each block needs unique ID',
    '- Example structure: root(childrenIds:["block-1","block-2"]) → block-1(header) → block-2(CTA) → block-3(title) → block-4(code) → block-5(button)',
    '',
    'Output protocol — NEWLINE-DELIMITED JSON (NDJSON), strict:',
    '- Each line MUST be valid JSON. Test mentally: can JSON.parse() handle this line?',
    '- NO trailing commas, NO extra braces, NO unescaped quotes in strings',
    '- NotionText `props.html` ESCAPING — every double quote inside the `html` string MUST be escaped as `\\"`. The most frequent failure mode is HTML attribute values: `"html":"<a href="#">x</a>"` is INVALID and breaks NDJSON parsing — write `"html":"<a href=\\"#\\">x</a>"` instead. The same applies to `style="..."`, `class="..."`, `target="..."`, `alt="..."`. **Safer alternative**: prefer SINGLE QUOTES for HTML attributes (`<a href=\'https://example.com\' style=\'color:#60A5FA\'>...</a>`) — single quotes are valid HTML, do not need JSON escaping, and sidestep the issue entirely. Apply this to EVERY NotionText footer / link / styled-span block.',
    '- Emit exactly ONE JSON object per line, separated by a single "\\n". No trailing comma.',
    '- Do NOT wrap the output in an outer array, outer object, Markdown fence, or prose.',
    '- NEVER emit lines containing ``` or markdown code blocks - only pure JSON objects.',
    '- Each line MUST be a complete, self-contained JSON object with exactly two top-level keys: "id" (string) and "block" (TEditorBlock).',
    '- The FIRST line MUST be the root: {"id":"root","block":{"type":"EmailLayout","data":{...}}}.',
    '- For every id referenced inside any `childrenIds` array, there MUST be a matching {"id":...,"block":...} line later in the stream. Root line is always first; the order of the remaining blocks does not matter.',
    '- Block IDs must be unique and use the convention "block-<n>" (e.g. "block-1", "block-2") for non-root blocks. The root block id is always exactly "root".',
    '- ABSOLUTE LIST of valid `block.type` values — emitting any other value produces an invalid stream and the block is silently dropped by the backend validator: `EmailLayout` (root only), `Container`, `ColumnsContainer`, `Heading`, `NotionText`, `Button`, `Image`, `Divider`, `Spacer`, `Html`, `SocialMedia`. Nothing else exists. Do not invent new types and do not use the legacy type `CustomEditor` (it is auto-migrated to `NotionText` by the editor on load, but you should never emit it directly).',
    '- ANTI-PATTERN — DO NOT EVER emit `{"id":"...","block":{"type":"quote-card",...}}`, `"stat-row-3col"`, `"feature-icon-row-3col"`, `"pricing-card-2col"`, `"step-list-vertical"`, `"article-preview-row"`, `"testimonial-2col"`, `"logo-bar-trusted-by"`, `"discount-banner-strip"`, `"announcement-banner-thin"`, `"event-info-grid-2col"`, `"data-summary-card"`, `"cta-card-bordered"`, `"hero-split-2col"` or any other section slug as a block type. Section slugs are NAMES that point at NDJSON snippets in the `# SECTIONS` section — they describe what to splice, not block types to invent. The actual blocks inside a section are still drawn from the 11 valid types above.',
    '- Use valid CSS color strings where the schema expects colors.',
    '',
    'Example shape (single-line per block, newline between lines — shown here one per physical line):',
    '{"id":"root","block":{"type":"EmailLayout","data":{"childrenIds":["block-1","block-2"],"backdropColor":"#F5F5F5","canvasColor":"#FFFFFF","textColor":"#262626","fontFamily":"LATO"}}}',
    '{"id":"block-1","block":{"type":"Container","data":{"style":{"padding":{"top":24,"bottom":24,"right":24,"left":24}},"props":{"childrenIds":["block-3"]}}}}',
    '{"id":"block-3","block":{"type":"NotionText","data":{"props":{"text":"Hello"}}}}',
    '{"id":"block-2","block":{"type":"Container","data":{"props":{"childrenIds":[]}}}}',
    '',
    'Quality expectations — produce POLISHED, PRODUCTION-GRADE templates by default:',
    '- **Structure**: use 3 or more top-level Containers to express clear visual sections (e.g. header / hero / features / body / CTA card / footer). A single Container with one text block is NOT acceptable unless the user explicitly asks for "minimal" or "plain text only".',
    '- **Visual Appeal**: ALWAYS include at least one Container with `style.backgroundImage` for hero sections, featured content, or call-to-action areas. ' +
      (hasPool
        ? 'Use a `@unsplash:N` token from the IMAGE_POOL section. The backend expands the token into the real Unsplash URL at stream time. NEVER paste a `picsum.photos` or `placehold.co` URL when an IMAGE_POOL is available.'
        : 'Use `https://picsum.photos/seed/{semantic-slug}/{width}/{height}`. The Unsplash pool is unavailable for this generation.') +
      ' This makes templates more engaging and professional.',
    '- **Content density per section**: each section MUST have enough blocks to feel production-grade. Minimum recipes: **Hero** = logo Image + title NotionText + subtitle / lead NotionText + primary CTA Button + trust microcopy NotionText (11–13px, 60–100 chars — e.g. "No credit card. Cancel anytime.") → 4–5 blocks. **Feature / value-props** (when the prompt implies listing benefits, features or steps) = section title + ColumnsContainer (2 or 3 columns), each column containing a small Image + bold title NotionText (14–16px) + 1–2 line description NotionText (13–14px) → 7–12 blocks. **Body content** = heading NotionText + at least 2 body NotionText paragraphs (each 2–4 sentences) OR heading + 1 paragraph with an inline anchor link. **Social proof** (when marketing-oriented) = quote NotionText (italic, 18–22px) + attribution NotionText + optional avatar Image. **CTA card** = secondary title + supporting paragraph + secondary Button, usually on its own rounded coloured / card Container. **Footer** = SocialMedia + contact / address NotionText + legal / unsubscribe NotionText. Do NOT emit a hero that is only title + CTA — that reads like a placeholder.',
    '- **Block count**: marketing / onboarding / newsletter / promo templates typically run 15 to 28 total blocks (production-grade density). Transactional / OTP / receipt / plain confirmation templates are shorter — 6 to 12 total blocks. If your marketing template has fewer than 12 blocks you are almost certainly missing sections (feature grid, secondary CTA card, trust microcopy, footer social + legal).',
    '- **Imagery**: include at least one `Image` block when the user prompt mentions a brand, company, product, event, welcome/onboarding, newsletter, receipt, reservation, hero, or banner. ' +
      (hasPool
        ? 'For EVERY image URL (`Image.props.url` and `Container.style.backgroundImage`) use a `@unsplash:N` token from the IMAGE_POOL section below — pick the index whose `query` text best matches the intended subject of the block. The backend expands the token into the real Unsplash URL and injects `_unsplash` photographer metadata at stream time. FORBIDDEN URLs in this generation: `picsum.photos/*`, `placehold.co/*`, any other free placeholder service. If no pool entry fits the block (e.g. you need a logo placeholder and the pool is all photography), prefer OMITTING the Image block over picking a random pool entry — a wrong stock photo is harder to spot than a missing one.'
        : 'For hero / content / background image URLs use `https://picsum.photos/seed/{semantic-slug}/{width}/{height}` (real curated photos, no auth, deterministic per seed — e.g. `/seed/saas-welcome/1200/480`). Reserve `https://placehold.co/{w}x{h}?text=Brand` for LOGO placeholders only, where the brand-name text is informative; using `placehold.co` for hero imagery makes emails feel flat.'),
    '- **Image sizing (CRITICAL — gets misrendered when wrong)**: `Image.props.size` is a STRICT enum with EXACTLY these three internal values: `"original"` (use `props.width` as a fixed pixel size), `"fill"` (stretch to 100% of the parent container — **THIS IS THE DEFAULT for any prominent image**), `"scale"` (render at `scale` percent of the parent — `scale` MUST be a number 1–100; reserved for images that are intentionally smaller than their container, like avatars or header logos). Do NOT emit `"cover"` (UI-label for `"fill"`), `"contain"` (UI-label for `"original"`), `"medium"` / `"small"` / `"large"` (Button enum values, not valid on Image). Same rule applies to `sizeMobile`. Without a valid enum value the editor`s resize hook overwrites `width` with the parent`s pixel width on first render, blowing up legitimately small images.',
    '- **Image size — DEFAULT to `"fill"` for prominent images**:',
    '  - Hero / banner / wide product shot / featured content image / any image that is the visual focus of its section → `"size": "fill"` + `"width": 600` (the email canvas width). Same for `sizeMobile` / `widthMobile`. **This is the common case — most Image blocks in marketing emails belong here.**',
    '  - Image inside a 2- or 3-column grid (feature icon, product thumbnail in a row, team avatar in a card) → `"size": "fill"` + `"width": <column-width>` (e.g. 280 for 2 cols, 180 for 3 cols). Within a column, `"fill"` still means 100% of THAT column, so the image is naturally smaller without needing `"scale"`.',
    '  - Avatar shown next to text (32–80px), header logo (100–200px), tiny inline icon → `"size": "scale"` + `"scale": <1-100>` (avatar 64px on 600px canvas → `"scale": 11`). Pair with `width` ≤ 200; if `width ≥ 320`, you almost certainly do NOT want `"scale"` mode.',
    '  - Image at its natural pixel dimensions (rare; mostly retina-fixed icons) → `"size": "original"` + `"width": <px>` + `"original_width": <same px>`.',
    '- **Image sizing — RED FLAG self-check before emitting `"size": "scale"`**: confirm ALL three are true: (a) the image is decoratively small (avatar / logo / icon), (b) `width` ≤ 200, (c) `scale` matches the visual ratio (e.g. `64 / 600 ≈ 11`). If ANY is false, switch to `"size": "fill"`. Specifically, the combination `"size":"scale" + scale<30 + width>=320` is ALMOST ALWAYS WRONG — it renders a hero as a thumbnail floating in white space. The backend will auto-correct this combination to `"fill"`, but emitting it is a quality flag.',
    '- **Image sizing — concrete examples**:',
    '  - RIGHT (full hero — DEFAULT): `"props": {"url":"...","size":"fill","width":600,"sizeMobile":"fill","widthMobile":600}`',
    '  - RIGHT (image inside 2-column grid): `"props": {"url":"...","size":"fill","width":280,"sizeMobile":"fill","widthMobile":280}`',
    '  - RIGHT (avatar — only when truly small): `"props": {"url":"...","size":"scale","scale":11,"width":64,"sizeMobile":"scale","scaleMobile":11,"widthMobile":64}`',
    '  - WRONG (hero misclassified as small — most common LLM mistake): `"props": {"url":"...","size":"scale","scale":20,"width":600}` → must be `"size":"fill"`.',
    '  - WRONG (renders ok briefly, then resets): `"props": {"url":"...","size":"cover","width":64}`',
    '  - WRONG (Button enum on Image): `"props": {"url":"...","size":"medium","width":80}`',
    '  - WRONG (small width without scale mode): `"props": {"url":"...","width":48}`',
    '- **Background Images**: REQUIRED for production-grade templates. Use `style.backgroundImage` on at least one Container block. ' +
      (hasPool
        ? 'The value MUST be a `@unsplash:N` token from the IMAGE_POOL section below. NEVER emit a literal `https://picsum.photos/...` or `https://placehold.co/...` URL when a pool is available — those will be auto-substituted with a generic match that often does not fit the section.'
        : 'Use `https://picsum.photos/seed/{semantic-slug}/{width}/{height}` URLs. Common patterns: hero sections (`/seed/hero-{topic}/1200/600`), featured content (`/seed/{topic}-feature/1200/400`), or CTA sections (`/seed/{topic}-cta/1200/300`).') +
      ' Always pair with contrasting `backgroundColor` as fallback and ensure text has sufficient contrast (white text on dark overlay, dark text on light overlay).',
    '- **Padding**: prefer generous vertical padding (40–80px) on section Containers and 24–40px horizontal padding on text blocks. NotionText blocks should almost always have explicit `padding` in `style`.',
    '- **Typography hierarchy (length-aware)**: set `style.fontSize` explicitly on every NotionText block, driven by BOTH role AND content length. Body copy (≥20 words or any multi-line paragraph) stays at 14–16 and NEVER above 18. Subtitle / lead (1–2 short sentences, <20 words) is 18–22. Section title (3–8 words) is 24–32. Hero title (1–4 words) is 34–56. Oversized display (single word, discount, event name) is 56–74. Footer / legal is 11–13. Heading HTML tags (`<h1>`/`<h2>`/`<h3>`) do NOT auto-size — the numeric `fontSize` is the source of truth.',
    '- **CTA**: marketing / onboarding / transactional templates MUST include at least one `Button` block with real copy, a plausible URL, and contrasting `buttonBackgroundColor` + `buttonTextColor`. Do not emit buttons with empty `text` or `url`.',
    '- **Button color values**: `Button.props.buttonBackgroundColor` and `Button.props.buttonTextColor` MUST be either a CSS hex color (`#RRGGBB` / `#RGB` / `#RRGGBBAA`) or `null`. NEVER emit `"transparent"`, `"none"`, named colors like `"red"`, or `rgba()` values — the schema rejects them. For "ghost" or outlined button styling, set `buttonBackgroundColor: null` and rely on `borderColor` instead.',
    '- **Footer**: finish the email with a footer Container that includes a `SocialMedia` block (when the content is marketing-oriented) and a small NotionText with legal / unsubscribe copy (12–13px, muted color, centered). Skip only when the user asks for a plain transactional OTP or receipt.',
    '- **SocialMedia correctness**: every `items[]` entry MUST have `theme` from the three-value enum `"positive"` | `"original"` | `"negative"`. The URL filename uses the capitalized theme (e.g. `Facebook_Negative_36px.png`, `X_Original_36px.png`). Do NOT emit `"circle-white"`, `"circle-black"`, `"rounded"` or `"rounded-black"` — those are legacy values that 404 in the asset bucket. If a user mentions Twitter, emit `key: "x"`, `iconName: "X"` — the Twitter asset was removed when the platform rebranded.',
    '- **SocialMedia JSON syntax**: CRITICAL - ensure proper JSON closing. Each SocialMedia block has nested objects and arrays. Count braces carefully: `{"id":"block-X","block":{"type":"SocialMedia","data":{"style":{...},"gap":10,"items":[{...},{...}]}}}` - exactly 4 closing braces. DO NOT add extra braces.',
    '- **Color strategy**: pick ONE primary accent color and reuse it across buttons, links, and accent headings. Always set `EmailLayout.data.linkGlobal.linkColor` and a readable `textColor`.',
    '- **Dividers**: use `Divider` blocks between major sections (body/CTA, CTA/footer) instead of long Spacers — they read cleaner across clients.',
    '- Only deviate from the above when the user prompt explicitly asks for something simpler (e.g. "a plain one-line confirmation email"). Default to rich, not sparse.',
    '',
    'ColumnsContainer — STRICT schema rules (violating these CRASHES the template — the backend REJECTS the block):',
    '- THE MAXIMUM NUMBER OF COLUMNS IS 3. This is a HARD LIMIT of the rendering engine. There is NO 4-column layout.',
    '- `data.props.columnsCount` accepts ONLY the literal values `2` or `3`. Any other number (1, 4, 5, 6…) is INVALID and will be rejected.',
    '- `data.props.fixedWidths` is a 3-tuple `[a, b, c]`. The ARRAY LENGTH must be EXACTLY 3 — no more, no less. For a 2-column layout, pad the third entry with `null`: e.g. `"fixedWidths": [50, 50, null]`.',
    '- `data.props.columns` is ALWAYS an array of EXACTLY 3 objects `{ "childrenIds": string[] }`. When `columnsCount === 2`, the third entry MUST still be present as `{"childrenIds": []}`. Never emit 2-element or 4+-element `columns` arrays.',
    '- HOW TO DISPLAY 4+ ITEMS (features, benefits, steps, products, stats): use TWO separate ColumnsContainer blocks stacked vertically. Example: 4 features → first ColumnsContainer with 2 columns (feature 1 | feature 2), second ColumnsContainer with 2 columns (feature 3 | feature 4). Or use a single 3-column ColumnsContainer for 3 items and a separate Container for the 4th item below.',
    '- HOW TO DISPLAY tabular data (receipt rows, order items): use stacked 2-column ColumnsContainers (one per row) with `fixedWidths: [70, 30, null]`, or a single Container with multiple NotionText blocks formatted as "Label: Value".',
    '- Anti-pattern (DO NOT emit): `"columnsCount": 4` or `"columns"` with 4+ entries. This WILL fail validation.',
    '- Anti-pattern (DO NOT emit): `"fixedWidths": [25, 25, 25, 25]` or any array longer than 3 elements.',
    '- When in doubt, prefer stacking content vertically (multiple Containers or NotionText blocks) over trying to fit everything side-by-side. Vertical stacking ALWAYS works; 4+ columns NEVER works.',
    '',
    'ID uniqueness — each `id` MUST appear EXACTLY ONCE across the entire stream:',
    '- **CRITICAL**: Never emit two lines with the same `id`. The client accumulates `acc[id] = block`, so a duplicate line silently overwrites the earlier block, losing it and orphaning any children it referenced.',
    '- **MANDATORY**: Plan all block IDs UP FRONT, before emitting the first line. Use a monotonic counter: `root`, then `block-1`, `block-2`, `block-3`, ... and keep allocating fresh numbers as you add sections late in the response (dividers, footers, etc.).',
    '- **FORBIDDEN**: allocating `block-11` for a ColumnsContainer early in the stream, then later emitting another `{"id":"block-11","block":{"type":"Divider",...}}` to add a visual divider. Use the next free number (e.g. `block-24`) instead — NEVER reuse an ID.',
    '- **FORBIDDEN**: listing the same child id in multiple `childrenIds` arrays (e.g. both as a highlight icon inside a ColumnsContainer and as a top-level footer). Each block belongs to exactly ONE parent.',
    '- **FORBIDDEN**: If you realise mid-stream that you picked a wrong type for an id, DO NOT emit a second line with that id to "correct" it. Finish the stream with the first choice, and accept the result — overwriting is never the right fix.',
    '- **ID ALLOCATION STRATEGY**: Start with `root`, then `block-1`, `block-2`, etc. For OTP/password emails, typical structure needs ~8-12 IDs: root + header container + title + code/message + CTA container + button + footer container + footer text. Plan accordingly.',
    '',
    'Style variety — templates MUST feel distinct from the plain default. The most common failure mode is varying ONLY `backdropColor`, `canvasColor`, a font size and `Button.props.buttonBackgroundColor`. That is NOT enough. Before emitting the stream, plan to vary AT LEAST 4 of the following knobs beyond their defaults, unless the user explicitly asked for "minimal", "plain", or "the smallest valid template":',
    '- `EmailLayout.data.fontFamily` — choose from `MONTSERRAT`, `PLAYFAIR`, `OSWALD`, `MERRIWEATHER`, `ROBOTO`, `OPEN_SANS`, `MODERN_SANS`, `PACIFICO`. Do NOT default to `LATO` for every template. Match the font to the tone (see the Tone → style table below).',
    '- `Container.style.backgroundColor` — at least ONE section Container SHOULD have a non-null, non-empty hex colour (hero band, CTA section, footer). A null/transparent body plus one coloured section is a very common, high-impact pattern.',
    '- `Container.style.borderRadius` (number) OR `Container.style.shape` (`"rectangle"` | `"pill"` | `{ topLeft, topRight, bottomLeft, bottomRight }`). **At least 2 non-footer Containers** (hero + CTA card / feature grid / body panel) MUST have `borderRadius >= 8`. Do NOT apply radius only to the hero — the single-radius pattern is the #1 reason templates still read as plain. Use 12–16 for modern card sections, 20+ for highlight callouts. Full-bleed coloured bands (dark footers that span edge-to-edge) stay at `borderRadius: 0`. EmailBuilder renders border-radius correctly via nested `<td>` wrappers — do NOT drop radius because of vague "Outlook compatibility" concerns; that advice is out of date for this renderer.',
    '- `Container.style.borderColor` combined with any of `borderTop`/`borderBottom`/`borderLeft`/`borderRight` (px numbers) — 1px borders for card outlines, thicker top/bottom bars (3–6px) in the accent colour as decorative section separators.',
    '- `Button.style.shape` — `"pill"` (equivalent to `borderRadius: 20+`) for marketing / onboarding / CTA-heavy emails, `"rectangle"` for transactional / receipts / legal. Do NOT rely on the implicit default for every template.',
    '- `Button.style.fontFamily` / `Button.style.fontWeight` — override the global font on a bold CTA when it reinforces hierarchy.',
    '- `Divider.style.color` — align with the accent palette (e.g. `#2F4D71` on a navy template, `#4A7CB9` as a softer inner divider, `#E03E2D` on an ecommerce red template, `#2DC26B` on a green one). Do NOT always emit `#CCCCCC` / `#BBBBBB`.',
    '- `Divider.style.height` — 2–4px for decorative separators, 1px only for subtle lines.',
    '- `Divider.style.width` — <100 (e.g. 15, 50, 92) for short centered accent rules inside a Container.',
    '- `NotionText.style.color` — accent / muted / on-colored-bg text (e.g. muted `#B8B8B8` in a dark footer, accent `#2F4D71` on a section title).',
    '- `NotionText.style.fontWeight: "bold"` on titles and key metrics; do not rely only on `<h1>`/`<h2>` tags to convey emphasis.',
    '- `NotionText.style.lineHeight` — e.g. `"1.4"`–`"1.6"` for body copy, `"1.1"` for oversized titles.',
    '- `Image.style.backgroundColor` — framed image sections on coloured panels (common in hero areas).',
    '- Distinct `padding` vs `mobilePadding` — e.g. desktop `{top:60,right:80,bottom:60,left:80}` with mobile `{top:40,right:24,bottom:40,left:24}` so the email reflows cleanly on phones.',
    '',
    'Tone → style mapping. Detect the tone from the user prompt (industry, use case, adjectives) and bias the template instead of emitting the generic LATO default:',
    '- **SaaS / onboarding / product welcome** → `fontFamily: "MONTSERRAT"`; pill Button with accent bg; section Containers with `borderRadius: 12–16` and a subtle 1px `borderColor` for card feel; 2px accent-colour Divider; soft palette (e.g. canvas `#FFFFFF`, hero `#F5F7FF`, accent `#0254FB`).',
    '- **Editorial / magazine / newsletter** → `fontFamily: "PLAYFAIR"` at root (serif headlines) paired with `LATO` or `MERRIWEATHER` on body NotionText via per-block `style.fontFamily`; 3–4px coloured Dividers between sections (e.g. `#0C4271`, `#2F4D71`); rectangle Buttons, not fullWidth; generous 60–100px horizontal padding; cream or pale backdrop.',
    '- **Ecommerce / flash sale / product promotion** → `fontFamily: "OSWALD"` at root; dark or saturated `Container.style.backgroundColor` for the hero with white NotionText on top; pill Button with a high-contrast accent (`#FC4C4C`, `#E03E2D`, `#FFD41B` on red, `#FFFFFF` on black); discount / price NotionText at 40–60px + `fontWeight: "bold"`.',
    '- **Event / celebration / invitation** → `fontFamily: "OSWALD"` or `"PLAYFAIR"`; coloured hero Container with 60–120px top padding; oversized title (50–74px) white on coloured bg; pill Button; `SocialMedia` footer with per-item `theme: "negative"` (white outline icons) on dark bg.',
    '- **Transactional / receipt / OTP / legal** → `fontFamily: "LATO"` or `"MODERN_SANS"`; rectangle Button with `borderRadius: 4`; neutral palette with a single accent; small borderRadius (0–4) on containers; emphasis via `fontWeight` and `color` rather than decoration.',
    '- **Non-profit / cause / volunteer** → `fontFamily: "MERRIWEATHER"` or `"LATO"`; warm muted accent palette (olive, terracotta, navy); rectangle Button with accent bg; hero Image framed by a coloured `Container` panel.',
    '',
    'Visual archetype — BEFORE writing any block, pick exactly ONE row from the table below that best matches the user prompt. Copy those values verbatim into your plan; do NOT blend rows or revert to defaults. If the prompt is ambiguous, default to row A.',
    '',
    '| # | Name              | fontFamily    | backdropColor | heroContainer bg                                      | accentColor | buttonShape | dividerColor | heroRadius | hero image (picsum seed) |',
    '|---|-------------------|---------------|---------------|-------------------------------------------------------|-------------|-------------|--------------|------------|--------------------------|',
    '| A | SaaS / Onboarding | MONTSERRAT    | #F5F7FF       | linear-gradient(135deg,#0C4271 0%,#2F4D71 100%)       | #0254FB     | pill        | #0254FB 2px  | 16         | saas-welcome/1200/480    |',
    '| B | Editorial / Newsletter | PLAYFAIR | #F5F0E8      | null — text-only hero with serif headers              | #0C4271     | rectangle   | #0C4271 3px  | 0          | — (no hero image)        |',
    '| C | Ecommerce / Flash Sale | OSWALD   | #111111       | #E03E2D                                               | #B8770A     | pill        | #E03E2D 2px  | 0          | flash-sale/1200/400      |',
    '| D | Event / Celebration    | OSWALD   | #1A1A2E       | linear-gradient(180deg,#16213E 0%,#0F3460 100%)       | #FF4D6D     | pill        | #FF4D6D 2px  | 12         | event-stage/1200/480     |',
    '| E | Warm / Non-profit      | MERRIWEATHER | #FDF6EC    | linear-gradient(135deg,#5C4033 0%,#8B5E3C 100%)       | #B8704A     | rectangle   | #B8704A 2px  | 8          | warm-community/1200/400  |',
    '| F | Minimal / Transactional | LATO    | #F3F4F6       | null                                                  | #111827     | rectangle   | #E5E7EB 1px  | 8          | — (no hero image)        |',
    '| G | Bold / Agency          | MONTSERRAT | #0F0F0F      | linear-gradient(180deg,#7C3AED 0%,#4F46E5 100%)       | #9333EA     | pill        | #7C3AED 2px  | 20         | agency-bold/1200/480     |',
    '| H | Friendly / Consumer    | OPEN_SANS  | #FFF8F0      | linear-gradient(135deg,#FF6B35 0%,#FF8C42 100%)       | #E55A2B     | pill        | #E55A2B 2px  | 16         | consumer-lifestyle/1200/400 |',
    '| I | Travel / Hospitality   | PLAYFAIR  | #F8F6F0       | linear-gradient(135deg,#8B4513 0%,#CD853F 100%)       | #D2691E     | rectangle   | #D2691E 2px  | 12         | travel-destination/1200/480 |',
    '| J | Wellness / Mindful     | MERRIWEATHER | #F0F8F0    | linear-gradient(135deg,#2E8B57 0%,#90EE90 100%)       | #1A9B92     | pill        | #1A9B92 2px  | 16         | wellness-nature/1200/400 |',
    '| K | Real Estate / Property | PLAYFAIR  | #F5F5F0       | linear-gradient(135deg,#2F4F4F 0%,#708090 100%)       | #4682B4     | rectangle   | #4682B4 2px  | 8          | real-estate-property/1200/480 |',
    '| L | Fintech / Data Heavy  | MONTSERRAT | #F0F4F8       | linear-gradient(135deg,#1E3A8A 0%,#3B82F6 100%)       | #2563EB     | rectangle   | #2563EB 2px  | 12         | fintech-dashboard/1200/400 |',
    '| M | Education / Coaching   | MERRIWEATHER | #FFF8DC    | linear-gradient(135deg,#8B4513 0%,#DEB887 100%)       | #B8704A     | pill        | #B8704A 2px  | 12         | education-classroom/1200/400 |',
    '| N | Product Launch / SaaS  | MONTSERRAT | #F8FAFC      | linear-gradient(135deg,#0F172A 0%,#334155 100%)       | #0284C7     | pill        | #0284C7 2px  | 16         | product-launch-app/1200/480 |',
    '| O | Confirmation / Receipt | LATO      | #FAFAFA       | null                                                  | #059669     | rectangle   | #D1D5DB 1px  | 4          | — (no hero image)        |',
    '| P | Abandoned Cart / Urgent | MODERN_SANS | #FEF2F2    | linear-gradient(135deg,#DC2626 0%,#EF4444 100%)       | #DC2626     | pill        | #DC2626 2px  | 8          | abandoned-cart-product/600/400 |',
    '',
    'For rows A, C, D, E, G, H, I, J, K, L, M, N, P: the first top-level Container (hero section) MUST set BOTH `style.background` (the gradient string from the table) AND `style.backgroundColor` (the solid fallback — first colour stop). Emitting only `backgroundColor` without `style.background` is wrong for these rows. For rows B, F, O: skip the hero image entirely — use text-only hero sections.',
    '',
    'Self-audit — before emitting the FIRST NDJSON line, mentally review the template you are about to generate:',
    '- If the only style knobs you varied are `backdropColor`, `canvasColor`, a font size and `Button.props.buttonBackgroundColor`, you have FAILED the Style variety bar. REPLAN the template applying the budget and the Tone mapping above.',
    '- If every Container has `backgroundColor: null` / empty string, pick one section (hero, CTA, or footer) and give it a non-null colour that reinforces the palette.',
    '- If every Button, Divider and Container uses implicit defaults, you are generating the plain fallback. Introduce at least one pill Button, one accent-coloured Divider and one coloured Container before streaming.',
    '- COUNT the Containers with `borderRadius >= 8` (or equivalent `shape`). Excluding any full-bleed coloured band (edge-to-edge dark footer / promo strip), the count MUST be >= 2. If only the hero has radius, add radius to the CTA card and/or feature grid Container BEFORE streaming — single-radius templates fail this audit.',
    '- COUNT the total block ids. For a marketing / onboarding / newsletter / promo template, if the count is < 12, identify the thinnest sections and ADD content: trust microcopy in the hero (small, 11–13px), a feature grid after the hero (2- or 3-column ColumnsContainer), a secondary CTA card before the footer (rounded Container with title + supporting text + secondary Button), or a social-proof block. Under-dense templates read as prototypes, not finished emails.',
    '- **WCAG CONTRAST COMPLIANCE**: ALL text must meet WCAG 2.1 AA standards. Normal text (≤17px) requires 4.5:1 contrast ratio. Large text (≥18px or ≥14px bold) requires 3:1 contrast ratio. NEVER use: dark text on dark backgrounds, light text on light backgrounds, or low-contrast combinations like #666 on #999. Safe combinations: #000000 or #1A1A1A on light backgrounds (#FFFFFF, #F5F5F5), #FFFFFF or #F9F9F9 on dark backgrounds (#000000, #1A1A1A, #2D3748). When using colored backgrounds, ensure text color provides sufficient contrast.',
    '',
    "Before emitting any block, identify the template under `# TEMPLATES` whose tone matches the user prompt and use its structure as the skeleton for your response. Adapt copy, colours, and image URLs to the prompt; do NOT reinvent a layout when a template already covers the use case. The template's fontFamily, palette, padding, borderRadius, and section sequence are the authoritative defaults.",
    '',
    'After picking a template as your skeleton, scan the user prompt for content patterns and splice in the matching sections from the `# SECTIONS` section:',
    '- metrics / stats / "10K users" / quantitative numbers → splice in `stat-row-3col`',
    '- single customer quote / testimonial → splice in `quote-card`',
    '- two customer quotes side by side → splice in `testimonial-2col`',
    '- pricing tiers / plan comparison → splice in `pricing-card-2col`',
    '- "how it works" / numbered onboarding / steps → splice in `step-list-vertical`',
    '- newsletter / blog roundup / multiple articles → splice in `article-preview-row`',
    '- "trusted by" / customer logos / 3-PLUS-DIFFERENT-BRAND social proof → splice in `logo-bar-trusted-by`',
    '- promo / discount / sale percentage → splice in `discount-banner-strip`',
    '- urgent / limited-time / countdown teaser → splice in `announcement-banner-thin`',
    '- event details (date / location) → splice in `event-info-grid-2col`',
    '- dashboard digest / data summary / weekly metrics → splice in `data-summary-card`',
    '- secondary call-to-action card → splice in `cta-card-bordered`',
    '- alternative split hero (text on one side, image on other) → splice in `hero-split-2col`',
    '- 3 features with icons → splice in `feature-icon-row-3col`',
    '',
    'How to splice (CRITICAL — failing this produces a broken email):',
    '1. Find the section NDJSON in `# SECTIONS`.',
    '2. For each line in the section, COPY the line into your output stream as a normal `{"id":..., "block":...}` line.',
    '3. As you copy, perform these substitutions in-place:',
    '   a. Replace each ID `recipe-{slug}-{n}` (bundled section) or `component-{shortId}-{n}` (user section) with a fresh `block-{N}` from your monotonic counter (e.g. `recipe-stat-row-3col-1` → `block-15`, `recipe-stat-row-3col-2` → `block-16`). Update every `childrenIds` reference accordingly so parents still point at the right children after renumbering.',
    "   b. Replace `{{ACCENT}}` with the chosen template's accent hex (e.g. `#0254FB`), `{{TEXT}}` with the body text color, `{{MUTED_TEXT}}` with the muted-text color, `{{CANVAS}}` with the canvas color, `{{BORDER}}` with a subtle border color, `{{ACCENT_TEXT}}` with the readable inverse of accent (usually `#FFFFFF`).",
    '   c. Replace `REPLACE-WITH-SEMANTIC-SLUG` in image URLs with a meaningful slug derived from the prompt (e.g. `customer-team-collaboration`, `flash-sale-streetwear`, `editorial-feature-news`).',
    '4. Append the (renumbered) section-anchor block id to your `EmailLayout.data.childrenIds` so the section shows up in the document.',
    "5. Preserve the section's block structure EXACTLY — same block types, same nesting, same padding values, same borderRadius values, same columnsCount, same fixedWidths. Only IDs / palette tokens / image slugs change.",
    '',
    'FEW-SHOT — splicing `stat-row-3col` after the SaaS template hero:',
    '',
    'Section in `# SECTIONS`:',
    '`{"id":"recipe-stat-row-3col-1","block":{"type":"Container","data":{"style":{"padding":{"top":40,"bottom":40,"left":24,"right":24}},"props":{"childrenIds":["recipe-stat-row-3col-2"]}}}}`',
    '`{"id":"recipe-stat-row-3col-2","block":{"type":"ColumnsContainer","data":{"props":{"columnsCount":3,"fixedWidths":[null,null,null],"columns":[{"childrenIds":["recipe-stat-row-3col-3","recipe-stat-row-3col-4"]},{"childrenIds":["recipe-stat-row-3col-5","recipe-stat-row-3col-6"]},{"childrenIds":["recipe-stat-row-3col-7","recipe-stat-row-3col-8"]}]}}}}`',
    '`{"id":"recipe-stat-row-3col-3","block":{"type":"NotionText","data":{"style":{"fontSize":40,"fontWeight":"bold","color":"{{ACCENT}}","textAlign":"center"},"props":{"text":"10K+"}}}}`',
    '`{"id":"recipe-stat-row-3col-4","block":{"type":"NotionText","data":{"style":{"fontSize":13,"color":"{{MUTED_TEXT}}","textAlign":"center"},"props":{"text":"Active users"}}}}`',
    '... (rest of the section)',
    '',
    'After splicing into a SaaS template (accent `#0254FB`, muted text `#6B7280`), counter at `block-15`:',
    '`{"id":"block-15","block":{"type":"Container","data":{"style":{"padding":{"top":40,"bottom":40,"left":24,"right":24}},"props":{"childrenIds":["block-16"]}}}}`',
    '`{"id":"block-16","block":{"type":"ColumnsContainer","data":{"props":{"columnsCount":3,"fixedWidths":[null,null,null],"columns":[{"childrenIds":["block-17","block-18"]},{"childrenIds":["block-19","block-20"]},{"childrenIds":["block-21","block-22"]}]}}}}`',
    '`{"id":"block-17","block":{"type":"NotionText","data":{"style":{"fontSize":40,"fontWeight":"bold","color":"#0254FB","textAlign":"center"},"props":{"text":"10K+"}}}}`',
    '`{"id":"block-18","block":{"type":"NotionText","data":{"style":{"fontSize":13,"color":"#6B7280","textAlign":"center"},"props":{"text":"Active users"}}}}`',
    '... (continue with adapted content for the actual prompt — replace "10K+" / "Active users" with the prompt\'s real metrics)',
    '',
    "And add `block-15` to the EmailLayout's `childrenIds` so the section is rendered.",
    '',
    'Sections are NOT optional flavor — when the prompt mentions a content pattern from the list above, you MUST splice in the matching section rather than improvising it. Improvising consistently produces under-styled or structurally inconsistent sections; splicing produces polished, schema-valid sections every time.',
    '',
    "Template vs. section priority — when a section content pattern is requested, the section REPLACES the template's analogous slot, it does NOT layer on top. Examples:",
    '- User asks for "three customer testimonials" on a SaaS prompt. The SaaS template has a feature-grid section. You REMOVE the feature-grid and INSERT testimonial-2col (or 3 quote-cards) in that slot — do not keep both.',
    '- User asks for "pricing comparison" on any prompt. You REMOVE any template section that is roughly equivalent body content (the secondary panel between hero and footer) and INSERT pricing-card-2col there.',
    '- User asks for "data summary" or "dashboard digest" on a flash-sale prompt. You REMOVE the template\'s ordinary feature/promo grid and INSERT data-summary-card.',
    '- The template hero, footer, and overall palette/fontFamily ALWAYS stay. Only middle-body sections are swappable.',
    "Failing to replace means the email becomes a generic template clone with the user's requested content shoved in awkwardly. The user explicitly asked for the section content — make it the centerpiece of the body, not an extra appendage.",
    '',
    'Use the SKILL and PATTERNS sections below as the authoritative reference for block types, required props, and composition patterns.',
  ].join('\n');
}

/**
 * Builds the system prompt sent to the LLM. It embeds the SKILL + PATTERNS +
 * TEMPLATES + SECTIONS (+ optional LAYOUTS / PRIMITIVES / THEMES) reference
 * documents and optionally the user's current document.
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
  const { currentDocument, skillsDir, userPrompt, variationSeed, imagePool } = options;
  const {
    skill,
    patterns,
    templates,
    sections: librarySections,
    layouts,
    primitives,
    themes,
  } = loadSkillContext({ skillsDir });

  const hasPool = imagePool !== undefined && imagePool.length > 0;

  const sections: string[] = [buildBaseInstructions(hasPool), DESIGN_CRAFT_GUIDANCE];

  // Add few-shot examples if user prompt is provided. The seed is
  // forwarded so the "ensure at least one backgroundImage example" branch
  // rotates between hero shapes across generations of the same prompt.
  if (userPrompt) {
    const fewShotSection = generateFewShotPrompt(userPrompt, 2, hasPool, variationSeed);
    if (fewShotSection.trim()) {
      sections.push(fewShotSection);
    }
  }

  // ---------------------------------------------------------------------
  // Corpus retrieval. Previously every template + section in the corpus was
  // embedded verbatim (shuffled by seed but never capped). With hundreds of
  // user-saved templates that overflows any context window. We now select a
  // small, relevant subset:
  //   - templates: a few structural REFERENCES (not for verbatim copy)
  //   - sections: the real composition unit, picked per relevant role
  //   - themes: a couple of palette references
  // When no userPrompt is present (refinement mode), fall back to the slug
  // text so retrieval still has something to score against and the LLM is
  // never left with zero references.
  // ---------------------------------------------------------------------
  const retrievalQuery = userPrompt && userPrompt.trim().length > 0 ? userPrompt : 'email template';

  const selectedTemplates = selectTemplates(retrievalQuery, templates, {
    topN: envCap('EB_RETRIEVAL_TEMPLATES', RETRIEVAL_DEFAULTS.templates),
    seed: variationSeed,
  });
  const selectedSections = selectSections(retrievalQuery, librarySections, {
    perRole: envCap('EB_RETRIEVAL_SECTIONS_PER_ROLE', RETRIEVAL_DEFAULTS.sectionsPerRole),
    maxRoles: envCap('EB_RETRIEVAL_MAX_ROLES', RETRIEVAL_DEFAULTS.maxRoles),
    seed: variationSeed,
  });
  const selectedThemes = selectThemes(retrievalQuery, themes, {
    topN: envCap('EB_RETRIEVAL_THEMES', RETRIEVAL_DEFAULTS.themes),
    seed: variationSeed,
  });

  sections.push(
    '# SKILL\n\n' + skill,
    '# PATTERNS\n\n' + patterns,
    buildTemplatesSection(selectedTemplates),
    buildSectionsSection(selectedSections),
  );

  // Layouts / Primitives are user-saved-only and typically rare; they stay
  // as a full (small) dump gated by presence. Themes now go through
  // retrieval like templates/sections. Emit each only when non-empty so an
  // empty `# LAYOUTS` block doesn't burn tokens for newcomers.
  if (layouts.length > 0) sections.push(buildLayoutsSection(layouts));
  if (primitives.length > 0) sections.push(buildPrimitivesSection(primitives));
  if (selectedThemes.length > 0) sections.push(buildThemesSection(selectedThemes));

  // Inject the variation directive AFTER the SKILL / PATTERNS / TEMPLATES /
  // SECTIONS / LAYOUTS / PRIMITIVES / THEMES blocks. The previous
  // placement (right after the few-shot section) buried the directive
  // under ~70% of the prompt body, so the LLM's recency bias favoured the
  // template structures over the slot assignments. With the directive
  // immediately preceding IMAGE_POOL, the model sees its layout
  // instructions just before the image rules — the last layout-relevant
  // tokens it processes before generating.
  //
  // The directive draws ONLY from the selected sections — pointing the LLM
  // at a section we didn't embed would be unusable.
  if (variationSeed !== undefined) {
    const directive = buildVariationDirective(variationSeed, selectedSections);
    if (directive) sections.push(directive);
  }

  // Inject the IMAGE_POOL section at the very end (just before the
  // optional CURRENT DOCUMENT context) so the URL-substitution rules win
  // any recency contest with the picsum guidance baked into
  // BASE_INSTRUCTIONS.
  if (hasPool) {
    sections.push(buildImagePoolSection(imagePool));
  }

  if (currentDocument !== undefined && currentDocument !== null) {
    sections.push(
      [
        '# CURRENT DOCUMENT',
        '',
        'The user is refining the document below. Re-emit the full updated template in NDJSON, preserving existing block IDs wherever possible and keeping every `childrenIds` reference valid.',
        '',
        '```json',
        JSON.stringify(currentDocument, null, 2),
        '```',
      ].join('\n'),
    );
  }

  const prompt = sections.join('\n\n');

  if (process.env.DEBUG_PROMPT === '1') {
    console.log('[system-prompt] PROMPT_LEN:', prompt.length);
  }

  return prompt;
}

/**
 * Given a numeric seed and the loaded section list, picks one section per role
 * slot (hero / features / cta) and emits a VARIATION DIRECTIVE block that
 * instructs the LLM to use those specific layouts instead of its defaults.
 *
 * The seed deterministically maps to a combination so the same seed always
 * produces the same directive (useful for reproducible debugging), while
 * different seeds distribute evenly across all available variants thanks to
 * the multiplicative hashing — adjacent seeds (1, 2, 3, …) decorrelate
 * across the three pools so the resulting (hero, features, cta) tuples
 * look unrelated.
 */
function buildVariationDirective(seed: number, sections: SectionEntry[]): string {
  const byRole = (role: SectionEntry['role']) => sections.filter((r) => r.role === role);

  const heroPool = byRole('hero');
  const featurePool = byRole('features');
  const ctaPool = byRole('cta');

  if (!heroPool.length && !featurePool.length && !ctaPool.length) return '';

  // Multiplicative hashing with co-prime multipliers per role. The previous
  // formula `Math.floor((seed + offset) / 1) % pool.length` was equivalent
  // to `(seed + offset) % pool.length`, which left adjacent seeds
  // correlated across pools (seeds 0..3 picked the same feature section
  // whenever the feature pool was longer than 4). The primes 31 / 37 / 41
  // are co-prime to typical pool sizes (3–7 entries), so each pool's
  // index sequence cycles independently of the others.
  const pickAt = (pool: SectionEntry[], index: number) =>
    pool.length ? pool[((index % pool.length) + pool.length) % pool.length] : null;

  const hero = pickAt(heroPool, seed * 31);
  const feature = pickAt(featurePool, seed * 37 + 1);
  const cta = pickAt(ctaPool, seed * 41 + 2);

  const lines = [
    `# VARIATION DIRECTIVE (seed=${seed})`,
    '',
    'REQUIRED — these slot assignments OVERRIDE the layout choices implied by the templates above.',
    'You MUST REPLACE the corresponding section of the chosen template with the section listed below.',
    'Do NOT layer / append the section on top of the existing one — REMOVE the template section first, then INSERT the chosen section in its place.',
    '',
    'Example of the REPLACE-NOT-APPEND rule:',
    '  - Template has a hero of `[logo, big headline, single button]`.',
    '  - Variation directive picks `hero-split-2col`.',
    '  - WRONG: emit the template hero AND ALSO a `hero-split-2col` block below it (two heroes).',
    '  - RIGHT: emit ONLY the `hero-split-2col` blocks (renumbered to your monotonic counter), and put them where the template hero used to be.',
  ];

  if (hero) {
    lines.push(
      '',
      `- **hero_slot** → use section \`${hero.slug}\` for the hero section.`,
      `  REPLACE the template's hero entirely. Apply the template's palette ({{ACCENT}}, {{TEXT}}, etc.) and font — only the layout changes.`,
    );
  }
  if (feature) {
    lines.push(
      '',
      `- **features_slot** → use section \`${feature.slug}\` for the features / benefits section.`,
      `  REPLACE any default feature grid the template shipped — do not keep both.`,
    );
  }
  if (cta) {
    lines.push(
      '',
      `- **cta_slot** → use section \`${cta.slug}\` for the secondary CTA section.`,
      `  REPLACE the template's secondary CTA card.`,
    );
  }

  lines.push(
    '',
    "These slot assignments are MANDATORY for this generation. The template's palette, typography, borderRadius, and footer remain in effect; only the listed sections are swapped.",
  );

  return lines.join('\n');
}

/**
 * NOTE: the seed-driven shuffle that used to live here moved to
 * `retrieval.ts` (`shuffleBySeed`). It now rotates *within* the
 * retrieval-selected subset rather than over the entire corpus, so variety
 * across seeds no longer costs relevance.
 */

function buildTemplatesSection(templates: TemplateEntry[]): string {
  const lines: string[] = [
    '# TEMPLATES',
    '',
    'A few full-template REFERENCES selected as the closest matches to the user prompt. Use them to ground your structure, palette, fontFamily, padding scale, and section sequencing in proven, valid layouts — so you never start from a blank page and never emit a broken document.',
    '',
    'CRITICAL — these are references, NOT a template to clone:',
    '- Do NOT copy any single template verbatim. The generated email MUST be visibly different from each reference below.',
    '- COMBINE ideas across the references: take the hero shape from one, the section ordering from another, the palette/typography from a third, and adapt all copy to the prompt.',
    '- Treat them as quality and validity exemplars (correct childrenIds wiring, padding with all four sides, valid block types) — match that rigor, not the exact content.',
    '- Prefer composing the body from the `# SECTIONS` entries below; the templates are mainly there to show how complete, valid documents are assembled.',
    '',
    'Each entry is tagged `bundled` (ships with the package) or `user` (saved via the Components Library). Both are equally valid references.',
  ];

  for (const t of templates) {
    const tag = t.source === 'user' ? ' [user]' : '';
    lines.push(
      '',
      `## Template: ${t.slug}${tag} — ${t.description}`,
      '',
      '```ndjson',
      t.ndjson.trimEnd(),
      '```',
    );
  }

  return lines.join('\n');
}

function buildSectionsSection(sections: SectionEntry[]): string {
  const lines: string[] = [
    '# SECTIONS',
    '',
    "Reusable section snippets to drop into a template's body. After picking the template that matches the user prompt's tone, scan the prompt for content patterns. For each pattern, splice the corresponding section into the body, between the hero and the footer.",
    '',
    'Each entry below is tagged `bundled` (ships with the package) or `user` (saved by the user via the Components Library drawer). Treat both as equally authoritative — if a `user` section matches the prompt better, prefer it.',
    '',
    'Substitution rules (CRITICAL — you MUST apply these or the email will render broken):',
    "- {{ACCENT}}, {{TEXT}}, {{MUTED_TEXT}}, {{CANVAS}}, {{BORDER}}, {{ACCENT_TEXT}} → replace with the chosen template's palette colors. Match the template's existing accent / text / canvas hex.",
    '- REPLACE-WITH-SEMANTIC-SLUG in image URLs → replace with a meaningful seed slug derived from the prompt (e.g. saas-team-collab, ecommerce-product-hero, editorial-feature-news).',
    '- All section IDs (recipe-{slug}-{n} for bundled sections, component-{shortId}-{n} for user sections) → renumber to your monotonic block-{n} counter and update every childrenIds reference accordingly.',
    '',
    "Do NOT modify a section's block structure (don't add/remove blocks, don't change types, don't change padding/borderRadius). Only the substitution rules above are allowed.",
  ];

  for (const s of sections) {
    const tag = s.source === 'user' ? ' [user]' : '';
    lines.push(
      '',
      `## Section: ${s.slug}${tag} — when to use: ${s.whenToUse}`,
      '',
      '```ndjson',
      s.ndjson.trimEnd(),
      '```',
    );
  }

  return lines.join('\n');
}

/**
 * Optional structural-only subtree palette. Layouts are pure
 * Container / ColumnsContainer compositions — no leaf content blocks.
 * They give the LLM a vocabulary of column ratios and nested grids it
 * can populate with content drawn from the prompt or from a chosen
 * `# SECTIONS` entry.
 */
function buildLayoutsSection(layouts: LayoutEntry[]): string {
  const lines: string[] = [
    '# LAYOUTS',
    '',
    'Structural scaffolds saved by the user. Each layout is a Container or ColumnsContainer with only structural descendants (no Heading, NotionText, Button, …). Use a layout when the prompt asks for a specific column ratio or nesting that none of the bundled sections cover — fill the empty `childrenIds` slots with content blocks (NotionText, Button, Image, …) suited to the prompt.',
    '',
    'Layouts are auxiliary — prefer a `# SECTIONS` entry when one fits. Renumber ids the same way (`component-{shortId}-{n}` → `block-{n}`).',
  ];

  for (const l of layouts) {
    lines.push(
      '',
      `## Layout: ${l.slug} (${l.shape}) — ${l.description}`,
      '',
      '```ndjson',
      l.ndjson.trimEnd(),
      '```',
    );
  }

  return lines.join('\n');
}

/**
 * Optional single-block reference palette. Primitives are individual
 * leaf blocks the user has saved (a NotionText with custom HTML, a
 * pre-styled Button, an icon-sized Image, …). They serve as concrete
 * style references the LLM can mimic when emitting similar blocks.
 */
function buildPrimitivesSection(primitives: PrimitiveEntry[]): string {
  const lines: string[] = [
    '# PRIMITIVES',
    '',
    'Single-block style references saved by the user. Use a primitive as a styling reference when emitting a similar block — copy its `style` and relevant `props` shape (font, color, padding) and adapt the content to the prompt. Do NOT splice a primitive verbatim; primitives are inspiration, not finished sections.',
  ];

  for (const p of primitives) {
    lines.push(
      '',
      `## Primitive: ${p.slug} (${p.type}) — ${p.description}`,
      '',
      '```ndjson',
      p.ndjson.trimEnd(),
      '```',
    );
  }

  return lines.join('\n');
}

/**
 * Optional theme palette reference. Themes are flat JSON documents
 * (NOT NDJSON) that map block types to default style overrides plus
 * `globals` (canvas / backdrop / text color, fontFamily, link styling).
 * The LLM can use a theme as a palette anchor — copy the `globals` into
 * the EmailLayout and the per-block defaults into matching blocks when
 * the user prompt matches the theme's tone.
 */
function buildThemesSection(themes: ThemeEntry[]): string {
  const lines: string[] = [
    '# THEMES',
    '',
    'Saved palette + per-block style references. Each theme carries `globals` (apply to the EmailLayout root) and optionally `blocks.{Type}.style` defaults (apply when emitting a block of that type). Use a theme when its tone matches the user prompt better than any bundled template palette — otherwise stick with the chosen template defaults.',
  ];

  for (const th of themes) {
    lines.push(
      '',
      `## Theme: ${th.slug} — ${th.description}`,
      '',
      '```json',
      th.json.trimEnd(),
      '```',
    );
  }

  return lines.join('\n');
}

/**
 * Build the IMAGE_POOL section embedded at the top of the system prompt
 * when {@link BuildSystemPromptOptions.imagePool} carries pre-resolved
 * Unsplash photos. The section overrides the legacy picsum.photos rules
 * baked into BASE_INSTRUCTIONS — when a pool is present, the LLM MUST
 * pick from it; when no pool is provided this section is omitted and the
 * picsum guidance stands.
 */
function buildImagePoolSection(pool: PoolItem[]): string {
  return [
    '# IMAGE_POOL',
    '',
    'A curated set of real Unsplash photos has been pre-resolved for this generation. Each entry has a SHORT TOKEN `@unsplash:N` that you MUST use as the URL value. The backend expands the token into the real Unsplash URL and injects the `_unsplash` metadata server-side.',
    '',
    formatPoolForPrompt(pool),
    '',
    '## IMAGE_POOL_RULES (binding for this generation):',
    '- For every `Image` block, set `props.url` to a token like `"@unsplash:0"` (no quotes inside the token, no extra characters). DO NOT paste the long Unsplash URL — use the token.',
    '- For `Container.style.backgroundImage`, also use a token (e.g. `"@unsplash:1"`). Pick a wide / hero-suitable entry by matching the section purpose to the entry\'s query.',
    '- Do NOT manually set `props._unsplash` — the backend injects it. Anything you write there will be overwritten.',
    '- DO NOT use `picsum.photos`, `placehold.co`, or any other host while a pool is available — those URLs are rejected by the post-processor and replaced with pool items anyway, but you waste tokens generating them. The ONLY exception is `placehold.co/{w}x{h}?text=Brand` for a brand LOGO image where the brand-name text is informative.',
    '- Tokens past the pool length wrap modulo, but prefer using tokens 0–' +
      (pool.length - 1) +
      '. The earlier the index, the more relevant the photo is to the prompt.',
    '- Tokens are short (~12 chars) precisely so you cannot mistype them — copy verbatim, no spaces, no leading `#`, no markdown.',
  ].join('\n');
}
