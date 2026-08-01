// `pnpm typecheck` — root `tsc --noEmit` with vendored/upstream noise filtered.
//
// `tsc` type-checks every non-declaration file that enters the program, and
// `exclude` cannot stop imports from pulling files in. Several dependencies
// ship raw TypeScript sources (`email-builder-standalone` and the other
// vendored EmailBuilder.js packages, `wa-template-studio`, `auth-astro`), so
// the root run drags them in and checks them under the root tsconfig — whose
// `@/*` alias and compiler flags are wrong for them. Errors from `packages/`
// and `node_modules/` are therefore suppressed here; first-party packages get
// a real check under their own tsconfig (see the `typecheck` script in
// package.json), and the vendored EmailBuilder tree is upstream's to check.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(root, 'node_modules', '.bin', 'tsc');

const run = spawnSync(tsc, ['--noEmit', '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

if (run.error) {
  console.error(`typecheck: failed to run tsc: ${run.error.message}`);
  process.exit(1);
}

const SUPPRESSED = /^(packages|node_modules)[/\\]/;
let kept = 0;
let suppressed = 0;
let suppressing = false;

for (const line of `${run.stdout}${run.stderr}`.split('\n')) {
  const isErrorLine = /^\S.*: error TS\d+:/.test(line);
  if (isErrorLine) {
    suppressing = SUPPRESSED.test(line);
    if (suppressing) {
      suppressed += 1;
      continue;
    }
    kept += 1;
  } else if (suppressing && (/^\s/.test(line) || line === '')) {
    continue; // continuation of a suppressed multi-line message
  } else {
    suppressing = false;
  }
  if (line !== '') console.log(line);
}

if (suppressed > 0) {
  console.log(
    `typecheck: suppressed ${suppressed} error(s) in packages/ and node_modules/ ` +
      '(TS sources checked under the wrong tsconfig — see scripts/typecheck.mjs)',
  );
}

if (kept > 0) {
  console.error(`typecheck: ${kept} error(s) in app code`);
  process.exit(1);
}
if (run.status !== 0 && suppressed === 0) process.exit(run.status ?? 1);
