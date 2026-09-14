/**
 * useEmailBuilderTour.tour-theme.test.ts — F5 acceptance
 * (docs/product-tour-driverjs-plan.md §2, §4):
 *
 *   (a) `buildEmailBuilderTourCssVars(theme)` produces every `--md-tour-*` variable
 *       `@md/product-tour`'s `theme.css` (`.md-tour` rules) actually consumes — cross-checked
 *       against that file's own source, not a hardcoded list, so this breaks if the shared
 *       package ever adds a new variable this mapping forgot.
 *   (b) The runtime mapping (`useTourThemeVars`, exercised end-to-end through the real hook)
 *       stamps those variables onto the driver.js popover wrapper (`.driver-popover.md-tour`)
 *       as soon as it's inserted into `document.body` — the portal target driver.js actually
 *       uses, outside this package's own React tree and outside `.dark-email-builder`/emotion's
 *       scope (§2 of the plan: a class-based mapping cannot reach it here).
 *   (c) Brand rule: the primary accent maps to the theme's indigo `primary.main`, never a
 *       literal orange, and the overlay is not pure black.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { useEmailBuilderTour, buildEmailBuilderTourCssVars } from '../src/tour/useEmailBuilderTour';
import { editorStateStore, setTour, resetDocument } from '../src/documents/editor/EditorContext';
import type { EmailBuilderTourStepsConfig } from '../src/tour/tourSteps';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `happy-dom` (this package's vitest `environment`) replaces the global `URL`
// constructor, so `new URL('../relative', import.meta.url)` — which relies on the
// platform URL parser resolving a relative path against a `file:` base — throws
// ("The URL must be of scheme file") once the test environment is set up. Resolve with
// plain `node:path` against the real `import.meta.url` (still a `file:` string, safe to
// pass straight to `fileURLToPath`) instead.
const testDir = path.dirname(fileURLToPath(import.meta.url));
const productTourRoot = path.resolve(testDir, '../../product-tour');

function readProductTourThemeCss(): string {
  return readFileSync(path.join(productTourRoot, 'src/theme.css'), 'utf8');
}

/** Every `--md-tour-<name>` this package's shared `theme.css` reads via `var(--md-tour-*)`. */
function extractConsumedMdTourVars(themeCssSource: string): string[] {
  const matches = themeCssSource.matchAll(/var\((--md-tour-[\w-]+)\)/g);
  return [...new Set([...matches].map((m) => m[1]!))].sort();
}

function Harness({ config }: { config: EmailBuilderTourStepsConfig }) {
  useEmailBuilderTour({ config });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(config: EmailBuilderTourStepsConfig, theme = createTheme()) {
  act(() => {
    root.render(
      <ThemeProvider theme={theme}>
        <Harness config={config} />
      </ThemeProvider>,
    );
  });
  return theme;
}

function resetEditorState() {
  setTour(false);
  resetDocument({ root: { type: 'EmailLayout', data: { childrenIds: [] } } } as never);
  editorStateStore.setState({ tourRestartNonce: 0 });
  localStorage.clear();
}

beforeEach(() => {
  resetEditorState();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.querySelectorAll('.driver-popover').forEach((el) => el.remove());
  resetEditorState();
  vi.restoreAllMocks();
});

describe('buildEmailBuilderTourCssVars — full --md-tour-* coverage (F5)', () => {
  it('produces every --md-tour-* variable that @md/product-tour\'s theme.css consumes', () => {
    const consumed = extractConsumedMdTourVars(readProductTourThemeCss());
    const produced = Object.keys(buildEmailBuilderTourCssVars(createTheme()));

    expect(produced.sort()).toEqual(expect.arrayContaining(consumed));
    // No stray variables the theme never reads (typo/drift guard, mirrors the
    // builder42 tour.css test).
    for (const name of produced) {
      expect(consumed.includes(name), `${name} is produced but theme.css never reads it`).toBe(true);
    }
  });

  it('maps the primary accent / focus ring to the theme\'s indigo, never a literal orange brand color', () => {
    const theme = createTheme({ palette: { primary: { main: '#4f46e5' } } });
    const vars = buildEmailBuilderTourCssVars(theme);
    expect(vars['--md-tour-accent']).toBe(theme.palette.primary.main);
    expect(vars['--md-tour-accent']?.toLowerCase()).not.toBe('#ff441f');
  });

  it('overlay is a translucent color (has an alpha component), not opaque pure black', () => {
    const vars = buildEmailBuilderTourCssVars(createTheme());
    expect(vars['--md-tour-overlay']).toMatch(/rgba\(/);
    expect(vars['--md-tour-overlay']).not.toBe('#000000');
    expect(vars['--md-tour-overlay']).not.toBe('rgb(0, 0, 0)');
  });

  it('reflects dark-mode palette values (surface/text flip) when given a dark theme', () => {
    const darkTheme = createTheme({ palette: { mode: 'dark' } });
    const vars = buildEmailBuilderTourCssVars(darkTheme);
    expect(vars['--md-tour-surface']).toBe(darkTheme.palette.background.paper);
    expect(vars['--md-tour-text']).toBe(darkTheme.palette.text.primary);
    // Sanity: dark and light themes actually diverge on at least the surface color —
    // otherwise this test would pass even if dark mode were silently ignored.
    const lightVars = buildEmailBuilderTourCssVars(createTheme({ palette: { mode: 'light' } }));
    expect(vars['--md-tour-surface']).not.toBe(lightVars['--md-tour-surface']);
  });
});

describe('useEmailBuilderTour — runtime --md-tour-* mapping on the popover wrapper (F5)', () => {
  it('stamps every --md-tour-* variable onto a .driver-popover.md-tour wrapper inserted into document.body', async () => {
    const theme = createTheme({ palette: { primary: { main: '#4f46e5' } } });
    mount({}, theme);

    // Simulate driver.js portaling its popover wrapper into document.body — exactly
    // what happens when the real tour highlights a step (outside this package's own
    // React tree, per module doc §5).
    const wrapper = document.createElement('div');
    wrapper.className = 'driver-popover md-tour';
    document.body.appendChild(wrapper);

    await vi.waitFor(() => {
      expect(wrapper.style.getPropertyValue('--md-tour-accent')).toBe(theme.palette.primary.main);
    });

    const expectedVars = {
      '--md-tour-surface': theme.palette.background.paper,
      '--md-tour-text': theme.palette.text.primary,
      '--md-tour-text-muted': theme.palette.text.secondary,
      '--md-tour-border': theme.palette.divider,
      '--md-tour-accent': theme.palette.primary.main,
      '--md-tour-accent-text': theme.palette.primary.contrastText,
      '--md-tour-font': theme.typography.fontFamily,
    };
    for (const [name, value] of Object.entries(expectedVars)) {
      expect(wrapper.style.getPropertyValue(name), name).toBe(value);
    }
    expect(wrapper.style.getPropertyValue('--md-tour-radius')).toMatch(/px$/);
    expect(wrapper.style.getPropertyValue('--md-tour-overlay')).toMatch(/rgba\(/);
  });

  it('does not stamp variables onto an unrelated popover-shaped element without the md-tour class', async () => {
    mount({});

    const unrelated = document.createElement('div');
    unrelated.className = 'driver-popover';
    document.body.appendChild(unrelated);

    await new Promise((r) => setTimeout(r, 20));
    expect(unrelated.style.getPropertyValue('--md-tour-accent')).toBe('');
  });

  it('re-stamps a wrapper nested inside another appended node (driver.js wraps the popover in extra containers)', async () => {
    const theme = createTheme({ palette: { primary: { main: '#4f46e5' } } });
    mount({}, theme);

    const outer = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.className = 'driver-popover md-tour';
    outer.appendChild(wrapper);
    document.body.appendChild(outer);

    await vi.waitFor(() => {
      expect(wrapper.style.getPropertyValue('--md-tour-accent')).toBe(theme.palette.primary.main);
    });
  });
});
