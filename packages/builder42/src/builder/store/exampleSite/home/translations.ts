import type { NodeId, NodeTranslations } from "../../../model/types";

/**
 * Traducciones i18n de la home del sitio de ejemplo (docs/12 §B.4).
 *
 * Vivían en `registry/layouts/pages/exampleHome.ts` cuando la home de ejemplo
 * era además una plantilla del `layoutRegistry`. Esa plantilla se retiró
 * (docs/48 §1: andamiaje de la Fase 13 que duplicaba el sitio de ejemplo del
 * bootstrap), así que las traducciones vuelven a su sitio natural, junto al
 * documento que traducen.
 */
export function exampleHomeTranslations(): Record<NodeId, NodeTranslations> {
  return {
    heroTitle: {
      en: { content: "<strong>Build pages without writing code</strong>" },
      it: { content: "<strong>Crea pagine senza scrivere codice</strong>" },
    },
    heroSubtitle: {
      en: { content: "Drag, drop and export static HTML + CSS ready to publish." },
      it: { content: "Trascina, rilascia ed esporta HTML + CSS statico pronto da pubblicare." },
    },
    heroCta: {
      en: { label: "Get started" },
      it: { label: "Inizia" },
    },
    featureATitle: {
      en: { content: "<strong>Responsive out of the box</strong>" },
      it: { content: "<strong>Responsive di serie</strong>" },
    },
    featureABody: {
      en: { content: "Mobile-first with per-breakpoint overrides, no hand-written CSS." },
      it: { content: "Mobile-first con override per breakpoint, senza CSS scritto a mano." },
    },
    featureBTitle: {
      en: { content: "<strong>100% static export</strong>" },
      it: { content: "<strong>Export 100% statico</strong>" },
    },
    featureBBody: {
      en: { content: "HTML + CSS ready to deploy, no builder runtime." },
      it: { content: "HTML + CSS pronti da pubblicare, senza runtime del builder." },
    },
    planLabel: {
      en: { content: "<strong>Choose your plan</strong>" },
      it: { content: "<strong>Scegli il tuo piano</strong>" },
    },
    footerNote: {
      en: { content: "© Builder42 — example document." },
      it: { content: "© Builder42 — documento di esempio." },
    },
    img: {
      en: { alt: "Example asset" },
      it: { alt: "Asset di esempio" },
    },
  };
}
