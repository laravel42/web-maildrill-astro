import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/app';
import { blockOutbound } from './helpers/no-outbound';
import {
  expectTourPopoverInsideViewport,
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
    await expect(popover.locator('.driver-popover-title')).toHaveText('Name your template');
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
    //
    // Paced by observed progress, not a fixed click budget (B44): the engine now labels
    // "Next" as "Done" only on the genuinely last step, so the walk must go the full
    // distance — and it now drops (never queues) a Next click that arrives while the
    // previous transition is still in flight (D46), so clicking again immediately after
    // a click can silently lose an iteration instead of advancing. Reading the popover's
    // own progress text (`.driver-popover-progress-text`, e.g. "3 of 15") before each click
    // and waiting for it to change afterwards paces the walk to the engine's real speed,
    // and the "of N" part gives a real bound instead of a magic number.
    const nextBtn = tourNextButton(page);
    const progressText = popover.locator('.driver-popover-progress-text');
    const initialProgress = (await progressText.textContent())?.trim() ?? '';
    const totalSteps = Number(initialProgress.match(/of\s+(\d+)/)?.[1] ?? 20);
    const maxIterations = totalSteps + 5;
    for (let i = 0; i < maxIterations; i++) {
      await expect(popover, `exactly one popover mid-walk (step ${i})`).toHaveCount(1);
      await expect(overlay, `exactly one overlay mid-walk (step ${i})`).toHaveCount(1);
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      const beforeClickProgress = await progressText.textContent();
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
      // The engine drops an overlapping click rather than queuing it (D46), so wait for
      // the observable proof the tour actually moved on — the progress text changing —
      // before clicking again, instead of racing the next click against an in-flight
      // transition. Bounded but generous: the engine can spend up to ~2s on a step whose
      // anchor has to be waited for.
      await expect(
        progressText,
        `tour advanced past step "${beforeClickProgress}" (step ${i})`,
      ).not.toHaveText(beforeClickProgress ?? '', { timeout: 5_000 });
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
    const highlightedActions = page.locator('.driver-active-element').and(sendTest);
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

  test('the popover renders inside the viewport, not parked off-screen (D36)', async ({ page }) => {
    // Deliberately NOT emulating reduced motion here: D36 only reproduced with
    // driver.js's default step-transition animation (the bug was in the
    // measure-before-styles-apply timing of that path), so this test must run
    // the default, unmodified animation path rather than the reduced-motion
    // shortcut the other multi-step tests above use.
    await resetEmailTourState(page);
    await gotoApp(page, '/dashboard/templates/email');

    const popover = tourPopover(page).first();
    await expect(popover, 'tour popover appears on first visit').toBeVisible({ timeout: 45_000 });
    // Lets the default reposition animation settle before measuring — D36's bogus
    // offsets were written at the initial positioning, but only a settled popover
    // gives a stable rect to assert against.
    await page.waitForTimeout(500);
    await expectTourPopoverInsideViewport(page, 'first step popover must be inside the viewport');

    await tourNextButton(page).first().click();
    await expect(popover, 'popover is still present after Next').toBeVisible();
    await page.waitForTimeout(500);
    await expectTourPopoverInsideViewport(page, 'second step popover must be inside the viewport');
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

    // Paced by observed progress, not a fixed click budget (B44) — see the matching
    // email-editor test above for the full rationale (B36's "Done"-early fix means the
    // walk must now go the full distance, and D46's dropped-overlapping-click behaviour
    // means clicking again immediately after a click can silently lose an iteration).
    const nextBtn = tourNextButton(page);
    const progressText = popover.locator('.driver-popover-progress-text');
    const initialProgress = (await progressText.textContent())?.trim() ?? '';
    const totalSteps = Number(initialProgress.match(/of\s+(\d+)/)?.[1] ?? 20);
    const maxIterations = totalSteps + 5;
    for (let i = 0; i < maxIterations; i++) {
      await expect(popover, `exactly one popover mid-walk (step ${i})`).toHaveCount(1);
      await expect(overlay, `exactly one overlay mid-walk (step ${i})`).toHaveCount(1);
      await expect(nextBtn).toBeVisible();
      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      const beforeClickProgress = await progressText.textContent();
      await nextBtn.click({ timeout: 60_000 });
      if (isDone) break;
      await expect(
        progressText,
        `tour advanced past step "${beforeClickProgress}" (step ${i})`,
      ).not.toHaveText(beforeClickProgress ?? '', { timeout: 5_000 });
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

  test('the popover renders inside the viewport, not parked off-screen (D36)', async ({ page }) => {
    // Deliberately NOT emulating reduced motion here: D36 only reproduced with
    // driver.js's default step-transition animation, so this test must run the
    // default, unmodified animation path rather than the reduced-motion shortcut
    // the other multi-step tests above use.
    await resetLandingTourState(page);
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });
    // Lets the default reposition animation settle before measuring — D36's bogus
    // offsets were written at the initial positioning, but only a settled popover
    // gives a stable rect to assert against.
    await page.waitForTimeout(500);
    await expectTourPopoverInsideViewport(page, 'first step popover must be inside the viewport');

    await tourNextButton(page).click();
    await expect(popover, 'popover is still present after Next').toHaveCount(1);
    await page.waitForTimeout(500);
    await expectTourPopoverInsideViewport(page, 'second step popover must be inside the viewport');
  });

  // --- T6 — e2e coverage for T1–T5 (D37–D43): the landing tour's view/screen-size split, ---
  // --- the Templates-tab step, and the site-section steps (layers/pages/languages). ------
  //
  // Navigation in every test below uses `ArrowRight` (this package's own keyboard handler,
  // D18/D35/D43 in `createTour.ts`), never clicking the popover's own Next/Done button:
  // driver.js's built-in button-click routing recomputes, at click time, whether it believes
  // there is a reachable next step (`I()`/`F()` in `dist/driver.js.mjs`) and can route to
  // `onDoneClick` instead of this package's `onNextClick` when a step's anchor has not
  // mounted yet — confirmed live this session on `pbx.settings.pages` (B35/B36, still open,
  // orchestrator-owned, not this task's to fix). `ArrowRight` never has that failure mode: it
  // is handled entirely by this package's own listener, bounded only by
  // `currentDriveSteps.length` (T5's D21 fix), so it is the reliable way to drive a multi-step
  // walk in tests until B35/B36 is resolved.
  //
  // Every test below emulates `reducedMotion: 'reduce'` (same convention as the existing
  // "full step walk" tests above) so each transition's highlight swap — driver.js removes
  // `driver-active-element` from the outgoing element and adds it to the incoming one,
  // verified reading `dist/driver.js.mjs` — settles synchronously instead of straddling an
  // animated reposition; `waitForActiveElement()` below still polls rather than assuming a
  // fixed delay, since D43's own anchor wait can still add real time for a late-mounted step.
  /**
   * Waits until `anchor`'s own element carries `.driver-active-element`. Deliberately does
   * NOT require it to be the only element in the document with that class: found this session
   * (see B37 in `.orquestacion/bitacora.md`) that driver.js leaves the class on certain earlier
   * steps' elements after transitioning past them — reproduced consistently on this route,
   * `pbx.toolbar.history`/`pbx.toolbar.viewport`/`pbx.sidebar.tabs`/`pbx.sidebar.palette` keep
   * the class after the tour moves on, even though the popover, the overlay, and driver.js's
   * own `getActiveIndex()` are all correct and singular throughout — a CSS/cosmetic residue on
   * elements no longer part of the tour's flow, not a navigation defect and not this task's to
   * fix. What this assertion needs to prove (matching "one control per step", D37/D39/D41) is
   * that `anchor`'s own element is (still) actively highlighted, which the class also proves —
   * scoping the query to `anchor` avoids the accumulation making that unprovable.
   */
  async function waitForActiveElement(page: import('@playwright/test').Page, anchor: string): Promise<void> {
    await expect(page.locator(`.driver-active-element[data-tour="${anchor}"]`)).toHaveCount(1, {
      timeout: 8_000,
    });
  }

  /**
   * Presses ArrowRight then waits for the tour to settle on `anchor`, RETRYING the keypress
   * if the first press's transition does not land within a short window. Needed because these
   * tests fire ArrowRight in rapid succession with no natural user pacing between presses —
   * occasionally faster than a still-in-flight previous transition's own D43 anchor wait (or a
   * React re-render it triggered) has settled, which this package's own `transitionTo()` design
   * already tolerates for real users (each transition re-validates liveness after every
   * `await`) but can occasionally leave a single ArrowRight without an observable effect if it
   * arrives mid-transition. A second press once the first is idle is a normal, supported input
   * (arrow-key repeat), not a workaround for a defect — this is not the B35/B36 click-routing
   * bug (arrows never consult driver.js's `isLastStep()`/`L()`), just ordinary UI test timing.
   */
  /**
   * Presses ArrowRight then waits for the tour to settle on `anchor`. Retries the keypress
   * once if the first press's transition does not land within a short window — arrow-key
   * repeat is a normal, supported input, not a workaround for a defect; this is not the
   * B35/B36 click-routing bug (arrows never consult driver.js's `isLastStep()`/`L()`).
   */
  async function advanceTourTo(page: import('@playwright/test').Page, anchor: string): Promise<void> {
    await page.keyboard.press('ArrowRight');
    try {
      await waitForActiveElement(page, anchor);
    } catch {
      await page.keyboard.press('ArrowRight');
      await waitForActiveElement(page, anchor);
    }
  }

  test('T6: the view-mode step highlights only Edit/Preview, and the screen-size step highlights only the viewport switch (D37)', async ({
    page,
  }) => {
    await resetLandingTourState(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // Step 1 (header identity) → step 2 (view mode).
    await advanceTourTo(page, 'pbx.toolbar.views');

    const highlightedViews = page.locator('.driver-active-element[data-tour="pbx.toolbar.views"]');
    // The Edit/Preview group is inside the highlighted element (structural check — labels are
    // i18n'd, this route currently renders Spanish copy, B33)…
    await expect(highlightedViews.locator('.pbx-host-toolbar__view')).toHaveCount(2);
    // …but the viewport switch is a SEPARATE sibling anchor, never inside this one (D37 fixes
    // exactly this: `pbx.toolbar.views` used to wrap both).
    await expect(highlightedViews.locator('[data-tour="pbx.toolbar.viewport"]')).toHaveCount(0);

    // Step 2 (view mode) → step 3 (screen size).
    await advanceTourTo(page, 'pbx.toolbar.viewport');

    const highlightedViewport = page.locator('.driver-active-element[data-tour="pbx.toolbar.viewport"]');
    // The screen-size step's highlighted element must not be (or contain) the Edit/Preview
    // group — the reverse of the assertion above, proving neither step's highlight leaks into
    // the other's. (Not asserting the PREVIOUS step's class is gone: see B37 — driver.js does
    // not always clean up `.driver-active-element` from earlier steps' elements on this route,
    // a cosmetic residue unrelated to which element is currently, correctly highlighted.)
    await expect(highlightedViewport.locator('[data-tour="pbx.toolbar.views"]')).toHaveCount(0);
  });

  test('T6: the Templates step really opens the sidebar Templates tab (not just highlights it)', async ({ page }) => {
    test.setTimeout(60_000);
    await resetLandingTourState(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // header identity → views → viewport → history → sidebar tabs → palette → templates
    const anchorsInOrder = [
      'pbx.toolbar.views',
      'pbx.toolbar.viewport',
      'pbx.toolbar.history',
      'pbx.sidebar.tabs',
      'pbx.sidebar.palette',
      'pbx.sidebar.templates',
    ];
    for (const anchor of anchorsInOrder) {
      await advanceTourTo(page, anchor);
    }

    // The step's own `before()` (T3's store seam for the sidebar tab, D38) must have actually
    // switched the sidebar to its Templates tab, not merely pointed the tour at an anchor that
    // happens to exist regardless of which tab is open — assert the SIDEBAR's own Templates tab
    // button (`Sidebar.tsx`, `role="tab"`, `id="pbx-side-tab-templates"`) reports selected.
    await expect(page.locator('#pbx-side-tab-templates')).toHaveAttribute('aria-selected', 'true');
  });

  test('T6: each site-section step (layers/pages/languages) reaches its anchor with the matching settings tab active (D39/D41)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await resetLandingTourState(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // Walk forward to pbx.settings.tabs (the section strip itself) — the fixed anchor order
    // recorded in the log, up to and including the canvas step just before it.
    const anchorsBeforeSettings = [
      'pbx.toolbar.views',
      'pbx.toolbar.viewport',
      'pbx.toolbar.history',
      'pbx.sidebar.tabs',
      'pbx.sidebar.palette',
      'pbx.sidebar.templates',
      'pbx.canvas.frame',
      'pbx.settings.tabs',
    ];
    for (const anchor of anchorsBeforeSettings) {
      await advanceTourTo(page, anchor);
    }

    const sections: { anchor: string; tabId: string }[] = [
      { anchor: 'pbx.settings.layers', tabId: 'layers' },
      { anchor: 'pbx.settings.pages', tabId: 'pages' },
      { anchor: 'pbx.settings.languages', tabId: 'languages' },
    ];

    for (const { anchor, tabId } of sections) {
      await advanceTourTo(page, anchor);

      // The section's own tab button (`SiteSettingsPanel.tsx`, `role="tab"`,
      // `id="pbx-site-tab-<id>"`) must report `aria-selected="true"` — proving the step's
      // `before()` (D39: `openSiteSettings(tab)`) actually switched the panel to this
      // section, not merely that the anchor happens to be present regardless of which tab
      // is open (D41: anchors are stamped on each section's own root, so a wrong tab would
      // leave this anchor absent from the DOM entirely — this assertion is the direct proof
      // the RIGHT tab is the one that is open).
      await expect(page.locator(`#pbx-site-tab-${tabId}`)).toHaveAttribute('aria-selected', 'true');
    }
  });

  // --- T12 (B46/D50) --------------------------------------------------------------------
  //
  // Every assertion above checks WHICH element carries `.driver-active-element`, never
  // WHERE driver.js actually drew the overlay's cut-out ("stage") around it. B46 was a step
  // whose stage was drawn up to 329px below the element it was supposed to frame, in 4 of
  // 15 steps — and every test above stayed green through it, both because none of them
  // measures the stage's geometry, and because none of them seeds canvas content (3 of the
  // 4 broken steps, including the reported one, only exist on a non-empty canvas).
  //
  // driver.js paints a single overlay SVG whose `<path d="…">` has two subpaths: the
  // full-viewport rect, then the cut-out. The cut-out's opening command is
  // `M<x>,<y> h<w> a5,5 0 0 1 5,5 v<h> …` — parsed below with a regex rather than a full SVG
  // path parser, which is enough because this package always emits that exact shape (a
  // rounded rect drawn via H/A/V/A/H/A/V/A/Z commands from a fixed top-left `M`).
  test('T12: the overlay cut-out lines up with the highlighted element at every step, with content on the canvas (B46/D50)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await resetLandingTourState(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page, '/dashboard/landings/editor');

    const popover = tourPopover(page);
    await expect(popover, 'tour popover appears on first visit').toHaveCount(1, { timeout: 45_000 });

    // Dismiss the auto-started tour so the canvas can be seeded first — the reported step
    // (and two others) only exist once the canvas has content.
    await page.keyboard.press('Escape');
    await expect(popover, 'Escape dismisses the auto-started tour').toHaveCount(0);

    const seedButton = page.locator('.pbx-canvas-empty__primary');
    if (await seedButton.count() > 0) {
      await seedButton.click();
      await expect(page.locator('.pbx-canvas-empty'), 'canvas content replaces the empty state').toHaveCount(0, {
        timeout: 15_000,
      });
    }

    // Relaunch from the toolbar's restart control — same locator the existing
    // "relaunches from the toolbar tour-restart button" test above uses.
    await page.getByRole('button', { name: 'View the guided tour' }).click();
    await expect(popover, 'toolbar button relaunches the tour').toHaveCount(1, { timeout: 10_000 });

    const nextBtn = tourNextButton(page);
    const progressText = popover.locator('.driver-popover-progress-text');
    const initialProgress = (await progressText.textContent())?.trim() ?? '';
    const totalSteps = Number(initialProgress.match(/of\s+(\d+)/)?.[1] ?? 20);
    const maxIterations = totalSteps + 5;

    const visitedAnchors: string[] = [];

    for (let i = 0; i < maxIterations; i++) {
      await expect(popover, `exactly one popover mid-walk (step ${i})`).toHaveCount(1);
      await expect(nextBtn).toBeVisible();

      // Let the step settle (matches this file's own convention of a short pause after a
      // transition before measuring — see the D36 popover-position tests above) before
      // reading either rect: B46 was specifically a stale-measurement-at-mount defect, so
      // reading too early would risk masking exactly the regression this test exists to
      // catch instead of exercising the engine's own settle path.
      await page.waitForTimeout(150);

      const active = page.locator('.driver-active-element');
      await expect(active, `exactly one highlighted element mid-walk (step ${i})`).toHaveCount(1);

      const measured = await page.evaluate(() => {
        const el = document.querySelector('.driver-active-element');
        const overlay = document.querySelector('.driver-overlay path');
        if (!el || !overlay) return null;
        const rect = el.getBoundingClientRect();
        const d = overlay.getAttribute('d') ?? '';
        // `d` holds TWO subpaths — the full-viewport rect first, then the cut-out — so the
        // cut-out is the SECOND `M` command, not the first. `M<x>,<y> h<w> a5,5 0 0 1 5,5
        // v<h> …` on that second subpath gives the stage's own x/y/w/h directly (the
        // `a5,5 0 0 1 5,5` corner arcs are the rounding, not additional size). Coordinates
        // can be negative (an element flush against the viewport edge draws a stage with a
        // negative x/y), hence `-?` on every captured number.
        const subpaths = d.split(/(?=M)/).filter((s) => s.trim().length > 0);
        const cutout = subpaths[1] ?? '';
        const match = cutout.match(/M\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*h\s*(-?[\d.]+)[^v]*v\s*(-?[\d.]+)/);
        return {
          anchor: el.getAttribute('data-tour'),
          el: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          stage: match
            ? { x: Number(match[1]), y: Number(match[2]), w: Number(match[3]), h: Number(match[4]) }
            : null,
          pathD: d,
        };
      });

      expect(measured, `stage + element rects readable mid-walk (step ${i})`).not.toBeNull();
      const { anchor, el, stage, pathD } = measured!;
      expect(stage, `overlay path parsed to a stage rect (step ${i}, anchor ${anchor}) — d="${pathD}"`).not.toBeNull();

      if (anchor) {
        visitedAnchors.push(anchor);
      }

      const tolerance = 2;
      const expectedX = Math.round(el.x) - 5;
      const expectedY = Math.round(el.y) - 10;
      const expectedW = Math.round(el.w) + 10;
      const expectedH = Math.round(el.h) + 10;

      const detail =
        `step "${anchor}" — element rect ${JSON.stringify(el)}, ` +
        `stage rect ${JSON.stringify(stage)}, expected {x:${expectedX}, y:${expectedY}, w:${expectedW}, h:${expectedH}}`;

      expect(Math.abs(stage!.x - expectedX), `stage.x must line up with the element — ${detail}`).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(stage!.y - expectedY), `stage.y must line up with the element — ${detail}`).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(stage!.w - expectedW), `stage.w must line up with the element — ${detail}`).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(stage!.h - expectedH), `stage.h must line up with the element — ${detail}`).toBeLessThanOrEqual(tolerance);

      const isDone = await nextBtn.evaluate((el) => el.classList.contains('driver-popover-done-btn'));
      if (isDone) break;

      const beforeClickProgress = await progressText.textContent();
      await page.keyboard.press('ArrowRight');
      await expect(
        progressText,
        `tour advanced past step "${beforeClickProgress}" (step ${i})`,
      ).not.toHaveText(beforeClickProgress ?? '', { timeout: 5_000 });
    }

    // Prove the walk actually covered ground, including the three anchors that only exist
    // with content on the canvas (one of them the originally reported step) — otherwise a
    // future change that stops seeding content, or shortens the tour, would make this test
    // vacuously green while covering none of the steps that were broken.
    expect(visitedAnchors.length, `the walk visited more than a handful of steps — visited ${JSON.stringify(visitedAnchors)}`).toBeGreaterThan(5);
    expect(visitedAnchors, 'the walk included pbx.inspector.breakpoints').toContain('pbx.inspector.breakpoints');
    expect(visitedAnchors, 'the walk included pbx.settings.pages').toContain('pbx.settings.pages');
    expect(visitedAnchors, 'the walk included pbx.settings.languages').toContain('pbx.settings.languages');
  });

});
