# CLAUDE.md — Claude Code guidance for `laravel42/maildrill`

Project-specific instructions for Claude Code. **`AGENTS.md` is the full
operating manual — read it.** This file is the fast reference plus Claude-specific
workflow notes. Where any doc contradicts `composer.json` / `package.json`, the
**manifest wins**.

---

## Stack (do not change without approval)

PHP 8.4 · Laravel 13 (multi-tenant monolith) · Octane on RoadRunner ·
Livewire 4.3 (class-based, `app/Livewire`) · Alpine 3 (UI-only) · Tailwind 4 ·
Vite 8 · pnpm · PHPUnit 13.

Octane runs long-lived workers — **never** hold request state in static
properties or singletons across requests.

---

## Workflow for every task

1. Read `docs/migration/MIGRATION_PLAN.md`, then do **only the named slice** and
   meet its definition of done.
2. **One slice per PR.** In the same PR, delete the code the slice replaces:
   - `resources/js/modules/<module>.js`
   - its import in `resources/js/app.js`
   - the replaced datatable JSON endpoint (route + controller action)
3. Inspect sibling files before creating anything; reuse existing Blade
   components; scaffold with `php artisan make:livewire`.
4. Use the shared **`WithDataTable`** trait for pagination/sort/select — never
   reimplement it.
5. Keep the existing markup and Tailwind look. Migration ≠ redesign.

---

## Rules for every Livewire action

- **Validate** (`rules()` / `#[Validate]`) **and** `$this->authorize(...)`.
- Tenant identifiers are `#[Locked]`.
- Add a **cross-tenant 403 test** for each action.
- `wire:key` in loops · `data-loading` for loading states · **Islands**
  (`wire:poll.visible`) for polling / expensive regions.

---

## Do NOT touch

Campaign send pipeline · Infobip gateways · donation public checkout ·
email-builder-online internals · auth views · dependencies.

---

## Tests & checks (run before finishing)

```bash
vendor/bin/phpunit --filter <RelevantTest>   # render, search/sort/paginate,
                                             # each action happy+fail, 403 authz
vendor/bin/pint --dirty
pnpm run lint
pnpm run typecheck
```

Feature tests use `Livewire::test(...)` and model factories.

---

## Hard "don'ts"

- No new documentation files, no verification/throwaway scripts, no
  reformat-only diffs.
- No dependency changes without approval.
- Don't leave replaced JS modules / endpoints behind.

---

## Design reference

For any UI work, follow `DESIGN.md`: **Geist** typography, **warm-cream** palette
with an **indigo `#4f46e5`** brand accent, radii (btn 10 / card 16 / img 12 /
dialog 20), tabular numerals, 150–250ms motion, keyboard-first accessibility.
`PRODUCT.md` holds the screen/feature acceptance reference.
