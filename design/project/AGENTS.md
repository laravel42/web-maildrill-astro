# AGENTS.md — Operating manual for AI coding agents

This file governs any AI agent (Claude Code, Cursor, Codex, etc.) working in the
**`laravel42/maildrill`** repository. Read it fully before writing code. If this
file and any other doc disagree, **the codebase wins** (see §1).

---

## 1. Ground truth & precedence

1. **Codebase over docs.** If `docs/CLAUDE.md` (or any doc) contradicts
   `composer.json` / `package.json`, the manifest wins.
2. Read `docs/migration/MIGRATION_PLAN.md` **first**, then execute **only the
   slice you are named**, satisfying its "definition of done" exactly.
3. Do not infer scope. One slice per PR.

---

## 2. Stack (authoritative)

- **PHP 8.4**, **Laravel 13** monolith, multi-tenant.
- **Laravel Octane on RoadRunner** (long-lived workers — avoid static/request
  state leaks).
- **Livewire 4.3** — class-based components in `app/Livewire`.
- **Alpine 3** — UI-only behavior (no business logic).
- **Tailwind 4**, **Vite 8**, **pnpm**.
- **PHPUnit 13** for tests.

Do **not** change dependencies (no `composer` / `pnpm` add/remove/upgrade)
without explicit approval.

---

## 3. The migration, in one line

Blade + Alpine-store screens are being migrated to Livewire 4. Each PR converts
one screen slice and **removes what it replaces in the same PR**:

- Delete the replaced JS module in `resources/js/modules/*.js`.
- Remove its import from `resources/js/app.js`.
- Remove the replaced datatable JSON endpoint (route + controller action).

A PR that adds the Livewire component but leaves the old module/endpoint behind
is **incomplete**.

---

## 4. Before creating anything

- **Check sibling files first.** Match the conventions already in the directory.
- **Reuse existing Blade components** instead of duplicating markup.
- Create Livewire components with `php artisan make:livewire` (class-based).
- Use the shared **`WithDataTable`** trait for pagination / sorting / selection —
  **never re-implement** these.
- Keep the existing markup and Tailwind look. This is a like-for-like migration,
  not a redesign.

---

## 5. Every Livewire action — non-negotiable

For **every** action method:

1. **Validate** — `rules()` or `#[Validate]` attributes.
2. **Authorize** — `$this->authorize(...)` against the relevant policy.
3. Tenant identifiers are **`#[Locked]`** (never client-mutable).
4. Add a **cross-tenant 403 test** proving one tenant cannot act on another's
   records.

UI details:
- `wire:key` on every loop iteration.
- `data-loading` (or `wire:loading`) for loading states.
- Use **Islands** (`wire:poll.visible`) for polling / expensive regions — do not
  poll the whole component.

---

## 6. Do NOT touch

- The campaign **send pipeline**.
- **Infobip** gateways.
- The **donation public checkout**.
- **email-builder-online** internals.
- **Auth views**.
- Dependencies (see §2).

If a slice appears to require touching these, stop and ask.

---

## 7. Testing (required per PR)

Write PHPUnit feature tests with `Livewire::test(...)` covering:

- **Render** — component mounts and shows expected data.
- **Search / sort / paginate** — the datatable behaviors.
- **Each action** — happy path **and** failure path.
- **Authorization** — the cross-tenant 403 test (§5).

Use **model factories**. Then run, in order:

```bash
# minimal filtered set for the slice
vendor/bin/phpunit --filter <RelevantTest>

vendor/bin/pint --dirty      # style, changed files only
pnpm run lint
pnpm run typecheck
```

---

## 8. Hygiene

- **No new documentation files**, no verification/throwaway scripts, no
  reformat-only diffs.
- Keep diffs scoped to the slice. Delete replaced code in the same PR (§3).
- Small, reviewable PRs.

---

## 9. Definition of done (per slice)

- [ ] Named slice implemented per its plan entry.
- [ ] Old JS module + `app.js` import + datatable JSON endpoint deleted.
- [ ] `WithDataTable` used; existing markup/Tailwind preserved; `wire:key`,
      loading states, Islands where required.
- [ ] Every action validated + authorized; tenant ids `#[Locked]`.
- [ ] Feature tests: render, search/sort/paginate, each action happy+fail,
      cross-tenant 403 — all green.
- [ ] `pint --dirty`, `pnpm run lint`, `pnpm run typecheck` clean.
