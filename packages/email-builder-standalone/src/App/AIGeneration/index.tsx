/**
 * Header entry point for AI template features.
 *
 * Hidden for now — the score / generate CTA is not shown in the editor
 * chrome. `AIGenerationDialog`, `TemplateScoreDialog`, and the wizard stay
 * in the package so they can be re-wired without touching TemplatePanel.
 *
 * When re-enabling: restore the contained indigo button that opened
 * `TemplateScoreDialog` (or `AIGenerationDialog`) and gate visibility on
 * `window.__emailBuilderOnAIGenerateTemplate` via the
 * `email-builder-ai-features-updated` event.
 */
export default function AIGeneration() {
  return null;
}
