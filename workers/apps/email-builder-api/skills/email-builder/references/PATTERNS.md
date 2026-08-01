# Template Patterns Reference

Production-tested patterns extracted from 462 templates. Use these as structural guides when generating new templates.

## Universal Rules

| Rule                         | Value                                                             |
| ---------------------------- | ----------------------------------------------------------------- |
| Every section is a Container | Hero, body, CTA, footer — each wrapped in its own Container       |
| Spacing via padding          | Use large padding (40–120px) instead of Spacer blocks             |
| Font hierarchy               | Title: 28–45px, Subtitle: 22–28px, Body: 14–16px, Footer: 12–13px |
| Color strategy               | 1–2 accent colors max; white text on colored backgrounds          |
| Image scaling                | Logos: 15–25% scale; Heroes: 70–100% cover/fill                   |
| CTA placement                | Button always after body text, before footer                      |
| Footer pattern               | Dark bg Container → SocialMedia → Legal text (small, centered)    |
| Font family                  | LATO (default), occasionally MONTSERRAT or ROBOTO                 |
| Button style                 | Usually fullWidth: true, contrasting bg color, borderRadius 4–25  |

## Pattern: Newsletter

```
root (EmailLayout)
  └── Container (header): Image(logo) or NotionText(brand heading, 36–74px)
  └── Container (body): NotionText(content, 16px) + optional Image(hero)
  └── Container (CTA): Button(full-width, accent color)
  └── Container (footer): SocialMedia + NotionText(legal, 12px)
```

**Characteristics:**

- Simple, text-heavy layouts
- 1 accent color for buttons and headings
- Large heading font (36–74px) for impact
- Body text padded 24px sides, 16px font
- Footer with social icons + unsubscribe link

## Pattern: Events

```
root (EmailLayout)
  └── Container (hero): Image(logo, 20% scale) → NotionText(event name, 45px, white) → NotionText(details, 16px) → Button(CTA)
  └── Container (footer): SocialMedia(original, 36px) → NotionText(address/legal)
```

**Characteristics:**

- Bold visual hierarchy with large fonts (45–66px headings)
- Often white text on dark/colored container backgrounds
- Price or date prominently displayed (60px+)
- Pill-shaped buttons (borderRadius 20–25)
- Generous vertical padding (60px+) for breathing room

## Pattern: Product Promotion

```
root (EmailLayout)
  └── Container (hero): Image(product, 75% scale) → Image(logo, small) → NotionText(headline, 29px) → NotionText(body, 16px) → Button(accent color)
  └── Container (footer): SocialMedia → NotionText(legal)
```

**Characteristics:**

- Product image is the hero (large, cover/fill)
- Narrow text column effect via large horizontal padding (60–100px L/R)
- Pill buttons (borderRadius 25)
- 2 containers max (content + footer)
- Backdrop often gray (#e7e7e7) to make white canvas pop

## Pattern: Notification

```
root (EmailLayout)
  └── Container (hero): Image(full-width, cover, no padding)
  └── Container (body): NotionText(greeting, 22px) → NotionText(message, 16px)
```

**Characteristics:**

- Minimal — fewest blocks of any category
- Hero image full-width with no padding
- Simple text body, no button required
- Dark backdrop (#3a3737) common
- No footer section (or minimal)

## Pattern: Ecommerce

```
root (EmailLayout)
  └── Container (promo, colored bg): Image(logo) → Divider → NotionText(deal headline, 28px) → NotionText(discount, 36px+) → Button(contrasting color) → Divider → NotionText(terms)
  └── Container (footer, dark bg): NotionText(copyright, small, gray)
```

**Characteristics:**

- Bold colored backgrounds (red, blue, black)
- Dividers used as visual separators between sections
- Discount/price in large font (36px+)
- High-contrast button (yellow on red, white on black)
- Urgency language in text
- Footer minimal — just copyright on dark bg

## Pattern: Confirmation

```
root (EmailLayout)
  └── Container (main): Image(logo, 18%) → NotionText(title, 38px) → NotionText(details, 16px) → Image(hero, 70%) → NotionText(body, 16px, narrow padding) → Button(fullWidth, accent)
  └── Container (footer, dark bg): SocialMedia → NotionText(address/legal, white)
```

**Characteristics:**

- More content-heavy than notifications
- Reservation/order details in body text
- Hero image between title and body
- Narrow body text (70px horizontal padding)
- Muted accent colors (olive, navy)
- Full social footer

## Pattern: Transactional

```
root (EmailLayout)
  └── Container (hero): NotionText(headline, 35px, large top-padding) → NotionText(subheading, 28px, accent) → Image(decorative)
  └── Container (body): NotionText(message, 16px) → Button(fullWidth, accent)
  └── Container (social): SocialMedia
  └── Container (contact bar, colored bg): NotionText(contact info, white)
  └── Container (legal): NotionText(unsubscribe/privacy links, 12px)
```

**Characteristics:**

- Most containers of any pattern (4–5 sections)
- Extreme top-padding (100–325px) for visual spacing over bg images
- Multiple footer sections (social, contact, legal separate)
- 1 primary accent color used throughout
- Formal tone, more structured layout

## Minimal Template (Starter)

> ⚠️ **Do NOT use this shape by default.** This is a debug/starter fallback,
> not a production template. Real emails should follow one of the patterns
> above (Newsletter, Events, Product, Notification, Ecommerce, Confirmation,
> Transactional) with 3+ top-level Containers, hero image when relevant,
> generous padding, and a footer. Only generate this minimal shape when the
> user prompt explicitly asks for something like "a plain one-line email",
> "absolute minimum template", or "the smallest valid document".

The simplest valid template — use as a base:

```json
{
  "root": {
    "type": "EmailLayout",
    "data": {
      "backdropColor": "#F5F5F5",
      "canvasColor": "#FFFFFF",
      "textColor": "#262626",
      "fontFamily": "LATO",
      "childrenIds": ["block-1"],
      "linkGlobal": { "linkColor": "#0000ee", "underline": true }
    }
  },
  "block-1": {
    "type": "Container",
    "data": {
      "style": {
        "backgroundColor": null,
        "padding": { "top": 24, "bottom": 24, "right": 24, "left": 24 },
        "mobilePadding": null
      },
      "props": {
        "childrenIds": ["block-2"]
      }
    }
  },
  "block-2": {
    "type": "NotionText",
    "data": {
      "style": {
        "fontSize": 16,
        "fontWeight": "normal",
        "padding": { "top": 16, "bottom": 16, "right": 24, "left": 24 },
        "mobilePadding": null
      },
      "props": {
        "html": "<p>Your content here.</p>"
      }
    }
  }
}
```

---

## Layout Preset: Editorial Newsletter (PLAYFAIR + serif headers + accent dividers)

Key traits: serif font, 3–4px coloured Dividers between sections, rectangle Buttons, generous horizontal padding (80px), cream backdrop, left-aligned body text.

```ndjson
{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#F5F0E8","canvasColor":"#FFFDF9","textColor":"#1A1A1A","fontFamily":"PLAYFAIR","childrenIds":["block-1","block-2","block-3","block-4","block-5","block-6"],"linkGlobal":{"linkColor":"#0C4271","underline":true}}}}
{"id":"block-1","block":{"type":"Container","data":{"style":{"backgroundColor":null,"padding":{"top":40,"bottom":16,"right":80,"left":80},"mobilePadding":{"top":24,"bottom":12,"right":24,"left":24}},"props":{"childrenIds":["block-logo","block-issue"]}}}}
{"id":"block-logo","block":{"type":"Image","data":{"style":{"padding":{"top":0,"bottom":8,"right":0,"left":0},"textAlign":"left"},"props":{"url":"https://placehold.co/200x48?text=The+Brief","alt":"The Brief","width":160,"size":"scale","scale":25}}}}
{"id":"block-issue","block":{"type":"NotionText","data":{"style":{"fontSize":12,"color":"#888888","textAlign":"left","padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"<p>Issue #42 · May 2026</p>"}}}}
{"id":"block-2","block":{"type":"Divider","data":{"style":{"color":"#0C4271","height":3,"width":100,"padding":{"top":0,"bottom":0,"right":80,"left":80}}}}}
{"id":"block-3","block":{"type":"Container","data":{"style":{"backgroundColor":null,"padding":{"top":40,"bottom":40,"right":80,"left":80},"mobilePadding":{"top":28,"bottom":28,"right":24,"left":24}},"props":{"childrenIds":["block-hero-label","block-hero-title","block-hero-body","block-hero-btn"]}}}}
{"id":"block-hero-label","block":{"type":"NotionText","data":{"style":{"fontSize":11,"fontWeight":"bold","color":"#0C4271","textAlign":"left","padding":{"top":0,"bottom":8,"right":0,"left":0}},"props":{"html":"<p>FEATURE STORY</p>"}}}}
{"id":"block-hero-title","block":{"type":"NotionText","data":{"style":{"fontSize":36,"fontWeight":"bold","color":"#1A1A1A","lineHeight":"1.15","textAlign":"left","padding":{"top":0,"bottom":16,"right":0,"left":0}},"props":{"html":"<h1>The quiet revolution in async work</h1>"}}}}
{"id":"block-hero-body","block":{"type":"NotionText","data":{"style":{"fontSize":16,"color":"#333333","lineHeight":"1.7","textAlign":"left","padding":{"top":0,"bottom":24,"right":0,"left":0}},"props":{"html":"<p>Remote teams are rewriting the rules of collaboration — and the results are surprising even the skeptics. We spoke with 12 founders who made the switch and never looked back.</p>"}}}}
{"id":"block-hero-btn","block":{"type":"Button","data":{"style":{"fontSize":14,"fontWeight":"bold","textAlign":"left","shape":"rectangle","padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"text":"Read the full story →","url":"https://example.com/story","buttonBackgroundColor":"#0C4271","buttonTextColor":"#FFFFFF","fullWidth":false,"size":"medium"}}}}
{"id":"block-4","block":{"type":"Divider","data":{"style":{"color":"#D4C9B8","height":1,"width":100,"padding":{"top":32,"bottom":32,"right":80,"left":80}}}}}
{"id":"block-5","block":{"type":"Container","data":{"style":{"backgroundColor":null,"padding":{"top":0,"bottom":40,"right":80,"left":80},"mobilePadding":{"top":0,"bottom":28,"right":24,"left":24}},"props":{"childrenIds":["block-shorts-title","block-short1","block-short2","block-short3"]}}}}
{"id":"block-shorts-title","block":{"type":"NotionText","data":{"style":{"fontSize":11,"fontWeight":"bold","color":"#0C4271","textAlign":"left","padding":{"top":0,"bottom":16,"right":0,"left":0}},"props":{"html":"<p>IN BRIEF</p>"}}}}
{"id":"block-short1","block":{"type":"NotionText","data":{"style":{"fontSize":15,"color":"#1A1A1A","lineHeight":"1.6","textAlign":"left","padding":{"top":0,"bottom":12,"right":0,"left":0}},"props":{"html":"<p><strong>AI coding tools hit 40% adoption</strong> — A new survey of 5,000 developers shows nearly half now use AI assistants daily. <a href=\"https://example.com\">Read more</a></p>"}}}}
{"id":"block-short2","block":{"type":"NotionText","data":{"style":{"fontSize":15,"color":"#1A1A1A","lineHeight":"1.6","textAlign":"left","padding":{"top":0,"bottom":12,"right":0,"left":0}},"props":{"html":"<p><strong>Open-source funding models evolve</strong> — Maintainers are experimenting with new revenue streams beyond GitHub Sponsors. <a href=\"https://example.com\">Read more</a></p>"}}}}
{"id":"block-short3","block":{"type":"NotionText","data":{"style":{"fontSize":15,"color":"#1A1A1A","lineHeight":"1.6","textAlign":"left","padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"<p><strong>Design systems turn 10</strong> — A decade after Salesforce Lightning, we look at what worked and what didn't. <a href=\"https://example.com\">Read more</a></p>"}}}}
{"id":"block-6","block":{"type":"Container","data":{"style":{"backgroundColor":"#1A1A1A","borderRadius":0,"padding":{"top":32,"bottom":32,"right":80,"left":80},"mobilePadding":{"top":24,"bottom":24,"right":24,"left":24}},"props":{"childrenIds":["block-footer-social","block-footer-legal"]}}}}
{"id":"block-footer-social","block":{"type":"SocialMedia","data":{"style":{"textAlign":"left","padding":{"top":0,"bottom":16,"right":0,"left":0}},"gap":12,"items":[{"id":"s1","key":"x","label":"X","iconName":"X","theme":"negative","size":"medium","sizePx":"36px","url":"https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/X_Negative_36px.png","href":"https://x.com"},{"id":"s2","key":"linkedin","label":"LinkedIn","iconName":"LinkedIn","theme":"negative","size":"medium","sizePx":"36px","url":"https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/LinkedIn_Negative_36px.png","href":"https://linkedin.com"}]}}}
{"id":"block-footer-legal","block":{"type":"NotionText","data":{"style":{"fontSize":12,"color":"#888888","textAlign":"left","padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"<p>© 2026 The Brief. <a href=\"https://example.com/unsubscribe\">Unsubscribe</a></p>"}}}}
```

---

## Layout Preset: Ecommerce Flash Sale (OSWALD + dark hero + high-contrast CTA)

Key traits: dark/saturated hero Container, oversized discount text (56px bold), pill Button with high-contrast colour, 2-column product row layout, urgency copy.

```ndjson
{"id":"root","block":{"type":"EmailLayout","data":{"backdropColor":"#111111","canvasColor":"#1A1A1A","textColor":"#FFFFFF","fontFamily":"OSWALD","childrenIds":["block-1","block-2","block-3","block-4","block-5"],"linkGlobal":{"linkColor":"#FFD41B","underline":false}}}}
{"id":"block-1","block":{"type":"Container","data":{"style":{"backgroundColor":"#E03E2D","borderRadius":0,"padding":{"top":48,"bottom":48,"right":32,"left":32},"mobilePadding":{"top":32,"bottom":32,"right":20,"left":20}},"props":{"childrenIds":["block-logo","block-tag","block-discount","block-sub","block-cta","block-urgency"]}}}}
{"id":"block-logo","block":{"type":"Image","data":{"style":{"padding":{"top":0,"bottom":24,"right":0,"left":0},"textAlign":"center"},"props":{"url":"https://placehold.co/180x44?text=SHOP","alt":"Shop logo","width":140,"size":"scale","scale":20}}}}
{"id":"block-tag","block":{"type":"NotionText","data":{"style":{"fontSize":13,"fontWeight":"bold","color":"#FFD41B","textAlign":"center","padding":{"top":0,"bottom":8,"right":0,"left":0}},"props":{"html":"<p>⚡ 24-HOUR FLASH SALE</p>"}}}}
{"id":"block-discount","block":{"type":"NotionText","data":{"style":{"fontSize":72,"fontWeight":"bold","color":"#FFFFFF","lineHeight":"1.0","textAlign":"center","padding":{"top":0,"bottom":4,"right":0,"left":0}},"props":{"html":"<p>40% OFF</p>"}}}}
{"id":"block-sub","block":{"type":"NotionText","data":{"style":{"fontSize":18,"color":"#FFE8E8","lineHeight":"1.4","textAlign":"center","padding":{"top":0,"bottom":28,"right":16,"left":16}},"props":{"html":"<p>Everything in the store. No code needed — discount applied at checkout.</p>"}}}}
{"id":"block-cta","block":{"type":"Button","data":{"style":{"fontSize":18,"fontWeight":"bold","textAlign":"center","shape":"pill","padding":{"top":0,"bottom":12,"right":0,"left":0}},"props":{"text":"Shop the sale now","url":"https://example.com/sale","buttonBackgroundColor":"#FFD41B","buttonTextColor":"#1A1A1A","fullWidth":true,"size":"medium"}}}}
{"id":"block-urgency","block":{"type":"NotionText","data":{"style":{"fontSize":12,"color":"#FFB3B3","textAlign":"center","padding":{"top":8,"bottom":0,"right":0,"left":0}},"props":{"html":"<p>Sale ends midnight tonight. While stocks last.</p>"}}}}
{"id":"block-2","block":{"type":"Container","data":{"style":{"backgroundColor":"#222222","padding":{"top":40,"bottom":16,"right":24,"left":24},"mobilePadding":{"top":28,"bottom":12,"right":16,"left":16}},"props":{"childrenIds":["block-picks-title","block-picks-grid"]}}}}
{"id":"block-picks-title","block":{"type":"NotionText","data":{"style":{"fontSize":20,"fontWeight":"bold","color":"#FFFFFF","textAlign":"center","padding":{"top":0,"bottom":24,"right":0,"left":0}},"props":{"html":"<h2>Top picks</h2>"}}}}
{"id":"block-picks-grid","block":{"type":"ColumnsContainer","data":{"style":{"backgroundColor":null,"padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"fixedWidths":[50,50,null],"columnsCount":2,"contentAlignment":"top","stackColumnsOnMobile":true,"columns":[{"childrenIds":["block-p1-img","block-p1-name","block-p1-price"]},{"childrenIds":["block-p2-img","block-p2-name","block-p2-price"]},{"childrenIds":[]}]}}}}
{"id":"block-p1-img","block":{"type":"Image","data":{"style":{"padding":{"top":0,"bottom":8,"right":8,"left":8},"textAlign":"center"},"props":{"url":"https://picsum.photos/seed/product-sneaker/300/200","alt":"Sneaker","width":240,"size":"fill"}}}}
{"id":"block-p1-name","block":{"type":"NotionText","data":{"style":{"fontSize":14,"fontWeight":"bold","color":"#FFFFFF","textAlign":"center","padding":{"top":0,"bottom":4,"right":8,"left":8}},"props":{"html":"<p>Air Runner Pro</p>"}}}}
{"id":"block-p1-price","block":{"type":"NotionText","data":{"style":{"fontSize":16,"color":"#FFD41B","fontWeight":"bold","textAlign":"center","padding":{"top":0,"bottom":16,"right":8,"left":8}},"props":{"html":"<p><s style=\"color:#888\">$120</s> $72</p>"}}}}
{"id":"block-p2-img","block":{"type":"Image","data":{"style":{"padding":{"top":0,"bottom":8,"right":8,"left":8},"textAlign":"center"},"props":{"url":"https://picsum.photos/seed/product-bag/300/200","alt":"Bag","width":240,"size":"fill"}}}}
{"id":"block-p2-name","block":{"type":"NotionText","data":{"style":{"fontSize":14,"fontWeight":"bold","color":"#FFFFFF","textAlign":"center","padding":{"top":0,"bottom":4,"right":8,"left":8}},"props":{"html":"<p>Urban Tote XL</p>"}}}}
{"id":"block-p2-price","block":{"type":"NotionText","data":{"style":{"fontSize":16,"color":"#FFD41B","fontWeight":"bold","textAlign":"center","padding":{"top":0,"bottom":16,"right":8,"left":8}},"props":{"html":"<p><s style=\"color:#888\">$85</s> $51</p>"}}}}
{"id":"block-3","block":{"type":"Divider","data":{"style":{"color":"#E03E2D","height":2,"width":100,"padding":{"top":0,"bottom":0,"right":0,"left":0}}}}}
{"id":"block-4","block":{"type":"Container","data":{"style":{"backgroundColor":"#222222","padding":{"top":24,"bottom":32,"right":32,"left":32}},"props":{"childrenIds":["block-terms"]}}}}
{"id":"block-terms","block":{"type":"NotionText","data":{"style":{"fontSize":11,"color":"#666666","textAlign":"center","lineHeight":"1.5","padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"<p>Offer valid 8 May 2026 only. Cannot be combined with other promotions. <a href=\"https://example.com/unsubscribe\">Unsubscribe</a></p>"}}}}
{"id":"block-5","block":{"type":"Container","data":{"style":{"backgroundColor":"#111111","padding":{"top":24,"bottom":24,"right":32,"left":32}},"props":{"childrenIds":["block-footer-social","block-footer-copy"]}}}}
{"id":"block-footer-social","block":{"type":"SocialMedia","data":{"style":{"textAlign":"center","padding":{"top":0,"bottom":12,"right":0,"left":0}},"gap":12,"items":[{"id":"s1","key":"instagram","label":"Instagram","iconName":"Instagram","theme":"negative","size":"medium","sizePx":"36px","url":"https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/Instagram_Negative_36px.png","href":"https://instagram.com"},{"id":"s2","key":"x","label":"X","iconName":"X","theme":"negative","size":"medium","sizePx":"36px","url":"https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/X_Negative_36px.png","href":"https://x.com"},{"id":"s3","key":"facebook","label":"Facebook","iconName":"Facebook","theme":"negative","size":"medium","sizePx":"36px","url":"https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/Facebook_Negative_36px.png","href":"https://facebook.com"}]}}}
{"id":"block-footer-copy","block":{"type":"NotionText","data":{"style":{"fontSize":11,"color":"#555555","textAlign":"center","padding":{"top":0,"bottom":0,"right":0,"left":0}},"props":{"html":"<p>© 2026 Shop Inc. All rights reserved.</p>"}}}}
```
