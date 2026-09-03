#!/usr/bin/env node
/**
 * build-runtime.mjs — compila el runtime JS opt-in del OUTPUT
 * (`src/runtime/behaviors/*.ts`, `src/runtime/actions/*.ts`, `enhance.ts`,
 * `ui.ts`) a bundles IIFE sueltos en `src/runtime/dist/*.js`.
 *
 * Estos bundles son la fuente que consumen:
 *  - el editor (`export/runtimeBundles.vite.ts`, vía `import.meta.glob` con
 *    `?raw` — los incrusta como STRING en el preview/`enhance.js` inline);
 *  - el servidor (`export/runtimeBundles.node.ts`, vía `fs.readFileSync` —
 *    los enlaza como `/assets/js/<moduleId>.js` en el sitio publicado).
 *
 * Sin este build, `src/runtime/dist/` no existe: el glob de Vite devuelve
 * `{}`, ningún behavior se hidrata en el export ni en el Preview del canvas
 * (el `<dialog>` del Modal se ve por CSS pero nunca abre — `showModal()`
 * nunca corre porque el bundle nunca se inyecta), y el servidor tampoco
 * tiene qué enlazar. Hay que correrlo cada vez que cambia algo bajo
 * `src/runtime/`.
 *
 * Cada archivo de `behaviors/`/`actions/` se auto-registra en
 * `window.__pbBehaviors` al cargar (ver el bloque final de cada módulo,
 * p. ej. `runtime/behaviors/modal.ts`) — así que basta bundlear cada uno por
 * separado con Vite en modo librería y escribir la salida con el nombre de
 * `moduleId` esperado por el registry (`BehaviorDefinition.runtime.moduleId` /
 * `ActionDefinition.runtime.moduleId`).
 *
 * Formato de salida **`es`** (ESM), NO `iife`: tanto el export a disco
 * (`<script type="module" src="…/enhance.js" defer>`, ver cabecera de
 * `enhance.ts`) como el preview inline (`inlineRuntimeScripts` →
 * `<script type="module">…</script>`) cargan estos bundles como MÓDULO. El
 * wrapper que genera el formato `iife` referencia `this` en el scope superior
 * para exponer su global (`(function(t){...})(this.__pbRuntime_x=...)`) — en
 * un módulo ES ese `this` de nivel superior es `undefined` (modo estricto
 * implícito), así que el bundle rompía con "Cannot read properties of
 * undefined" apenas se evaluaba, ANTES de registrar nada en
 * `window.__pbBehaviors` (bug real, reportado en Preview). El formato `es` no
 * usa ese wrapper — el auto-registro en `window.__pbBehaviors` (side-effect al
 * evaluar el módulo) corre igual, y sigue sin exportar nada consumible.
 */

import { build } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const packageRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const runtimeDir = path.join(packageRoot, "src/runtime");
const outDir = path.join(runtimeDir, "dist");

/** `moduleId → archivo fuente` para los behaviors (docs/16, registry/behaviors/*.ts). */
const BEHAVIOR_ENTRIES = {
  accordion: "behaviors/accordion.ts",
  carousel: "behaviors/carousel.ts",
  countUp: "behaviors/countUp.ts",
  expandable: "behaviors/expandable.ts",
  formValidation: "behaviors/formValidation.ts",
  lightbox: "behaviors/lightbox.ts",
  marquee: "behaviors/marquee.ts",
  modal: "behaviors/modal.ts",
  navbar: "behaviors/navbar.ts",
  parallax: "behaviors/parallax.ts",
  revealOnScroll: "behaviors/revealOnScroll.ts",
  scrollProgress: "behaviors/scrollProgress.ts",
  scrollSpy: "behaviors/scrollSpy.ts",
  sticky: "behaviors/sticky.ts",
  tabs: "behaviors/tabs.ts",
  themeToggle: "behaviors/themeToggle.ts",
  toggle: "behaviors/toggle.ts",
};

/** `moduleId → archivo fuente` para acciones de click con runtime propio
 * (registry/actions/*.ts). `formActions` cubre `submitForm` + `resetForm`. */
const ACTION_ENTRIES = {
  dismiss: "actions/dismiss.ts",
  openUrl: "actions/openUrl.ts",
  scrollTo: "actions/scrollTo.ts",
  formActions: "actions/formActions.ts",
};

/** Loader + micro-runtime, con su propio nombre de salida fijo. */
const STANDALONE_ENTRIES = {
  enhance: "enhance.ts",
  ui: "ui.ts",
};

const ALL_ENTRIES = { ...BEHAVIOR_ENTRIES, ...ACTION_ENTRIES, ...STANDALONE_ENTRIES };

async function buildOne(moduleId, relativeEntry) {
  const entry = path.join(runtimeDir, relativeEntry);
  await build({
    root: runtimeDir,
    logLevel: "warn",
    configFile: false,
    build: {
      outDir,
      emptyOutDir: false,
      minify: "esbuild",
      sourcemap: false,
      lib: {
        entry,
        formats: ["es"],
        fileName: () => `${moduleId}.js`,
      },
    },
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const ids = Object.keys(ALL_ENTRIES);
  console.log(`[build-runtime] compilando ${ids.length} módulos → ${path.relative(packageRoot, outDir)}/`);
  for (const [moduleId, relativeEntry] of Object.entries(ALL_ENTRIES)) {
    await buildOne(moduleId, relativeEntry);
    console.log(`  ✓ ${moduleId}.js`);
  }
  console.log("[build-runtime] listo.");
}

main().catch((err) => {
  console.error("[build-runtime] falló:", err);
  process.exitCode = 1;
});
