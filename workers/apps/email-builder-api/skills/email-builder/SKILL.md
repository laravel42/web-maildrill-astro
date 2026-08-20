---
name: email-builder-js
description: Use when generating email template JSON documents for EmailBuilder.js. Covers creating complete email layouts with blocks (Button, Image, NotionText, Container, ColumnsContainer, Divider, Spacer, SocialMedia), composing parent-child relationships via childrenIds, and producing valid TEditorConfiguration JSON that can be loaded into the builder or rendered to HTML.
license: MIT
metadata:
  author: Laravel42
  version: '3.3.1'
  homepage: https://emailbuilder.online
  source: https://github.com/nicosolo/email-builder-js
---

# EmailBuilder.js — Template Generation Skill

Generate valid email template JSON documents that can be loaded into EmailBuilder.js, rendered to HTML, and sent via any email provider.

**Agent surface** (see `src/agent/README.md`): every generation call also receives
Impeccable-inspired design-craft guidance; after generate, the editor can run
`POST /api/audit` (deterministic) and `POST /api/critique` (audit + LLM design
review) to score technical/HTML-client readiness and design quality. The wizard
composer and refine brief routes live under `/api/visual-brief/*`.

## Document Structure

A template is a flat `Record<string, TEditorBlock>` — a JSON object where keys are block IDs and values are block definitions. There is NO nesting in the data structure; parent-child relationships are expressed via `childrenIds` arrays.

Every document MUST have a `"root"` key with type `"EmailLayout"`:

```json
{
  "root": {
    "type": "EmailLayout",
    "data": {
      "backdropColor": "#F5F5F5",
      "canvasColor": "#FFFFFF",
      "textColor": "#262626",
      "fontFamily": "LATO",
      "childrenIds": ["block-1", "block-2"],
      "linkGlobal": {
        "linkColor": "#0000ee",
        "underline": true
      }
    }
  },
  "block-1": { "type": "...", "data": { ... } },
  "block-2": { "type": "...", "data": { ... } }
}
```

### Rules

1. `root.childrenIds` MUST contain ONLY `Container` or `ColumnsContainer` blocks. NEVER place a leaf block (`NotionText`, `Button`, `Image`, `Divider`, `Spacer`, `SocialMedia`) directly as a root child — leaves live inside Containers so the section has its own `padding` / `backgroundColor` / `mobilePadding` layer. A leaf at root renders without that wrapper and breaks on narrow clients.
2. Block IDs must be unique strings. Convention: `"block-"` + timestamp or random string.
3. Every block referenced in a `childrenIds` array MUST exist as a key in the document.
4. Only Container, ColumnsContainer, and EmailLayout can have children.
5. Leaf blocks (Button, Image, NotionText, Divider, Spacer, SocialMedia) cannot have children.
6. There are exactly 8 insertable block types: NotionText, SocialMedia, Button, Image, Divider, Spacer, ColumnsContainer, Container. Do NOT generate Heading, Html, CustomEditor, Avatar, Wysiwyg, or Text blocks — these are legacy/removed types.
7. **`padding` objects MUST always include ALL four sides: `top`, `bottom`, `right`, `left`.** Omitting any side (even when the value is `0`) causes a Zod validation error. Always write `{"top":0,"bottom":0,"right":0,"left":0}` — never `{"bottom":4,"right":8,"left":8}`.

### Hierarchy Pattern

```
root (EmailLayout)
  └── childrenIds → Container blocks
        └── props.childrenIds → leaf blocks or ColumnsContainer
              └── props.columns[].childrenIds → leaf blocks
```

## Available Blocks

### EmailLayout (root only)

The root wrapper. Controls global email styles.

```json
{
  "type": "EmailLayout",
  "data": {
    "backdropColor": "#F5F5F5",
    "canvasColor": "#FFFFFF",
    "textColor": "#262626",
    "fontFamily": "LATO",
    "childrenIds": ["block-1"],
    "linkGlobal": { "linkColor": "#0000ee", "underline": true }
  }
}
```

| Prop          | Type       | Description                                                                                                                                                              |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| backdropColor | hex string | Background behind the email canvas                                                                                                                                       |
| canvasColor   | hex string | Email body background                                                                                                                                                    |
| textColor     | hex string | Default text color                                                                                                                                                       |
| fontFamily    | enum       | `LATO`, `MODERN_SANS`, `MONTSERRAT`, `ROBOTO`, `OPEN_SANS`, `MERRIWEATHER`, `OSWALD`, `PLAYFAIR`, `PACIFICO`. Do NOT default to `LATO` — match to tone (guidance below). |
| childrenIds   | string[]   | Top-level block IDs                                                                                                                                                      |
| borderColor   | hex string | Optional border around canvas                                                                                                                                            |
| borderRadius  | number     | Optional border radius                                                                                                                                                   |
| linkGlobal    | object     | `{ linkColor: hex, underline: boolean }`                                                                                                                                 |

**Font family guidance — match to tone, do not default to `LATO` for every template.**

| Tone / Use case                     | Recommended `fontFamily`                         |
| ----------------------------------- | ------------------------------------------------ |
| SaaS / onboarding / product welcome | `MONTSERRAT`                                     |
| Editorial / magazine / newsletter   | `PLAYFAIR` (pair with `LATO` on body NotionText) |
| Ecommerce / flash sale / bold       | `OSWALD`                                         |
| Event / celebration / invitation    | `OSWALD` or `PLAYFAIR`                           |
| Transactional / receipt / legal     | `LATO` or `MODERN_SANS`                          |
| Non-profit / cause / warm           | `MERRIWEATHER` or `LATO`                         |

### Container

Groups child blocks vertically. The primary structural block.

```json
{
  "type": "Container",
  "data": {
    "style": {
      "backgroundColor": "#FFFFFF",
      "padding": { "top": 0, "bottom": 0, "right": 0, "left": 0 },
      "mobilePadding": { "top": 0, "bottom": 0, "right": 0, "left": 0 }
    },
    "props": {
      "childrenIds": ["block-a", "block-b"]
    }
  }
}
```

| Style Prop                  | Type                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| backgroundColor             | hex string                                                                    |
| borderColor                 | hex string                                                                    |
| borderRadius                | number (px)                                                                   |
| shape                       | `"rectangle"` \| `"pill"` \| `{ topLeft, topRight, bottomLeft, bottomRight }` |
| borderTop/Bottom/Left/Right | number (px) — per-side widths for card outlines or decorative accent bars     |
| padding                     | `{ top, bottom, right, left }`                                                |
| mobilePadding               | `{ top, bottom, right, left }`                                                |

**Card-like Container** — rounded corners with a subtle 1px outline for modern "card" sections:

```json
{
  "type": "Container",
  "data": {
    "style": {
      "backgroundColor": "#F5F7FF",
      "borderRadius": 16,
      "borderColor": "#CBD5E1",
      "borderTop": 1,
      "borderBottom": 1,
      "borderLeft": 1,
      "borderRight": 1,
      "padding": { "top": 32, "bottom": 32, "right": 32, "left": 32 }
    },
    "props": { "childrenIds": ["block-card-inside"] }
  }
}
```

**Coloured section band** — dark footer Container with a thick accent top border as a visual separator:

```json
{
  "type": "Container",
  "data": {
    "style": {
      "backgroundColor": "#0C4271",
      "borderColor": "#4A7CB9",
      "borderTop": 4,
      "padding": { "top": 32, "bottom": 32, "right": 24, "left": 24 }
    },
    "props": { "childrenIds": ["block-footer-social", "block-footer-legal"] }
  }
}
```

**`background` CSS shorthand (gradients and image URLs).** Besides `backgroundColor` (solid hex), Container / Button / Divider also accept `style.background`, a string that takes the full CSS `background` shorthand. Use it for gradient heroes and photographic backgrounds.

**Gradient hero Container:**

```json
{
  "type": "Container",
  "data": {
    "style": {
      "background": "linear-gradient(135deg, #0C4271 0%, #2F4D71 100%)",
      "borderRadius": 16,
      "padding": { "top": 56, "bottom": 56, "right": 32, "left": 32 },
      "mobilePadding": { "top": 40, "bottom": 40, "right": 20, "left": 20 }
    },
    "props": { "childrenIds": ["block-hero-title"] }
  }
}
```

**Background-image hero Container** — always pair `background: "url(...)"` with a `backgroundColor` fallback so image-blocking email clients still render readable text on a solid panel:

```json
{
  "type": "Container",
  "data": {
    "style": {
      "background": "url(https://picsum.photos/seed/hero-banner/1200/480) center/cover no-repeat",
      "backgroundColor": "#0C4271",
      "padding": { "top": 96, "bottom": 96, "right": 24, "left": 24 },
      "mobilePadding": { "top": 64, "bottom": 64, "right": 16, "left": 16 }
    },
    "props": { "childrenIds": ["block-hero-title"] }
  }
}
```

### ColumnsContainer

Multi-column layout (2 or 3 columns). Each column has its own `childrenIds`.

```json
{
  "type": "ColumnsContainer",
  "data": {
    "style": {
      "backgroundColor": null,
      "padding": { "top": 16, "bottom": 16, "right": 16, "left": 16 },
      "mobilePadding": { "top": 16, "bottom": 16, "right": 16, "left": 16 }
    },
    "props": {
      "columnsCount": 2,
      "layout": "layout-50-50",
      "fixedWidths": [50, 50, null],
      "contentAlignment": "middle",
      "columns": [
        { "childrenIds": ["block-col1-a"] },
        { "childrenIds": ["block-col2-a"] },
        { "childrenIds": [] }
      ]
    }
  }
}
```

| Props            | Type                                 | Description                                                               |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| columnsCount     | 2 or 3                               | Number of columns                                                         |
| layout           | string                               | `"layout-50-50"`, `"layout-33-33-33"`, `"layout-66-33"`, `"layout-33-66"` |
| fixedWidths      | [number, number, number\|null]       | Column width percentages                                                  |
| contentAlignment | "top" \| "middle" \| "bottom"        | Vertical alignment                                                        |
| columns          | array of `{ childrenIds: string[] }` | Always 3 entries (unused columns have empty arrays)                       |

**Shape is STRICT.** The schema enforces:

- `columnsCount` must be exactly `2` or `3`. Any other value fails validation.
- `fixedWidths` is ALWAYS a 3-tuple. For 2-column layouts, pad the third entry with `null`.
- `columns` is ALWAYS an array of 3 entries. For 2-column layouts, the third entry is `{ "childrenIds": [] }`.

**Full 2-column example (label / value row — common in receipts):**

```json
{
  "type": "ColumnsContainer",
  "data": {
    "style": {
      "padding": { "top": 4, "bottom": 4, "right": 24, "left": 24 }
    },
    "props": {
      "columnsCount": 2,
      "layout": "layout-66-33",
      "fixedWidths": [70, 30, null],
      "contentAlignment": "middle",
      "columns": [
        { "childrenIds": ["block-subtotal-label"] },
        { "childrenIds": ["block-subtotal-value"] },
        { "childrenIds": [] }
      ]
    }
  }
}
```

**Common mistakes — DO NOT emit these:**

| ❌ Wrong                                        | ✅ Instead                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `columnsCount: 4` for a receipt table           | Stack 2-col rows (`[70,30,null]`) per line: subtotal, tax, total |
| `columnsCount: 1` for a boxed quote             | Use a plain Container with a single NotionText inside            |
| `fixedWidths: [50, 50]` (length 2)              | `fixedWidths: [50, 50, null]` (length 3, pad with null)          |
| `columns: [{...}, {...}]` (length 2)            | `columns: [{...}, {...}, { "childrenIds": [] }]` (length 3)      |
| 4-column product row (img / name / qty / price) | 2-col `[30,70,null]` (image on left, stacked details on right)   |

When in doubt, **prefer a stacked Container over a ColumnsContainer**. Columns are only for genuine side-by-side layouts (label/value, image/text, or three feature highlights).

### Button

A call-to-action button. Has two top-level keys:

- `style` — visual attributes (font, shape, padding, borders, text alignment).
- `props` — behavioural attributes (`text`, `url`, colours, `fullWidth`, `size`).

```json
{
  "type": "Button",
  "data": {
    "style": {
      "fontSize": 16,
      "fontWeight": "bold",
      "textAlign": "center",
      "shape": "pill",
      "padding": { "top": 8, "bottom": 32, "right": 24, "left": 24 },
      "mobilePadding": { "top": 8, "bottom": 24, "right": 16, "left": 16 }
    },
    "props": {
      "text": "Open your dashboard",
      "url": "https://example.com/dashboard",
      "buttonBackgroundColor": "#0254FB",
      "buttonTextColor": "#FFFFFF",
      "fullWidth": true,
      "size": "medium"
    }
  }
}
```

| Style Prop                  | Type                                                                          | Description                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| fontSize                    | number (px)                                                                   | Label size                                                                         |
| fontSizeMobile              | number (px)                                                                   | Mobile-specific label size                                                         |
| fontFamily                  | enum                                                                          | Override the EmailLayout font on this button                                       |
| fontWeight                  | `"bold"` \| `"normal"`                                                        | Label weight                                                                       |
| textAlign                   | `"left"` \| `"center"` \| `"right"`                                           | Align the button block within its parent Container                                 |
| shape                       | `"rectangle"` \| `"pill"` \| `{ topLeft, topRight, bottomLeft, bottomRight }` | Corner shape. `"pill"` = fully rounded ends. Equivalent to a large `borderRadius`. |
| backgroundColor             | hex string                                                                    | Wrapper bg behind the button (separate from the button itself)                     |
| borderColor                 | hex string                                                                    | Outline for ghost / outlined buttons                                               |
| borderTop/Bottom/Left/Right | number (px)                                                                   | Per-side border widths                                                             |
| padding                     | `{ top, bottom, right, left }`                                                | Outer padding around the button                                                    |
| mobilePadding               | `{ top, bottom, right, left }`                                                | Mobile-specific outer padding                                                      |

| Prop                  | Type                                                                     | Default     |
| --------------------- | ------------------------------------------------------------------------ | ----------- |
| text                  | string                                                                   | `""`        |
| url                   | string                                                                   | `""`        |
| buttonBackgroundColor | hex                                                                      | `"#999999"` |
| buttonTextColor       | hex                                                                      | `"#FFFFFF"` |
| fullWidth             | boolean                                                                  | `false`     |
| size                  | `"x-small"` \| `"small"` \| `"medium"` \| `{ top, bottom, left, right }` | `"medium"`  |

> ⚠️ **`size: "large"` does NOT exist and will fail validation.** The only string values are `"x-small"`, `"small"`, and `"medium"`. For a visually larger button, use `size: "medium"` and increase `style.fontSize` instead.

**Pill CTA example** (marketing / onboarding):

```json
{
  "type": "Button",
  "data": {
    "style": {
      "fontSize": 16,
      "fontWeight": "bold",
      "shape": "pill",
      "padding": { "top": 8, "bottom": 32, "right": 24, "left": 24 }
    },
    "props": {
      "text": "Start free trial",
      "url": "https://example.com/signup",
      "buttonBackgroundColor": "#0254FB",
      "buttonTextColor": "#FFFFFF",
      "fullWidth": true,
      "size": "medium"
    }
  }
}
```

**Outlined / ghost Button example** (dark-hero secondary CTA):

```json
{
  "type": "Button",
  "data": {
    "style": {
      "fontSize": 15,
      "fontWeight": "bold",
      "textAlign": "center",
      "borderColor": "#DDFF95",
      "borderTop": 1,
      "borderBottom": 1,
      "borderLeft": 1,
      "borderRight": 1,
      "padding": { "top": 12, "bottom": 40, "right": 24, "left": 24 }
    },
    "props": {
      "text": "Learn more",
      "url": "https://example.com/about",
      "buttonBackgroundColor": "#222222",
      "buttonTextColor": "#FFFFFF",
      "fullWidth": false,
      "size": "medium"
    }
  }
}
```

### Image

```json
{
  "type": "Image",
  "data": {
    "style": {
      "padding": { "top": 16, "bottom": 16, "right": 0, "left": 0 },
      "mobilePadding": { "top": 16, "bottom": 16, "right": 0, "left": 0 },
      "textAlign": "center",
      "backgroundColor": "#F5F7FF"
    },
    "props": {
      "url": "https://example.com/image.png",
      "alt": "Description",
      "width": 600,
      "size": "fill",
      "sizeMobile": "fill",
      "widthMobile": 600,
      "contentAlignment": "middle"
    }
  }
}
```

> **Image sizing — strict enum:** the `size` and `sizeMobile` fields accept ONLY `"original"`, `"fill"`, or `"scale"`. The UI labels are misleading: the toggle that says "Cover" stores `"fill"`, the one that says "Contain" stores `"original"`. NEVER emit `"cover"` / `"contain"` / `"medium"` / `"small"` / `"large"` here — the editor's resize hook will overwrite `props.width` with the parent container's pixel width on first render, blowing up small images.
>
> **When to pick each mode:**
>
> - `"fill"` — full-width hero / banner / wide product shot (renders at 100% of the parent).
> - `"scale"` — anything smaller than its container (avatar 32–80px, logo, icon in a feature grid). Pair with `"scale": <1-100>`. Example: a 64px avatar on a 600px canvas → `"scale": 11`.
> - `"original"` — image at its natural pixel size (rare; mostly for retina-fixed icons).

| Style Prop      | Type                                | Description                                            |
| --------------- | ----------------------------------- | ------------------------------------------------------ |
| backgroundColor | hex string                          | Frame the image on a coloured panel (common in heroes) |
| textAlign       | `"left"` \| `"center"` \| `"right"` | Horizontal alignment of the image inside its wrapper   |
| padding         | `{ top, bottom, right, left }`      |                                                        |
| mobilePadding   | `{ top, bottom, right, left }`      |                                                        |

| Props            | Type                                  | Description                                        |
| ---------------- | ------------------------------------- | -------------------------------------------------- |
| url              | string                                | Image URL (use absolute URLs)                      |
| alt              | string                                | Alt text                                           |
| width            | number                                | Image width in px                                  |
| height           | number                                | Optional fixed height                              |
| size             | `"original"` \| `"fill"` \| `"scale"` | Sizing mode (strict enum — see note above)         |
| sizeMobile       | `"original"` \| `"fill"` \| `"scale"` | Mobile sizing mode                                 |
| scale            | number (1–100)                        | Scale percentage; required when `size === "scale"` |
| scaleMobile      | number (1–100)                        | Mobile scale                                       |
| linkHref         | string                                | Optional click-through URL                         |
| contentAlignment | `"top"` \| `"middle"` \| `"bottom"`   | Vertical alignment                                 |

### NotionText (Rich Text)

Rich text block using HTML content. This is the primary text block.

```json
{
  "type": "NotionText",
  "data": {
    "style": {
      "fontSize": 16,
      "fontWeight": "normal",
      "color": "#1F2937",
      "lineHeight": "1.5",
      "textAlign": "left",
      "padding": { "top": 16, "bottom": 16, "right": 24, "left": 24 },
      "mobilePadding": { "top": 16, "bottom": 16, "right": 24, "left": 24 }
    },
    "props": {
      "html": "<p>Hello <strong>world</strong>! Click <a href=\"https://example.com\">here</a>.</p>"
    }
  }
}
```

| Style Prop     | Type                                               | Description                                                                                  |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| fontSize       | number (px)                                        | See Font size for headings below                                                             |
| fontSizeMobile | number (px)                                        | Mobile-specific override                                                                     |
| fontFamily     | enum                                               | Override the EmailLayout font on this block (e.g. `PLAYFAIR` title + `LATO` body)            |
| fontWeight     | `"bold"` \| `"normal"`                             | Do not rely only on `<h1>` / `<h2>` tags for emphasis                                        |
| color          | hex string                                         | Accent (on coloured bg) / muted (dark footer) / brand — e.g. `#0C4271`, `#B8C7D9`, `#374151` |
| lineHeight     | string                                             | `"1.1"` for oversized titles, `"1.4"`–`"1.6"` for body copy                                  |
| textAlign      | `"left"` \| `"center"` \| `"right"` \| `"justify"` | Block alignment                                                                              |
| padding        | `{ top, bottom, right, left }`                     |                                                                                              |
| mobilePadding  | `{ top, bottom, right, left }`                     |                                                                                              |

| Props | Type          | Default                            |
| ----- | ------------- | ---------------------------------- |
| html  | string (HTML) | `"<p>Double click to edit...</p>"` |

**HTML content supports:** `<p>`, `<strong>`, `<em>`, `<a href>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<span style>`, `<h1>`-`<h3>`.

**Important — Font size is content-length-driven, NOT just about the HTML tag.** The `<h1>`, `<h2>`, `<h3>` tags inside `html` do NOT automatically change the rendered font size. You MUST set the `fontSize` style prop to match BOTH the visual role AND the length of the content inside the block:

| Visual role                                           | Typical length                    | fontSize                  |
| ----------------------------------------------------- | --------------------------------- | ------------------------- |
| Oversized display (discount, event name, single word) | 1 word / 1 short phrase           | 56–74                     |
| Hero / main title                                     | 1–4 words                         | 34–56                     |
| Section title                                         | 3–8 words                         | 24–32                     |
| Subtitle / lead paragraph                             | 1–2 short sentences (<20 words)   | 18–22                     |
| Body copy (any multi-line paragraph)                  | ≥20 words or multi-line paragraph | **14–16, NEVER above 18** |
| Small / legal / footer copy                           | any                               | 11–13                     |

**Self-audit on NotionText fontSize:** if the `html` body text is longer than ~30 words, the `fontSize` MUST be 14–16. Emitting `fontSize: 28` on a long paragraph renders visually broken — big sizes are only for short titles, standalone metrics, or single-line display copy.

### Divider

```json
{
  "type": "Divider",
  "data": {
    "style": {
      "padding": { "top": 16, "bottom": 16, "right": 40, "left": 40 },
      "mobilePadding": { "top": 16, "bottom": 16, "right": 20, "left": 20 },
      "height": 2,
      "color": "#0C4271",
      "width": 100
    },
    "props": []
  }
}
```

| Style Props  | Type                                | Default     |
| ------------ | ----------------------------------- | ----------- |
| height       | number (px)                         | `1`         |
| heightMobile | number (px)                         | —           |
| color        | hex string                          | `"#333333"` |
| width        | number (percentage)                 | `100`       |
| widthMobile  | number (percentage)                 | —           |
| textAlign    | `"left"` \| `"center"` \| `"right"` | `"left"`    |

**Note:** Divider uses `"props": []` (empty array), not an object.

**Colour guidance:** do NOT default to `"#CCCCCC"` / `"#BBBBBB"`. Pick a hex that echoes the accent palette — e.g. `"#0C4271"` / `"#2F4D71"` (navy), `"#4A7CB9"` (softer inner), `"#E03E2D"` (red ecommerce), `"#2DC26B"` (green), `"#535353"` (neutral on dark bg).

**Short centered accent rule** — use `width: 15–50` with `textAlign: "center"` as a decorative section break instead of a full-width line:

```json
{
  "type": "Divider",
  "data": {
    "style": {
      "padding": { "top": 20, "bottom": 20, "right": 10, "left": 10 },
      "height": 2,
      "color": "#535353",
      "width": 15,
      "textAlign": "center"
    },
    "props": []
  }
}
```

### Spacer

```json
{
  "type": "Spacer",
  "data": {
    "style": {
      "height": 32
    }
  }
}
```

| Style Props     | Type        | Default |
| --------------- | ----------- | ------- |
| height          | number (px) | 16      |
| heightMobile    | number (px) | —       |
| backgroundColor | hex or null | null    |

### SocialMedia

Social media icon links.

```json
{
  "type": "SocialMedia",
  "data": {
    "style": {
      "textAlign": "center",
      "padding": { "top": 16, "bottom": 16, "right": 24, "left": 24 }
    },
    "gap": 10,
    "items": [
      {
        "id": "social-1",
        "key": "facebook",
        "label": "Facebook",
        "iconName": "Facebook",
        "theme": "original",
        "size": "medium",
        "sizePx": "36px",
        "url": "https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/Facebook_Original_36px.png",
        "href": "https://facebook.com/yourpage"
      }
    ]
  }
}
```

**Available icon keys:** facebook, instagram, linkedin, x, youtube, tiktok, apple, github, whatsapp, telegram, pinterest, snapchat, spotify, medium-social, reddit, tumblr, threads, bluesky, web, mail, clubhouse, dribbble, figma, google, messenger, signal, twitch, vk

**Twitter → X:** if a user prompt mentions "Twitter", emit `key: "x"`, `iconName: "X"`, `url: ".../X_{Theme}_{SizePx}.png"`. The Twitter icon was removed from the asset bucket at the X rebrand — requesting a Twitter URL returns a 404.

**Themes (REQUIRED per item):** there are exactly THREE valid values — `"positive"` (light icons, label "Light"), `"original"` (full-colour icons, label "Color"), `"negative"` (dark outline icons, label "Dark"). Every `items[]` entry MUST include `theme`; the field is embedded in the icon URL filename and the `getIconUrl` helper only resolves these three. Any other value (e.g. `"circle-white"`, `"rounded"`, `"rounded-black"`) produces a URL that 404s in the bucket.

**Theme pairing by footer / context:**

| Footer / context                                             | Recommended per-item `theme`                              |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| Light or white footer (canvas bg, cream, pale)               | `"original"` (colour icons)                               |
| Dark footer (Container bg `#0C4271` / `#222222` / `#282828`) | `"negative"` (white outline) or `"positive"` (light fill) |
| Coloured bg (saturated brand colour)                         | `"original"` if contrast is OK, else `"negative"`         |

**Sizes:** small (24px), medium (36px), large (48px)

**Icon URL pattern:** `https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/{IconName}_{CapitalizedTheme}_{SizePx}.png` — the theme segment in the filename is **capitalized** (`Positive`, `Original`, `Negative`) while the `theme` field stays lowercase. Example: `iconName: "Facebook"`, `theme: "original"`, `sizePx: "36px"` → `Facebook_Original_36px.png`. All three segments MUST match or the hotlink 404s.

> ⚠️ **Every `items[]` entry MUST include ALL of these fields or Zod validation fails:** `id`, `key`, `label`, `iconName`, `theme`, `size`, `sizePx`, `url`. The `label` field is **Required** (not optional) — omitting it causes a validation error. Use the icon display name as the label (e.g. `"label": "Facebook"`, `"label": "X"`, `"label": "Instagram"`).

## Complete Example — Modern SaaS Welcome (dense)

A production-ready anchor template at the upper end of the 15–28 block density range. Demonstrates every pattern the LLM should imitate by default: a non-default `fontFamily` (`MONTSERRAT`); a **gradient** hero via `style.background`; **three Containers with `borderRadius`** (hero 16, features 16, CTA card 20) plus a full-bleed dark footer at radius 0; a 3-column feature grid with image + title + description per column; pill Buttons with `fullWidth` and high-contrast colours; a body section with an inline anchor link; a secondary CTA card; a 2px accent Divider; and NotionText blocks that set explicit `color` / `lineHeight` / `fontWeight` tuned to content length.

```json
{
  "root": {
    "type": "EmailLayout",
    "data": {
      "backdropColor": "#F5F7FF",
      "canvasColor": "#FFFFFF",
      "textColor": "#1F2937",
      "fontFamily": "MONTSERRAT",
      "childrenIds": [
        "block-header",
        "block-hero",
        "block-features",
        "block-body",
        "block-cta-card",
        "block-divider",
        "block-footer"
      ],
      "linkGlobal": {
        "linkColor": "#0254FB",
        "underline": true
      }
    }
  },
  "block-header": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": null,
        "padding": {
          "top": 40,
          "bottom": 16,
          "right": 24,
          "left": 24
        },
        "mobilePadding": {
          "top": 24,
          "bottom": 12,
          "right": 16,
          "left": 16
        }
      },
      "props": {
        "childrenIds": ["block-logo"]
      }
    }
  },
  "block-logo": {
    "type": "Image",
    "data": {
      "style": {
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 0,
          "left": 0
        },
        "textAlign": "center"
      },
      "props": {
        "url": "https://placehold.co/240x64?text=Acme",
        "alt": "Acme logo",
        "width": 160,
        "size": "scale",
        "scale": 25
      }
    }
  },
  "block-hero": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": "#0C4271",
        "background": "linear-gradient(135deg, #0C4271 0%, #2F4D71 100%)",
        "borderRadius": 16,
        "shape": {
          "topLeft": 90,
          "topRight": 90,
          "bottomLeft": 0,
          "bottomRight": 0
        },
        "padding": {
          "top": 64,
          "bottom": 56,
          "right": 40,
          "left": 40
        },
        "mobilePadding": {
          "top": 40,
          "bottom": 32,
          "right": 20,
          "left": 20
        }
      },
      "props": {
        "childrenIds": [
          "block-hero-title",
          "block-hero-subtitle",
          "block-hero-cta",
          "block-hero-microcopy"
        ]
      }
    }
  },
  "block-hero-title": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 38,
        "fontWeight": "bold",
        "color": "#FFFFFF",
        "lineHeight": "1.15",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 8,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<h1>Welcome to Acme</h1>"
      }
    }
  },
  "block-hero-subtitle": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 18,
        "color": "#E6EEF8",
        "lineHeight": "1.45",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 24,
          "right": 16,
          "left": 16
        }
      },
      "props": {
        "html": "<p>Ship your first project in under a minute — zero setup required.</p>"
      }
    }
  },
  "block-hero-cta": {
    "type": "Button",
    "data": {
      "style": {
        "fontSize": 16,
        "fontWeight": "bold",
        "textAlign": "center",
        "shape": "pill",
        "padding": {
          "top": 0,
          "bottom": 16,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "text": "Open your dashboard",
        "url": "https://example.com/dashboard",
        "buttonBackgroundColor": "#FFD41B",
        "buttonTextColor": "#0C4271",
        "fullWidth": true,
        "size": "medium"
      }
    }
  },
  "block-hero-microcopy": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 12,
        "color": "#B8C7D9",
        "lineHeight": "1.5",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<p>No credit card required. Cancel any time.</p>"
      }
    }
  },
  "block-features": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": "#FFFFFF",
        "borderRadius": 16,
        "borderColor": "#E5E7EB",
        "borderTop": 1,
        "borderBottom": 1,
        "borderLeft": 1,
        "borderRight": 1,
        "padding": {
          "top": 48,
          "bottom": 48,
          "right": 24,
          "left": 24
        },
        "mobilePadding": {
          "top": 32,
          "bottom": 32,
          "right": 16,
          "left": 16
        }
      },
      "props": {
        "childrenIds": ["block-features-title", "block-features-grid"]
      }
    }
  },
  "block-features-title": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 24,
        "fontWeight": "bold",
        "color": "#1F2937",
        "lineHeight": "1.2",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 24,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<h2>Everything you need to ship</h2>"
      }
    }
  },
  "block-features-grid": {
    "type": "ColumnsContainer",
    "data": {
      "style": {
        "backgroundColor": null,
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "fixedWidths": [33.333, 33.333, 33.334],
        "columnsCount": 3,
        "layout": "layout-33-33-33",
        "contentAlignment": "top",
        "stackColumnsOnMobile": true,
        "columns": [
          {
            "childrenIds": ["block-1778205087519-fpn"]
          },
          {
            "childrenIds": ["block-1778205072892-k7t"]
          },
          {
            "childrenIds": ["block-1778204977529-yw2"]
          }
        ]
      }
    }
  },
  "block-feat1-image": {
    "type": "Image",
    "data": {
      "style": {
        "padding": {
          "top": 0,
          "bottom": 12,
          "right": 0,
          "left": 0
        },
        "textAlign": "center"
      },
      "props": {
        "url": "https://picsum.photos/seed/feature-ship-fast/200/120",
        "alt": "Ship fast",
        "width": 184,
        "size": "fill"
      }
    }
  },
  "block-feat1-title": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 16,
        "fontWeight": "bold",
        "color": "#0C4271",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 4,
          "right": 8,
          "left": 8
        }
      },
      "props": {
        "html": "<p>Ship fast</p>"
      }
    }
  },
  "block-feat1-desc": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 14,
        "color": "#374151",
        "lineHeight": "1.5",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 12,
          "left": 12
        },
        "mobilePadding": {
          "top": 0,
          "bottom": 0,
          "right": 12,
          "left": 12
        }
      },
      "props": {
        "html": "<p>Deploy in a minute, not a morning.</p>"
      }
    }
  },
  "block-feat2-image": {
    "type": "Image",
    "data": {
      "style": {
        "padding": {
          "top": 0,
          "bottom": 12,
          "right": 0,
          "left": 0
        },
        "textAlign": "center"
      },
      "props": {
        "url": "https://picsum.photos/seed/feature-focus/200/120",
        "alt": "Stay focused",
        "width": 184,
        "size": "fill"
      }
    }
  },
  "block-feat2-title": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 16,
        "fontWeight": "bold",
        "color": "#0C4271",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 4,
          "right": 8,
          "left": 8
        }
      },
      "props": {
        "html": "<p>Stay focused</p>"
      }
    }
  },
  "block-feat2-desc": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 14,
        "color": "#374151",
        "lineHeight": "1.5",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 12,
          "left": 12
        },
        "mobilePadding": {
          "top": 0,
          "bottom": 0,
          "right": 12,
          "left": 12
        }
      },
      "props": {
        "html": "<p>One place for reviews, tasks, and team metrics.</p>"
      }
    }
  },
  "block-feat3-image": {
    "type": "Image",
    "data": {
      "style": {
        "padding": {
          "top": 0,
          "bottom": 12,
          "right": 0,
          "left": 0
        },
        "textAlign": "center"
      },
      "props": {
        "url": "https://picsum.photos/seed/feature-scale/200/120",
        "alt": "Scale calmly",
        "width": 184,
        "size": "fill"
      }
    }
  },
  "block-feat3-title": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 16,
        "fontWeight": "bold",
        "color": "#0C4271",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 4,
          "right": 8,
          "left": 8
        }
      },
      "props": {
        "html": "<p>Scale calmly</p>"
      }
    }
  },
  "block-feat3-desc": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 14,
        "color": "#374151",
        "lineHeight": "1.5",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 12,
          "left": 12
        },
        "mobilePadding": {
          "top": 0,
          "bottom": 0,
          "right": 12,
          "left": 12
        }
      },
      "props": {
        "html": "<p>Infra that grows with you, not ahead of you.</p>"
      }
    }
  },
  "block-body": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": null,
        "padding": {
          "top": 40,
          "bottom": 24,
          "right": 40,
          "left": 40
        },
        "mobilePadding": {
          "top": 24,
          "bottom": 16,
          "right": 20,
          "left": 20
        }
      },
      "props": {
        "childrenIds": ["block-body-heading", "block-body-para"]
      }
    }
  },
  "block-body-heading": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 24,
        "fontWeight": "bold",
        "color": "#1F2937",
        "lineHeight": "1.2",
        "textAlign": "left",
        "padding": {
          "top": 0,
          "bottom": 12,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<h2>Need a hand?</h2>"
      }
    }
  },
  "block-body-para": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 15,
        "color": "#374151",
        "lineHeight": "1.6",
        "textAlign": "left",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<p>Reply directly to this email and a real human gets back within one business day. Or explore the <a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"https://example.com/docs\">docs</a> for step-by-step guides, API references, and live code samples.</p>"
      }
    }
  },
  "block-cta-card": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": "#F5F7FF",
        "borderColor": "#b0c4dd",
        "borderRadius": 20,
        "borderTop": 0,
        "borderBottom": 1,
        "borderLeft": 1,
        "borderRight": 1,
        "padding": {
          "top": 40,
          "bottom": 40,
          "right": 32,
          "left": 32
        },
        "mobilePadding": {
          "top": 28,
          "bottom": 28,
          "right": 20,
          "left": 20
        },
        "borderSidesLinked": false
      },
      "props": {
        "childrenIds": ["block-cta-title", "block-cta-body", "block-cta-button"]
      }
    }
  },
  "block-cta-title": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 22,
        "fontWeight": "bold",
        "color": "#0C4271",
        "lineHeight": "1.2",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 8,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<h2>Ready to try Acme Pro?</h2>"
      }
    }
  },
  "block-cta-body": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 15,
        "color": "#374151",
        "lineHeight": "1.5",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 20,
          "right": 16,
          "left": 16
        }
      },
      "props": {
        "html": "<p>Fourteen days free, every feature unlocked, no credit card.</p>"
      }
    }
  },
  "block-cta-button": {
    "type": "Button",
    "data": {
      "style": {
        "fontSize": 15,
        "fontWeight": "bold",
        "textAlign": "center",
        "shape": "pill",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "text": "Start free trial",
        "url": "https://example.com/trial",
        "buttonBackgroundColor": "#0254FB",
        "buttonTextColor": "#FFFFFF",
        "fullWidth": false,
        "size": "medium"
      }
    }
  },
  "block-divider": {
    "type": "Divider",
    "data": {
      "style": {
        "backgroundColor": "#F5F7FF",
        "padding": {
          "top": 32,
          "bottom": 32,
          "right": 40,
          "left": 40
        },
        "mobilePadding": {
          "top": 16,
          "bottom": 0,
          "right": 20,
          "left": 20
        },
        "height": 2,
        "color": "#0C4271",
        "width": 100
      },
      "props": []
    }
  },
  "block-footer": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": "#0C4271",
        "padding": {
          "top": 32,
          "bottom": 32,
          "right": 24,
          "left": 24
        },
        "mobilePadding": {
          "top": 24,
          "bottom": 24,
          "right": 16,
          "left": 16
        }
      },
      "props": {
        "childrenIds": ["block-footer-social", "block-footer-legal"]
      }
    }
  },
  "block-footer-social": {
    "type": "SocialMedia",
    "data": {
      "style": {
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 16,
          "right": 0,
          "left": 0
        }
      },
      "gap": 12,
      "items": [
        {
          "id": "social-x",
          "key": "x",
          "label": "X",
          "iconName": "X",
          "theme": "negative",
          "size": "medium",
          "sizePx": "36px",
          "url": "https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/X_Negative_36px.png",
          "href": "https://x.com/acme"
        },
        {
          "id": "social-linkedin",
          "key": "linkedin",
          "label": "LinkedIn",
          "iconName": "LinkedIn",
          "theme": "negative",
          "size": "medium",
          "sizePx": "36px",
          "url": "https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/LinkedIn_Negative_36px.png",
          "href": "https://linkedin.com/company/acme"
        }
      ]
    }
  },
  "block-footer-legal": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 12,
        "color": "#B8C7D9",
        "lineHeight": "1.5",
        "textAlign": "center",
        "padding": {
          "top": 0,
          "bottom": 0,
          "right": 0,
          "left": 0
        }
      },
      "props": {
        "html": "<p><span style=\"color: rgb(252, 241, 241);\">© 2026 Acme Inc. All rights reserved.</span></p><p><a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"https://example.com/unsubscribe\"><span style=\"color: rgb(255, 241, 241);\">Unsubscribe</span></a><span style=\"color: rgb(255, 241, 241);\"> · </span><a target=\"_blank\" rel=\"noopener noreferrer nofollow\" href=\"https://example.com/privacy\"><span style=\"color: rgb(255, 241, 241);\">Privacy</span></a></p>"
      }
    }
  },
  "block-1778204977529-yw2": {
    "type": "Container",
    "data": {
      "style": {
        "padding": {
          "top": 16,
          "bottom": 16,
          "left": 24,
          "right": 24
        },
        "mobilePadding": null
      },
      "props": {
        "childrenIds": ["block-feat3-image", "block-feat3-title", "block-feat3-desc"]
      }
    }
  },
  "block-1778205072892-k7t": {
    "type": "Container",
    "data": {
      "style": {
        "padding": {
          "top": 16,
          "bottom": 16,
          "left": 24,
          "right": 24
        },
        "mobilePadding": null
      },
      "props": {
        "childrenIds": ["block-feat2-image", "block-feat2-title", "block-feat2-desc"]
      }
    }
  },
  "block-1778205087519-fpn": {
    "type": "Container",
    "data": {
      "style": {
        "padding": {
          "top": 16,
          "bottom": 16,
          "left": 24,
          "right": 24
        },
        "mobilePadding": null
      },
      "props": {
        "childrenIds": ["block-feat1-image", "block-feat1-title", "block-feat1-desc"]
      }
    }
  }
}
```

## Behavioral Guidelines

- Always generate the `"root"` block with type `"EmailLayout"` first.
- `root.childrenIds` MUST contain ONLY `Container` or `ColumnsContainer` blocks. Wrap every leaf block (NotionText, Button, Image, Divider, Spacer, SocialMedia) inside a Container.
- Use Container blocks to group related content sections (header, body, footer).
- Every block ID referenced in any `childrenIds` MUST exist in the document.
- Use `NotionText` for ALL text content — body text, headings, footers. Use HTML tags like `<h1>`, `<h2>`, `<h3>` inside the `html` prop for headings.
- Match `NotionText.style.fontSize` to content length. Body paragraphs (≥20 words) stay at 14–16, NEVER above 18. Big sizes (28+) are only for short titles, discounts, or single-line display copy.
- Do NOT generate `Heading`, `Html`, `CustomEditor`, `Avatar`, `Wysiwyg`, or `Text` blocks — these are legacy/removed types.
- Always include `padding` in style objects for proper spacing.
- At least 2 non-footer Containers MUST have `borderRadius >= 8` (hero + CTA card / feature grid / body panel is the usual trio). Use 12–16 for modern card sections, 20+ for highlight callouts. Keep `borderRadius: 0` only for full-bleed coloured bands (dark footers that span edge to edge). EmailBuilder renders border-radius correctly via nested `<td>` wrappers — do NOT skip radius out of generic "Outlook compatibility" concerns.
- Use hex colors with 6 digits: `"#007BFF"`, not `"blue"` or `"#07F"`.
- For ColumnsContainer, always provide exactly 3 entries in `columns` array (unused columns get `{ "childrenIds": [] }`).
- `fixedWidths` is always a 3-tuple: `[number, number, number|null]`.
- Image URLs must be absolute (https://).
- `SocialMedia.items[]` entries MUST include `theme` from the 3-value enum (`"positive"`, `"original"`, `"negative"`). The URL filename uses the capitalized theme (e.g. `Facebook_Negative_36px.png`, `X_Original_36px.png`). Do NOT emit `"circle-white"`, `"circle-black"`, `"rounded"` or `"rounded-black"` — those are legacy values that 404 in the asset bucket. If a user mentions Twitter, emit `key: "x"`, `iconName: "X"` — the Twitter asset was removed at the X rebrand.
- For hero / content / background images, use `https://picsum.photos/seed/{semantic-slug}/{width}/{height}` (real curated photos, no auth, deterministic per seed — e.g. `/seed/saas-welcome/1200/480`). Only use `https://placehold.co/{w}x{h}?text=Brand` for LOGO placeholders where the brand-name text is informative. Do NOT use `placehold.co` for hero / content / background imagery — grey boxes make emails feel flat.
- When the user asks for a template, generate the COMPLETE JSON — do not leave placeholders.

## Template Categories

See [references/PATTERNS.md](references/PATTERNS.md) for detailed structural patterns extracted from 462 production templates, including block sequences, styling conventions, and a minimal starter template.

Quick reference:

| Category          | Structure                                                             |
| ----------------- | --------------------------------------------------------------------- |
| Newsletter        | Logo → Title (36–74px) → Body → CTA → Footer with social              |
| Events            | Logo → Event name (45px+) → Details → CTA → Footer                    |
| Product Promotion | Product image → Logo → Headline → Body → CTA → Footer                 |
| Notification      | Hero image → Greeting (22px) → Message (minimal, no CTA needed)       |
| Ecommerce         | Logo → Dividers → Deal headline → Discount (36px+) → CTA → Footer     |
| Confirmation      | Logo → Title → Details → Hero image → Body → CTA → Footer             |
| Transactional     | Headline → Subheading → Image → Body → CTA → Social → Contact → Legal |

## Rendering and Sending

The generated JSON can be:

1. **Loaded into the builder:** `builderRef.current.setDocument(json)`
2. **Rendered to HTML server-side:** Using `renderToStaticMarkup(json, { rootBlockId: 'root' })`
3. **Sent via any provider:** Pass the HTML to Resend, SES, SendGrid, etc.

```typescript
// Load into builder
builderRef.current.setDocument(generatedJson);

// Get HTML from builder
const html = builderRef.current.getHtml();

// Send with Resend
await resend.emails.send({
  from: 'App <noreply@example.com>',
  to: ['user@example.com'],
  subject: 'Welcome!',
  html,
});
```

## Legacy Blocks (do NOT generate)

Some existing templates use legacy block types that have been replaced by `NotionText`. The builder automatically migrates `CustomEditor` when loading documents:

- `CustomEditor` → migrated to `NotionText` (only remaining legacy migrator)
- `Wysiwyg`, `Text`, `Avatar` → fully retired; no longer migrated and silently dropped if present
- `Heading` → still a valid block, but prefer NotionText with `<h1>`/`<h2>`/`<h3>` HTML tags for AI-generated content
- `Html` → still a valid block, but prefer NotionText with raw HTML in the `html` prop for AI-generated content

When generating NEW templates, always use `NotionText` for any text content.
