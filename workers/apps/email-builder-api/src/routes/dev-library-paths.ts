/**
 * Resolves the bundled `skills/email-builder/references/` directory at
 * module load. Used by both `dev-save-section` (sections) and
 * `dev-save-theme` (themes) handlers.
 *
 * This file is intentionally tiny: ts-jest under CommonJS rejects
 * `import.meta.url` at the syntactic level. Isolating the resolution
 * here lets every spec mock just this module
 * (`jest.mock('./dev-library-paths')`) instead of either rewriting the
 * routes or switching the entire test suite to ESM mode.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SKILLS_REFERENCES_DIR = resolve(__dirname, '../../../../skills/email-builder/references');
