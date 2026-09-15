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
 * Product bug fixed under B7B8 (see the task's FINAL REPORT for the full diagnosis):
 * on a single mount of each editor, TWO independent `driver()` instances used to end
 * up active simultaneously (two `.driver-popover.md-tour` nodes, two `.driver-overlay`
 * nodes, on different steps, one physically intercepting pointer events over the
 * other's "Next" button — Playwright's "subtree intercepts pointer events" — and
 * Escape dismissing neither). The fix has two lines of defense:
 *
 * 1. ENGINE (`@md/product-tour/src/createTour.ts`, D7): a module-level registry keyed
 *    by `tourId` guarantees at most one active driver.js instance process-wide, even
 *    if a second `start()` for the same `tourId` arrives while the first is still
 *    awaiting its lazy `import('driver.js')` — LAST START WINS, the previous instance
 *    is destroyed synchronously before the new one drives.
 * 2. CALL SITE (`useEmailBuilderTour.ts`, proven cause): the restart-nonce effect's
 *    dependency array included `tourEnabled`, so it re-ran — treating it as a restart
 *    request — on the `tourEnabled` false→true transition that happens on every mount
 *    (the tour flag starts `false` in the editor's store and flips to `true` from a
 *    separate `useEffect`), firing a second `start()` while the auto-start effect's own
 *    `start()` was still awaiting its import. Fixed by only reacting to genuine
 *    `restartNonce` changes. The landing editor (`useBuilder42Tour.ts`) has no matching
 *    call-site pattern — its auto-start effect depends on `onboardingResolved` alone —
 *    and the duplicate could not be reproduced there by direct execution either; its
 *    correctness now rests on the engine-level guard alone (line of defense 1).
 *
 * Escape now dismisses the tour itself (D8): the capture-phase guard in `createTour.ts`
 * still stops propagation/default so the host editor never sees the key (existing F4
 * host tests depend on that), but the guard itself now destroys the active driver.js
 * instance (routed through `driverInstance.destroy()`, never a manual DOM teardown) and
 * emits `tour_dismissed` itself — driver.js's own public `destroy()` skips its
 * `onDestroyStarted` hook (verified by reading `driver.js@1.8.0`'s source: that hook only
 * fires on closes driver.js initiates itself, e.g. its popover's own close button), and
 * this package intentionally never relies on driver.js's own (bubble-phase, unreachable)
 * Escape handler.
 *
 * Both editors are heavy React islands mounted with `client:only="react"`; 45s timeouts
 * here match what the other specs already budget for these same routes
 * (`smoke.spec.ts`, `workspace-tour.spec.ts`).
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

  test('exactly one instance is ever active, and a full step walk finishes via the real Next button', async ({ page }) => {
    test.setTimeout(120_000);
    await resetEmailTourState(page);
    // driver.js animates each highlight transition by default (`animate: true` unless
    // `prefers-reduced-motion`, see `createTour.ts`). Emulating reduced motion — an already
    // supported, tested product behavior, not a test-only shortcut — keeps every step
    // transition's popover reposition instantaneous, so Playwright's real (non-`force`)
    // click/visibility actionability checks never have to straddle an in-flight CSS
    // transition across a 20-step walk.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    const overlay = page.locator('.driver-overlay');
    await expect(popover, 'exactly one popover on first visit').toHaveCount(1, { timeout: 45_000 });
    await expect(overlay, 'exactly one overlay on first visit').toHaveCount(1);
    await expect(popover).toHaveClass(/md-tour/);

    // Walk every step by clicking the real "Next"/"Done" button — never `.first()`, never
    // `force: true`. Re-asserting the single-instance invariant after each click is what
    // would have caught the original bug: a second, independently-driven instance left the
    // popover count at 2 (or its overlay intercepting pointer events on the "real" click).
    const nextBtn = tourNextButton(page);
    for (let i = 0; i < 20; i++) {
      await expect(popover, `exactly one popover mid-walk (step ${i})`).toHaveCount(1);
      await expect(overlay, `exactly one overlay mid-walk (step ${i})`).toHaveCount(1);
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
    }

    // The tour finished (Done clicked) — no popover/overlay left, and no test in this loop
    // ever needed `force: true` or hit a pointer-interception error, which is the real
    // proof there is only ever one live instance to click through.
    await expect(popover, 'tour finished, no popover left').toHaveCount(0);
    await expect(overlay, 'tour finished, no overlay left').toHaveCount(0);
  });

  test('Escape dismisses the tour while the editor itself stays open', async ({ page }) => {
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });

    await page.keyboard.press('Escape');

    await expect(popover, 'Escape dismisses the tour').toHaveCount(0);
    await expect(page.locator('.driver-overlay'), 'the overlay is gone too').toHaveCount(0);

    // The editor itself stays open: same route, canvas anchor still visible.
    await expect(page).toHaveURL(/\/dashboard\/templates\/email/);
    await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible();
  });

  test('clicking the popover\'s close button (×) dismisses the tour while the editor stays open (B16/D15)', async ({ page }) => {
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toHaveCount(1);

    // driver.js's own close button, rendered inside its popover
    // (`.driver-popover-close-btn`, `aria-label="Close"`, the «×» glyph) — not a
    // host-authored control.
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(popover, 'the close button removes the popover').toHaveCount(0);
    await expect(overlay, 'the close button removes the overlay too').toHaveCount(0);

    // The editor itself stays open: same route, canvas/save anchor still visible.
    await expect(page).toHaveURL(/\/dashboard\/templates\/email/);
    await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible();
  });

  test('clicking the overlay outside the popover dismisses the tour while the editor stays open (B16/D15)', async ({ page }) => {
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toHaveCount(1);

    // Click the overlay itself, at a fixed corner far from the popover and from the
    // highlighted element — `overlayClickBehavior: 'close'` only reacts to a click that
    // lands on the overlay's own stage path, not on the popover or the highlighted anchor.
    await overlay.click({ position: { x: 5, y: 5 } });

    await expect(popover, 'the overlay click removes the popover').toHaveCount(0);
    await expect(overlay, 'the overlay click removes itself').toHaveCount(0);

    await expect(page).toHaveURL(/\/dashboard\/templates\/email/);
    await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible();
  });

  test('Escape yields to the send-test dialog when it is open on top of the tour (D11): the dialog closes, the tour stays open on the same step', async ({ page }) => {
    test.setTimeout(120_000);
    await resetEmailTourState(page);
    // Reduced motion, as the full-step-walk test above: makes the tour's highlight
    // transitions instantaneous so the popover for the `eb.header.actions` step is
    // reliably visible (not mid-transition) once we start walking toward it.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // Walk the real "Next" button until the tour's own popover is visible on the
    // `eb.header.actions` step — the one that highlights the "Send test" button — instead
    // of racing a fixed timeout against the lazily-imported popover's mount time (the
    // actual defect this test targets, per the task's measured 5–6.5s mount window).
    const nextBtn = tourNextButton(page);
    const sendTest = page.getByRole('button', { name: 'Send test' });
    const highlightedActions = page.locator('.driver-active-element').filter({ has: sendTest });
    for (let i = 0; i < 20; i++) {
      if (await highlightedActions.count().catch(() => 0) > 0) break;
      await expect(popover, `tour popover visible mid-walk (step ${i})`).toHaveCount(1);
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
    }

    // The tour popover is now, deterministically, on the step that highlights "Send test" —
    // and the button itself sits inside the highlighted area, so it stays clickable without
    // `force: true`.
    await expect(highlightedActions, 'the eb.header.actions step highlights Send test').toHaveCount(1);
    await expect(popover, 'exactly one tour popover before opening the dialog').toHaveCount(1);

    await sendTest.click();
    const dialog = page.locator('[role="dialog"]:not(.driver-popover)').first();
    await expect(dialog, 'the send-test dialog opens on top of the tour').toBeVisible();

    await page.keyboard.press('Escape');

    // D11: Escape belongs to the topmost surface — the dialog, not the tour. It closes...
    await expect(dialog, 'Escape closes the dialog, not the tour').not.toBeVisible();
    // ...and the tour is still open, still on the very same step (its own popover, still
    // just the one instance, never dismissed).
    await expect(popover, 'the tour stays open on the same step').toHaveCount(1);
    await expect(popover.locator('.driver-popover-title')).toBeVisible();
  });

  test('the eb.header.save step highlights only "Save template", never the name field or the status indicator (B17/D16/D17)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // Walk the real "Next" button until the tour reaches the step whose title is
    // "Save template" — the popover title resolved from `steps.headerSave.title`.
    const nextBtn = tourNextButton(page);
    for (let i = 0; i < 20; i++) {
      const title = await popover.locator('.driver-popover-title').textContent();
      if (title === 'Save template') break;
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
    }
    await expect(popover.locator('.driver-popover-title')).toHaveText('Save template');

    // Exactly one highlighted element, and it IS the "Save template" button itself — not a
    // container around it — so it does not also contain the name field or the status
    // indicator (the two controls this step must never bundle in with, per the reported
    // defect).
    const active = page.locator('.driver-active-element');
    await expect(active).toHaveCount(1);
    await expect(active, 'the highlighted element is the Save template button itself').toHaveRole('button');
    await expect(active, 'the highlighted element is the Save template button itself').toHaveText(
      /Save template/,
    );
    await expect(active.locator('input'), 'the save step does not also highlight the name field').toHaveCount(0);
    await expect(
      active.locator('[role="status"]'),
      'the save step does not also highlight the autosave status indicator',
    ).toHaveCount(0);
  });

  test('the eb.header.status step highlights only the autosave indicator, never "Save template" or "Send test" (B17/D16/D17)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // Walk the real "Next" button until the tour reaches the step whose title is
    // "Autosave status" — the popover title resolved from `steps.headerStatus.title`.
    const nextBtn = tourNextButton(page);
    for (let i = 0; i < 20; i++) {
      const title = await popover.locator('.driver-popover-title').textContent();
      if (title === 'Autosave status') break;
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
    }
    await expect(popover.locator('.driver-popover-title')).toHaveText('Autosave status');

    // Exactly one highlighted element, and it is the status indicator itself (`role="status"`)
    // — not a container that also bundles in "Save template" or "Send test" (the two
    // interactive controls this step must never highlight alongside the indicator).
    const active = page.locator('.driver-active-element');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('role', 'status');
    await expect(
      active.locator('button', { hasText: 'Save template' }),
      'the status step does not also highlight the Save template button',
    ).toHaveCount(0);
    await expect(
      active.locator('button', { hasText: 'Send test' }),
      'the status step does not also highlight the Send test button',
    ).toHaveCount(0);
  });
});

test.describe('landing editor tour (/dashboard/landings/editor)', () => {
  test('auto-starts on first visit with the branded popover, in edit view (not preview)', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });
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

  test('relaunches from the toolbar tour-restart button', async ({ page }) => {
    await markLandingTourSeen(page);
    await gotoApp(page, '/dashboard/landings/editor');
    await expect(page.locator('[data-tour="pbx.canvas.frame"]')).toBeVisible({ timeout: 45_000 });
    await expect(tourPopover(page)).toHaveCount(0);

    // `app/layout/HostToolbar.tsx` — the toolbar the embed actually mounts
    // (`HostCanvasToolbar`). `title`/`aria-label` resolve to header.json's
    // `restartTour.label` ("View the guided tour"), the same copy ProfileMenu's
    // standalone-only entry uses, next to undo/redo in the canvas toolbar.
    await page.getByRole('button', { name: 'View the guided tour' }).click();
    await expect(
      tourPopover(page),
      'toolbar button relaunches the tour',
    ).toHaveCount(1, { timeout: 10_000 });
  });

  test('the popover theme resolves to the indigo accent over a translucent overlay', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');
    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });

    const nextBtn = tourNextButton(page);
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

  test('exactly one instance is ever active, and a full step walk finishes via the real Next button', async ({ page }) => {
    test.setTimeout(120_000);
    await resetLandingTourState(page);
    // See the matching email-editor test above for why: driver.js's default step-transition
    // animation is disabled by emulating reduced motion, so every "Next" click's popover
    // reposition is instantaneous and Playwright's real actionability checks never straddle
    // an in-flight CSS transition across a full step walk.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    const overlay = page.locator('.driver-overlay');
    await expect(popover, 'exactly one popover on first visit').toHaveCount(1, { timeout: 45_000 });
    await expect(overlay, 'exactly one overlay on first visit').toHaveCount(1);
    await expect(popover).toHaveClass(/md-tour/);

    const nextBtn = tourNextButton(page);
    for (let i = 0; i < 20; i++) {
      await expect(popover, `exactly one popover mid-walk (step ${i})`).toHaveCount(1);
      await expect(overlay, `exactly one overlay mid-walk (step ${i})`).toHaveCount(1);
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
    }

    await expect(popover, 'tour finished, no popover left').toHaveCount(0);
    await expect(overlay, 'tour finished, no overlay left').toHaveCount(0);
  });

  test('Escape dismisses the tour while the editor itself stays open', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });

    await page.keyboard.press('Escape');

    await expect(popover, 'Escape dismisses the tour').toHaveCount(0);
    await expect(page.locator('.driver-overlay'), 'the overlay is gone too').toHaveCount(0);

    // The editor itself stays open: same route, canvas anchor still visible.
    await expect(page).toHaveURL(/\/dashboard\/landings\/editor/);
    await expect(page.locator('[data-tour="pbx.canvas.frame"]')).toBeVisible();
  });

  test('clicking the popover\'s close button (×) dismisses the tour while the editor stays open (B16/D15)', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toHaveCount(1);

    await page.getByRole('button', { name: 'Close' }).click();

    await expect(popover, 'the close button removes the popover').toHaveCount(0);
    await expect(overlay, 'the close button removes the overlay too').toHaveCount(0);

    // The editor itself stays open: same route, canvas anchor still visible.
    await expect(page).toHaveURL(/\/dashboard\/landings\/editor/);
    await expect(page.locator('[data-tour="pbx.canvas.frame"]')).toBeVisible();
  });

  test('clicking the overlay outside the popover dismisses the tour while the editor stays open (B16/D15)', async ({ page }) => {
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover).toHaveCount(1, { timeout: 45_000 });
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toHaveCount(1);

    await overlay.click({ position: { x: 5, y: 5 } });

    await expect(popover, 'the overlay click removes the popover').toHaveCount(0);
    await expect(overlay, 'the overlay click removes itself').toHaveCount(0);

    await expect(page).toHaveURL(/\/dashboard\/landings\/editor/);
    await expect(page.locator('[data-tour="pbx.canvas.frame"]')).toBeVisible();
  });
});
