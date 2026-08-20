import { Suspense } from 'react';
import LazyBoundary from './shared/LazyBoundary';
import { lazyWithRetry } from '@/lib/app/lazy-with-retry';
import type { AutomationDetail, PieceMeta } from '@/lib/app/automations';
import styles from './automations/AutomationBuilder.module.css';

/**
 * Lazy entry point for the composer.
 *
 * The builder — canvas, layout engine, inspector, condition editor, step picker — is a
 * meaningful chunk, and every other workspace screen would pay for it on load if it were
 * imported statically. It is split here so that `/dashboard/*` bundles are unchanged by
 * Automations existing, per the performance requirement.
 *
 * `lazyWithRetry` rather than plain `React.lazy`: Vite can 504 a chunk mid-session while
 * re-optimizing deps, and `lazy` memoises the rejection.
 */
const AutomationBuilder = lazyWithRetry(() => import('./automations/AutomationBuilder'));

export default function AutomationBuilderIsland(props: {
  automation: AutomationDetail;
  pieces: PieceMeta[];
}) {
  return (
    <LazyBoundary label="the automation builder">
      <Suspense fallback={<div className={styles.loading}>Loading the builder…</div>}>
        <AutomationBuilder {...props} />
      </Suspense>
    </LazyBoundary>
  );
}
