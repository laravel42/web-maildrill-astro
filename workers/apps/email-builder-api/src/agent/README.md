# Email-builder agent

LLM agent layer for Maildrill's EmailBuilder: craft-aware generation, structured refine, step-by-step wizard composition, and two-pass quality scoring.

## Capabilities

| Capability             | Entry                                                             | Notes                                                                    |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Create from prompt     | `POST /api/generate`                                              | System prompt now includes `DESIGN_CRAFT_GUIDANCE` (Impeccable-inspired) |
| Wizard composer        | `POST /api/visual-brief/compile`                                  | 5-step UI → structured brief → craft prompt                              |
| Refine editing         | `POST /api/visual-brief/refine` + generate with `currentDocument` | Change chips + scope → refine prompt                                     |
| Quality score          | `POST /api/audit`                                                 | Deterministic /20 tech + /40 design seed                                 |
| Design + client report | `POST /api/critique`                                              | Audit first, then LLM design critique (no anchoring)                     |

## Two-pass quality (Impeccable invariant)

1. **Assessment A** — `runLlmCritique` reviews the document _without_ seeing technical scores.
2. **Assessment B** — `analyzeTemplate` runs the deterministic rule packs (structure, a11y, compatibility matrix, responsive, deliverability, design signals).
3. **Synthesis** — `buildQualityReport` merges findings, blends critique dimension scores, and surfaces `designWeaknesses` + `clientWeaknesses`.

## Key files

- `design-craft.ts` — generation craft bar injected into every system prompt
- `critique.ts` — LLM design reviewer
- `refine.ts` — refine-brief → prompt
- `report.ts` — full quality report orchestrator
- `../audit/*` — deterministic engine (already built; now wired to HTTP + UI)
- `../routes/agent.ts` — `/audit`, `/critique`, `/visual-brief/refine`

## Editor UI

- `AIVisualWizard` — brand → audience → tone → visual → sections → summary
- `RefineComposer` — change chips + scope in Refine mode
- `QualityPanel` — scores, strengths, design/client weakness lists, findings
