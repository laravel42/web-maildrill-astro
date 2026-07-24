---
title: 'How we rebuilt Maildrill'
description: 'The story of a full refactor — a new islands frontend, a queue-backed messaging backend, a visual email editor compiled from source, and the product features that came with it.'
pubDate: 2026-07-20
author: 'The Maildrill team'
tags: ['engineering', 'product']
featured: false
draft: false
---

Maildrill started as a single idea: one calm workspace for every message — email, SMS, WhatsApp, and voice — that feels like a modern product, not an admin panel. Getting there meant rebuilding almost everything. This is the story of that refactor, and the features it unlocked.

## Why rebuild

The old stack made simple things hard: adding a channel, previewing a template, or shipping a small UI change all touched more than they should. We wanted three properties that are difficult to retrofit:

- **Fast pages, rich interactions.** Marketing and docs should be static and instant; the workspace should feel live.
- **A messaging pipeline that never double-sends.** Delivery is the product. It has to be correct under retries and restarts.
- **One audience across channels.** Lists, subscribers, and segments shared everywhere — not siloed per channel.

So we split the system cleanly and rebuilt each half around those goals.

## The architecture

The frontend is an **Astro** site with **React islands**. The marketing pages render statically; the workspace opts into server rendering only where it needs a session. Interactive surfaces — the campaign board, the subscriber CRM, the pricing estimator — are React islands that hydrate on demand. Styling is hand-authored CSS driven by design tokens, so the whole product shares one visual language instead of a tangle of component overrides.

The backend lives under **`workers/`** in this monorepo (package name still `workers`): **Fastify** apps with **BullMQ** workers on **Redis** and **Drizzle** over **PostgreSQL**. Postgres is the system of record; Infobip is delivery-only. Delivery reports land in **PostHog**; a short poller reconciles them into message and campaign state. Every row is tenant-scoped in a shared schema.

Between them sits a **BFF (backend-for-frontend) proxy**. The browser never holds a service credential. Islands call same-origin `/api/*` routes on the Astro server, which read the session, mint a short-lived tenant-scoped token, and forward to the service. It keeps secrets on the server and gives the client a single, typed surface generated from the backend's OpenAPI schema.

## The email editor, compiled from source

A visual email builder is the kind of thing teams usually bolt on as a prebuilt widget. We took the opposite approach: the editor is **vendored into the repo and compiled from source**. That let us restyle it to match the rest of the product — the same typography, the same inputs, the same focus ring — and, crucially, wire it to real data.

The biggest win there is **personalization that actually works**. The editor's merge-tag menu used to show placeholder tokens from a different provider. Now it reads the workspace's real schema and inserts the exact tokens the send pipeline substitutes:

- `{{name}}`, `{{email}}`, `{{phone}}` for the built-in subscriber fields
- `{{attributes.<key>}}` for every custom field you define

What you drop into the canvas is precisely what gets merged at send time. No guessing, no broken tags.

## What's new for operators

The refactor wasn't just plumbing. A pile of product improvements rode along with it.

**One audience, richer subscribers.** Subscribers now carry a first-class **phone** field alongside email, so the same person is addressable across email, SMS, WhatsApp, and voice. Beyond the built-ins, you can define **custom fields** — a workspace-wide attribute schema — and use them everywhere, including as merge tags in the editor.

**Segments that map to the database.** A segment is a set of rules — field, operator, value — that compile straight to SQL. The membership count you see is the count the query returns, so a campaign's reach is honest before you ever hit send.

**Real template previews.** Opening a template shows the actual rendered email in a sandboxed frame — the real HTML, not a CSS mockup that looks the same for every template.

**Safer by default.** Destructive actions ask first: deleting templates, subscribers, campaigns, lists, media, or segments all route through a confirmation dialog that focuses Cancel, not Confirm, so a stray keypress can't wipe a record. Small edits go the other way — tags on a subscriber now **save as you add and remove them**, no separate "save" button to forget.

**Passwordless sign-in.** Authentication is a magic link plus a six-digit code — no passwords to store, reset, or leak. Sessions are stateless JWTs, so the frontend keeps no auth database of its own.

## Under the hood: getting delivery right

The part we're proudest of is invisible when it works. Sending a campaign writes to a **transactional outbox** and enqueues a job with a **deterministic id**, so the same send can't be enqueued twice even if a request is retried. A status-guarded database update **claims** a campaign for sending before any message goes out, which makes double-sends impossible rather than merely unlikely.

Workers dispatch through the provider; provider webhooks flow back in and are normalized into delivery and engagement events, deduplicated by a stable fingerprint so a redelivered webhook doesn't inflate your numbers. Transactional emails — sign-in codes, welcome messages — go straight through the provider, bypassing the campaign pipeline entirely, so signing in never depends on a queue.

## What's next

The foundation is in place: a fast frontend, a correct backend, a shared audience model, and an editor that speaks the same data as the rest of the product. From here the work gets to be additive — more channels, deeper analytics, richer automations — instead of fighting the architecture to add them.

If you've been waiting for a messaging workspace that feels like a product, this is the one we rebuilt it to be.
