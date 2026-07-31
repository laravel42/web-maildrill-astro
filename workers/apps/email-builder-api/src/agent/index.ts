/**
 * Email-builder LLM agent surface.
 *
 * Orchestrates craft-aware generation guidance, refine compilation, and the
 * two-pass quality report (deterministic audit + LLM design critique).
 */

export { DESIGN_CRAFT_GUIDANCE } from './design-craft.js';
export { runLlmCritique, llmIssuesToFindings, type LlmCritique } from './critique.js';
export { compileRefineBrief, type CompileRefineResult } from './refine.js';
export { buildQualityReport, type FullQualityReport, type BuildReportOptions } from './report.js';
export { callLlmText, extractFirstJson, readStream } from './llm-text.js';
