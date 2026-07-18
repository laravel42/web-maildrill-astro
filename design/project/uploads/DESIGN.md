# Maildrill UX Vision & Design Summary

**Version:** 1.0  
**Status:** Living Design Specification

---

# Vision

Maildrill should feel like **Linear meets Resend**, not like an admin panel.

Users should perceive Maildrill as:

> "The fastest professional workspace to create, deliver and analyze campaigns."

Every screen should optimize for:

- Speed
- Clarity
- Confidence
- Scalability

instead of CRUD.

---

# Product Personality

Maildrill is:

- Professional
- Calm
- Fast
- Predictable
- Powerful
- Minimal

Maildrill is **not**:

- Playful
- Decorative
- Colorful
- Enterprise legacy
- Dashboard-heavy

---

# Design Principles

## 1. Workspaces over dashboards

Every page exists to help users accomplish work.

Never create pages whose primary purpose is displaying statistics.

---

## 2. One primary action

Every screen answers:

> What should the user do next?

The primary CTA must always be obvious.

---

## 3. Information hierarchy

Visual importance follows this order:

1. Current task
2. Primary actions
3. Operational data
4. Metadata

Never the opposite.

---

## 4. Progressive disclosure

Don't expose advanced controls until they are needed.

Instead of displaying:

- 30 visible controls

Prefer:

- 5 primary controls
- "Advanced ▼"

---

## 5. Dense but breathable

Target products:

- Linear
- Resend
- GitHub
- Notion

Avoid:

- Salesforce
- Oracle
- Bootstrap Admin templates

---

# Visual Language

## Colors

Primary palette:

- Neutral
- Purple (brand)

Semantic colors:

- Success → Green
- Warning → Amber
- Danger → Red

No decorative colors.

---

## Border Radius

| Component | Radius |
|-----------|--------|
| Buttons | 10px |
| Cards | 16px |
| Dialogs | 20px |
| Images | 12px |

---

## Shadows

Only three elevations.

Subtle.

No glassmorphism.

---

## Typography

Font:

- Inter

Weights:

- Headings → Semibold
- Body → Regular

Numbers:

- Tabular

---

# Layout

Sidebar

- 280px
- Collapsible

Header

- 64px

Content

- Centered
- Maximum width: 1600px
- Comfortable margins

---

# Navigation

Sidebar:

- Dashboard
- Campaigns
- Templates
- Lists
- Subscribers
- Media
- Analytics
- Settings

Global Search

- ⌘K
- Available everywhere

---

# Dashboard

## Purpose

Show:

- Current health
- Recent work
- Next action

Never:

- 40 KPI cards

## Sections

1. Greeting
2. Quick Actions
3. KPI Strip
4. Recent Campaigns
5. Recent Activity
6. Performance
7. Getting Started

---

# Campaigns

Default view:

- Table

High density.

## Columns

- Status
- Name
- Audience
- Scheduled
- Performance
- Updated
- Actions

## Features

- Persistent filters
- Bulk actions
- Search
- Pagination

---

# Campaign Wizard

Five-step workflow:

1. Sender
2. Audience
3. Content
4. Review
5. Schedule

Layout:

Left:

- Stepper

Center:

- Content

Right:

- Live preview

Footer:

- Sticky navigation

---

# Email Builder

Three-panel layout:

- Block Library
- Canvas
- Property Inspector

Features:

- Floating toolbar
- Autosave
- Undo
- Redo
- Responsive preview

---

# Lists

Display mode:

- Cards

Each card contains:

- Subscribers
- Growth
- Segments
- Recent campaign
- Actions

---

# Subscribers

Modern CRM experience.

Table columns:

- Avatar
- Name
- Email
- Lists
- Tags
- Status
- Last Activity

Interaction:

- Right-side details drawer

---

# Templates

Gallery layout.

Large previews.

Hover actions:

- Preview
- Use
- Clone
- Favorite

Grouping:

- Categories

---

# Media Library

Features:

- Folder navigation
- Asset grid
- Drag & Drop
- Upload queue
- Preview drawer

---

# Analytics

Avoid raw numbers.

Focus on:

- Trends
- Comparisons
- Funnels
- Timelines
- Top campaigns
- Top links
- Top devices

---

# Settings

Organized sections:

- Workspace
- Branding
- Domains
- SMTP
- Billing
- API
- Users
- Permissions
- Integrations
- AI

Never use a single scrolling settings page.

---

# Component Library

Reusable components only.

Core library:

- Buttons
- Inputs
- Cards
- Tables
- Dialogs
- Drawers
- Badges
- Tags
- Progress
- Charts
- Breadcrumbs
- Tabs

Everything must be token-driven.

---

# States

Every component supports:

- Loading
- Empty
- Success
- Warning
- Error
- Disabled

Prefer skeleton loaders over spinners.

---

# Motion

Characteristics:

- Fast
- Subtle
- 150–250ms

Animation exists to explain interactions, not entertain.

---

# Accessibility

Requirements:

- Keyboard-first
- Visible focus states
- ARIA support
- High contrast
- Never communicate by color alone

---

# Responsive

Design priorities:

- Desktop first
- Tablet optimized
- Mobile simplified

Do not replicate desktop layouts.

Reprioritize content instead.

---

# AI-first Implementation

Every page specification must include:

- Purpose
- Hierarchy
- Components
- Interactions
- Acceptance criteria
- Accessibility
- Future extensions
- Implementation notes

Cursor, Claude Code, Codex, or any frontend engineer should be able to implement the page directly.

---

# Definition of Done

A page is complete when it is:

- Visually consistent
- Responsive
- Accessible
- Keyboard navigable
- Component-driven
- Production-ready
- Documented
- Testable

---

# Overall UX Goal

The user should never feel they are **using software**.

They should feel they are **running campaigns**.

If the Maildrill logo were removed, the product should naturally be compared with:

- Linear
- Resend
- Vercel
- Raycast
- GitHub
- Notion

—not traditional admin dashboards.

This document serves as the guiding reference for every design and implementation decision.