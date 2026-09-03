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
 * separado con Vite en modo librería (formato IIFE, sin imports externos: son
 * TS puro sin dependencias npm) y escribir la salida con el nombre de
 * `moduleId` esperado por el registry (`BehaviorDefinition.runtime.moduleId` /
 * `ActionDefinition.runtime.moduleId`).
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
        formats: ["iife"],
        name: `__pbRuntime_${moduleId}`,
        fileName: () => `${moduleId}.js`,
      },
      rollupOptions: {
        output: {
          // Los módulos se auto-registran en `window.__pbBehaviors` como
          // side-effect (no exportan nada consumible) — sin esto Rollup se
          // queja de "entry module … is using named and default exports
          // together" o similar para builds sin exports públicos reales.
          extend: true,
        },
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
