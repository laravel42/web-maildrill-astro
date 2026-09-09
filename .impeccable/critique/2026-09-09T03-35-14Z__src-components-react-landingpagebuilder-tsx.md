---
target: landing page editor
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-09-09T03-35-14Z
slug: src-components-react-landingpagebuilder-tsx
---
Method: dual-agent (A: c6bac176-fd35-4df5-9286-a946780d4796 · B: 9f6b6eba-fe5d-4b0c-8c35-dbca8064a495)

Inspected source-only. No browser automation in this session; overlay injection was not attempted. Detector CLI: exit 0, 0 findings across 27 markup files.

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | “Draft” / “Autosaved” only tracks the name field; canvas edits never dirty the host. Failure toast still uses a green check. |
| 2 | Match System / Real World | 2 | Host copy is native (“Save landing”). Inner chrome speaks Tokens, Code, zip prefixes, `sm`/`md`/`lg`, “Builder42.” |
| 3 | User Control and Freedom | 1 | Esc and Back leave without confirm. Esc on a confirm dialog also bubbles and closes the whole editor. Undo exists only inside the canvas. |
| 4 | Consistency and Standards | 2 | Shell matches email. Inner chrome is a second product. Email marks dirty on `onAutoSave`; landings do not. |
| 5 | Error Prevention | 1 | No leave-guard. Autosave cannot see canvas work. Template-replace and subtree-delete confirm, then Esc can still eject the session. |
| 6 | Recognition Rather Than Recall | 2 | Palette cards are labeled. Back, undo/redo, panel toggles, Layers, Preferences are icon-only. Two groups named “Content.” |
| 7 | Flexibility and Efficiency | 2 | ⌘Z / Alt+arrows exist. No ⌘S. Desktop palette click is a no-op (drag only). |
| 8 | Aesthetic and Minimalist Design | 2 | Warm and token-faithful — then two headers, a foreign brand, Code, Tokens, and zip Settings compete with the page. |
| 9 | Error Recovery | 2 | Load failure + Reload is good. Persist errors rethrow into an inline banner. Esc-close has no recovery. |
| 10 | Help and Documentation | 1 | One inspector info tooltip. Palette hint is in i18n and not rendered. Empty canvas does not teach. |
| **Total** | | **18/40** | **Poor** |

#### Design Specificity Verdict

**LLM assessment**: The host chrome is Maildrill. `ChannelEditorShell` + `EditorHeader` reuse Geist, warm-cream `--surface`, indigo Save, “Save landing,” and the same 57px bar as email/SMS/WhatsApp. Token bridging in Builder42 (cream surfaces, solid indigo, 22px Automations-style dot grid, Maildrill focus rings) is real work.

The task surface is not. Under that bar sits a second 57px `pbx-header` that still says **Builder42**, with Edit / Preview / **Code**, a five-size breakpoint picker, icon-only undo/redo, Tokens, zip Settings, and a Preferences dump. A new site is an empty 150px white container — not a Maildrill landing. Swap the host bar for any SaaS wrapper and this is a generic visual site builder. Brand lives in the wrapper; the job lives in leftover standalone chrome.

**Deterministic scan**: `detect.mjs --json` on `LandingPageBuilder.tsx`, `LandingPageBuilderPage.tsx`, `ChannelEditorShell.tsx`, `EditorHeader.tsx`, and `packages/builder42/src/app` (27 files) returned exit 0, `[]`. Config ignores (Geist, email-drawer layout-transition, ChannelEditorShell border-accent) did not fire because this was a markup-only scan. The detector did not catch the P0 behavioral bugs (Esc close, canvas-blind autosave); those are interaction/state, not static markup. Clean CLI is not a clean UX.

**Visual overlays**: No reliable user-visible overlay. Browser visualization skipped — no tab/snapshot API in this session. Live-server was never started. Fallback: source + CLI only. Auth-gated URL `/dashboard/landings/editor` was not opened.

#### Overall Impression

The landing editor looks like Maildrill until the second header. The biggest opportunity is one chrome story plus a save path that actually watches the canvas. Until Esc/Back and autosave are honest, craft in the palette is beside the point.

#### What's Working

1. **One product at the host edge.** Landings use `LANDING_IDENTITY` (indigo `--accent`, not a fake send-channel color) and the same name field / Save / status / toast slot as the email editor.
2. **Chrome craft inside Builder42 is real.** Token bridge, light header, focus-visible rings, template-replace confirm, subtree-delete confirm + undo toast, basics split into Essentials / Content / Utility (≤4).
3. **Honest load/error on the wrapper.** Spinner + “Loading editor…”, and a load-failure state that says the page outlived a restart and offers Reload.

#### Priority Issues

**[P0] Escape and Back discard the session — and Esc also kills confirm dialogs**
- **Why it matters**: The emergency exit is a trap. `LandingPageBuilder` binds window Escape → `onClose` with no dirty test. `SimpleModal` handles Esc in capture and does not stop the event, so “Replace page content?” / delete-subtree confirm close the dialog **and** the editor. Work vanishes.
- **Fix**: Host Esc must no-op while a `.pbx-modal` is open. Back/Esc: if dirty, confirm or flush first. Mirror the email editor’s modal-open guard.
- **Suggested command**: `/impeccable harden`

**[P0] “Autosave” does not watch the canvas**
- **Why it matters**: `markDirty()` is only called from `handleNameChange`. Email wires `onAutoSave={() => markDirty()}`. Interval save never runs for block edits; **Save landing** is the only persist. Status stays “Draft,” which reads as safe.
- **Fix**: Subscribe to document store changes (or add `onDirty` on the handle) and `markDirty()`. Wire ⌘S to `flush()`. Status: “Unsaved changes” vs “Autosaved.”
- **Suggested command**: `/impeccable harden`

**[P1] Dual chrome — Maildrill bar + Builder42 app**
- **Why it matters**: Two 57px headers. Inner brand string is “Builder42.” Code view + zip download are standalone export tools. Every control in the second bar is a competing primary.
- **Fix**: One host header. Fold view (Edit/Preview only), viewport, undo/redo into it. Drop or bury Code/zip. Relabel or remove Builder42. Keep Tokens/advanced behind Simple or a single Site panel.
- **Suggested command**: `/impeccable distill`

**[P1] First landing is a blank slab; publish is promised elsewhere**
- **Why it matters**: Empty flex container, no hint (`palette.hint` exists in i18n, not rendered). Desktop palette click is a no-op. List subtitle and disabled Publish teach “this goes live”; adapters keep publish off.
- **Fix**: Empty canvas: one recommended template + Essentials. Click-to-insert on desktop. Either ship a publish step or stop advertising it on the list until it exists.
- **Suggested command**: `/impeccable onboard`

**[P2] Failure UI lies; chrome is hostile to keyboard/SR**
- **Why it matters**: Save failure toast is a green check. Persist errors use an inline one-off banner. Back / undo / redo / panel toggles / Preferences are icon-only.
- **Fix**: Pass `'alert'` and branch the toast. Use shell styles for persist errors. Visible labels or consistent `aria-label`s. Focus-visible on host Back.
- **Suggested command**: `/impeccable audit`

#### Persona Red Flags

**Alex (Power User)**: ⌘Z works; ⌘S does not. Types on the canvas; header still says Draft. Hits Esc to blur a panel and lands on `/dashboard/landings` — document never flushed. Will not trust this next to email, which actually autosaves.

**Jordan (First-Timer)**: Create landing → Untitled landing → two headers, Builder42, a white empty frame. Clicks Text in Essentials: no insert (desktop drag-only). Templates: ~18 industry pages, then “Replace page content?”. Never finds Simple mode (defaults to advanced, buried in Preferences). Clicks Back with no “did you save?”

**Sam (Accessibility-Dependent)**: Tab order runs host Back (icon) → Landing name → Save landing → entire second header of icon controls. Two tablists plus site-settings tabs. Keyboard reorder is Alt+arrows (undiscoverable). Esc dismisses a dialog and also unmounts the route. Save failure is `role="status"` with a checkmark.

#### Minor Observations

- Two palette groups share the label **Content**.
- `experienceLevel` defaults to **advanced**; onboarding modal is standalone-only.
- `editorLang` default in `useLocalConfig` is `"es"` while the host pins `locale="en"`.
- Loading is a centered spinner, not a skeleton of the three-pane editor.
- Status idle label **Draft** vs saved **Autosaved** conflates product state with persist state.
- List **Publish** is a disabled menu item; editor has no equivalent.

#### Questions to Consider

- If this is a Maildrill landing, why does the user meet **Builder42** before they meet their page?
- What if the only first-run choice was “blank” vs “one starter,” and Tokens / Code / zip were not on the first screen at all?
- Should **Save landing** and **Publish** be one story, or should the list stop talking about public URLs until publish is real?
- Is Esc “leave the editor” in this product, or “close the thing in front of me”? It cannot be both.
