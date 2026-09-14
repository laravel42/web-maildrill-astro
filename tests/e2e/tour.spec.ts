import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/app';
import { blockOutbound } from './helpers/no-outbound';
import {
  markEmailTourSeen,
  markLandingTourSeen,
  resetEmailTourState,
  resetLandingTourState,
  tourNextButton,
  tourPopover,
} from './helpers/tour';

/**
 * The guided tour (driver.js, `@md/product-tour`), end to end in both visual
 * editors (F6, docs/product-tour-driverjs-plan.md §4).
 *
 * ⚠️ KNOWN PRODUCT BUG (reported, not fixed here — out of scope per this
 * task's contract): in this environment, both `useEmailBuilderTour` and
 * `useBuilder42Tour` auto-start the tour TWICE on a single mount of the
 * editor, producing two fully independent, simultaneous `driver()`
 * instances (two `.driver-popover.md-tour` nodes, two `.driver-overlay`
 * nodes, two independent Escape guards). This was diagnosed directly (see
 * PR/task report "FINDINGS"): the two instances are not a single duplicated
 * render — clicking "Next" on one instance's popover advances only that
 * instance to its next step while the other instance's popover (a
 * completely separate step) remains on screen and blocks pointer events
 * over the first ("subtree intercepts pointer events"), and pressing
 * Escape dismisses neither. A full step-by-step walk therefore cannot be
 * driven coherently through the DOM — see the `test.fixme` at the bottom of
 * each `describe` block, which demonstrates this precisely instead of
 * papering over it with `.first()`/`force: true` tricks that would assert
 * nothing real about user-facing behavior.
 *
 * The tests that DO run below only assert things that remain true and
 * meaningful despite the duplication: the popover's content/theme/anchor
 * resolution is correct (both instances render identical, correct content
 * for their respective step), persistence and auto-start gating work, and
 * the relaunch entry points fire. Each of those would still fail loudly if
 * the underlying feature broke — they are not defeated by the duplication
 * bug, they coexist with it.
 *
 * Both editors are heavy React islands mounted with `client:only="react"`;
 * 45s timeouts here match what the other specs already budget for these
 * same routes (`smoke.spec.ts`, `workspace-tour.spec.ts`).
 *
 * Never sends anything live: `blockOutbound` + the `afterEach` assertion are
 * mandatory here too, even though no test clicks "Send test" — the tour's
 * `eb.header.actions` step only highlights that button, and a future
 * regression that turned a highlight into a click must fail loudly here.
 */

let blocked: string[];

test.beforeEach(async ({ page }) => {
  blocked = await blockOutbound(page);
});

test.afterEach(() => {
  expect(blocked, 'the tour must never attempt an outbound send').toEqual([]);
});

test.describe('email editor tour (/dashboard/templates/email)', () => {
  test('auto-starts on first visit with the branded popover', async ({ page }) => {
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page).first();
    await expect(popover, 'tour popover appears on first visit').toBeVisible({ timeout: 45_000 });
    await expect(popover).toHaveClass(/md-tour/);
    await expect(popover.locator('.driver-popover-title')).toHaveText('Name and autosave');
  });

  test('does not auto-start once already seen', async ({ page }) => {
    await markEmailTourSeen(page);
    await gotoApp(page, '/dashboard/templates/email');

    // Give the auto-start effect a real chance to fire before asserting its absence.
    await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1000);
    await expect(tourPopover(page)).toHaveCount(0);
  });

  test('relaunches from the header help button', async ({ page }) => {
    await markEmailTourSeen(page);
    await gotoApp(page, '/dashboard/templates/email');
    await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible({ timeout: 45_000 });
    await expect(tourPopover(page)).toHaveCount(0);

    // Header help button — `title`/`aria-label` resolve to inspector.json's
    // `helpTour` ("View the guided tour"), next to undo/redo in `#ee-editor-header`.
    await page.getByRole('button', { name: 'View the guided tour' }).click();
    await expect(
      tourPopover(page).first(),
      'help button relaunches the tour',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('relaunches from the command palette', async ({ page }) => {
    await markEmailTourSeen(page);
    await gotoApp(page, '/dashboard/templates/email');
    await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible({ timeout: 45_000 });
    await expect(tourPopover(page)).toHaveCount(0);

    // Command palette entry — common.json's `commandPalette.actions.tour`
    // ("View the guided tour"), on the `@josecortez1/c42-react` headless
    // controller (`data-c42-command-*` markup contract, not a plain <input>).
    // Wait for the palette's own root to attach before firing its hotkey.
    await page.waitForSelector('[data-c42-command-palette]', { state: 'attached', timeout: 10_000 });
    await page.keyboard.press('Control+k');
    const paletteInput = page.locator('[data-c42-command-input]');
    await expect(paletteInput).toBeVisible({ timeout: 5_000 });
    await paletteInput.fill('guided tour');
    // `force: true`: the tour's own overlay appears the instant this click is
    // delivered (the palette closes and driver.js mounts synchronously), so
    // Playwright's default post-click stability re-check can see that overlay
    // covering the target on its next actionability poll and report the click
    // as unresolved even though it already fired. Asserting the popover next
    // is the real proof the click worked.
    await page.getByText('View the guided tour', { exact: true }).click({ force: true });
    await expect(
      tourPopover(page).first(),
      'command palette relaunches the tour',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the popover theme resolves to the indigo accent, not brand orange, over a translucent overlay', async ({
    page,
  }) => {
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');
    const popover = tourPopover(page).first();
    await expect(popover).toBeVisible({ timeout: 45_000 });

    const nextBtn = tourNextButton(page).first();
    await expect(nextBtn).toBeVisible();
    const primaryBg = await nextBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    // theme.palette.primary.main for the email channel is the indigo interactive
    // accent (`--accent: #4f46e5` = rgb(79, 70, 229)) — see
    // `buildEmailBuilderTourCssVars` in `useEmailBuilderTour.ts`. It must never
    // resolve to the brand orange (`--brand: #ff441f` = rgb(255, 68, 31)).
    expect(primaryBg, 'primary button is not brand orange').not.toMatch(/rgba?\(\s*255,\s*68,\s*31/);
    expect(primaryBg, 'primary button background is set').not.toBe('rgba(0, 0, 0, 0)');

    const overlayColor = await page.evaluate(() => {
      const overlay = document.querySelector('.driver-overlay') as HTMLElement | null;
      return overlay ? getComputedStyle(overlay).backgroundColor : null;
    });
    expect(overlayColor, 'driver.js overlay is present').not.toBeNull();
    // Never pure opaque black (§2 of the plan: "overlay translúcido, no negro puro").
    expect(overlayColor).not.toBe('rgb(0, 0, 0)');
    expect(overlayColor).not.toBe('rgba(0, 0, 0, 1)');
  });

  test.fixme(
    'BUG: the tour auto-starts twice on a single mount, so a full step walk and Escape cannot be driven coherently — ' +
      'see the file-level doc comment above and the task report FINDINGS for the full diagnosis. ' +
      'This is a real product defect in useEmailBuilderTour.ts (out of scope to fix per this task\'s ' +
      'contract — packages/** is off-limits): two independent driver() instances end up mounted ' +
      'simultaneously (two `.driver-popover.md-tour`, two `.driver-overlay`), each on its own step ' +
      'once advanced, and the second instance\'s overlay physically intercepts pointer events over ' +
      'the first\'s "Next" button (Playwright: "subtree intercepts pointer events"). Escape dismisses ' +
      'neither instance. A test that force-clicks through this or asserts only `.first()` throughout ' +
      'a full walk would be green without ever exercising the real single-tour user journey — that is ' +
      'exactly the "test verde que no mordería si el tour se rompiera" this task\'s contract forbids.',
    async ({ page }) => {
      await resetEmailTourState(page);
      await gotoApp(page, '/dashboard/templates/email');
      await expect(tourPopover(page)).toHaveCount(1, { timeout: 45_000 });
    },
  );
});

test.describe('landing editor tour (/dashboard/landings/editor)', () => {
  test('auto-starts on first visit with the branded popover, in edit view (not preview)', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page).first();
    await expect(popover, 'tour popover appears on first visit').toBeVisible({ timeout: 45_000 });
    await expect(popover).toHaveClass(/md-tour/);

    // §1.4.2 / §3.2 step 2 (`pbx.toolbar.views`): the tour forces `view === "edit"`
    // before this step so nothing is left highlighting inside the preview iframe.
    // The edit-mode canvas frame anchor must be resolvable; the preview iframe
    // (driver.js cannot highlight inside it) must not be the active view.
    await expect(page.locator('[data-tour="pbx.canvas.frame"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('does not auto-start once already seen', async ({ page }) => {
    await markLandingTourSeen(page);
    await gotoApp(page, '/dashboard/landings/editor');

    await expect(page.locator('[data-tour="pbx.canvas.frame"]')).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1000);
    await expect(tourPopover(page)).toHaveCount(0);
  });

  test.skip(
    'relaunches from the profile menu — SKIPPED: unreachable in this embed. ' +
      '`packages/builder42/src/Builder42Editor.tsx` (the chrome Maildrill actually mounts at ' +
      '/dashboard/landings/editor) never imports `app/layout/Header.tsx`/`ProfileMenu.tsx` — only ' +
      '`Sidebar`, `Canvas`, `Inspector`, and `HostCanvasToolbar` (`app/layout/HostToolbar.tsx`). ' +
      'The `pbx.profileMenu` anchor and its "View the guided tour" action only exist in the ' +
      'standalone `app/App.tsx` tree, confirmed by `LandingPageBuilder.tsx`\'s own doc comment: ' +
      '"Builder42\'s own document header is not mounted in embed." The host\'s `EditorHeader.tsx` ' +
      'wires a tour-restart entry point for the email channel only (`EMAIL_BUILDER_TOUR_ANCHORS.' +
      'headerActions`); it wires no equivalent for `builder42`/landings. So there is no on-demand ' +
      'relaunch entry point reachable at this route today — item 4 of the task\'s coverage list ' +
      '("desde el menú de perfil") does not apply to the landing editor as actually wired.',
    async ({ page }) => {
      await markLandingTourSeen(page);
      await gotoApp(page, '/dashboard/landings/editor');
      const profileTrigger = page.locator('[data-tour="pbx.profileMenu"]');
      await profileTrigger.click();
      await page.getByRole('button', { name: 'View the guided tour' }).click();
      await expect(tourPopover(page).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test('the popover theme resolves to the indigo accent over a translucent overlay', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');
    const popover = tourPopover(page).first();
    await expect(popover).toBeVisible({ timeout: 45_000 });

    const nextBtn = tourNextButton(page).first();
    await expect(nextBtn).toBeVisible();
    const primaryBg = await nextBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    // `builder42/src/styles/chrome/tour.css` maps `--md-tour-accent` from
    // `--pb-chrome-accent`, itself the shared indigo interactive accent — never
    // the brand orange.
    expect(primaryBg, 'primary button is not brand orange').not.toMatch(/rgba?\(\s*255,\s*68,\s*31/);
    expect(primaryBg, 'primary button background is set').not.toBe('rgba(0, 0, 0, 0)');

    const overlayColor = await page.evaluate(() => {
      const overlay = document.querySelector('.driver-overlay') as HTMLElement | null;
      return overlay ? getComputedStyle(overlay).backgroundColor : null;
    });
    expect(overlayColor, 'driver.js overlay is present').not.toBeNull();
    expect(overlayColor).not.toBe('rgb(0, 0, 0)');
    expect(overlayColor).not.toBe('rgba(0, 0, 0, 1)');
  });

  test.fixme(
    'BUG: the tour auto-starts twice on a single mount, so a full step walk and Escape cannot be driven ' +
      "coherently — see tests\\e2e\\tour.spec.ts's file-level doc comment and the task report FINDINGS. " +
      'Same defect family as the email editor\'s (useBuilder42Tour.ts, also out of scope: packages/** is ' +
      'off-limits), confirmed independently here: after auto-start, the two `.driver-active-element`s carry ' +
      'DIFFERENT anchors (`pbx.header.identity` and `pbx.toolbar.views` were observed simultaneously active ' +
      'in the same diagnosis run), proving two independently-driven `driver()` instances rather than one ' +
      'duplicated render.',
    async ({ page }) => {
      await resetLandingTourState(page);
      await gotoApp(page, '/dashboard/landings/editor');
      await expect(tourPopover(page)).toHaveCount(1, { timeout: 45_000 });
    },
  );
});
